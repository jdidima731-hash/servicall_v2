import { middleware } from '../_core/trpc';
import { 
  cache, 
  CacheOptions, 
  CACHE_STRATEGIES 
} from '../services/cacheService.enhanced';
import { logger } from "../infrastructure/logger";

/**
 * ============================================================================
 * TRPC CACHE MIDDLEWARE - Automatic Caching Layer
 * ============================================================================
 * 
 * Middleware tRPC pour gérer automatiquement le cache Redis sur les queries.
 * 
 * Fonctionnalités :
 * - Cache automatique des queries tRPC
 * - Configuration par endpoint via metadata
 * - Invalidation automatique sur mutations
 * - Support des stratégies de cache prédéfinies
 * - Logging et métriques
 * 
 * Usage :
 * ```typescript
 * export const myRouter = router({
 *   getItems: cachedProcedure
 *     .meta({ cache: { strategy: 'MEDIUM', tags: ['items'] } })
 *     .query(async () => { ... }),
 * });
 * ```
 */

// ============================================================================
// TYPES
// ============================================================================

export interface CacheMetadata {
  /** Stratégie de cache (STATIC, LONG, MEDIUM, SHORT, NONE) */
  strategy?: keyof typeof CACHE_STRATEGIES;
  /** TTL personnalisé (override la stratégie) */
  ttl?: number;
  /** Tags pour invalidation groupée */
  tags?: string[];
  /** Clé de cache personnalisée (fonction ou string) */
  cacheKey?: string | ((input: unknown, ctx: unknown) => string);
  /** Désactiver le cache pour cette query */
  disabled?: boolean;
  /** Stale-while-revalidate */
  swr?: boolean;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Générer une clé de cache à partir du path et de l'input
 */
function generateCacheKey(
  path: string,
  input: unknown,
  ctx: unknown,
  metadata?: CacheMetadata
): string {
  // Clé personnalisée
  if (metadata?.cacheKey) {
    if (typeof metadata.cacheKey === 'function') {
      return metadata.cacheKey(input, ctx);
    }
    return metadata.cacheKey;
  }

  // Clé par défaut : path + tenantId + input hashé
  const tenantId = ctx.tenantId ?? 'global';
  const inputHash = input ? JSON.stringify(input) : 'no-input';
  
  return `trpc:${tenantId}:${path}:${inputHash}`;
}

/**
 * Extraire les options de cache depuis la metadata
 */
function getCacheOptions(metadata?: CacheMetadata): CacheOptions {
  if (!metadata || metadata.disabled) {
    return { ttl: 0 }; // Pas de cache
  }

  const strategy = metadata.strategy 
    ? CACHE_STRATEGIES[metadata.strategy] 
    : CACHE_STRATEGIES['MEDIUM'];

  return {
    ttl: metadata.ttl ?? strategy!.defaultTtl,
    tags: metadata.tags ?? [],
    staleWhileRevalidate: metadata.swr ?? strategy!.swr,
  };
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * Middleware de cache pour les queries tRPC
 * 
 * Vérifie le cache avant d'exécuter la query.
 * Si la donnée est en cache, la retourne directement.
 * Sinon, exécute la query et met en cache le résultat.
 */
export const cacheMiddleware = middleware(async ({ ctx, next, path, type, meta }) => {
  // Le cache ne s'applique qu'aux queries
  if (type !== 'query') {
    return next();
  }

  const cacheMetadata = (meta as unknown)?.cache as CacheMetadata | undefined;

  // Cache désactivé pour cette query
  if (cacheMetadata?.disabled || cacheMetadata?.strategy === 'NONE') {
    logger.debug('[CacheMiddleware] Cache disabled for query', { path });
    return next();
  }

  const cacheKey = generateCacheKey(path, (ctx as unknown).input, ctx, cacheMetadata);
  const cacheOptions = getCacheOptions(cacheMetadata);

  try {
    // Essayer de récupérer du cache
    const cached = await cache.get(cacheKey, cacheOptions);

    if (cached !== null) {
      logger.debug('[CacheMiddleware] Cache HIT', { 
        path, 
        cacheKey,
        strategy: cacheMetadata?.strategy ?? 'MEDIUM'
      });

      return {
        ok: true,
        data: cached,
        ctx,
      } as unknown;
    }

    logger.debug('[CacheMiddleware] Cache MISS', { path, cacheKey });

    // Exécuter la query
    const result = await next();

    // Mettre en cache le résultat si succès
    if (result.ok) {
      await cache.set(cacheKey, result.data, cacheOptions);
      
      logger.debug('[CacheMiddleware] Cached result', { 
        path, 
        cacheKey,
        ttl: cacheOptions.ttl,
        tags: cacheOptions.tags
      });
    }

    return result;

  } catch (error: unknown) {
    logger.error('[CacheMiddleware] Error', { error, path, cacheKey });
    
    // En cas d'erreur cache, continuer sans cache
    return next();
  }
});

// ============================================================================
// INVALIDATION MIDDLEWARE
// ============================================================================

/**
 * Middleware d'invalidation pour les mutations tRPC
 * 
 * Invalide automatiquement le cache après une mutation réussie.
 */
export const invalidationMiddleware = middleware(async ({ ctx, next, path, type, meta }) => {
  // L'invalidation ne s'applique qu'aux mutations
  if (type !== 'mutation') {
    return next();
  }

  const result = await next();

  // Invalider le cache seulement si la mutation a réussi
  if (result.ok) {
    const invalidateMetadata = (meta as unknown)?.invalidate as {
      tags?: string[];
      patterns?: string[];
      tenant?: boolean;
    } | undefined;

    if (invalidateMetadata) {
      try {
        // Invalider par tags
        if (invalidateMetadata.tags && invalidateMetadata.tags.length > 0) {
          await cache.invalidateByTags(invalidateMetadata.tags);
          logger.info('[InvalidationMiddleware] Invalidated by tags', {
            path,
            tags: invalidateMetadata.tags
          });
        }

        // Invalider par patterns
        if (invalidateMetadata.patterns && invalidateMetadata.patterns.length > 0) {
          for (const pattern of invalidateMetadata.patterns) {
            await cache.invalidate(pattern);
          }
          logger.info('[InvalidationMiddleware] Invalidated by patterns', {
            path,
            patterns: invalidateMetadata.patterns
          });
        }

        // Invalider tout le tenant
        if (invalidateMetadata.tenant && ctx.tenantId) {
          await cache.invalidateTenant(ctx.tenantId);
          logger.info('[InvalidationMiddleware] Invalidated tenant', {
            path,
            tenantId: ctx.tenantId
          });
        }

      } catch (error: unknown) {
        logger.error('[InvalidationMiddleware] Error during invalidation', {
          error,
          path
        });
        // Ne pas faire échouer la mutation si l'invalidation échoue
      }
    }
  }

  return result;
});

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Combiner les deux middlewares pour une utilisation facile
 */
export const withCache = cacheMiddleware;
export const withInvalidation = invalidationMiddleware;

/**
 * Helper pour créer une procedure avec cache
 */
export function createCachedProcedure(baseProcedure: unknown) {
  return baseProcedure.use(cacheMiddleware);
}

/**
 * Helper pour créer une mutation avec invalidation
 */
export function createInvalidatingMutation(baseProcedure: unknown) {
  return baseProcedure.use(invalidationMiddleware);
}

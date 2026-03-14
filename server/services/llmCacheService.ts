/**
 * LLM CACHE SERVICE
 * ✅ PHASE 6 — Tâche 16 : Cache Redis pour les réponses LLM
 *
 * Stratégie :
 *   - Clé de cache = hash SHA-256 des messages + modèle + température
 *   - TTL configurable (défaut : 1 heure)
 *   - Cache uniquement les requêtes déterministes (temperature ≤ 0.3)
 *   - Namespace par tenant pour l'isolation des données
 *
 * Réduction des coûts estimée : 30-50% sur les requêtes répétitives
 */
import { createHash } from "crypto";
import { getRedisClient } from "../infrastructure/redis/redis.client";
import { logger } from "../infrastructure/logger";

export interface LLMCacheOptions {
  ttl?: number; // secondes, défaut 3600
  forceRefresh?: boolean;
  namespace?: string; // namespace par tenant
}

export interface LLMCacheEntry {
  response: string;
  model: string;
  cachedAt: string;
  hitCount: number;
}

const DEFAULT_TTL = 3600; // 1 heure
const MAX_CACHEABLE_TEMPERATURE = 0.3;

/**
 * Génère une clé de cache déterministe à partir des paramètres de la requête LLM.
 */
function buildCacheKey(
  tenantId: number,
  model: string,
  messages: Array<{ role: string; content: string }>,
  temperature: number,
  namespace?: string
): string {
  const payload = JSON.stringify({ model, messages, temperature });
  const hash = createHash("sha256").update(payload).digest("hex").substring(0, 32);
  const ns = namespace ? `:${namespace}` : "";
  return `llm:cache:t${tenantId}${ns}:${hash}`;
}

/**
 * Tente de récupérer une réponse LLM depuis le cache Redis.
 *
 * @returns La réponse en cache, ou null si absent / non cacheable
 */
export async function getLLMCache(
  tenantId: number,
  model: string,
  messages: Array<{ role: string; content: string }>,
  temperature: number,
  options: LLMCacheOptions = {}
): Promise<string | null> {
  // Ne pas cacher les requêtes créatives (temperature élevée)
  if (temperature > MAX_CACHEABLE_TEMPERATURE) {
    return null;
  }

  if (options.forceRefresh) {
    return null;
  }

  try {
    const redis = getRedisClient();
    const key = buildCacheKey(tenantId, model, messages, temperature, options.namespace);
    const cached = await redis.get(key);

    if (!cached) {
      return null;
    }

    const entry = JSON.parse(cached) as LLMCacheEntry;

    // Incrémenter le compteur de hits (fire-and-forget)
    const updatedEntry: LLMCacheEntry = { ...entry, hitCount: entry.hitCount + 1 };
    redis.set(key, JSON.stringify(updatedEntry), "KEEPTTL").catch(() => {});

    logger.debug("[LLMCache] Cache hit", {
      tenantId,
      model,
      hitCount: updatedEntry.hitCount,
      keyPrefix: key.substring(0, 30),
    });

    return entry.response;
  } catch (err: unknown) {
    logger.warn("[LLMCache] Cache read error", { error: err });
    return null;
  }
}

/**
 * Stocke une réponse LLM dans le cache Redis.
 */
export async function setLLMCache(
  tenantId: number,
  model: string,
  messages: Array<{ role: string; content: string }>,
  temperature: number,
  response: string,
  options: LLMCacheOptions = {}
): Promise<void> {
  // Ne pas cacher les requêtes créatives
  if (temperature > MAX_CACHEABLE_TEMPERATURE) {
    return;
  }

  try {
    const redis = getRedisClient();
    const key = buildCacheKey(tenantId, model, messages, temperature, options.namespace);
    const ttl = options.ttl ?? DEFAULT_TTL;

    const entry: LLMCacheEntry = {
      response,
      model,
      cachedAt: new Date().toISOString(),
      hitCount: 0,
    };

    await redis.set(key, JSON.stringify(entry), "EX", ttl);

    logger.debug("[LLMCache] Cache set", {
      tenantId,
      model,
      ttl,
      keyPrefix: key.substring(0, 30),
      responseLength: response.length,
    });
  } catch (err: unknown) {
    logger.warn("[LLMCache] Cache write error", { error: err });
  }
}

/**
 * Invalide toutes les entrées de cache pour un tenant donné.
 * Utile lors d'une mise à jour du prompt système.
 */
export async function invalidateTenantLLMCache(tenantId: number): Promise<number> {
  try {
    const redis = getRedisClient();
    const pattern = `llm:cache:t${tenantId}:*`;
    const keys = await redis.keys(pattern);

    if (keys.length === 0) {
      return 0;
    }

    await redis.del(...keys);
    logger.info("[LLMCache] Tenant cache invalidated", { tenantId, keysDeleted: keys.length });
    return keys.length;
  } catch (err: unknown) {
    logger.error("[LLMCache] Cache invalidation error", err, { tenantId });
    return 0;
  }
}

/**
 * Retourne les statistiques de cache pour un tenant.
 */
export async function getLLMCacheStats(tenantId: number): Promise<{
  totalKeys: number;
  totalHits: number;
}> {
  try {
    const redis = getRedisClient();
    const pattern = `llm:cache:t${tenantId}:*`;
    const keys = await redis.keys(pattern);

    let totalHits = 0;
    for (const key of keys) {
      const data = await redis.get(key);
      if (data) {
        const entry = JSON.parse(data) as LLMCacheEntry;
        totalHits += entry.hitCount;
      }
    }

    return { totalKeys: keys.length, totalHits };
  } catch {
    return { totalKeys: 0, totalHits: 0 };
  }
}

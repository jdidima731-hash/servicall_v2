/**
 * ARCHITECTURE REDIS CENTRALISÉE
 * ✅ PHASE 2 — Tâche 9 : Comportement Redis par environnement
 *
 * En production :
 *   - Si Redis est indisponible → crash du serveur (process.exit(1))
 *   - RedisMock est INTERDIT en production
 *
 * En développement / test :
 *   - Si DISABLE_REDIS=true ou REDIS_URL absent → RedisMock autorisé
 *   - Si connexion échoue → RedisMock avec avertissement
 */
import Redis from "ioredis";
import RedisMockLib from "ioredis-mock";
const RedisMock = RedisMockLib as unknown as typeof Redis;
import { logger } from "../../infrastructure/logger";

export let redisClient: Redis | null = null;

const isProduction = process.env['NODE_ENV'] === "production";

/**
 * Initialise la connexion Redis.
 * Doit être appelé au boot de l'application.
 *
 * @throws En production, crash si Redis est indisponible.
 */
export async function connectRedis(): Promise<Redis> {
  if (redisClient) {
    return redisClient;
  }

  const redisUrl = process.env['REDIS_URL'];
  const redisDisabled = process.env['DISABLE_REDIS'] === "true";

  // ─── PRODUCTION : Redis obligatoire ────────────────────────────────────────
  if (isProduction) {
    if (redisDisabled || !redisUrl) {
      logger.error("[Redis] REDIS_URL est requise en production. Arrêt du serveur.");
      process.exit(1);
    }

    logger.info("[Redis] Tentative de connexion en production...");
    try {
      redisClient = new Redis(redisUrl, {
        connectTimeout: 5000,
        retryStrategy: (times) => (times > 3 ? null : times * 500),
        enableReadyCheck: true,
      });

      await redisClient.ping();
      logger.info("[Redis] Connexion réussie (production).");
      return redisClient;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[Redis] Connexion échouée en production (${errMsg}). Arrêt du serveur.`);
      process.exit(1);
    }
  }

  // ─── DÉVELOPPEMENT / TEST : RedisMock autorisé ─────────────────────────────
  if (redisDisabled) {
    logger.warn("[Redis] DISABLE_REDIS=true → bascule sur RedisMock en mémoire (dev/test uniquement).");
    redisClient = new RedisMock() as unknown as Redis;
    return redisClient;
  }

  if (!redisUrl) {
    logger.warn("[Redis] REDIS_URL absente → bascule sur RedisMock en mémoire (dev/test uniquement).");
    redisClient = new RedisMock() as unknown as Redis;
    return redisClient;
  }

  logger.info("[Redis] Tentative de connexion...");
  try {
    redisClient = new Redis(redisUrl, {
      connectTimeout: 2000,
      retryStrategy: (times) => (times > 1 ? null : 100),
    });

    await redisClient.ping();
    logger.info("[Redis] Connexion réussie.");
    return redisClient;
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.warn(`[Redis] Connexion échouée (${errMsg}), bascule sur RedisMock (dev/test uniquement).`);
    redisClient = new RedisMock() as unknown as Redis;
    return redisClient;
  }
}

/**
 * Retourne l'instance unique du client Redis.
 * @throws Error si connectRedis() n'a pas été appelé au préalable.
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    throw new Error(
      "Le client Redis n'a pas été initialisé. Appelez connectRedis() au démarrage de l'application."
    );
  }
  return redisClient;
}

/**
 * Réinitialise l'instance (utile pour les tests)
 */
export function resetRedisClient(): void {
  redisClient = null;
}

/**
 * Export nommé 'redis' pour compatibilité avec les services qui l'importent directement.
 * Utilise un Proxy pour accéder dynamiquement à l'instance courante.
 */
export const redis = new Proxy({} as Redis, {
  get(_target, prop) {
    if (!redisClient) {
      throw new Error(
        "Le client Redis n'a pas été initialisé. Appelez connectRedis() au démarrage de l'application."
      );
    }
    const value = (redisClient as unknown)[prop];
    return typeof value === 'function' ? value.bind(redisClient) : value;
  }
});

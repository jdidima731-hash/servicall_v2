/**
 * API KEY MIDDLEWARE
 * ✅ PHASE 5 — Tâche 15 : Authentification par clé API (header x-api-key)
 *
 * Chaque clé API est associée à un tenant_id.
 * Les routes protégées par ce middleware requièrent le header :
 *   x-api-key: <clé>
 *
 * La clé est validée contre la table api_keys en base de données.
 * Le tenant_id est injecté dans req.tenantId pour les middlewares suivants.
 */
import type { Request, Response, NextFunction } from "express";
import { logger } from "../infrastructure/logger";
import { getRedisClient } from "../infrastructure/redis/redis.client";

// Extension du type Request pour inclure tenantId
declare global {
  namespace Express {
    interface Request {
      apiKeyTenantId?: number;
    }
  }
}

const API_KEY_CACHE_TTL = 300; // 5 minutes de cache Redis

/**
 * Valide la clé API et injecte le tenant_id dans la requête.
 * Utilise un cache Redis pour éviter les requêtes DB répétées.
 */
export async function apiKeyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const apiKey = req.headers["x-api-key"] as string | undefined;

  if (!apiKey) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Header x-api-key requis.",
    });
    return;
  }

  try {
    // 1. Vérifier le cache Redis
    const redis = getRedisClient();
    const cacheKey = `apikey:${apiKey}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      const tenantId = parseInt(cached, 10);
      req.apiKeyTenantId = tenantId;
      logger.debug("[ApiKey] Cache hit", { tenantId });
      next();
      return;
    }

    // 2. Valider en base de données
    const { getDb } = await import("../db");
    const db = await getDb();

    if (!db) {
      logger.error("[ApiKey] Database not available");
      res.status(503).json({ error: "Service Unavailable", message: "Base de données indisponible." });
      return;
    }

    // Import dynamique du schéma pour éviter les dépendances circulaires
    const { apiKeys } = await import("../../drizzle/schema").catch(() => ({ apiKeys: null }));

    if (!apiKeys) {
      logger.warn("[ApiKey] apiKeys table not found in schema, skipping validation");
      next();
      return;
    }

    const { eq, and } = await import("drizzle-orm");
    const result = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.key, apiKey), eq(apiKeys.isActive, true)))
      .limit(1);

    if (!result.length) {
      logger.warn("[ApiKey] Invalid or inactive API key", { keyPrefix: apiKey.substring(0, 8) });
      res.status(403).json({
        error: "Forbidden",
        message: "Clé API invalide ou désactivée.",
      });
      return;
    }

    const tenantId = result[0].tenantId;

    // 3. Mettre en cache
    await redis.set(cacheKey, String(tenantId), "EX", API_KEY_CACHE_TTL);

    req.apiKeyTenantId = tenantId;
    logger.debug("[ApiKey] Authenticated", { tenantId, keyPrefix: apiKey.substring(0, 8) });
    next();
  } catch (error: unknown) {
    logger.error("[ApiKey] Middleware error", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

/**
 * Middleware optionnel : valide la clé API si présente, sinon continue.
 * Utile pour les routes qui supportent à la fois l'auth session et l'auth API key.
 */
export async function optionalApiKeyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const apiKey = req.headers["x-api-key"] as string | undefined;
  if (!apiKey) {
    next();
    return;
  }
  return apiKeyMiddleware(req, res, next);
}

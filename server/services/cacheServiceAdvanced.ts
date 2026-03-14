/**
 * Advanced Redis Cache Service
 * Gestion avancée du cache pour prospects, dashboards et analytics
 * ✅ PHASE 2 — Performance & Scalabilité
 */

import { redis } from "../infrastructure/redis/redis.client";
import { logger } from "../infrastructure/logger";

export interface CacheOptions {
  ttl?: number; // Time to live en secondes
  namespace?: string;
}

export class AdvancedCacheService {
  private readonly defaultTTL = 3600; // 1 heure par défaut
  private readonly namespace = "servicall:cache";

  /**
   * Génère une clé de cache avec namespace
   */
  private getKey(key: string, namespace?: string): string {
    const ns = namespace || this.namespace;
    return `${ns}:${key}`;
  }

  /**
   * Récupère une valeur du cache
   */
  async get<T>(key: string, namespace?: string): Promise<T | null> {
    try {
      const cacheKey = this.getKey(key, namespace);
      const data = await redis.get(cacheKey);
      if (!data) return null;

      logger.debug("[Cache] Cache hit", { key: cacheKey });
      return JSON.parse(data) as T;
    } catch (error: unknown) {
      logger.error("[Cache] Error getting cache", { key, error });
      return null;
    }
  }

  /**
   * Stocke une valeur dans le cache
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    try {
      const cacheKey = this.getKey(key, options?.namespace);
      const ttl = options?.ttl || this.defaultTTL;
      const serialized = JSON.stringify(value);

      await redis.setex(cacheKey, ttl, serialized);
      logger.debug("[Cache] Cache set", { key: cacheKey, ttl });
    } catch (error: unknown) {
      logger.error("[Cache] Error setting cache", { key, error });
    }
  }

  /**
   * Récupère ou calcule une valeur (cache-aside pattern)
   */
  async getOrCompute<T>(
    key: string,
    computeFn: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    // Essayer de récupérer du cache
    const cached = await this.get<T>(key, options?.namespace);
    if (cached !== null) {
      return cached;
    }

    // Calculer la valeur
    logger.debug("[Cache] Cache miss, computing value", { key });
    const value = await computeFn();

    // Stocker dans le cache
    await this.set(key, value, options);

    return value;
  }

  /**
   * Invalide une clé de cache
   */
  async invalidate(key: string, namespace?: string): Promise<void> {
    try {
      const cacheKey = this.getKey(key, namespace);
      await redis.del(cacheKey);
      logger.debug("[Cache] Cache invalidated", { key: cacheKey });
    } catch (error: unknown) {
      logger.error("[Cache] Error invalidating cache", { key, error });
    }
  }

  /**
   * Invalide toutes les clés correspondant à un pattern
   */
  async invalidatePattern(pattern: string, namespace?: string): Promise<void> {
    try {
      const ns = namespace || this.namespace;
      const fullPattern = `${ns}:${pattern}`;
      const keys = await redis.keys(fullPattern);

      if (keys.length > 0) {
        await redis.del(...keys);
        logger.debug("[Cache] Pattern invalidated", { pattern: fullPattern, count: keys.length });
      }
    } catch (error: unknown) {
      logger.error("[Cache] Error invalidating pattern", { pattern, error });
    }
  }

  /**
   * Cache pour la liste des prospects
   */
  async getProspectsList(tenantId: number, page: number): Promise<any | null> {
    return this.get(`prospects:${tenantId}:page:${page}`, "prospects");
  }

  async setProspectsList(tenantId: number, page: number, data: unknown): Promise<void> {
    await this.set(`prospects:${tenantId}:page:${page}`, data, {
      ttl: 300, // 5 minutes
      namespace: "prospects",
    });
  }

  async invalidateProspectsCache(tenantId: number): Promise<void> {
    await this.invalidatePattern(`prospects:${tenantId}:*`, "prospects");
  }

  /**
   * Cache pour les statistiques du dashboard
   */
  async getDashboardStats(tenantId: number): Promise<any | null> {
    return this.get(`stats:${tenantId}`, "dashboard");
  }

  async setDashboardStats(tenantId: number, data: unknown): Promise<void> {
    await this.set(`stats:${tenantId}`, data, {
      ttl: 600, // 10 minutes
      namespace: "dashboard",
    });
  }

  async invalidateDashboardStats(tenantId: number): Promise<void> {
    await this.invalidate(`stats:${tenantId}`, "dashboard");
  }

  /**
   * Cache pour les analytics
   */
  async getAnalytics(tenantId: number, period: string): Promise<any | null> {
    return this.get(`analytics:${tenantId}:${period}`, "analytics");
  }

  async setAnalytics(tenantId: number, period: string, data: unknown): Promise<void> {
    const ttlMap: Record<string, number> = {
      day: 3600, // 1 heure
      week: 7200, // 2 heures
      month: 86400, // 1 jour
      year: 604800, // 1 semaine
    };

    await this.set(`analytics:${tenantId}:${period}`, data, {
      ttl: ttlMap[period] || 3600,
      namespace: "analytics",
    });
  }

  async invalidateAnalytics(tenantId: number): Promise<void> {
    await this.invalidatePattern(`analytics:${tenantId}:*`, "analytics");
  }

  /**
   * Cache pour les lead scores
   */
  async getLeadScore(prospectId: number): Promise<number | null> {
    const cached = await this.get<{ score: number }>(`lead_score:${prospectId}`, "leads");
    return cached?.score ?? null;
  }

  async setLeadScore(prospectId: number, score: number): Promise<void> {
    await this.set(`lead_score:${prospectId}`, { score }, {
      ttl: 1800, // 30 minutes
      namespace: "leads",
    });
  }

  async invalidateLeadScore(prospectId: number): Promise<void> {
    await this.invalidate(`lead_score:${prospectId}`, "leads");
  }

  /**
   * Récupère les statistiques du cache
   */
  async getStats(): Promise<any> {
    try {
      const info = await redis.info("memory");
      const keys = await redis.keys(`${this.namespace}:*`);

      return {
        keysCount: keys.length,
        memoryInfo: info,
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      logger.error("[Cache] Error getting stats", { error });
      return null;
    }
  }

  /**
   * Vide tout le cache
   */
  async flush(): Promise<void> {
    try {
      const keys = await redis.keys(`${this.namespace}:*`);
      if (keys.length > 0) {
        await redis.del(...keys);
        logger.info("[Cache] Cache flushed", { keysDeleted: keys.length });
      }
    } catch (error: unknown) {
      logger.error("[Cache] Error flushing cache", { error });
    }
  }
}

/**
 * Instance singleton du service de cache avancé
 */
export const advancedCacheService = new AdvancedCacheService();

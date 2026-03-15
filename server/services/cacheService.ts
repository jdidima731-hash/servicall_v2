import IORedis from 'ioredis';
import { ENV } from '../_core/env';
import { logger } from "../infrastructure/logger";

class CacheService {
  private redis: IORedis | null = null;

  constructor() {
    this.initialize();
  }

  initialize() {
    if (ENV.redisEnabled) {
      try {
        logger.info('[CacheService] Initializing Redis connection...', { url: ENV.redisUrl });
        this.redis = new IORedis(ENV.redisUrl, {
          maxRetriesPerRequest: 3,
          retryStrategy: (times) => Math.min(times * 50, 2000),
        });
        this.redis.on('connect', () => {
          logger.info('[CacheService] Redis connected successfully');
        });
        this.redis.on('error', (err) => {
          logger.warn('[CacheService] Redis error', { error: err.message });
        });
      } catch (error: unknown) {
        logger.warn('[CacheService] Failed to initialize Redis', { error });
      }
    } else {
      logger.info('[CacheService] Redis is disabled via environment');
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.redis) return null;
    try {
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error: unknown) {
      logger.error('[CacheService] Get error', error, { key });
      return null;
    }
  }

  async set(key: string, data: unknown, ttlSeconds: number = 300): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.setex(key, ttlSeconds, JSON.stringify(data));
    } catch (error: unknown) {
      logger.error('[CacheService] Set error', error, { key });
    }
  }

  async invalidate(pattern: string): Promise<void> {
    if (!this.redis) return;
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) await this.redis.del(...keys);
    } catch (error: unknown) {
      logger.error('[CacheService] Invalidate error', error, { pattern });
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.del(key);
    } catch (error: unknown) {
      logger.error('[CacheService] Delete error', error, { key });
    }
  }

  async invalidateForTenant(tenantId: number): Promise<void> {
    await this.invalidate(`tenant:${tenantId}:*`);
  }

  async getOrSet<T>(key: string, fn: () => Promise<T>, ttlSeconds: number = 300): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const value = await fn();
    await this.set(key, value, ttlSeconds);
    return value;
  }
}

export const cache = new CacheService();

// Export individual functions for direct import
export const get = cache.get.bind(cache);
export const set = cache.set.bind(cache);
export const deleteCache = cache.delete.bind(cache);
export const getOrSet = cache.getOrSet.bind(cache);

// Export constants for easier usage
export const CACHE_KEYS = {
  DASHBOARD: (tenantId: number, timeRange: string) => `tenant:${tenantId}:dashboard:${timeRange}`,
  PROSPECT_LIST: (tenantId: number, page: number) => `tenant:${tenantId}:prospects:page:${page}`,
  TENANT_CONFIG: (tenantId: number) => `tenant:${tenantId}:config`,
  ACTIVE_WORKFLOWS: (tenantId: number) => `tenant:${tenantId}:workflows:active`,
};

export const CACHE_TTL = {
  WORKFLOWS: 3600,
  DASHBOARD: 300,
  CONFIG: 86400,
}

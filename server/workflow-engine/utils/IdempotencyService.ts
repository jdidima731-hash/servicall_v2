/**
 * IDEMPOTENCY SERVICE
 * Prevents duplicate execution of mutations.
 */

import { getRedisClient } from "../../infrastructure/redis/redis.client";
import { Logger } from "./Logger";
import { getDbInstance } from "../../db";
import { processedEvents } from "../../../drizzle/schema";
import { and, eq } from "drizzle-orm";

export class IdempotencyService {
  private static logger = new Logger('IdempotencyService');
  private static TTL = 86400; // 24 hours

  /**
   * Checks if a key exists and sets it if not.
   * Returns true if the operation is allowed (first time), false otherwise.
   * Uses Redis for fast check and DB for persistence.
   */
  static async checkAndSet(key: string, context: string): Promise<boolean> {
    try {
      // 1. Check Redis first (Fast path)
      const fullKey = `idempotency:${context}:${key}`;
      const client = getRedisClient();
      const redisResult = await (client as unknown).set(fullKey, 'processed', 'EX', this.TTL, 'NX');

      if (!redisResult) {
        this.logger.warn('Duplicate operation detected (Redis)', { key, context });
        return false;
      }

      // 2. Check DB (Persistence path)
      const db = getDbInstance();
      const [existing] = await db.select()
        .from(processedEvents)
        .where(and(
          eq(processedEvents.source, context),
          eq(processedEvents.eventId, key)
        ))
        .limit(1);

      if (existing) {
        this.logger.warn('Duplicate operation detected (DB)', { key, context });
        return false;
      }

      // 3. Store in DB
      await db.insert(processedEvents).values({
        source: context,
        eventId: key,
        processedAt: new Date()
      });

      return true;
    } catch (error: unknown) {
      // If DB/Redis is down, we log and allow the operation to proceed 
      // (Fail-open to not block business, but log the failure)
      this.logger.error('Idempotency check failed', { error, key });
      return true; 
    }
  }

  /**
   * Generates an idempotency key from a payload
   */
  static generateKey(payload: Record<string, unknown>): string {
    const str = JSON.stringify(payload);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }
}

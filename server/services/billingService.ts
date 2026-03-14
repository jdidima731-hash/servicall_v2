import { getDb } from "../db";
import { usageMetrics } from "../../drizzle/schema";
import { logger } from "../infrastructure/logger";
import { eq, sql, and, gte } from "drizzle-orm";

/**
 * Billing Service - Suivi de la consommation Twilio et OpenAI
 */
export class BillingService {
  /**
   * Enregistrer l'utilisation d'une ressource (Appel, SMS, Tokens)
   */
  static async recordUsage(data: {
    tenantId: number;
    resourceType: "twilio_voice" | "twilio_sms" | "openai_token";
    externalId?: string;
    quantity: number;
    cost?: number;
    metadata?: unknown;
  }) {
    try {
      const db = await getDb();
      if (!db) return;

      await db.insert(usageMetrics).values({
        tenantId: data.tenantId,
        resourceType: data.resourceType,
        externalId: data.externalId,
        quantity: data.quantity.toString(),
        cost: data.cost?.toString() || "0",
        metadata: data.metadata,
      });

      logger.debug(`[Billing] Recorded ${data.resourceType} usage for tenant ${data.tenantId}`, {
        quantity: data.quantity,
        cost: data.cost
      });
    } catch (error: unknown) {
      logger.error("[Billing] Failed to record usage", { error, data });
    }
  }

  /**
   * Récupérer les statistiques de consommation pour un tenant
   */
  static async getUsageStats(tenantId: number, days: number = 30) {
    try {
      const db = await getDb();
      if (!db) return null;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const stats = await db
        .select({
          resourceType: usageMetrics.resourceType,
          totalQuantity: sql<number>`sum(${usageMetrics.quantity})`,
          totalCost: sql<number>`sum(${usageMetrics.cost})`,
        })
        .from(usageMetrics)
        .where(and(
          eq(usageMetrics.tenantId, tenantId),
          gte(usageMetrics.createdAt, startDate)
        ))
        .groupBy(usageMetrics.resourceType);

      return stats;
    } catch (error: unknown) {
      logger.error("[Billing] Failed to get usage stats", { error, tenantId });
      return null;
    }
  }

  /**
   * Estimer le coût OpenAI basé sur le modèle et les tokens
   * Prix indicatifs (à ajuster selon les tarifs OpenAI en vigueur)
   */
  static estimateOpenAICost(model: string, tokens: number): number {
    const rates: Record<string, number> = {
      "gpt-4o": 0.000015, // $15 / 1M tokens (moyenne input/output)
      "gpt-4o-mini": 0.0000003, // $0.30 / 1M tokens
      "gpt-4": 0.00003,
      "gpt-3.5-turbo": 0.000002,
    };

    const defaultRate = 0.0000003; // gpt-4o-mini fallback
    const rate = rates[model as keyof typeof rates] ?? defaultRate;
    return tokens * rate;
  }
}

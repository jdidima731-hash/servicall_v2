/**
 * Health Check Router
 * Endpoints pour vérifier la santé de Redis et des queues
 * ✅ AXE 5: Métriques Prometheus pour l'exploitabilité
 */

import { router } from "../_core/trpc";
import { publicProcedure } from "../procedures";
import { getQueueStats } from "../services/queueService";
import { MetricsService } from "../services/metricsService";
import { logger } from "../infrastructure/logger";
import { HealthService } from "../services/healthService";
import { jobQueue } from "../services/jobQueueService";
import { z } from "zod";
import { adminProcedure } from "../procedures";

export const healthRouter = router({
  /**
   * Vérifier la santé globale du système
   */
  check: publicProcedure.query(async () => {
    try {
      return await HealthService.getFullStatus();
    } catch (error: unknown) {
      logger.error("[Health] Erreur lors de la vérification de santé", { error });
      return {
        status: "error",
        timestamp: new Date().toISOString(),
        version: "2.0.0",
        checks: {
          database: { status: "error", latency_ms: 0, message: "Internal error" },
          redis: { status: "error", latency_ms: 0, message: "Internal error" },
          ia: { status: "disabled", latency_ms: 0 },
          notifications: { status: "disabled", latency_ms: 0 },
          system: { disk: "N/A", memory: "N/A", uptime: "0s" }
        }
      };
    }
  }),

  /**
   * ✅ AXE 5: Endpoint pour Prometheus
   * Retourne les métriques au format texte Prometheus
   */
  metrics: publicProcedure.query(async () => {
    // Dans une implémentation réelle, on utiliserait prom-client
    // Ici on simule l'export des métriques collectées par MetricsService
    const stats = await MetricsService.getGlobalMetrics();
    
    let prometheusString = "# HELP servicall_calls_total Total number of calls\n";
    prometheusString += "# TYPE servicall_calls_total counter\n";
    prometheusString += `servicall_calls_total ${stats.totalCalls}\n\n`;
    
    prometheusString += "# HELP servicall_ai_latency_ms AI processing latency in ms\n";
    prometheusString += "# TYPE servicall_ai_latency_ms gauge\n";
    prometheusString += `servicall_ai_latency_ms ${stats.avgAiLatency}\n`;
    
    return prometheusString;
  }),

  /**
   * Obtenir toutes les statistiques des queues
   */
  allQueuesStats: publicProcedure.query(async () => {
    const queueNames = [
      "sms-campaigns",
      "email-campaigns",
      "call-analysis",
      "outbound-calls",
    ] as const;

    const stats = await Promise.all(
      queueNames.map(async (queueName) => {
        try {
          return await getQueueStats(queueName);
        } catch (error: unknown) {
          return {
            queueName,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      })
    );

    return stats;
  }),

  /**
   * Récupérer les jobs en échec (DLQ)
   */
  getFailedJobs: adminProcedure
    .input(z.object({ limit: z.number().optional().default(50) }))
    .query(async ({ input }) => {
      return await jobQueue.getFailedJobs(input.limit);
    }),

  /**
   * Réessayer un job en échec
   */
  retryFailedJob: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return await jobQueue.retryJob(input.id);
    }),
});

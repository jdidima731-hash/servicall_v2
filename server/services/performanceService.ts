import { logger } from "../infrastructure/logger";
import { AlertingService } from "./alertingService";

export class PerformanceService {
  private static responseTimes: number[] = [];

  /**
   * Mesure le temps d'exécution d'une fonction
   */
  static async measure<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      
      this.responseTimes.push(duration);
      if (this.responseTimes.length > 100) this.responseTimes.shift();

      // Alerter si la performance se dégrade (> 2s pour une opération)
      if (duration > 2000) {
        await AlertingService.sendAlert({
          source: "Performance",
          message: `Opération lente détectée : ${name} (${duration}ms)`,
          severity: "medium",
          metadata: { name, duration }
        });
      }

      return result;
    } catch (error: unknown) {
      const duration = Date.now() - start;
      logger.error(`[Performance] Error in ${name} after ${duration}ms`, { error });
      throw error;
    }
  }

  /**
   * Récupère les métriques de performance moyennes
   */
  static getMetrics() {
    const avg = this.responseTimes.length > 0
      ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length
      : 0;
    
    return {
      avgResponseTime: Math.round(avg),
      sampleSize: this.responseTimes.length,
      status: avg < 500 ? "healthy" : avg < 1500 ? "degraded" : "critical"
    };
  }

  /**
   * Simule un test de charge pour la téléphonie
   */
  static async runLoadTest(concurrentCalls: number) {
    logger.info(`[Performance] Starting load test with ${concurrentCalls} concurrent calls`);
    const results = [];
    
    for (let i = 0; i < concurrentCalls; i++) {
      results.push(this.measure(`CallSimulation-${i}`, async () => {
        // Simule un délai réseau/API
        await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 100));
        return true;
      }));
    }

    await Promise.all(results);
    logger.info(`[Performance] Load test completed for ${concurrentCalls} calls`);
    return this.getMetrics();
  }
}

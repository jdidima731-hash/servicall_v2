/**
 * Retention Cron - Automatisation de la politique de rétention RGPD
 */

import { RightToBeForgottenService } from "./RightToBeForgottenService";
import { logger } from "../infrastructure/logger";

/**
 * Exécute la politique de rétention tous les jours à minuit
 * Supprime les données de plus de 3 ans (1095 jours) par défaut
 */
export async function startRetentionCron() {
  const RETENTION_DAYS = parseInt(process.env["RGPD_RETENTION_DAYS"] ?? "1095");
  
  logger.info(`[RGPD] Initializing retention cron (Retention: ${RETENTION_DAYS} days)`);

  // Exécution immédiate au démarrage pour vérification
  try {
    await RightToBeForgottenService.runRetentionPolicy(RETENTION_DAYS);
  } catch (error: unknown) {
    logger.error("[RGPD] Initial retention policy run failed", error);
  }

  // Planification quotidienne (toutes les 24 heures)
  setInterval(async () => {
    try {
      logger.info("[RGPD] Running scheduled retention policy...");
      await RightToBeForgottenService.runRetentionPolicy(RETENTION_DAYS);
    } catch (error: unknown) {
      logger.error("[RGPD] Scheduled retention policy failed", error);
    }
  }, 24 * 60 * 60 * 1000);
}

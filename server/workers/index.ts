/**
 * WORKERS INDEX
 * ✅ PHASE 4 — Tâches 10 & 11 : Point d'entrée des workers BullMQ
 *
 * Démarre tous les workers au boot de l'application.
 */
import { logger } from "../infrastructure/logger";
import { startVoiceProcessingWorker, stopVoiceProcessingWorker } from "./voiceProcessingWorker";

export { voiceProcessingQueue, enqueueVoiceJob } from "./voiceProcessingWorker";

/**
 * Démarre tous les workers BullMQ
 */
export function startAllWorkers(): void {
  logger.info("[Workers] Starting all BullMQ workers...");
  startVoiceProcessingWorker();
  logger.info("[Workers] All workers started.");
}

/**
 * Arrête proprement tous les workers
 */
export async function stopAllWorkers(): Promise<void> {
  logger.info("[Workers] Stopping all BullMQ workers...");
  await stopVoiceProcessingWorker();
  logger.info("[Workers] All workers stopped.");
}

import OpenAI from "openai";
import { ENV } from "./env";
import { logger } from "../infrastructure/logger";
let openaiClientInstance: OpenAI | null = null;
export function getOpenAIClient(): OpenAI {
  if (openaiClientInstance) {
    return openaiClientInstance;
  }
  if (!ENV.openaiApiKey) {
    logger.error("[OpenAI Client] OPENAI_API_KEY n'est pas configurée. L'initialisation du client OpenAI a échoué.");
    throw new Error("OPENAI_API_KEY is not configured");
  }
  const clientConfig: ConstructorParameters<typeof OpenAI>[0] = {
    apiKey: ENV.openaiApiKey,
    timeout: 30000,
    maxRetries: 0,
  };
  // Utiliser l'URL personnalisée si définie (proxy Manus ou autre)
  if (ENV.openaiApiUrl && ENV.openaiApiUrl !== "https://api.openai.com/v1") {
    clientConfig.baseURL = ENV.openaiApiUrl;
    logger.info(`[OpenAI Client] Utilisation du proxy: ${ENV.openaiApiUrl}`);
  }
  openaiClientInstance = new OpenAI(clientConfig);
  logger.info("[OpenAI Client] Client OpenAI initialisé avec timeout=30000ms.");
  return openaiClientInstance;
}
/**
 * Réinitialise l'instance (utile pour les tests)
 */
export function resetOpenAIClient(): void {
  openaiClientInstance = null;
}

import { logger } from '../infrastructure/logger';
import { AI_MODEL } from '../_core/aiModels';
import { getOpenAIClient } from '../_core/openaiClient';

/**
 * Configuration pour la gestion des retries OpenAI
 */
export interface OpenAIRetryConfig {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  exponentialBase?: number;
  jitterFactor?: number; // Ajoute du bruit pour éviter les thundering herds
}

/**
 * Classe pour gérer les retries spécifiques à OpenAI
 * Respecte les rate limits et les erreurs temporaires
 */
export class OpenAIRetryService {
  private maxRetries: number;
  private initialDelayMs: number;
  private maxDelayMs: number;
  private backoffMultiplier: number;
  private _exponentialBase: number;
  private jitterFactor: number;
  private openai = getOpenAIClient();

  constructor(config: OpenAIRetryConfig = {}) {
    this.maxRetries = config.maxRetries ?? 3;
    this.initialDelayMs = config.initialDelayMs ?? 1000;
    this.maxDelayMs = config.maxDelayMs ?? 60000; // Max 1 minute
    this.backoffMultiplier = config.backoffMultiplier ?? 2;
    this._exponentialBase = config.exponentialBase ?? 2;
    this.jitterFactor = config.jitterFactor ?? 0.1; // 10% de jitter
  }

  /**
   * Exécute un appel OpenAI avec retry et backoff exponentiel
   * Gère spécifiquement les erreurs 429 (rate limit) et 503 (service unavailable)
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    operationName: string = 'OpenAI operation'
  ): Promise<T> {
    let lastError: Error | null = null;
    let delayMs = this.initialDelayMs;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        logger.debug(`[OpenAIRetry] Attempt ${attempt + 1}/${this.maxRetries + 1} for ${operationName}`);
        return await fn();
      } catch (error: unknown) {
        lastError = error;

        // Extraire le code d'erreur OpenAI
        const statusCode = error.status || error.code;
        const errorMessage = error.message || String(error);

        // Vérifier si l'erreur est retryable
        if (!this.isRetryable(error)) {
          logger.error(`[OpenAIRetry] Non-retryable error for ${operationName}`, {
            statusCode,
            message: errorMessage,
          });
          throw error;
        }

        if (attempt < this.maxRetries) {
          // Calculer le délai avec jitter pour éviter les thundering herds
          const jitter = delayMs * this.jitterFactor * (Math.random() - 0.5);
          const actualDelayMs = Math.max(0, delayMs + jitter);

          logger.warn(`[OpenAIRetry] Attempt ${attempt + 1} failed for ${operationName}, retrying in ${actualDelayMs}ms`, {
            statusCode,
            message: errorMessage,
            attempt: attempt + 1,
            maxRetries: this.maxRetries,
          });

          // Attendre avant de réessayer
          await this.delay(actualDelayMs);

          // Augmenter le délai pour la prochaine tentative (backoff exponentiel)
          delayMs = Math.min(
            delayMs * this.backoffMultiplier * this._exponentialBase,
            this.maxDelayMs
          );

          // Si c'est une erreur 429 (rate limit), ajouter un délai supplémentaire
          if (statusCode === 429) {
            const retryAfter = error.headers?.['retry-after'];
            if (retryAfter) {
              const retryAfterMs = parseInt(retryAfter) * 1000;
              logger.warn(`[OpenAIRetry] Rate limit detected, waiting ${retryAfterMs}ms as per Retry-After header`);
              await this.delay(retryAfterMs);
            }
          }
        }
      }
    }

    logger.error(`[OpenAIRetry] All ${this.maxRetries + 1} attempts failed for ${operationName}`, {
      error: lastError?.message,
    });
    throw lastError || new Error(`Failed after ${this.maxRetries + 1} attempts`);
  }

  /**
   * Appel chat completions avec retry
   */
  async chatCompletionWithRetry(
    messages: any[],
    model: string = AI_MODEL.DEFAULT,
    options: unknown= {}
  ): Promise<any> {
    return this.executeWithRetry(
      async () => {
        return await this.openai.chat.completions.create({
          model,
          messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.max_tokens ?? 2000,
          top_p: options.top_p ?? 1,
          frequency_penalty: options.frequency_penalty ?? 0,
          presence_penalty: options.presence_penalty ?? 0,
          ...options,
        });
      },
      `chatCompletion(${model})`
    );
  }

  /**
   * Appel speech-to-text (Whisper) avec retry
   */
  async transcribeWithRetry(
    audioFile: Buffer | string,
    options: unknown= {}
  ): Promise<any> {
    return this.executeWithRetry(
      async () => {
        // Si c'est un buffer, le convertir en fichier
        const file = typeof audioFile === 'string' 
          ? audioFile 
          : new File([new Uint8Array(audioFile)], 'audio.mp3', { type: 'audio/mpeg' });

        return await this.openai.audio.transcriptions.create({
          file: file as unknown,
          model: options.model ?? 'whisper-1',
          language: options.language,
          prompt: options.prompt,
          response_format: options.response_format ?? 'json',
          temperature: options.temperature ?? 0,
        });
      },
      `transcribe(whisper)`
    );
  }

  /**
   * Appel text-to-speech avec retry
   */
  async synthesizeSpeechWithRetry(
    text: string,
    voice: string = 'alloy',
    options: unknown= {}
  ): Promise<any> {
    return this.executeWithRetry(
      async () => {
        return await this.openai.audio.speech.create({
          model: options.model ?? 'tts-1',
          voice: voice,
          input: text,
          speed: options.speed ?? 1.0,
        });
      },
      `synthesizeSpeech(${voice})`
    );
  }

  /**
   * Détermine si une erreur peut être retryée
   */
  private isRetryable(error: unknown): boolean {
    const statusCode = error.status || error.code;

    // Ne pas réessayer les erreurs d'authentification ou d'autorisation
    if (statusCode === 401 || statusCode === 403) {
      return false;
    }

    // Ne pas réessayer les erreurs de validation (4xx sauf 429)
    if (statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
      return false;
    }

    // Réessayer les erreurs 429 (rate limit), 500, 502, 503, 504
    if (statusCode === 429 || statusCode >= 500) {
      return true;
    }

    // Réessayer les erreurs réseau
    const errorCode = error.code ?? '';
    if (
      errorCode === 'ECONNREFUSED' ||
      errorCode === 'ENOTFOUND' ||
      errorCode === 'ETIMEDOUT' ||
      errorCode === 'ECONNRESET'
    ) {
      return true;
    }

    // Par défaut, ne pas réessayer
    return false;
  }

  /**
   * Utilitaire pour attendre
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Obtenir les statistiques d'utilisation de l'API OpenAI
   * Utile pour monitorer les quotas et les coûts
   */
  async getUsageStats(): Promise<any> {
    try {
      // Note: Cette fonctionnalité dépend de la disponibilité de l'endpoint
      // dans la version actuelle du SDK OpenAI
      logger.info('[OpenAIRetry] Fetching usage statistics');
      // À implémenter selon la version du SDK
      return null;
    } catch (error: unknown) {
      logger.error('[OpenAIRetry] Failed to fetch usage statistics', { error });
      return null;
    }
  }
}

/**
 * Instance singleton du service de retry OpenAI
 */
export const openaiRetryService = new OpenAIRetryService({
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 60000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
});

/**
 * Exports de commodité
 */
export async function chatCompletionWithRetry(
  messages: any[],
  model: string = AI_MODEL.DEFAULT,
  options: unknown= {}
): Promise<any> {
  return openaiRetryService.chatCompletionWithRetry(messages, model, options);
}

export async function transcribeWithRetry(
  audioFile: Buffer | string,
  options: unknown= {}
): Promise<any> {
  return openaiRetryService.transcribeWithRetry(audioFile, options);
}

export async function synthesizeSpeechWithRetry(
  text: string,
  voice: string = 'alloy',
  options: unknown= {}
): Promise<any> {
  return openaiRetryService.synthesizeSpeechWithRetry(text, voice, options);
}

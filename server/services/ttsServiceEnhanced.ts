import { getOpenAIClient } from "../_core/openaiClient";
import { logger } from "../infrastructure/logger";

/**
 * Configuration pour la résilience et les retries
 */
export interface ResilienceConfig {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  timeoutMs?: number;
}

/**
 * Configuration pour le streaming TTS
 */
export interface StreamingTTSConfig {
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  model?: string;
  speed?: number;
  enableStreaming?: boolean;
  resilience?: ResilienceConfig;
}

/**
 * Classe pour gérer les retries avec backoff exponentiel
 */
class RetryManager {
  private maxRetries: number;
  private initialDelayMs: number;
  private maxDelayMs: number;
  private backoffMultiplier: number;

  constructor(config: ResilienceConfig = {}) {
    this.maxRetries = config.maxRetries ?? 3;
    this.initialDelayMs = config.initialDelayMs ?? 1000;
    this.maxDelayMs = config.maxDelayMs ?? 30000;
    this.backoffMultiplier = config.backoffMultiplier ?? 2;
  }

  /**
   * Exécute une fonction avec retry et backoff exponentiel
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    context: string = 'operation'
  ): Promise<T> {
    let lastError: Error | null = null;
    let delayMs = this.initialDelayMs;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        logger.debug(`[RetryManager] Attempt ${attempt + 1}/${this.maxRetries + 1} for ${context}`);
        return await fn();
      } catch (error: unknown) {
        lastError = error as Error;
        
        // Vérifier si l'erreur est retryable
        if (!this.isRetryable(error)) {
          logger.error(`[RetryManager] Non-retryable error for ${context}`, { error });
          throw error;
        }

        if (attempt < this.maxRetries) {
          logger.warn(`[RetryManager] Attempt ${attempt + 1} failed for ${context}, retrying in ${delayMs}ms`, {
            error: (error as Error).message,
          });
          
          // Attendre avant de réessayer
          await this.delay(delayMs);
          
          // Augmenter le délai pour la prochaine tentative
          delayMs = Math.min(delayMs * this.backoffMultiplier, this.maxDelayMs);
        }
      }
    }

    logger.error(`[RetryManager] All ${this.maxRetries + 1} attempts failed for ${context}`, {
      error: lastError?.message,
    });
    throw lastError || new Error(`Failed after ${this.maxRetries + 1} attempts`);
  }

  /**
   * Détermine si une erreur peut être retryée
   */
  private isRetryable(error: unknown): boolean {
    // Ne pas réessayer les erreurs d'authentification
    if (error.status === 401 || error.status === 403) {
      return false;
    }

    // Réessayer les erreurs de rate limiting et les erreurs réseau
    if (error.status === 429 || error.status === 503 || error.status === 504) {
      return true;
    }

    // Réessayer les erreurs réseau
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      return true;
    }

    // Par défaut, réessayer
    return true;
  }

  /**
   * Utilitaire pour attendre
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Service TTS amélioré avec streaming et résilience
 */
export class EnhancedTTSService {
  private openai = getOpenAIClient();
  private retryManager: RetryManager;

  constructor(resilienceConfig?: ResilienceConfig) {
    this.retryManager = new RetryManager(resilienceConfig);
  }

  /**
   * Synthétiser la parole avec streaming (pour les appels en temps réel)
   * Retourne un stream que vous pouvez envoyer directement au client
   */
  async synthesizeSpeechStream(
    text: string,
    config: StreamingTTSConfig = {}
  ): Promise<NodeJS.ReadableStream> {
    const voice = config.voice ?? 'alloy';
    const model = config.model || 'tts-1'; // tts-1 pour la latence basse, tts-1-hd pour la qualité

    logger.info('[EnhancedTTS] Starting speech synthesis stream', {
      textLength: text.length,
      voice,
      model,
    });

    return this.retryManager.executeWithRetry(
      async () => {
        const response = await this.openai.audio.speech.create({
          model: model,
          voice: voice,
          input: text,
          speed: config.speed ?? 1.0,
        });

        // Convertir la réponse en stream
        return response.body as unknown as NodeJS.ReadableStream;
      },
      `synthesizeSpeechStream(${voice})`
    );
  }

  /**
   * Synthétiser la parole et retourner un buffer (pour les appels non-streaming)
   */
  async synthesizeSpeechBuffer(
    text: string,
    config: StreamingTTSConfig = {}
  ): Promise<Buffer> {
    const voice = config.voice ?? 'alloy';
    const model = config.model || 'tts-1';

    logger.info('[EnhancedTTS] Starting speech synthesis buffer', {
      textLength: text.length,
      voice,
      model,
    });

    return this.retryManager.executeWithRetry(
      async () => {
        const response = await this.openai.audio.speech.create({
          model: model,
          voice: voice,
          input: text,
          speed: config.speed ?? 1.0,
        });

        const buffer = Buffer.from(await response.arrayBuffer());
        
        logger.info('[EnhancedTTS] Speech synthesis completed', {
          audioSize: buffer.length,
          voice,
        });

        return buffer;
      },
      `synthesizeSpeechBuffer(${voice})`
    );
  }

  /**
   * Synthétiser la parole avec streaming et envoyer directement via HTTP response
   * Idéal pour les appels en temps réel via Twilio
   */
  async streamSpeechToResponse(
    text: string,
    response: unknown, // Express Response object
    config: StreamingTTSConfig = {}
  ): Promise<void> {
    const voice = config.voice ?? 'alloy';

    logger.info('[EnhancedTTS] Starting streaming to HTTP response', {
      textLength: text.length,
      voice,
    });

    try {
      const stream = await this.synthesizeSpeechStream(text, config);

      // Définir les headers appropriés
      response.setHeader('Content-Type', 'audio/mpeg');
      response.setHeader('Transfer-Encoding', 'chunked');

      // Piping le stream directement à la réponse HTTP
      stream.pipe(response);

      // Gérer les erreurs du stream
      stream.on('error', (error: Error) => {
        logger.error('[EnhancedTTS] Stream error', { error });
        if (!response.headersSent) {
          response.status(500).json({ error: 'Failed to synthesize speech' });
        }
      });

      // Log quand le stream est terminé
      stream.on('end', () => {
        logger.info('[EnhancedTTS] Stream completed successfully');
      });
    } catch (error: unknown) {
      logger.error('[EnhancedTTS] Error streaming speech to response', { error });
      if (!response.headersSent) {
        response.status(500).json({ error: 'Failed to synthesize speech' });
      }
    }
  }

  /**
   * Batch processing pour synthétiser plusieurs textes avec rate limiting
   */
  async synthesizeBatch(
    texts: string[],
    config: StreamingTTSConfig = {},
    rateLimitDelayMs: number = 500
  ): Promise<Buffer[]> {
    logger.info('[EnhancedTTS] Starting batch synthesis', {
      count: texts.length,
      rateLimitDelayMs,
    });

    const results: Buffer[] = [];

    for (let i = 0; i < texts.length; i++) {
      try {
        const buffer = await this.synthesizeSpeechBuffer(texts[i] ?? '', config);
        results.push(buffer);

        // Rate limiting entre les appels
        if (i < texts.length - 1) {
          await this.delay(rateLimitDelayMs);
        }
      } catch (error: unknown) {
        logger.error(`[EnhancedTTS] Failed to synthesize text ${i}`, { error });
        throw error;
      }
    }

    logger.info('[EnhancedTTS] Batch synthesis completed', { count: results.length });
    return results;
  }

  /**
   * Utilitaire pour attendre
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Instance singleton du service TTS amélioré
 */
export const enhancedTTSService = new EnhancedTTSService({
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
});

/**
 * Export des fonctions de commodité
 */
export async function synthesizeSpeechWithRetry(
  text: string,
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'alloy'
): Promise<Buffer> {
  return enhancedTTSService.synthesizeSpeechBuffer(text, { voice });
}

export async function synthesizeSpeechStreamWithRetry(
  text: string,
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'alloy'
): Promise<NodeJS.ReadableStream> {
  return enhancedTTSService.synthesizeSpeechStream(text, { voice });
}

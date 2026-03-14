import { AI_MODEL } from '../_core/aiModels';
import { WebSocket } from 'ws';
import { logger } from "../infrastructure/logger";
import { VoicePipelineService, PipelineConfig } from './voicePipelineService';
import { SentimentAnalysisService } from './sentimentAnalysisService';
import { createCallTrace, completeCallTrace } from './callTracingService';

/**
 * Voice AI Service V2
 * Complete AI telephony system with:
 * - Real-time ASR streaming
 * - Full voice pipeline (Audio → ASR → LLM → TTS → Audio)
 * - Sentiment analysis with escalation
 * - Voice cloning support
 * - Intelligent orchestration
 * - Complete traceability
 */

export interface VoiceAIConfig {
  enableSentimentAnalysis?: boolean;
  enableVoiceCloning?: boolean;
  voiceCloneId?: string;
  asrProvider?: 'openai' | 'deepgram' | 'assemblyai';
  llmModel?: string;
  ttsVoice?: string;
  sentimentThresholds?: {
    angerThreshold?: number;
    frustrationThreshold?: number;
    stressThreshold?: number;
    escalationThreshold?: number;
  };
  systemPrompt?: string;
}

export class VoiceAIServiceV2 {
  private ws: WebSocket;
  private pipeline?: VoicePipelineService;
  private sentimentService?: SentimentAnalysisService;
  private callId: string;
  private streamSid?: string;
  private callSid?: string;
  private config: VoiceAIConfig;
  private tracingService: unknown;

  constructor(ws: WebSocket, config: VoiceAIConfig = {}) {
    this.ws = ws;
    this.callId = `call-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    this.config = {
      enableSentimentAnalysis: true,
      enableVoiceCloning: false,
      asrProvider: 'openai',
      llmModel: AI_MODEL.DEFAULT,
      ttsVoice: 'alloy',
      ...config,
    };

    logger.info('[Voice AI V2] Service initialized', {
      callId: String(this.callId),
      config: this.config,
    });

    this.setupWebSocketHandlers();
  }

  /**
   * Setup WebSocket message handlers
   */
  private setupWebSocketHandlers(): void {
    this.ws.on('message', async (data: string) => {
      try {
        const msg = JSON.parse(data);

        switch (msg.event) {
          case 'start':
            await this.handleStart(msg);
            break;

          case 'media':
            await this.handleMedia(msg);
            break;

          case 'stop':
            await this.handleStop(msg);
            break;

          default:
            logger.debug('[Voice AI V2] Unknown event', {
              callId: String(this.callId),
              event: msg.event,
            });
        }
      } catch (error: unknown) {
        logger.error('[Voice AI V2] Error processing message', {
          callId: String(this.callId),
          error,
        });
      }
    });

    this.ws.on('close', () => {
      logger.info('[Voice AI V2] WebSocket closed', { callId: this.callId });
      this.cleanup();
    });

    this.ws.on('error', (error) => {
      logger.error('[Voice AI V2] WebSocket error', {
        callId: String(this.callId),
        error,
      });
    });
  }

  /**
   * Handle stream start event
   */
  private async handleStart(msg: unknown): Promise<void> {
    this.streamSid = msg.start.streamSid;
    this.callSid = msg.start.callSid;

    logger.info('[Voice AI V2] Stream started', {
      callId: String(this.callId),
      streamSid: this.streamSid ?? '',
      callSid: this.callSid ?? '',
    });

    // Initialize tracing
    this.tracingService = createCallTrace(
      String(this.callId),
      this.callSid ?? '',
      this.streamSid ?? '',
      {
        phoneNumber: msg.start.customParameters?.From,
      }
    );

    this.tracingService.logStage('initialization', 'started');

    // Initialize sentiment analysis if enabled
    if (this.config.enableSentimentAnalysis) {
      this.sentimentService = new SentimentAnalysisService(
        this.callId,
        this.config.sentimentThresholds
      );
      this.tracingService.addMetadata('sentimentAnalysisEnabled', true);
    }

    // Initialize voice pipeline
    const pipelineConfig: PipelineConfig = {
      callId: String(this.callId),
      streamSid: this.streamSid ?? '',
      callSid: this.callSid ?? '',
      asrProvider: this.config.asrProvider,
      llmModel: this.config.llmModel,
      ttsVoice: this.config.ttsVoice,
      enableSentimentAnalysis: this.config.enableSentimentAnalysis,
      enableVoiceCloning: this.config.enableVoiceCloning,
      voiceCloneId: this.config.voiceCloneId,
      systemPrompt: this.config.systemPrompt,
    };

    this.pipeline = new VoicePipelineService(this.ws, pipelineConfig);

    // Setup pipeline event handlers
    this.setupPipelineHandlers();

    // Start the pipeline
    await this.pipeline.start();

    this.tracingService.logStage('initialization', 'completed');
  }

  /**
   * Setup pipeline event handlers
   */
  private setupPipelineHandlers(): void {
    if (!this.pipeline) return;

    // Transcription event
    this.pipeline.on('transcription', async (data: unknown) => {
      logger.info('[Voice AI V2] Transcription received', {
        callId: String(this.callId),
        text: data.text,
        confidence: data.confidence,
      });

      // Log transcription
      this.tracingService?.logTranscription(
        data.text,
        data.confidence,
        true
      );

      // Analyze sentiment if enabled
      if (this.sentimentService) {
        const sentiment = await this.sentimentService.analyzeSentiment(data.text);

        // Check if escalation is needed
        if (sentiment.shouldEscalate) {
          logger.warn('[Voice AI V2] Escalation recommended', {
            callId: String(this.callId),
            reason: sentiment.escalationReason,
            sentiment: sentiment.sentiment,
          });

          this.tracingService?.addMetadata('escalationTriggered', true);
          this.tracingService?.addMetadata('escalationReason', sentiment.escalationReason);

          // In production, trigger actual transfer to human agent
          // For now, just log the recommendation
        }
      }
    });

    // Response event
    this.pipeline.on('response', (data: unknown) => {
      logger.info('[Voice AI V2] Response sent', {
        callId: String(this.callId),
        text: data.text.substring(0, 50),
        ttsLatency: data.ttsLatency,
      });

      this.tracingService?.logResponse(
        data.text,
        0, // Audio size not available here
        data.ttsLatency
      );
    });

    // Error event
    this.pipeline.on('error', (data: unknown) => {
      logger.error('[Voice AI V2] Pipeline error', {
        callId: String(this.callId),
        stage: data.stage,
        error: data.error,
      });

      this.tracingService?.logError(data.stage, data.error, true);
    });

    // Fatal error event
    this.pipeline.on('fatal_error', (data: unknown) => {
      logger.error('[Voice AI V2] Pipeline fatal error', {
        callId: String(this.callId),
        stage: data.stage,
        error: data.error,
      });

      this.tracingService?.logError(data.stage, data.error, false);
      this.cleanup('failed');
    });

    // Pipeline stopped event
    this.pipeline.on('stopped', (data: unknown) => {
      logger.info('[Voice AI V2] Pipeline stopped', {
        callId: String(this.callId),
        metrics: data.metrics,
      });

      // Update tracing with final metrics
      if (this.tracingService && data.metrics) {
        this.tracingService.updateMetrics(data.metrics);
      }
    });
  }

  /**
   * Handle incoming audio media
   */
  private async handleMedia(msg: unknown): Promise<void> {
    if (!this.pipeline) {
      logger.warn('[Voice AI V2] Pipeline not initialized, ignoring media', {
        callId: String(this.callId),
      });
      return;
    }

    // Process audio through pipeline
    await this.pipeline.processAudio(msg.media.payload);
  }

  /**
   * Handle stream stop event
   */
  private async handleStop(_msg: unknown): Promise<void> {
    logger.info('[Voice AI V2] Stream stopped', {
      callId: String(this.callId),
      streamSid: this.streamSid,
    });

    await this.cleanup('completed');
  }

  /**
   * Cleanup resources
   */
  private async cleanup(status: 'completed' | 'failed' | 'transferred' = 'completed'): Promise<void> {
    logger.info('[Voice AI V2] Cleaning up', {
      callId: String(this.callId),
    });

    // Stop pipeline
    if (this.pipeline) {
      await this.pipeline.stop();
      
      // Note: getMetrics() not available on VoicePipelineService; metrics are emitted via 'stopped' event
    }

    // Get sentiment summary
    if (this.sentimentService) {
      const sentimentTrend = this.sentimentService.getSentimentTrend();
      const lastSentiment = this.sentimentService.getHistory().pop();

      if (this.tracingService) {
        this.tracingService.updateSentimentAnalysis(
          sentimentTrend.averageScore,
          sentimentTrend.trend,
          sentimentTrend.escalationCount,
          lastSentiment?.sentiment ?? 'unknown'
        );
      }
    }

    // Complete tracing
    if (this.tracingService) {
      completeCallTrace(String(this.callId), status);
    }

    logger.info('[Voice AI V2] Cleanup completed', {
      callId: String(this.callId),
    });
  }

  /**
   * Get call ID
   */
  getCallId(): string {
    return this.callId;
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      callId: String(this.callId),
      streamSid: this.streamSid ?? '',
      callSid: this.callSid ?? '',
      pipelineActive: !!this.pipeline,
      sentimentAnalysisEnabled: !!this.sentimentService,
    };
  }
}

/**
 * Handle Twilio Media Stream via WebSocket (Main entry point)
 * This is the function that should be called from the router
 */
export function handleVoiceStream(ws: WebSocket, config?: VoiceAIConfig): VoiceAIServiceV2 {
  logger.info('[Voice AI V2] New voice stream connection');
  return new VoiceAIServiceV2(ws, config);
}

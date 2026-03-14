import { AI_MODEL } from '../_core/aiModels';
import { EventEmitter } from 'events';
import { WebSocket } from 'ws';
import { logger } from "../infrastructure/logger";
import { ASRStreamingService, TranscriptionResult } from './asrStreamingService';
import { invokeLLM, withTimeout, LLM_TIMEOUT_FALLBACK } from '../_core/llm';
import { synthesizeSpeech } from './ttsService';
import { detectSimpleIntent } from './intentClassifier';
import { getFillerByDuration } from './fillerService';
import * as fs from "fs";
import * as path from "path";
// import { processAgentActions, ToolCall } from './agentActionService'; // reserved for future tool call handling

// ============================================================
// ✅ CORRECTION CRITIQUE — Logging des timeouts vocaux
// ============================================================
function logVoiceTimeout(callId: string, context?: Record<string, unknown>): void {
  const entry = {
    level: "AI_TIMEOUT",
    service: "voicePipeline",
    callId,
    timestamp: Date.now(),
    ...context,
  };
  console.error("AI_TIMEOUT", entry);
  try {
    const logsDir = path.resolve(process.cwd(), "logs");
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    fs.appendFileSync(
      path.join(logsDir, "ai-errors.log"),
      JSON.stringify(entry) + "\n",
      "utf8"
    );
  } catch (_) {
    // Logging must never crash the application
  }
}

/**
 * Voice Pipeline Service - Optimized for Latency (< 500ms)
 * Implements Pure Streaming ASR, First Token TTS, and Intelligent Barge-in.
 * ✅ CORRECTION: withTimeout sur tous les appels LLM pour éviter les blocages tRPC
 */

export interface PipelineConfig {
  callId: string;
  streamSid: string;
  callSid: string;
  tenantId?: number;
  systemPrompt?: string;
  asrProvider?: 'openai' | 'deepgram' | 'assemblyai';
  llmModel?: string;
  ttsVoice?: string;
  enableSentimentAnalysis?: boolean;
  enableVoiceCloning?: boolean;
  voiceCloneId?: string;
}

export class VoicePipelineService extends EventEmitter {
  private config: PipelineConfig;
  private asrService!: ASRStreamingService;
  private conversationHistory: any[] = [];
  private isProcessing: boolean = false;
  private ws: WebSocket;
  private lastBargeInTime: number = 0;
  private isSpeaking: boolean = false;

  constructor(ws: WebSocket, config: PipelineConfig) {
    super();
    this.ws = ws;
    this.config = {
      systemPrompt: `Tu es un assistant vocal intelligent pour Servicall CRM. 
      Ton rôle est d'aider les clients de manière courtoise et efficace.
      Réponds toujours en français. Sois concis.`,
      asrProvider: 'deepgram',
      llmModel: AI_MODEL.DEFAULT,
      ttsVoice: 'alloy',
      ...config,
    };

    this.initializeServices();
  }

  private initializeServices(): void {
    this.asrService = new ASRStreamingService(this.config.callId, {
      provider: this.config.asrProvider!,
      language: 'fr',
      interimResults: true,
    });

    this.asrService.on('transcription', (result: TranscriptionResult) => {
      this.handleTranscription(result);
    });

    this.asrService.on('barge_in_detected', (data: { text: string }) => {
      this.handleBargeIn(data.text);
    });

    this.conversationHistory = [
      { role: 'system', content: this.config.systemPrompt },
    ];
  }

  /**
   * Intelligent Barge-in Handler
   * Filters out background noise and only interrupts if actual speech is detected.
   */
  private handleBargeIn(text: string): void {
    const now = Date.now();
    // Ignore if last barge-in was too recent (debounce)
    if (now - this.lastBargeInTime < 500) return;

    // Simple heuristic: if text is too short, it might be noise
    if (text.trim().length < 3) return;

    if (this.isSpeaking) {
      logger.info('[Voice Pipeline] Intelligent Barge-in detected', { 
        callId: this.config.callId, 
        text 
      });
      
      this.lastBargeInTime = now;
      this.isSpeaking = false;

      // Send clear event to Twilio to stop current audio playback
      this.ws.send(JSON.stringify({
        event: 'clear',
        streamSid: this.config.streamSid,
      }));
    }
  }

  async start(): Promise<void> {
    const greeting = "Bonjour, je suis l'assistant intelligent de Servicall. Comment puis-je vous aider ?";
    await this.sendAIResponse(greeting);
  }

  async processAudio(audioChunk: string): Promise<void> {
    await this.asrService.processAudioChunk(audioChunk);
  }

  private async handleTranscription(result: TranscriptionResult): Promise<void> {
    if (!result.isFinal || result.text.trim().length === 0) return;

    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      this.conversationHistory.push({ role: 'user', content: result.text });

      // 1. Quick NLU
      const simpleIntent = detectSimpleIntent(result.text);
      if (simpleIntent) {
        // Handle simple intents...
      }

      // 2. LLM Call with Filler — envoi immédiat d'un filler pour réduire la latence perçue
      const filler = getFillerByDuration(1500); // Assume 1.5s latency for LLM
      if (filler) {
        await this.sendAIResponse(filler, true); // Send filler as a quick response
      }

      // ✅ CORRECTION: processLLM protégé par withTimeout (5s max)
      const llmResponse = await this.processLLM();
      
      if (llmResponse.tool_calls) {
        await this.handleToolCalls(llmResponse);
      } else {
        await this.sendAIResponse(llmResponse.content);
      }

    } catch (error: unknown) {
      logger.error('[Voice Pipeline] Error processing transcription', { 
        error,
        callId: this.config.callId,
      });
      // ✅ Fallback vocal en cas d'erreur non récupérée
      await this.sendAIResponse(LLM_TIMEOUT_FALLBACK);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * ✅ CORRECTION CRITIQUE — processLLM avec withTimeout (5 000 ms)
   * Évite les blocages du pipeline vocal lors de latences OpenAI
   */
  private async processLLM(): Promise<any> {
    try {
      const response = await withTimeout(
        invokeLLM(this.config.tenantId ?? 1, {
          model: this.config.llmModel!,
          messages: this.conversationHistory,
          temperature: 0.7,
        }),
        5000 // ✅ Timeout 5s maximum
      );
      return response.choices[0]?.message;
    } catch (err: unknown) {
      const isTimeout =
        err?.message === "LLM timeout" ||
        (err?.message && err.message.toLowerCase().includes("timeout"));
      if (isTimeout) {
        logVoiceTimeout(this.config.callId, {
          tenantId: this.config.tenantId,
          model: this.config.llmModel,
        });
        logger.warn('[Voice Pipeline] LLM timeout — using fallback response', {
          callId: this.config.callId,
        });
        // ✅ Retourner le message de fallback IA
        return { role: 'assistant', content: LLM_TIMEOUT_FALLBACK };
      }
      throw err;
    }
  }

  private async sendAIResponse(text: string, isFiller: boolean = false): Promise<void> {
    if (!text) return;
    
    this.isSpeaking = true;
    this.conversationHistory.push({ role: 'assistant', content: text });

    // Use streaming TTS for lower latency
    await synthesizeSpeech(text, this.config.ttsVoice as unknown, {
      streamSid: this.config.streamSid,
    }, this.ws);
    
    if (!isFiller) {
      this.isSpeaking = false;
    }
  }

  private async handleToolCalls(_llmResponse: unknown): Promise<void> {
    // Implementation for tool calls...
  }

  async stop(): Promise<void> {
    await this.asrService.stop();
    this.removeAllListeners();
  }
}

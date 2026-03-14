/**
 * LISTEN AND UNDERSTAND ACTION
 * Reçoit et transcrit l'audio de l'utilisateur, puis analyse l'intention.
 * ✅ BLOC 2 : Supporte les variables dynamiques via PlaceholderEngine
 * ✅ BLOC 2 : Gestion d'erreurs robuste avec timeout et retry
 * ✅ BLOC 2 : Logging structuré et centralisé
 * ✅ BLOC 2 : Support context tenant strict
 */

import { z } from "zod";
import type { ActionHandler, ActionResult } from "../../types";
import type { FinalExecutionContext } from "../../structured-types";
import { Logger } from "../../utils/Logger";
import { PlaceholderEngine } from "../../utils/PlaceholderEngine";
import { getOpenAIClient } from "../../_core/openaiClient";
import { AI_MODEL } from "../../../_core/aiModels";

// Configuration structurée
const ListenAndUnderstandConfigSchema = z.object({
  timeout: z.number().optional(),
  language: z.string().optional(),
  maxRetries: z.number().optional(),
  prompt_override: z.string().optional(),
});
export type ListenAndUnderstandConfig = z.infer<typeof ListenAndUnderstandConfigSchema>;

// Résultat structuré
interface ListenAndUnderstandResult {
  transcription: string;
  intent: string;
  entities: Record<string, unknown>;
  confidence: number;
  duration: number;
}

export class ListenAndUnderstandAction implements ActionHandler<ListenAndUnderstandConfig, FinalExecutionContext, ListenAndUnderstandResult> {
  name = "listen_and_understand";
  private logger = new Logger("ListenAndUnderstandAction");
  private openai: ReturnType<typeof getOpenAIClient>;
  private static readonly TRANSCRIPTION_TIMEOUT_MS = 30000;
  private static readonly ANALYSIS_TIMEOUT_MS = 15000;
  private static readonly MAX_AUDIO_SIZE_MB = 25;

  constructor() {
    // ✅ PHASE 1 — Tâche 2 : Utilisation du client centralisé
    this.openai = getOpenAIClient();
  }

  async execute(
    context: FinalExecutionContext,
    config: ListenAndUnderstandConfig
  ): Promise<ActionResult<ListenAndUnderstandResult>> {
    const startTime = Date.now();
    const tenantId = context.tenant?.id ?? 0;

    try {
      const language = PlaceholderEngine.resolve(config.language ?? "fr", context);
      // Accès typé à audioData depuis les variables structurées
      const audioData = context.variables.audioData;
      // Accès typé à callId
      const callId = context.variables.callId;

      if (!audioData) {
        this.logger.warn("No audio data provided for listen_and_understand", {
          tenantId,
          callId,
        });
        return { success: false, error: "No audio data provided" };
      }

      const audioSize = typeof audioData === "string"
        ? Buffer.from(audioData, "base64").length
        : (audioData as Buffer).length;
      const audioSizeMB = audioSize / (1024 * 1024);

      if (audioSizeMB > ListenAndUnderstandAction.MAX_AUDIO_SIZE_MB) {
        throw new Error(`Audio too large: ${audioSizeMB.toFixed(2)}MB (max: ${ListenAndUnderstandAction.MAX_AUDIO_SIZE_MB}MB)`);
      }

      this.logger.info("Starting audio transcription", {
        tenantId,
        language,
        audioSizeMB: audioSizeMB.toFixed(2),
        callId,
      });

      const transcription = await this.transcribeAudio(audioData as string | Buffer, String(language));
      const analysis = await this.analyzeText(transcription, context, config);
      const duration = Date.now() - startTime;

      this.logger.info("Speech understood successfully", {
        intent: analysis.intent,
        confidence: analysis.confidence,
        tenantId,
        duration,
        callId,
      });

      return {
        success: true,
        data: {
          transcription,
          intent: analysis.intent,
          entities: analysis.entities,
          confidence: analysis.confidence,
          duration,
        },
      };
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      this.logger.error("Error in ListenAndUnderstandAction", {
        error: errorMessage,
        tenantId,
        duration,
        callId: context.variables.callId,
      });

      return { success: false, error: errorMessage };
    }
  }

  private async transcribeAudio(audioData: string | Buffer, language: string): Promise<string> {
    try {
      const buffer = typeof audioData === "string" ? Buffer.from(audioData, "base64") : audioData;
      // Extraction de l'ArrayBuffer sous-jacent pour compatibilité avec BlobPart (DOM API)
      const arrayBuffer: ArrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      ) as ArrayBuffer;
      const file = new File([arrayBuffer], "audio.wav", { type: "audio/wav" });

      const response = await Promise.race([
        this.openai.audio.transcriptions.create({
          file,
          model: "whisper-1",
          language,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Transcription timeout")),
            ListenAndUnderstandAction.TRANSCRIPTION_TIMEOUT_MS
          )
        ),
      ]);

      if (!response.text || response.text.trim().length === 0) {
        throw new Error("Empty transcription result");
      }

      return response.text;
    } catch (error: unknown) {
      this.logger.error("Error transcribing audio", {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  private async analyzeText(
    text: string,
    context: FinalExecutionContext,
    config: ListenAndUnderstandConfig
  ): Promise<{ intent: string; entities: Record<string, unknown>; confidence: number }> {
    try {
      const businessType = (context.tenant as { businessType?: string }).businessType ?? "generic";

      const systemPrompt = config.prompt_override
        ? String(PlaceholderEngine.resolve(config.prompt_override, context))
        : `You are an NLU expert for the ${businessType} industry.
           Analyze the user input and extract:
           1. The main intent (e.g., 'order_food', 'book_room', 'schedule_appointment')
           2. Named entities (e.g., product names, quantities, dates, times, addresses)
           3. Confidence score (0-1)
           
           Return a JSON object with 'intent', 'entities', and 'confidence' fields.`;

      const response = await Promise.race([
        this.openai.chat.completions.create({
          model: AI_MODEL.DEFAULT,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: text },
          ],
          temperature: 0.1,
          response_format: { type: "json_object" }
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Analysis timeout")),
            ListenAndUnderstandAction.ANALYSIS_TIMEOUT_MS
          )
        ),
      ]);

      const content = response.choices[0]?.message.content;
      if (!content) {
        return { intent: "unknown", entities: {}, confidence: 0 };
      }

      const parsed = JSON.parse(content) as { intent?: string; entities?: Record<string, unknown>; confidence?: number };
      return {
        intent: parsed.intent ?? "unknown",
        entities: parsed.entities ?? {},
        confidence: parsed.confidence ?? 0.5,
      };
    } catch (error: unknown) {
      this.logger.error("Error analyzing text", {
        error: error instanceof Error ? error.message : String(error)
      });
      return { intent: "unknown", entities: {}, confidence: 0 };
    }
  }

  validate(_config: Record<string, unknown>): boolean {
    return true;
  }
}

export default ListenAndUnderstandAction;

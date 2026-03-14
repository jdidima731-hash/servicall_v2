import { AI_MODEL } from '../_core/aiModels';
/**
 * BLOC 4 - Agent Copilot Service
 * Fournit une assistance en temps réel aux agents humains pendant l'appel
 */

import { invokeLLM } from "../_core/llm";
import { logger } from "../infrastructure/logger";

export interface CopilotSuggestion {
  type: "objection_handling" | "upsell" | "info_extraction" | "next_step";
  title: string;
  content: string;
  confidence: number;
}

export interface CallContext {
  prospectId?: number;
  prospectName?: string;
  industry?: string;
  callGoal?: string;
}

export class AgentCopilotService {
  /**
   * Analyse la transcription en temps réel pour générer des suggestions
   */
  static async generateLiveSuggestions(
    transcription: string,
    context: CallContext,
    // ✅ BLOC 1 FIX (TS2554) : tenantId requis par invokeLLM(tenantId, params)
    tenantId: number = 1
  ): Promise<CopilotSuggestion[]> {
    try {
      const systemPrompt = `Tu es un copilote de vente pour un agent de centre d'appels.
Analyse la transcription de l'appel en cours et propose des aides concrètes.

RÈGLES :
- Si le prospect émet une objection (prix, temps, besoin), propose une technique de traitement d'objection.
- Si le prospect mentionne une info clé (nom, date, besoin), extrais-la.
- Propose toujours une "prochaine étape" claire.
- Sois très court et percutant.

Contexte de l'appel :
- Prospect : ${context.prospectName ?? "Inconnu"}
- Secteur : ${context.industry ?? "Général"}
- Objectif : ${context.callGoal ?? "Qualification"}

Réponds en JSON uniquement :
Array<{
  type: "objection_handling" | "upsell" | "info_extraction" | "next_step",
  title: string,
  content: Array.isArray(string) ? JSON.stringify(string) : string,
  confidence: number
}>`;

      // ✅ BLOC 1 FIX (TS2554) : invokeLLM requiert (tenantId: number, params: InvokeParams)
      const response = await invokeLLM(tenantId, {
        model: AI_MODEL.DEFAULT,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Transcription actuelle :\n${transcription}` },
        ],
        response_format: { type: "json_object" },
      });

      const content = (response.choices[0]?.message?.content as string) || "[]";
      const parsed = JSON.parse(content);
      
      return Array.isArray(parsed) ? parsed : (parsed.suggestions || []);
    } catch (error: unknown) {
      logger.error("[Copilot Service] Error generating suggestions", { error });
      return [];
    }
  }

  /**
   * Extrait les données structurées de la conversation
   */
  static async extractCallData(
    transcription: string,
    // ✅ BLOC 1 FIX (TS2554) : tenantId requis par invokeLLM(tenantId, params)
    tenantId: number = 1
  ) {
    try {
      const systemPrompt = `Extrais les données structurées suivantes de la transcription d'appel :
- firstName, lastName
- email
- phone
- appointmentDate (si mentionnée, format ISO)
- primaryNeed (le besoin principal exprimé)
- sentiment (positive, neutral, negative)

Réponds en JSON uniquement.`;

      // ✅ BLOC 1 FIX (TS2554) : invokeLLM requiert (tenantId: number, params: InvokeParams)
      const response = await invokeLLM(tenantId, {
        model: AI_MODEL.DEFAULT,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: transcription },
        ],
        response_format: { type: "json_object" },
      });

      return JSON.parse((response.choices[0]?.message?.content as string) || "{}");
    } catch (error: unknown) {
      logger.error("[Copilot Service] Error extracting data", { error });
      return {};
    }
  }
}

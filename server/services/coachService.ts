/**
 * Coach Service - Assistant IA pour les agents humains
 * Fournit des conseils en temps réel et des scripts dynamiques.
 */

import { invokeLLM } from "../_core/llm";
import { logger } from "../infrastructure/logger";
import { AI_MODEL } from "../_core/aiModels";

export interface CoachAdvice {
  suggestion: string;
  nextBestAction: string;
  objectionHandling?: string;
  sentiment: string;
}

export class CoachService {
  /**
   * Générer un conseil en temps réel basé sur la transcription actuelle
   */
  static async getRealTimeAdvice(
    transcription: string, 
    prospectContext: unknown,
    callReason: string,
    // ✅ BLOC 1 FIX (TS2554) : tenantId requis par invokeLLM(tenantId, params)
    tenantId: number = 1
  ): Promise<CoachAdvice> {
    try {
      const systemPrompt = `Tu es un coach de vente expert pour les agents de centre d'appels.
Analyse la transcription actuelle de l'appel et donne des conseils stratégiques à l'agent.
Sois très concis, direct et actionnable.

Contexte du prospect:
- Nom: ${prospectContext.firstName} ${prospectContext.lastName}
- Entreprise: ${prospectContext.company ?? "Inconnue"}
- Raison de l'appel: ${callReason}

Réponds en JSON avec:
- suggestion: Un conseil immédiat sur le ton ou l'approche.
- nextBestAction: La prochaine question ou affirmation à dire.
- objectionHandling: Comment répondre à une objection si présente (optionnel).
- sentiment: Le sentiment actuel du prospect (positif, neutre, négatif).`;

      // ✅ BLOC 1 FIX (TS2554) : invokeLLM requiert (tenantId: number, params: InvokeParams)
      const response = await invokeLLM(tenantId, {
        model: AI_MODEL.DEFAULT,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Transcription actuelle:\n${transcription}` }
        ],
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content;
      const advice = JSON.parse(typeof content === "string" ? content : "{}");

      logger.info(`[Coach] Generated advice for call`, { sentiment: advice.sentiment });

      return {
        suggestion: advice.suggestion || "Continuez l'écoute active.",
        nextBestAction: advice.nextBestAction || "Posez une question ouverte sur ses besoins.",
        objectionHandling: advice.objectionHandling,
        sentiment: advice.sentiment ?? "neutre"
      };
    } catch (error: unknown) {
      logger.error("[Coach] Error generating advice", { error });
      return {
        suggestion: "Restez professionnel et à l'écoute.",
        nextBestAction: "Validez les informations du prospect.",
        sentiment: "inconnu"
      };
    }
  }

  /**
   * Générer un script dynamique personnalisé
   */
  static generateDynamicScript(prospect: unknown, businessType: string): string {
    return `Bonjour ${prospect.firstName}, je vous appelle de la part de Servicall concernant votre intérêt pour ${businessType}. 
J'ai vu que vous travaillez chez ${prospect.company || "votre entreprise"} et je souhaitais discuter de la manière dont nous pouvons vous aider.`;
  }
}

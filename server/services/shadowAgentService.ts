import { AI_MODEL } from '../_core/aiModels';
/**
 * BLOC 3 - Shadow Agent Service
 * IA Proactive Bridée : Génère des suggestions sans jamais agir seule
 * 
 * RÈGLES DE BRIDAGE (NON NÉGOCIABLE) :
 * ❌ L'IA n'envoie JAMAIS de message seule
 * ❌ L'IA ne parle JAMAIS de prix, contrat, engagement
 * ❌ L'IA ne modifie JAMAIS une donnée critique
 * ✅ Tout contenu IA = état "À valider"
 */

import { db as getDb } from "../db";
import * as schema from "../../drizzle/schema";
// ✅ BLOC 2 FIX (TS6133) : 'isNull' supprimé car inutilisé
import { eq, and, desc, sql } from "drizzle-orm";
import { logger } from "../infrastructure/logger";
import { invokeLLM } from "../_core/llm";
import { ExportService } from "./exportService";

/**
 * Types de suggestions IA
 */
export type AISuggestionType = 
  | "missed_call_followup"    // Relance après appel manqué
  | "inactive_prospect"        // Relance prospect inactif
  | "appointment_reminder"     // Rappel de rendez-vous
  | "qualification_followup";  // Suivi après qualification

/**
 * Statut d'une suggestion IA
 */
export type AISuggestionStatus = 
  | "pending"      // En attente de validation
  | "approved"     // Approuvée par l'humain
  | "rejected"     // Rejetée par l'humain
  | "executed";    // Exécutée (après approbation)

/**
 * Structure d'une suggestion IA
 */
export interface AISuggestion {
  id?: number;
  tenantId: number;
  prospectId: number;
  type: AISuggestionType;
  status: AISuggestionStatus;
  title: string;
  description: string;
  suggestedAction: {
    type: "send_sms" | "send_whatsapp" | "schedule_call" | "update_status";
    content?: string;
    scheduledAt?: Date;
    metadata?: unknown;
  };
  aiReasoning: string;
  confidence: number; // 0-100
  createdAt?: Date;
  validatedAt?: Date;
  validatedBy?: number;
  executedAt?: Date;
}

/**
 * Mots interdits pour l'IA (bridage)
 */
const FORBIDDEN_KEYWORDS = [
  "prix", "tarif", "coût", "payer", "payement", "facture",
  "contrat", "engagement", "signer", "signature",
  "garantie", "remboursement", "annulation",
  "price", "cost", "payment", "contract", "sign",
  "€", "$", "EUR", "USD"
];

/**
 * Service Shadow Agent
 */
export class ShadowAgentService {
  /**
   * Détecte les appels manqués et génère des suggestions de relance
   */
  static async detectMissedCallsAndSuggest(tenantId: number): Promise<AISuggestion[]> {
    const db = await getDb();
    
    logger.info("[Shadow Agent] Detecting missed calls", { tenantId });

    try {
      // Récupérer les appels manqués récents (dernières 24h)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const missedCalls = await db
        .select()
        .from(schema.calls)
        .where(
          and(
            eq(schema.calls.tenantId, tenantId),
            eq(schema.calls.outcome, "no_answer"),
            sql`${schema.calls.createdAt} > ${yesterday}`
          )
        )
        .orderBy(desc(schema.calls.createdAt));

      logger.info("[Shadow Agent] Found missed calls", { 
        tenantId, 
        count: missedCalls.length 
      });

      const suggestions: AISuggestion[] = [];

      for (const call of missedCalls) {
        if (!call.prospectId) continue;

        // Vérifier si une suggestion existe déjà pour ce prospect
        const existingSuggestion = await db
          .select()
          .from(schema.aiSuggestions)
          .where(
            and(
              eq(schema.aiSuggestions.tenantId, tenantId),
              eq(schema.aiSuggestions.prospectId, call.prospectId),
              eq(schema.aiSuggestions.type, "missed_call_followup"),
              eq(schema.aiSuggestions.status, "pending")
            )
          )
          .limit(1);

        if (existingSuggestion.length > 0) {
          logger.debug("[Shadow Agent] Suggestion already exists", { 
            prospectId: call.prospectId 
          });
          continue;
        }

        // Récupérer les informations du prospect
        const [prospect] = await db
          .select()
          .from(schema.prospects)
          .where(eq(schema.prospects.id, call.prospectId))
          .limit(1);

        if (!prospect) continue;

        // Générer un message de relance personnalisé
        const suggestedMessage = await this.generateFollowUpMessage(
          prospect,
          call,
          tenantId
        );

        // Vérifier le bridage (pas de mots interdits)
        if (this.containsForbiddenKeywords(suggestedMessage)) {
          logger.warn("[Shadow Agent] Generated message contains forbidden keywords", {
            prospectId: call.prospectId
          });
          continue;
        }

        // Créer la suggestion
        const suggestion: AISuggestion = {
          tenantId,
          prospectId: call.prospectId,
          type: "missed_call_followup",
          status: "pending",
          title: `Relance après appel manqué - ${prospect.firstName} ${prospect.lastName}`,
          description: `Appel manqué le ${call.createdAt?.toLocaleString('fr-FR')}. L'IA suggère d'envoyer un SMS de relance.`,
          suggestedAction: {
            type: "send_sms",
            content: suggestedMessage,
          },
          aiReasoning: "Appel manqué détecté. Relance proactive pour maintenir l'engagement.",
          confidence: 85,
        };

        // Enregistrer la suggestion en base de données
        const [created] = await db
          .insert(schema.aiSuggestions)
          .values(suggestion as unknown)
          .returning();

        suggestions.push(created as unknown);
      }

      logger.info("[Shadow Agent] Suggestions created", { 
        tenantId, 
        count: suggestions.length 
      });

      return suggestions;
    } catch (error: unknown) {
      logger.error("[Shadow Agent] Failed to detect missed calls", { 
        error, 
        tenantId 
      });
      return [];
    }
  }

  /**
   * Génère un message de relance personnalisé via LLM
   */
  private static async generateFollowUpMessage(
    prospect: unknown,
    call: unknown,
    tenantId: number
  ): Promise<string> {
    try {
      const systemPrompt = `Tu es un assistant de relation client professionnel.
Génère un SMS de relance court et courtois (max 160 caractères) pour un prospect qui n'a pas répondu à un appel.

RÈGLES STRICTES :
- Ne JAMAIS mentionner de prix, tarif, coût
- Ne JAMAIS parler de contrat ou engagement
- Rester neutre et professionnel
- Proposer de rappeler ou d'être rappelé
- Utiliser un ton amical mais pas familier

Réponds UNIQUEMENT avec le texte du SMS, sans guillemets ni formatage.`;

      const userPrompt = `Prospect: ${prospect.firstName} ${prospect.lastName}
Entreprise: ${prospect.company || "Non renseignée"}
Contexte: Appel manqué le ${call.createdAt?.toLocaleDateString('fr-FR')}

Génère un SMS de relance.`;

      // ✅ BLOC 1 FIX (TS2554) : invokeLLM requiert (tenantId: number, params: InvokeParams)
      const response = await invokeLLM(tenantId, {
        model: AI_MODEL.DEFAULT,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 100,
        temperature: 0.7,
      });

      const messageContent = response.choices[0]?.message?.content;
      let message = typeof messageContent === 'string' ? messageContent.trim() : "";
      
      // ✅ PROTECTION : Filtre de sortie contre l'engagement non maîtrisé
      if (this.containsForbiddenKeywords(message)) {
        logger.warn("[Shadow Agent] AI generated forbidden content, using safe fallback");
        return `Bonjour ${prospect.firstName}, nous avons essayé de vous joindre. Pouvons-nous vous rappeler ?`;
      }

      // Nettoyer les guillemets si présents
      message = message.replace(/^["']|["']$/g, "");

      // Limiter à 160 caractères pour SMS
      if (message.length > 160) {
        message = message.substring(0, 157) + "...";
      }

      return message;
    } catch (error: unknown) {
      logger.error("[Shadow Agent] Failed to generate follow-up message", { error });
      
      // Fallback : message générique
      return `Bonjour ${prospect.firstName}, nous avons essayé de vous joindre. Pouvons-nous vous rappeler ? Répondez OUI ou NON.`;
    }
  }

  /**
   * Vérifie si un texte contient des mots interdits
   */
  private static containsForbiddenKeywords(text: string): boolean {
    const lowerText = text.toLowerCase();
    return FORBIDDEN_KEYWORDS.some(keyword => lowerText.includes(keyword));
  }

  /**
   * Récupère les suggestions en attente pour un tenant
   */
  static async getPendingSuggestions(tenantId: number): Promise<AISuggestion[]> {
    const db = await getDb();
    
    try {
      const suggestions = await db
        .select()
        .from(schema.aiSuggestions)
        .where(
          and(
            eq(schema.aiSuggestions.tenantId, tenantId),
            eq(schema.aiSuggestions.status, "pending")
          )
        )
        .orderBy(desc(schema.aiSuggestions.createdAt));

      return suggestions as unknown;
    } catch (error: unknown) {
      logger.error("[Shadow Agent] Failed to get pending suggestions", { 
        error, 
        tenantId 
      });
      return [];
    }
  }

  /**
   * Approuve une suggestion et l'exécute
   */
  static async approveSuggestion(
    suggestionId: number,
    tenantId: number,
    userId: number
  ): Promise<{ success: boolean; message: string }> {
    const db = await getDb();
    
    try {
      // Récupérer la suggestion
      const [suggestion] = await db
        .select()
        .from(schema.aiSuggestions)
        .where(
          and(
            eq(schema.aiSuggestions.id, suggestionId),
            eq(schema.aiSuggestions.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!suggestion) {
        return { success: false, message: "Suggestion non trouvée" };
      }

      if (suggestion.status !== "pending") {
        return { success: false, message: "Suggestion déjà traitée" };
      }

      // Marquer comme approuvée
      await db
        .update(schema.aiSuggestions)
        .set({
          status: "approved",
          validatedAt: new Date(),
          validatedBy: userId,
        })
        .where(eq(schema.aiSuggestions.id, suggestionId));

      // Exécuter l'action suggérée
      const executed = await this.executeSuggestion(suggestion as unknown, tenantId);

      if (executed) {
        // BLOC 3+ : Exporter les données si c'est une relance importante
        if (suggestion.type === "missed_call_followup" || suggestion.type === "appointment_reminder") {
          const [prospect] = await db
            .select()
            .from(schema.prospects)
            .where(eq(schema.prospects.id, suggestion.prospectId))
            .limit(1);

          if (prospect) {
            await ExportService.exportCallToCloud(tenantId, {
              prospectName: `${prospect.firstName} ${prospect.lastName}`,
              prospectPhone: prospect.phone,
              callDate: new Date().toISOString(),
              demand: suggestion.title,
              status: "validated_by_ia_shadow",
              notes: suggestion.aiReasoning ?? ""
            });
          }
        }
        await db
          .update(schema.aiSuggestions)
          .set({
            status: "executed",
            executedAt: new Date(),
          })
          .where(eq(schema.aiSuggestions.id, suggestionId));

        logger.info("[Shadow Agent] Suggestion approved and executed", { 
          suggestionId, 
          userId 
        });

        return { success: true, message: "Action exécutée avec succès" };
      } else {
        return { success: false, message: "Échec de l'exécution" };
      }
    } catch (error: unknown) {
      logger.error("[Shadow Agent] Failed to approve suggestion", { 
        error, 
        suggestionId 
      });
      return { success: false, message: "Erreur lors de l'approbation" };
    }
  }

  /**
   * Rejette une suggestion
   */
  static async rejectSuggestion(
    suggestionId: number,
    tenantId: number,
    userId: number
  ): Promise<{ success: boolean; message: string }> {
    const db = await getDb();
    
    try {
      await db
        .update(schema.aiSuggestions)
        .set({
          status: "rejected",
          validatedAt: new Date(),
          validatedBy: userId,
        })
        .where(
          and(
            eq(schema.aiSuggestions.id, suggestionId),
            eq(schema.aiSuggestions.tenantId, tenantId)
          )
        );

      logger.info("[Shadow Agent] Suggestion rejected", { suggestionId, userId });

      return { success: true, message: "Suggestion rejetée" };
    } catch (error: unknown) {
      logger.error("[Shadow Agent] Failed to reject suggestion", { 
        error, 
        suggestionId 
      });
      return { success: false, message: "Erreur lors du rejet" };
    }
  }

  /**
   * Exécute une suggestion approuvée
   */
  private static async executeSuggestion(
    suggestion: AISuggestion,
    tenantId: number
  ): Promise<boolean> {
    const db = await getDb();
    
    try {
      const action = suggestion.suggestedAction;

      if (action.type === "send_sms" || action.type === "send_whatsapp") {
        // Envoyer le message via le service de messaging
        await db.insert(schema.messages).values({
          tenantId,
          prospectId: suggestion.prospectId,
          type: action.type === "send_sms" ? "sms" : "whatsapp",
          direction: "outbound",
          content: action.content ?? "",
          status: "pending",
        });

        logger.info("[Shadow Agent] Message sent", { 
          suggestionId: suggestion.id,
          type: action.type 
        });

        return true;
      }

      // Autres types d'actions à implémenter selon les besoins
      return false;
    } catch (error: unknown) {
      logger.error("[Shadow Agent] Failed to execute suggestion", { 
        error, 
        suggestionId: suggestion.id 
      });
      return false;
    }
  }

  /**
   * Modifie le contenu d'une suggestion avant approbation
   */
  static async modifySuggestion(
    suggestionId: number,
    tenantId: number,
    newContent: string
  ): Promise<{ success: boolean; message: string }> {
    const db = await getDb();
    
    try {
      // Vérifier le bridage sur le nouveau contenu
      if (this.containsForbiddenKeywords(newContent)) {
        return { 
          success: false, 
          message: "Le contenu modifié contient des mots interdits (prix, contrat, etc.)" 
        };
      }

      await db
        .update(schema.aiSuggestions)
        .set({
          suggestedAction: sql`jsonb_set(suggested_action, '{content}', ${JSON.stringify(newContent)})`,
        })
        .where(
          and(
            eq(schema.aiSuggestions.id, suggestionId),
            eq(schema.aiSuggestions.tenantId, tenantId)
          )
        );

      logger.info("[Shadow Agent] Suggestion modified", { suggestionId });

      return { success: true, message: "Suggestion modifiée" };
    } catch (error: unknown) {
      logger.error("[Shadow Agent] Failed to modify suggestion", { 
        error, 
        suggestionId 
      });
      return { success: false, message: "Erreur lors de la modification" };
    }
  }
}

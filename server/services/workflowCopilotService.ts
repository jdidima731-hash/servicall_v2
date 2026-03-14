import { AI_MODEL } from '../_core/aiModels';
/**
 * WORKFLOW COPILOT SERVICE (BLOC 3)
 * Transforme une description textuelle en workflow structuré via IA
 * Version Mise à jour : Orientée Action & Métier
 */

import { getOpenAIClient } from "../_core/openaiClient";
import { logger } from "../infrastructure/logger";

// ✅ CORRIGÉ: Initialisation OpenAI avec l'API officielle (plus de proxy forge.manus.im)
const openai = getOpenAIClient();

export interface GeneratedWorkflow {
  name: string;
  description: string;
  trigger: string;
  actions: Array<{
    id: string;
    action_type: string;
    config: Record<string, any>;
    order: number;
  }>;
}

const SYSTEM_PROMPT = `Tu es l'Architecte IA de Servicall v2, spécialisé dans l'automatisation des flux métiers. Ton objectif est de transformer les besoins utilisateurs en workflows techniques actionnables et prédictibles.

### CONTEXTE MÉTIER
Tu dois comprendre les nuances de chaque profession pour suggérer les meilleures actions :
- **Avocats** : Priorité à la confidentialité, au résumé structuré (faits/procédure) et au suivi des délais.
- **Artisans** : Priorité à la détection d'urgence (fuite, panne) et à la réactivité par SMS.
- **Livraison** : Priorité au scoring logistique, à la qualification géographique et à l'assignation rapide.

### DÉCLENCHEURS (TRIGGERS)
Utilise EXCLUSIVEMENT ces noms d'événements :
- "call.received" : Appel entrant sur le standard.
- "call.completed" : Appel terminé, transcription disponible.
- "prospect.created" : Nouveau contact ajouté au CRM.
- "appointment.scheduled" : Rendez-vous planifié.

### ACTIONS DISPONIBLES
1. "ai_summary" : { "type": "legal" | "standard" | "medical", "format": "bullet_points" | "paragraph" }
2. "ai_sentiment_analysis" : { "detect_urgency": boolean, "context": string }
3. "ai_score" : { "criteria": ["distance", "volume", "urgency"] }
4. "send_sms" : { "to": "{{event.source}}", "body": "Texte avec {{variables.ai.summary}}" }
5. "create_task" : { "title": string, "priority": "low" | "medium" | "high" | "urgent" }
6. "logic_if_else" : { "condition": "variables.ai.sentiment.shouldEscalate", "on_true": "STEP_ID", "on_false": "STEP_ID" }

### RÈGLES D'OR
- **Action, pas Texte** : Crée des chaînes d'actions qui modifient le CRM ou notifient les humains.
- **Variables** : Utilise {{variables.nom}} pour injecter des données dynamiques (ex: {{variables.ai.summary}}).
- **ID d'étape** : Chaque action doit avoir un "id" unique (ex: "step1", "step2") pour permettre le branchement.

### FORMAT DE SORTIE JSON
{
  "name": "Nom métier",
  "description": "Valeur ajoutée...",
  "trigger": "nom.evenement",
  "actions": [
    { "id": "step1", "action_type": "type", "config": {}, "order": 1 }
  ]
}`;

export async function generateWorkflowFromText(prompt: string): Promise<GeneratedWorkflow> {
  try {
    logger.info("[Copilot] Generating workflow from prompt", { prompt });

    const response = await openai.chat.completions.create({
      model: AI_MODEL.DEFAULT,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) throw new Error("Réponse vide de l'IA");

    let generated: GeneratedWorkflow;
    try {
      generated = JSON.parse(content) as GeneratedWorkflow;
    } catch (parseError) {
      logger.error("[Copilot] JSON parse error", { error: parseError, content });
      throw new Error("Impossible de parser la réponse JSON de l'IA");
    }
    
    if (!generated.trigger || !Array.isArray(generated.actions)) {
      throw new Error("Structure de workflow invalide générée par l'IA");
    }

    return generated;
  } catch (error: unknown) {
    logger.error("[Copilot] Generation failed", { error });
    throw error;
  }
}

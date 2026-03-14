/**
 * INDUSTRY WORKFLOW TEMPLATES
 * Templates de workflows métiers pré-configurés
 * Version Améliorée : Avocats, Artisans, Livraison
 */

import type { Rule, ConditionGroup } from "../utils/ConditionEvaluator";

/** Identifiants d'industrie utilisés dans les templates */
export type IndustryId = 'lawyer' | 'craftsman' | 'delivery' | string;

export interface WorkflowTemplate {
  industry: IndustryId;
  name: string;
  description: string;
  trigger_type: string;
  steps: WorkflowStep[];
}

export interface WorkflowStep {
  id: string;
  name?: string;
  action_type: string;
  config: Record<string, unknown>;
  type?: 'action' | 'condition';
  rules?: Rule | ConditionGroup | (Rule | ConditionGroup)[];
  next_step?: string;
  order?: number;
}

// --- AVOCATS : Résumé Juridique ---
export const BLUEPRINT_LAWYER: WorkflowTemplate = {
  industry: 'lawyer',
  name: "Avocats - Résumé Juridique Automatisé",
  description: "Analyse les appels, extrait les faits juridiques et crée une tâche de suivi.",
  trigger_type: 'call.completed',
  steps: [
    { id: 'step1', name: "Transcription", action_type: 'transcribe_call', config: {}, order: 1 },
    { id: 'step2', name: "Résumé Juridique", action_type: 'ai_summary', config: { type: 'legal', format: 'paragraph' }, order: 2 },
    { id: 'step3', name: "Extraction Entités", action_type: 'ai_extract', config: { fields: ['adversaire', 'tribunal', 'date_audience'] }, order: 3 },
    { id: 'step4', name: "Création Tâche", action_type: 'create_task', config: { title: "Suivi Dossier : {{variables.ai.extracted.adversaire}}", priority: "medium" }, order: 4 }
  ]
};

// --- ARTISANS : Détection Urgence ---
export const BLUEPRINT_CRAFTSMAN: WorkflowTemplate = {
  industry: 'craftsman',
  name: "Artisans - Gestion des Urgences",
  description: "Détecte les urgences (fuites, pannes) et alerte immédiatement par SMS.",
  trigger_type: 'call.received',
  steps: [
    { id: 'step1', name: "Analyse Sentiment & Urgence", action_type: 'ai_sentiment_analysis', config: { detect_urgency: true }, order: 1 },
    { id: 'step2', name: "Branchement Urgence", action_type: 'logic_if_else', config: {
        condition: 'variables.ai.sentiment.shouldEscalate',
        on_true: 'step3_urgent',
        on_false: 'step3_standard'
      }, order: 2 },
    { id: 'step3_urgent', name: "Alerte SMS Urgent", action_type: 'send_sms', config: { body: "URGENCE DETECTEE : {{variables.last_message}}" }, order: 3 },
    { id: 'step3_standard', name: "Tâche Standard", action_type: 'create_task', config: { title: "Rappel Client Standard", priority: "low" }, order: 4 }
  ]
};

// --- LIVRAISON : Scoring Priorité ---
export const BLUEPRINT_DELIVERY: WorkflowTemplate = {
  industry: 'delivery',
  name: "Livraison - Scoring & Qualification",
  description: "Qualifie les demandes de livraison et assigne une priorité logistique.",
  trigger_type: 'prospect.created',
  steps: [
    { id: 'step1', name: "Scoring Logistique", action_type: 'ai_score', config: { criteria: ['volume', 'distance'] }, order: 1 },
    { id: 'step2', name: "Tag Priorité", action_type: 'add_tag', config: { tag: "Score: {{variables.ai.score}}" }, order: 2 },
    { id: 'step3', name: "Assignation", action_type: 'assign_agent', config: { role: "livreur", smart_routing: true }, order: 3 }
  ]
};

export const ALL_TEMPLATES: WorkflowTemplate[] = [
  BLUEPRINT_LAWYER,
  BLUEPRINT_CRAFTSMAN,
  BLUEPRINT_DELIVERY
];

export function getTemplatesByIndustry(industry: IndustryId): WorkflowTemplate[] {
  return ALL_TEMPLATES.filter(t => t.industry === industry);
}

export function getTemplate(name: string): WorkflowTemplate | undefined {
  return ALL_TEMPLATES.find(t => t.name === name);
}

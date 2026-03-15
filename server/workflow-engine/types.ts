import type { tenants, workflows, prospects, calls } from '../../drizzle/schema';

// 1. Types de base depuis le schéma Drizzle
export type Tenant = typeof tenants.$inferSelect & {
  phoneNumber?: string | null;
};
export type Workflow = typeof workflows.$inferSelect;
export type Contact = typeof prospects.$inferSelect;
export type Call = typeof calls.$inferSelect;

// 2. Types de base pour le moteur
export enum Channel {
  CALL = 'call',
  SMS = 'sms',
  WHATSAPP = 'whatsapp',
  EMAIL = 'email',
  FORM = 'form',
  WEBHOOK = 'webhook',
  APPOINTMENT = 'appointment',
  CALENDAR = 'calendar'
}

export enum EventType {
  CALL_IN = 'call_in',
  CALL_OUT = 'call_out',
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
  MANUAL = 'manual',
  SCHEDULED = 'scheduled'
}

// 3. Structure des événements entrants
export interface IncomingEvent<TData = Record<string, unknown>, TMeta = Record<string, unknown>> {
  id: string;
  tenant_id: number;
  channel: Channel;
  type: EventType;
  source: string;
  destination: string;
  data: TData;
  metadata: TMeta;
  status: string;
  created_at: Date;
}

// 4. Le Contexte d'Exécution
// Utilise WorkflowVariables par défaut pour un typage fort.
// Le paramètre générique TVars est conservé pour la compatibilité ascendante.
export interface ExecutionContext<TVars = WorkflowVariables> {
  event: IncomingEvent;
  tenant: Tenant;
  workflow: Workflow;
  variables: TVars;
  steps_results: Record<string, ActionResult<unknown>>;
}

// 5. Le résultat d'une action, maintenant générique
export interface ActionResult<TOutput = Record<string, unknown>> {
  success: boolean;
  data?: TOutput;
  error?: string;
}

// 6. Le Handler d'Action, avec configuration et contexte génériques
// TContext peut être soit ExecutionContext<TVars> (compatibilité) soit FinalExecutionContext (typage strict)
export interface ActionHandler<
  TConfig extends Record<string, unknown>,
  TContext = ExecutionContext<WorkflowVariables>,
  TOutput = unknown
> {
  name: string;
  execute(context: TContext, config: TConfig): Promise<ActionResult<TOutput>>;
  validate(config: TConfig | Record<string, unknown>): boolean;
}

// 7. Type de base pour la configuration des actions
// Utilise 'unknown' plutôt que 'any' pour forcer la validation avant l'utilisation
export type ActionConfig = Record<string, unknown>;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES STRUCTURÉS POUR LES VARIABLES DU CONTEXTE D'EXÉCUTION
// Ces types remplacent les index signatures génériques { [key: string]: any }
// ─────────────────────────────────────────────────────────────────────────────

/** Données d'un prospect/contact dans le contexte d'exécution */
export interface ProspectData {
  id?: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

/** Données relatives à un appel téléphonique */
export interface CallData {
  call_sid?: string;
  recording_url?: string;
  duration?: number;
  transcription?: string;
}

/** Données d'une analyse IA */
export interface AIData {
  sentiment?: 'positif' | 'negatif' | 'neutre';
  score?: number;
  summary?: string;
  intent?: string;
  classification?: string;
}

/**
 * Variables du contexte d'exécution d'un workflow.
 * Remplace les index signatures génériques par des propriétés nommées et typées.
 * La signature d'index est conservée uniquement pour les données dynamiques
 * non prévisibles (ex: résultats d'actions personnalisées).
 */
export interface WorkflowVariables {
  prospect?: ProspectData;
  call?: CallData;
  ai?: AIData;
  last_message?: string;
  transcription?: string;
  ai_score?: number;
  ai_summary?: string;
  business_entities?: Record<string, unknown>;
  appointment?: Record<string, unknown>;
  reservation?: Record<string, unknown>;
  reservation_id?: string;
  recording_url?: string;
  phone?: string;
  caller_phone?: string;
  email?: string;
  audioData?: string | Buffer;
  callId?: string | number;
  visit?: Record<string, unknown>;
  property?: Record<string, unknown>;
  // Données dynamiques issues des actions
  [key: string]: unknown;
}

// Alias de compatibilité
export type ProspectVariables = ProspectData;
export type CallVariables = CallData;
export type CommonExecutionVariables = WorkflowVariables;

// ─────────────────────────────────────────────────────────────────────────────
// MÉTADONNÉES DE L'ÉVÉNEMENT
// ─────────────────────────────────────────────────────────────────────────────

/** Métadonnées structurées d'un événement entrant */
export interface EventMetadata {
  triggered_by?: string | number;
  webhook_tenant_id?: string | number;
  tenant_id?: string | number;
  trigger?: string;
  [key: string]: unknown;
}

/** Événement entrant avec métadonnées typées */
export type StructuredIncomingEvent = IncomingEvent<Record<string, unknown>, EventMetadata>;

/** Contexte d'exécution final avec types structurés */
export interface FinalExecutionContext {
  event: StructuredIncomingEvent;
  tenant: Tenant;
  workflow: Workflow;
  variables: WorkflowVariables;
  steps_results: Record<string, ActionResult<unknown>>;
}

// 8. Configuration du déclencheur de workflow
export interface TriggerConfig {
  channel?: Channel;
  eventType?: EventType;
  sourcePattern?: string;
  trigger?: string;
  conditions?: unknown;
}

// 9. Résultat d'une exécution de workflow
export interface WorkflowExecutionResult<TVars = WorkflowVariables> {
  status: 'SUCCESS' | 'FAILED' | 'PARTIAL';
  workflow_id: number;
  variables: TVars;
  results: Record<string, ActionResult<unknown>>;
}

// 10. Représentation d'une étape de workflow
export interface WorkflowStep {
  id: string | number;
  name?: string;
  /** Nom de l'action à exécuter (ex: 'send_email', 'logic_if_else').
   * C'est cette propriété qui identifie l'action, et non une propriété 'action'. */
  type: string;
  config: ActionConfig;
  order?: number;
  on_true?: string;
  on_false?: string;
  stop_on_failure?: boolean;
  retry?: RetryConfig;
}

// 11. Configuration de la politique de retry
export interface RetryConfig {
  maxAttempts: number;
  backoffMs: number;
  backoffMultiplier: number;
}

// 12. Type d'analyse IA
export enum AnalysisType {
  INTENT = 'intent',
  SENTIMENT = 'sentiment',
  SUMMARY = 'summary',
  SCORE = 'score',
  CLASSIFICATION = 'classification'
}

// 13. Type Industrie
export interface Industry {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  capabilities: string[];
  workflows: string[];
  aiSystemPrompt: string;
  workflowCount: number;
}

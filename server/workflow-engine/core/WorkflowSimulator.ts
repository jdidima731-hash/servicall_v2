/**
 * WORKFLOW SIMULATOR
 * Simule l'exécution d'un workflow dans un environnement sandbox (BLOC 2)
 */

// import { Logger } from "../utils/Logger"; // Removed unused import
import type { Workflow } from "../types";

interface WorkflowStep {
  name?: string;
  type?: string;
  action_type?: string;
  config?: {
    recipient?: string;
    message?: string;
    template?: string;
    title?: string;
  };
}

export interface SimulationLog {
  stepName: string;
  stepType: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export interface SimulationResult {
  success: boolean;
  logs: SimulationLog[];
  finalVariables: Record<string, unknown>;
  duration: number;
}

export class WorkflowSimulator {
  // Logger available for future use
  constructor() {
    // Logger initialized on demand
  }

  async simulate(workflow: Workflow, mockData: Record<string, unknown> = {}): Promise<SimulationResult> {
    const startTime = Date.now();
    const logs: SimulationLog[] = [];
    const variables: Record<string, unknown> = { ...mockData };
    const rawActions: unknown = typeof workflow.actions === 'string'
      ? JSON.parse(workflow.actions)
      : workflow.actions;
    const steps: WorkflowStep[] = Array.isArray(rawActions) ? rawActions as WorkflowStep[] : [];

    const addLog = (
      stepName: string,
      stepType: string,
      status: SimulationLog['status'],
      message: string,
      data?: Record<string, unknown>
    ): void => {
      logs.push({
        stepName,
        stepType,
        status,
        message,
        timestamp: new Date().toISOString(),
        data
      });
    };

    addLog('System', 'start', 'completed', `Démarrage de la simulation pour le workflow: ${workflow.name}`);

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepName = step?.name ?? `Étape ${i + 1}`;
      const stepType = step?.type ?? step?.action_type ?? 'unknown';

      addLog(stepName, stepType, 'running', `Exécution de l'étape: ${stepName}`);

      try {
        // Simulation des délais réseau/IA
        await new Promise(resolve => setTimeout(resolve, 500));

        // Logique de simulation par type d'action
        let stepResult: Record<string, unknown> = {};

        switch (stepType) {
          case 'ai_sentiment_analysis':
            stepResult = { sentiment: 'positif', score: 0.85, detected_intent: 'demande_info' };
            addLog(stepName, stepType, 'completed', "IA: Analyse de sentiment terminée. Résultat: Positif (0.85)", stepResult);
            break;

          case 'ai_summary':
            stepResult = { summary: "Le client souhaite obtenir des informations sur les tarifs et les disponibilités pour la semaine prochaine." };
            addLog(stepName, stepType, 'completed', "IA: Résumé généré avec succès.", stepResult);
            break;

          case 'ai_score':
            stepResult = { lead_score: 75, hot_lead: true };
            addLog(stepName, stepType, 'completed', "IA: Scoring terminé. Score: 75/100 (Prospect chaud)", stepResult);
            break;

          case 'send_sms':
            addLog(stepName, stepType, 'completed', `SMS: Message simulé vers ${step?.config?.recipient ?? 'client'}: "${step?.config?.message ?? '...'}"`);
            break;

          case 'send_email':
            addLog(stepName, stepType, 'completed', `Email: Envoi simulé via template "${step?.config?.template ?? 'default'}"`);
            break;

          case 'create_task':
            stepResult = { taskId: Math.floor(Math.random() * 10000) };
            addLog(stepName, stepType, 'completed', `CRM: Tâche "${step?.config?.title ?? 'Sans titre'}" créée en sandbox.`, stepResult);
            break;

          default:
            addLog(stepName, stepType, 'completed', `Action "${stepType}" simulée avec succès.`);
        }

        // Mise à jour des variables
        Object.assign(variables, stepResult);

      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        addLog(stepName, stepType, 'failed', `Erreur lors de la simulation: ${message}`);
        return {
          success: false,
          logs,
          finalVariables: variables,
          duration: Date.now() - startTime
        };
      }
    }

    addLog('System', 'end', 'completed', "Simulation terminée avec succès.");

    return {
      success: true,
      logs,
      finalVariables: variables,
      duration: Date.now() - startTime
    };
  }
}

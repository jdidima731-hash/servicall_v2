/**
 * WORKFLOW EXECUTOR - VERSION PROD READY (DYNAMIC STATE MACHINE)
 * Gère l'exécution séquentielle, conditionnelle et sécurisée des étapes.
 * ✅ Implémente la gestion des questions hors-sujet et le retour au flux principal.
 */

import type {
  ActionResult,
  WorkflowExecutionResult,
  WorkflowStep,
  RetryConfig,
  ActionConfig,
  WorkflowVariables,
  FinalExecutionContext,
} from "../types";
import { ActionRegistry } from "../actions/ActionRegistry";
// Sentry imports removed (unused)
import { Logger } from "../utils/Logger";
import { PlaceholderEngine } from "../utils/PlaceholderEngine";
// import { AuditService } from "../../services/auditService"; // unused
// import { workflowExecutions, workflowFailures } from "../../services/metricsService"; // reserved for future metrics
import { invokeLLM } from "../../_core/llm";

export class WorkflowExecutor {
  private registry: ActionRegistry;
  private logger: Logger;
  constructor() {
    this.registry = new ActionRegistry();
    this.logger = new Logger('WorkflowExecutor');
  }

  async execute(
    context: FinalExecutionContext
  ): Promise<WorkflowExecutionResult<WorkflowVariables>> {
    const { workflow } = context;

    const dbSteps: WorkflowStep[] = (
      Array.isArray(workflow.actions)
        ? workflow.actions
        : JSON.parse((workflow.actions as string) || '[]')
    ) as WorkflowStep[];

    this.logger.info('Starting workflow execution', {
      workflowId: workflow.id,
      stepsCount: dbSteps.length
    });

    let currentStepIndex = 0;
    let executionStatus: 'SUCCESS' | 'FAILED' | 'PARTIAL' = 'SUCCESS';
    let lastErrorMessage = '';

    while (currentStepIndex < dbSteps.length) {
      const step = dbSteps[currentStepIndex];
      if (!step) {
        currentStepIndex++;
        continue;
      }
      const stepName = step.name ?? `step_${step.id}`;

      try {
        this.logger.info(`Executing step: ${stepName}`, { type: step.type });

        // ✅ GESTION HORS-SUJET (OFF-TOPIC)
        // Si l'utilisateur pose une question hors-sujet, on utilise le LLM pour y répondre
        // tout en gardant le contexte de l'étape actuelle.
        if (context.event.metadata?.['is_off_topic']) {
          await this.handleOffTopic(context, step);
          // Après avoir répondu, on continue à l'étape actuelle (pas d'incrément)
          context.event.metadata['is_off_topic'] = false;
          continue;
        }

        const handler = this.registry.getHandler(step.type);
        if (!handler) {
          throw new Error(`No handler found for action type: ${step.type}`);
        }

        let resolvedConfig: ActionConfig;
        try {
          resolvedConfig = PlaceholderEngine.resolve(
            step.config,
            context
          ) as ActionConfig;
        } catch (placeholderError) {
          this.logger.error(`Placeholder resolution failed for step ${stepName}`, {
            error: placeholderError
          });
          executionStatus = 'FAILED';
          lastErrorMessage = placeholderError instanceof Error ? placeholderError.message : 'Placeholder error';
          context.steps_results[stepName] = { success: false, error: lastErrorMessage };
          break;
        }

        if (!handler.validate(resolvedConfig)) {
          throw new Error(`Validation failed for step ${stepName} with resolved config`);
        }

        const retryConfig: RetryConfig = step.retry ?? {
          maxAttempts: 1,
          backoffMs: 1000,
          backoffMultiplier: 2
        };

        const result: ActionResult<unknown> = await this.executeWithRetry(
          handler,
          context,
          resolvedConfig,
          retryConfig,
          stepName
        );

        context.steps_results[stepName] = result;

        if (result.success) {
          this.logger.info(`Step ${stepName} success`);
          if (result.data && typeof result.data === 'object') {
            Object.assign(context.variables, result.data);
          }
        } else {
          this.logger.error(`Step ${stepName} failed after retries`, { error: result.error });
          executionStatus = 'PARTIAL';
          lastErrorMessage = result.error ?? 'Unknown error';

          const stopOnFailure = step.stop_on_failure !== false;
          if (stopOnFailure) {
            executionStatus = 'FAILED';
            break;
          }
        }

        // Branching Logic (If/Else)
        if (step.type === 'logic_if_else' && result.success) {
          const branchData = result.data as { branch?: 'if' | 'else' } | undefined;
          const branch = branchData?.branch;
          const nextStepId = branch === 'if' ? step.on_true : step.on_false;

          if (nextStepId) {
            if (nextStepId === 'END') break;
            const targetIndex = dbSteps.findIndex(s => s.id === nextStepId || s.name === nextStepId);
            if (targetIndex !== -1) {
              currentStepIndex = targetIndex;
              continue;
            }
          }
        }

      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(`Critical error in step ${stepName}`, { error: errorMessage });
        context.steps_results[stepName] = { success: false, error: errorMessage };
        executionStatus = 'FAILED';
        lastErrorMessage = errorMessage;
        break;
      }

      currentStepIndex++;
    }

    return {
      status: executionStatus,
      workflow_id: workflow.id,
      variables: context.variables,
      results: context.steps_results
    };
  }

  /**
   * Handle off-topic questions by answering and returning to the main flow.
   */
  private async handleOffTopic(context: FinalExecutionContext, currentStep: WorkflowStep): Promise<void> {
    this.logger.info('Handling off-topic question', { step: currentStep.name });
    
    const userQuestion = context.event.metadata?.['user_input'] || "";
    
    const response = await invokeLLM(context.tenant.id, {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system' as const, content: `Tu es un assistant qui répond à une question hors-sujet pendant un workflow de ${context.workflow.name}. Réponds brièvement puis redirige l'utilisateur vers l'étape actuelle : ${currentStep.name}.` as string },
        { role: 'user' as const, content: userQuestion as string }
      ],
      temperature: 0.5,
    });

    const answer = response.choices[0]?.message?.content || "Je ne suis pas sûr de comprendre, mais revenons à notre sujet.";
    
    // On injecte la réponse dans les variables pour que le VoicePipeline puisse la dire
    context.variables['last_ai_response'] = answer;
  }

  private async executeWithRetry(
    handler: unknown,
    context: FinalExecutionContext,
    config: ActionConfig,
    retryConfig: RetryConfig,
    _stepName: string
  ): Promise<ActionResult<unknown>> {
    let lastError = '';
    const maxAttempts = retryConfig.maxAttempts ?? 1;
    const backoffMs = retryConfig.backoffMs ?? 1000;
    const backoffMultiplier = retryConfig.backoffMultiplier ?? 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await handler.execute(context, config);
        if (result.success) return result;
        lastError = result.error ?? 'Unknown error';
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
      }

      if (attempt < maxAttempts) {
        const delay = backoffMs * Math.pow(backoffMultiplier, attempt - 1);
        await new Promise(r => setTimeout(r, delay));
      }
    }

    return {
      success: false,
      error: `Failed after ${maxAttempts} attempts: ${lastError}`
    };
  }
}

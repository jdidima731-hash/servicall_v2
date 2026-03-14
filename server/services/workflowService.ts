/**
 * Workflow Service - Automation et règles métier
 * Module 7: Workflow Automation
 * ✅ AXE 3: Cache pour les performances
 */

import * as db from "../db"
;
import { logger } from "../infrastructure/logger";
import * as cache from "./cacheService";
import { deleteCache, CACHE_KEYS } from "./cacheService";

// ============================================
// WORKFLOW TYPES
// ============================================

export type WorkflowTrigger =
  | "call_received"
  | "call_completed"
  | "prospect_created"
  | "prospect_qualified"
  | "appointment_scheduled"
  | "appointment_confirmed"
  | "appointment_cancelled"
  | "invoice_created"
  | "invoice_overdue";

export type WorkflowActionType =
  | "send_sms"
  | "send_email"
  | "create_task"
  | "assign_prospect"
  | "update_prospect_status"
  | "schedule_followup"
  | "webhook"
  | "create_appointment";

export interface WorkflowAction {
  type: WorkflowActionType;
  config: Record<string, any>;
}

// ============================================
// WORKFLOW EXECUTION
// ============================================

/**
 * Évaluer les conditions d'un workflow
 */
function evaluateConditions(conditions: Record<string, any>, context: Record<string, any>): boolean {
  try {
    // Implémentation simple : vérifier que toutes les conditions sont remplies
    for (const [key, expectedValue] of Object.entries(conditions)) {
      if (context[key] !== expectedValue) {
        return false;
      }
    }
    return true;
  } catch (error: unknown) {
    logger.error("[Workflow Service] Error evaluating conditions", { error, conditions });
    return false;
  }
}

/**
 * Exécuter une action de workflow
 */
async function executeAction(
  action: WorkflowAction,
  tenantId: number,
  _context: Record<string, any>
): Promise<void> {
  logger.info(`[Workflow Service] Executing action: ${action.type}`, { tenantId, action });

  switch (action.type) {
    case "send_sms":
      // À implémenter avec messagingService
      logger.info("[Workflow Service] Sending SMS", { config: action.config });
      break;

    case "send_email":
      // À implémenter avec emailService
      logger.info("[Workflow Service] Sending email", { config: action.config });
      break;

    case "create_task":
      // À implémenter avec taskService
      logger.info("[Workflow Service] Creating task", { config: action.config });
      break;

    case "assign_prospect":
      // À implémenter avec prospectService
      logger.info("[Workflow Service] Assigning prospect", { config: action.config });
      break;

    case "update_prospect_status":
      // À implémenter avec prospectService
      logger.info("[Workflow Service] Updating prospect status", { config: action.config });
      break;

    case "schedule_followup":
      // À implémenter avec appointmentService
      logger.info("[Workflow Service] Scheduling followup", { config: action.config });
      break;

    case "webhook":
      // À implémenter avec axios
      logger.info("[Workflow Service] Calling webhook", { config: action.config });
      break;

    case "create_appointment":
      // À implémenter avec appointmentService
      logger.info("[Workflow Service] Creating appointment", { config: action.config });
      break;

    default:
      logger.warn(`[Workflow Service] Unknown action type: ${(action as WorkflowAction).type}`);
  }
}

/**
 * Execute a workflow based on trigger
 * ✅ AXE 3: Utilisation du cache pour récupérer les workflows
 */
export async function executeWorkflow(
  tenantId: number,
  trigger: WorkflowTrigger,
  context: Record<string, any>
): Promise<void> {
  // const _startTime = Date.now();
  try {
    logger.info(`[Workflow Service] Triggering workflows for: ${trigger}`, { tenantId, trigger });

    // ✅ AXE 3: Récupérer les workflows depuis le cache
    const cacheKey = cache.CACHE_KEYS.ACTIVE_WORKFLOWS(tenantId);
    const workflows = await cache.getOrSet(
      cacheKey,
      async () => await db.getWorkflowsByTenant(tenantId),
      cache.CACHE_TTL.WORKFLOWS
    );

    const matchingWorkflows = workflows.filter((w) => w.trigger === trigger && w.isActive);

    logger.info(`[Workflow Service] Found ${matchingWorkflows.length} active workflows`, { 
      tenantId, 
      trigger,
      workflowIds: matchingWorkflows.map(w => w.id)
    });

    // Execute each matching workflow
    for (const workflow of matchingWorkflows) {
      try {
        logger.info(`[Workflow Service] Executing workflow: ${workflow.name}`, {
          workflowId: workflow.id,
          tenantId,
          trigger
        });

        // Vérifier les conditions si définies
        if (workflow.conditions && !evaluateConditions(workflow.conditions, context)) {
          logger.info(`[Workflow Service] Workflow conditions not met`, {
            workflowId: workflow.id,
            tenantId
          });
          continue;
        }

        // Exécuter les actions du workflow
        const actions = workflow.actions as WorkflowAction[];
        for (const action of actions) {
          await executeAction(action, tenantId, context);
        }

        logger.info(`[Workflow Service] Workflow executed successfully`, {
          workflowId: workflow.id,
          tenantId
        });

      } catch (error: unknown) {
        logger.error(`[Workflow Service] Error executing workflow`, {
          workflowId: workflow.id,
          tenantId,
          error
        });
        // Continue avec les autres workflows même en cas d'erreur
      }
    }
  } catch (error: unknown) {
    logger.error("[Workflow Service] Error in executeWorkflow", error, { tenantId, trigger });
    throw error;
  }
}

/**
 * Invalider le cache des workflows (à appeler lors de la création/modification)
 */
export async function invalidateWorkflowCache(tenantId: number): Promise<void> {
  await deleteCache(CACHE_KEYS.ACTIVE_WORKFLOWS(tenantId));
  logger.info("[Workflow Service] Workflow cache invalidated", { tenantId });
}

/**
 * Get workflow execution history
 */
export async function getWorkflowExecutionHistory(workflowId: number, limit: number = 50) {
  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return [];

    const { workflowExecutions } = await import("../../drizzle/schema");
    const { eq, desc } = await import("drizzle-orm");

    return await db
      .select()
      .from(workflowExecutions)
      .where(eq(workflowExecutions.workflowId, workflowId))
      .orderBy(desc(workflowExecutions.createdAt))
      .limit(limit);
  } catch (error: unknown) {
    logger.error("[Workflow Service] Error getting workflow execution history", { error, workflowId });
    return [];
  }
}

/**
 * Get tenant workflow execution history
 */
export async function getTenantWorkflowExecutionHistory(tenantId: number, limit: number = 100) {
  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return [];

    const { workflowExecutions, workflows } = await import("../../drizzle/schema");
    const { eq, desc } = await import("drizzle-orm");

    return await db
      .select({
        execution: workflowExecutions,
        workflow: workflows,
      })
      .from(workflowExecutions)
      .innerJoin(workflows, eq(workflowExecutions.workflowId, workflows.id))
      .where(eq(workflows.tenantId, tenantId))
      .orderBy(desc(workflowExecutions.createdAt))
      .limit(limit);
  } catch (error: unknown) {
    logger.error("[Workflow Service] Error getting tenant workflow execution history", { error, tenantId });
    return [];
  }
}

/**
 * Trigger workflow when a call is completed
 */
export async function triggerCallCompletedWorkflow(params: {
  tenantId: number;
  callId: number;
  prospectId?: number;
  agentId?: number;
  duration?: number;
  status: string;
}) {
  try {
    await executeWorkflow(params.tenantId, "call_completed", {
      callId: params.callId,
      prospectId: params.prospectId,
      agentId: params.agentId,
      duration: params.duration,
      status: params.status,
    });
    logger.info("[Workflow Service] Call completed workflow triggered", { tenantId: params.tenantId, callId: params.callId });
  } catch (error: unknown) {
    logger.error("[Workflow Service] Error triggering call completed workflow", { error, params });
  }
}

/**
 * WORKFLOW ENGINE CENTRAL
 * Intégré avec Drizzle ORM et le schéma ServiceCall
 */

import { eq, and } from "drizzle-orm";
import { getDb, workflows, tenants } from "../../db";
import type {
  IncomingEvent,
  Workflow,
  TriggerConfig,
  WorkflowExecutionResult,
  WorkflowVariables,
  FinalExecutionContext,
  StructuredIncomingEvent,
  EventMetadata,
} from "../types";
import { WorkflowExecutor } from "./WorkflowExecutor";
import { Logger } from "../utils/Logger";

export class WorkflowEngine {
  private executor: WorkflowExecutor;
  private logger: Logger;

  constructor() {
    this.executor = new WorkflowExecutor();
    this.logger = new Logger('WorkflowEngine');
  }

  /**
   * Point d'entrée unique pour tous les événements
   */
  async handle(
    event: IncomingEvent
  ): Promise<WorkflowExecutionResult<WorkflowVariables> | { status: 'no_workflow' }> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    this.logger.info('Handling event', { channel: event.channel, source: event.source });

    // 1. Résoudre le tenant si non fourni
    if (!event.tenant_id) {
      event.tenant_id = await this.resolveTenant(event);
    }

    // 2. Charger le tenant
    const tenantResult = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, event.tenant_id))
      .limit(1);
    const tenant = tenantResult[0];
    if (!tenant) {
      throw new Error(`Tenant not found: ${event.tenant_id}`);
    }

    // 3. Identifier le workflow correspondant
    const matchingWorkflows = await db
      .select()
      .from(workflows)
      .where(and(eq(workflows.tenantId, event.tenant_id), eq(workflows.isActive, true)))
      .execute();

    let bestWorkflow: Workflow | null = null;
    let highestScore = -1;

    for (const workflow of matchingWorkflows) {
      const score = this.scoreWorkflow(workflow, event);
      if (score > highestScore) {
        highestScore = score;
        bestWorkflow = workflow;
      }
    }

    if (!bestWorkflow || highestScore <= 0) {
      this.logger.warn('No active workflow found for event', {
        tenantId: event.tenant_id,
        channel: event.channel
      });
      return { status: 'no_workflow' };
    }

    // 4. Créer le contexte d'exécution structuré
    const structuredEvent: StructuredIncomingEvent = {
      ...event,
      metadata: (event.metadata ?? {}) as EventMetadata,
    };

    const context: FinalExecutionContext = {
      event: structuredEvent,
      tenant,
      workflow: bestWorkflow,
      variables: { ...(event.data as WorkflowVariables) },
      steps_results: {}
    };

    // 5. Exécuter le workflow
    return await this.executor.execute(context);
  }

  /**
   * Score un workflow par rapport à un événement
   */
  private scoreWorkflow(workflow: Workflow, event: IncomingEvent): number {
    let score = 0;
    const config = workflow.triggerConfig as TriggerConfig;
    const workflowName = workflow.name ?? '';

    if (config?.channel === event.channel) {
      score += 10;
    } else if (workflowName.toLowerCase().includes(event.channel.toLowerCase())) {
      score += 5;
    }

    if (config?.eventType === event.type) {
      score += 10;
    } else if ((event.metadata as EventMetadata)?.trigger === config?.trigger) {
      score += 15;
    }

    if (config?.sourcePattern && event.source) {
      try {
        const regex = new RegExp(config.sourcePattern);
        if (regex.test(event.source)) {
          score += 3;
        }
      } catch (_e) {
        this.logger.error('Invalid sourcePattern regex', { pattern: config.sourcePattern });
      }
    }

    return score;
  }

  /**
   * Résout le tenant ID à partir des données de l'événement
   */
  private async resolveTenant(event: IncomingEvent): Promise<number> {
    const db = await getDb();
    if (!db) return 1;

    if (event.tenant_id) return event.tenant_id;

    const meta = event.metadata as EventMetadata;
    if (meta?.tenant_id) return Number(meta.tenant_id);

    if (event.channel === 'email' && event.source && event.source.includes('@')) {
      const domain = event.source.split('@')[1];
      if (domain) {
        const tenantByDomain = await db
          .select({ id: tenants.id })
          .from(tenants)
          .where(and(eq(tenants.domain, domain), eq(tenants.isActive, true)))
          .limit(1);

        if (tenantByDomain[0]) return tenantByDomain[0].id;
      }
    }

    if (meta?.webhook_tenant_id) {
      return Number(meta.webhook_tenant_id);
    }

    const defaultTenant = await db.select({ id: tenants.id }).from(tenants).limit(1);
    return defaultTenant[0]?.id ?? 1;
  }
}

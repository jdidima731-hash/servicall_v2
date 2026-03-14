/**
 * UPDATE LEAD ACTION - HARDENED
 * Met à jour un prospect existant dans le CRM avec machine d'état et idempotence.
 */

import { z } from "zod";
import type { ActionHandler, ActionResult, ProspectData } from "../../types";
import type { FinalExecutionContext } from "../../structured-types";
import { getDb, prospects } from "../../../db";
import { eq } from "drizzle-orm";
import { Logger } from "../../utils/Logger";
import { IdempotencyService } from "../../utils/IdempotencyService";
import { StateMachineEngine, ProspectStateMachine } from "../../state-machine/StateMachine";
import { AuditService } from "../../../services/auditService";

// Configuration structurée
const UpdateLeadConfigSchema = z.object({
  prospect_id: z.number().optional(),
  status: z.string().optional(),
  score: z.number().optional(),
  notes: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
type UpdateLeadConfig = z.infer<typeof UpdateLeadConfigSchema>;

// Résultat structuré
interface UpdateLeadResult {
  prospect_id: number;
  updated: Record<string, unknown>;
  skipped?: boolean;
}

export class UpdateLeadAction implements ActionHandler<UpdateLeadConfig, FinalExecutionContext, UpdateLeadResult> {
  name = 'update_lead';
  private logger = new Logger('UpdateLeadAction');

  async execute(
    context: FinalExecutionContext,
    config: UpdateLeadConfig
  ): Promise<ActionResult<UpdateLeadResult>> {
    try {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const prospectId: number | undefined =
        config.prospect_id ?? context.variables.prospect?.id;

      if (!prospectId) {
        throw new Error('No prospect ID provided for update');
      }

      // 1. Idempotency Check
      const idempotencyKey = IdempotencyService.generateKey({
        prospectId,
        config,
        eventId: context.event.id
      });

      const isFirstTime = await IdempotencyService.checkAndSet(idempotencyKey, 'update_lead');
      if (!isFirstTime) {
        this.logger.info('Duplicate update_lead detected, skipping', { prospectId });
        return { success: true, data: { prospect_id: prospectId, skipped: true, updated: {} } };
      }

      // 2. State Machine Validation
      const currentProspect = await db
        .select()
        .from(prospects)
        .where(eq(prospects.id, prospectId))
        .limit(1);

      if (currentProspect.length === 0) {
        throw new Error(`Prospect ${prospectId} not found`);
      }

      const currentStatus = currentProspect[0]?.status ?? 'new';

      if (config.status && config.status !== currentStatus) {
        let transitionAction = '';
        if (config.status === 'contacted') transitionAction = 'CONTACT';
        else if (config.status === 'qualified') transitionAction = 'QUALIFY';
        else if (config.status === 'converted') transitionAction = 'CONVERT';
        else if (config.status === 'lost') transitionAction = 'LOSE';
        else if (config.status === 'new') transitionAction = 'REOPEN';

        if (transitionAction) {
          const canTransition = StateMachineEngine.canTransition(
            currentStatus,
            transitionAction,
            ProspectStateMachine
          );
          if (!canTransition) {
            this.logger.warn('Illegal state transition attempted', {
              from: currentStatus,
              to: config.status,
              prospectId
            });
            throw new Error(`Illegal state transition from ${currentStatus} to ${config.status}`);
          }
        }
      }

      // 3. Data Preparation — types explicites pour Drizzle
      const updateData: {
        updatedAt: Date;
        status?: string;
        score?: number;
        notes?: string;
        email?: string;
        phone?: string;
        firstName?: string;
        lastName?: string;
        metadata?: Record<string, unknown>;
      } = { updatedAt: new Date() };

      if (config.status !== undefined) updateData.status = config.status;
      if (config.score !== undefined) updateData.score = config.score;
      if (config.notes !== undefined) updateData.notes = config.notes;
      if (config.email !== undefined) updateData.email = config.email;
      if (config.phone !== undefined) updateData.phone = config.phone;
      if (config.firstName !== undefined) updateData.firstName = config.firstName;
      if (config.lastName !== undefined) updateData.lastName = config.lastName;

      if (config.metadata !== undefined) {
        updateData.metadata = {
          ...(currentProspect[0]?.metadata as Record<string, unknown> | null ?? {}),
          ...config.metadata,
          last_workflow_execution: context.event.id,
          updated_by_workflow: context.workflow.name
        };
      }

      // 4. Atomic Mutation
      await db
        .update(prospects)
        .set(updateData)
        .where(eq(prospects.id, prospectId))
        .execute();

      // 5. Audit Logging
      await AuditService.log({
        tenantId: context.tenant.id,
        userId: Number(context.event.metadata?.triggered_by) || 0,
        action: "RESOURCE_UPDATE",
        resource: "prospect",
        resourceId: prospectId,
        actorType: "system",
        source: "SYSTEM",
        metadata: {
          oldStatus: currentStatus,
          newStatus: config.status ?? currentStatus,
          fieldsUpdated: Object.keys(updateData)
        }
      });

      // Mise à jour du contexte structuré
      const updatedProspect = await db
        .select()
        .from(prospects)
        .where(eq(prospects.id, prospectId))
        .limit(1);

      context.variables.prospect = updatedProspect[0] as ProspectData;

      return {
        success: true,
        data: { prospect_id: prospectId, updated: updateData }
      };
    } catch (error: unknown) {
      this.logger.error('Failed to update lead', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  validate(_config: Record<string, unknown>): boolean {
    return true; // prospect_id peut venir du contexte
  }
}

/**
 * CREATE APPOINTMENT ACTION - HARDENED
 * Crée un rendez-vous dans le système avec idempotence et audit.
 */

import { z } from "zod";
import type { ActionHandler, ActionResult } from "../../types";
import type { FinalExecutionContext } from "../../structured-types";
import { getDb, appointments } from "../../../db";
import { Logger } from "../../utils/Logger";
import { IdempotencyService } from "../../utils/IdempotencyService";
import { AuditService } from "../../../services/auditService";

// Configuration structurée
const CreateAppointmentConfigSchema = z.object({
  prospect_id: z.number().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  scheduled_at: z.string().optional(),
  duration: z.number().optional(),
  status: z.string().optional(),
  location: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
type CreateAppointmentConfig = z.infer<typeof CreateAppointmentConfigSchema>;

// Résultat structuré
interface CreateAppointmentResult {
  appointment_id: number;
  skipped?: boolean;
}

export class CreateAppointmentAction implements ActionHandler<CreateAppointmentConfig, FinalExecutionContext, CreateAppointmentResult> {
  name = 'create_appointment';
  private logger = new Logger('CreateAppointmentAction');

  async execute(
    context: FinalExecutionContext,
    config: CreateAppointmentConfig
  ): Promise<ActionResult<CreateAppointmentResult>> {
    try {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const prospectId: number | undefined =
        config.prospect_id ?? context.variables.prospect?.id;

      // 1. Idempotency Check
      const idempotencyKey = IdempotencyService.generateKey({
        prospectId,
        title: config.title,
        scheduledAt: config.scheduled_at,
        eventId: context.event.id
      });

      const isFirstTime = await IdempotencyService.checkAndSet(idempotencyKey, 'create_appointment');
      if (!isFirstTime) {
        this.logger.info('Duplicate create_appointment detected, skipping', { prospectId });
        return { success: true, data: { appointment_id: 0, skipped: true } };
      }

      // 2. Data Preparation
      const scheduledAt = config.scheduled_at
        ? new Date(config.scheduled_at)
        : new Date(Date.now() + 24 * 60 * 60 * 1000);

      const appointmentData = {
        tenantId: context.tenant.id,
        prospectId: prospectId,
        title: config.title ?? 'Rendez-vous',
        description: config.description ?? `RDV créé par workflow: ${context.workflow.name}`,
        scheduledAt,
        duration: config.duration ?? 30,
        status: config.status ?? 'scheduled',
        location: config.location ?? '',
        metadata: {
          workflow_id: context.workflow.id,
          workflow_execution_id: context.event.id,
          created_by: 'workflow',
          ...(config.metadata ?? {}),
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // 3. Atomic Mutation
      const [result] = await db.insert(appointments).values(appointmentData).returning();
      const appointmentId = result?.id ?? 0;

      // 4. Audit Logging
      await AuditService.log({
        tenantId: context.tenant.id,
        userId: Number(context.event.metadata?.triggered_by) || 0,
        action: "RESOURCE_CREATE",
        resource: "appointment",
        resourceId: appointmentId,
        actorType: "system",
        source: "SYSTEM",
        metadata: {
          prospectId,
          scheduledAt: appointmentData.scheduledAt,
          title: appointmentData.title
        }
      });

      // Stocker le rendez-vous dans le contexte structuré
      context.variables.appointment = result as Record<string, unknown>;

      this.logger.info('Appointment created', {
        appointment_id: appointmentId,
        tenant: context.tenant.id
      });

      return { success: true, data: { appointment_id: appointmentId } };
    } catch (error: unknown) {
      this.logger.error('Failed to create appointment', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  validate(_config: Record<string, unknown>): boolean {
    return true;
  }
}

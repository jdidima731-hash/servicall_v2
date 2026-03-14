import { z } from "zod";
import { router, protectedProcedure } from "../procedures";
import { AppointmentReminderService } from "../services/appointmentReminderService";
import { TRPCError } from "@trpc/server";
import { logger } from "../infrastructure/logger";

/**
 * Router pour les rappels de rendez-vous
 */

export const appointmentReminderRouter = router({
  /**
   * Crée les rappels pour un rendez-vous
   */
  createForAppointment: protectedProcedure
    .input(
      z.object({
        appointmentId: z.number().int().positive(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { appointmentId } = input;

      // Vérifier les permissions
      const db = await import("../db").then(m => m.getDb());
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      const { appointments } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const appointmentResults = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, appointmentId))
        .limit(1);

      if (appointmentResults.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Appointment not found",
        });
      }

      const appointment = appointmentResults[0] ?? undefined;
      if (!appointment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Appointment not found after initial check",
        });
      }

      if (appointment.tenantId !== ctx.tenantId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this appointment",
        });
      }

      const success = await AppointmentReminderService.createRemindersForAppointment(appointmentId);

      if (!success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create reminders",
        });
      }

      return {
        success: true,
        message: "Reminders created successfully",
      };
    }),

  /**
   * Récupère les rappels d'un rendez-vous
   */
  getForAppointment: protectedProcedure
    .input(
      z.object({
        appointmentId: z.number().int().positive(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { appointmentId } = input;

      try {
        // Vérifier les permissions
        const db = await import("../db").then(m => m.getDb());
        if (!db) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Base de données non disponible",
          });
        }

        const { appointments } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");

        const appointmentResults = await db
          .select()
          .from(appointments)
          .where(eq(appointments.id, appointmentId))
          .limit(1);

        if (appointmentResults.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Rendez-vous non trouvé",
          });
        }

        const appointment = appointmentResults[0] ?? undefined;
      if (!appointment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Appointment not found after initial check",
        });
      }

        if (appointment.tenantId !== ctx.tenantId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Vous n'avez pas accès à ce rendez-vous",
          });
        }

        const reminders = await AppointmentReminderService.getRemindersForAppointment(appointmentId);

        return {
          reminders: reminders || [],
          total: reminders?.length ?? 0,
        };
      } catch (error: unknown) {
        if (error instanceof TRPCError) {
          throw error;
        }
        logger.error("[AppointmentReminder] Error getting reminders", { error, appointmentId });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la récupération des rappels",
        });
      }
    }),

  /**
   * Récupère les statistiques des rappels
   */
  getStatistics: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Tenant ID is required",
      });
    }
    const stats = await AppointmentReminderService.getStatistics(ctx.tenantId);

    if (!stats) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get statistics",
      });
    }

    return stats;
  }),
});

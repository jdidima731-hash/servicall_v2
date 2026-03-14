import { router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import * as googleCalendarService from "../services/googleCalendarService";
import * as notificationService from "../services/notificationService";
import { tenantProcedure, managerProcedure } from "../procedures";
import { normalizeResponse, normalizeDbRecords } from "../_core/responseNormalizer";
import { paginationInput, paginate } from "../_core/pagination";
import { count, eq, desc } from "drizzle-orm";

export const appointmentRouter = router({
  /**
   * List appointments
   */
  list: tenantProcedure
    .input(paginationInput.extend({
      month: z.number().optional(),
      year: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "BAD_REQUEST" });
      const { page, limit } = input;
      const offset = (page - 1) * limit;

      try {
        const [appointments, totalResult] = await Promise.all([
          db.db.select().from(db.appointments)
            .where(eq(db.appointments.tenantId, ctx.tenantId))
            .limit(limit)
            .offset(offset)
            .orderBy(desc(db.appointments.scheduledAt)),
          db.db.select({ value: count() })
            .from(db.appointments)
            .where(eq(db.appointments.tenantId, ctx.tenantId))
        ]);
        
        const normalizedData = normalizeDbRecords(appointments);
        return paginate(normalizedData, totalResult[0]?.value ?? 0, input);
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        console.error("[Appointment Router] Error listing appointments:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la récupération des rendez-vous",
        });
      }
    }),

  /**
   * Create appointment
   */
  create: tenantProcedure // Agents can create appointments
    .input(
      z.object({
        title: z.string(),
        description: z.string().optional(),
        startTime: z.date(),
        endTime: z.date(),
        prospectId: z.number().optional(),
        location: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      if (!ctx.tenantId) throw new TRPCError({ code: "BAD_REQUEST" });

      try {
        const appointmentResult = await db.createAppointment({
          tenantId: ctx.tenantId,
          prospectId: input.prospectId,
          agentId: ctx.user.id,
          title: input.title,
          description: input.description,
          scheduledAt: input.startTime, // map startTime → scheduledAt
          location: input.location,
        });

        const appointmentId = appointmentResult.id;

        // Background tasks: Sync and Notify
        const prospect = input.prospectId ? await db.getProspectById(input.prospectId, ctx.tenantId) : null;
        
        // 1. Google Calendar Sync
        const googleToken = ctx.req?.googleAccessToken;
        if (googleToken && appointmentId) {
          const googleEventId = await googleCalendarService.createGoogleEvent(googleToken, {
            title: input.title,
            description: input.description,
            startTime: input.startTime,
            endTime: input.endTime,
            location: input.location,
            prospectEmail: prospect?.email || undefined,
          });
          if (googleEventId) {
            // Store googleEventId in metadata since the column doesn't exist
            await db.updateAppointment(appointmentId, { metadata: { googleEventId } });
          }
        }

        // 2. Notifications
        if (prospect) {
          if (prospect.phone) {
            notificationService.sendAppointmentSMS(prospect.phone, {
              title: input.title,
              startTime: input.startTime,
              location: input.location,
            }).catch(console.error);
          }
          if (prospect.email) {
            notificationService.sendAppointmentEmail(prospect.email, {
              title: input.title,
              startTime: input.startTime,
              endTime: input.endTime,
              description: input.description,
              location: input.location,
            }).catch(console.error);
          }
        }

        return normalizeResponse({ success: true, appointmentId }, 'appointment.create');
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        console.error("[Appointment Router] Error creating appointment:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la création du rendez-vous",
        });
      }
    }),

  /**
   * Update appointment
   */
  update: managerProcedure // Restricted to manager
    .input(
      z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        startTime: z.date().optional(),
        endTime: z.date().optional(),
        status: z.enum(["scheduled", "confirmed", "completed", "cancelled"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "BAD_REQUEST" });
      try {
        // Verify ownership
        const appointment = await db.getAppointmentById(input.id, ctx.tenantId);
        if (!appointment) throw new TRPCError({ code: "NOT_FOUND" });

        const updated = await db.updateAppointment(input.id, {
          title: input.title,
          description: input.description,
          scheduledAt: input.startTime, // map startTime → scheduledAt
          status: input.status,
        });

        return normalizeResponse(updated, 'appointment.update');
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        console.error("[Appointment Router] Error updating appointment:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la mise à jour du rendez-vous",
        });
      }
    }),

  /**
   * Delete appointment
   */
  delete: managerProcedure // Restricted to manager
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "BAD_REQUEST" });
      try {
        // Verify ownership
        const appointment = await db.getAppointmentById(input.id, ctx.tenantId);
        if (!appointment) throw new TRPCError({ code: "NOT_FOUND" });

        await db.deleteAppointment(input.id, ctx.tenantId);
        return normalizeResponse({ success: true }, 'appointment.delete');
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        console.error("[Appointment Router] Error deleting appointment:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la suppression du rendez-vous",
        });
      }
    }),

  /**
   * Get badge count for sidebar (today's appointments count)
   */
  getBadgeCount: tenantProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) throw new TRPCError({ code: "BAD_REQUEST" });
    try {
      // Un agent ne voit que ses propres rendez-vous
      const agentId = ctx.user?.role === "agent" ? ctx.user.id : undefined;
      const countValue = await db.countTodayAppointments(ctx.tenantId, agentId);
      
      return countValue;
    } catch (error: unknown) {
      console.error("[Appointment Router] Error getting badge count", {
        error: error instanceof Error ? error.message : String(error),
        tenantId: ctx.tenantId,
      });
      return 0; // Fallback gracieux
    }
  }),
});

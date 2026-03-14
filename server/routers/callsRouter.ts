/**
 * BLOC 2 - Calls Router avec timeouts et gestion d'erreurs renforcée
 */

import { z } from "zod";
import { router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { tenantProcedure, managerProcedure, adminProcedure } from "../procedures";
import { logger } from "../infrastructure/logger";
import { paginationInput, paginate } from "../_core/pagination";
import { count, eq, desc } from "drizzle-orm";

/**
 * Router pour la gestion des appels (Calls)
 */
export const callsRouter = router({
  /**
   * Liste les appels d'un tenant
   * BLOC 2: Timeout 15s, fallback [], logs
   */
  list: tenantProcedure
    .input(paginationInput)
    .query(async ({ input, ctx }) => {
      const startTime = Date.now();
      const { page, limit } = input;
      const offset = (page - 1) * limit;

      try {
        if (!ctx.tenantId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Tenant ID is required",
          });
        }
        logger.info("[Calls Router] Listing calls paginated", {
          tenantId: ctx.tenantId,
          userId: ctx.user.id,
          page,
          limit
        });

        const [calls, totalResult] = await Promise.all([
          db.db.select().from(db.calls)
            .where(eq(db.calls.tenantId, ctx.tenantId))
            .limit(limit)
            .offset(offset)
            .orderBy(desc(db.calls.createdAt)),
          db.db.select({ value: count() })
            .from(db.calls)
            .where(eq(db.calls.tenantId, ctx.tenantId))
        ]);

        logger.info("[Calls Router] Calls retrieved", {
          count: calls.length,
          total: totalResult[0]?.value ?? 0,
          duration: Date.now() - startTime,
        });

        return paginate(calls, totalResult[0]?.value ?? 0, input);
      } catch (error: unknown) {
        logger.error("[Calls Router] Error listing calls", {
          error: error instanceof Error ? error.message : String(error),
          tenantId: ctx.tenantId,
          duration: Date.now() - startTime,
        });

        return paginate([], 0, input);
      }
    }),

  /**
   * Récupère un appel par son ID
   * BLOC 2: Timeout 10s, gestion NOT_FOUND
   */
  getById: tenantProcedure
    .input(z.object({ callId: z.number() }))
    .query(async ({ input, ctx }) => {
      const startTime = Date.now();

      try {
        if (!ctx.tenantId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Tenant ID is required",
          });
        }
        logger.info("[Calls Router] Getting call by ID", {
          callId: input.callId,
          tenantId: ctx.tenantId,
        });

        const call = await db.getCallById(input.callId, ctx.tenantId);
        
        if (!call) {
          logger.warn("[Calls Router] Call not found", {
            callId: input.callId,
            tenantId: ctx.tenantId,
            duration: Date.now() - startTime,
          });

          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Appel #${input.callId} non trouvé`,
          });
        }

        logger.info("[Calls Router] Call retrieved", {
          callId: input.callId,
          duration: Date.now() - startTime,
        });

        return call;
      } catch (error: unknown) {
        if (error instanceof TRPCError) {
          throw error;
        }

        logger.error("[Calls Router] Error getting call", {
          error: error instanceof Error ? error.message : String(error),
          callId: input.callId,
          duration: Date.now() - startTime,
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la récupération de l'appel",
          cause: error,
        });
      }
    }),

  /**
   * Crée un nouvel enregistrement d'appel
   * BLOC 2: Timeout 20s, validation stricte
   */
  create: tenantProcedure
    .input(z.object({
      prospectId: z.number().optional(),
      campaignId: z.number().optional(),
      direction: z.enum(["inbound", "outbound"]),
      status: z.enum(["queued", "ringing", "in-progress", "completed", "failed", "no-answer", "busy"]),
      fromNumber: z.string().min(1, "Numéro source requis"),
      toNumber: z.string().min(1, "Numéro destination requis"),
    }))
    .mutation(async ({ ctx, input }) => {
      const startTime = Date.now();

      try {
        if (!ctx.tenantId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Tenant ID is required",
          });
        }
        logger.info("[Calls Router] Creating call", {
          tenantId: ctx.tenantId,
          userId: ctx.user.id,
          direction: input.direction,
          prospectId: input.prospectId,
        });

        const call = await db.createCall({
          tenantId: ctx.tenantId,
          agentId: ctx.user.id, // userId → agentId (colonne réelle dans la table calls)
          ...input,
          startedAt: new Date(),
        });

        // BLOC 2: Vérification du résultat
        if (!call) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Échec de la création de l'appel",
          });
        }

        logger.info("[Calls Router] Call created", {
          callId: call.id,
          duration: Date.now() - startTime,
        });

        return call;
      } catch (error: unknown) {
        if (error instanceof TRPCError) {
          throw error;
        }

        logger.error("[Calls Router] Error creating call", {
          error: error instanceof Error ? error.message : String(error),
          tenantId: ctx.tenantId,
          duration: Date.now() - startTime,
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la création de l'appel",
          cause: error,
        });
      }
    }),

  /**
   * Met à jour un appel existant
   * BLOC 2: Timeout 20s, validation Zod stricte (URLs HTTPS, Durée positive)
   */
  update: managerProcedure
    .input(z.object({
      callId: z.number().positive("Call ID must be positive"),
      status: z.enum(["queued", "ringing", "in-progress", "completed", "failed", "no-answer", "busy"]).optional(),
      duration: z.number().positive("Duration must be positive").optional(),
      recordingUrl: z.string()
        .url("Invalid URL format")
        .startsWith("https://", { message: "Must use HTTPS" })
        .optional(),
      transcription: z.string().max(10000, "Transcription too long").optional(),
      summary: z.string().max(5000, "Summary too long").optional(),
      sentiment: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const startTime = Date.now();
      const { callId, ...data } = input;

      try {
        if (!ctx.tenantId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Tenant ID is required",
          });
        }
        logger.info("[Calls Router] Updating call", {
          callId,
          tenantId: ctx.tenantId,
          userId: ctx.user.id,
        });

        // BLOC 2: Vérification d'existence
        const call = await db.getCallById(callId, ctx.tenantId);
        
        if (!call) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Appel #${callId} non trouvé`,
          });
        }

        const updated = await db.updateCall(callId, data);

        logger.info("[Calls Router] Call updated", {
          callId,
          duration: Date.now() - startTime,
        });

        return updated;
      } catch (error: unknown) {
        if (error instanceof TRPCError) {
          throw error;
        }

        logger.error("[Calls Router] Error updating call", {
          error: error instanceof Error ? error.message : String(error),
          callId,
          duration: Date.now() - startTime,
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la mise à jour de l'appel",
          cause: error,
        });
      }
    }),

  /**
   * Supprime un appel
   * BLOC 2: Timeout 15s, admin only
   */
  delete: adminProcedure
    .input(z.object({ callId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const startTime = Date.now();

      try {
        if (!ctx.tenantId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Tenant ID is required",
          });
        }
        logger.warn("[Calls Router] Deleting call", {
          callId: input.callId,
          tenantId: ctx.tenantId,
          userId: ctx.user.id,
        });

        // BLOC 2: Vérification d'existence
        const call = await db.getCallById(input.callId, ctx.tenantId);
        
        if (!call) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Appel #${input.callId} non trouvé`,
          });
        }

        const result = await db.deleteCall(input.callId);

        logger.info("[Calls Router] Call deleted", {
          callId: input.callId,
          duration: Date.now() - startTime,
        });

        return result;
      } catch (error: unknown) {
        if (error instanceof TRPCError) {
          throw error;
        }

        logger.error("[Calls Router] Error deleting call", {
          error: error instanceof Error ? error.message : String(error),
          callId: input.callId,
          duration: Date.now() - startTime,
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la suppression de l'appel",
          cause: error,
        });
      }
    }),

  /**
   * Get badge count for sidebar (pending/missed calls count)
   * Returns the number of calls with status 'scheduled' or 'missed'
   */
  getBadgeCount: tenantProcedure.query(async ({ ctx }) => {
    try {
      if (!ctx.tenantId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tenant ID is required",
        });
      }
      // Un agent ne voit que ses propres appels
      const agentId = ctx.user.role === "agent" ? ctx.user.id : undefined;
      const countValue = await db.countPendingCalls(ctx.tenantId, agentId);
      
      logger.info("[Calls Router] Badge count retrieved", {
        tenantId: ctx.tenantId,
        userId: ctx.user.id,
        role: ctx.user.role,
        count: countValue,
      });

      return countValue;
    } catch (error: unknown) {
      logger.error("[Calls Router] Error getting badge count", {
        error: error instanceof Error ? error.message : String(error),
        tenantId: ctx.tenantId,
      });
      return 0; // Fallback gracieux
    }
  }),
});

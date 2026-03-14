import { z } from "zod";
import { router, protectedProcedure } from "../procedures";
import { CallScoringService } from "../services/callScoringService";
import { addJob } from "../services/queueService";
import { TRPCError } from "@trpc/server";
import { logger } from "../infrastructure/logger";

/**
 * Router pour le scoring des appels
 * ✅ AXE 3: Scoring 100% asynchrone via BullMQ
 */

export const callScoringRouter = router({
  /**
   * Score un appel spécifique (Asynchrone)
   */
  scoreCall: protectedProcedure
    .input(
      z.object({
        callId: z.number().int().positive(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { callId } = input;

      // 1. Vérifier que l'appel existe et appartient au tenant
      const db = await import("../db").then(m => m.getDb());
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      const { calls } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const callResults = await db
        .select()
        .from(calls)
        .where(eq(calls.id, callId))
        .limit(1);

      if (callResults.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Call not found",
        });
      }

      const call = callResults[0] ?? undefined;
      if (!call) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Call not found after initial check",
        });
      }

      if (call.tenantId !== ctx.tenantId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this call",
        });
      }

      // 2. ✅ AXE 3: Ajouter le job de scoring à la queue BullMQ au lieu de l'exécuter en synchrone
      try {
        await addJob("call-analysis", {
          callId,
          tenantId: ctx.tenantId,
          timestamp: new Date()
        });
        
        logger.info("[CallScoringRouter] Scoring job queued", { callId, tenantId: ctx.tenantId ?? undefined });
      } catch (error: unknown) {
        logger.error("[CallScoringRouter] Failed to queue scoring job", { error, callId });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Impossible de mettre l'analyse en file d'attente",
        });
      }

      return {
        success: true,
        message: "L'analyse de l'appel a été mise en file d'attente.",
        status: "queued"
      };
    }),

  /**
   * Récupère le score d'un appel
   */
  getScore: protectedProcedure
    .input(
      z.object({
        callId: z.number().int().positive(),
      })
    )
    .query(async ({input}) => {
      const { callId } = input;

      const score = await CallScoringService.getScore(callId);

      if (!score) {
        return { status: "pending", message: "Le score est en cours de calcul ou indisponible." };
      }

      return { status: "completed", ...score };
    }),

  /**
   * Liste tous les scores pour le tenant courant
   */
  listScores: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().positive().max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      const { limit, offset } = input;
      if (!ctx.tenantId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tenant ID is required",
        });
      }
      const scores = await CallScoringService.listScores(ctx.tenantId, limit, offset);
      return { scores, total: scores.length };
    }),

  /**
   * Récupère le score moyen pour le tenant
   */
  getAverageScore: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Tenant ID is required",
      });
    }
    const averageScore = await CallScoringService.getAverageScore(ctx.tenantId);
    return { averageScore, tenantId: ctx.tenantId };
  }),
});

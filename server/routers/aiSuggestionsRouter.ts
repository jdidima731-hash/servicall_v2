/**
 * BLOC 3 - AI Suggestions Router
 * Expose les fonctionnalités du Shadow Agent au frontend
 */

import { router } from "../_core/trpc";
import { z } from "zod";
import { ShadowAgentService } from "../services/shadowAgentService";
import { tenantProcedure } from "../procedures";
import { TRPCError } from "@trpc/server";

export const aiSuggestionsRouter = router({
  /**
   * Récupérer les suggestions en attente
   */
  getPending: tenantProcedure
    .input(z.object({
      tenantId: z.number(),
    }))
    .query(async ({ input }) => {
      try {
        return await ShadowAgentService.getPendingSuggestions(input.tenantId);
      } catch (error: unknown) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erreur lors de la récupération des suggestions",
        });
      }
    }),

  /**
   * Déclencher la détection d'appels manqués
   */
  detectMissedCalls: tenantProcedure
    .input(z.object({
      tenantId: z.number(),
    }))
    .mutation(async ({ input }) => {
      try {
        return await ShadowAgentService.detectMissedCallsAndSuggest(input.tenantId);
      } catch (error: unknown) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erreur lors de la détection",
        });
      }
    }),

  /**
   * Approuver une suggestion
   */
  approve: tenantProcedure
    .input(z.object({
      tenantId: z.number(),
      suggestionId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await ShadowAgentService.approveSuggestion(
          input.suggestionId,
          input.tenantId,
          ctx.user.id
        );
      } catch (error: unknown) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erreur lors de l'approbation",
        });
      }
    }),

  /**
   * Rejeter une suggestion
   */
  reject: tenantProcedure
    .input(z.object({
      tenantId: z.number(),
      suggestionId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await ShadowAgentService.rejectSuggestion(
          input.suggestionId,
          input.tenantId,
          ctx.user.id
        );
      } catch (error: unknown) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erreur lors du rejet",
        });
      }
    }),

  /**
   * Modifier une suggestion
   */
  modify: tenantProcedure
    .input(z.object({
      tenantId: z.number(),
      suggestionId: z.number(),
      newContent: z.string().min(1).max(500),
    }))
    .mutation(async ({ input }) => {
      try {
        return await ShadowAgentService.modifySuggestion(
          input.suggestionId,
          input.tenantId,
          input.newContent
        );
      } catch (error: unknown) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Erreur lors de la modification",
        });
      }
    }),
});

import { z } from "zod";
import { router } from "../_core/trpc";
import { adminProcedure, protectedProcedure } from "../procedures";
import {
  forceHumanAgent,
  forceAIAgent,
  getAgentType,
  getAgentSwitchHistory,
  getTenantAgentSwitchHistory,
} from "../services/agentSwitchService";
import { logger } from "../infrastructure/logger";
import { TRPCError } from "@trpc/server";

/**
 * Router pour la gestion de la bascule Agent IA ↔ Agent Humain
 */
export const agentSwitchRouter = router({
  /**
   * Force la bascule vers un agent humain
   */
  forceHuman: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        tenantId: z.number(),
        reason: z.string().optional(),
        callId: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        await forceHumanAgent(
          input.userId,
          input.tenantId,
          ctx.user.id,
          input.reason,
          input.callId
        );

        logger.info("[AgentSwitchRouter] Forced human agent", {
          userId: input.userId,
          triggeredBy: ctx.user.id,
        });

        return {
          success: true,
          message: "Agent switched to HUMAN successfully",
        };
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        logger.error("[AgentSwitchRouter] Failed to force human agent", { error });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to switch to human agent",
        });
      }
    }),

  /**
   * Force la bascule vers un agent IA
   */
  forceAI: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        tenantId: z.number(),
        reason: z.string().optional(),
        callId: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        await forceAIAgent(
          input.userId,
          input.tenantId,
          ctx.user.id,
          input.reason,
          input.callId
        );

        logger.info("[AgentSwitchRouter] Forced AI agent", {
          userId: input.userId,
          triggeredBy: ctx.user.id,
        });

        return {
          success: true,
          message: "Agent switched to AI successfully",
        };
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        logger.error("[AgentSwitchRouter] Failed to force AI agent", { error });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to switch to AI agent",
        });
      }
    }),

  /**
   * Récupère le type d'agent actuel d'un utilisateur
   */
  getAgentType: protectedProcedure
    .input(
      z.object({
        userId: z.number(),
      })
    )
    .query(async ({ input }) => {
      try {
        const agentType = await getAgentType(input.userId);

        return {
          userId: input.userId,
          agentType: agentType ?? "AI",
        };
      } catch (error: unknown) {
        logger.error("[AgentSwitchRouter] Failed to get agent type", { error });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get agent type",
        });
      }
    }),

  /**
   * Récupère l'historique des bascules pour un utilisateur
   */
  getUserHistory: protectedProcedure
    .input(
      z.object({
        userId: z.number(),
        limit: z.number().optional().default(50),
      })
    )
    .query(async ({ input }) => {
      try {
        const history = await getAgentSwitchHistory(input.userId, input.limit);

        return {
          userId: input.userId,
          history,
        };
      } catch (error: unknown) {
        logger.error("[AgentSwitchRouter] Failed to get user history", { error });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get switch history",
        });
      }
    }),

  /**
   * Récupère l'historique des bascules pour un tenant (admin only)
   */
  getTenantHistory: adminProcedure
    .input(
      z.object({
        tenantId: z.number(),
        limit: z.number().optional().default(100),
      })
    )
    .query(async ({ input }) => {
      try {
        const history = await getTenantAgentSwitchHistory(input.tenantId, input.limit);

        return {
          tenantId: input.tenantId,
          history,
        };
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        logger.error("[AgentSwitchRouter] Failed to get tenant history", { error });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get tenant switch history",
        });
      }
    }),
});

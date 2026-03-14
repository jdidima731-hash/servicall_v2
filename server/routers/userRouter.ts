import { z } from "zod";
import { router } from "../_core/trpc";
import { adminProcedure, managerProcedure } from "../procedures";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { logger } from "../infrastructure/logger";
import { paginationInput, paginate } from "../_core/pagination";

export const userRouter = router({
  /**
   * Liste tous les membres de l'équipe pour le tenant actuel
   */
  getTeamMembers: managerProcedure
    .input(paginationInput)
    .query(async ({ ctx, input }) => {
      const { page, limit } = input;
      const offset = (page - 1) * limit;

      try {
        if (!ctx.tenantId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Tenant ID is required" });
        }
        const members = await db.getTenantMembers(ctx.tenantId);
        // getTenantMembers ne supporte pas nativement limit/offset dans db.ts, 
        // on applique la pagination sur le tableau pour respecter l'interface
        const total = members.length;
        const paginatedMembers = members.slice(offset, offset + limit);

        const data = paginatedMembers.map((m) => ({
          id: m.id,
          name: m.name,
          email: m.email,
          role: m.role,
          isActive: m.isActive,
        }));

        return paginate(data, total, input);
      } catch (error: unknown) {
        logger.error("[UserRouter] Failed to get team members", { error, tenantId: ctx.tenantId });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get team members" });
      }
    }),

  /**
   * Invite un nouvel utilisateur ou l'ajoute au tenant
   */
  inviteMember: adminProcedure
    .input(z.object({
      email: z.string().email(),
      name: z.string().min(1),
      role: z.enum(["admin", "manager", "agent", "viewer"]),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        if (!ctx.tenantId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Tenant ID is required" });
        }
        // 1. Vérifier si l'utilisateur existe déjà
        let user = await db.getUserByEmail(input.email);
        
        if (!user) {
          // Dans un vrai SaaS, on enverrait un email d'invitation
          // Ici, on crée l'utilisateur avec un mot de passe temporaire ou on simule l'invitation
          const [result] = await db.createUser({
            email: input.email,
            name: input.name,
            openId: `invited-${Date.now()}`,
            role: "user", // Rôle global par défaut
          });
          user = result ?? undefined;
        }

        if (!user) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create or find user' });

        // 2. Ajouter l'utilisateur au tenant
        await db.addUserToTenant(user.id, ctx.tenantId, input.role);

        logger.info("[UserRouter] Member invited", { 
          tenantId: ctx.tenantId, 
          invitedEmail: input.email,
          role: input.role 
        });

        return { success: true };
      } catch (error: unknown) {
        logger.error("[UserRouter] Failed to invite member", { error, tenantId: ctx.tenantId });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to invite member" });
      }
    }),

  /**
   * Met à jour le rôle ou le statut d'un membre
   */
  updateMember: adminProcedure
    .input(z.object({
      userId: z.number(),
      role: z.enum(["admin", "manager", "agent", "viewer"]).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        if (!ctx.tenantId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Tenant ID is required" });
        }
        await db.updateTenantUser(input.userId, ctx.tenantId, {
          role: input.role,
          isActive: input.isActive,
        });
        return { success: true };
      } catch (error: unknown) {
        logger.error("[UserRouter] Failed to update member", { error, userId: input.userId });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update member" });
      }
    }),

  /**
   * Récupère les KPIs de l'équipe pour les managers
   */
  getTeamKPIs: managerProcedure.query(async ({ ctx }) => {
    try {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Tenant ID is required" });
      }
      const members = await db.getTenantMembers(ctx.tenantId);
      const activeAgents = members.filter((m) => m.role === "agent" && m.isActive).length;
      
      // Simulation de KPIs agrégés
      return {
        totalMembers: members.length,
        activeAgents,
        teamPerformance: 85, // %
        alerts: [
          { id: 1, type: "warning", message: "Agent Smith est inactif depuis 2h" },
          { id: 2, type: "info", message: "Objectif hebdomadaire atteint à 70%" }
        ]
      };
    } catch (error: unknown) {
      logger.error("[UserRouter] Failed to get team KPIs", { error, tenantId: ctx.tenantId });
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get team KPIs" });
    }
  }),
});

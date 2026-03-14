/**
 * Tenant Router - Gestion des tenants et changement de contexte
 */

import { router, protectedProcedure } from "../procedures";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { switchTenant, initializeDefaultTenant } from "../services/tenantService";
import { logger } from "../infrastructure/logger";
import { tenantProcedure, adminProcedure } from "../procedures";

export const tenantRouter = router({
  /**
   * Récupère un tenant par son ID
   */
  getById: tenantProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ input }) => {
      return await db.getTenantById(input.tenantId);
    }),

  /**
   * Liste tous les tenants (alias pour compatibilité)
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    if (process.env['DB_ENABLED'] === "false") {
      return [{
        id: 1,
        name: "Demo Tenant",
        slug: "demo",
        role: "admin",
        isActive: true,
      }];
    }
    return await db.getUserTenants(ctx.user.id);
  }),

  /**
   * Crée un nouveau tenant
   */
  create: adminProcedure // Restricted to admin
    .input(z.object({
      name: z.string().min(1),
      slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
      phoneNumber: z.string().optional(),
      timezone: z.string().default("UTC"),
      language: z.string().default("fr"),
    }))
    .mutation(async ({ ctx, input }) => {
      // 1. Create the tenant
      const tenants = await db.createTenant({
        name: input.name,
        slug: input.slug,
        settings: { timezone: input.timezone, language: input.language },
      });
      const newTenant = tenants[0];
      if (!newTenant) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create tenant" });
      const tenantId = newTenant.id;

      // 2. Add the current user as the default admin for this tenant
      await db.addUserToTenant(ctx.user.id, tenantId, "admin");

      return await db.getTenantById(tenantId);
    }),

  /**
   * Met à jour un tenant existant
   */
  update: adminProcedure // Restricted to admin
    .input(z.object({
      name: z.string().optional(),
      phoneNumber: z.string().optional(),
      timezone: z.string().optional(),
      language: z.string().optional(),
      logo: z.string().optional(),
      branding: z.any().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.updateTenant(ctx.tenantId, input);
      return await db.getTenantById(ctx.tenantId);
    }),

  /**
   * Obtenir la liste des tenants de l'utilisateur
   */
  getUserTenants: protectedProcedure.query(async ({ ctx }) => {
    let tenants;
    if (process.env['DB_ENABLED'] === "false") {
      tenants = [{
        id: 1,
        name: "Demo Tenant",
        slug: "demo",
        role: "admin",
        isActive: true,
      }];
    } else {
      tenants = await db.getUserTenants(ctx.user.id);
    }

    logger.info("User tenants retrieved", {
      userId: ctx.user.id,
      tenantCount: tenants.length,
    });

    return {
      tenants: tenants.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        role: t.role,
        isActive: t.isActive,
      })),
      currentTenantId: ctx.tenantId ?? 1,
    };
  }),

  /**
   * Obtenir le tenant actuel
   */
  getCurrentTenant: tenantProcedure.query(async ({ ctx }) => {
    const tenant = await db.getTenantById(ctx.tenantId);

    if (!tenant) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Tenant introuvable",
      });
    }

    logger.debug("Current tenant retrieved", {
      tenantId: ctx.tenantId,
      userId: ctx.user.id,
    });

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        isActive: tenant.isActive,
      },
    };
  }),

  /**
   * Changer de tenant
   */
  switchTenant: protectedProcedure
    .input(
      z.object({
        tenantId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await switchTenant(ctx.user.id, input.tenantId, ctx.res);

      if (!result.success) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: result.error || "Impossible de changer de tenant",
        });
      }

      logger.info("Tenant switched", {
        userId: ctx.user.id,
        tenantId: input.tenantId,
      });

      return {
        success: true,
        tenantId: input.tenantId,
      };
    }),

  /**
   * Initialiser le tenant par défaut (appelé après login)
   */
  initializeDefaultTenant: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await initializeDefaultTenant(ctx.user.id, ctx.res);

    if (!result) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Aucun tenant disponible pour cet utilisateur",
      });
    }

    logger.info("Default tenant initialized", {
      userId: ctx.user.id,
      tenantId: result.tenantId,
      role: result.role,
    });

    return {
      success: true,
      tenantId: result.tenantId,
      role: result.role,
    };
  }),

  /**
   * Mettre à jour les paramètres du tenant
   */
  updateSettings: adminProcedure // Restricted to admin
    .input(z.object({
      name: z.string().optional(),
      timezone: z.string().optional(),
      language: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.updateTenant(ctx.tenantId, input);
      return { success: true };
    }),

  /**
   * Mettre à jour la configuration métier du tenant
   */
  updateBusinessConfig: adminProcedure
    .input(z.object({
      businessType: z.enum([
        "restaurant",
        "hotel",
        "real_estate",
        "clinic",
        "ecommerce",
        "artisan",
        "call_center",
        "generic"
      ]).optional(),
      aiCustomScript: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.updateTenant(ctx.tenantId, {
        businessType: input.businessType,
        aiCustomScript: input.aiCustomScript,
      });
      
      logger.info("[TenantRouter] Business config updated", {
        tenantId: ctx.tenantId,
        businessType: input.businessType,
        hasCustomScript: !!input.aiCustomScript,
      });
      
      return { success: true };
    }),

  /**
   * Récupérer la configuration métier du tenant
   */
  getBusinessConfig: tenantProcedure.query(async ({ ctx }) => {
    const tenant = await db.getTenantById(ctx.tenantId);
    
    if (!tenant) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Tenant not found",
      });
    }
    
    return {
      businessType: tenant.businessType ?? null,
      aiCustomScript: tenant.aiCustomScript ?? null,
    };
  }),
});

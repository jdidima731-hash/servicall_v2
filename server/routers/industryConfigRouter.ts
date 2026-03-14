/**
 * INDUSTRY CONFIG ROUTER
 * Endpoints tRPC pour la gestion de la configuration métier et des clés OpenAI
 */

import { router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "../procedures";
import { logger } from "../infrastructure/logger";
import * as tenantIndustryService from "../services/tenantIndustryService";
import * as tenantAiKeyService from "../services/tenantAiKeyService";
import { AuditService } from "../services/auditService";

export const industryConfigRouter = router({
  /**
   * Récupère le catalogue complet des métiers
   * ✅ CORRECTION: Utilise protectedProcedure car le catalogue est global
   */
  getCatalog: protectedProcedure.query(async () => {
    try {
      const catalog = tenantIndustryService.getIndustriesCatalog();
      return {
        success: true,
        data: catalog,
      };
    } catch (error: unknown) {
      logger.error("[Industry Config Router] Error getting catalog", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Impossible de récupérer le catalogue des métiers",
      });
    }
  }),

  /**
   * Récupère les métiers groupés par catégorie
   * ✅ CORRECTION: Utilise protectedProcedure car les métiers sont globaux
   */
  getIndustriesByCategory: protectedProcedure.query(async () => {
    try {
      const industries = tenantIndustryService.getIndustriesByCategory();
      return {
        success: true,
        data: industries,
      };
    } catch (error: unknown) {
      logger.error("[Industry Config Router] Error getting industries by category", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Impossible de récupérer les métiers",
      });
    }
  }),

  /**
   * Récupère les détails d'un métier spécifique
   * ✅ CORRECTION: Utilise protectedProcedure car les détails sont globaux
   */
  getIndustryDetails: protectedProcedure
    .input(z.object({ industryId: z.string() }))
    .query(async ({ input }) => {
      try {
        const industry = tenantIndustryService.getIndustryDetails(input.industryId);
        return {
          success: true,
          data: industry,
        };
      } catch (error: unknown) {
        logger.error("[Industry Config Router] Error getting industry details", error);
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Métier non trouvé",
        });
      }
    }),

  /**
   * Récupère la configuration métier du tenant actuel
   * ✅ CORRECTION: Utilise protectedProcedure et récupère tenantId du contexte
   */
  getCurrentConfig: protectedProcedure.query(async ({ ctx }) => {
    try {
      // ✅ BLOC 1: Récupérer le tenantId depuis le contexte (validation stricte)
      const tenantId = ctx.tenantId;
      if (!tenantId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Accès refusé : aucun tenant associé à votre session",
        });
      }
      const config = await tenantIndustryService.getTenantIndustryConfig(tenantId);
      return {
        success: true,
        data: config,
      };
    } catch (error: unknown) {
      logger.error("[Industry Config Router] Error getting current config", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Impossible de récupérer la configuration",
      });
    }
  }),

  /**
   * Définit la configuration métier du tenant
   * ✅ CORRECTION: Utilise protectedProcedure avec input tenantId optionnel
   */
  setConfig: protectedProcedure
    .input(
      z.object({
        tenantId: z.number().optional(),
        industryId: z.string(),
        enabledCapabilities: z.array(z.string()).optional(),
        enabledWorkflows: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // ✅ BLOC 1: Récupérer le tenantId (validation stricte)
        const tenantId = input.tenantId || ctx.tenantId;
        if (!tenantId) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Accès refusé : aucun tenant associé à votre session",
          });
        }
        
        // Vérifier les permissions (manager ou admin)
        const userRole = ctx.user.role;
        if (!['admin', 'manager', 'superadmin'].includes(userRole)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Accès réservé aux managers et administrateurs",
          });
        }
        if (input.tenantId && input.tenantId !== ctx.tenantId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Accès refusé : vous ne pouvez pas modifier la configuration d'un autre tenant",
          });
        }
        
        const config = await tenantIndustryService.setTenantIndustryConfig(
          tenantId,
          input.industryId,
          input.enabledCapabilities || [],
          input.enabledWorkflows || []
        );

        logger.info("[Industry Config Router] Industry config updated", {
          tenantId: tenantId,
          userId: ctx.user.id,
          industryId: input.industryId,
        });

        return {
          success: true,
          data: config,
        };
      } catch (error: unknown) {
        logger.error("[Industry Config Router] Error setting config", { error, input });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Impossible de mettre à jour la configuration",
        });
      }
    }),

  /**
   * Récupère les workflows standards d'un métier
   * ✅ CORRECTION: Utilise protectedProcedure car les workflows sont globaux
   */
  getIndustryWorkflows: protectedProcedure
    .input(z.object({ industryId: z.string() }))
    .query(async ({ input }) => {
      try {
        const workflows = tenantIndustryService.getIndustryWorkflows(input.industryId);
        return {
          success: true,
          data: workflows,
        };
      } catch (error: unknown) {
        logger.error("[Industry Config Router] Error getting workflows", error);
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workflows non trouvés",
        });
      }
    }),

  /**
   * Récupère les capacités d'un métier
   * ✅ CORRECTION: Utilise protectedProcedure car les capacités sont globales
   */
  getIndustryCapabilities: protectedProcedure
    .input(z.object({ industryId: z.string() }))
    .query(async ({ input }) => {
      try {
        const capabilities = tenantIndustryService.getIndustryCapabilities(input.industryId);
        return {
          success: true,
          data: capabilities,
        };
      } catch (error: unknown) {
        logger.error("[Industry Config Router] Error getting capabilities", error);
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Capacités non trouvées",
        });
      }
    }),

  // ============================================
  // AI KEY MANAGEMENT
  // ============================================

  /**
   * Sauvegarde la clé OpenAI du tenant
   * ✅ CORRECTION: Utilise protectedProcedure avec tenantId optionnel
   */
  saveOpenAiKey: protectedProcedure
    .input(
      z.object({
        tenantId: z.number().optional(),
        apiKey: z.string().min(1, "La clé API ne peut pas être vide"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // ✅ BLOC 1: Récupérer le tenantId (validation stricte)
        const tenantId = input.tenantId || ctx.tenantId;
        if (!tenantId) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Accès refusé : aucun tenant associé à votre session",
          });
        }
        
        // Vérifier les permissions
        const userRole = ctx.user.role;
        if (!['admin', 'manager', 'superadmin'].includes(userRole ?? '')) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Accès réservé aux managers et administrateurs",
          });
        }
        if (input.tenantId && input.tenantId !== ctx.tenantId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Accès refusé : vous ne pouvez pas modifier la clé d'un autre tenant",
          });
        }
        
        // Validation de la clé
        if (!input.apiKey.startsWith("process.env.OPENAI_API_KEY")) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Format de clé OpenAI invalide. Elle doit commencer par 'process.env.OPENAI_API_KEY'",
          });
        }

        // Validation optionnelle de la clé
        const isValid = await tenantAiKeyService.validateOpenAiKey(input.apiKey);
        if (!isValid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "La clé OpenAI est invalide ou expirée",
          });
        }

        // Sauvegarde
        await tenantAiKeyService.saveOpenAiKey(tenantId!, input.apiKey);

        logger.info("OpenAI key saved", {
          tenantId: tenantId,
          userId: ctx.user.id,
        });
        await AuditService.log({
          tenantId: tenantId!,
          userId: ctx.user.id,
          action: "RESOURCE_CREATE",  // Closest valid action for resource access
          resource: "openai_key",
          actorType: "human",
          source: 'API',
          metadata: { action: "test_openai_key" }
        });
        return {
          success: true,
          message: "Clé OpenAI sauvegardée avec succès",
        };
      } catch (error: unknown) {
        logger.error("[Industry Config Router] Error saving OpenAI key", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Impossible de sauvegarder la clé OpenAI",
        });
      }
    }),

  /**
   * Vérifie si le tenant a une clé OpenAI configurée
   * ✅ CORRECTION: Utilise protectedProcedure et récupère tenantId du contexte
   */
  hasOpenAiKey: protectedProcedure.query(async ({ ctx }) => {
    try {
      // ✅ BLOC 1: Récupérer le tenantId (validation stricte)
      const tenantId = ctx.tenantId;
      if (!tenantId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Accès refusé : aucun tenant associé à votre session",
        });
      }
      const hasKey = await tenantAiKeyService.hasOpenAiKey(tenantId);
      return {
        success: true,
        data: { hasKey },
      };
    } catch (error: unknown) {
      logger.error("[Industry Config Router] Error checking OpenAI key", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Impossible de vérifier la clé OpenAI",
      });
    }
  }),

  /**
   * Supprime la clé OpenAI du tenant
   * ✅ CORRECTION: Utilise protectedProcedure avec tenantId optionnel
   */
  deleteOpenAiKey: protectedProcedure
    .input(z.object({ tenantId: z.number().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
    try {
      // ✅ BLOC 1: Récupérer le tenantId (validation stricte)
      const tenantId = input?.tenantId || ctx.tenantId;
      if (!tenantId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Accès refusé : aucun tenant associé à votre session",
        });
      }
      
      // Vérifier les permissions
      const userRole = ctx.user.role;
        if (!['admin', 'manager', 'superadmin'].includes(userRole ?? '')) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Accès réservé aux managers et administrateurs",
          });
        }
        if (input?.tenantId && input.tenantId !== ctx.tenantId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Accès refusé : vous ne pouvez pas supprimer la clé d'un autre tenant",
          });
        }
      
      await tenantAiKeyService.deleteOpenAiKey(tenantId!);

      logger.info("OpenAI key deleted", {
        tenantId: tenantId,
        userId: ctx.user.id,
      });
      
        await AuditService.log({
          tenantId: tenantId!,
          userId: ctx.user.id,
          action: "RESOURCE_UPDATE",
          resource: "openai_key",
          actorType: "human",
          source: 'API',
          metadata: { action: "save_openai_key" }
        });

      return {
        success: true,
        message: "Clé OpenAI supprimée avec succès",
      };
    } catch (error: unknown) {
      logger.error("[Industry Config Router] Error deleting OpenAI key", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Impossible de supprimer la clé OpenAI",
      });
    }
  }),

  /**
   * Teste la clé OpenAI
   * ✅ CORRECTION: Utilise protectedProcedure
   */
  testOpenAiKey: protectedProcedure
    .input(z.object({ apiKey: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Vérifier les permissions
        const userRole = ctx.user.role;
        if (!["admin", "manager", "superadmin"].includes(userRole ?? "")) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Accès réservé aux managers et administrateurs",
          });
        }
        const isValid = await tenantAiKeyService.validateOpenAiKey(input.apiKey);
        return {
          success: true,
          data: { isValid },
        };
      } catch (error: unknown) {
        logger.error("[Industry Config Router] Error testing OpenAI key", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Impossible de tester la clé OpenAI",
        });
      }
    }),
});

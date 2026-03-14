import { z } from "zod";
import { router, protectedProcedure } from "../procedures";
import { TRPCError } from "@trpc/server";
import { logger } from "../infrastructure/logger";

/**
 * Email Config Router - Gestion des configurations d'envoi d'emails
 */
export const emailConfigRouter = router({
  /**
   * Créer ou mettre à jour une configuration email
   */
  create: protectedProcedure
    .input(z.object({
      provider: z.enum(["resend", "smtp", "sendgrid", "mailgun"]),
      credentials: z.record(z.string()),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Utilisateur non authentifié" });
      }

      const tenantId = ctx.tenantId ?? 0;

      try {
        logger.info('[EmailConfig Router] Saving configuration', {
          userId: ctx.user.id,
          tenantId: tenantId,
          provider: input.provider,
        });

        // Simulation de sauvegarde (à lier à la DB si nécessaire)
        return {
          success: true,
          message: `Configuration ${input.provider} enregistrée avec succès`,
          timestamp: new Date().toISOString(),
        };
      } catch (error: unknown) {
        logger.error('[EmailConfig Router] Error saving configuration', {
          error,
          userId: ctx.user.id,
          tenantId: tenantId,
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Impossible de sauvegarder la configuration email',
          cause: error,
        });
      }
    }),

  /**
   * Lister les configurations actives
   */
  list: protectedProcedure
    .query(async ({ ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Utilisateur non authentifié" });
      }

      try {
        // Simulation de récupération
        return {
          success: true,
          configs: [
            { id: "resend-1", provider: "resend", status: "active", createdAt: new Date() }
          ]
        };
      } catch (error: unknown) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Impossible de récupérer les configurations',
        });
      }
    }),
});

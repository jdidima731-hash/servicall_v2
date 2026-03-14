/**
 * Security Router - Endpoints pour la sécurité, compliance et souveraineté des données
 */

import { z } from 'zod';
import { protectedProcedure, router } from '../procedures';
import { TRPCError } from '@trpc/server';
import { kmsService } from '../services/kmsService';
import { encryptionService } from '../services/encryptionService';
import { complianceService } from '../services/complianceService';
import { logger as loggingService } from "../infrastructure/logger";

export const securityRouter = router({
  /**
   * Génère une nouvelle clé de chiffrement
   */
  generateEncryptionKey: protectedProcedure
    .input(
      z.object({
        keyType: z.enum(['master', 'data', 'session']).default('data'),
        expiresInDays: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Vérifier que l'utilisateur a les permissions (admin uniquement)
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Permission refusée: admin uniquement' });
        }

        // DURCI: Vérification explicite du tenantId
        if (!ctx.tenantId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Tenant ID manquant dans la session' });
        }

        const key = await kmsService.generateKey(
          ctx.tenantId,
          input.keyType,
          input.expiresInDays
        );

        return {
          success: true,
          keyId: key.id,
          version: key.version,
          expiresAt: key.expiresAt,
        };
      } catch (error: unknown) {
        loggingService.error('Security Router: Erreur génération clé', { error });
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Impossible de générer une nouvelle clé' });
      }
    }),

  /**
   * Effectue une rotation de clé
   */
  rotateKey: protectedProcedure
    .input(
      z.object({
        keyType: z.enum(['master', 'data', 'session']).default('data'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Permission refusée: admin uniquement' });
        }

        if (!ctx.tenantId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Tenant ID manquant dans la session' });
        }
        const result = await kmsService.rotateKey(ctx.tenantId, input.keyType);

        return {
          success: true,
          ...result,
        };
      } catch (error: unknown) {
        loggingService.error('Security Router: Erreur rotation clé', { error });
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Impossible de faire pivoter la clé' });
      }
    }),

  /**
   * Révoque une clé compromise
   */
  revokeKey: protectedProcedure
    .input(
      z.object({
        keyId: z.string(),
        reason: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Permission refusée: admin uniquement' });
        }

        if (!ctx.tenantId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Tenant ID manquant dans la session' });
        }
        await kmsService.revokeKey(ctx.tenantId, input.keyId);

        return {
          success: true,
          message: 'Clé révoquée avec succès',
        };
      } catch (error: unknown) {
        loggingService.error('Security Router: Erreur révocation clé', { error });
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Impossible de révoquer la clé' });
      }
    }),

  /**
   * Vérifie l'état de santé des clés
   */
  checkKeyHealth: protectedProcedure.query(async ({ ctx }) => {
    try {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Tenant ID manquant dans la session' });
      }
      const health = await kmsService.checkKeyHealth(ctx.tenantId);

      return {
        success: true,
        ...health,
      };
    } catch (error: unknown) {
      loggingService.error('Security Router: Erreur vérification santé clés', { error });
      throw new Error('Impossible de vérifier l\'état des clés');
    }
  }),

  /**
   * Vérifie la conformité d'un appel
   */
  checkCallCompliance: protectedProcedure
    .input(
      z.object({
        callId: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        if (!ctx.tenantId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Tenant ID manquant dans la session' });
        }
        const check = await complianceService.checkCallCompliance(
          input.callId,
          ctx.tenantId
        );

        return {
          success: true,
          check,
        };
      } catch (error: unknown) {
        loggingService.error('Security Router: Erreur vérification conformité appel', {
          error,
        });
        throw new Error('Impossible de vérifier la conformité de l\'appel');
      }
    }),

  /**
   * Vérifie la conformité du stockage
   */
  checkStorageCompliance: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Tenant ID manquant dans la session' });
      }
      const checks = await complianceService.checkStorageCompliance(ctx.tenantId);

      return {
        success: true,
        checks,
        summary: {
          total: checks.length,
          compliant: checks.filter(c => c.status === 'compliant').length,
          warnings: checks.filter(c => c.status === 'warning').length,
          violations: checks.filter(c => c.status === 'violation').length,
        },
      };
    } catch (error: unknown) {
      loggingService.error('Security Router: Erreur vérification conformité stockage', {
        error,
      });
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Impossible de vérifier la conformité du stockage' });
    }
  }),

  /**
   * Vérifie la conformité d'un workflow IA
   */
  checkAIWorkflowCompliance: protectedProcedure
    .input(
      z.object({
        workflowId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        if (!ctx.tenantId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Tenant ID manquant dans la session' });
        }
        const check = await complianceService.checkAIWorkflowCompliance(
          ctx.tenantId,
          input.workflowId
        );

        return {
          success: true,
          check,
        };
      } catch (error: unknown) {
        loggingService.error('Security Router: Erreur vérification conformité workflow', {
          error,
        });
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Impossible de vérifier la conformité du workflow' });
      }
    }),

  /**
   * Génère le dashboard de conformité
   */
  getComplianceDashboard: protectedProcedure
    .input(
      z.object({
        startDate: z.string(),
        endDate: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        if (!ctx.tenantId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Tenant ID manquant dans la session' });
        }
        const dashboard = await complianceService.generateComplianceDashboard(
          ctx.tenantId,
          new Date(input.startDate),
          new Date(input.endDate)
        );

        return {
          success: true,
          dashboard,
        };
      } catch (error: unknown) {
        loggingService.error('Security Router: Erreur génération dashboard conformité', {
          error,
        });
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Impossible de générer le dashboard de conformité' });
      }
    }),

  /**
   * Génère un rapport d'audit
   */
  generateAuditReport: protectedProcedure
    .input(
      z.object({
        startDate: z.string(),
        endDate: z.string(),
        format: z.enum(['json', 'csv', 'pdf']).default('json'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Permission refusée: admin uniquement' });
        }

        if (!ctx.tenantId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Tenant ID manquant dans la session' });
        }
        const report = await complianceService.generateAuditReport(
          ctx.tenantId,
          new Date(input.startDate),
          new Date(input.endDate),
          input.format
        );

        return {
          success: true,
          report,
          format: input.format,
        };
      } catch (error: unknown) {
        loggingService.error('Security Router: Erreur génération rapport audit', { error });
        throw new Error('Impossible de générer le rapport d\'audit');
      }
    }),

  /**
   * Résout une violation de conformité
   */
  resolveViolation: protectedProcedure
    .input(
      z.object({
        violationId: z.string(),
        resolution: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        if (!ctx.tenantId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Tenant ID manquant dans la session' });
        }
        await complianceService.resolveViolation(
          ctx.tenantId,
          input.violationId,
          input.resolution,
          ctx.user.id
        );

        return {
          success: true,
          message: 'Violation résolue avec succès',
        };
      } catch (error: unknown) {
        loggingService.error('Security Router: Erreur résolution violation', { error });
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Impossible de résoudre la violation' });
      }
    }),

  /**
   * Exécute une vérification périodique de conformité
   */
  runPeriodicComplianceCheck: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Permission refusée: admin uniquement' });
      }

      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Tenant ID manquant dans la session' });
      }
      // Exécuter en arrière-plan
      complianceService.runPeriodicComplianceCheck(ctx.tenantId).catch(err => {
        loggingService.error('Erreur vérification périodique', { err });
      });

      return {
        success: true,
        message: 'Vérification de conformité lancée en arrière-plan',
      };
    } catch (error: unknown) {
      loggingService.error('Security Router: Erreur lancement vérification', { error });
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Impossible de lancer la vérification de conformité' });
    }
  }),

  /**
   * Anonymise des données (pour GDPR)
   */
  anonymizeData: protectedProcedure
    .input(
      z.object({
        value: z.string(),
        type: z.enum(['email', 'phone', 'name', 'text']),
      })
    )
    .mutation(async ({input}) => {
      try {
        const anonymized = encryptionService.anonymize(input.value, input.type);

        return {
          success: true,
          anonymized,
        };
      } catch (error: unknown) {
        loggingService.error('Security Router: Erreur anonymisation', { error });
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Impossible d\'anonymiser les données' });
      }
    }),
});

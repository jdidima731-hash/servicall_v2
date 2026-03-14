/**
 * Router pour le module de recrutement IA
 * Gestion des entretiens automatisés, analyse comportementale et reporting
 */

import { router } from "../_core/trpc";
import { tenantProcedure, managerProcedure } from "../procedures";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { recruitmentService } from "../services/RecruitmentService";
import { logger } from "../infrastructure/logger";
import { paginationInput, paginate } from "../_core/pagination";
import { db } from "../db";
import { candidateInterviews, interviewQuestions, recruitmentSettings } from "../../drizzle/schema";
import type { CandidateInterview } from "../../drizzle/schema-recruitment";
import { eq, and, count } from "drizzle-orm";

// ============================================
// SCHEMAS DE VALIDATION
// ============================================

const createInterviewSchema = z.object({
  candidateName: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  candidateEmail: z.string().email("Email invalide").optional(),
  candidatePhone: z.string().min(10, "Numéro de téléphone invalide"),
  businessType: z.string().min(1, "Type de métier requis"),
  jobPosition: z.string().min(2, "Poste requis"),
  scheduledAt: z.string().datetime().optional(),
  source: z.enum(["platform", "manual", "referral", "job_board", "other"]).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

const interviewIdSchema = z.object({
  id: z.number().int().positive(),
});

const updateTranscriptSchema = z.object({
  id: z.number().int().positive(),
  transcript: z.string().min(10, "Transcript trop court"),
  duration: z.number().int().positive(),
});

const updateEmployerDecisionSchema = z.object({
  id: z.number().int().positive(),
  decision: z.enum(["hired", "rejected", "pending"]),
  notes: z.string().optional(),
});

const listInterviewsSchema = paginationInput.extend({
  businessType: z.string().optional(),
  status: z.enum([
    "pending",
    "scheduled",
    "in_progress",
    "completed",
    "reviewed",
    "shortlisted",
    "rejected",
    "cancelled"
  ]).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

const createQuestionSchema = z.object({
  businessType: z.string().min(1),
  category: z.string().min(1),
  question: z.string().min(10),
  expectedAnswerType: z.enum(["open", "yes_no", "numeric", "choice"]).optional(),
  expectedKeywords: z.array(z.string()).optional(),
  weight: z.number().min(0).max(10).optional(),
  order: z.number().int().optional(),
});

const updateQuestionSchema = z.object({
  id: z.number().int().positive(),
  question: z.string().min(10).optional(),
  expectedKeywords: z.array(z.string()).optional(),
  weight: z.number().min(0).max(10).optional(),
  order: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

const updateSettingsSchema = z.object({
  businessType: z.string().min(1),
  minGlobalScore: z.number().min(0).max(10).optional(),
  minCoherenceScore: z.number().min(0).max(10).optional(),
  minHonestyScore: z.number().min(0).max(10).optional(),
  aiModel: z.string().optional(),
  aiTemperature: z.number().min(0).max(2).optional(),
  customIntroScript: z.string().optional(),
  customOutroScript: z.string().optional(),
  notifyOnCompletion: z.boolean().optional(),
  notificationEmail: z.string().email().optional(),
  dataRetentionDays: z.number().int().min(1).max(365).optional(),
});

// ============================================
// ROUTER
// ============================================

export const recruitmentRouter = router({
  /**
   * Créer un nouvel entretien candidat
   */
  createInterview: managerProcedure
    .input(createInterviewSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        logger.info("[Recruitment] Creating new interview", {
          tenantId: ctx.tenantId,
          businessType: input.businessType,
        });

        const interview = await recruitmentService.createInterview({
          tenantId: ctx.tenantId,
          candidateName: input.candidateName,
          candidateEmail: input.candidateEmail,
          candidatePhone: input.candidatePhone,
          businessType: input.businessType,
          jobPosition: input.jobPosition,
          scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
          source: input.source,
          metadata: input.metadata,
        });

        return {
          success: true,
          data: interview,
        };
      } catch (error: unknown) {
        logger.error("[Recruitment] Failed to create interview", { error, tenantId: ctx.tenantId });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Impossible de créer l'entretien",
        });
      }
    }),

  /**
   * Démarrer un entretien IA
   */
  startInterview: managerProcedure
    .input(interviewIdSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        logger.info("[Recruitment] Starting AI interview", {
          tenantId: ctx.tenantId,
          interviewId: input.id,
        });

        // Vérifier que l'entretien appartient au tenant
        const interview = await db.query.candidateInterviews.findFirst({
          where: and(
            eq(candidateInterviews.id, input.id),
            eq(candidateInterviews.tenantId, ctx.tenantId)
          ),
        });

        if (!interview) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Entretien non trouvé",
          });
        }

        await recruitmentService.receiveCall(input.id);

        return {
          success: true,
          message: "Entretien IA démarré avec succès",
        };
      } catch (error: unknown) {
        logger.error("[Recruitment] Failed to start interview", { error, tenantId: ctx.tenantId });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Impossible de démarrer l'entretien",
        });
      }
    }),

  /**
   * Mettre à jour le transcript après l'appel
   */
  updateTranscript: tenantProcedure
    .input(updateTranscriptSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        logger.info("[Recruitment] Updating transcript", {
          tenantId: ctx.tenantId,
          interviewId: input.id,
        });

        // Vérifier l'appartenance au tenant
        const interview = await db.query.candidateInterviews.findFirst({
          where: and(
            eq(candidateInterviews.id, input.id),
            eq(candidateInterviews.tenantId, ctx.tenantId)
          ),
        });

        if (!interview) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Entretien non trouvé",
          });
        }

        await recruitmentService.updateTranscript(input.id, input.transcript, input.duration);

        return {
          success: true,
          message: "Transcript mis à jour",
        };
      } catch (error: unknown) {
        logger.error("[Recruitment] Failed to update transcript", { error });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Impossible de mettre à jour le transcript",
        });
      }
    }),

  /**
   * Générer le rapport d'analyse
   */
  generateReport: managerProcedure
    .input(interviewIdSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        logger.info("[Recruitment] Generating report", {
          tenantId: ctx.tenantId,
          interviewId: input.id,
        });

        // Vérifier l'appartenance au tenant
        const interview = await db.query.candidateInterviews.findFirst({
          where: and(
            eq(candidateInterviews.id, input.id),
            eq(candidateInterviews.tenantId, ctx.tenantId)
          ),
        });

        if (!interview) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Entretien non trouvé",
          });
        }

        await recruitmentService.generateReport(input.id);

        return {
          success: true,
          message: "Rapport généré avec succès",
        };
      } catch (error: unknown) {
        logger.error("[Recruitment] Failed to generate report", { error });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Impossible de générer le rapport",
        });
      }
    }),

  /**
   * Lister les entretiens avec filtres et pagination
   */
  listInterviews: tenantProcedure
    .input(listInterviewsSchema)
    .query(async ({ input, ctx }) => {
      try {
        const { page, limit, businessType, status, dateFrom, dateTo } = input;
        const offset = (page - 1) * limit;

        logger.info("[Recruitment] Listing interviews", {
          tenantId: ctx.tenantId,
          filters: { businessType, status, dateFrom, dateTo },
        });

        const filters = {
          businessType,
          status,
          dateFrom: dateFrom ? new Date(dateFrom) : undefined,
          dateTo: dateTo ? new Date(dateTo) : undefined,
        };

        // Récupérer les entretiens
        const interviews = await recruitmentService.getInterviews(ctx.tenantId, filters);

        // Compter le total
        const conditions = [eq(candidateInterviews.tenantId, ctx.tenantId)];
        if (businessType) conditions.push(eq(candidateInterviews.businessType, businessType));
        if (status) conditions.push(eq(candidateInterviews.status, status));

        const [totalResult] = await db
          .select({ value: count() })
          .from(candidateInterviews)
          .where(and(...conditions));

        // Paginer
        const paginatedInterviews = interviews.slice(offset, offset + limit);

        return paginate(paginatedInterviews, totalResult.value, input);
      } catch (error: unknown) {
        logger.error("[Recruitment] Failed to list interviews", { error });
        return paginate([], 0, input);
      }
    }),

  /**
   * Récupérer un entretien par ID avec données déchiffrées
   */
  getInterviewById: tenantProcedure
    .input(interviewIdSchema)
    .query(async ({ input, ctx }) => {
      try {
        logger.info("[Recruitment] Getting interview by ID", {
          tenantId: ctx.tenantId,
          interviewId: input.id,
        });

        const interview = await recruitmentService.getInterviewById(input.id, ctx.tenantId);

        if (!interview) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Entretien non trouvé",
          });
        }

        return {
          success: true,
          data: interview,
        };
      } catch (error: unknown) {
        logger.error("[Recruitment] Failed to get interview", { error });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Impossible de récupérer l'entretien",
        });
      }
    }),

  /**
   * Mettre à jour la décision de l'employeur
   */
  updateEmployerDecision: managerProcedure
    .input(updateEmployerDecisionSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        logger.info("[Recruitment] Updating employer decision", {
          tenantId: ctx.tenantId,
          interviewId: input.id,
          decision: input.decision,
        });

        // Vérifier l'appartenance au tenant
        const interview = await db.query.candidateInterviews.findFirst({
          where: and(
            eq(candidateInterviews.id, input.id),
            eq(candidateInterviews.tenantId, ctx.tenantId)
          ),
        });

        if (!interview) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Entretien non trouvé",
          });
        }

        await db.update(candidateInterviews)
          .set({
            employerDecision: input.decision,
            employerNotes: input.notes,
            employerDecisionAt: new Date(),
            status: input.decision === "hired" ? "shortlisted" : 
                    input.decision === "rejected" ? "rejected" : "reviewed",
            updatedAt: new Date(),
          })
          .where(eq(candidateInterviews.id, input.id));

        return {
          success: true,
          message: "Décision enregistrée",
        };
      } catch (error: unknown) {
        logger.error("[Recruitment] Failed to update decision", { error });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Impossible d'enregistrer la décision",
        });
      }
    }),

  /**
   * Créer une question d'entretien
   */
  createQuestion: managerProcedure
    .input(createQuestionSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        logger.info("[Recruitment] Creating interview question", {
          tenantId: ctx.tenantId,
          businessType: input.businessType,
        });

        const [question] = await db.insert(interviewQuestions).values({
          tenantId: ctx.tenantId,
          businessType: input.businessType,
          category: input.category,
          question: input.question,
          expectedAnswerType: input.expectedAnswerType,
          expectedKeywords: input.expectedKeywords,
          weight: input.weight?.toString(),
          order: input.order ?? 0,
        }).returning();

        return {
          success: true,
          data: question,
        };
      } catch (error: unknown) {
        logger.error("[Recruitment] Failed to create question", { error });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Impossible de créer la question",
        });
      }
    }),

  /**
   * Lister les questions d'entretien
   */
  listQuestions: tenantProcedure
    .input(z.object({ businessType: z.string() }))
    .query(async ({input}) => {
      try {
        const questions = await db.query.interviewQuestions.findMany({
          where: and(
            eq(interviewQuestions.businessType, input.businessType),
            eq(interviewQuestions.isActive, true)
          ),
          orderBy: [interviewQuestions.order],
        });

        return {
          success: true,
          data: questions,
        };
      } catch (error: unknown) {
        logger.error("[Recruitment] Failed to list questions", { error });
        return { success: false, data: [] };
      }
    }),

  /**
   * Mettre à jour une question
   */
  updateQuestion: managerProcedure
    .input(updateQuestionSchema)
    .mutation(async ({input}) => {
      try {
        const { id, ...updates } = input;

        await db.update(interviewQuestions)
          .set({
            ...updates,
            weight: updates.weight?.toString(),
            expectedKeywords: updates.expectedKeywords ? updates.expectedKeywords : undefined,
            updatedAt: new Date(),
          })
          .where(eq(interviewQuestions.id, id));

        return {
          success: true,
          message: "Question mise à jour",
        };
      } catch (error: unknown) {
        logger.error("[Recruitment] Failed to update question", { error });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Impossible de mettre à jour la question",
        });
      }
    }),

  /**
   * Récupérer les paramètres de recrutement
   */
  getSettings: tenantProcedure
    .input(z.object({ businessType: z.string() }))
    .query(async ({ input, ctx }) => {
      try {
        const settings = await db.query.recruitmentSettings.findFirst({
          where: and(
            eq(recruitmentSettings.tenantId, ctx.tenantId),
            eq(recruitmentSettings.businessType, input.businessType)
          ),
        });

        return {
          success: true,
          data: settings,
        };
      } catch (error: unknown) {
        logger.error("[Recruitment] Failed to get settings", { error });
        return { success: false, data: null };
      }
    }),

  /**
   * Mettre à jour les paramètres de recrutement
   */
  updateSettings: managerProcedure
    .input(updateSettingsSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { businessType, ...updates } = input;

        // Vérifier si les paramètres existent
        const existing = await db.query.recruitmentSettings.findFirst({
          where: and(
            eq(recruitmentSettings.tenantId, ctx.tenantId),
            eq(recruitmentSettings.businessType, businessType)
          ),
        });

        if (existing) {
          // Mise à jour
          await db.update(recruitmentSettings)
            .set({
              ...updates,
              minGlobalScore: updates.minGlobalScore?.toString(),
              minCoherenceScore: updates.minCoherenceScore?.toString(),
              minHonestyScore: updates.minHonestyScore?.toString(),
              aiTemperature: updates.aiTemperature?.toString(),
              updatedAt: new Date(),
            })
            .where(eq(recruitmentSettings.id, existing.id));
        } else {
          // Création
          await db.insert(recruitmentSettings).values({
            tenantId: ctx.tenantId,
            businessType,
            ...updates,
            minGlobalScore: updates.minGlobalScore?.toString(),
            minCoherenceScore: updates.minCoherenceScore?.toString(),
            minHonestyScore: updates.minHonestyScore?.toString(),
            aiTemperature: updates.aiTemperature?.toString(),
          });
        }

        return {
          success: true,
          message: "Paramètres mis à jour",
        };
      } catch (error: unknown) {
        logger.error("[Recruitment] Failed to update settings", { error });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Impossible de mettre à jour les paramètres",
        });
      }
    }),

  /**
   * Statistiques du recrutement
   */
  getStats: tenantProcedure
    .input(z.object({ 
      businessType: z.string().optional(),
      dateFrom: z.string().datetime().optional(),
      dateTo: z.string().datetime().optional(),
    }))
    .query(async ({ input, ctx }) => {
      try {
        const conditions = [eq(candidateInterviews.tenantId, ctx.tenantId)];
        if (input.businessType) {
          conditions.push(eq(candidateInterviews.businessType, input.businessType));
        }

        const interviews = await db.query.candidateInterviews.findMany({
          where: and(...conditions),
        });

        const stats = {
          total: interviews.length,
          pending: interviews.filter((i: CandidateInterview) => i.status === "pending").length,
          completed: interviews.filter((i: CandidateInterview) => i.status === "completed").length,
          shortlisted: interviews.filter((i: CandidateInterview) => i.status === "shortlisted").length,
          rejected: interviews.filter((i: CandidateInterview) => i.status === "rejected").length,
          averageScore: interviews
             .filter((i: CandidateInterview) => i.notesJson && i.notesJson.globalScore)
             .reduce((acc: number, i: CandidateInterview) => acc + ((i.notesJson as Record<string, number> | null)?.['globalScore'] ?? 0), 0) / 
            (interviews.filter((i: CandidateInterview) => i.notesJson).length ?? 1),
        };

        return {
          success: true,
          data: stats,
        };
      } catch (error: unknown) {
        logger.error("[Recruitment] Failed to get stats", { error });
        return { success: false, data: null };
      }
    }),
});

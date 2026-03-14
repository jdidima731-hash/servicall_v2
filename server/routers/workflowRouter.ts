import { z } from "zod";
import { router } from "../_core/trpc";
import { adminProcedure, managerProcedure, tenantProcedure } from "../procedures";
import {
  getWorkflowExecutionHistory,
  getTenantWorkflowExecutionHistory,
} from "../services/workflowService";
import { logger } from "../infrastructure/logger";
import { TRPCError } from "@trpc/server";
import { normalizeResponse, normalizeDbRecords, normalizeDbRecord } from "../_core/responseNormalizer";
import { paginationInput, paginate } from "../_core/pagination";
import { count, eq, desc } from "drizzle-orm";
import { workflows } from "../../drizzle/schema";
import * as fs from "fs/promises";
import path from "path";

/**
 * Router pour la gestion et consultation des workflows IA
 */
export const workflowRouter = router({
  /**
   * Liste tous les workflows d'un tenant
   */
  list: tenantProcedure
    .input(paginationInput)
    .query(async ({ ctx, input }) => {
      const { page, limit } = input;
      const offset = (page - 1) * limit;
      const { db } = await import("../db");
      
      if (!ctx.tenantId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tenant ID is required",
        });
      }

      const [data, totalResult] = await Promise.all([
        db.select().from(workflows)
          .where(eq(workflows.tenantId, ctx.tenantId))
          .limit(limit)
          .offset(offset)
          .orderBy(desc(workflows.createdAt)),
        db.select({ value: count() })
          .from(workflows)
          .where(eq(workflows.tenantId, ctx.tenantId))
      ]);

      const normalizedData = normalizeDbRecords(data);
      return paginate(normalizedData, totalResult[0]?.value ?? 0, input);
    }),

  /**
   * Récupère un workflow par son ID
   */
  getById: tenantProcedure
    .input(z.object({ workflowId: z.number() }))
    .query(async ({ input, ctx }) => {
      const { getWorkflowById } = await import("../db");
      if (!ctx.tenantId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tenant ID is required",
        });
      }
      const workflow = await getWorkflowById(input.workflowId, ctx.tenantId);
      if (!workflow) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workflow not found",
        });
      }
      return normalizeDbRecord(workflow);
    }),

  /**
   * Crée un nouveau workflow
   */
  create: managerProcedure
    .input(
      z.object({
        tenantId: z.number().optional(), // Pour compatibilité client, mais forcé par ctx
        name: z.string().min(1, "Le nom est requis"),
        description: z.string().optional(),
        industry: z.string().min(1, "Le métier est requis").default("generic"),
        triggerType: z.string().optional(), // Nouveau format
        trigger: z.string().optional(), // Ancien format
        actions: z.array(z.any()).optional().default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { createWorkflow } = await import("../db");
        
        if (!ctx.tenantId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Tenant ID is required",
          });
        }

        const workflow = await createWorkflow({
          tenantId: ctx.tenantId,
          name: input.name,
          description: input.description,
          trigger: ((input.triggerType || input.trigger) ?? "call_completed"),
          actions: input.actions,
        });
        return normalizeDbRecord(workflow);
      } catch (error: unknown) {
        logger.error("[WorkflowRouter] Create failed", { error });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la création du workflow",
        });
      }
    }),

  /**
   * Met à jour un workflow existant
   */
  update: managerProcedure
    .input(
      z.object({
        workflowId: z.number(),
        tenantId: z.number().optional(), // Optionnel - géré par ctx
        name: z.string().optional(),
        description: z.string().optional(),
        trigger: z.string().optional(),
        triggerType: z.string().optional(),
        actions: z.array(z.any()).optional(),
        isActive: z.boolean().optional(),
        enabled: z.boolean().optional(), // Alias de isActive pour compatibilité client
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { getWorkflowById, updateWorkflow } = await import("../db");
        const { workflowId, ...data } = input;
        
        if (!ctx.tenantId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Tenant ID is required",
          });
        }

        const workflow = await getWorkflowById(workflowId, ctx.tenantId);
        if (!workflow) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Workflow non trouvé",
          });
        }

        const updated = await updateWorkflow(workflowId, data);
        return normalizeDbRecord(updated);
      } catch (error: unknown) {
        logger.error("[WorkflowRouter] Update failed", { error });
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la mise à jour du workflow",
        });
      }
    }),

  /**
   * Supprime un workflow
   */
  delete: managerProcedure 
    .input(z.object({ 
      tenantId: z.number().optional(),
      workflowId: z.number() 
    }))
    .mutation(async ({ input, ctx }) => {
      const { getWorkflowById, deleteWorkflow } = await import("../db");
      if (!ctx.tenantId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tenant ID is required",
        });
      }
      const workflow = await getWorkflowById(input.workflowId, ctx.tenantId);
      if (!workflow) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workflow not found",
        });
      }
      const result = await deleteWorkflow(input.workflowId);
      return normalizeResponse(result, 'workflow.delete');
    }),

  /**
   * Récupère l'historique des exécutions d'un workflow spécifique
   */
  getExecutionHistory: managerProcedure 
    .input(
      z.object({
        workflowId: z.number(),
        limit: z.number().optional().default(50),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const { getWorkflowById } = await import("../db");
        if (!ctx.tenantId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Tenant ID is required",
          });
        }
        const workflow = await getWorkflowById(input.workflowId, ctx.tenantId);
        if (!workflow) throw new TRPCError({ code: "NOT_FOUND" });

        const history = await getWorkflowExecutionHistory(input.workflowId, input.limit);

        return normalizeResponse({
          workflowId: input.workflowId,
          executions: normalizeDbRecords(history),
          total: history.length,
        }, 'workflow.executionHistory');
      } catch (error: unknown) {
        logger.error("[WorkflowRouter] Failed to get execution history", { error });
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get workflow execution history",
        });
      }
    }),

  /**
   * Récupère l'historique des exécutions pour un tenant (admin only)
   */
  getTenantExecutionHistory: adminProcedure
    .input(
      z.object({
        tenantId: z.number(),
        limit: z.number().optional().default(100),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        if (input.tenantId !== ctx.tenantId) throw new TRPCError({ code: "FORBIDDEN" });

        const history = await getTenantWorkflowExecutionHistory(input.tenantId, input.limit);

        const stats = {
          total: history.length,
          completed: history.filter((e: Record<string, unknown>) => e["status"] === "completed").length,
          failed: history.filter((e: Record<string, unknown>) => e["status"] === "failed").length,
          started: history.filter((e: Record<string, unknown>) => e["status"] === "started").length,
          averageDuration: 0,
        };

        const completedExecutions = history.filter((e: Record<string, unknown>) => e["duration"]);
        if (completedExecutions.length > 0) {
          const totalDuration = completedExecutions.reduce((sum: number, e: Record<string, unknown>) => sum + ((e["duration"] as number) || 0), 0);
          stats.averageDuration = Math.round(totalDuration / completedExecutions.length);
        }

        return normalizeResponse({
          tenantId: input.tenantId,
          executions: normalizeDbRecords(history),
          stats,
        }, 'workflow.tenantExecutionHistory');
      } catch (error: unknown) {
        logger.error("[WorkflowRouter] Failed to get tenant execution history", { error });
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get tenant workflow execution history",
        });
      }
    }),

  /**
   * Récupère les statistiques d'exécution d'un workflow
   */
  getWorkflowStats: managerProcedure 
    .input(
      z.object({
        workflowId: z.number(),
        days: z.number().optional().default(30),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const { getWorkflowById } = await import("../db");
        if (!ctx.tenantId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Tenant ID is required",
          });
        }
        const workflow = await getWorkflowById(input.workflowId, ctx.tenantId);
        if (!workflow) throw new TRPCError({ code: "NOT_FOUND" });

        const history = await getWorkflowExecutionHistory(input.workflowId, 1000);

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - input.days);

        const recentExecutions = history.filter((e: Record<string, unknown>) => {
          const startedAt = new Date(e["startedAt"] as string);
          return startedAt >= cutoffDate;
        });

        const stats = {
          total: recentExecutions.length,
          completed: recentExecutions.filter((e: Record<string, unknown>) => e["status"] === "completed").length,
          failed: recentExecutions.filter((e: Record<string, unknown>) => e["status"] === "failed").length,
          started: recentExecutions.filter((e: Record<string, unknown>) => e["status"] === "started").length,
          averageDuration: 0,
          successRate: 0,
        };

        const completedExecutions = recentExecutions.filter((e: Record<string, unknown>) => e["duration"]);
        if (completedExecutions.length > 0) {
          const totalDuration = completedExecutions.reduce((sum: number, e: Record<string, unknown>) => sum + ((e["duration"] as number) || 0), 0)
          stats.averageDuration = Math.round(totalDuration / completedExecutions.length);
        }

        if (stats.total > 0) {
          stats.successRate = Math.round((stats.completed / stats.total) * 100);
        }

        return normalizeResponse({
          workflowId: input.workflowId,
          period: input.days,
          stats,
        }, 'workflow.stats');
      } catch (error: unknown) {
        logger.error("[WorkflowRouter] Failed to get workflow stats", { error });
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get workflow statistics",
        });
      }
    }),

  /**
   * [BLOC 1] Liste les Blueprints métiers disponibles
   */
  listBlueprints: tenantProcedure.query(async () => {
    try {
      const catalogPath = path.join(process.cwd(), "INDUSTRIES_CATALOG.json");
      const content = await fs.readFile(catalogPath, "utf-8");
      const catalog = JSON.parse(content);
      
      const allBlueprints = Object.values(catalog.industries).flatMap((ind: unknown) => ind.workflows || []);
      return allBlueprints;
    } catch (error: unknown) {
      logger.error("[WorkflowRouter] Failed to list blueprints", { error });
      return [];
    }
  }),

  /**
   * [BLOC 1B] Importe un blueprint et crée le workflow correspondant
   */
  importBlueprint: managerProcedure
    .input(z.object({
      tenantId: z.number().optional(),
      blueprintId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        await import("../db");
        const tenantId = ctx.tenantId;
        if (!tenantId) throw new TRPCError({ code: "BAD_REQUEST", message: "Tenant ID requis" });

        // Charger le catalogue pour trouver le blueprint
        let blueprint: unknown= null;
        try {
          const catalogPath = path.join(process.cwd(), "INDUSTRIES_CATALOG.json");
          const content = await fs.readFile(catalogPath, "utf-8");
          const catalog = JSON.parse(content);
          for (const industry of Object.values(catalog.industries as Record<string, { workflows?: Array<{ id: string; templateId?: string; name?: string; description?: string; triggerType?: string; steps?: unknown[] }> }>)) {
            const found = (industry.workflows || []).find((w: unknown) => w.id === input.blueprintId || w.templateId === input.blueprintId);
            if (found) { blueprint = found; break; }
          }
        } catch { /* catalogue non trouvé */ }

        const workflowData = {
          tenantId,
          name: blueprint?.name || `Blueprint ${input.blueprintId}`,
          description: blueprint?.description ?? "",
          trigger: (blueprint?.triggerType ?? "call_completed"),
          actions: blueprint?.steps || [],
          isActive: true,
        };

        const { db: dbInstance } = await import("../db");
        const result = await dbInstance.insert(workflows).values(workflowData).returning();
        logger.info("[WorkflowRouter] Blueprint imported", { blueprintId: input.blueprintId, tenantId });
        return { success: true, workflow: result[0] ?? undefined };
      } catch (error: unknown) {
        logger.error("[WorkflowRouter] Failed to import blueprint", { error });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Erreur import blueprint" });
      }
    }),

  /**
   * [BLOC 1B] Simule l'exécution d'un workflow avec des données mock
   */
  simulate: managerProcedure
    .input(z.object({
      workflowData: z.any(),
      mockData: z.any().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const tenantId = ctx.tenantId;
        const steps: any[] = input.workflowData?.actions || input.workflowData?.steps || [];
        const logs: any[] = [];

        for (const step of steps) {
          logs.push({
            stepName: step.label || step.type,
            stepType: step.type,
            status: "completed",
            message: `Étape "${step.label || step.type}" simulée avec succès`,
            timestamp: new Date().toISOString(),
            data: { simulated: true, tenantId },
          });
        }

        return {
          success: true,
          logs,
          executionTime: Math.floor(Math.random() * 500) + 100,
          stepsExecuted: steps.length,
        };
      } catch (error: unknown) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Erreur simulation" });
      }
    }),
});

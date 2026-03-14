/**
 * Coaching Router - Endpoints pour le coaching et la formation des agents
 */

import { z } from 'zod';
import { protectedProcedure, router } from '../procedures';
import { TRPCError } from '@trpc/server';
import { agentCoachingService } from '../services/agentCoachingService';
import { callSimulatorService } from '../services/callSimulatorService';
import { logger as loggingService } from "../infrastructure/logger";

export const coachingRouter = router({
  /**
   * Génère un feedback de coaching pour un appel
   */
  generateFeedback: protectedProcedure
    .input(
      z.object({
        callId: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const feedback = await agentCoachingService.analyzeCallAndGenerateFeedback(
          input.callId,
          ctx.tenantId!
        );

        return {
          success: true,
          feedback,
        };
      } catch (error: unknown) {
        loggingService.error('Coaching Router: Erreur génération feedback', {
          error,
          callId: input.callId,
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Impossible de générer le feedback',
        });
      }
    }),

  /**
   * Récupère le feedback d'un appel
   */
  getCallFeedback: protectedProcedure
    .input(
      z.object({
        callId: z.number(),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const feedback = await agentCoachingService.getCallFeedback(
          input.callId,
          ctx.tenantId!
        );

        return {
          success: true,
          feedback,
        };
      } catch (error: unknown) {
        loggingService.error('Coaching Router: Erreur récupération feedback', {
          error,
          callId: input.callId,
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Impossible de récupérer le feedback',
        });
      }
    }),

  /**
   * Récupère les métriques de performance d'un agent
   * ✅ BLOC 5: Cache Redis avec TTL 60s
   */
  getAgentPerformance: protectedProcedure
    .input(
      z.object({
        agentId: z.number(),
        startDate: z.string(),
        endDate: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        // Import du cache service
        const cacheService = await import('../services/cacheService');
        
        // Clé de cache unique par agent et période
        const cacheKey = `agent:${input.agentId}:performance:${input.startDate}:${input.endDate}`;
        
        // Utiliser le pattern cache-aside avec TTL 60s
        const metrics = await cacheService.getOrSet(
          cacheKey,
          async () => {
            return await agentCoachingService.getAgentPerformanceMetrics(
              input.agentId,
              ctx.tenantId!,
              new Date(input.startDate),
              new Date(input.endDate)
            );
          },
          60 // TTL: 60 secondes
        );

        return {
          success: true,
          metrics: {
            totalCalls: metrics.metrics.totalCalls,
            averageScore: metrics.metrics.averageScore,
            conversionRate: metrics.metrics.conversionRate,
            trend: metrics.trend,
            topStrengths: metrics.topStrengths,
            areasForImprovement: metrics.areasForImprovement,
          },
        };
      } catch (error: unknown) {
        loggingService.error('Coaching Router: Erreur récupération métriques', {
          error,
          agentId: input.agentId,
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Impossible de récupérer les métriques de performance',
        });
      }
    }),

  /**
   * Liste tous les scénarios disponibles avec fallback si vide
   */
  listSimulationScenarios: protectedProcedure.query(async ({ ctx }) => {
    try {
      const scenarios = await callSimulatorService.listScenarios(ctx.tenantId!);

      if (!scenarios || scenarios.length === 0) {
        return {
          success: true,
          scenarios: [],
          message: "Aucun scénario disponible pour le moment."
        };
      }

      return {
        success: true,
        scenarios: scenarios.map((s: unknown) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          difficulty: s.difficulty,
          customerProfile: s.customerProfile,
          objectives: s.objectives,
        })),
      };
    } catch (error: unknown) {
      loggingService.error('Coaching Router: Erreur liste scénarios', { error });
      return {
        success: false,
        scenarios: [],
        error: "Impossible de récupérer les scénarios"
      };
    }
  }),

  /**
   * Démarre une simulation d'appel
   */
  startSimulation: protectedProcedure
    .input(
      z.object({
        scenarioId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const simulation = await callSimulatorService.startSimulation(
          ctx.user.id,
          ctx.tenantId!,
          input.scenarioId
        );

        return {
          success: true,
          simulation: {
            id: simulation.id,
            scenarioId: simulation.scenarioId,
            status: simulation.status,
            transcript: simulation.transcript,
            startedAt: simulation.startedAt,
          },
        };
      } catch (error: unknown) {
        loggingService.error('Coaching Router: Erreur démarrage simulation', {
          error,
          scenarioId: input.scenarioId,
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Impossible de démarrer la simulation',
        });
      }
    }),

  /**
   * Envoie une réponse de l'agent dans une simulation
   */
  sendAgentResponse: protectedProcedure
    .input(
      z.object({
        callId: z.string(),
        message: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await callSimulatorService.processAgentResponse(
          input.callId,
          ctx.user.id,
          ctx.tenantId!,
          input.message
        );

        return {
          success: true,
          customerResponse: result.customerResponse,
          sentiment: result.sentiment,
          callStatus: result.callStatus,
        };
      } catch (error: unknown) {
        loggingService.error('Coaching Router: Erreur traitement réponse', {
          error,
          callId: input.callId,
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Impossible de traiter la réponse',
        });
      }
    }),

  /**
   * Récupère l'historique des simulations d'un agent avec gestion d'état vide
   */
  getSimulationHistory: protectedProcedure
    .input(
      z.object({
        agentId: z.number().optional(),
        limit: z.number().optional().default(10),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const agentId = input.agentId || ctx.user.id;
        const history = await callSimulatorService.getAgentSimulationHistory(
          agentId,
          ctx.tenantId!,
          input.limit
        );

        if (!history || history.length === 0) {
          return {
            success: true,
            history: [],
            message: "Aucun historique de simulation trouvé."
          };
        }

        return {
          success: true,
          history: history.map((call: unknown) => ({
            id: call.id,
            scenarioId: call.scenarioId,
            status: call.status,
            score: call.score,
            startedAt: call.startedAt,
            completedAt: call.completedAt,
          })),
        };
      } catch (error: unknown) {
        loggingService.error('Coaching Router: Erreur récupération historique', {
          error,
          agentId: input.agentId,
        });
        return {
          success: false,
          history: [],
          error: "Impossible de récupérer l'historique"
        };
      }
    }),

  /**
   * Récupère le dashboard de performance de l'équipe
   * ✅ BLOC 2: Implémentation de l'agrégation des performances avec Drizzle
   */
  getTeamPerformanceDashboard: protectedProcedure
    .input(
      z.object({
        startDate: z.string(),
        endDate: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const { dbManager } = await import('../services/dbManager');
        const client = dbManager.client;
        
        if (!client) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database client not available' });
        }

        const tenantId = ctx.tenantId! || 1;
        const startDate = new Date(input.startDate);
        const endDate = new Date(input.endDate);

        // 1. Agrégation des appels réels par agent via postgres-js direct (Performance & Sécurité)
        const callStatsRaw = await client`
          SELECT 
            c.agent_id as "agentId",
            u.name as "agentName",
            COUNT(c.id)::int as "totalCalls",
            AVG(c.duration)::float as "avgDuration",
            COUNT(CASE WHEN c.outcome = 'success' THEN 1 END)::int as "successfulCalls"
          FROM calls c
          LEFT JOIN users u ON c.agent_id = u.id
          WHERE c.tenant_id = ${tenantId}
            AND c.created_at >= ${startDate}
            AND c.created_at <= ${endDate}
            AND c.agent_id IS NOT NULL
          GROUP BY c.agent_id, u.name
        `;
        
        // Sécurisation contre les résultats undefined
        const callStats = (callStatsRaw || []).map(row => ({
          agentId: row['agentId'] || 0,
          agentName: row['agentName'] || "Inconnu",
          totalCalls: row['totalCalls'] || 0,
          avgDuration: row['avgDuration'] || 0,
          successfulCalls: row['successfulCalls'] || 0
        }));

        // 2. Agrégation des simulations par agent via postgres-js
        const simulationStatsRaw = await client`
          SELECT 
            agent_id as "agentId",
            AVG(score)::float as "avgScore",
            COUNT(id)::int as "totalSimulations"
          FROM simulated_calls
          WHERE tenant_id = ${tenantId}
            AND created_at >= ${startDate}
            AND created_at <= ${endDate}
          GROUP BY agent_id
        `;
        
        const simulationStats = (simulationStatsRaw || []).map(row => ({
          agentId: row['agentId'] || 0,
          avgScore: row['avgScore'] || 0,
          totalSimulations: row['totalSimulations'] || 0
        }));

        // 3. Combiner les statistiques
        const agentPerformance = callStats.map((callStat) => {
          const simStat = simulationStats.find((s) => s.agentId === callStat.agentId);
          const totalCalls = callStat.totalCalls ?? 0;
          const successfulCalls = callStat.successfulCalls ?? 0;
          const conversionRate = totalCalls > 0 
            ? (successfulCalls / totalCalls) * 100 
            : 0;

          return {
            agentId: callStat.agentId,
            agentName: callStat.agentName || 'Agent inconnu',
            totalCalls: totalCalls,
            conversionRate: Math.round(conversionRate * 10) / 10,
            avgScore: simStat?.avgScore ? Math.round(simStat.avgScore) : 0,
            avgDuration: callStat.avgDuration ? Math.round(callStat.avgDuration) : 0,
          };
        });

        // 4. Calculer les métriques globales
        const totalAgents = agentPerformance.length;
        const totalCalls = agentPerformance.reduce((sum, agent) => sum + agent.totalCalls, 0);
        const averageScore = totalAgents > 0
          ? agentPerformance.reduce((sum, agent) => sum + agent.avgScore, 0) / totalAgents
          : 0;
        const averageConversionRate = totalAgents > 0
          ? agentPerformance.reduce((sum, agent) => sum + agent.conversionRate, 0) / totalAgents
          : 0;

        // 5. Identifier les top performers et ceux nécessitant amélioration
        const sortedByScore = [...agentPerformance].sort((a, b) => b.avgScore - a.avgScore);
        const topPerformers = sortedByScore.slice(0, 3);
        const needsImprovement = sortedByScore.slice(-3).reverse();

        loggingService.info('Coaching Router: Dashboard équipe calculé', {
          tenantId,
          totalAgents,
          totalCalls,
          period: { start: input.startDate, end: input.endDate },
        });

        return {
          success: true,
          dashboard: {
            period: { start: input.startDate, end: input.endDate },
            teamMetrics: {
              totalAgents,
              averageScore: Math.round(averageScore * 10) / 10,
              totalCalls,
              improvementRate: Math.round(averageConversionRate * 10) / 10,
            },
            topPerformers: topPerformers.map((agent) => ({
              agentId: agent.agentId,
              agentName: agent.agentName,
              score: agent.avgScore,
              calls: agent.totalCalls,
              conversionRate: agent.conversionRate,
            })),
            needsImprovement: needsImprovement.map((agent) => ({
              agentId: agent.agentId,
              agentName: agent.agentName,
              score: agent.avgScore,
              calls: agent.totalCalls,
              conversionRate: agent.conversionRate,
            })),
          },
        };
      } catch (error: unknown) {
        loggingService.error('Coaching Router: Erreur dashboard équipe', { error });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Impossible de récupérer le dashboard de l\'équipe',
        });
      }
    }),
});

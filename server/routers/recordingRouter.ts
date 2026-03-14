import { router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import * as recordingService from "../services/recordingService";
import { tenantProcedure, managerProcedure, adminProcedure } from "../procedures";

export const recordingRouter = router({
  /**
   * List recordings (calls with recordingUrl)
   */
  list: tenantProcedure
    .input(
      z.object({
        limit: z.number().default(50),
        offset: z.number().default(0),
      })
    )
    .query(async ({ ctx }) => {
      try {
        const calls = await db.getCallsByTenant(ctx.tenantId!);
        
        // Filter calls that have a recording and map to recording format
        // In a real scenario, we might want to do this filtering in the DB query
        const recordings = await Promise.all(calls
          .filter(call => call.recordingUrl)
          .map(async (call: unknown) => {
            const prospect = call.prospectId ? await db.getProspectById(call.prospectId, ctx.tenantId) : null;
            const agent = call.agentId ? await db.getUserById(call.agentId) : null;
            
            return {
              id: call.id,
              callId: call.id,
              prospectName: prospect ? `${prospect.firstName ?? ""} ${prospect.lastName ?? ""}`.trim() : "Prospect inconnu",
              agentName: agent ? agent.name : "Agent inconnu",
              duration: call.duration ?? 0,
              recordedAt: call.createdAt || new Date(),
              url: call.recordingUrl,
              transcription: (call.metadata as Record<string, unknown>)?.['transcription'] as string | undefined ?? "",
              summary: (call.metadata as Record<string, unknown>)?.['summary'] as string | undefined ?? "",
              sentiment: (call.metadata as Record<string, unknown>)?.['sentiment'] as string | undefined ?? "neutral",
              qualityScore: (call.metadata as Record<string, unknown>)?.['qualityScore'] as string | number | undefined ? parseFloat(String((call.metadata as Record<string, unknown>)?.['qualityScore'] ?? 0)) : null,
              keyPhrases: (call.metadata as Record<string, unknown>)?.['keyPhrases'] as unknown[] | undefined || [],
            };
          }));

        return recordings;
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        console.error("[Recording Router] Error listing recordings:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la récupération des enregistrements",
        });
      }
    }),

  /**
   * Get recording details
   */
  get: tenantProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        const call = await db.getCallById(input.id, ctx.tenantId);
        if (!call || !call.recordingUrl) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Enregistrement non trouvé",
          });
        }
        
        const prospect = call.prospectId ? await db.getProspectById(call.prospectId, ctx.tenantId) : null;
        const agent = call.agentId ? await db.getUserById(call.agentId) : null;

        return {
          id: call.id,
          callId: call.id,
          prospectName: prospect ? `${prospect.firstName ?? ""} ${prospect.lastName ?? ""}`.trim() : "Prospect inconnu",
          agentName: agent ? agent.name : "Agent inconnu",
          duration: call.duration ?? 0,
          recordedAt: call.createdAt || new Date(),
          url: call.recordingUrl,
          transcription: (call.metadata as Record<string, unknown>)?.['transcription'] as string | undefined ?? "",
          summary: (call.metadata as Record<string, unknown>)?.['summary'] as string | undefined ?? "",
          sentiment: (call.metadata as Record<string, unknown>)?.['sentiment'] as string | undefined ?? "neutral",
          qualityScore: (call.metadata as Record<string, unknown>)?.['qualityScore'] as string | number | undefined ? parseFloat(String((call.metadata as Record<string, unknown>)?.['qualityScore'] ?? 0)) : null,
          keyPhrases: (call.metadata as Record<string, unknown>)?.['keyPhrases'] as unknown[] | undefined || [],
        };
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        console.error("[Recording Router] Error getting recording:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la récupération de l'enregistrement",
        });
      }
    }),

  /**
   * Delete recording
   */
  delete: adminProcedure // Restricted to admin for safety
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const call = await db.getCallById(input.id, ctx.tenantId);
        if (!call) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Appel non trouvé",
          });
        }

        // Delete recording from S3 if exists
        if (call.recordingUrl) {
          // Extract key from URL or use a convention
          const recordingKey = (call.metadata as Record<string, unknown>)?.['recordingKey'] as string | undefined || `recording-${input.id}`;
          await recordingService.deleteRecording(recordingKey);
        }

        // Update call to remove recording info
        await db.updateCall(input.id, {
          recordingUrl: null,
        });

        return { success: true };
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        console.error("[Recording Router] Error deleting recording:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la suppression de l'enregistrement",
        });
      }
    }),

  /**
   * Get recording transcription
   */
  getTranscription: tenantProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        const call = await db.getCallById(input.id, ctx.tenantId);
        if (!call || !(call.metadata as Record<string, unknown>)?.['transcription']) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Transcription non trouvée",
          });
        }
        
        return {
          transcription: (call.metadata as Record<string, unknown>)?.['transcription'] as string | undefined,
          segments: (call.metadata as Record<string, unknown>)?.['segments'] as unknown[] | undefined || [],
        };
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        console.error("[Recording Router] Error getting transcription:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la récupération de la transcription",
        });
      }
    }),

  /**
   * Get recording analysis
   */
  getAnalysis: managerProcedure // Restricted to manager
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        const call = await db.getCallById(input.id, ctx.tenantId);
        if (!call) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Appel non trouvé",
          });
        }
        
        return {
          overallSentiment: (call.metadata as Record<string, unknown>)?.['sentiment'] as string | undefined ?? "neutral",
          keyTopics: (call.metadata as Record<string, unknown>)?.['keyTopics'] as unknown[] | undefined || [],
          actionItems: (call.metadata as Record<string, unknown>)?.['actionItems'] as unknown[] | undefined || [],
          qualityScore: (call.metadata as Record<string, unknown>)?.['qualityScore'] as string | number | undefined ? parseFloat(String((call.metadata as Record<string, unknown>)?.['qualityScore'] ?? 0)) : null,
          recommendations: (call.metadata as Record<string, unknown>)?.['recommendations'] as unknown[] | undefined || [],
        };
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        console.error("[Recording Router] Error getting analysis:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la récupération de l'analyse",
        });
      }
    }),
});

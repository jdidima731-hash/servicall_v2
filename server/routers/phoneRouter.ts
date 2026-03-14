import { router } from "../_core/trpc";
import { tenantProcedure, managerProcedure, agentProcedure } from "../procedures";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as twilioService from "../services/twilioService";
import * as twilioWebRTCService from "../services/twilioWebRTCService";
import * as aiService from "../services/aiService";
import * as db from "../db";
import * as callWorkflowService from "../services/callWorkflowService";
import { CoachService } from "../services/coachService";
import { ScoringService } from "../services/scoringService";

export const phoneRouter = router({
  // ============================================
  // TWILIO WEBRTC INTEGRATION
  // ============================================

  /**
   * Generate access token for WebRTC softphone
   */
  getAccessToken: tenantProcedure
    .query(async ({ ctx }) => {
      try {
        const token = twilioWebRTCService.generateVoiceAccessToken(
          `agent-${ctx.user.id}`,
          ctx.tenantId
        );
        return { token };
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        console.error("[Phone Router] Error generating token:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la génération du token",
        });
      }
    }),

  /**
   * Validate phone number
   */
  validatePhoneNumber: tenantProcedure
    .input(z.object({
      phoneNumber: z.string(),
    }))
    .query(async ({ input }) => {
      const isValid = twilioWebRTCService.validatePhoneNumber(input.phoneNumber);
      return { isValid };
    }),

  /**
   * Format phone number
   */
  formatPhoneNumber: tenantProcedure
    .input(z.object({
      phoneNumber: z.string(),
      countryCode: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const formatted = twilioWebRTCService.formatPhoneNumber(
        input.phoneNumber,
        input.countryCode
      );
      return { formatted };
    }),

  /**
   * Initiate outbound call
   */
  initiateCall: agentProcedure // Restricted to agents only
    .input(z.object({
      toNumber: z.string(),
      prospectId: z.number().optional(),
      isAI: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify prospect belongs to tenant if provided
        if (input.prospectId) {
          const prospect = await db.getProspectById(input.prospectId, ctx.tenantId);
          if (!prospect) throw new TRPCError({ code: "NOT_FOUND" });
        }

        const call = await twilioService.createOutboundCall(
          input.toNumber,
          ctx.tenantId,
          input.prospectId,
          input.isAI
        );

        // Create call record in database
        await db.createCall({
          tenantId: ctx.tenantId,
          prospectId: input.prospectId,
          agentId: ctx.user.id,
          callType: "outbound",
          fromNumber: process.env['TWILIO_PHONE_NUMBER'] || "+1234567890",
          toNumber: input.toNumber,
        });

        return {
          success: true,
          callSid: call.sid,
          message: "Appel initié avec succès",
        };
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        console.error("[Phone Router] Error initiating call:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de l'initiation de l'appel",
        });
      }
    }),

  /**
   * End call and trigger processing
   */
  endCall: tenantProcedure // Agents can end calls
    .input(z.object({
      callSid: z.string(),
      callId: z.number().optional(),
      recordingUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify call belongs to tenant if callId provided
        if (input.callId) {
          const call = await db.getCallById(input.callId, ctx.tenantId);
          if (!call) throw new TRPCError({ code: "NOT_FOUND" });
        }

        await twilioService.endCall(input.callSid);
        
        // If we have callId and recordingUrl, trigger background processing
        if (input.callId && input.recordingUrl) {
          callWorkflowService.processCompletedCall(input.callId, input.recordingUrl)
            .catch(err => console.error("[Phone Router] Background processing error:", err));
        }
        
        return { success: true, processingStarted: !!(input.callId && input.recordingUrl) };
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        console.error("[Phone Router] Error ending call:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la fin de l'appel",
        });
      }
    }),

  /**
   * Transfer call to agent
   */
  transferCall: tenantProcedure
    .input(z.object({
      callSid: z.string(),
      agentPhoneNumber: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        await twilioService.transferCall(input.callSid, input.agentPhoneNumber);
        return { success: true };
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        console.error("[Phone Router] Error transferring call:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors du transfert d'appel",
        });
      }
    }),

  /**
   * Send SMS
   */
  sendSMS: tenantProcedure
    .input(z.object({
      toNumber: z.string(),
      message: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        const messageSid = await twilioService.sendSMS({ to: input.toNumber, body: input.message });
        return { success: true, messageSid };
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        console.error("[Phone Router] Error sending SMS:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de l'envoi du SMS",
        });
      }
    }),

  // ============================================
  // AI QUALIFICATION & ANALYSIS
  // ============================================

  /**
   * Qualify caller from transcription
   */
  qualifyCaller: tenantProcedure
    .input(z.object({
      transcription: z.string(),
      callerPhone: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const tenant = await db.getTenantById(ctx.tenantId);
        
        const qualification = await aiService.qualifyCallerFromTranscription(
          input.transcription,
          input.callerPhone,
          tenant ? {
            tenantId: ctx.tenantId!,
            tenantName: tenant.name,
            businessType: "Service Client",
            departments: ["Support", "Ventes", "Facturation"],
          } : undefined
        );

        // Create prospect if needed
        if (qualification.prospectName && qualification.prospectName !== "Prospect inconnu") {
          await db.createProspect({
            tenantId: ctx.tenantId,
            firstName: qualification.prospectName.split(" ")?.[0] ?? "",
            lastName: qualification.prospectName.split(" ").slice(1).join(" "),
            email: qualification.prospectEmail,
            phone: qualification.prospectPhone,
            company: qualification.prospectCompany,
            source: "call",
            notes: qualification.notes,
          });
        }

        return qualification;
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        console.error("[Phone Router] Error qualifying caller:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la qualification du prospect",
        });
      }
    }),

  /**
   * Generate AI response
   */
  generateAIResponse: tenantProcedure
    .input(z.object({
      callerMessage: z.string(),
      prospectName: z.string(),
      callReason: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const tenant = await db.getTenantById(ctx.tenantId);

        const response = await aiService.generateAIResponse(
          input.callerMessage,
          {
            tenantId: ctx.tenantId!,
            prospectName: input.prospectName,
            callReason: input.callReason,
            tenantName: tenant?.name ?? "Servicall",
          }
        );

        return { response };
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        console.error("[Phone Router] Error generating AI response:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la génération de la réponse IA",
        });
      }
    }),

  /**
   * Transcribe call recording
   */
  transcribeCall: tenantProcedure
    .input(z.object({
      audioUrl: z.string(),
      language: z.string().default("fr"),
    }))
    .mutation(async ({ input }) => {
      try {
        const transcription = await aiService.transcribeCallRecording(
          input.audioUrl,
          input.language
        );

        return { transcription };
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        console.error("[Phone Router] Error transcribing call:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la transcription",
        });
      }
    }),

  /**
   * Generate call summary
   */
  generateCallSummary: tenantProcedure
    .input(z.object({
      transcription: z.string(),
      duration: z.number(),
      callReason: z.string(),
      prospectName: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        const summary = await aiService.generateCallSummary(
          input.transcription,
          {
            duration: input.duration,
            callReason: input.callReason,
            prospectName: input.prospectName,
          }
        );

        return { summary };
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        console.error("[Phone Router] Error generating summary:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la génération du résumé",
        });
      }
    }),

  /**
   * Analyze call quality
   */
  analyzeCallQuality: tenantProcedure
    .input(z.object({
      transcription: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        const analysis = await aiService.analyzeCallQuality(input.transcription);
        return analysis;
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        console.error("[Phone Router] Error analyzing call quality:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de l'analyse de qualité",
        });
      }
    }),

  /**
   * Extract action items
   */
  extractActionItems: tenantProcedure
    .input(z.object({
      transcription: z.string(),
      prospectName: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        const actions = await aiService.extractActionItems(
          input.transcription
        );

        return { actions };
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        console.error("[Phone Router] Error extracting action items:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de l'extraction des actions",
        });
      }
    }),

  /**
   * Get real-time coach advice
   */
  getCoachAdvice: tenantProcedure
    .input(z.object({
      transcription: z.string(),
      prospectId: z.number(),
      callReason: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      const prospect = await db.getProspectById(input.prospectId, ctx.tenantId);
      if (!prospect) throw new TRPCError({ code: "NOT_FOUND", message: "Prospect not found" });

      return await CoachService.getRealTimeAdvice(
        input.transcription,
        prospect,
        input.callReason
      );
    }),

  /**
   * Calculate and update prospect score
   */
  updateProspectScore: managerProcedure // Restricted to manager
    .input(z.object({
      prospectId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const prospect = await db.getProspectById(input.prospectId, ctx.tenantId);
      if (!prospect) throw new TRPCError({ code: "NOT_FOUND", message: "Prospect not found" });

      const scoreResult = await ScoringService.calculateProspectScore(input.prospectId);
      const score = scoreResult.score;

      await db.updateProspect(input.prospectId, { 
        metadata: { ...(prospect.metadata as Record<string, unknown>), score, category: ScoringService.getProspectCategory(score) }
      });

      return { score, category: ScoringService.getProspectCategory(score) };
    }),

  /**
   * Check Twilio configuration status
   */
  // checkTwilioConfig: protectedProcedure.query(async ({_ctx}) => {
  //   try {
  //     const hasAccountSid = !!process.env['TWILIO_ACCOUNT_SID'] && process.env['TWILIO_ACCOUNT_SID'].length > 0;
  //     const hasAuthToken = !!process.env['TWILIO_AUTH_TOKEN'] && process.env['TWILIO_AUTH_TOKEN'].length > 0;
  //     const hasPhoneNumber = !!process.env['TWILIO_PHONE_NUMBER'] && process.env['TWILIO_PHONE_NUMBER'].length > 0;
  //     const isConfigured = hasAccountSid && hasAuthToken;
  //     const isReady = isConfigured && hasPhoneNumber;
  //     return { isConfigured, isReady, hasAccountSid, hasAuthToken, hasPhoneNumber };
  //   } catch (error: unknown) {
  //     return { isConfigured: false, isReady: false, hasAccountSid: false, hasAuthToken: false, hasPhoneNumber: false };
  //   }
  // }),
});

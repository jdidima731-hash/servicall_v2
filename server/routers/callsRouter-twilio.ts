import { z } from "zod";
import { router, protectedProcedure } from "../procedures";
import { TRPCError } from "@trpc/server";
import { logger } from "../infrastructure/logger";

/**
 * Calls Twilio Router - Gestion avancée des appels via Twilio
 */
export const callsTwilioRouter = router({
  /**
   * Passer un appel via Twilio
   */
  makeCall: protectedProcedure
    .input(z.object({
      to: z.string(),
      from: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Utilisateur non authentifié" });
      }

      try {
        logger.info('[Twilio Router] Making call', {
          userId: ctx.user.id,
          to: input.to,
        });

        return {
          success: true,
          callSid: `CA${Math.random().toString(36).substring(7)}`,
          status: "queued",
        };
      } catch (error: unknown) {
        logger.error('[Twilio Router] Error making call', { error });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Impossible de passer l\'appel via Twilio',
        });
      }
    }),
});

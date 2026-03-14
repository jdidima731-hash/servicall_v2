/**
 * WORKFLOW ENGINE ROUTER
 * Expose les fonctionnalités du nouveau moteur de workflow via tRPC
 */

import { z } from "zod";
import { router } from "../_core/trpc";
import { managerProcedure } from "../procedures";
import { WorkflowEngine } from "../workflow-engine/core/WorkflowEngine";
import { Channel, EventType } from "../workflow-engine/types";
import { v4 as uuidv4 } from "uuid";
import { TRPCError } from "@trpc/server";
// import { workflowDeadLetters } from "../db"; // Table not defined in schema

const engine = new WorkflowEngine();

export const workflowEngineRouter = router({
  /**
   * Déclencher manuellement un workflow pour un prospect
   */
  triggerManual: managerProcedure
    .input(z.object({
      prospectId: z.number(),
      workflowName: z.string().optional(),
      variables: z.record(z.string(), z.any()).optional()
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const { getProspectById } = await import("../db");
        const prospect = await getProspectById(input.prospectId, ctx.tenantId);
        
        if (!prospect) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Prospect non trouvé" });
        }

        const event = {
          id: uuidv4(),
          tenant_id: ctx.tenantId,
          channel: Channel.WEBHOOK,
          type: EventType.MANUAL,
          source: 'UI_MANUAL',
          destination: '',
          data: {
            prospect,
            ...input.variables
          },
          metadata: {
            triggered_by: ctx.user.id
          },
          status: 'received',
          created_at: new Date()
        };

        const result = await engine.handle(event);

        return {
          success: true,
          execution: result
        };
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Erreur lors du déclenchement du workflow"
        });
      }
    }),

  /**
   * Simuler un événement entrant (pour test/démo)
   */
  simulateEvent: managerProcedure
    .input(z.object({
      channel: z.nativeEnum(Channel),
      source: z.string(),
      data: z.record(z.string(), z.any())
    }))
    .mutation(async ({ input, ctx }) => {
      const event = {
        id: uuidv4(),
        tenant_id: ctx.tenantId,
        channel: input.channel,
        type: EventType.INBOUND,
        source: input.source,
        destination: '',
        data: input.data,
        metadata: { simulated: true },
        status: 'received',
        created_at: new Date()
      };

      return await engine.handle(event);
    }),

  /**
   * Lister les dead letters pour le tenant actuel
   * TODO: workflowDeadLetters table not defined in schema
   */
  listDeadLetters: managerProcedure
    .input(z.object({
      limit: z.number().default(50),
      offset: z.number().default(0)
    }))
    .query(async ({ input: _input, ctx: _ctx }) => {
      // TODO: workflowDeadLetters table not defined
      return [];
    }),

  /**
   * Retenter une dead letter
   * TODO: workflowDeadLetters table not defined in schema
   */
  retryDeadLetter: managerProcedure
    .input(z.object({
      id: z.number()
    }))
    .mutation(async ({ input: _input, ctx: _ctx }) => {
      // TODO: workflowDeadLetters table not defined
      throw new TRPCError({ code: "NOT_FOUND", message: "Dead letter non trouvée" });
    }),

  /**
   * Supprimer une dead letter
   * TODO: workflowDeadLetters table not defined in schema
   */
  deleteDeadLetter: managerProcedure
    .input(z.object({
      id: z.number()
    }))
    .mutation(async ({ input: _input, ctx: _ctx }) => {
      // TODO: workflowDeadLetters table not defined
      return { success: true };
    })
});

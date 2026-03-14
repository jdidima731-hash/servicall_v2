import { z } from "zod";
import { router, protectedProcedure } from "../procedures";
import { PredictiveService } from "../services/predictiveService";
import { TRPCError } from "@trpc/server";

/**
 * Router pour l'IA prédictive
 */

export const predictiveRouter = router({
  /**
   * Génère une prédiction pour une facture
   */
  predictForInvoice: protectedProcedure
    .input(
      z.object({
        invoiceId: z.number().int().positive(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { invoiceId } = input;

      // Vérifier les permissions (la facture doit appartenir au tenant)
      const db = await import("../db").then(m => m.getDb());
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      const { customerInvoices } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const invoiceResults = await db
        .select()
        .from(customerInvoices)
        .where(eq(customerInvoices.id, invoiceId))
        .limit(1);

      if (invoiceResults.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invoice not found",
        });
      }

      const invoice = invoiceResults[0] ?? undefined;
      if (!invoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invoice not found after initial check",
        });
      }

      if (invoice.tenantId !== ctx.tenantId!) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this invoice",
        });
      }

      const success = await PredictiveService.predictForInvoice(invoiceId);

      if (!success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate prediction",
        });
      }

      const prediction = await PredictiveService.getPrediction(invoiceId);

      return {
        success: true,
        prediction,
      };
    }),

  /**
   * Récupère la prédiction d'une facture
   */
  getPrediction: protectedProcedure
    .input(
      z.object({
        invoiceId: z.number().int().positive(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { invoiceId } = input;

      // Vérifier les permissions
      const db = await import("../db").then(m => m.getDb());
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      const { customerInvoices } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const invoiceResults = await db
        .select()
        .from(customerInvoices)
        .where(eq(customerInvoices.id, invoiceId))
        .limit(1);

      if (invoiceResults.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invoice not found",
        });
      }

      const invoice = invoiceResults[0] ?? undefined;
      if (!invoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invoice not found after initial check",
        });
      }

      if (invoice.tenantId !== ctx.tenantId!) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this invoice",
        });
      }

      const prediction = await PredictiveService.getPrediction(invoiceId);

      if (!prediction) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Prediction not found for this invoice",
        });
      }

      return prediction;
    }),

  /**
   * Met à jour le résultat réel d'une prédiction
   */
  updateOutcome: protectedProcedure
    .input(
      z.object({
        invoiceId: z.number().int().positive(),
        outcome: z.enum(["accepted", "rejected", "paid"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { invoiceId, outcome } = input;

      // Vérifier les permissions
      const db = await import("../db").then(m => m.getDb());
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      const { customerInvoices } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const invoiceResults = await db
        .select()
        .from(customerInvoices)
        .where(eq(customerInvoices.id, invoiceId))
        .limit(1);

      if (invoiceResults.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invoice not found",
        });
      }

      const invoice = invoiceResults[0] ?? undefined;
      if (!invoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invoice not found after initial check",
        });
      }

      if (invoice.tenantId !== ctx.tenantId!) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this invoice",
        });
      }

      const success = await PredictiveService.updateActualOutcome(invoiceId, outcome);

      if (!success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update outcome",
        });
      }

      return {
        success: true,
        message: "Outcome updated successfully",
      };
    }),

  /**
   * Récupère la précision du modèle
   */
  getModelAccuracy: protectedProcedure.query(async ({ ctx }) => {
    const accuracy = await PredictiveService.getModelAccuracy(ctx.tenantId!);

    return {
      accuracy,
      tenantId: ctx.tenantId!,
    };
  }),
});

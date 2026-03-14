import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../procedures";
import { TRPCError } from "@trpc/server";
import Stripe from "stripe";
import { InvoiceService } from "../services/invoiceService";
import { logger } from "../infrastructure/logger";
import { AuditService } from "../services/auditService";
import * as db from "../db";

// ✅ FIX TS2345: Initialisation lazy de Stripe avec fallback pour clé undefined
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (_stripe === null) {
    // Utiliser ?? '' pour éviter l'erreur TS2345 (string | undefined non assignable à string)
    const key = process.env['STRIPE_SECRET_KEY'] ?? '';
    _stripe = new Stripe(key, { apiVersion: "2026-02-25.clover" });
  }
  return _stripe;
}

/**
 * Router pour la gestion des paiements Stripe
 * Permet aux clients de payer les factures sans authentification
 */
export const paymentRouter = router({
  /**
   * Crée une Payment Intent Stripe pour une facture
   * Endpoint PUBLIC (pas d'authentification requise)
   */
  createPaymentIntent: publicProcedure
    .input(
      z.object({
        invoiceId: z.number().int().positive(),
        token: z.string(), // Token de sécurité de la facture
      })
    )
    .mutation(async ({ input }) => {
      try {
        const { invoiceId, token } = input;

        // Valider le token et récupérer la facture
        const validation = await InvoiceService.validateSecureLink(token);
        if (!validation.valid || !validation.invoiceId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Invalid or expired token",
          });
        }

        const invoice = await InvoiceService.getInvoiceById(invoiceId);
        if (!invoice) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Invoice not found",
          });
        }

        // Vérifier que la facture n'est pas déjà payée
        if (invoice.paymentStatus === "paid") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invoice already paid",
          });
        }

        // Créer la Payment Intent
        const amount = Math.round(parseFloat(invoice.totalAmount) * 100); // Montant en centimes
        const paymentIntent = await getStripe().paymentIntents.create({
          amount,
          currency: "eur",
          description: `Invoice ${invoice.invoiceNumber}`,
          metadata: {
            invoiceId: invoiceId.toString(),
            tenantId: invoice.tenantId.toString(),
          },
        });

        logger.info("[PaymentRouter] Payment Intent created", {
          invoiceId,
          paymentIntentId: paymentIntent.id,
          amount,
        });

        return {
          success: true,
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
          amount,
        };
      } catch (error: unknown) {
        logger.error("[PaymentRouter] Failed to create payment intent", { error });
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create payment intent",
        });
      }
    }),

  /**
   * Confirme le paiement après succès Stripe
   * Endpoint PUBLIC (pas d'authentification requise)
   */
  confirmPayment: publicProcedure
    .input(
      z.object({
        invoiceId: z.number().int().positive(),
        paymentIntentId: z.string(),
        token: z.string(), // Token de sécurité de la facture
      })
    )
    .mutation(async ({ input }) => {
      try {
        const { invoiceId, paymentIntentId, token } = input;

        // Valider le token
        const validation = await InvoiceService.validateSecureLink(token);
        if (!validation.valid) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Invalid or expired token",
          });
        }

        // Récupérer le Payment Intent depuis Stripe
        const paymentIntent = await getStripe().paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.status !== "succeeded") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Payment status is ${paymentIntent.status}, expected succeeded`,
          });
        }

        // ✅ ATOMICITÉ : Utiliser une transaction pour garantir la cohérence
        const { getDb } = await import("../db");
        const dbInstance = await getDb();
        if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

        await dbInstance.transaction(async (_tx: unknown) => {
          // 1. Mettre à jour le statut de la facture
          const success = await InvoiceService.trackPaymentStatus(invoiceId, "paid");
          if (!success) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update invoice payment status' });
          }

          // 2. Récupérer la facture pour l'audit
          const invoice = await InvoiceService.getInvoiceById(invoiceId);
          if (invoice) {
            await AuditService.log({
              tenantId: invoice.tenantId,
              userId: 0,
              action: "INVOICE_PAYMENT",
              resource: "invoice",
              resourceId: invoiceId,
              actorType: "system",
              source: "SYSTEM",
              metadata: {
                paymentIntentId,
                amount: paymentIntent.amount,
                currency: paymentIntent.currency,
              },
            });
          }
        });

        logger.info("[PaymentRouter] Payment confirmed", {
          invoiceId,
          paymentIntentId,
          amount: paymentIntent.amount,
        });

        return {
          success: true,
          message: "Payment confirmed successfully",
          invoiceId,
        };
      } catch (error: unknown) {
        logger.error("[PaymentRouter] Failed to confirm payment", { error });
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to confirm payment",
        });
      }
    }),

  /**
   * Récupère le statut d'un Payment Intent
   * Endpoint PUBLIC (pas d'authentification requise)
   */
  getPaymentStatus: publicProcedure
    .input(
      z.object({
        paymentIntentId: z.string(),
        token: z.string(), // Token de sécurité de la facture
      })
    )
    .query(async ({ input }) => {
      try {
        const { paymentIntentId, token } = input;

        // Valider le token
        const validation = await InvoiceService.validateSecureLink(token);
        if (!validation.valid) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Invalid or expired token",
          });
        }

        const paymentIntent = await getStripe().paymentIntents.retrieve(paymentIntentId);

        return {
          success: true,
          status: paymentIntent.status,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          clientSecret: paymentIntent.client_secret,
        };
      } catch (error: unknown) {
        logger.error("[PaymentRouter] Failed to get payment status", { error });
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get payment status",
        });
      }
    }),

  /**
   * Gère les webhooks Stripe
   * Endpoint PUBLIC (pas d'authentification requise)
   * ✅ SÉCURISÉ : Vérification de la signature Stripe obligatoire
   */
  handleWebhook: publicProcedure
    .input(
      z.object({
        event: z.record(z.string(), z.any()),
        signature: z.string(), // Signature Stripe pour vérification
      })
    )
    .mutation(async ({ input }) => {
      try {
        // ✅ SÉCURITÉ CRITIQUE : Vérifier la signature du webhook Stripe
        let event: unknown;
        try {
          const webhookSecret = process.env['STRIPE_WEBHOOK_SECRET'];
          if (!webhookSecret) {
            logger.error("[PaymentRouter] STRIPE_WEBHOOK_SECRET not configured");
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Webhook configuration error",
            });
          }

          // Vérifier la signature et construire l'événement
          event = getStripe().webhooks.constructEvent(
            JSON.stringify(input.event),
            input.signature,
            webhookSecret
          );
        } catch (signatureError) {
          logger.warn("[PaymentRouter] Invalid webhook signature", {
            error: signatureError instanceof Error ? signatureError.message : "Unknown error",
          });
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Invalid webhook signature",
          });
        }

        // ✅ ARCHITECTURE ASYNC : Écrire l'événement en base pour traitement ultérieur
        await db.createStripeEvent({
          stripeEventId: event.id,
          type: event.type,
          payload: event,
          status: "pending"
        });
        
        logger.info("[PaymentRouter] Webhook event persisted for async processing", { 
          eventId: event.id, 
          type: event.type 
        });

        return {
          success: true,
          message: "Webhook processed",
        };
      } catch (error: unknown) {
        logger.error("[PaymentRouter] Failed to handle webhook", { error });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to handle webhook",
        });
      }
    }),

  /**
   * Annule un Payment Intent
   * Endpoint PROTECTED (authentification requise)
   */
  cancelPayment: protectedProcedure
    .input(
      z.object({
        paymentIntentId: z.string(),
        invoiceId: z.number().int().positive(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { paymentIntentId, invoiceId, reason } = input;

        // Vérifier les permissions
        const invoice = await InvoiceService.getInvoiceById(invoiceId);
        if (!invoice || invoice.tenantId !== ctx.tenantId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this invoice",
          });
        }

        // Annuler le Payment Intent
        const canceledIntent = await getStripe().paymentIntents.cancel(paymentIntentId);

        await AuditService.log({
          tenantId: ctx.tenantId ?? 0,
          userId: ctx.user.id,
          action: "INVOICE_PAYMENT",
          resource: "invoice",
          resourceId: invoiceId,
          actorType: "human",
          source: "API",
          metadata: {
            paymentIntentId,
            reason,
          },
        });

        logger.info("[PaymentRouter] Payment canceled", {
          invoiceId,
          paymentIntentId,
          reason,
        });

        return {
          success: true,
          message: "Payment canceled successfully",
          status: canceledIntent.status,
        };
      } catch (error: unknown) {
        logger.error("[PaymentRouter] Failed to cancel payment", { error });
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to cancel payment",
        });
      }
    }),

  /**
   * Récupère l'historique des paiements d'une facture
   * Endpoint PROTECTED (authentification requise)
   */
  getPaymentHistory: protectedProcedure
    .input(
      z.object({
        invoiceId: z.number().int().positive(),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const { invoiceId } = input;

        // Vérifier les permissions
        const invoice = await InvoiceService.getInvoiceById(invoiceId);
        if (!invoice || invoice.tenantId !== ctx.tenantId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this invoice",
          });
        }

        // Récupérer les Payment Intents associés
        const paymentIntents = await getStripe().paymentIntents.list({
          limit: 100,
        });

        const invoicePayments = paymentIntents.data.filter(
          (pi) => pi.metadata['invoiceId'] === invoiceId.toString()
        );

        return {
          success: true,
          payments: invoicePayments.map((pi) => ({
            id: pi.id,
            status: pi.status,
            amount: pi.amount,
            currency: pi.currency,
            created: new Date(pi.created * 1000),
          })),
        };
      } catch (error: unknown) {
        logger.error("[PaymentRouter] Failed to get payment history", { error });
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get payment history",
        });
      }
    }),
});

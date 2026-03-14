import { logger } from "../infrastructure/logger";
import * as db from "../db";
import Stripe from "stripe";

/**
 * WORKER DE TRAITEMENT DES WEBHOOKS STRIPE
 * Traite les événements en attente dans la table stripe_events
 */
export class StripeWorker {
  private static isProcessing = false;

  /**
   * Démarre la boucle de traitement
   */
  static start(intervalMs: number = 5000) {
    logger.info("[StripeWorker] Starting worker loop", { intervalMs });
    setInterval(() => this.processPendingEvents(), intervalMs);
  }

  /**
   * Traite les événements en attente
   */
  static async processPendingEvents() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const pendingEvents = await db.getPendingStripeEvents();
      if (pendingEvents.length === 0) {
        this.isProcessing = false;
        return;
      }

      logger.info(`[StripeWorker] Processing ${pendingEvents.length} pending events`);

      for (const eventRecord of pendingEvents) {
        try {
          await this.handleEvent(eventRecord);
          await db.updateStripeEventStatus(eventRecord.id, "processed");
          logger.info(`[StripeWorker] Successfully processed event`, { 
            id: eventRecord.id, 
            stripeId: eventRecord.stripeEventId,
            type: eventRecord.type 
          });
        } catch (error: unknown) {
          logger.error(`[StripeWorker] Failed to process event`, { 
            id: eventRecord.id, 
            stripeId: eventRecord.stripeEventId,
            error: error.message 
          });
          await db.updateStripeEventStatus(eventRecord.id, "failed");
        }
      }
    } catch (error: unknown) {
      logger.error("[StripeWorker] Error in worker loop", { error: error.message });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Logique métier par type d'événement
   */
  private static async handleEvent(record: unknown) {
    const event = record.payload as Stripe.Event;

    switch (event.type) {
      case "invoice.paid":
        await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case "customer.subscription.deleted":
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "payment_intent.succeeded":
        // Logique optionnelle pour les payment intents
        break;

      default:
        logger.debug(`[StripeWorker] Unhandled event type: ${event.type}`);
    }
  }

  private static async handleInvoicePaid(stripeInvoice: Stripe.Invoice) {
    logger.info(`[StripeWorker] Handling invoice.paid: ${stripeInvoice.id}`);
    
    await db.updateInvoiceByStripeId(stripeInvoice.id, {
      status: "paid",
      paidAt: new Date(),
      pdfUrl: stripeInvoice.invoice_pdf,
    });

    // In Stripe API v2026+, subscription is accessed via parent.subscription_details
    const subscriptionId = (stripeInvoice as unknown).subscription 
      ?? stripeInvoice.parent?.subscription_details?.subscription;
    if (subscriptionId) {
      await db.updateSubscriptionByStripeId(subscriptionId as string, {
        status: "active",
        currentPeriodEnd: new Date(stripeInvoice.period_end * 1000),
      });
    }
  }

  private static async handleInvoicePaymentFailed(stripeInvoice: Stripe.Invoice) {
    logger.warn(`[StripeWorker] Handling invoice.payment_failed: ${stripeInvoice.id}`);
    await db.updateInvoiceByStripeId(stripeInvoice.id, {
      status: "failed",
    });
  }

  private static async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    logger.info(`[StripeWorker] Handling customer.subscription.deleted: ${subscription.id}`);
    await db.updateSubscriptionByStripeId(subscription.id, {
      status: "expired",
    });
  }
}

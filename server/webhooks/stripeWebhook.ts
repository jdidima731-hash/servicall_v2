/**
 * BLOC 2 : Webhook Stripe Sécurisé
 * Valide les signatures Stripe et traite les événements avec protection replay
 */

import express from "express";
import Stripe from "stripe";
import { logger } from "../infrastructure/logger";
import * as db from "../db";
import { IdempotencyService } from "../workflow-engine/utils/IdempotencyService";

const router = express.Router();
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (_stripe === null) {
    // ✅ FIX: Version API unifiée avec le reste du projet (2026-02-25.clover)
    _stripe = new Stripe(process.env['STRIPE_SECRET_KEY'] ?? '', {
      apiVersion: "2026-02-25.clover",
    });
  }
  return _stripe;
}

const webhookSecret = process.env['STRIPE_WEBHOOK_SECRET'];

router.post("/stripe", express.raw({ type: "application/json" }), async (req, res): Promise<void> => {
  const sig = req.headers["stripe-signature"] as string;

  let event: Stripe.Event;
  try {
    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET not configured");
    }

    event = getStripe().webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (error: unknown) {
    logger.warn("[Stripe Webhook] Signature verification failed", { error: error.message });
    res.status(400).send(`Webhook Error: ${error.message}`); return;
  }

  // ✅ Protection contre le rejeu (Idempotence Globale)
  const isNew = await IdempotencyService.checkAndSet(event.id, "stripe");
  if (!isNew) {
    logger.info("[Stripe Webhook] Duplicate event ignored", { eventId: event.id });
    res.json({ received: true, duplicate: true }); return;
  }

  try {
    // Utilisation d'une transaction pour garantir l'intégrité de l'état central
    await db.transaction(async (_tx: unknown) => {
      switch (event.type) {
        case "payment_intent.succeeded":
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          // Logique métier atomique ici
          logger.info("[Stripe] Payment succeeded", { id: paymentIntent.id });
          break;

        case "customer.subscription.deleted":
          const subscription = event.data.object as Stripe.Subscription;
          // Désactivation atomique du tenant
          logger.info("[Stripe] Subscription deleted", { id: subscription.id });
          break;

        default:
          logger.debug("[Stripe Webhook] Unhandled event type", { type: event.type });
      }
    });

    res.json({ received: true });
  } catch (error: unknown) {
    logger.error("[Stripe Webhook] Processing error", { error, eventId: event.id });
    res.status(500).json({ error: "Internal processing error" }); return;
  }
});

export default router;

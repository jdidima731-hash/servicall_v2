import express from "express";
import Stripe from "stripe";
import { logger } from "../infrastructure/logger";
import * as db from "../db";

const router = express.Router();
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (_stripe === null) {
    _stripe = new Stripe(process.env['STRIPE_SECRET_KEY'] ?? '', {
      apiVersion: "2026-02-25.clover",
    });
  }
  return _stripe;
}

const endpointSecret = process.env['STRIPE_WEBHOOK_SECRET'];

/**
 * WEBHOOK STRIPE - ARCHITECTURE ASYNC STRICTE
 * 1. Vérifie la signature
 * 2. Écrit l'événement en base (Table de persistance)
 * 3. ACK immédiat (200 OK)
 * 4. Traitement asynchrone par worker
 */
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event: Stripe.Event;

  // 1. VÉRIFICATION DE LA SIGNATURE
  try {
    if (!sig || !endpointSecret) {
      throw new Error("Missing signature or endpoint secret");
    }
    event = getStripe().webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err: unknown) {
    logger.error(`[Stripe Webhook] Signature verification failed`, { error: err.message });
    return res.status(400).json({ error: "Webhook Error: Signature verification failed" });
  }

  logger.info(`[Stripe Webhook] Received event: ${event.type}`, { eventId: event.id });

  // 2. ÉCRITURE DE L'ÉVÉNEMENT (PERSISTANCE)
  try {
    await db.createStripeEvent({
      stripeEventId: event.id,
      type: event.type,
      payload: event as unknown,
      status: "pending"
    });

    // 3. ACK IMMÉDIAT
    // On répond 200 dès que l'événement est sécurisé en base
    return res.json({ received: true, async: true });
  } catch (err: unknown) {
    // Si l'événement existe déjà (doublon), Stripe a déjà envoyé et on a peut-être déjà ACK
    if (err.code === '23505') { // Postgres unique_violation
      logger.warn(`[Stripe Webhook] Duplicate event ignored`, { eventId: event.id });
      return res.json({ received: true, duplicate: true });
    }

    logger.error(`[Stripe Webhook] Failed to persist event`, { error: err.message, eventId: event.id });
    // On renvoie 500 pour que Stripe réessaie plus tard si on n'a pas pu écrire en base
    return res.status(500).json({ error: "Internal Server Error: Failed to persist event" });
  }
});

export default router;

/**
 * API Routes pour les webhooks Twilio
 * SÉCURISÉ : Validation de signature Twilio incluse
 */

import { Router, Request, Response } from "express";
import { db as getDb } from "../db";
import { rgpdConsents } from "../../drizzle/schema";
import { TwilioValidator } from "../services/twilioValidator";
import { webhookLimiter } from "../middleware/rateLimit";
import { logger } from "../infrastructure/logger";
import { IdempotencyService } from "../workflow-engine/utils/IdempotencyService";

const router = Router();

/**
 * Middleware de protection Twilio
 */
const twilioAuth = (req: Request, res: Response, next: unknown) => {
  if (process.env['NODE_ENV'] === "test") return next();
  
  // ✅ PHASE 2 — Tâche 6 : Retourne 403 (Forbidden) si signature invalide
  if (!TwilioValidator.validateSignature(req)) {
    return res.status(403).json({ error: "Forbidden: Invalid Twilio Signature" });
  }
  next();
};

router.use(webhookLimiter);
router.use(twilioAuth);

/**
 * Webhook pour le consentement RGPD
 */
router.post("/consent", async (req: Request, res: Response) => {
  try {
    const { prospectId, callSid, consentGiven, recordingConsent, aiDisclosure } = req.body;
    
    // Idempotence
    const eventId = callSid ? `consent-${callSid}` : `consent-${prospectId}-${Date.now()}`;
    const isNew = await IdempotencyService.checkAndSet(eventId, "twilio");
    if (!isNew) return res.status(200).json({ success: true, duplicate: true });

    // DURCI: Validation stricte des types et formats
    if (!prospectId || isNaN(parseInt(prospectId)) || typeof consentGiven !== "boolean") {
      return res.status(400).json({ success: false, error: "Missing or invalid required fields" });
    }
    if (callSid && !/^CA[a-f0-9]{32}$/.test(callSid)) {
      return res.status(400).json({ success: false, error: "Invalid callSid format" });
    }

    const db = await getDb();
    if (!db) return res.status(500).json({ success: false, error: "Database not available" });

    await db.insert(rgpdConsents).values({
      prospectId: parseInt(prospectId),
      callSid: callSid ?? null,
      consentGiven: consentGiven,
      recordingConsent: recordingConsent ?? false,
      aiDisclosure: aiDisclosure ?? false,
      timestamp: new Date(),
    });

    logger.info(`[RGPD] Consent recorded for prospect ${prospectId}`);
    return res.status(200).json({ success: true });
  } catch (error: unknown) {
    logger.error("[RGPD] Error recording consent", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/**
 * Webhook pour la notification d'enregistrement
 */
router.post("/recording", async (req: Request, res: Response) => {
  try {
    const { CallSid, RecordingSid, RecordingUrl, RecordingStatus } = req.body;
    
    // Idempotence
    const isNew = await IdempotencyService.checkAndSet(RecordingSid, "twilio-recording");
    if (!isNew) return res.status(200).json({ success: true, duplicate: true });
    
    // DURCI: Assertion de format Twilio
    if (!CallSid || !RecordingSid || !/^RE[a-f0-9]{32}$/.test(RecordingSid)) {
      return res.status(400).json({ success: false, error: "Invalid Twilio identifiers" });
    }

    logger.info(`[Twilio] Recording webhook: ${RecordingStatus}`, { CallSid, RecordingSid });

    if (RecordingStatus === "completed" && RecordingUrl) {
      // Logique de mise à jour différée via service
    }

    return res.status(200).json({ success: true });
  } catch (error: unknown) {
    logger.error("[Twilio] Error processing recording webhook", error);
    return res.status(500).json({ success: false });
  }
});

/**
 * Webhook pour les événements d'appel Twilio
 */
router.post("/call-status", async (req: Request, res: Response) => {
  try {
    const { CallSid, CallStatus, From, To, Direction, Duration, RecordingUrl } = req.body;
    
    // Idempotence (on utilise CallSid + Status car un appel a plusieurs états)
    const isNew = await IdempotencyService.checkAndSet(`${CallSid}-${CallStatus}`, "twilio-status");
    if (!isNew) return res.status(200).json({ success: true, duplicate: true });
    
    // DURCI: Validation des inputs critiques
    if (!CallSid || !/^CA[a-f0-9]{32}$/.test(CallSid)) {
      return res.status(400).json({ success: false, error: "Invalid CallSid" });
    }

    const { handleCallStatusUpdate } = await import("../services/twilioService");
    
    await handleCallStatusUpdate({
      callSid: CallSid,
      status: CallStatus,
      from: From,
      to: To,
      direction: Direction,
      duration: Duration ? parseInt(Duration) : undefined,
      recordingUrl: RecordingUrl,
    });

    return res.status(200).json({ success: true });
  } catch (error: unknown) {
    logger.error("[Twilio] Error processing call status", error);
    return res.status(500).json({ success: false });
  }
});

/**
 * Webhook pour les appels entrants Twilio
 */
router.post("/incoming-call", async (req: Request, res: Response) => {
  try {
    const { CallSid, From, To, CallStatus } = req.body;
    const { handleIncomingCall } = await import("../services/twilioService");
    
    const twimlResponse = await handleIncomingCall({
      callSid: CallSid,
      from: From,
      to: To,
      status: CallStatus,
    });

    res.type("text/xml");
    return res.send(twimlResponse);
  } catch (error: unknown) {
    logger.error("[Twilio] Error processing incoming call", error);
    res.type("text/xml");
    return res.status(500).send('<Response><Say>Erreur système</Say><Hangup/></Response>');
  }
});

export default router;

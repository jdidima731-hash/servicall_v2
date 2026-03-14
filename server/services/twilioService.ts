import twilio from "twilio";
import { logger } from "../infrastructure/logger";
import { ENV } from "../_core/env";
import { ResilienceService } from "./resilienceService";

// ⚠️ SÉCURITÉ: Les valeurs de fallback sont uniquement pour le développement
const accountSid = ENV.twilioAccountSid ?? "AC_PLACEHOLDER_DEV_ONLY";
const authToken = ENV.twilioAuthToken ?? "PLACEHOLDER_DEV_ONLY";
const phoneNumber = ENV.twilioPhoneNumber || "+00000000000";

let _client: unknown= null;

/**
 * Lazy initialization of Twilio client
 */
export function getTwilioClient() {
  if (!_client) {
    if (accountSid && accountSid.startsWith("AC") && authToken && authToken !== "PLACEHOLDER_DEV_ONLY") {
      try {
        _client = twilio(accountSid, authToken);
        logger.info("[Twilio] Client initialized");
      } catch (error: unknown) {
        logger.error("[Twilio] Failed to initialize Twilio client", error);
      }
    } else {
      logger.warn("[Twilio] Missing or invalid credentials, client not initialized");
    }
  }
  return _client;
}

export function reinitTwilioClient() {
  _client = null;
  return getTwilioClient();
}

export interface CallRouting {
  tenantId: number;
  prospectPhone: string;
  prospectName?: string;
  useAI: boolean;
  agentId?: number;
}

/**
 * Initiate an inbound call with Twilio
 */
export async function handleIncomingCall(params: {
  callSid: string;
  from: string;
  to: string;
  status: string;
}): Promise<string> {
  try {
    const { callSid, from, to } = params;
    logger.info("[Twilio] Handling incoming call", { callSid, from, to });

    const { getDb, createCall } = await import("../db");
    const db = await getDb();

    // 1. Workflow Engine Trigger (will be called after tenant resolution)

    const twiml = new twilio.twiml.VoiceResponse();

    if (!db) {
      logger.warn("[Twilio] Database not available, using default AI routing");
      twiml.say({ voice: "alice", language: "fr-FR" }, "Bienvenue chez Servicall. Nous traitons votre demande.");
      twiml.play("http://com.twilio.music.classic.s3.amazonaws.com/wait.mp3");
      return twiml.toString();
    }

    const { prospects, users } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");

    const prospectResults = await db
      .select()
      .from(prospects)
      .where(eq(prospects.phone, from))
      .limit(1);

    let agentType: "AI" | "HUMAN" = "AI";
    let userId: number | undefined;
    let tenantId: number | null = null;

    if (prospectResults.length > 0) {
      const prospect = prospectResults[0];
      tenantId = prospect.tenantId;
      
      if (prospect.assignedTo) {
        const userResults = await db
          .select()
          .from(users)
          .where(eq(users.id, prospect.assignedTo))
          .limit(1);

        if (userResults.length > 0) {
          const user = userResults[0];
          // @ts-ignore
          agentType = (user.assignedAgentType as "AI" | "HUMAN") || "AI";
          userId = user.id;
        }
      }
    }

    if (!tenantId) {
      logger.warn("[Twilio] Appel entrant sans tenant associé (prospect inconnu)", { from, callSid });
      const errorTwiml = new twilio.twiml.VoiceResponse();
      errorTwiml.say({ voice: "alice", language: "fr-FR" }, "Désolé, nous ne pouvons pas identifier votre compte. Veuillez contacter le support.");
      errorTwiml.hangup();
      return errorTwiml.toString();
    }

    const callRecord = await createCall({
      tenantId,
      prospectId: prospectResults.length > 0 ? prospectResults[0].id : undefined,
      agentId: userId,
      callType: "inbound",
      status: "in_progress",
      callSid: callSid,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // ✅ BLOC 2 : Déclenchement centralisé du workflow live_call_started
    const { LiveCallTriggerService } = await import("./liveCallTriggerService");
    LiveCallTriggerService.triggerAsync({
      callSid,
      callId: callRecord?.id,
      tenantId: tenantId!,
      from,
      to,
      direction: "inbound",
      prospect: prospectResults[0] || null,
      metadata: {
        agentType,
        userId,
      },
    });

    if (agentType === "AI") {
      twiml.say({ voice: "alice", language: "fr-FR" }, "Bienvenue. Je suis votre assistant intelligent. Comment puis-je vous aider ?");
      const webhookBase = process.env['WEBHOOK_URL'] || "https://api.servicall.local";
      const connect = twiml.connect();
      connect.stream({
        url: `wss://${new URL(webhookBase).host}/voice-ai`,
        name: "VoiceAIStream",
      });
    } else {
      twiml.say({ voice: "alice", language: "fr-FR" }, "Bienvenue. Je vous mets en relation avec un agent. Veuillez patienter.");
      twiml.dial(phoneNumber);
    }

    return twiml.toString();
  } catch (error: unknown) {
    logger.error("[Twilio] Error handling inbound call", { error });
    const errorTwiml = new twilio.twiml.VoiceResponse();
    errorTwiml.say({ voice: "alice", language: "fr-FR" }, "Désolé, nous rencontrons une difficulté technique. Veuillez nous rappeler ultérieurement.");
    errorTwiml.hangup();
    return errorTwiml.toString();
  }
}

const callLocks = new Set<string>();

/**
 * Create an outbound call
 */
export async function createOutboundCall(
  toNumber: string,
  tenantId: number,
  prospectId?: number,
  isAI: boolean = false
): Promise<any> {
  return ResilienceService.execute(
    async () => {
      if (callLocks.has(toNumber)) {
        throw new Error("Call already in progress for this number");
      }
      callLocks.add(toNumber);

      const { jobQueue } = await import("./jobQueueService");

      const jobId = await jobQueue.enqueue("WORKFLOW_EXECUTE", tenantId, {
        toNumber,
        tenantId,
        prospectId,
        isAI,
        type: 'outbound-call'
      });

      logger.info(`[Twilio] Outbound call added to queue`, { 
        jobId, 
        toNumber,
        tenantId 
      });

      setTimeout(() => callLocks.delete(toNumber), 30000);
      return { jobId, status: "queued" };
    },
    {
      name: "TWILIO_OUTBOUND_QUEUE",
      module: "TWILIO",
      idempotencyKey: `call_${tenantId}_${toNumber}_${Date.now().toString().substring(0, 8)}`
    }
  );
}

/**
 * Internal function to trigger the Twilio call via API
 */
/**
 * Alias for createOutboundCallInternal to match DialerEngine requirements
 */
export async function makeCall(toNumber: string, _message?: string, tenantId: number = 1): Promise<string> {
  const call = await createOutboundCallInternal(toNumber, tenantId, undefined, false);
  return call.sid;
}

export async function createOutboundCallInternal(
  toNumber: string,
  tenantId: number,
  prospectId?: number,
  isAI: boolean = false
): Promise<any> {
  return ResilienceService.execute(
    async () => {
      const client = getTwilioClient();
      if (!client) throw new Error("Twilio client not initialized");

      const webhookBase = process.env['WEBHOOK_URL'] || "https://api.servicall.local";
      const url = isAI 
        ? `${webhookBase}/webhooks/ai-outbound?tenantId=${tenantId}&prospectId=${prospectId}`
        : `${webhookBase}/webhooks/call-status?tenantId=${tenantId}&prospectId=${prospectId}`;

      const call = await client.calls.create({
        from: phoneNumber,
        to: toNumber,
        url: url,
        statusCallback: `${webhookBase}/webhooks/call-status?tenantId=${tenantId}&prospectId=${prospectId}`,
        statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
        record: true,
        recordingChannels: "mono",
      });

      // Observabilité : Coût estimé (0.015$ par minute)
      logger.info(`[Twilio] Call initiated`, { 
        module: "TWILIO",
        callSid: call.sid, 
        toNumber,
        tenantId,
        estimated_min_cost: 0.015
      });

      return call;
    },
    {
      name: "TWILIO_API_CALL",
      module: "TWILIO",
      timeoutMs: 10000,
      validateResponse: (data) => !!data.sid
    }
  );
}

/**
 * Handle call status updates
 */
export async function handleCallStatusUpdate(params: {
  callSid: string;
  status: string;
  from: string;
  to: string;
  direction: string;
  duration?: number;
  recordingUrl?: string;
}): Promise<void> {
  try {
    const { callSid, status, duration, recordingUrl } = params;
    logger.info("[Twilio] Call status update", { callSid });

    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return;

    const { calls } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");

    const updateData: unknown= {
      status: status === "in-progress" || status === "answered" ? "in_progress" : status,
      updatedAt: new Date(),
    };

    if (duration) {
      updateData.duration = duration;
      // Observabilité : Coût réel estimé
      const cost = (duration / 60) * 0.015;
      logger.info("[Twilio] Call Metrics", { 
        module: "TWILIO",
        callSid, 
        duration_sec: duration, 
        estimated_cost_usd: cost 
      });
    }
    if (recordingUrl) updateData.recordingUrl = recordingUrl;

    await db.update(calls).set(updateData).where(eq(calls.callSid, callSid));
  } catch (error: unknown) {
    logger.error("[Twilio] Error handling status update", error, { module: "TWILIO" });
  }
}

/**
 * Send SMS
 */
export async function sendSMS(params: {
  to: string;
  body: string;
  tenantId?: number;
}): Promise<any> {
  return ResilienceService.execute(
    async () => {
      const client = getTwilioClient();
      if (!client) throw new Error("Twilio client not initialized");

      const message = await client.messages.create({
        from: phoneNumber,
        to: params.to,
        body: params.body,
      });

      // Observabilité : Coût SMS (0.0075$ par segment)
      logger.info("[Twilio] SMS sent", { 
        module: "TWILIO",
        messageSid: message.sid, 
        to: params.to,
        tenantId: params.tenantId,
        estimated_cost_usd: 0.0075
      });

      return message;
    },
    {
      name: "TWILIO_SEND_SMS",
      module: "TWILIO",
      validateResponse: (data) => !!data.sid
    }
  );
}

/**
 * Send WhatsApp Message
 */
export async function sendWhatsAppMessage(params: {
  to: string;
  body: string;
  tenantId?: number;
}): Promise<any> {
  return ResilienceService.execute(
    async () => {
      const client = getTwilioClient();
      if (!client) throw new Error("Twilio client not initialized");

      // WhatsApp numbers must be prefixed with 'whatsapp:'
      const to = params.to.startsWith('whatsapp:') ? params.to : `whatsapp:${params.to}`;
      const from = phoneNumber.startsWith('whatsapp:') ? phoneNumber : `whatsapp:${phoneNumber}`;

      const message = await client.messages.create({
        from,
        to,
        body: params.body,
      });

      // Observabilité : Coût WhatsApp (0.005$ par message + frais de session)
      logger.info("[Twilio] WhatsApp message sent", { 
        module: "TWILIO",
        messageSid: message.sid, 
        to,
        tenantId: params.tenantId,
        estimated_cost_usd: 0.005
      });

      return message;
    },
    {
      name: "TWILIO_SEND_WHATSAPP",
      module: "TWILIO",
      validateResponse: (data) => !!data.sid
    }
  );
}


/**
 * ✅ BLOC 3: Termine un appel spécifique
 */
export async function endCall(callSid: string): Promise<any> {
  return ResilienceService.execute(
    async () => {
      const client = getTwilioClient();
      if (!client) throw new Error("Twilio client not initialized");
      
      logger.info("[Twilio] Ending call", { callSid });
      
      const call = await client.calls(callSid).update({
        status: 'completed'
      });
      
      logger.info("[Twilio] Call ended successfully", { callSid, status: call.status });
      return call;
    },
    {
      name: "TWILIO_END_CALL",
      module: "TWILIO",
      validateResponse: (data) => !!data.sid
    }
  );
}

/**
 * ✅ BLOC 3: Transfère un appel vers un autre numéro ou agent
 */
export async function transferCall(callSid: string, targetNumber: string): Promise<any> {
  return ResilienceService.execute(
    async () => {
      const client = getTwilioClient();
      if (!client) throw new Error("Twilio client not initialized");
      
      logger.info("[Twilio] Transferring call", { callSid, targetNumber });
      
      // Créer une réponse TwiML pour le transfert
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.dial(targetNumber);
      
      // Mettre à jour l'appel avec la nouvelle destination
      const call = await client.calls(callSid).update({
        twiml: twiml.toString()
      });
      
      logger.info("[Twilio] Call transferred successfully", { callSid, targetNumber });
      return call;
    },
    {
      name: "TWILIO_TRANSFER_CALL",
      module: "TWILIO",
      validateResponse: (data) => !!data.sid
    }
  );
}

/**
 * ✅ BLOC 3: Récupère les détails d'un appel via Twilio
 */
export async function getCallDetails(callSid: string): Promise<any> {
  return ResilienceService.execute(
    async () => {
      const client = getTwilioClient();
      if (!client) throw new Error("Twilio client not initialized");
      
      logger.info("[Twilio] Fetching call details", { callSid });
      
      const call = await client.calls(callSid).fetch();
      
      return {
        sid: call.sid,
        from: call.from,
        to: call.to,
        status: call.status,
        duration: call.duration,
        startTime: call.startTime,
        endTime: call.endTime,
        price: call.price,
        direction: call.direction
      };
    },
    {
      name: "TWILIO_GET_CALL_DETAILS",
      module: "TWILIO",
      timeoutMs: 5000
    }
  );
}

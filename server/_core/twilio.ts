/**
 * Configuration et Intégration Twilio pour Servicall v2.0
 * Gère les appels réels avec support du consentement RGPD vocal
 */

import twilio from "twilio";
import { ENV as env } from "./env";

// Initialiser le client Twilio avec gestion des erreurs
// ⚠️ SÉCURITÉ: Les valeurs de fallback sont uniquement pour le développement
// En production, ces variables DOIVENT être définies via .env
let twilioClient: unknown= null;
const accountSid = env.twilioAccountSid;
const authToken = env.twilioAuthToken;

if (accountSid && accountSid.startsWith("AC") && authToken) {
  try {
    twilioClient = twilio(accountSid, authToken);
  } catch (error: unknown) {
    console.warn("[Twilio] Failed to initialize Twilio client");
  }
}

export { twilioClient };

/**
 * Configuration Twilio
 */
export const twilioConfig = {
  accountSid: env.twilioAccountSid,
  authToken: env.twilioAuthToken,
  phoneNumber: env.twilioPhoneNumber,
  twimlUrl: process.env['TWILIO_TWIML_URL'] || "https://your-domain.com/api/twiml",
  recordingUrl: process.env['TWILIO_RECORDING_URL'] || "https://your-domain.com/api/recording",
};

/**
 * Types pour les appels Twilio
 */
export interface CallOptions {
  to: string; // Numéro à appeler
  from?: string; // Numéro d'appel (par défaut: TWILIO_PHONE_NUMBER)
  isAI?: boolean; // Si l'appel est fait par une IA
  shouldRecord?: boolean; // Si l'appel doit être enregistré
  consentGiven?: boolean; // Si le consentement RGPD a été donné
  prospectName?: string; // Nom du prospect
  agentName?: string; // Nom de l'agent (si humain)
  workflowId?: number; // ID du workflow
  prospectId?: number; // ID du prospect
}

export interface CallResult {
  success: boolean;
  callSid?: string;
  error?: string;
  message?: string;
}

export interface RecordingResult {
  success: boolean;
  recordingSid?: string;
  recordingUrl?: string;
  error?: string;
}

/**
 * Générer le TwiML pour un appel avec consentement RGPD
 * @param options Options de l'appel
 * @returns TwiML string
 */
export function generateTwiML(options: CallOptions): string {
  const { isAI, prospectName, agentName } = options;

  let twiml = '<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n';

  // Ajouter le message de consentement RGPD
  if (isAI) {
    // Message IA
    twiml += `  <Say voice="alice">
    Bonjour ${prospectName ?? ""}. Vous êtes en communication avec une intelligence artificielle de Servicall.
    Acceptez-vous d'être appelé et enregistré ? Appuyez sur 1 pour accepter, ou 2 pour refuser.
  </Say>\n`;
  } else {
    // Message humain
    twiml += `  <Say voice="alice">
    Bonjour ${prospectName ?? ""}, ${agentName || "un agent"} de Servicall à l'appareil.
    Nous aimerions vous appeler et enregistrer cet appel à titre informatif. Acceptez-vous ?
  </Say>\n`;
  }

  // Ajouter la collecte des touches DTMF
  twiml += `  <Gather numDigits="1" action="${twilioConfig.recordingUrl}?consent=true" method="POST">
    <Say voice="alice">Appuyez sur 1 pour accepter ou 2 pour refuser.</Say>
  </Gather>\n`;

  // Message par défaut si pas de réponse
  twiml += `  <Say voice="alice">Nous n'avons pas reçu votre réponse. L'appel va se terminer.</Say>\n`;
  twiml += `  <Hangup />\n`;
  twiml += `</Response>`;

  return twiml;
}

/**
 * Lancer un appel via Twilio
 * @param options Options de l'appel
 * @returns Résultat de l'appel
 */
export async function initiateCall(options: CallOptions): Promise<CallResult> {
  try {
    // Valider les paramètres
    if (!options.to) {
      return {
        success: false,
        error: "Numéro de destination requis",
      };
    }

    if (!twilioConfig.accountSid || !twilioConfig.authToken) {
      return {
        success: false,
        error: "Configuration Twilio manquante",
      };
    }

    // Générer le TwiML
    const twiml = generateTwiML(options);

    // Créer l'appel
    const call = await twilioClient.calls.create({
      to: options.to,
      from: options.from || twilioConfig.phoneNumber,
      twiml: twiml,
      record: options.shouldRecord ? true : false,
      recordingChannels: "mono",
      recordingStatusCallback: `${twilioConfig.recordingUrl}?callSid={CallSid}&prospectId=${options.prospectId}`,
      recordingStatusCallbackMethod: "POST",
    });

    return {
      success: true,
      callSid: call.sid,
      message: `Appel lancé avec succès (SID: ${call.sid})`,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Erreur lors du lancement de l'appel:", errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Terminer un appel
 * @param callSid SID de l'appel à terminer
 * @returns Résultat
 */
export async function terminateCall(callSid: string): Promise<CallResult> {
  try {
    const call = await twilioClient.calls(callSid).update({
      status: "completed",
    });

    return {
      success: true,
      callSid: call.sid,
      message: "Appel terminé avec succès",
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Erreur lors de la terminaison de l'appel:", errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Récupérer les détails d'un appel
 * @param callSid SID de l'appel
 * @returns Détails de l'appel
 */
export async function getCallDetails(callSid: string) {
  try {
    const call = await twilioClient.calls(callSid).fetch();

    return {
      success: true,
      call: {
        sid: call.sid,
        from: call.from,
        to: call.to,
        status: call.status,
        duration: call.duration,
        price: call.price,
        priceUnit: call.priceUnit,
        startTime: call.startTime,
        endTime: call.endTime,
      },
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Erreur lors de la récupération des détails:", errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Récupérer les enregistrements d'un appel
 * @param callSid SID de l'appel
 * @returns Liste des enregistrements
 */
export async function getCallRecordings(callSid: string): Promise<RecordingResult> {
  try {
    const recordings = await twilioClient
      .calls(callSid)
      .recordings.list({ limit: 20 });

    if (recordings.length === 0) {
      return {
        success: false,
        error: "Aucun enregistrement trouvé",
      };
    }

    const recording = recordings[0]!;
    const recordingUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioConfig.accountSid}/Recordings/${recording.sid}.mp3`;

    return {
      success: true,
      recordingSid: recording.sid,
      recordingUrl: recordingUrl,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Erreur lors de la récupération de l'enregistrement:", errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Lister tous les appels
 * @param limit Nombre d'appels à récupérer
 * @returns Liste des appels
 */
export async function listCalls(limit: number = 50) {
  try {
    const calls = await twilioClient.calls.list({ limit });

    return {
      success: true,
      calls: calls.map((call: unknown) => ({
        sid: call.sid,
        from: call.from,
        to: call.to,
        status: call.status,
        duration: call.duration,
        startTime: call.startTime,
        endTime: call.endTime,
      })),
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Erreur lors de la récupération des appels:", errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Envoyer un SMS via Twilio (pour les confirmations)
 * @param to Numéro de destination
 * @param message Message à envoyer
 * @returns Résultat
 */
export async function sendSMS(to: string, message: string) {
  try {
    const sms = await twilioClient.messages.create({
      body: message,
      from: twilioConfig.phoneNumber,
      to: to,
    });

    return {
      success: true,
      messageSid: sms.sid,
      message: "SMS envoyé avec succès",
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Erreur lors de l'envoi du SMS:", errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Envoyer un message WhatsApp via Twilio
 * @param to Numéro WhatsApp de destination
 * @param message Message à envoyer
 * @returns Résultat
 */
export async function sendWhatsApp(to: string, message: string) {
  try {
    const whatsapp = await twilioClient.messages.create({
      body: message,
      from: `whatsapp:${twilioConfig.phoneNumber}`,
      to: `whatsapp:${to}`,
    });

    return {
      success: true,
      messageSid: whatsapp.sid,
      message: "Message WhatsApp envoyé avec succès",
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Erreur lors de l'envoi du message WhatsApp:", errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

import * as twilioService from "./twilioService";
import axios from "axios";
import { logger } from "../infrastructure/logger";
import { ResilienceService } from "./resilienceService";

/**
 * Notification Service - Envoi de confirmations par SMS et Email avec Résilience
 */

/**
 * Send appointment confirmation via SMS
 */
export async function sendAppointmentSMS(
  phoneNumber: string,
  appointment: {
    title: string;
    startTime: Date;
    location?: string;
  }
): Promise<boolean> {
  try {
    const dateStr = appointment.startTime.toLocaleString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });

    const message = `Confirmation Servicall : Votre rendez-vous "${appointment.title}" est prévu le ${dateStr}.${
      appointment.location ? ` Lieu : ${appointment.location}` : ""
    }`;

    if (process.env['MOCK_NOTIFICATIONS'] === "true") {
      logger.info(`[MOCK][SMS] To: ${phoneNumber}, Message: ${message}`);
      return true;
    }

    // Utilisation du twilioService qui a déjà sa propre résilience
    await twilioService.sendSMS({ to: phoneNumber, body: message });
    return true;
  } catch (error: unknown) {
    logger.error("[Notification Service] Error sending SMS", error, { module: "TWILIO" });
    return false;
  }
}

/**
 * Send appointment confirmation via Email (SendGrid)
 */
export async function sendAppointmentEmail(
  email: string,
  appointment: {
    title: string;
    startTime: Date;
    endTime: Date;
    description?: string;
    location?: string;
  }
): Promise<boolean> {
  const apiKey = process.env['SENDGRID_API_KEY'];
  if (!apiKey) {
    logger.warn("[Notification Service] SendGrid API Key missing");
    return false;
  }

  const dateStr = appointment.startTime.toLocaleString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

  const data = {
    personalizations: [{ to: [{ email }] }],
    from: { email: process.env['FROM_EMAIL'] || "no-reply@servicall.local", name: "Servicall CRM" },
    subject: `Confirmation de rendez-vous : ${appointment.title}`,
    content: [
      {
        type: "text/html",
        value: `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2>Confirmation de votre rendez-vous</h2>
            <p>Bonjour,</p>
            <p>Votre rendez-vous a été programmé avec succès :</p>
            <ul>
              <li><strong>Sujet :</strong> ${appointment.title}</li>
              <li><strong>Date :</strong> ${dateStr}</li>
              ${appointment.location ? `<li><strong>Lieu :</strong> ${appointment.location}</li>` : ""}
            </ul>
            ${appointment.description ? `<p><strong>Notes :</strong> ${appointment.description}</p>` : ""}
            <p>Merci de votre confiance,</p>
            <p>L'équipe Servicall</p>
          </div>
        `,
      },
    ],
  };

  if (process.env['MOCK_NOTIFICATIONS'] === "true") {
    logger.info(`[MOCK][EMAIL] To: ${email}, Subject: ${data.subject}`);
    return true;
  }

  try {
    await ResilienceService.execute(
      async () => {
        await axios.post("https://api.sendgrid.com/v3/mail/send", data, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        });
      },
      {
        name: "SENDGRID_EMAIL_SEND",
        module: "SYSTEM",
        idempotencyKey: `email_${email}_${appointment.startTime.getTime()}`
      }
    );
    return true;
  } catch (error: unknown) {
    logger.error("[Notification Service] Error sending Email", error, { module: "SYSTEM" });
    return false;
  }
}

/**
 * Alias générique pour l'envoi d'email (pour compatibilité future)
 */
export async function sendEmail(params: { to: string, subject: string, text: string, html?: string, tenantId?: number }): Promise<void> {
  await sendAppointmentEmail(params.to, {
    title: params.subject,
    startTime: new Date(),
    endTime: new Date(),
    description: params.text
  });
}

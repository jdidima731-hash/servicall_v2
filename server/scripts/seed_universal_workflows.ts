/**
 * SEED UNIVERSAL WORKFLOWS
 * Initialise les workflows pour les différents métiers
 */

import { getDb, workflows, tenants } from "../db";
import { Channel } from "../workflow-engine/types";
import { logger } from '../core/logger/index';

async function seed() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  logger.info("🌱 Seeding universal workflows...");

  // Récupérer tous les tenants
  const allTenants = await db.select().from(tenants).execute();

  for (const tenant of allTenants) {
    logger.info(`Configuring workflows for tenant: ${tenant.name}`);

    // 1. Workflow Immobilier (Qualification)
    await db.insert(workflows).values({
      tenantId: tenant.id,
      name: "Qualification Immobilière Automatique",
      description: "Qualifie les prospects entrants par appel ou SMS",
      triggerType: "event",
      triggerConfig: { channel: Channel.CALL },
      isActive: true,
      actions: [
        {
          name: "create_lead",
          action_type: "create_lead",
          config: { source: "Appel Entrant" }
        },
        {
          name: "ai_score",
          action_type: "ai_score",
          config: {}
        },
        {
          name: "send_confirmation_sms",
          action_type: "send_sms",
          config: {
            body: "Bonjour {{variables.firstName}}, merci pour votre appel. Un agent immobilier vous recontactera sous peu. Votre score de priorité est {{variables.ai_score}}."
          }
        }
      ]
    }).execute();

    // 2. Workflow Médecin (Rappel RDV)
    await db.insert(workflows).values({
      tenantId: tenant.id,
      name: "Rappel de Rendez-vous Médical",
      description: "Envoie un rappel automatique 24h avant le RDV",
      triggerType: "scheduled",
      triggerConfig: { channel: Channel.SMS },
      isActive: true,
      actions: [
        {
          name: "send_reminder_sms",
          action_type: "send_sms",
          config: {
            body: "Rappel : Vous avez rendez-vous demain à {{variables.appointment_time}}. Veuillez confirmer par OUI ou NON."
          }
        }
      ]
    }).execute();

    // 3. Workflow Restaurant (Confirmation Réservation)
    await db.insert(workflows).values({
      tenantId: tenant.id,
      name: "Confirmation Réservation Restaurant",
      description: "Confirme les réservations reçues via WhatsApp ou Formulaire",
      triggerType: "event",
      triggerConfig: { channel: Channel.FORM },
      isActive: true,
      actions: [
        {
          name: "create_prospect",
          action_type: "create_lead",
          config: { source: "Réservation Web" }
        },
        {
          name: "send_whatsapp_conf",
          action_type: "send_sms", // On utilise send_sms pour la démo
          config: {
            body: "Votre table pour {{variables.guests}} personnes est confirmée pour ce soir à {{variables.time}}. À bientôt !"
          }
        }
      ]
    }).execute();
  }

  logger.info("✅ Seeding completed!");
}

seed().catch(console.error);

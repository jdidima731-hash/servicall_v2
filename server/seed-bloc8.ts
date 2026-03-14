/**
 * SEED BLOC 8 - WORKFLOWS DE TEST
 * ✅ BLOC 8 : Workflow "Confirmation de rendez-vous" (Email -> Drive -> SMS)
 */

import { getDb, workflows, tenants, users } from "./db";
import { eq } from "drizzle-orm";
import { logger } from './core/logger/index';

async function seedBloc8() {
  logger.info("🌱 [BLOC 8] Démarrage du Seed spécifique...");
  const db = await getDb();

  try {
    // 1. Récupérer le tenant et l'utilisateur admin
    const [tenant] = await db.select().from(tenants).limit(1);
    const [admin] = await db.select().from(users).where(eq(users.role, 'admin')).limit(1);

    if (!tenant || !admin) {
      logger.error("❌ Tenant ou Admin manquant. Lancez d'abord le seed global.");
      return;
    }

    logger.info(`🏢 Utilisation du tenant : ${tenant.name} (ID: ${tenant.id})`);

    // 2. Création du Workflow "Confirmation de rendez-vous"
    // Les étapes sont encodées dans le champ JSON `actions` du workflow
    logger.info("⚙️ Création du workflow : Confirmation de rendez-vous");
    await db.insert(workflows).values({
      tenantId: tenant.id,
      name: "Confirmation de rendez-vous",
      description: "Séquence automatique : Email -> Drive -> SMS",
      triggerType: "event",
      triggerConfig: { event: "appointment_scheduled" },
      actions: [
        {
          id: "step_1",
          name: "Envoi Email Confirmation",
          type: "send_email",
          order: 1,
          config: {
            to: "{email}",
            subject: "Confirmation de votre rendez-vous",
            body: "Bonjour {firstName}, votre rendez-vous est confirmé."
          }
        },
        {
          id: "step_2",
          name: "Archivage Confirmation",
          type: "drive",
          order: 2,
          config: {
            path: "confirmations/{lastName}_{firstName}.txt",
            operation: "write",
            content: "Rendez-vous confirmé pour {firstName} {lastName}."
          }
        },
        {
          id: "step_3",
          name: "Envoi SMS Rappel",
          type: "send_sms",
          order: 3,
          config: {
            to: "{phone}",
            body: "Bonjour {firstName}, votre RDV est confirmé. À bientôt !"
          }
        }
      ],
      isActive: true,
      createdBy: admin.id
    });

    logger.info("✅ Workflow 'Confirmation de rendez-vous' créé avec succès !");

  } catch (error: unknown) {
    logger.error("❌ Erreur lors du seed Bloc 8 :", error);
  }
}

seedBloc8().then(() => process.exit(0));

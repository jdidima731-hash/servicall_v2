import { calls, tenants, users, prospects } from "../db";
import { dbManager } from "../services/dbManager";
import { eq } from "drizzle-orm";
import { logger } from '../core/logger/index';

async function seedCalls() {
  logger.info("🌱 Démarrage du Seed Appels...");
  
  process.env['DB_ENABLED'] = "true";
  process.env['DISABLE_DB'] = "false";

  try {
    await dbManager.initialize();
    const db = dbManager.db;

    const [tenant] = await db.select().from(tenants).limit(1);
    const [admin] = await db.select().from(users).where(eq(users.role, 'admin')).limit(1);
    const allProspects = await db.select().from(prospects).where(eq(prospects.tenantId, tenant.id)).limit(3);

    if (!tenant || !admin || allProspects.length === 0) {
      logger.error("❌ Données requises manquantes (tenant, admin ou prospects).");
      return;
    }

    const testCalls = [
      {
        tenantId: tenant.id,
        prospectId: allProspects[0].id,
        agentId: admin.id,
        callType: "outbound" as const,
        status: "completed",
        duration: 125,
        outcome: "success" as const,
        notes: "Client très intéressé par l'offre SaaS.",
        createdAt: new Date(Date.now() - 3600000), // 1h ago
      },
      {
        tenantId: tenant.id,
        prospectId: allProspects[1].id,
        agentId: admin.id,
        callType: "inbound" as const,
        status: "missed",
        duration: 0,
        outcome: "no_answer" as const,
        notes: "Appel manqué, à rappeler demain.",
        createdAt: new Date(Date.now() - 7200000), // 2h ago
      },
      {
        tenantId: tenant.id,
        prospectId: allProspects[2].id,
        agentId: admin.id,
        callType: "outbound" as const,
        status: "completed",
        duration: 450,
        outcome: "success" as const,
        notes: "Démonstration effectuée.",
        createdAt: new Date(Date.now() - 86400000), // 1 day ago
      }
    ];

    logger.info("📝 Insertion des appels...");
    for (const call of testCalls) {
      await db.insert(calls).values(call);
    }

    logger.info("✅ 3 appels de test créés avec succès !");

  } catch (error: unknown) {
    logger.error("❌ Erreur lors du seed appels :", error);
  } finally {
    process.exit(0);
  }
}

seedCalls();

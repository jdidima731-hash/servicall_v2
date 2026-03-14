import { prospects, tenants } from "../db";
import { dbManager } from "../services/dbManager";
import { logger } from '../core/logger/index';

async function seedProspects() {
  logger.info("🌱 Démarrage du Seed Prospects...");
  
  // Forcer l'activation de la DB
  process.env['DB_ENABLED'] = "true";
  process.env['DISABLE_DB'] = "false";

  try {
    // S'assurer que la DB est initialisée
    await dbManager.initialize();
    
    // Vérifier si dbManager._db est null
    if (!(dbManager as unknown)._db) {
      logger.error("❌ Database client not available after initialization");
      process.exit(1);
    }

    const db = dbManager.db;

    const [tenant] = await db.select().from(tenants).limit(1);
    if (!tenant) {
      logger.error("❌ Tenant manquant.");
      return;
    }

    logger.info(`🏢 Utilisation du tenant : ${tenant.name} (ID: ${tenant.id})`);

    const testProspects = [
      {
        tenantId: tenant.id,
        firstName: "Jean",
        lastName: "Dupont",
        email: "jean.dupont@example.com",
        phone: "+33612345678",
        status: "new" as const,
        source: "web",
      },
      {
        tenantId: tenant.id,
        firstName: "Marie",
        lastName: "Martin",
        email: "marie.martin@example.com",
        phone: "+33687654321",
        status: "contacted" as const,
        source: "referral",
      },
      {
        tenantId: tenant.id,
        firstName: "Luc",
        lastName: "Bernard",
        email: "luc.bernard@example.com",
        phone: "+33611223344",
        status: "qualified" as const,
        source: "cold_call",
      },
      {
        tenantId: tenant.id,
        firstName: "Sophie",
        lastName: "Petit",
        email: "sophie.petit@example.com",
        phone: "+33655667788",
        status: "converted" as const,
        source: "web",
      },
      {
        tenantId: tenant.id,
        firstName: "Thomas",
        lastName: "Robert",
        email: "thomas.robert@example.com",
        phone: "+33699887766",
        status: "lost" as const,
        source: "ads",
      }
    ];

    logger.info("📝 Insertion des prospects...");
    for (const prospect of testProspects) {
      await db.insert(prospects).values(prospect);
    }

    logger.info("✅ 5 prospects de test créés avec succès !");

  } catch (error: unknown) {
    logger.error("❌ Erreur lors du seed prospects :", error);
  } finally {
    process.exit(0);
  }
}

seedProspects();

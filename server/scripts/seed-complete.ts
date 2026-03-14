import "dotenv/config";
import * as schema from "../../drizzle/schema";
import { dbManager } from "../services/dbManager";
import bcrypt from "bcryptjs";
import { logger } from "../infrastructure/logger";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";

/**
 * 🚀 SEED COMPLET DE DÉMONSTRATION
 * Génère un environnement complet avec Admin, Tenants, Prospects et Workflows.
 */
async function main() {
  logger.info("🌱 Démarrage du seed complet de démonstration...");
  
  try {
    await dbManager.initialize();
    const db = dbManager.db;

    // 1. Création du Tenant par défaut
    logger.info("🏢 Création du tenant de démonstration...");
    const tenantSlug = "demo";
    await db.insert(schema.tenants).values({
      name: "Servicall Demo Corp",
      slug: tenantSlug,
      isActive: true,
      settings: {
        timezone: "Europe/Paris",
        language: "fr"
      },
    }).onConflictDoNothing();

    const [tenant] = await db.select().from(schema.tenants).where(eq(schema.tenants.slug, tenantSlug)).limit(1);
    const tenantId = tenant.id;

    // 2. Création de l'Administrateur
    logger.info("👤 Création de l'administrateur...");
    // ✅ FIX BUG #8: Utiliser des variables d'environnement pour les identifiants sensibles
    const adminEmail = process.env['ADMIN_EMAIL'] || "admin@servicall.com";
    const adminPassword = process.env['ADMIN_PASSWORD'] || "admin123";
    
    const existingAdmin = await db.select().from(schema.users).where(eq(schema.users.email, adminEmail)).limit(1);

    let adminId: number;

    if (existingAdmin.length === 0) {
      const passwordHash = await bcrypt.hash(adminPassword, 12);
      const [newAdmin] = await db.insert(schema.users).values({
        openId: `admin-${nanoid(10)}`,
        name: "System Admin",
        email: adminEmail,
        passwordHash: passwordHash,
        role: "admin",
        loginMethod: "password",
      }).returning();
      adminId = newAdmin.id;
    } else {
      adminId = existingAdmin[0].id;
    }

    // Liaison Admin <-> Tenant
    await db.insert(schema.tenantUsers).values({
      tenantId,
      userId: adminId,
      role: "admin",
      isActive: true,
    }).onConflictDoNothing();

    // 3. Création de Prospects de test
    logger.info("👥 Création de prospects de test...");
    const demoProspects = [
      { firstName: "Jean", lastName: "Dupont", email: "jean.dupont@example.com", phone: "+33612345678", status: "new" },
      { firstName: "Marie", lastName: "Curie", email: "marie.curie@science.fr", phone: "+33687654321", status: "contacted" },
      { firstName: "Albert", lastName: "Einstein", email: "albert.e@physics.org", phone: "+33711223344", status: "qualified" },
      { firstName: "Isaac", lastName: "Newton", email: "isaac.n@gravity.uk", phone: "+447890123456", status: "lost" }
    ];

    for (const p of demoProspects) {
      await db.insert(schema.prospects).values({
        tenantId,
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
        phone: p.phone,
        status: p.status as unknown,
        source: "direct",
        metadata: {}
      }).onConflictDoNothing();
    }

    // 4. Création d'un Workflow de test
    logger.info("⚡ Création d'un workflow de test...");
    await db.insert(schema.workflows).values({
      tenantId,
      name: "Qualification Automatique",
      description: "Workflow de test pour la qualification des nouveaux prospects",
      triggerType: "event", // Correspond à trigger_typeEnum ["manual", "scheduled", "event"]
      isActive: true,
      actions: {
        steps: [
          { type: "condition", field: "source", operator: "eq", value: "direct" },
          { type: "action", actionId: "send_sms", params: { template: "welcome" } }
        ]
      }
    });

    logger.info("✅ Seed complet terminé avec succès !");
    process.exit(0);
  } catch (error: unknown) {
    logger.error("❌ Échec du seed complet :", { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  }
}

main();

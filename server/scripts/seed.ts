import "dotenv/config";
import * as schema from "../../drizzle/schema";
import { dbManager } from "../services/dbManager";
import bcrypt from "bcryptjs";
import { logger } from "../infrastructure/logger";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";

/**
 * 🛡️ SEED DE PRODUCTION IDEMPOTENT
 * Garantit l'existence de l'admin et d'un tenant par défaut sans doublons.
 */
async function main() {
  logger.info("🌱 Démarrage du seed de production...");
  
  try {
    await dbManager.initialize();
    const db = dbManager.db;

    // 1. Création du Tenant par défaut (idempotent via slug)
    logger.info("🏢 Vérification du tenant par défaut...");
    const tenantSlug = "servicall-default";
    
    // On utilise insert...onConflictDoNothing
    await db.insert(schema.tenants).values({
      name: "Servicall Default",
      slug: tenantSlug,
      isActive: true,
      settings: {},
    }).onConflictDoNothing();

    const [tenant] = await db.select().from(schema.tenants).where(eq(schema.tenants.slug, tenantSlug)).limit(1);
    const tenantId = tenant.id;

    // 2. Création de l'Administrateur (idempotent via email)
    logger.info("👤 Vérification de l'administrateur...");
    const adminEmail = process.env['ADMIN_EMAIL'] || "admin@servicall.com";
    const adminPassword = process.env["ADMIN_PASSWORD"] ?? "admin123";
    
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
      logger.info(`✅ Admin créé : ${adminEmail}`);
    } else {
      adminId = existingAdmin[0].id;
      logger.info(`ℹ️ Admin déjà existant : ${adminEmail}`);
    }

    // 3. Liaison Admin <-> Tenant (idempotent)
    await db.insert(schema.tenantUsers).values({
      tenantId,
      userId: adminId,
      role: "admin",
      isActive: true,
    }).onConflictDoNothing();

    logger.info("✅ Seed de production terminé avec succès.");
    process.exit(0);
  } catch (error: unknown) {
    logger.error("❌ Échec du seed :", { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined });
    process.exit(1);
  }
}

main();

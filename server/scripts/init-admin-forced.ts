import { getDb } from "../db";
import { hashPassword } from "../services/passwordService";
import { logger } from "../infrastructure/logger";
import { nanoid } from "nanoid";
import { users, tenants, tenantUsers } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

async function main() {
  try {
    logger.info("[InitAdminForced] Démarrage...");
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const email = "admin@servicall.com";
    const password = "admin123password";
    const name = "Administrateur Système";

    // Vérifier si l'utilisateur existe
    const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
    
    let adminId: number;

    if (existingUser.length === 0) {
      const passwordHash = await hashPassword(password);
      const openId = nanoid();
      
      const [newAdmin] = await db.insert(users).values({
        openId,
        email,
        name,
        passwordHash,
        loginMethod: "password",
        role: "admin",
        lastSignedIn: new Date(),
      }).returning();
      
      adminId = newAdmin.id;
      logger.info("[InitAdminForced] ✅ Administrateur créé");
    } else {
      adminId = existingUser[0].id;
      logger.info("[InitAdminForced] ℹ️ Administrateur existe déjà");
    }

    // Créer le tenant par défaut
    const existingTenant = await db.select().from(tenants).where(eq(tenants.slug, "default")).limit(1);
    let tenantId: number;

    if (existingTenant.length === 0) {
      const [newTenant] = await db.insert(tenants).values({
        slug: "default",
        name: "ServiceCall Default",
        isActive: true,
      }).returning();
      tenantId = newTenant.id;
      logger.info("[InitAdminForced] ✅ Tenant par défaut créé");
    } else {
      tenantId = existingTenant[0].id;
      logger.info("[InitAdminForced] ℹ️ Tenant par défaut existe déjà");
    }

    // Lier l'admin au tenant s'il n'est pas déjà lié
    const existingLink = await db.select().from(tenantUsers)
      .where(eq(tenantUsers.userId, adminId))
      .limit(1);

    if (existingLink.length === 0) {
      await db.insert(tenantUsers).values({
        userId: adminId,
        tenantId: tenantId,
        role: "owner",
        isActive: true,
      });
      logger.info("[InitAdminForced] ✅ Admin lié au tenant");
    }

    logger.info("SUCCESS: Admin initialized");
    process.exit(0);
  } catch (error: unknown) {
    logger.error("FAILED:", error);
    process.exit(1);
  }
}

main();

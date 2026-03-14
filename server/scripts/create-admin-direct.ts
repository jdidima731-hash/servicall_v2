/**
 * Script direct de création du compte admin
 * Connexion directe à PostgreSQL sans passer par le dbManager
 */
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { logger } from '../core/logger/index';

const DATABASE_URL = process.env['DATABASE_URL'] || "postgresql://servicall:servicall_prod_2026@localhost:5432/servicall_crm";

async function main() {
  logger.info("🔧 Connexion à PostgreSQL...");
  
  const client = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(client, { schema });
  
  try {
    // Test connexion
    await client`SELECT 1`;
    logger.info("✅ Connexion PostgreSQL réussie");
    
    const email = "admin@servicall.com";
    const password = "Admin@2026!";
    const name = "Administrateur Système";
    
    // Vérifier si l'admin existe déjà
    const existing = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    
    let adminId: number;
    
    if (existing.length > 0) {
      const existingAdmin = existing[0];
      if (!existingAdmin) throw new Error("Admin record not found");
      adminId = existingAdmin.id;
      logger.info(`ℹ️  Admin déjà existant (id=${adminId}), mise à jour du mot de passe...`);
      const passwordHash = await bcrypt.hash(password, 12);
      await db.update(schema.users)
        .set({ passwordHash, role: "admin", isActive: true })
        .where(eq(schema.users.email, email));
      logger.info("✅ Mot de passe mis à jour");
    } else {
      const passwordHash = await bcrypt.hash(password, 12);
      const openId = nanoid();
      
      const inserted = await db.insert(schema.users).values({
        openId,
        email,
        name,
        passwordHash,
        loginMethod: "password",
        role: "admin",
        lastSignedIn: new Date(),
        isActive: true,
      }).returning();
      
      const newAdmin = inserted[0];
      if (!newAdmin) throw new Error("Failed to create admin user");
      adminId = newAdmin.id;
      logger.info(`✅ Administrateur créé (id=${adminId})`);
    }
    
    // Créer le tenant par défaut
    const existingTenant = await db.select().from(schema.tenants).where(eq(schema.tenants.slug, "default")).limit(1);
    let tenantId: number;
    
    if (existingTenant.length === 0) {
      const insertedTenant = await db.insert(schema.tenants).values({
        slug: "default",
        name: "ServiceCall Default",
        isActive: true,
        settings: {},
      }).returning();
      const newTenant = insertedTenant[0];
      if (!newTenant) throw new Error("Failed to create tenant");
      tenantId = newTenant.id;
      logger.info(`✅ Tenant par défaut créé (id=${tenantId})`);
    } else {
      const existingT = existingTenant[0];
      if (!existingT) throw new Error("Tenant record not found");
      tenantId = existingT.id;
      logger.info(`ℹ️  Tenant par défaut existe déjà (id=${tenantId})`);
    }
    
    // Lier l'admin au tenant
    const existingLink = await db.select().from(schema.tenantUsers)
      .where(eq(schema.tenantUsers.userId, adminId))
      .limit(1);
    
    if (existingLink.length === 0) {
      await db.insert(schema.tenantUsers).values({
        userId: adminId,
        tenantId: tenantId,
        role: "owner",
        isActive: true,
      });
      logger.info("✅ Admin lié au tenant");
    } else {
      logger.info("ℹ️  Lien admin-tenant déjà existant");
    }
    
    logger.info("\n========================================");
    logger.info("✅ COMPTE ADMIN CRÉÉ AVEC SUCCÈS");
    logger.info("========================================");
    logger.info(`  Email    : ${email}`);
    logger.info(`  Password : ${password}`);
    logger.info(`  Rôle     : admin`);
    logger.info(`  Tenant   : default (id=${tenantId})`);
    logger.info("========================================\n");
    
  } catch (error: unknown) {
    logger.error("❌ Erreur:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
  
  process.exit(0);
}

main();

import { drizzle } from "drizzle-orm/node-postgres";
import pkg from 'pg';
const { Client } = pkg;
import * as schema from "../../drizzle/schema";
import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";
import { logger } from '../core/logger/index';

dotenv.config();

async function main() {
  logger.info("🌱 Seeding PostgreSQL database with complete demo data...");
  
  const client = new Client({
    connectionString: process.env['DATABASE_URL'],
  });

  await client.connect();
  const db = drizzle(client, { schema });

  try {
    // ========================================
    // 1. TENANT PAR DÉFAUT
    // ========================================
    logger.info("🏢 Creating default tenant...");
    const [defaultTenant] = await db.insert(schema.tenants).values({
      name: "ServiceCall Demo",
      slug: "servicall-demo",
      isActive: true,
      domain: "demo.servicall.com",
      settings: {
        timezone: "Europe/Paris",
        language: "fr",
        currency: "EUR",
      },
    }).returning();

    const tenantId = defaultTenant!.id;
    logger.info(`✅ Tenant created: ${defaultTenant!.name} (ID: ${tenantId})`);

    // ========================================
    // 2. UTILISATEURS (ADMIN, MANAGER, AGENT)
    // ========================================
    logger.info("👤 Creating users...");
    
    // Admin
    const adminPassword = await bcrypt.hash("admin123", 10);
    const [adminUser] = await db.insert(schema.users).values({
      openId: "admin-demo-id",
      name: "Administrateur Système",
      email: "admin@servicall.com",
      passwordHash: adminPassword,
      role: "admin",
      loginMethod: "password",
    }).returning();

    await db.insert(schema.tenantUsers).values({
      tenantId,
      userId: adminUser!.id,
      role: "admin",
      isActive: true,
    });
    logger.info(`✅ Admin created: ${adminUser!.email}`);

    // Manager
    const managerPassword = await bcrypt.hash("manager123", 10);
    const [managerUser] = await db.insert(schema.users).values({
      openId: "manager-demo-id",
      name: "Sophie Durand",
      email: "manager@servicall.com",
      passwordHash: managerPassword,
      role: "manager",
      loginMethod: "password",
    }).returning();

    await db.insert(schema.tenantUsers).values({
      tenantId,
      userId: managerUser!.id,
      role: "manager",
      isActive: true,
    });
    logger.info(`✅ Manager created: ${managerUser!.email}`);

    // Agent
    const agentPassword = await bcrypt.hash("agent123", 10);
    const [agentUser] = await db.insert(schema.users).values({
      openId: "agent-demo-id",
      name: "Marc Lefebvre",
      email: "agent@servicall.com",
      passwordHash: agentPassword,
      role: "agent",
      loginMethod: "password",
    }).returning();

    await db.insert(schema.tenantUsers).values({
      tenantId,
      userId: agentUser!.id,
      role: "agent",
      isActive: true,
    });
    logger.info(`✅ Agent created: ${agentUser!.email}`);

    // ========================================
    // 3. PROSPECTS (15 PROSPECTS VARIÉS)
    // ========================================
    logger.info("📊 Creating prospects...");
    
    const prospectData = [
      { firstName: "Jean", lastName: "Dupont", email: "jean.dupont@example.com", phone: "+33612345678", company: "Tech Solutions", status: "new" as const, source: "website" },
      { firstName: "Marie", lastName: "Martin", email: "marie.martin@example.com", phone: "+33687654321", company: "Global Services", status: "new" as const, source: "referral" },
      { firstName: "Pierre", lastName: "Bernard", email: "pierre.bernard@example.com", phone: "+33645678901", company: "Innovate SAS", status: "new" as const, source: "linkedin" },
      { firstName: "Sophie", lastName: "Petit", email: "sophie.petit@example.com", phone: "+33655443322", company: "Creative Agency", status: "contacted" as const, source: "cold_call" },
      { firstName: "Lucas", lastName: "Simon", email: "lucas.simon@example.com", phone: "+33611223344", company: "Data Corp", status: "contacted" as const, source: "website" },
      { firstName: "Emma", lastName: "Moreau", email: "emma.moreau@example.com", phone: "+33622334455", company: "Cloud Systems", status: "contacted" as const, source: "email" },
      { firstName: "Thomas", lastName: "Laurent", email: "thomas.laurent@example.com", phone: "+33633445566", company: "Finance Pro", status: "qualified" as const, source: "referral" },
      { firstName: "Julie", lastName: "Roux", email: "julie.roux@example.com", phone: "+33644556677", company: "Marketing Plus", status: "qualified" as const, source: "linkedin" },
      { firstName: "Nicolas", lastName: "Fournier", email: "nicolas.fournier@example.com", phone: "+33655667788", company: "Tech Innovators", status: "qualified" as const, source: "website" },
      { firstName: "Alice", lastName: "Girard", email: "alice.girard@example.com", phone: "+33666778899", company: "Enterprise Solutions", status: "converted" as const, source: "referral" },
      { firstName: "David", lastName: "Bonnet", email: "david.bonnet@example.com", phone: "+33677889900", company: "Digital Agency", status: "converted" as const, source: "cold_call" },
      { firstName: "Isabelle", lastName: "Mercier", email: "isabelle.mercier@example.com", phone: "+33688990011", company: "Retail Group", status: "lost" as const, source: "website" },
      { firstName: "François", lastName: "Blanc", email: "francois.blanc@example.com", phone: "+33699001122", company: "Consulting Firm", status: "lost" as const, source: "email" },
      { firstName: "Camille", lastName: "Rousseau", email: "camille.rousseau@example.com", phone: "+33600112233", company: "Startup Hub", status: "new" as const, source: "linkedin" },
      { firstName: "Antoine", lastName: "Garnier", email: "antoine.garnier@example.com", phone: "+33611223344", company: "Legal Services", status: "contacted" as const, source: "referral" },
    ];

    const insertedProspects = [];
    for (const prospect of prospectData) {
      const [inserted] = await db.insert(schema.prospects).values({
        tenantId,
        firstName: prospect.firstName,
        lastName: prospect.lastName,
        email: prospect.email,
        phone: prospect.phone,
        company: prospect.company,
        status: prospect.status,
        source: prospect.source,
        assignedTo: agentUser!.id,
        notes: `Prospect ajouté automatiquement lors du seed. Source: ${prospect.source}`,
      }).returning();
      insertedProspects.push(inserted);
    }
    logger.info(`✅ ${insertedProspects.length} prospects created`);

    // ========================================
    // 4. APPELS SIMULÉS (10 APPELS)
    // ========================================
    logger.info("📞 Creating simulated calls...");
    
    const callsData = [
      { prospectId: insertedProspects[0]!.id, callType: "outbound" as const, status: "completed", outcome: "success" as const, duration: 180, sentiment: "positive" },
      { prospectId: insertedProspects[1]!.id, callType: "outbound" as const, status: "completed", outcome: "success" as const, duration: 120, sentiment: "neutral" },
      { prospectId: insertedProspects[2]!.id, callType: "inbound" as const, status: "completed", outcome: "success" as const, duration: 300, sentiment: "positive" },
      { prospectId: insertedProspects[3]!.id, callType: "outbound" as const, status: "completed", outcome: "failed" as const, duration: 60, sentiment: "negative" },
      { prospectId: insertedProspects[4]!.id, callType: "outbound" as const, status: "completed", outcome: "voicemail" as const, duration: 30, sentiment: "neutral" },
      { prospectId: insertedProspects[5]!.id, callType: "inbound" as const, status: "completed", outcome: "success" as const, duration: 240, sentiment: "positive" },
      { prospectId: insertedProspects[6]!.id, callType: "outbound" as const, status: "scheduled", outcome: null, duration: null, sentiment: null },
      { prospectId: insertedProspects[7]!.id, callType: "outbound" as const, status: "completed", outcome: "success" as const, duration: 360, sentiment: "positive" },
      { prospectId: insertedProspects[8]!.id, callType: "inbound" as const, status: "missed", outcome: null, duration: null, sentiment: null },
      { prospectId: insertedProspects[9]!.id, callType: "outbound" as const, status: "completed", outcome: "success" as const, duration: 420, sentiment: "positive" },
    ];

    for (const call of callsData) {
      await db.insert(schema.calls).values({
        tenantId,
        agentId: agentUser!.id,
        prospectId: call.prospectId,
        callType: call.callType,
        status: call.status,
        outcome: call.outcome,
        duration: call.duration,
        scheduledAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        startedAt: call.status === "completed" ? new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) : null,
        endedAt: call.status === "completed" ? new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) : null,
        notes: `Appel ${call.callType} avec résultat: ${call.outcome || "en attente"}`,
        metadata: {
            summary: call.status === "completed" ? `Résumé automatique de l'appel. Durée: ${call.duration}s. Sentiment: ${call.sentiment}.` : null,
        }
      });
    }
    logger.info(`✅ ${callsData.length} calls created`);

    logger.info("✨ Database seeding completed successfully!");
  } catch (error: unknown) {
    logger.error("❌ Error seeding database:", error);
  } finally {
    await client.end();
  }
}

main();

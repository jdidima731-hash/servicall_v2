import "dotenv/config";
import { dbManager } from "../services/dbManager";
import * as schema from "../../drizzle/schema";
import { logger } from "../infrastructure/logger";

async function seedDemoData(tenantId: number) {
  const db = dbManager.db;
  
  logger.info(`🌱 Generating demo data for tenant ID: ${tenantId}`);

  // 1. Créer 10 prospects de démo
  const demoProspects = [
    { firstName: 'Jean', lastName: 'Dupont', email: 'jean.dupont@example.com', company: 'Dupont & Co', phone: '+33612345678' },
    { firstName: 'Marie', lastName: 'Martin', email: 'marie.martin@example.com', company: 'Martin SARL', phone: '+33623456789' },
    { firstName: 'Pierre', lastName: 'Durand', email: 'pierre.durand@example.com', company: 'Durand Logistique', phone: '+33634567890' },
    { firstName: 'Sophie', lastName: 'Lefebvre', email: 'sophie.l@example.com', company: 'Lefebvre Design', phone: '+33645678901' },
    { firstName: 'Thomas', lastName: 'Moreau', email: 't.moreau@example.com', company: 'Moreau Tech', phone: '+33656789012' },
    { firstName: 'Lucie', lastName: 'Petit', email: 'l.petit@example.com', company: 'Petit Commerce', phone: '+33667890123' },
    { firstName: 'Nicolas', lastName: 'Roux', email: 'n.roux@example.com', company: 'Roux Immobilier', phone: '+33678901234' },
    { firstName: 'Julie', lastName: 'Bernard', email: 'j.bernard@example.com', company: 'Bernard Consulting', phone: '+33689012345' },
    { firstName: 'Antoine', lastName: 'Richard', email: 'a.richard@example.com', company: 'Richard BTP', phone: '+33690123456' },
    { firstName: 'Emma', lastName: 'Garcia', email: 'emma.g@example.com', company: 'Garcia Traiteur', phone: '+33601234567' },
  ];

  logger.info(`👥 Creating ${demoProspects.length} prospects...`);
  
  const createdProspects = [];
  for (const prospect of demoProspects) {
    const [created] = await db.insert(schema.prospects).values({
      ...prospect,
      tenantId,
      status: 'new',
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    createdProspects.push(created);
  }

  // 2. Créer des appels fictifs pour alimenter le dashboard
  logger.info(`📞 Creating demo calls...`);
  const statuses = ['completed', 'failed', 'completed', 'completed'];
  const sentiments = ['positive', 'neutral', 'positive', 'negative'];
  
  for (let i = 0; i < 20; i++) {
    const prospect = createdProspects[i % createdProspects.length];
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 7)); // Appels sur les 7 derniers jours
    
    await db.insert(schema.calls).values({
      tenantId,
      prospectId: prospect.id,
      callType: 'outbound',
      direction: 'outgoing',
      status: statuses[Math.floor(Math.random() * statuses.length)],
      duration: Math.floor(Math.random() * 300) + 30,
      sentiment: sentiments[Math.floor(Math.random() * sentiments.length)],
      qualityScore: (Math.random() * 3 + 7).toFixed(2), // Score entre 7 et 10
      createdAt: date,
      updatedAt: date,
    });
  }

  // 3. Créer des rendez-vous
  logger.info(`📅 Creating demo appointments...`);
  for (let i = 0; i < 5; i++) {
    const prospect = createdProspects[i % createdProspects.length];
    const scheduledAt = new Date();
    scheduledAt.setDate(scheduledAt.getDate() + Math.floor(Math.random() * 5));
    
    await db.insert(schema.appointments).values({
      tenantId,
      prospectId: prospect.id,
      title: `Rendez-vous avec ${prospect.firstName} ${prospect.lastName}`,
      status: 'confirmed',
      scheduledAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  logger.info('✅ Données de démonstration créées avec succès');
}

async function main() {
  try {
    await dbManager.initialize();
    
    // Récupérer le premier tenant disponible
    const tenants = await dbManager.db.select().from(schema.tenants).limit(1);
    
    if (tenants.length === 0) {
      logger.error('❌ Aucun tenant trouvé. Veuillez d\'abord exécuter le seed de base.');
      process.exit(1);
    }

    await seedDemoData(tenants[0].id);
    process.exit(0);
  } catch (error: unknown) {
    logger.error('❌ Erreur lors de la génération des données de démo:', { error });
    process.exit(1);
  }
}

main();

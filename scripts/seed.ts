import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq } from 'drizzle-orm';
import dotenv from 'dotenv';
import argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { logger } from '../server/utils/logger.js';
import { users, organizations, organizationMembers, skills } from '../shared/schema.js';

dotenv.config();

async function seed() {
  logger.info('🌱 Début du seeding...');

  if (!process.env.DATABASE_URL) {
    logger.error('❌ DATABASE_URL non définie');
    process.exit(1);
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const db = drizzle(sql);

    // Nettoyer les tables existantes (optionnel)
    if (process.env.NODE_ENV !== 'production') {
      logger.info('🧹 Nettoyage des tables...');
      await sql`TRUNCATE users, organizations, organization_members, skills CASCADE`;
    }

    // Créer un mot de passe hashé
    const password = 'Admin123!';
    const salt = randomBytes(32);
    const passwordHash = await argon2.hash(password, { salt });

    // Créer un admin
    logger.info('👤 Création de l\'utilisateur admin...');
    const [admin] = await db.insert(users).values({
      email: 'admin@servicall.com',
      passwordHash,
      salt: salt.toString('hex'),
      fullName: 'Admin Servicall',
      role: 'superadmin',
      isVerified: true,
      isActive: true,
    }).returning();

    logger.info(`✅ Admin créé: ${admin.email}`);

    // Créer un utilisateur test
    const userPassword = 'User123!';
    const userSalt = randomBytes(32);
    const userPasswordHash = await argon2.hash(userPassword, { salt: userSalt });

    const [testUser] = await db.insert(users).values({
      email: 'user@test.com',
      passwordHash: userPasswordHash,
      salt: userSalt.toString('hex'),
      fullName: 'Test User',
      role: 'user',
      isVerified: true,
      isActive: true,
    }).returning();

    logger.info(`✅ Utilisateur test créé: ${testUser.email}`);

    // Créer une organisation
    logger.info('🏢 Création de l\'organisation...');
    const [org] = await db.insert(organizations).values({
      name: 'Servicall Demo',
      slug: 'servicall-demo',
      plan: 'enterprise',
      settings: {
        timezone: 'Europe/Paris',
        language: 'fr',
        features: ['calls', 'analytics', 'api']
      }
    }).returning();

    logger.info(`✅ Organisation créée: ${org.name}`);

    // Ajouter les membres à l'organisation
    logger.info('👥 Ajout des membres...');
    await db.insert(organizationMembers).values([
      {
        organizationId: org.id,
        userId: admin.id,
        role: 'admin',
        permissions: ['*']
      },
      {
        organizationId: org.id,
        userId: testUser.id,
        role: 'member',
        permissions: ['calls:read', 'calls:create']
      }
    ]);

    // Créer des compétences/services
    logger.info('🎯 Création des compétences...');
    await db.insert(skills).values([
      {
        organizationId: org.id,
        name: 'Consultation téléphonique',
        description: 'Consultation professionnelle par téléphone',
        category: 'consulting',
        price: 5000, // 50€
        duration: 30,
        createdBy: admin.id,
      },
      {
        organizationId: org.id,
        name: 'Support technique',
        description: 'Assistance technique à distance',
        category: 'support',
        price: 3000, // 30€
        duration: 15,
        createdBy: admin.id,
      }
    ]);

    logger.info('✅ Seeding terminé avec succès!');
    logger.info('📝 Identifiants de test:');
    logger.info(`   • Admin: admin@servicall.com / ${password}`);
    logger.info(`   • User: user@test.com / ${userPassword}`);

    process.exit(0);
  } catch (error) {
    logger.error('❌ Erreur lors du seeding:', error);
    process.exit(1);
  }
}

seed();

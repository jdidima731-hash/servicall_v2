import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import dotenv from 'dotenv';
import { logger } from '../server/utils/logger.js';

dotenv.config();

async function runMigrations() {
  const startTime = Date.now();
  logger.info('🗃️ Début des migrations...');

  if (!process.env.DATABASE_URL) {
    logger.error('❌ DATABASE_URL non définie');
    process.exit(1);
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const db = drizzle(sql);

    logger.info('📦 Connexion à la base de données établie');

    // Exécuter les migrations
    await migrate(db, { migrationsFolder: './drizzle' });

    const duration = Date.now() - startTime;
    logger.info(`✅ Migrations terminées avec succès en ${duration}ms`);

    // Vérifier la connexion
    const result = await sql`SELECT NOW() as time`;
    logger.info(`🕐 Heure serveur DB: ${result[0].time}`);

    process.exit(0);
  } catch (error) {
    logger.error('❌ Erreur lors des migrations:', error);
    process.exit(1);
  }
}

runMigrations();

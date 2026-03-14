import Database from "better-sqlite3";
import fs from "fs";
import _path from "path";
import { fileURLToPath } from "url";
import { logger } from '../core/logger/index';

void fileURLToPath(import.meta.url); // __filename not needed
  // const __dirname = path.dirname(__filename);

async function resetDb() {
  const dbPath = process.env['DATABASE_URL'] || "servicall.db";
  logger.info(`🧹 Resetting database: ${dbPath}`);

  try {
    // Fermer les connexions existantes si possible (pas vraiment possible ici sans l'instance db)
    // Mais on peut simplement supprimer le fichier PostgreSQL
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
      logger.info("✅ Existing database file deleted.");
    }

    // Recréer une base de données vide
    const db = new Database(dbPath);
    db.close();
    logger.info("✅ New empty database created.");
    
    process.exit(0);
  } catch (error: unknown) {
    logger.error("❌ Failed to reset database:", error);
    process.exit(1);
  }
}

resetDb();

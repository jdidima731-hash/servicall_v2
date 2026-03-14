import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as dotenv from "dotenv";
import { logger } from '../core/logger/index';

dotenv.config();

async function runMigration() {
  const databaseUrl = process.env['DATABASE_URL'];
  
  if (!databaseUrl) {
    logger.error("❌ DATABASE_URL is missing");
    process.exit(1);
  }

  logger.info("⏳ Running migrations...");
  
  const sql = postgres(databaseUrl, { max: 1 });
  const db = drizzle(sql);

  try {
    await migrate(db, { migrationsFolder: "./drizzle/migrations" });
    logger.info("✅ Migrations completed successfully");
  } catch (error: unknown) {
    logger.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();

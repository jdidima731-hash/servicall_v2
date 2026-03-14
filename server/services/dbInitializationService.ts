/**
 * ✅ CORRECTION PRODUCTION-READY: Service d'initialisation de la base de données
 * 
 * RÈGLES STRICTES:
 * - Initialisation automatique et idempotente
 * - Vérification des tables critiques
 * - Création automatique de l'utilisateur admin si absent
 * - Idempotence garantie (redémarrage sans erreur)
 */

import { logger } from "../infrastructure/logger";
import { dbManager } from "./dbManager";
import { execSync } from "child_process";

interface DBInitResult {
  success: boolean;
  message: string;
  tablesExist: boolean;
  timestamp: string;
  error?: string;
}

/**
 * Vérifier si les tables principales existent dans PostgreSQL
 */
async function checkTablesExist(): Promise<boolean> {
  try {
    const client = dbManager.client;
    if (!client) return false;
    
    // Vérifier l'existence de la table users (table critique)
    const result = await client`
      SELECT COUNT(*) as count
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'users'
    `;
    
    const count = parseInt(result[0]?.['count'] || '0', 10);
    return count > 0;
  } catch (error: unknown) {
    logger.error("[DBInit] Erreur lors de la vérification des tables", { error: error.message });
    return false;
  }
}

/**
 * Créer les tables si elles n'existent pas
 */
async function ensureTablesExist(): Promise<boolean> {
  try {
    const tablesExist = await checkTablesExist();
    
    if (tablesExist) {
      logger.info("[DBInit] Les tables existent déjà");
      return true;
    }
    
    logger.warn("[DBInit] Tables manquantes, création en cours...");
    
    // En production, on prévient mais on peut tenter si configuré
    if (process.env['NODE_ENV'] === 'production' && process.env['AUTO_MIGRATE'] !== 'true') {
      logger.error("[DBInit] ❌ Les tables n'existent pas en production. Exécutez 'pnpm db:push' manuellement.");
      return false;
    }
    
    try {
      logger.info("[DBInit] Exécution des migrations (pnpm db:migrate)...");
      execSync("pnpm db:migrate", {
        cwd: process.cwd(),
        encoding: "utf-8",
        stdio: "inherit",
        env: process.env
      });
      logger.info("[DBInit] ✅ Migrations appliquées avec succès");
      return true;
    } catch (error: unknown) {
      logger.error("[DBInit] Erreur lors de l'exécution des migrations", { error: error.message });
      return false;
    }
  } catch (error: unknown) {
    logger.error("[DBInit] Erreur lors de l'initialisation des tables", { error: error.message });
    return false;
  }
}

/**
 * Vérifier la connexion à PostgreSQL
 */
async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const client = dbManager.client;
    if (!client) return false;
    await client`SELECT 1`;
    return true;
  } catch (error: unknown) {
    return false;
  }
}

/**
 * Initialiser la base de données
 */
export async function initializeDatabase(): Promise<DBInitResult> {
  // const _startTime = Date.now();
  try {
    logger.info("[DBInit] Initialisation de la base de données...");

    if (!(await checkDatabaseConnection())) {
      throw new Error("Impossible de se connecter à PostgreSQL. Vérifiez DATABASE_URL.");
    }

    if (!(await ensureTablesExist())) {
      throw new Error("Les tables de la base de données ne sont pas prêtes");
    }

    // Création automatique de l'admin si absent
    await ensureAdminExists();

    return {
      success: true,
      message: "Base de données prête",
      tablesExist: true,
      timestamp: new Date().toISOString(),
    };
  } catch (error: unknown) {
    return {
      success: false,
      message: error.message,
      tablesExist: false,
      timestamp: new Date().toISOString(),
      error: error.message,
    };
  }
}

/**
 * Point d'entrée principal pour le démarrage du serveur
 */
export async function initializeDatabaseOrExit(): Promise<void> {
  if (process.env['SKIP_DB_INIT'] === 'true') {
    logger.info("[DBInit] Initialisation DB ignorée");
    return;
  }

  const result = await initializeDatabase();

  if (!result.success) {
    logger.error("[DBInit] ❌ Échec de l'initialisation", { error: result.error });
    logger.warn("[DBInit] Poursuite en mode dégradé (certaines fonctionnalités seront indisponibles)");
    return;
  }
  logger.info("[DBInit] ✅ Base de données initialisée et prête");
}

/**
 * Vérifier si un admin existe
 */
export async function hasAdminUser(): Promise<boolean> {
  try {
    const client = dbManager.client;
    if (!client) return false;
    const result = await client`SELECT COUNT(*) as count FROM users WHERE role = 'admin'`;
    return parseInt(result[0]?.['count'] || '0', 10) > 0;
  } catch (error: unknown) {
    return false;
  }
}

/**
 * Créer un utilisateur admin par défaut si absent
 */
export async function ensureAdminExists(): Promise<boolean> {
  try {
    if (await hasAdminUser()) {
      logger.info("[DBInit] Utilisateur admin déjà présent");
      return true;
    }
    
    logger.warn("[DBInit] Aucun admin trouvé, création...");
    try {
      execSync("pnpm admin:init", {
        cwd: process.cwd(),
        encoding: "utf-8",
        stdio: "inherit",
        env: process.env
      });
      logger.info("[DBInit] ✅ Admin créé par défaut");
      return true;
    } catch (error: unknown) {
      logger.error("[DBInit] Échec création admin via script", { error: error.message });
      return false;
    }
  } catch (error: unknown) {
    return false;
  }
}

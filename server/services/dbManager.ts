/**
 * DATABASE MANAGER SERVICE - VERSION POSTGRESQL (PRODUCTION GRADE)
 * Centralise tout l'accès à la base de données PostgreSQL
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../drizzle/schema";
import { logger } from "../infrastructure/logger";
import { sql } from "drizzle-orm";

export class DBManager {
  private static instance: DBManager;
  private _db: unknown= null;
  private _client: postgres.Sql | null = null;
  private _initPromise: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): DBManager {
    if (!DBManager.instance) {
      DBManager.instance = new DBManager();
    }
    return DBManager.instance;
  }

  /**
   * Initialise la connexion PostgreSQL de manière bloquante
   */
  public async initialize(): Promise<void> {
    if (this._db) return;
    if (this._initPromise) return this._initPromise;

    this._initPromise = (async () => {
      const databaseUrl = process.env['DATABASE_URL'];
      
      if (!databaseUrl || !databaseUrl.startsWith("postgres")) {
        const error = "[DBManager] ❌ DATABASE_URL invalide ou manquante (PostgreSQL requis)";
        logger.error(error);
        throw new Error(error);
      }

      try {
        // ✅ CORRECTION BUG TIMEOUT POSTGRESQL:
        // - Augmentation du pool max à 25 connexions
        // - idle_timeout réduit à 10s pour libérer plus vite les connexions inutilisées
        // - statement_timeout global à 25s (en dessous du timeout tRPC de 30s)
        // - max_lifetime réduit à 15min pour recycler régulièrement les connexions
        this._client = postgres(databaseUrl, {
          max: 25,              // ✅ FIX: 25 connexions max (au lieu de 20)
          idle_timeout: 10,     // ✅ FIX: Libérer les connexions inactives après 10s (au lieu de 20s)
          connect_timeout: 10,  // Timeout de connexion 10s
          max_lifetime: 60 * 15, // ✅ FIX: Recycler les connexions toutes les 15 min (au lieu de 30)
          // ✅ FIX: Statement timeout global pour éviter les requêtes bloquées indéfiniment
          // Doit être inférieur au timeout tRPC (30s) pour un message d'erreur propre
          connection: {
            statement_timeout: 25000, // 25s statement timeout
          },
          onnotice: () => {},
          onparameter: (_name: string, _value: string) => {},
          ssl: process.env['NODE_ENV'] === "production" && !databaseUrl.includes("localhost") ? "require" : false,
        });

        this._db = drizzle(this._client, { schema });
        
        // Test de connexion immédiat
        await this._client`SELECT 1`.catch(_err => {
          logger.warn("[DBManager] ⚠️ PostgreSQL non disponible au démarrage, le serveur continuera sans DB.");
          this._db = null; // Marquer comme non disponible
        });
        
        if (this._db) {
          try {
            await this._client`SELECT 1`;
            logger.info("[DBManager] ✅ PostgreSQL initialisé et connexion initiale réussie");
          } catch (error: unknown) {
            logger.error("❌ Impossible de se connecter à PostgreSQL en production : " + error.message);
            if (process.env['NODE_ENV'] === "production") {
              process.exit(1);
            }
            this._db = null; // seulement pour dev
          }
        }
      } catch (error: unknown) {
        logger.error("[DBManager] ❌ Erreur lors de la configuration PostgreSQL", error instanceof Error ? error : new Error(String(error)));
      }
    })();

    return this._initPromise;
  }

  public get db() {
    const mock = {
      select: () => ({ from: () => ({ where: () => ({ limit: () => [] }) }) }),
      insert: () => ({ values: () => ({ returning: () => [] }) }),
      update: () => ({ set: () => ({ where: () => ({ returning: () => [] }) }) }),
      delete: () => ({ where: () => ({ returning: () => [] }) }),
      transaction: (cb: unknown) => cb({}),
    };

    if (process.env['DB_ENABLED'] === "false" || !this._db) {
      return new Proxy({} as unknown, {
        get(_target, prop) {
          return (mock as unknown)[prop] || (() => []);
        }
      });
    }

    return this._db;
  }

  public get client() {
    if (!this._client) {
      throw new Error("[DBManager] ❌ Tentative d'accès au client avant initialisation.");
    }
    return this._client;
  }

  public async transaction<T>(callback: (tx: unknown) => Promise<T>): Promise<T> {
    if (!this._db) await this.initialize();
    return await this._db.transaction(callback);
  }

  /**
   * ✅ ISOLATION TENANT: Exécute une transaction avec le contexte tenant_id défini
   * pour la Row Level Security (RLS) de PostgreSQL.
   */
  public async withTenantContext<T>(
    tenantId: number,
    callback: (tx: unknown) => Promise<T>
  ): Promise<T> {
    if (!this._db) await this.initialize();
    
    return await this._db.transaction(async (tx: unknown) => {
      // Définir le paramètre de session pour la RLS
      // L'utilisation de SET LOCAL garantit que le paramètre ne dure que pendant la transaction
      await tx.execute(sql`SELECT set_config('app.current_tenant_id', ${tenantId.toString()}, true)`);
      
      logger.debug("[DBManager] Transaction started with tenant context", { tenantId });
      
      return await callback(tx);
    });
  }

  public async close() {
    if (this._client) {
      await this._client.end();
      this._client = null;
      this._db = null;
      this._initPromise = null;
      logger.info("[DBManager] PostgreSQL connections closed");
    }
  }
}

export const dbManager = DBManager.getInstance();

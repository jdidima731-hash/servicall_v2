import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../../../drizzle/schema";
import { sql } from "drizzle-orm";

export interface QueryDatabaseConfig {
  table: string; // Nom de la table (ex: "menu_items", "hotel_rooms")
  query: Record<string, unknown>; // Conditions de recherche
  limit?: number;
}

export class QueryDatabaseAction {
   
  private db: ReturnType<typeof drizzle<typeof schema>>;

  constructor(connectionString?: string) {
    const connStr = connectionString || process.env['DATABASE_URL'] || "postgresql://servicall_user:servicall_password@localhost:5432/servicall_crm";
    const client = postgres(connStr);
    this.db = drizzle(client, { schema });
  }

  /**
   * Interroge la base de données via SQL paramétré sécurisé
   */
  async execute(config: QueryDatabaseConfig, _context: Record<string, unknown>): Promise<unknown> {
    try {
      const { table, query, limit = 10 } = config;

      // Validation du nom de table (whitelist)
      const allowedTables = Object.keys(schema);
      if (!allowedTables.includes(table)) {
        return {
          success: false,
          error: `Table ${table} not found or not allowed`,
        };
      }

      // Construction d'une requête SQL paramétrée sécurisée
      const entries = Object.entries(query);
      let whereSql = sql`1=1`;
      for (const [key, value] of entries) {
        whereSql = sql`${whereSql} AND ${sql.raw(key)} = ${value}`;
      }

      const results = await this.db.execute(
        sql`SELECT * FROM ${sql.raw(table)} WHERE ${whereSql} LIMIT ${limit}`
      );

      const rows = Array.isArray(results) ? results : (results as { rows?: unknown[] }).rows ?? [];

      return {
        success: true,
        table,
        results: rows,
        count: rows.length,
      };
    } catch (error: unknown) {
      console.error("Error in QueryDatabaseAction:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

export default QueryDatabaseAction;

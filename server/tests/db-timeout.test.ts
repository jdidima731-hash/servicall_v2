import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { dbManager } from "../services/dbManager";
import { withTimeout } from "../db";
import { sql } from "drizzle-orm";

describe("Database Timeouts", () => {
  beforeAll(async () => {
    await dbManager.initialize();
  });

  afterAll(async () => {
    await dbManager.close();
  });

  it("should fail when a query exceeds the global statement_timeout", async () => {
    const db = dbManager.db;
    
    // On essaie d'exécuter un sleep plus long que le timeout configuré (si on le baisse pour le test)
    // Ici on va utiliser withTimeout pour tester la logique de timeout spécifique
    try {
      await withTimeout(100, async (tx) => {
        await tx.execute(sql`SELECT pg_sleep(0.5)`);
      });
      throw new Error("Should have timed out");
    } catch (error: any) {
      // PostgreSQL error code for statement_timeout is 57014
      expect(error.message).toContain("statement timeout");
    }
  });

  it("should succeed when a query is within the timeout", async () => {
    const result = await withTimeout(1000, async (tx) => {
      const res = await tx.execute(sql`SELECT 1 as val`);
      return res;
    });
    expect(result).toBeDefined();
  });
});

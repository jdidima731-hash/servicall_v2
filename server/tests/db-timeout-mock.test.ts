import { describe, it, expect, vi, beforeEach } from "vitest";
import { sql } from "drizzle-orm";

// Mocking the DB logic
const mockExecute = vi.fn();
const mockTransaction = vi.fn(async (cb) => {
  const tx = { execute: mockExecute };
  return await cb(tx);
});

const getDbInstance = () => ({
  transaction: mockTransaction
});

async function withTimeout<T>(timeoutMs: number, callback: (tx: any) => Promise<T>): Promise<T> {
  const database = getDbInstance();
  return await database.transaction(async (tx: any) => {
    await tx.execute(sql`SET LOCAL statement_timeout = ${timeoutMs}`);
    try {
      const result = await callback(tx);
      await tx.execute(sql`SET LOCAL statement_timeout = 0`);
      return result;
    } catch (e) {
      await tx.execute(sql`SET LOCAL statement_timeout = 0`);
      throw e;
    }
  });
}

describe("Database Timeouts Logic", () => {
  beforeEach(() => {
    mockExecute.mockClear();
  });

  it("should set and reset statement_timeout", async () => {
    await withTimeout(500, async (tx) => {
      await tx.execute(sql`SELECT 1`);
    });

    // On vérifie que execute a été appelé 3 fois (SET, SELECT, SET 0)
    expect(mockExecute).toHaveBeenCalledTimes(3);
    
    // Premier appel : SET LOCAL statement_timeout = 500
    const firstCall = mockExecute.mock.calls[0][0];
    expect(JSON.stringify(firstCall)).toContain("SET LOCAL statement_timeout = ");
    
    // Dernier appel : SET LOCAL statement_timeout = 0
    const lastCall = mockExecute.mock.calls[2][0];
    expect(JSON.stringify(lastCall)).toContain("SET LOCAL statement_timeout = 0");
  });

  it("should reset timeout even on error", async () => {
    try {
      await withTimeout(500, async (tx) => {
        throw new Error("Query failed");
      });
    } catch (e) {}

    // On vérifie que le reset a été appelé
    expect(mockExecute).toHaveBeenCalledTimes(2); // SET, puis SET 0 suite à l'erreur
    const lastCall = mockExecute.mock.calls[1][0];
    expect(JSON.stringify(lastCall)).toContain("SET LOCAL statement_timeout = 0");
  });
});

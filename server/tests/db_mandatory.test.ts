import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as db from "../db";
import { dbManager } from "../services/dbManager";
import { users, tenants } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

describe("✅ ACTION 12 – Tests DB obligatoires", () => {
  beforeAll(async () => {
    await dbManager.initialize();
  });

  afterAll(async () => {
    await dbManager.close();
  });

  it("devrait pouvoir insérer, sélectionner et supprimer un utilisateur", async () => {
    const testEmail = `test_${Date.now()}@example.com`;
    
    // 1. INSERT
    const [newUser] = await db.createUser({
      email: testEmail,
      name: "Test User",
      openId: `test_openid_${Date.now()}`,
    });
    expect(newUser).toBeDefined();
    expect(newUser.email).toBe(testEmail);

    // 2. SELECT
    const foundUser = await db.getUserByEmail(testEmail);
    expect(foundUser).toBeDefined();
    expect(foundUser?.id).toBe(newUser.id);

    // 3. DELETE
    const database = dbManager.db;
    await database.delete(users).where(eq(users.id, newUser.id));
    
    const deletedUser = await db.getUserByEmail(testEmail);
    expect(deletedUser).toBeUndefined();
  });

  it("devrait pouvoir insérer, sélectionner et supprimer un tenant", async () => {
    const testSlug = `test-tenant-${Date.now()}`;
    
    // 1. INSERT
    const [newTenant] = await db.createTenant({
      name: "Test Tenant",
      slug: testSlug,
    });
    expect(newTenant).toBeDefined();
    expect(newTenant.slug).toBe(testSlug);

    // 2. SELECT
    const foundTenant = await db.getTenantById(newTenant.id);
    expect(foundTenant).toBeDefined();
    expect(foundTenant?.id).toBe(newTenant.id);

    // 3. DELETE
    const database = dbManager.db;
    await database.delete(tenants).where(eq(tenants.id, newTenant.id));
    
    const deletedTenant = await db.getTenantById(newTenant.id);
    expect(deletedTenant).toBeUndefined();
  });
});

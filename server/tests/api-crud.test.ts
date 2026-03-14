/**
 * TESTS API CRUD
 * Tests automatisés pour les endpoints CRUD principaux
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createCaller } from "../_core/trpc";
import { appRouter } from "../routers";

// ============================================
// SETUP
// ============================================

let caller: ReturnType<typeof createCaller>;
let testTenantId: number;
let testUserId: number;
let testEntityId: number;

beforeAll(async () => {
  // Créer un contexte de test
  const mockContext = {
    user: {
      id: 1,
      email: "test@example.com",
      tenantId: 1,
      role: "admin" as const,
    },
    tenantId: 1,
    tenantContext: {
      id: 1,
      role: "admin" as const,
    },
    correlationId: "test-correlation-id",
  };

  caller = appRouter.createCaller(mockContext as any);
  testTenantId = 1;
  testUserId = 1;
});

afterAll(async () => {
  // Cleanup si nécessaire
});

// ============================================
// TESTS BUSINESS ENTITIES
// ============================================

describe("Business Entities CRUD", () => {
  it("should list business entities", async () => {
    const result = await caller.businessEntities.list();
    
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("should create a business entity", async () => {
    const result = await caller.businessEntities.create({
      type: "product",
      title: "Test Product",
      description: "Test description",
      price: 99.99,
      vatRate: 20,
      isActive: true,
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty("id");
    expect(result.data.title).toBe("Test Product");
    
    testEntityId = result.data.id;
  });

  it("should get entity by id", async () => {
    if (!testEntityId) {
      // Créer une entité de test si elle n'existe pas
      const created = await caller.businessEntities.create({
        type: "product",
        title: "Test Product for Get",
        description: "Test",
        price: 50,
        isActive: true,
      });
      testEntityId = created.data.id;
    }

    const result = await caller.businessEntities.getById({ id: testEntityId });
    
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.data.id).toBe(testEntityId);
  });

  it("should update a business entity", async () => {
    if (!testEntityId) {
      const created = await caller.businessEntities.create({
        type: "product",
        title: "Test Product for Update",
        description: "Test",
        price: 50,
        isActive: true,
      });
      testEntityId = created.data.id;
    }

    const result = await caller.businessEntities.update({
      id: testEntityId,
      title: "Updated Product",
      price: 149.99,
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.data.title).toBe("Updated Product");
    expect(result.data.price).toBe(149.99);
  });

  it("should search business entities", async () => {
    const result = await caller.businessEntities.search({
      query: "Test",
      type: "product",
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("should delete a business entity", async () => {
    if (!testEntityId) {
      const created = await caller.businessEntities.create({
        type: "product",
        title: "Test Product for Delete",
        description: "Test",
        price: 50,
        isActive: true,
      });
      testEntityId = created.data.id;
    }

    const result = await caller.businessEntities.delete({ id: testEntityId });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });
});

// ============================================
// TESTS AUTH
// ============================================

describe("Authentication", () => {
  it("should reject invalid credentials", async () => {
    try {
      await caller.auth.login({
        email: "invalid@example.com",
        password: "wrongpassword",
      });
      
      // Si on arrive ici, le test échoue
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error).toBeDefined();
      expect(error.code).toBe("UNAUTHORIZED");
    }
  });
});

// ============================================
// TESTS MULTI-TENANT
// ============================================

describe("Multi-tenant Isolation", () => {
  it("should not access other tenant's data", async () => {
    // Créer un contexte avec un autre tenant
    const otherTenantContext = {
      user: {
        id: 999,
        email: "other@example.com",
        tenantId: 999,
        role: "admin" as const,
      },
      tenantId: 999,
      tenantContext: {
        id: 999,
        role: "admin" as const,
      },
      correlationId: "test-isolation",
    };

    const otherCaller = appRouter.createCaller(otherTenantContext as any);

    try {
      // Essayer d'accéder à une entité du tenant 1 avec le contexte du tenant 999
      if (testEntityId) {
        await otherCaller.businessEntities.getById({ id: testEntityId });
        
        // Si on arrive ici, l'isolation a échoué
        expect(true).toBe(false);
      }
    } catch (error: any) {
      // L'erreur est attendue (NOT_FOUND ou FORBIDDEN)
      expect(error).toBeDefined();
      expect(["NOT_FOUND", "FORBIDDEN"]).toContain(error.code);
    }
  });
});

// ============================================
// TESTS WORKFLOW
// ============================================

describe("Workflow Actions", () => {
  it("should list workflows", async () => {
    const result = await caller.workflow.list();
    
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ============================================
// TESTS VALIDATION
// ============================================

describe("Input Validation", () => {
  it("should reject invalid email format", async () => {
    try {
      await caller.auth.login({
        email: "not-an-email",
        password: "password123",
      });
      
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error).toBeDefined();
      expect(error.code).toBe("BAD_REQUEST");
    }
  });

  it("should reject negative prices", async () => {
    try {
      await caller.businessEntities.create({
        type: "product",
        title: "Invalid Product",
        price: -50,
        isActive: true,
      });
      
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error).toBeDefined();
      expect(error.code).toBe("BAD_REQUEST");
    }
  });

  it("should reject empty required fields", async () => {
    try {
      await caller.businessEntities.create({
        type: "product",
        title: "",
        isActive: true,
      } as any);
      
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error).toBeDefined();
      expect(error.code).toBe("BAD_REQUEST");
    }
  });
});

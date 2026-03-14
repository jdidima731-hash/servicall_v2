/**
 * BLOC 2 - Tests d'isolation RLS
 * Vérifie que la Row Level Security fonctionne correctement
 * et qu'un tenant ne peut JAMAIS accéder aux données d'un autre tenant
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { dbManager } from "../services/dbManager";
import * as schema from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { setTenantContext, clearTenantContext } from "../middleware/rlsMiddleware";

describe("RLS Isolation Tests - BLOC 2", () => {
  let tenant1Id: number;
  let tenant2Id: number;
  let prospect1Id: number;
  let prospect2Id: number;

  beforeAll(async () => {
    const db = dbManager.db;

    // Créer deux tenants de test
    const [tenant1] = await db.insert(schema.tenants).values({
      slug: "test-tenant-1-rls",
      name: "Test Tenant 1",
      isActive: true,
    }).returning();
    tenant1Id = tenant1.id;

    const [tenant2] = await db.insert(schema.tenants).values({
      slug: "test-tenant-2-rls",
      name: "Test Tenant 2",
      isActive: true,
    }).returning();
    tenant2Id = tenant2.id;

    // Créer un prospect pour chaque tenant (sans RLS pour le setup)
    await clearTenantContext();

    const [prospect1] = await db.insert(schema.prospects).values({
      tenantId: tenant1Id,
      firstName: "John",
      lastName: "Doe",
      phone: "+33612345678",
      status: "new",
    }).returning();
    prospect1Id = prospect1.id;

    const [prospect2] = await db.insert(schema.prospects).values({
      tenantId: tenant2Id,
      firstName: "Jane",
      lastName: "Smith",
      phone: "+33698765432",
      status: "new",
    }).returning();
    prospect2Id = prospect2.id;
  });

  afterAll(async () => {
    // Nettoyer les données de test
    const db = dbManager.db;
    await clearTenantContext();

    if (prospect1Id) {
      await db.delete(schema.prospects).where(eq(schema.prospects.id, prospect1Id));
    }
    if (prospect2Id) {
      await db.delete(schema.prospects).where(eq(schema.prospects.id, prospect2Id));
    }
    if (tenant1Id) {
      await db.delete(schema.tenants).where(eq(schema.tenants.id, tenant1Id));
    }
    if (tenant2Id) {
      await db.delete(schema.tenants).where(eq(schema.tenants.id, tenant2Id));
    }
  });

  it("Tenant 1 peut accéder uniquement à ses propres prospects", async () => {
    const db = dbManager.db;

    // Définir le contexte du tenant 1
    await setTenantContext(tenant1Id);

    // Récupérer tous les prospects (devrait être filtré par RLS)
    const prospects = await db.select().from(schema.prospects);

    // Vérifier que seul le prospect du tenant 1 est retourné
    expect(prospects.length).toBeGreaterThan(0);
    prospects.forEach(prospect => {
      expect(prospect.tenantId).toBe(tenant1Id);
    });

    // Vérifier que le prospect du tenant 2 n'est PAS accessible
    const prospect2 = prospects.find(p => p.id === prospect2Id);
    expect(prospect2).toBeUndefined();
  });

  it("Tenant 2 peut accéder uniquement à ses propres prospects", async () => {
    const db = dbManager.db;

    // Définir le contexte du tenant 2
    await setTenantContext(tenant2Id);

    // Récupérer tous les prospects
    const prospects = await db.select().from(schema.prospects);

    // Vérifier que seul le prospect du tenant 2 est retourné
    expect(prospects.length).toBeGreaterThan(0);
    prospects.forEach(prospect => {
      expect(prospect.tenantId).toBe(tenant2Id);
    });

    // Vérifier que le prospect du tenant 1 n'est PAS accessible
    const prospect1 = prospects.find(p => p.id === prospect1Id);
    expect(prospect1).toBeUndefined();
  });

  it("Tenant 1 ne peut PAS lire les données du Tenant 2 via ID direct", async () => {
    const db = dbManager.db;

    // Définir le contexte du tenant 1
    await setTenantContext(tenant1Id);

    // Tenter de récupérer le prospect du tenant 2 par son ID
    const result = await db
      .select()
      .from(schema.prospects)
      .where(eq(schema.prospects.id, prospect2Id));

    // La RLS devrait bloquer l'accès, résultat vide
    expect(result.length).toBe(0);
  });

  it("Tenant 2 ne peut PAS lire les données du Tenant 1 via ID direct", async () => {
    const db = dbManager.db;

    // Définir le contexte du tenant 2
    await setTenantContext(tenant2Id);

    // Tenter de récupérer le prospect du tenant 1 par son ID
    const result = await db
      .select()
      .from(schema.prospects)
      .where(eq(schema.prospects.id, prospect1Id));

    // La RLS devrait bloquer l'accès, résultat vide
    expect(result.length).toBe(0);
  });

  it("Sans contexte tenant, aucune donnée n'est accessible", async () => {
    const db = dbManager.db;

    // Réinitialiser le contexte
    await clearTenantContext();

    // Tenter de récupérer les prospects sans contexte
    const prospects = await db.select().from(schema.prospects);

    // Avec RLS activée et sans contexte, aucune donnée ne devrait être retournée
    // Note: Selon la configuration, cela peut retourner [] ou lever une erreur
    expect(prospects.length).toBe(0);
  });

  it("Test d'isolation sur la table messages", async () => {
    const db = dbManager.db;

    // Créer un message pour chaque tenant
    await clearTenantContext();

    const [message1] = await db.insert(schema.messages).values({
      tenantId: tenant1Id,
      prospectId: prospect1Id,
      type: "sms",
      direction: "outbound",
      content: "Test message tenant 1",
      status: "sent",
    }).returning();

    const [message2] = await db.insert(schema.messages).values({
      tenantId: tenant2Id,
      prospectId: prospect2Id,
      type: "sms",
      direction: "outbound",
      content: "Test message tenant 2",
      status: "sent",
    }).returning();

    // Tester l'isolation pour tenant 1
    await setTenantContext(tenant1Id);
    const messages1 = await db.select().from(schema.messages);
    expect(messages1.every(m => m.tenantId === tenant1Id)).toBe(true);
    expect(messages1.find(m => m.id === message2.id)).toBeUndefined();

    // Tester l'isolation pour tenant 2
    await setTenantContext(tenant2Id);
    const messages2 = await db.select().from(schema.messages);
    expect(messages2.every(m => m.tenantId === tenant2Id)).toBe(true);
    expect(messages2.find(m => m.id === message1.id)).toBeUndefined();

    // Nettoyer
    await clearTenantContext();
    await db.delete(schema.messages).where(eq(schema.messages.id, message1.id));
    await db.delete(schema.messages).where(eq(schema.messages.id, message2.id));
  });

  it("Test d'isolation sur la table calls", async () => {
    const db = dbManager.db;

    // Créer un appel pour chaque tenant
    await clearTenantContext();

    const [call1] = await db.insert(schema.calls).values({
      tenantId: tenant1Id,
      prospectId: prospect1Id,
      callType: "outbound",
      status: "completed",
      duration: 120,
    }).returning();

    const [call2] = await db.insert(schema.calls).values({
      tenantId: tenant2Id,
      prospectId: prospect2Id,
      callType: "outbound",
      status: "completed",
      duration: 90,
    }).returning();

    // Tester l'isolation pour tenant 1
    await setTenantContext(tenant1Id);
    const calls1 = await db.select().from(schema.calls);
    expect(calls1.every(c => c.tenantId === tenant1Id)).toBe(true);
    expect(calls1.find(c => c.id === call2.id)).toBeUndefined();

    // Tester l'isolation pour tenant 2
    await setTenantContext(tenant2Id);
    const calls2 = await db.select().from(schema.calls);
    expect(calls2.every(c => c.tenantId === tenant2Id)).toBe(true);
    expect(calls2.find(c => c.id === call1.id)).toBeUndefined();

    // Nettoyer
    await clearTenantContext();
    await db.delete(schema.calls).where(eq(schema.calls.id, call1.id));
    await db.delete(schema.calls).where(eq(schema.calls.id, call2.id));
  });
});

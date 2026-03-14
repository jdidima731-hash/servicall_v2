/**
 * DATABASE ACCESS LAYER - VERSION POSTGRESQL
 * Centralisation des requêtes métier pour Servicall v2
 */

import { eq, and, sql, desc, gte, lte, type ExtractTablesWithRelations } from "drizzle-orm";
import { dbManager } from "./services/dbManager";
import * as schema from "../drizzle/schema";
import { logger } from "./infrastructure/logger";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";

// Re-export du schéma pour usage facile
export * from "../drizzle/schema";

/**
 * Type pour les transactions Drizzle
 */
export type DbTransaction = PgTransaction<
  PostgresJsQueryResultHKT, 
  typeof schema, 
  ExtractTablesWithRelations<typeof schema>
>;

/**
 * Accès à l'instance de base de données
 */
export const getDb = async () => {
  return dbManager.db;
};

/**
 * ✅ CORRECTION BLOC 1: getDbInstance lance une erreur explicite si non initialisé
 */
export const getDbInstance = () => {
  if (!dbManager.db) {
    throw new Error("[DBManager] ❌ Base de données non initialisée.");
  }
  return dbManager.db;
};

/**
 * ✅ ACTION 6 – Injecter tenantId côté DB
 */
export async function withTenant<T>(tenantId: number, callback: (tx: DbTransaction) => Promise<T>): Promise<T> {
  const database = getDbInstance();
  return await database.transaction(async (tx: unknown) => {
    // Injecter le tenantId pour le RLS
    await (tx as DbTransaction).execute(sql`SET app.tenant_id = ${tenantId}`);
    // Exécuter le callback
    return await callback(tx as unknown as DbTransaction);
  });
}

/**
 * ✅ ACTION 12 – Timeout par requête/transaction
 */
export async function withTimeout<T>(timeoutMs: number, callback: (tx: DbTransaction) => Promise<T>): Promise<T> {
  const database = getDbInstance();
  return await database.transaction(async (tx: unknown) => {
    await (tx as DbTransaction).execute(sql`SET LOCAL statement_timeout = ${timeoutMs}`);
    const result = await callback(tx as unknown as DbTransaction);
    await (tx as DbTransaction).execute(sql`SET LOCAL statement_timeout = 0`); // Reset
    return result;
  });
}

/**
 * ✅ CORRECTION BLOC 1: Utilisation d'un Proxy pour déléguer vers dbManager.db
 */
export const db = new Proxy({} as typeof dbManager.db, {
  get(_target, prop) {
    // ✅ FIX BUG #7: Vérifier NODE_ENV pour éviter de bypasser la DB en production
    if (process.env['NODE_ENV'] !== 'production' && process.env['DB_ENABLED'] === "false") {
      return () => { throw new Error("[DBManager] ❌ Base de données désactivée en mode démo."); };
    }
    const database = dbManager.db;
    if (!database) {
      throw new Error("[DBManager] ❌ Base de données non initialisée.");
    }
    return database[prop];
  }
});

// ============================================
// USER MANAGEMENT
// ============================================

export async function createUser(user: schema.InsertUser): Promise<schema.User[]> {
  const database = getDbInstance();
  try {
    return await database.insert(schema.users).values(user).returning();
  } catch (error: unknown) {
    logger.error("[DB] Failed to create user", { error });
    throw error;
  }
}

export async function upsertUser(user: schema.InsertUser): Promise<void> {
  const database = getDbInstance();
  try {
    await database.insert(schema.users)
      .values(user)
      .onConflictDoUpdate({
        target: schema.users.openId,
        set: { ...user, updatedAt: new Date() }
      });
  } catch (error: unknown) {
    logger.error("[DB] Failed to upsert user", { error });
    throw error;
  }
}

export async function getUserByEmail(email: string): Promise<schema.User | undefined> {
  // ✅ FIX BUG #7: Vérifier NODE_ENV pour éviter de bypasser la DB en production
  if (process.env['NODE_ENV'] !== 'production' && process.env['DB_ENABLED'] === "false") {
    // ✅ FIX: Vrai hash bcrypt pour le mode démo (mot de passe: Admin1234!)
    return {
      id: 1,
      openId: "admin-openid",
      email: "admin@servicall.com",
      name: "Admin Demo",
      role: "admin",
      passwordHash: "$2b$12$Dl3SCpsUaGVGzavR8vJDCevwq9MHfBNmJGIyiglcE87hKWgqd8qpu",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as schema.User;
  }
  const database = getDbInstance();
  const result = await database.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  return result[0] ?? undefined;
}

export async function getUserById(id: number): Promise<schema.User | undefined> {
  const database = getDbInstance();
  const result = await database.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
  return result[0] ?? undefined;
}

export async function getUserByOpenId(openId: string): Promise<schema.User | undefined> {
  const database = getDbInstance();
  const result = await database.select().from(schema.users).where(eq(schema.users.openId, openId)).limit(1);
  return result[0] ?? undefined;
}

// ============================================
// TENANT MANAGEMENT
// ============================================

export async function getTenantById(tenantId: number): Promise<schema.Tenant | undefined> {
  const database = getDbInstance();
  const result = await database.select().from(schema.tenants).where(eq(schema.tenants.id, tenantId)).limit(1);
  return result[0] ?? undefined;
}

export async function getUserRoleInTenant(userId: number, tenantId: number): Promise<string | null> {
  const database = getDbInstance();
  const result = await database
    .select({ role: schema.tenantUsers.role })
    .from(schema.tenantUsers)
    .where(and(
      eq(schema.tenantUsers.userId, userId), 
      eq(schema.tenantUsers.tenantId, tenantId)
    ))
    .limit(1);
  return result[0]?.role ?? null;
}

export async function getUserTenants(userId: number): Promise<Array<{
  id: number;
  name: string;
  slug: string;
  role: string | null;
  isActive: boolean | null;
}>> {
  // ✅ FIX BUG #7: Vérifier NODE_ENV pour éviter de bypasser la DB en production
  if (process.env['NODE_ENV'] !== 'production' && process.env['DB_ENABLED'] === "false") {
    return [{
      id: 1,
      name: "Espace Démo",
      slug: "demo",
      role: "owner",
      isActive: true
    }];
  }
  const database = getDbInstance();
  return await database
    .select({
      id: schema.tenants.id,
      name: schema.tenants.name,
      slug: schema.tenants.slug,
      role: schema.tenantUsers.role,
      isActive: schema.tenants.isActive
    })
    .from(schema.tenantUsers)
    .innerJoin(schema.tenants, eq(schema.tenantUsers.tenantId, schema.tenants.id))
    .where(eq(schema.tenantUsers.userId, userId));
}

export async function getTenantMembers(tenantId: number): Promise<Array<{
  id: number;
  name: string | null;
  email: string;
  role: string | null;
  isActive: boolean | null;
}>> {
  const database = getDbInstance();
  return await database
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      role: schema.tenantUsers.role,
      isActive: schema.tenantUsers.isActive
    })
    .from(schema.tenantUsers)
    .innerJoin(schema.users, eq(schema.tenantUsers.userId, schema.users.id))
    .where(eq(schema.tenantUsers.tenantId, tenantId));
}

export async function addUserToTenant(userId: number, tenantId: number, role: string = "agent"): Promise<schema.TenantUser> {
  const database = getDbInstance();
  try {
    const [result] = await database.insert(schema.tenantUsers).values({
      userId,
      tenantId,
      role,
      isActive: true
    }).returning();
    return result;
  } catch (error: unknown) {
    logger.error("[DB] Failed to add user to tenant", { error, userId, tenantId });
    throw error;
  }
}

export async function createTenant(tenant: schema.InsertTenant): Promise<schema.Tenant[]> {
  const database = getDbInstance();
  try {
    return await database.insert(schema.tenants).values(tenant).returning();
  } catch (error: unknown) {
    logger.error("[DB] Failed to create tenant", { error });
    throw error;
  }
}

export async function updateTenant(tenantId: number, data: Partial<schema.Tenant>): Promise<void> {
  const database = getDbInstance();
  try {
    await database.update(schema.tenants)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.tenants.id, tenantId));
  } catch (error: unknown) {
    logger.error("[DB] Failed to update tenant", { error, tenantId });
    throw error;
  }
}

export async function updateTenantUser(userId: number, tenantId: number, data: Partial<schema.TenantUser>): Promise<void> {
  const database = getDbInstance();
  try {
    await database.update(schema.tenantUsers)
      .set({ ...data, updatedAt: new Date() })
      .where(and(
        eq(schema.tenantUsers.userId, userId),
        eq(schema.tenantUsers.tenantId, tenantId)
      ));
  } catch (error: unknown) {
    logger.error("[DB] Failed to update tenant user", { error, userId, tenantId });
    throw error;
  }
}

// ============================================
// PROSPECT MANAGEMENT
// ============================================

export async function getProspectsByTenant(tenantId: number, limit = 50, offset = 0, userId?: number): Promise<schema.Prospect[]> {
  const database = getDbInstance();
  let query = database.select().from(schema.prospects).where(eq(schema.prospects.tenantId, tenantId));
  
  if (userId) {
    query = query.where(eq(schema.prospects.assignedTo, userId));
  }
  
  return await query.limit(limit).offset(offset).orderBy(desc(schema.prospects.createdAt));
}

export async function getProspectById(id: number, tenantId?: number): Promise<schema.Prospect | undefined> {
  const database = getDbInstance();
  let conditions: import("drizzle-orm").SQL<unknown> = eq(schema.prospects.id, id);
  if (tenantId) {
    conditions = and(conditions, eq(schema.prospects.tenantId, tenantId)) ?? conditions;
  }
  const result = await database.select().from(schema.prospects).where(conditions).limit(1);
  return result[0] ?? undefined;
}

export async function createProspect(prospect: schema.InsertProspect): Promise<schema.Prospect> {
  const database = getDbInstance();
  try {
    const [result] = await database.insert(schema.prospects).values(prospect).returning();
    return result;
  } catch (error: unknown) {
    logger.error("[DB] Failed to create prospect", { error });
    throw error;
  }
}

export async function updateProspect(id: number, data: Partial<schema.Prospect>): Promise<schema.Prospect> {
  const database = getDbInstance();
  try {
    const [result] = await database.update(schema.prospects)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.prospects.id, id))
      .returning();
    return result;
  } catch (error: unknown) {
    logger.error("[DB] Failed to update prospect", { error, id });
    throw error;
  }
}

export async function deleteProspect(id: number, tenantId: number): Promise<schema.Prospect> {
  const database = getDbInstance();
  try {
    const [result] = await database.delete(schema.prospects)
      .where(and(eq(schema.prospects.id, id), eq(schema.prospects.tenantId, tenantId)))
      .returning();
    return result;
  } catch (error: unknown) {
    logger.error("[DB] Failed to delete prospect", { error, id });
    throw error;
  }
}

// ============================================
// CALL & APPOINTMENT MANAGEMENT
// ============================================

export async function getCallById(id: number, tenantId?: number): Promise<schema.Call | undefined> {
  const database = getDbInstance();
  let conditions: import("drizzle-orm").SQL<unknown> = eq(schema.calls.id, id);
  if (tenantId) {
    conditions = and(conditions, eq(schema.calls.tenantId, tenantId)) ?? conditions;
  }
  const result = await database.select().from(schema.calls).where(conditions).limit(1);
  return result[0] ?? undefined;
}

export async function createCall(call: schema.InsertCall): Promise<schema.Call> {
  const database = getDbInstance();
  try {
    const [result] = await database.insert(schema.calls).values(call).returning();
    return result;
  } catch (error: unknown) {
    logger.error("[DB] Failed to create call", { error });
    throw error;
  }
}

export async function updateCall(id: number, data: Partial<schema.Call>): Promise<schema.Call> {
  const database = getDbInstance();
  try {
    const [result] = await database.update(schema.calls)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.calls.id, id))
      .returning();
    return result;
  } catch (error: unknown) {
    logger.error("[DB] Failed to update call", { error, id });
    throw error;
  }
}

export async function getCallsByProspect(prospectId: number, tenantId: number): Promise<schema.Call[]> {
  const database = getDbInstance();
  return await database
    .select()
    .from(schema.calls)
    .where(and(eq(schema.calls.prospectId, prospectId), eq(schema.calls.tenantId, tenantId)))
    .orderBy(desc(schema.calls.createdAt));
}

export async function getCallsByTenant(tenantId: number): Promise<schema.Call[]> {
  const database = getDbInstance();
  return await database
    .select()
    .from(schema.calls)
    .where(eq(schema.calls.tenantId, tenantId))
    .orderBy(desc(schema.calls.createdAt));
}

export async function getAppointmentsByTenant(tenantId: number): Promise<schema.Appointment[]> {
  const database = getDbInstance();
  return await database
    .select()
    .from(schema.appointments)
    .where(eq(schema.appointments.tenantId, tenantId))
    .orderBy(desc(schema.appointments.scheduledAt));
}

// ============================================
// DASHBOARD & METRICS
// ============================================

export async function getTeamPerformanceMetrics(_tenantId: number, _timeRange: string) {
  // Mock implementation for dashboard
  return {
    avgQualityScore: 85.5,
    conversionRate: 12.3,
    sentimentRate: 78.2
  };
}

export async function getAtRiskAgents(_tenantId: number) {
  // Mock implementation for dashboard
  return [];
}

export async function getAgentPerformanceMetrics(_tenantId: number) {
  // Mock implementation for dashboard
  return [];
}

export async function deleteCall(id: number): Promise<schema.Call> {
  const database = getDbInstance();
  try {
    const [result] = await database.delete(schema.calls).where(eq(schema.calls.id, id)).returning();
    return result;
  } catch (error: unknown) {
    logger.error("[DB] Failed to delete call", { error, id });
    throw error;
  }
}

export async function countPendingCalls(tenantId: number, agentId?: number): Promise<number> {
  const database = getDbInstance();
  let conditions = and(eq(schema.calls.tenantId, tenantId), eq(schema.calls.status, "scheduled"));
  if (agentId) {
    conditions = and(conditions, eq(schema.calls.agentId, agentId));
  }
  const [result] = await database.select({ count: sql<number>`count(*)` }).from(schema.calls).where(conditions);
  return Number(result?.count ?? 0);
}

export async function createProspectOptimized(prospect: schema.InsertProspect): Promise<schema.Prospect> {
  return createProspect(prospect);
}

export async function createAppointment(appointment: schema.InsertAppointment): Promise<schema.Appointment> {
  const database = getDbInstance();
  try {
    const [result] = await database.insert(schema.appointments).values(appointment).returning();
    return result;
  } catch (error: unknown) {
    logger.error("[DB] Failed to create appointment", { error });
    throw error;
  }
}

export async function updateAppointment(id: number, data: Partial<schema.Appointment>): Promise<schema.Appointment> {
  const database = getDbInstance();
  try {
    const [result] = await database.update(schema.appointments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.appointments.id, id))
      .returning();
    return result;
  } catch (error: unknown) {
    logger.error("[DB] Failed to update appointment", { error, id });
    throw error;
  }
}

export async function getAppointmentById(id: number, tenantId?: number): Promise<schema.Appointment | undefined> {
  const database = getDbInstance();
  let conditions: import("drizzle-orm").SQL<unknown> = eq(schema.appointments.id, id);
  if (tenantId) {
    conditions = and(conditions, eq(schema.appointments.tenantId, tenantId)) ?? conditions;
  }
  const result = await database.select().from(schema.appointments).where(conditions).limit(1);
  return result[0] ?? undefined;
}

export async function deleteAppointment(id: number, tenantId: number): Promise<schema.Appointment> {
  const database = getDbInstance();
  try {
    const [result] = await database.delete(schema.appointments)
      .where(and(eq(schema.appointments.id, id), eq(schema.appointments.tenantId, tenantId)))
      .returning();
    return result;
  } catch (error: unknown) {
    logger.error("[DB] Failed to delete appointment", { error, id });
    throw error;
  }
}

export async function getAppointmentsByProspect(prospectId: number, tenantId: number): Promise<schema.Appointment[]> {
  const database = getDbInstance();
  return await database
    .select()
    .from(schema.appointments)
    .where(and(eq(schema.appointments.prospectId, prospectId), eq(schema.appointments.tenantId, tenantId)))
    .orderBy(desc(schema.appointments.scheduledAt));
}

export async function getAppointmentsByDateRange(tenantId: number, start: Date, end: Date): Promise<schema.Appointment[]> {
  const database = getDbInstance();
  return await database
    .select()
    .from(schema.appointments)
    .where(and(
      eq(schema.appointments.tenantId, tenantId),
      gte(schema.appointments.scheduledAt, start),
      sql`${schema.appointments.scheduledAt} <= ${end}`
    ))
    .orderBy(schema.appointments.scheduledAt);
}

export async function countTodayAppointments(tenantId: number, agentId?: number): Promise<number> {
  const database = getDbInstance();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  
  let conditions = and(
    eq(schema.appointments.tenantId, tenantId),
    gte(schema.appointments.scheduledAt, startOfDay),
    lte(schema.appointments.scheduledAt, endOfDay)
  );
  
  if (agentId) {
    conditions = and(conditions, eq(schema.appointments.agentId, agentId));
  }
  
  const [result] = await database.select({ count: sql<number>`count(*)` }).from(schema.appointments).where(conditions);
  return Number(result?.count ?? 0);
}

export async function getWorkflowsByTenant(_tenantId: number): Promise<any[]> {
  // Mock implementation as workflows table might not be fully defined in this schema version
  return [];
}

export async function getSubscriptionByTenant(_tenantId: number): Promise<any> {
  // Mock implementation for billing
  return { status: "active", plan: "pro" };
}

export async function createStripeEvent(event: { stripeEventId: string; type: string; payload: any; status: string }): Promise<void> {
  const database = getDbInstance();
  // Note: stripe_events table might be missing in some schema versions, we use sql raw to be safe
  await database.execute(sql`
    INSERT INTO stripe_events (stripe_event_id, type, payload, status, created_at)
    VALUES (${event.stripeEventId}, ${event.type}, ${JSON.stringify(event.payload)}, ${event.status}, NOW())
    ON CONFLICT (stripe_event_id) DO NOTHING
  `);
}

export async function getPendingStripeEvents(): Promise<any[]> {
  const database = getDbInstance();
  try {
    const result = await database.execute(sql`
      SELECT id, stripe_event_id as "stripeEventId", type, payload, status 
      FROM stripe_events 
      WHERE status = 'pending' 
      ORDER BY created_at ASC 
      LIMIT 50
    `);
    return result as any[];
  } catch (e) {
    return [];
  }
}

export async function updateStripeEventStatus(id: number, status: string): Promise<void> {
  const database = getDbInstance();
  await database.execute(sql`
    UPDATE stripe_events SET status = ${status}, updated_at = NOW() WHERE id = ${id}
  `);
}

export async function getTenantBySlug(slug: string): Promise<schema.Tenant | undefined> {
  const database = getDbInstance();
  const result = await database.select().from(schema.tenants).where(eq(schema.tenants.slug, slug)).limit(1);
  return result[0] ?? undefined;
}

export async function getTenantByDomain(domain: string): Promise<schema.Tenant | undefined> {
  const database = getDbInstance();
  const result = await database.select().from(schema.tenants).where(eq(schema.tenants.domain, domain)).limit(1);
  return result[0] ?? undefined;
}

export async function updateInvoiceByStripeId(stripeId: string, data: any): Promise<void> {
  const database = getDbInstance();
  await database.update(schema.invoices)
    .set({
      status: data.status,
      paidAt: data.paidAt,
      pdfUrl: data.pdfUrl,
      updatedAt: new Date(),
    })
    .where(eq(schema.invoices.stripeInvoiceId, stripeId));
}

export async function updateSubscriptionByStripeId(stripeId: string, data: any): Promise<void> {
  const database = getDbInstance();
  await database.update(schema.subscriptions)
    .set({
      status: data.status,
      currentPeriodEnd: data.currentPeriodEnd,
      updatedAt: new Date(),
    })
    .where(eq(schema.subscriptions.stripeSubscriptionId, stripeId));
}


export async function getWorkflowById(id: number, tenantId?: number): Promise<any | undefined> {
  try {
    const db = await getDb();
    const { workflows } = await import('../drizzle/schema');
    const { eq, and } = await import('drizzle-orm');
    const conditions = tenantId 
      ? and(eq(workflows.id, id), eq(workflows.tenantId, tenantId))
      : eq(workflows.id, id);
    const result = await db.select().from(workflows).where(conditions).limit(1);
    return result[0] ?? undefined;
  } catch {
    return undefined;
  }
}


export async function createWorkflow(workflow: unknown): Promise<any> {
  try {
    const db = await getDb();
    const { workflows } = await import('../drizzle/schema');
    const result = await db.insert(workflows).values(workflow).returning();
    return result[0] ?? undefined;
  } catch (e) {
    throw e;
  }
}


export async function updateWorkflow(id: number, data: unknown): Promise<any> {
  try {
    const db = await getDb();
    const { workflows } = await import('../drizzle/schema');
    const { eq } = await import('drizzle-orm');
    const result = await db.update(workflows).set(data).where(eq(workflows.id, id)).returning();
    return result[0] ?? undefined;
  } catch (e) {
    throw e;
  }
}


export async function deleteWorkflow(id: number): Promise<any> {
  try {
    const db = await getDb();
    const { workflows } = await import('../drizzle/schema');
    const { eq } = await import('drizzle-orm');
    const result = await db.delete(workflows).where(eq(workflows.id, id)).returning();
    return result[0] ?? undefined;
  } catch (e) {
    throw e;
  }
}


export async function createAuditLog(log: unknown): Promise<any> {
  try {
    const db = await getDb();
    const { auditLogs } = await import('../drizzle/schema');
    const result = await db.insert(auditLogs).values(log).returning();
    return result[0] ?? undefined;
  } catch {
    return null;
  }
}


export async function getAuditLogsByTenant(tenantId: number, limit = 100): Promise<any[]> {
  try {
    const db = await getDb();
    const { auditLogs } = await import('../drizzle/schema');
    const { eq, desc } = await import('drizzle-orm');
    return await db.select().from(auditLogs)
      .where(eq(auditLogs.tenantId, tenantId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  } catch {
    return [];
  }
}


export async function getAuditLogsByUser(userId: number, tenantId: number, limit = 100): Promise<any[]> {
  try {
    const db = await getDb();
    const { auditLogs } = await import('../drizzle/schema');
    const { eq, and, desc } = await import('drizzle-orm');
    return await db.select().from(auditLogs)
      .where(and(eq(auditLogs.userId, userId), eq(auditLogs.tenantId, tenantId)))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  } catch {
    return [];
  }
}


export async function transaction<T>(callback: (tx: unknown) => Promise<T>): Promise<T> {
  const db = await getDb();
  return db.transaction(callback);
}

// ============================================
// TASKS
// ============================================
export async function getTasksByTenant(tenantId: number, limit = 100): Promise<any[]> {
  try {
    const db = await getDb();
    const { tasks } = await import('../drizzle/schema');
    const { eq, desc } = await import('drizzle-orm');
    return await db.select().from(tasks)
      .where(eq(tasks.tenantId, tenantId))
      .orderBy(desc(tasks.createdAt))
      .limit(limit);
  } catch {
    return [];
  }
}

export async function getTaskById(taskId: number, tenantId: number): Promise<any | null> {
  try {
    const db = await getDb();
    const { tasks } = await import('../drizzle/schema');
    const { eq, and } = await import('drizzle-orm');
    const result = await db.select().from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)))
      .limit(1);
    return result[0] ?? null;
  } catch {
    return null;
  }
}

export async function createTask(data: unknown): Promise<any> {
  try {
    const db = await getDb();
    const { tasks } = await import('../drizzle/schema');
    const result = await db.insert(tasks).values(data).returning();
    return result[0] ?? undefined;
  } catch {
    return null;
  }
}

export async function updateTask(taskId: number, data: unknown): Promise<any> {
  try {
    const db = await getDb();
    const { tasks } = await import('../drizzle/schema');
    const { eq } = await import('drizzle-orm');
    const result = await db.update(tasks).set(data).where(eq(tasks.id, taskId)).returning();
    return result[0] ?? undefined;
  } catch {
    return null;
  }
}

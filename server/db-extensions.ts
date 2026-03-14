/**
 * Database Extensions for Role-Based Filtering
 * These functions extend the base db.ts with role-aware filtering
 */

import { eq, and } from "drizzle-orm";
import * as db from "./db";
import { calls, appointments, tasks } from "../drizzle/schema";

// ============================================
// PROSPECT FILTERING BY ROLE
// ============================================

/**
 * Get prospects filtered by agent (agent can only see their own prospects)
 * Note: This is a simplified implementation. In production, you'd need to track
 * which agent created or is assigned to each prospect.
 */
export async function getProspectsByAgent(tenantId: number, _agentId: number) {
  const dbInstance = await db.getDb();
  if (!dbInstance) return [];

  // Note: agentId tracking requires schema migration
  // Current implementation returns all tenant prospects
  return await db.getProspectsByTenant(tenantId);
}

/**
 * Get prospects filtered by manager (manager can see team prospects)
 * Note: This requires a team/department structure which isn't yet implemented
 */
export async function getProspectsByManager(tenantId: number, _managerId: number) {
  const dbInstance = await db.getDb();
  if (!dbInstance) return [];

  // Note: Team structure filtering requires team hierarchy in schema
  // Current implementation returns all tenant prospects
  return await db.getProspectsByTenant(tenantId);
}

// ============================================
// CALL FILTERING BY ROLE
// ============================================

/**
 * Get calls filtered by agent (agent can only see their own calls)
 */
export async function getCallsByAgent(tenantId: number, agentId: number) {
  const dbInstance = await db.getDb();
  if (!dbInstance) return [];

  return await dbInstance
    .select()
    .from(calls)
    .where(and(eq(calls.tenantId, tenantId), eq(calls.agentId, agentId)));
}

/**
 * Get calls filtered by manager (manager can see team calls)
 */
export async function getCallsByManager(tenantId: number, _managerId: number) {
  const dbInstance = await db.getDb();
  if (!dbInstance) return [];

  // Note: Team structure filtering requires team hierarchy in schema
  // Current implementation returns all tenant calls
  return await db.getCallsByTenant(tenantId);
}

// ============================================
// APPOINTMENT FILTERING BY ROLE
// ============================================

/**
 * Get appointments filtered by agent (agent can only see their own appointments)
 */
export async function getAppointmentsByAgent(tenantId: number, agentId: number) {
  const dbInstance = await db.getDb();
  if (!dbInstance) return [];

  return await dbInstance
    .select()
    .from(appointments)
    .where(and(eq(appointments.tenantId, tenantId), eq(appointments.agentId, agentId)));
}

/**
 * Get appointments filtered by manager (manager can see team appointments)
 */
export async function getAppointmentsByManager(tenantId: number, _managerId: number) {
  const dbInstance = await db.getDb();
  if (!dbInstance) return [];

  // Note: Team structure filtering requires team hierarchy in schema
  // Current implementation returns all tenant appointments
  return await db.getAppointmentsByTenant(tenantId);
}

// ============================================
// TASK FILTERING BY ROLE
// ============================================

/**
 * Get tasks filtered by agent (agent can only see their assigned tasks)
 */
export async function getTasksByAgent(tenantId: number, agentId: number) {
  const dbInstance = await db.getDb();
  if (!dbInstance) return [];

  return await dbInstance
    .select()
    .from(tasks)
    .where(and(eq(tasks.tenantId, tenantId), eq(tasks.assignedTo, agentId)));
}

/**
 * Get tasks filtered by manager (manager can see team tasks)
 */
export async function getTasksByManager(tenantId: number, _managerId: number) {
  const dbInstance = await db.getDb();
  if (!dbInstance) return [];

  // Note: Team structure filtering requires team hierarchy in schema
  // Current implementation returns all tenant tasks
  return await db.getTasksByTenant(tenantId);
}

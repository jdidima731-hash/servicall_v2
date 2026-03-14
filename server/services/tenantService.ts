/**
 * Tenant Service - Gestion sécurisée du tenantId
 */

import { SignJWT, jwtVerify } from "jose";
import type { Request, Response } from "express";
import { logger } from "../infrastructure/logger";
import * as db from "../db";

const TENANT_COOKIE_NAME = "servicall_tenant";
const TENANT_JWT_SECRET = process.env['TENANT_JWT_SECRET'] || process.env['ENCRYPTION_KEY'];
const TENANT_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

if (!TENANT_JWT_SECRET && process.env['NODE_ENV'] === "production") {
  logger.error("[TenantService] CRITICAL: TENANT_JWT_SECRET is not configured");
  process.exit(1);
}

export interface TenantPayload {
  tenantId: number;
  userId: number;
  role: "owner" | "admin" | "manager" | "agent" | "viewer";
  issuedAt: number;
}

export async function createTenantToken(
  tenantId: number,
  userId: number,
  role: string
): Promise<string> {
  const secretKey = new TextEncoder().encode(TENANT_JWT_SECRET || "dev-secret");
  const issuedAt = Date.now();
  
  return await new SignJWT({ tenantId, userId, role, issuedAt })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime("30d")
    .setIssuedAt(Math.floor(issuedAt / 1000))
    .sign(secretKey);
}

export async function verifyTenantToken(token: string): Promise<TenantPayload | null> {
  try {
    const secretKey = new TextEncoder().encode(TENANT_JWT_SECRET || "dev-secret");
    const { payload } = await jwtVerify(token, secretKey, { algorithms: ["HS256"] });
    return payload as unknown as TenantPayload;
  } catch (error: unknown) {
    return null;
  }
}

export function setTenantCookie(res: Response, token: string): void {
  res.cookie(TENANT_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === "production",
    sameSite: "strict",
    maxAge: TENANT_COOKIE_MAX_AGE,
    path: "/",
  });
}

export function clearTenantCookie(res: Response): void {
  res.clearCookie(TENANT_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === "production",
    sameSite: "strict",
    path: "/",
  });
}

export function getTenantCookie(req: Request): string | null {
  return (req.cookies as Record<string, string>)?.[TENANT_COOKIE_NAME] || null;
}

export async function extractTenantContext(req: Request): Promise<TenantPayload | null> {
  const token = getTenantCookie(req);
  if (token) {
    const payload = await verifyTenantToken(token);
    if (payload) return payload;
  }

  const headerId = req.headers["x-tenant-id"];
  if (headerId && typeof headerId === "string") {
    const id = parseInt(headerId, 10);
    if (!isNaN(id)) return { tenantId: id, userId: 0, role: "agent", issuedAt: Date.now() };
  }

  return null;
}

export async function switchTenant(userId: number, tenantId: number, res: Response): Promise<{ success: boolean; error?: string }> {
  if (process.env['DB_ENABLED'] === "false") {
    const token = await createTenantToken(tenantId, 1, "admin");
    setTenantCookie(res, token);
    return { success: true };
  }
  const role = await db.getUserRoleInTenant(userId, tenantId);
  if (!role) return { success: false, error: "Accès refusé" };
  const token = await createTenantToken(tenantId, userId, role);
  setTenantCookie(res, token);
  return { success: true };
}

export async function initializeDefaultTenant(userId: number, res: Response): Promise<{ tenantId: number; role: string | null } | null> {
  if (process.env['DB_ENABLED'] === "false") {
    const token = await createTenantToken(1, 1, "admin");
    setTenantCookie(res, token);
    return { tenantId: 1, role: "admin" };
  }
  const tenants = await db.getUserTenants(userId);
  if (tenants.length === 0) return null;
  const defaultTenant = tenants[0];
  const token = await createTenantToken(defaultTenant!.id, userId, defaultTenant!.role ?? "agent");
  setTenantCookie(res, token);
  return { tenantId: defaultTenant!.id, role: defaultTenant!.role };
}

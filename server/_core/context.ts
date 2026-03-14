import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { AuthService, AuthenticatedUser } from "../services/authService";
import { type TenantPayload } from "../services/tenantService";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: AuthenticatedUser | null;
  tenantId: number | null;
  tenantContext: TenantPayload | null;
};

/**
 * Type de contexte pour les procédures protégées (user garanti non-null)
 */
export type ProtectedTrpcContext = Omit<TrpcContext, 'user'> & {
  user: AuthenticatedUser;
};

/**
 * Type de contexte pour les procédures tenant (user et tenantId garantis non-null)
 */
export type TenantTrpcContext = Omit<TrpcContext, 'user' | 'tenantId' | 'tenantContext'> & {
  user: AuthenticatedUser;
  tenantId: number;
  tenantContext: TenantPayload;
};

/**
 * Création de contexte tRPC avec authentification via JWT (cookie de session)
 */
export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let authenticatedUser: AuthenticatedUser | null = null;
  let tenantId: number | null = null;

  try {
    const authResult = await AuthService.authenticateRequest(opts.req);
    if (authResult) {
      authenticatedUser = authResult.user;
      tenantId = authResult.tenantId;
    }
  } catch (_error) {
    // L'authentification est optionnelle pour les procédures publiques.
    authenticatedUser = null;
    tenantId = null;
  }

  // Construire le tenantContext depuis les données d'authentification
  // Le rôle est normalisé vers les valeurs acceptées par TenantPayload
  const normalizeRole = (role: AuthenticatedUser['role'] | string): TenantPayload['role'] => {
    if (role === 'admin' || role === 'owner') {
      return 'admin';
    }
    if (role === 'manager') {
      return 'manager';
    }
    if (role === 'agent') {
      return 'agent';
    }
    return 'agent'; // viewer, superadmin -> agent pour le contexte tenant
  };

  const tenantContext: TenantPayload | null = authenticatedUser ? {
    tenantId: authenticatedUser.tenantId,
    role: normalizeRole(authenticatedUser.role),
    userId: authenticatedUser.id,
    issuedAt: Date.now(),
  } : null;

  return {
    req: opts.req,
    res: opts.res,
    user: authenticatedUser,
    tenantId: tenantId,
    tenantContext,
  };
}

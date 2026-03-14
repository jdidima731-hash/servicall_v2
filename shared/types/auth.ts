/**
 * Types étendus pour l'authentification et la gestion des utilisateurs
 */

import type { User } from "../../drizzle/schema";

/**
 * Type étendu pour un utilisateur authentifié avec son contexte tenant
 * Utilisé dans les procédures protégées où ctx.user et ctx.tenantId sont garantis non-null
 */
export type AuthenticatedUser = User & {
  tenantId: number;
};

/**
 * Type guard pour vérifier qu'un utilisateur est authentifié avec un tenant
 */
export function isAuthenticatedUser(
  user: User | null,
  tenantId: number | null
): user is AuthenticatedUser {
  return user !== null && tenantId !== null && user.id !== null;
}

/**
 * Helper pour extraire un utilisateur authentifié du contexte
 * Lance une erreur si l'utilisateur ou le tenant est manquant
 */
export function requireAuthenticatedUser(
  user: User | null,
  tenantId: number | null
): AuthenticatedUser {
  if (!user) {
    throw new Error("Utilisateur non authentifié");
  }
  if (!tenantId) {
    throw new Error("Tenant ID manquant dans la session");
  }
  if (!user.id) {
    throw new Error("User ID manquant dans la session");
  }
  
  return {
    ...user,
    tenantId,
  };
}

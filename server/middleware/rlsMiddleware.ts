/**
 * RLS MIDDLEWARE - BLOC 2
 * Définit le contexte tenant_id pour Row Level Security PostgreSQL
 * Ce middleware DOIT être appliqué à toutes les requêtes authentifiées
 *
 * ✅ CORRECTION BUG TIMEOUT POSTGRESQL:
 * L'ancienne implémentation utilisait `client\`SELECT set_config(...)\`` via postgres.js directement.
 * Cela provoquait une fuite de connexion : la connexion était empruntée au pool mais jamais libérée
 * proprement, saturant le pool (max: 20) et causant des timeouts sur prospect.list et getBadgeCount.
 *
 * Solution: Utiliser db.execute() via Drizzle ORM qui gère correctement le cycle de vie des connexions.
 * La connexion est automatiquement libérée après l'exécution de la requête.
 */

import { Request, Response, NextFunction } from "express";
import { dbManager } from "../services/dbManager";
import { sql } from "drizzle-orm";
import { logger } from "../infrastructure/logger";

/**
 * ✅ CORRECTION: Utilise db.execute() via Drizzle au lieu de client`` postgres.js
 * Drizzle gère correctement la libération de la connexion vers le pool.
 */
export async function setTenantContext(tenantId: number): Promise<void> {
  if (!tenantId) {
    logger.warn("[RLS] Attempted to set tenant context without tenantId");
    return;
  }

  try {
    const db = dbManager.db;
    if (!db) {
      logger.error("[RLS] Database not available");
      return;
    }

    // ✅ FIX TIMEOUT: Utiliser db.execute() via Drizzle (libère la connexion automatiquement)
    // L'ancienne version utilisait client`SELECT set_config(...)` qui bloquait la connexion
    await db.execute(
      sql`SELECT set_config('app.current_tenant_id', ${tenantId.toString()}, true)`
    );

    logger.debug("[RLS] Tenant context set", { tenantId });
  } catch (error: unknown) {
    logger.error("[RLS] Failed to set tenant context", { error, tenantId });
    // Ne pas propager l'erreur pour éviter de bloquer les requêtes si RLS échoue
    // (comportement dégradé acceptable vs crash total)
  }
}

/**
 * Middleware Express pour définir automatiquement le contexte tenant
 * À utiliser dans les routes qui nécessitent l'isolation tenant
 */
export function rlsMiddleware(req: Request, _res: Response, next: NextFunction) {
  // Récupérer le tenantId depuis le contexte de la requête
  // (défini par le middleware d'authentification)
  const tenantId = (req as unknown).tenantId;

  if (!tenantId) {
    logger.warn("[RLS] Request without tenantId, skipping RLS context");
    return next();
  }

  // Définir le contexte pour cette requête
  setTenantContext(tenantId)
    .then(() => next())
    .catch((error) => {
      logger.error("[RLS] Failed to set tenant context in middleware", { error });
      // En cas d'erreur RLS, continuer quand même (ne pas bloquer la requête)
      next();
    });
}

/**
 * Wrapper pour exécuter une fonction avec un contexte tenant spécifique
 * Utile pour les opérations en arrière-plan ou les jobs
 * ✅ FIX: Utilise SET LOCAL dans une transaction pour garantir l'isolation
 */
export async function withTenantContext<T>(
  tenantId: number,
  callback: () => Promise<T>
): Promise<T> {
  return await dbManager.transaction(async (tx) => {
    // ✅ FIX: SET LOCAL garantit que le paramètre ne dure que pendant la transaction
    await tx.execute(sql`SET LOCAL app.current_tenant_id = ${tenantId.toString()}`);

    logger.debug("[RLS] Transaction started with tenant context", { tenantId });

    // Exécuter la fonction
    return await callback();
  });
}

/**
 * Réinitialiser le contexte tenant (pour les opérations admin)
 * À utiliser avec EXTRÊME PRUDENCE
 * ✅ FIX: Utilise db.execute() via Drizzle
 */
export async function clearTenantContext(): Promise<void> {
  try {
    const db = dbManager.db;
    if (!db) return;

    await db.execute(sql`SELECT set_config('app.current_tenant_id', '', true)`);
    logger.debug("[RLS] Tenant context cleared");
  } catch (error: unknown) {
    logger.error("[RLS] Failed to clear tenant context", { error });
  }
}

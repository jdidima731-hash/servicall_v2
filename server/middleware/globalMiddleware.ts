/**
 * GLOBAL MIDDLEWARE
 * ✅ Isolation tenant stricte
 * ✅ Gestion d'erreurs centralisée
 * ✅ Sécurité renforcée
 */

import type { Request, Response, NextFunction } from "express";
import { logger } from "../infrastructure/logger";
import { extractTenantContext } from "../services/tenantService";

/**
 * Middleware d'isolation tenant global pour Express
 */
export async function tenantIsolationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantContext = await extractTenantContext(req);
    
    if (tenantContext) {
      (req as unknown).tenantId = tenantContext.tenantId;
      (req as unknown).tenantContext = tenantContext;
    }
    
    // Protection spécifique pour les routes /api/tenant/*
    if (req.path.startsWith("/api/tenant/") && !tenantContext) {
      res.status(403).json({
        success: false,
        error: "Accès refusé : Contexte entreprise (tenantId) manquant."
      });
      return;
    }

    next();
  } catch (error: unknown) {
    logger.error("[TenantIsolation] Critical error", { error });
    res.status(500).json({
      success: false,
      error: "Erreur interne lors de la résolution du contexte entreprise."
    });
  }
}

/**
 * Gestionnaire d'erreurs global pour Express
 */
export function globalErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const correlationId = (req as unknown).correlationId ?? "unknown";
  
  logger.error("[GlobalError] Unhandled exception", {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    path: req.path,
    method: req.method,
    correlationId
  });

  // Réponse standardisée
  const statusCode = (err.status || err.statusCode) ?? 500;
  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code ?? "INTERNAL_SERVER_ERROR",
      message: process.env['NODE_ENV'] === "production" 
        ? "Une erreur interne est survenue." 
        : err.message,
      correlationId
    }
  });
}

/**
 * Middleware pour capturer les rejets de promesses non gérés dans les routes Express
 */
export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
}

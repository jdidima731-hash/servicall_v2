/**
 * GLOBAL ERROR MIDDLEWARE
 * Centralise la gestion des erreurs et normalise les réponses API
 */

import { Request, Response, NextFunction } from "express";
import { logger } from "../infrastructure/logger";

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

export const globalErrorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = err.statusCode ?? 500;
  const errorCode = err.code ?? "INTERNAL_SERVER_ERROR";
  
  // Log de l'erreur avec contexte
  logger.error(`[API Error] ${req.method} ${req.path}`, {
    statusCode,
    errorCode,
    message: err.message,
    stack: process.env['NODE_ENV'] === "development" ? err.stack : undefined,
    requestId: req.headers["x-request-id"],
  });

  // Réponse normalisée
  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: err.message || "Une erreur interne est survenue",
      details: err.details,
      timestamp: new Date().toISOString(),
    }
  });
};

/**
 * Helper pour créer des erreurs métier
 */
export const createError = (message: string, statusCode: number = 400, code: string = "BAD_REQUEST", details?: unknown): AppError => {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
};

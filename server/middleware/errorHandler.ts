/**
 * Global Error Handler Middleware
 * Centralized error handling for Express and tRPC
 */

import { TRPCError } from "@trpc/server";
import type { Request, Response, NextFunction } from "express";
import { logger } from "../infrastructure/logger";
import { ZodError } from "zod";
import { v4 as uuidv4 } from "uuid";
import { setTag, setExtra, captureException as sentryCaptureException } from "@sentry/node";

/**
 * Error types
 */
export enum ErrorType {
  VALIDATION = "VALIDATION_ERROR",
  AUTHENTICATION = "AUTHENTICATION_ERROR",
  AUTHORIZATION = "AUTHORIZATION_ERROR",
  CSRF = "CSRF_ERROR",
  NOT_FOUND = "NOT_FOUND",
  CONFLICT = "CONFLICT",
  RATE_LIMIT = "RATE_LIMIT_EXCEEDED",
  INTERNAL = "INTERNAL_ERROR",
  EXTERNAL_API = "EXTERNAL_API_ERROR",
  DATABASE = "DATABASE_ERROR",
}

/**
 * Custom application error
 */
export class AppError extends Error {
  constructor(
    public type: ErrorType,
    message: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = "AppError";
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Convert various error types to standardized format
 */
export function normalizeError(error: unknown): {
  type: ErrorType;
  message: string;
  statusCode: number;
  details?: unknown;
  stack?: string;
} {
  let normalized = {
    type: ErrorType.INTERNAL,
    message: "Something went wrong",
    statusCode: 500,
    details: undefined as unknown,
    stack: undefined as string | undefined,
  };

  if (error instanceof TRPCError) {
    normalized = {
      type: mapTRPCCodeToErrorType(error.code),
      message: error.message,
      statusCode: getTRPCStatusCode(error.code),
      details: error.cause,
      stack: error.stack,
    };
  } else if (error instanceof Error && (error.message === "invalid csrf token" || (error as unknown).code === "EBADCSRF")) {
    // ✅ SURVEILLANCE CSRF: Détection spécifique des erreurs de token
    normalized = {
      type: ErrorType.CSRF,
      message: "La vérification de sécurité (CSRF) a échoué. Veuillez rafraîchir la page.",
      statusCode: 403,
      details: { originalError: error.message, code: (error as unknown).code },
      stack: error.stack,
    };
  } else if (error instanceof ZodError) {
    normalized = {
      type: ErrorType.VALIDATION,
      message: "Validation failed",
      statusCode: 400,
      details: error.issues,
      stack: error.stack,
    };
  } else if (error instanceof AppError) {
    normalized = {
      type: error.type,
      message: error.message,
      statusCode: error.statusCode,
      details: error.details,
      stack: error.stack,
    };
  } else if (error instanceof Error) {
    normalized = {
      type: ErrorType.INTERNAL,
      message: error.message,
      statusCode: 500,
      details: undefined,
      stack: error.stack,
    };
  }

  // ✅ ACTION 9 – Stack trace OFF en prod
  if (process.env['NODE_ENV'] === 'production') {
    delete normalized.stack;
  }

  return normalized;
}

function getTRPCStatusCode(code: string): number {
  const statusMap: Record<string, number> = {
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    TIMEOUT: 408,
    CONFLICT: 409,
    PRECONDITION_FAILED: 412,
    PAYLOAD_TOO_LARGE: 413,
    UNPROCESSABLE_CONTENT: 422,
    TOO_MANY_REQUESTS: 429,
    CLIENT_CLOSED_REQUEST: 499,
    INTERNAL_SERVER_ERROR: 500,
  };
  return statusMap[code] || 500;
}

function mapTRPCCodeToErrorType(code: string): ErrorType {
  const typeMap: Record<string, ErrorType> = {
    BAD_REQUEST: ErrorType.VALIDATION,
    UNAUTHORIZED: ErrorType.AUTHENTICATION,
    FORBIDDEN: ErrorType.AUTHORIZATION,
    NOT_FOUND: ErrorType.NOT_FOUND,
    CONFLICT: ErrorType.CONFLICT,
    TOO_MANY_REQUESTS: ErrorType.RATE_LIMIT,
  };
  return typeMap[code] || ErrorType.INTERNAL;
}

/**
 * Express error handler middleware
 */
export function expressErrorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const normalized = normalizeError(error);
  const correlationId = uuidv4();

  // Log error
  if (normalized.type === ErrorType.CSRF) {
    // ✅ ALERTE CSRF: Log spécifique pour la surveillance
    logger.warn("[SECURITY_MONITOR] CSRF_FAILURE_DETECTED", {
      correlationId,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      hasCookie: !!req.cookies?.["x-csrf-token"],
      hasHeader: !!req.headers["x-csrf-token"],
    });
  }

  logger.error("[ErrorHandler] Request error", {
    correlationId,
    type: normalized.type,
    message: normalized.message,
    statusCode: normalized.statusCode,
    path: req.path,
    method: req.method,
    details: normalized.details,
  });

  // ✅ Bloc 9: Capture Sentry pour les erreurs 5xx
  if (normalized.statusCode >= 500) {
    setTag("correlationId", correlationId);
    setTag("path", req.path);
    setTag("method", req.method);
    setExtra("details", normalized.details);
    sentryCaptureException(error);
  }

  // ✅ ACTION 8 – Format unique d’erreur
  res.setHeader("Content-Type", "application/json");
  res.status(normalized.statusCode).json({
    error: {
      type: normalized.type,
      message: normalized.message,
      correlationId: correlationId,
    },
    ...(process.env['NODE_ENV'] !== 'production' && { 
      debug: {
        details: normalized.details,
        stack: normalized.stack 
      }
    }),
  });
}

/**
 * Not found handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  const correlationId = uuidv4();
  logger.warn("[ErrorHandler] Route not found", {
    correlationId,
    path: req.path,
    method: req.method,
  });

  res.setHeader("Content-Type", "application/json");
  res.status(404).json({
    error: {
      type: ErrorType.NOT_FOUND,
      message: `Route ${req.method} ${req.originalUrl} not found`,
      correlationId: correlationId,
    },
  });
}

/**
 * Setup global error handlers
 */
export function setupGlobalErrorHandlers(): void {
  process.on("uncaughtException", (error) => {
    console.error("CRITICAL UNCAUGHT EXCEPTION:", error);
    logger.error("[ErrorHandler] Uncaught exception", { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined });
    setTimeout(() => process.exit(1), 1000);
  });
  process.on("unhandledRejection", (reason) => {
    logger.error("[ErrorHandler] Unhandled rejection", { reason });
  });
  logger.info("[ErrorHandler] Global error handlers registered");
}

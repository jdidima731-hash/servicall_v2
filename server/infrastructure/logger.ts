/**
 * INFRASTRUCTURE LOGGER — Pino structuré
 * ✅ PHASE 5 — Tâche 12 : Logs structurés avec Pino
 *
 * Ce fichier est la source unique du logger pour toute l'application.
 * Remplace tous les console.log et les imports depuis loggingService.
 *
 * Contexte automatique via AsyncLocalStorage :
 *   - requestId  : identifiant de corrélation HTTP
 *   - tenantId   : identifiant du tenant
 *   - userId     : identifiant de l'utilisateur
 */
import pino from "pino";
import { AsyncLocalStorage } from "async_hooks";
import type { Request, Response, NextFunction } from "express";

// Stockage du contexte pour la traçabilité (RequestId, TenantId, UserId)
export const logContext = new AsyncLocalStorage<Map<string, any>>();

// Type pour le contexte de log
export type LogContext = Record<string, any>;

const isProduction = process.env["NODE_ENV"] === "production";
const isTest = process.env["NODE_ENV"] === "test";

/**
 * Configuration du logger Pino
 * En production : JSON structuré (compatible ELK, Datadog, CloudWatch)
 * En développement : pino-pretty pour la lisibilité
 */
export const pinoLogger = pino({
  level: process.env["LOG_LEVEL"] ?? "info",
  base: {
    service: "servicall-saas",
    version: process.env["npm_package_version"] || "2.0.0",
    env: process.env["NODE_ENV"] ?? "development",
  },
  formatters: {
    level: (label) => ({ level: label.toUpperCase() }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: !isProduction && !isTest
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss Z",
          ignore: "pid,hostname,service,env,version",
        },
      }
    : {
        target: "pino/file",
        options: {
          destination: "./logs/service-errors.log",
          mkdir: true,
        },
      },
});

/**
 * Wrapper logger avec contexte AsyncLocalStorage automatique.
 * Compatible avec l'interface utilisée dans loggingService.ts.
 */
export const logger = {
  child: (bindings: Record<string, any>) => pinoLogger.child(bindings),

  trace: (msg: string, payload: object = {}) => {
    const meta = Object.fromEntries(logContext.getStore() ?? new Map());
    pinoLogger.trace({ ...meta, ...payload }, msg);
  },

  debug: (msg: string, payload: object = {}) => {
    const meta = Object.fromEntries(logContext.getStore() ?? new Map());
    pinoLogger.debug({ ...meta, ...payload }, msg);
  },

  info: (msg: string, payload: object = {}) => {
    const meta = Object.fromEntries(logContext.getStore() ?? new Map());
    pinoLogger.info({ ...meta, ...payload }, msg);
  },

  warn: (msg: string, payload: object = {}) => {
    const meta = Object.fromEntries(logContext.getStore() ?? new Map());
    pinoLogger.warn({ ...meta, ...payload }, msg);
  },

  error: (msg: string, error?: unknown, payload: object = {}) => {
    const meta = Object.fromEntries(logContext.getStore() ?? new Map());
    const err =
      error instanceof Error
        ? { message: error.message, stack: error.stack, name: error.name }
        : error;
    pinoLogger.error({ ...meta, ...payload, err }, msg);
  },

  fatal: (msg: string, error?: unknown, payload: object = {}) => {
    const meta = Object.fromEntries(logContext.getStore() ?? new Map());
    const err =
      error instanceof Error
        ? { message: error.message, stack: error.stack, name: error.name }
        : error;
    pinoLogger.fatal({ ...meta, ...payload, err }, msg);
  },
};

/**
 * Middleware Express pour logger les requêtes HTTP entrantes.
 * Injecte le requestId dans le contexte AsyncLocalStorage.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId =
    (req.headers["x-correlation-id"] as string) ||
    (req.headers["x-request-id"] as string) ||
    `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const store = new Map<string, any>([["requestId", requestId]]);

  logContext.run(store, () => {
    const start = Date.now();

    res.on("finish", () => {
      const duration = Date.now() - start;
      logger.info("[HTTP] Request completed", {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration_ms: duration,
        requestId,
      });
    });

    next();
  });
}

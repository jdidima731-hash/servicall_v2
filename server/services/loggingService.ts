/**
 * Logging Service - Observabilité SRE & Traçabilité Production
 * Centralisation des logs structurés avec Correlation ID et AsyncLocalStorage.
 */

import { logger as pinoLogger, logContext as pinoLogContext } from "../infrastructure/logger";
import winston from "winston";
import path from "path";

// Stockage du contexte de log pour éviter de passer requestId partout
export const logStore = pinoLogContext;

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  correlationId?: string;
  tenantId?: number | string;
  userId?: number | string;
  module?: "API" | "IA" | "TWILIO" | "SYSTEM" | "DB" | "AUTH" | "WORKFLOW";
  workflow?: string;
  route?: string;
  status?: number;
  duration_ms?: number;
  error?: unknown;
  [key: string]: unknown;
}

const logDir = process.env['LOG_DIR'] || "./logs";
const isProduction = process.env['NODE_ENV'] === "production";

/**
 * Format JSON structuré pour l'exploitation par des outils type ELK / Datadog
 */
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format((info) => {
    try {
      // Récupérer le contexte depuis AsyncLocalStorage si disponible
      const store = logStore.getStore();
      if (store) {
        info['correlationId'] = info['correlationId'] || store.get("correlationId");
        info['tenantId'] = info['tenantId'] || store.get("tenantId");
        info['userId'] = info['userId'] || store.get("userId");
      }
      
      // ✅ ACTION 15 – Logs exploitables
      info['correlationId'] = info['correlationId'] || "system";
      info['tenantId'] = info['tenantId'] || null;
      info['userId'] = info['userId'] || null;
      info.level = info.level.toUpperCase();
      info['module'] = info['module'] || "SYSTEM";
    } catch (e) {
      // Fail-safe pour éviter de crasher le logger
      info['correlationId'] = "system-error";
    }
    return info;
  })(),
  winston.format.json()
);

/**
 * Format Console lisible pour le développement
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const { correlationId, tenantId, module, status, duration_ms } = meta;
    
    // Sécurisation du typage des correlation IDs
    const safeCorrelationId = typeof correlationId === 'string' || typeof correlationId === 'number' 
      ? String(correlationId).substring(0, 8) 
      : "system";

    const ctx = [
      safeCorrelationId !== "system" ? `id=${safeCorrelationId}` : null,
      tenantId ? `tenant=${tenantId}` : null,
      module ? `mod=${module}` : null,
      status ? `status=${status}` : null,
      duration_ms ? `${duration_ms}ms` : null
    ].filter(Boolean).join(" | ");
    
    return `${timestamp} [${level}] ${ctx ? `(${ctx}) ` : ""}${message}`;
  })
);

const logLevel = process.env['LOG_LEVEL'] || (isProduction ? "info" : "debug");

export const winstonLogger = winston.createLogger({
  level: logLevel,
  format: jsonFormat,
  defaultMeta: { service: "servicall-saas" },
  transports: [
    new winston.transports.Console({
      format: isProduction ? jsonFormat : consoleFormat,
      level: logLevel
    }),
    new winston.transports.File({ 
      filename: path.join(logDir, "error.log"), 
      level: "error",
      maxsize: 50 * 1024 * 1024,
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: path.join(logDir, "audit_trail.log"),
      maxsize: 100 * 1024 * 1024,
      maxFiles: 10
    })
  ],
  // Empêcher le crash du processus en cas d'erreur de logging
  exitOnError: false
});

/**
 * Service de Logging unifié (Redirigé vers Pino)
 * ✅ Bloc 9: Logging structuré
 */
export const logger = {
  child: (bindings: { [key: string]: any }) => pinoLogger.child(bindings),
  debug: (msg: string, ctx: LogContext = {}) => {
    pinoLogger.debug(msg, ctx);
  },
  info: (msg: string, ctx: LogContext = {}) => {
    pinoLogger.info(msg, ctx);
  },
  warn: (msg: string, ctx: LogContext = {}) => {
    pinoLogger.warn(msg, ctx);
  },
  error: (msg: string, err?: Error | any, ctx: LogContext = {}) => {
    pinoLogger.error(msg, err, ctx);
  }
};

export const loggingService = logger;

/**
 * Middleware de traçabilité des requêtes (Express)
 */
export const requestLogger = (req: unknown, res: unknown, next: unknown) => {
  const start = Date.now();
  const correlationId = req.correlationId || `req_${Date.now()}`;
  
  // Créer un nouveau store pour cette requête
  const store = new Map<string, any>();
  store.set("correlationId", correlationId);
  store.set("userId", req.user?.id);
  store.set("tenantId", req.tenantId);

  logStore.run(store, () => {
    res.on("finish", () => {
      const duration = Date.now() - start;
      const logData: LogContext = {
        correlationId,
        tenantId: req.tenantId ?? null,
        userId: req.user?.id ?? null,
        route: req.originalUrl || req.url,
        status: res.statusCode,
        duration_ms: duration,
        module: "API"
      };

      if (res.statusCode >= 500) {
        logger.error(`API_ERROR: ${req.method} ${logData.route}`, null, logData);
      } else if (res.statusCode >= 400) {
        logger.warn(`API_CLIENT_ERROR: ${req.method} ${logData.route}`, logData);
      } else {
        logger.info(`API_REQUEST: ${req.method} ${logData.route}`, logData);
      }
    });

    next();
  });
};

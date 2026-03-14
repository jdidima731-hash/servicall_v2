import { init, setContext, setUser, setTag, setExtras, captureException as sentryCaptureException } from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { ENV } from "../../_core/env";
import { logger } from '../../core/logger/index';

/**
 * Initialisation de Sentry pour le Backend
 * ✅ Bloc 9: Configuration multi-tenant et capture d'erreurs
 */
export function initSentry() {
  if (!ENV.sentryDsn) {
    logger.warn("[Sentry] DSN manquant, Sentry est désactivé.");
    return;
  }

  init({
    dsn: ENV.sentryDsn,
    integrations: [
      nodeProfilingIntegration(),
    ],
    // Performance Monitoring
    tracesSampleRate: 1.0,
    // Profiling
    profilesSampleRate: 1.0,
    environment: ENV.nodeEnv ?? "development",
  });

  logger.info("[Sentry] ✅ Initialisé avec succès");
}

/**
 * Middleware pour attacher le contexte utilisateur et tenant à Sentry
 */
export function sentryContextMiddleware(req: unknown, _res: unknown, next: unknown) {
  const tenantId = req.tenantId || req.headers["x-tenant-id"];
  const userId = req.user?.id;
  const requestId = req.correlationId || req.headers["x-request-id"];

  setContext("tenant", {
    id: tenantId,
  });

  if (userId) {
    setUser({ id: String(userId) });
  }

  if (requestId) {
    setTag("requestId", String(requestId));
  }

  if (tenantId) {
    setTag("tenantId", String(tenantId));
  }

  next();
}

/**
 * Capturer une erreur manuellement avec contexte
 */
export function captureException(error: unknown, context?: unknown) {
  if (context) {
    setExtras(context);
  }
  sentryCaptureException(error);
}

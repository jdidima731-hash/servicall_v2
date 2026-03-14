import { register, Counter, Histogram, Gauge } from "prom-client";
import { logger } from "../infrastructure/logger";

/**
 * Service d'observabilité avec Prometheus
 * Collecte des métriques de performance et d'utilisation du système
 */

// Métriques HTTP
export const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "Durée des requêtes HTTP en secondes",
  labelNames: ["method", "route", "status"],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

export const httpRequestTotal = new Counter({
  name: "http_requests_total",
  help: "Nombre total de requêtes HTTP",
  labelNames: ["method", "route", "status"],
});

// Métriques tRPC
export const trpcCallDuration = new Histogram({
  name: "trpc_call_duration_seconds",
  help: "Durée des appels tRPC en secondes",
  labelNames: ["procedure", "type"],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

export const trpcCallTotal = new Counter({
  name: "trpc_calls_total",
  help: "Nombre total d'appels tRPC",
  labelNames: ["procedure", "type", "status"],
});

// Métriques de base de données
export const dbQueryDuration = new Histogram({
  name: "db_query_duration_seconds",
  help: "Durée des requêtes de base de données en secondes",
  labelNames: ["operation", "table"],
  buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1],
});

export const dbQueryTotal = new Counter({
  name: "db_queries_total",
  help: "Nombre total de requêtes de base de données",
  labelNames: ["operation", "table", "status"],
});

export const dbConnectionPoolSize = new Gauge({
  name: "db_connection_pool_size",
  help: "Taille du pool de connexions de base de données",
  labelNames: ["pool"],
});

// Métriques Twilio
export const twilioCallDuration = new Histogram({
  name: "twilio_call_duration_seconds",
  help: "Durée des appels Twilio en secondes",
  labelNames: ["direction", "status"],
  buckets: [1, 5, 10, 30, 60, 300, 600],
});

export const twilioCallTotal = new Counter({
  name: "twilio_calls_total",
  help: "Nombre total d'appels Twilio",
  labelNames: ["direction", "status"],
});

export const twilioSmsTotal = new Counter({
  name: "twilio_sms_total",
  help: "Nombre total de SMS Twilio",
  labelNames: ["direction", "status"],
});

// Métriques IA
export const aiProcessingDuration = new Histogram({
  name: "ai_processing_duration_seconds",
  help: "Durée du traitement IA en secondes",
  labelNames: ["operation"],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

export const aiProcessingTotal = new Counter({
  name: "ai_processing_total",
  help: "Nombre total de traitements IA",
  labelNames: ["operation", "status"],
});

// Métriques de Queue
export const queueJobDuration = new Histogram({
  name: "queue_job_duration_seconds",
  help: "Durée des jobs de queue en secondes",
  labelNames: ["queue_name"],
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60],
});

export const queueJobTotal = new Counter({
  name: "queue_jobs_total",
  help: "Nombre total de jobs de queue",
  labelNames: ["queue_name", "status"],
});

export const queueSize = new Gauge({
  name: "queue_size",
  help: "Taille actuelle de la queue",
  labelNames: ["queue_name"],
});

// Métriques d'erreurs
export const errorTotal = new Counter({
  name: "errors_total",
  help: "Nombre total d'erreurs",
  labelNames: ["type", "severity"],
});

// Métriques de cache
export const cacheHitTotal = new Counter({
  name: "cache_hits_total",
  help: "Nombre total de hits de cache",
  labelNames: ["cache_name"],
});

export const cacheMissTotal = new Counter({
  name: "cache_misses_total",
  help: "Nombre total de misses de cache",
  labelNames: ["cache_name"],
});

// Métriques utilisateurs actifs
export const activeUsersGauge = new Gauge({
  name: "active_users",
  help: "Nombre d'utilisateurs actifs",
});

export const activeCallsGauge = new Gauge({
  name: "active_calls",
  help: "Nombre d'appels actifs",
});

/**
 * Enregistrer une métrique de requête HTTP
 */
export function recordHttpRequest(
  method: string,
  route: string,
  status: number,
  duration: number
) {
  try {
    httpRequestDuration.labels(method, route, status.toString()).observe(duration);
    httpRequestTotal.labels(method, route, status.toString()).inc();
  } catch (error: unknown) {
    logger.error("[ObservabilityService] Failed to record HTTP request", {
      error,
    });
  }
}

/**
 * Enregistrer une métrique d'appel tRPC
 */
export function recordTrpcCall(
  procedure: string,
  type: "query" | "mutation",
  status: "success" | "error",
  duration: number
) {
  try {
    trpcCallDuration.labels(procedure, type).observe(duration);
    trpcCallTotal.labels(procedure, type, status).inc();
  } catch (error: unknown) {
    logger.error("[ObservabilityService] Failed to record tRPC call", { error });
  }
}

/**
 * Enregistrer une métrique de requête de base de données
 */
export function recordDbQuery(
  operation: string,
  table: string,
  status: "success" | "error",
  duration: number
) {
  try {
    dbQueryDuration.labels(operation, table).observe(duration);
    dbQueryTotal.labels(operation, table, status).inc();
  } catch (error: unknown) {
    logger.error("[ObservabilityService] Failed to record DB query", { error });
  }
}

/**
 * Enregistrer une métrique d'appel Twilio
 */
export function recordTwilioCall(
  direction: "inbound" | "outbound",
  status: "completed" | "failed" | "no-answer",
  duration: number
) {
  try {
    twilioCallDuration.labels(direction, status).observe(duration);
    twilioCallTotal.labels(direction, status).inc();
  } catch (error: unknown) {
    logger.error("[ObservabilityService] Failed to record Twilio call", {
      error,
    });
  }
}

/**
 * Enregistrer un SMS Twilio
 */
export function recordTwilioSms(
  direction: "inbound" | "outbound",
  status: "sent" | "failed"
) {
  try {
    twilioSmsTotal.labels(direction, status).inc();
  } catch (error: unknown) {
    logger.error("[ObservabilityService] Failed to record Twilio SMS", {
      error,
    });
  }
}

/**
 * Enregistrer un traitement IA
 */
export function recordAiProcessing(
  operation: string,
  status: "success" | "error",
  duration: number
) {
  try {
    aiProcessingDuration.labels(operation).observe(duration);
    aiProcessingTotal.labels(operation, status).inc();
  } catch (error: unknown) {
    logger.error("[ObservabilityService] Failed to record AI processing", {
      error,
    });
  }
}

/**
 * Enregistrer un job de queue
 */
export function recordQueueJob(
  queueName: string,
  status: "completed" | "failed",
  duration: number
) {
  try {
    queueJobDuration.labels(queueName).observe(duration);
    queueJobTotal.labels(queueName, status).inc();
  } catch (error: unknown) {
    logger.error("[ObservabilityService] Failed to record queue job", { error });
  }
}

/**
 * Mettre à jour la taille de la queue
 */
export function updateQueueSize(queueName: string, size: number) {
  try {
    queueSize.labels(queueName).set(size);
  } catch (error: unknown) {
    logger.error("[ObservabilityService] Failed to update queue size", { error });
  }
}

/**
 * Enregistrer une erreur
 */
export function recordError(type: string, severity: "low" | "medium" | "high") {
  try {
    errorTotal.labels(type, severity).inc();
  } catch (error: unknown) {
    logger.error("[ObservabilityService] Failed to record error", { error });
  }
}

/**
 * Enregistrer un hit de cache
 */
export function recordCacheHit(cacheName: string) {
  try {
    cacheHitTotal.labels(cacheName).inc();
  } catch (error: unknown) {
    logger.error("[ObservabilityService] Failed to record cache hit", { error });
  }
}

/**
 * Enregistrer un miss de cache
 */
export function recordCacheMiss(cacheName: string) {
  try {
    cacheMissTotal.labels(cacheName).inc();
  } catch (error: unknown) {
    logger.error("[ObservabilityService] Failed to record cache miss", { error });
  }
}

/**
 * Mettre à jour le nombre d'utilisateurs actifs
 */
export function updateActiveUsers(count: number) {
  try {
    activeUsersGauge.set(count);
  } catch (error: unknown) {
    logger.error("[ObservabilityService] Failed to update active users", {
      error,
    });
  }
}

/**
 * Mettre à jour le nombre d'appels actifs
 */
export function updateActiveCalls(count: number) {
  try {
    activeCallsGauge.set(count);
  } catch (error: unknown) {
    logger.error("[ObservabilityService] Failed to update active calls", {
      error,
    });
  }
}

/**
 * Récupérer les métriques Prometheus au format texte
 */
export async function getMetrics(): Promise<string> {
  try {
    return await register.metrics();
  } catch (error: unknown) {
    logger.error("[ObservabilityService] Failed to get metrics", { error });
    return "";
  }
}

/**
 * Middleware Express pour enregistrer les requêtes HTTP
 */
export function httpMetricsMiddleware(req: unknown, res: unknown, next: unknown) {
  const start = Date.now();

  res.on("finish", () => {
    const duration = (Date.now() - start) / 1000;
    recordHttpRequest(req.method, req.route?.path || req.path, res.statusCode, duration);
  });

  next();
}

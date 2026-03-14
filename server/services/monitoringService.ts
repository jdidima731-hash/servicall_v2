/**
 * MONITORING SERVICE CENTRALISÉ
 * ✅ Logs centralisés par tenant
 * ✅ ID de requête global (correlation ID)
 * ✅ Niveaux : info / warn / error
 * ✅ Audit des actions sensibles
 */

import { logger, LogContext } from "../infrastructure/logger";
import { getDb } from "../db";
import { auditLogs } from "../../drizzle/schema";

// ============================================
// TYPES
// ============================================

export type MonitoringLevel = "info" | "warn" | "error" | "critical";

export interface MonitoringEvent {
  level: MonitoringLevel;
  module: string;
  action: string;
  message: string;
  tenantId?: number;
  userId?: number;
  correlationId?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface AuditEvent {
  tenantId: number;
  userId: number;
  action: string;
  resourceType: string;
  resourceId?: number;
  changes?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}

// ============================================
// SERVICE DE MONITORING
// ============================================

export class MonitoringService {
  /**
   * Logger un événement de monitoring
   */
  static log(event: MonitoringEvent): void {
    const ctx: LogContext = {
      correlationId: event.correlationId,
      tenantId: event.tenantId,
      userId: event.userId,
      module: event.module as unknown,
      ...event.metadata,
    };

    const message = `[${event.module}] ${event.action}: ${event.message}`;

    switch (event.level) {
      case "info":
        logger.info(message, ctx);
        break;
      case "warn":
        logger.warn(message, ctx);
        break;
      case "error":
      case "critical":
        logger.error(message, undefined, ctx);
        break;
    }
  }

  /**
   * Logger une action sensible dans l'audit trail
   */
  static async audit(event: AuditEvent): Promise<void> {
    try {
      // Logger dans les logs
      this.log({
        level: "info",
        module: "AUDIT",
        action: event.action,
        message: `User ${event.userId} performed ${event.action} on ${event.resourceType}`,
        tenantId: event.tenantId,
        userId: event.userId,
        correlationId: event.correlationId,
        metadata: {
          resourceType: event.resourceType,
          resourceId: event.resourceId,
          changes: event.changes,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
        },
        timestamp: new Date(),
      });

      // Enregistrer dans la table d'audit
      const db = await getDb();
      if (db) {
        await db.insert(auditLogs).values({
          tenantId: event.tenantId,
          userId: event.userId,
          action: event.action,
          resourceType: event.resourceType,
          resourceId: event.resourceId,
          changes: event.changes as unknown,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          correlationId: event.correlationId,
        });
      }
    } catch (error: unknown) {
      logger.error("[MonitoringService] Failed to create audit log", error as unknown, {
        tenantId: event.tenantId,
        userId: event.userId,
        action: event.action,
      });
    }
  }

  /**
   * Logger une action API
   */
  static logApiAction(params: {
    tenantId?: number;
    userId?: number;
    action: string;
    resource: string;
    method: string;
    correlationId?: string;
    duration?: number;
    status: "success" | "error";
    error?: string;
  }): void {
    const level = params.status === "error" ? "error" : "info";
    
    this.log({
      level,
      module: "API",
      action: params.action,
      message: `${params.method} ${params.resource} - ${params.status}`,
      tenantId: params.tenantId,
      userId: params.userId,
      correlationId: params.correlationId,
      metadata: {
        method: params.method,
        resource: params.resource,
        duration_ms: params.duration,
        error: params.error,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Logger une action workflow
   */
  static logWorkflowAction(params: {
    tenantId: number;
    workflowId: number;
    workflowName: string;
    action: string;
    status: "started" | "completed" | "failed";
    correlationId?: string;
    duration?: number;
    error?: string;
  }): void {
    const level = params.status === "failed" ? "error" : "info";
    
    this.log({
      level,
      module: "WORKFLOW",
      action: params.action,
      message: `Workflow "${params.workflowName}" ${params.status}`,
      tenantId: params.tenantId,
      correlationId: params.correlationId,
      metadata: {
        workflowId: params.workflowId,
        workflowName: params.workflowName,
        status: params.status,
        duration_ms: params.duration,
        error: params.error,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Logger une action d'appel téléphonique
   */
  static logCallAction(params: {
    tenantId: number;
    callId: number;
    action: string;
    status: string;
    correlationId?: string;
    duration?: number;
    metadata?: Record<string, any>;
  }): void {
    this.log({
      level: "info",
      module: "TWILIO",
      action: params.action,
      message: `Call ${params.callId} - ${params.action} (${params.status})`,
      tenantId: params.tenantId,
      correlationId: params.correlationId,
      metadata: {
        callId: params.callId,
        status: params.status,
        duration_ms: params.duration,
        ...params.metadata,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Logger une action IA
   */
  static logAIAction(params: {
    tenantId?: number;
    action: string;
    model?: string;
    tokens?: number;
    duration?: number;
    correlationId?: string;
    error?: string;
  }): void {
    const level = params.error ? "error" : "info";
    
    this.log({
      level,
      module: "IA",
      action: params.action,
      message: `AI action: ${params.action}${params.model ? ` (${params.model})` : ""}`,
      tenantId: params.tenantId,
      correlationId: params.correlationId,
      metadata: {
        model: params.model,
        tokens: params.tokens,
        duration_ms: params.duration,
        error: params.error,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Logger une erreur système critique
   */
  static logCriticalError(params: {
    module: string;
    error: Error;
    context?: Record<string, any>;
    correlationId?: string;
  }): void {
    this.log({
      level: "critical",
      module: params.module,
      action: "CRITICAL_ERROR",
      message: params.error.message,
      correlationId: params.correlationId,
      metadata: {
        error: {
          name: params.error.name,
          message: params.error.message,
          stack: params.error.stack,
        },
        ...params.context,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Récupérer les logs par tenant
   */
  static async getLogsByTenant(
    tenantId: number,
    options: {
      limit?: number;
      offset?: number;
      level?: MonitoringLevel;
      module?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<any[]> {
    try {
      const db = await getDb();
      if (!db) return [];

      // Cette fonction nécessiterait une table de logs dédiée
      // Pour l'instant, on retourne un tableau vide
      // À implémenter avec une vraie table de logs si nécessaire
      
      logger.info("[MonitoringService] Fetching logs by tenant", {
        tenantId,
        options,
      });

      return [];
    } catch (error: unknown) {
      logger.error("[MonitoringService] Failed to fetch logs", error as unknown, {
        tenantId,
      });
      return [];
    }
  }

  /**
   * Récupérer les audits par tenant
   */
  static async getAuditsByTenant(
    tenantId: number,
    options: {
      limit?: number;
      offset?: number;
      userId?: number;
      action?: string;
      resourceType?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<any[]> {
    try {
      const db = await getDb();
      if (!db) return [];

      const { eq, and, gte, lte, desc } = await import("drizzle-orm");
      
      // let _query = db
      //   .select()
      //   .from(auditLogs)
      //   .where(eq(auditLogs.tenantId, tenantId));

      // Appliquer les filtres
      const conditions = [eq(auditLogs.tenantId, tenantId)];
      
      if (options.userId) {
        conditions.push(eq(auditLogs.userId, options.userId));
      }
      
      if (options.action) {
        conditions.push(eq(auditLogs.action, options.action));
      }
      
      if (options.resourceType) {
        conditions.push(eq(auditLogs.resourceType, options.resourceType));
      }
      
      if (options.startDate) {
        conditions.push(gte(auditLogs.createdAt, options.startDate));
      }
      
      if (options.endDate) {
        conditions.push(lte(auditLogs.createdAt, options.endDate));
      }

      const results = await db
        .select()
        .from(auditLogs)
        .where(and(...conditions))
        .orderBy(desc(auditLogs.createdAt))
        .limit(options.limit ?? 100)
        .offset(options.offset ?? 0);

      return results;
    } catch (error: unknown) {
      logger.error("[MonitoringService] Failed to fetch audits", error as unknown, {
        tenantId,
      });
      return [];
    }
  }

  /**
   * Obtenir des statistiques de monitoring
   */
  static async getStats(
    tenantId: number,
    period: "day" | "week" | "month" = "day"
  ): Promise<{
    totalActions: number;
    errorCount: number;
    avgDuration: number;
    topActions: Array<{ action: string; count: number }>;
  }> {
    try {
      // Cette fonction nécessiterait des agrégations sur les logs
      // Pour l'instant, on retourne des données simulées
      
      logger.info("[MonitoringService] Fetching stats", {
        tenantId,
        period,
      });

      return {
        totalActions: 0,
        errorCount: 0,
        avgDuration: 0,
        topActions: [],
      };
    } catch (error: unknown) {
      logger.error("[MonitoringService] Failed to fetch stats", error as unknown, {
        tenantId,
      });
      
      return {
        totalActions: 0,
        errorCount: 0,
        avgDuration: 0,
        topActions: [],
      };
    }
  }
}

// ============================================
// EXPORTS
// ============================================

export const monitoring = MonitoringService;

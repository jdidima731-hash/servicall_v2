import { db } from "../db";
import { securityAuditLogs } from "../../drizzle/schema";
import { logger } from "../infrastructure/logger";
import { Request } from "express";

export type SecurityEvent = 
  | "login_success" 
  | "login_failed" 
  | "password_change" 
  | "role_change" 
  | "api_key_creation" 
  | "webhook_creation"
  | "mfa_enabled"
  | "mfa_disabled"
  | "unauthorized_access";

export interface AuditLogOptions {
  userId?: number;
  tenantId?: number;
  event: SecurityEvent;
  resourceType?: string;
  resourceId?: string;
  action?: string;
  status?: "success" | "failure";
  metadata?: unknown;
  req?: Request;
}

export class SecurityAuditService {
  /**
   * Enregistre un événement de sécurité dans la base de données et les logs système
   */
  static async log(options: AuditLogOptions) {
    const { 
      userId, 
      tenantId, 
      event, 
      resourceType, 
      resourceId, 
      action, 
      status = "success", 
      metadata, 
      req 
    } = options;

    const ipAddress = req ? (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress) : undefined;
    const userAgent = req ? req.headers["user-agent"] : undefined;

    try {
      // 1. Log système (Winston/Pino)
      logger.info(`[SecurityAudit] ${event}`, {
        userId,
        tenantId,
        ipAddress,
        resourceType,
        resourceId
      });

      // 2. Stockage DB - mapper vers les colonnes réelles du schéma
      const description = [
        event,
        resourceType ? `resourceType=${resourceType}` : null,
        resourceId ? `resourceId=${resourceId}` : null,
        action ? `action=${action}` : null,
        status ? `status=${status}` : null,
      ].filter(Boolean).join(', ');

      await db.insert(securityAuditLogs).values({
        userId,
        tenantId,
        eventType: event,
        severity: status === "failure" ? "medium" : "low",
        description,
        ipAddress,
        userAgent,
        metadata: metadata ? { ...metadata, resourceType, resourceId, action, status } : { resourceType, resourceId, action, status },
      });
    } catch (error: unknown) {
      // On ne bloque pas l'application si l'audit log échoue, mais on le signale lourdement
      logger.error("[SecurityAudit] FAILED TO PERSIST AUDIT LOG", { 
        error, 
        event, 
        userId 
      });
    }
  }

  // Helpers pour les cas d'usage fréquents
  static async logLogin(userId: number, success: boolean, req: Request, tenantId?: number) {
    await this.log({
      userId,
      tenantId,
      event: success ? "login_success" : "login_failed",
      status: success ? "success" : "failure",
      req
    });
  }

  static async logRoleChange(adminId: number, targetUserId: number, tenantId: number, oldRole: string, newRole: string, req: Request) {
    await this.log({
      userId: adminId,
      tenantId,
      event: "role_change",
      resourceType: "user",
      resourceId: targetUserId.toString(),
      action: "update",
      metadata: { oldRole, newRole },
      req
    });
  }
}

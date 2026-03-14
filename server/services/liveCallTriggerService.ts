/**
 * LIVE CALL TRIGGER SERVICE
 * Service centralisé pour déclencher les workflows lors d'appels en temps réel
 * ✅ Multi-tenant sécurisé
 * ✅ Gestion d'erreurs robuste
 * ✅ Logging structuré
 * ✅ Timeout et retry
 */

import { logger } from "../infrastructure/logger";
import { WorkflowEngine } from "../workflow-engine/core/WorkflowEngine";
import { Channel, EventType, IncomingEvent } from "../workflow-engine/types";
import { CallExecutionService } from "./callExecutionService";
import { RealtimeWorkflowMonitor } from "./realtimeWorkflowMonitor";
import { withScope, captureException as sentryCaptureException } from "@sentry/node";


export interface LiveCallTriggerParams {
  callSid: string;
  callId?: number;
  tenantId: number;
  from: string;
  to: string;
  direction: "inbound" | "outbound";
  prospect?: unknown;
  metadata?: Record<string, any>;
}

export class LiveCallTriggerService {
  private static readonly TIMEOUT_MS = 30000; // 30 secondes
  private static readonly MAX_RETRIES = 2;

  /**
   * Déclenche le workflow live_call_started de manière centralisée
   */
  static async trigger(params: LiveCallTriggerParams): Promise<void> {
    const startTime = Date.now();
    const { callSid, callId, tenantId, from, to, direction, prospect, metadata = {} } = params;

    // Validation stricte des paramètres
    if (!callSid || !tenantId || !from || !to) {
      logger.error("[LiveCallTrigger] Missing required parameters", {
        callSid,
        tenantId,
        from,
        to,
      });
      throw new Error("Missing required parameters for live call trigger");
    }

    logger.info("[LiveCallTrigger] Starting live call workflow", {
      callSid,
      callId,
      tenantId,
      direction,
      from,
      to,
    });

    try {
      // Démarrer le tracking d'exécution si callId fourni
      if (callId) {
        await CallExecutionService.startCallExecution(callId, tenantId);
      }

      // Démarrer le monitoring temps réel
      if (callId) {
        RealtimeWorkflowMonitor.startCall({
          callId,
          callSid,
          tenantId,
          direction,
          from,
          to,
        });
      }

      // Construire l'événement pour le Workflow Engine
      const event: IncomingEvent = {
        id: callSid,
        tenant_id: tenantId,
        channel: Channel.CALL,
        type: direction === "inbound" ? EventType.CALL_IN : EventType.CALL_OUT,
        source: from,
        destination: to,
        data: {
          callSid,
          callId,
          prospect: prospect ?? null,
          direction,
        },
        metadata: {
          ...metadata,
          trigger: "live_call_started",
          direction,
          timestamp: new Date().toISOString(),
        },
        status: "in_progress",
        created_at: new Date(),
      };

      // Exécuter avec timeout
      const workflowPromise = this.executeWorkflowWithTimeout(event);
      const result = await workflowPromise;

      const duration = Date.now() - startTime;
      logger.info("[LiveCallTrigger] Workflow completed successfully", {
        callSid,
        tenantId,
        duration,
        status: result.status,
      });

      // Terminer le monitoring
      if (callId) {
        RealtimeWorkflowMonitor.endCall(callSid, "completed", duration);
      }
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error("[LiveCallTrigger] Workflow execution failed", {
        error: errorMessage,
        callSid,
        tenantId,
        duration,
      });

      // Terminer le monitoring avec erreur
      if (callId) {
        RealtimeWorkflowMonitor.endCall(callSid, "failed", duration);
      }

      // Capture Sentry pour les erreurs critiques
      withScope((scope) => {
        scope.setTag("service", "LiveCallTrigger");
        scope.setTag("callSid", callSid);
        scope.setTag("tenantId", tenantId);
        scope.setTag("direction", direction);
        scope.setContext("call_context", {
          callId,
          from,
          to,
          prospect,
        });
        sentryCaptureException(error);
      });

      // Ne pas propager l'erreur pour ne pas bloquer l'appel
      // L'appel continue même si le workflow échoue
    }
  }

  /**
   * Exécute le workflow avec un timeout
   */
  private static async executeWorkflowWithTimeout(event: IncomingEvent): Promise<any> {
    const engine = new WorkflowEngine();

    return Promise.race([
      engine.handle(event),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`Workflow timeout after ${this.TIMEOUT_MS}ms`)),
          this.TIMEOUT_MS
        )
      ),
    ]);
  }

  /**
   * Déclenche avec retry automatique
   */
  static async triggerWithRetry(params: LiveCallTriggerParams): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        await this.trigger(params);
        return; // Succès
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.MAX_RETRIES) {
          const backoffMs = 1000 * Math.pow(2, attempt - 1);
          logger.warn("[LiveCallTrigger] Retry after failure", {
            attempt,
            maxRetries: this.MAX_RETRIES,
            backoffMs,
            callSid: params.callSid,
            error: lastError.message,
          });

          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      }
    }

    // Échec après tous les retries
    logger.error("[LiveCallTrigger] Failed after all retries", {
      callSid: params.callSid,
      tenantId: params.tenantId,
      maxRetries: this.MAX_RETRIES,
      error: lastError?.message,
    });
  }

  /**
   * Déclenche de manière asynchrone (fire-and-forget)
   * Utile pour ne pas bloquer le flux principal de l'appel
   */
  static triggerAsync(params: LiveCallTriggerParams): void {
    // Exécution asynchrone sans attendre
    this.trigger(params).catch((error) => {
      logger.error("[LiveCallTrigger] Async trigger failed", {
        error: error instanceof Error ? error.message : String(error),
        callSid: params.callSid,
        tenantId: params.tenantId,
      });
    });
  }
}

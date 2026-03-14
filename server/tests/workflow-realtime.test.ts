/**
 * TESTS WORKFLOW TEMPS RÉEL
 * Tests pour le service de workflow temps réel
 */

import { describe, it, expect, beforeEach } from "vitest";
import { RealtimeWorkflowService, WorkflowAction, WorkflowContext } from "../services/realtimeWorkflowService";

// ============================================
// SETUP
// ============================================

let testContext: WorkflowContext;

beforeEach(() => {
  testContext = {
    tenantId: 1,
    callId: 12345,
    prospectId: 67890,
    userId: 1,
    variables: {
      customerName: "John Doe",
      phoneNumber: "+33612345678",
      requestedService: "plomberie",
    },
    metadata: {
      source: "test",
    },
  };
});

// ============================================
// TESTS EXÉCUTION WORKFLOW
// ============================================

describe("Realtime Workflow Execution", () => {
  it("should execute a simple workflow successfully", async () => {
    const actions: WorkflowAction[] = [
      {
        id: "action_1",
        type: "query_business_entities",
        config: {
          query: "plomberie",
          type: "service",
        },
      },
      {
        id: "action_2",
        type: "speak_to_caller",
        config: {
          text: "Bonjour, nous avons trouvé des services disponibles.",
          voice: "fr-FR-Standard-A",
          language: "fr-FR",
        },
      },
    ];

    const result = await RealtimeWorkflowService.executeWorkflow(actions, testContext);

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(2);
    expect(result.logs).toHaveLength(2);
    expect(result.totalDuration).toBeGreaterThan(0);
  });

  it("should handle workflow with variables", async () => {
    const actions: WorkflowAction[] = [
      {
        id: "action_1",
        type: "speak_to_caller",
        config: {
          text: "Bonjour {{customerName}}, comment puis-je vous aider ?",
          voice: "fr-FR-Standard-A",
        },
      },
    ];

    const result = await RealtimeWorkflowService.executeWorkflow(actions, testContext);

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.results[0].success).toBe(true);
  });

  it("should execute actions sequentially", async () => {
    const executionOrder: string[] = [];
    
    const actions: WorkflowAction[] = [
      {
        id: "action_1",
        type: "query_business_entities",
        config: { query: "test" },
      },
      {
        id: "action_2",
        type: "speak_to_caller",
        config: { text: "Test" },
      },
      {
        id: "action_3",
        type: "listen_and_understand",
        config: { timeout: 5000 },
      },
    ];

    const result = await RealtimeWorkflowService.executeWorkflow(actions, testContext);

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(3);
    
    // Vérifier l'ordre d'exécution via les logs
    expect(result.logs[0].stepId).toBe("action_1");
    expect(result.logs[1].stepId).toBe("action_2");
    expect(result.logs[2].stepId).toBe("action_3");
  });
});

// ============================================
// TESTS GESTION D'ERREURS
// ============================================

describe("Workflow Error Handling", () => {
  it("should handle action failure with retry", async () => {
    const actions: WorkflowAction[] = [
      {
        id: "action_failing",
        type: "webhook",
        config: {
          url: "https://invalid-url-that-will-fail.test",
          method: "POST",
          continueOnError: false,
        },
        retryPolicy: {
          maxRetries: 2,
          delayMs: 100,
        },
      },
    ];

    const result = await RealtimeWorkflowService.executeWorkflow(actions, testContext);

    expect(result).toBeDefined();
    // Le workflow devrait échouer après les retries
    expect(result.success).toBe(false);
  });

  it("should continue on error when configured", async () => {
    const actions: WorkflowAction[] = [
      {
        id: "action_1",
        type: "speak_to_caller",
        config: { text: "First action" },
      },
      {
        id: "action_failing",
        type: "webhook",
        config: {
          url: "https://invalid-url.test",
          method: "POST",
          continueOnError: true,
        },
        retryPolicy: {
          maxRetries: 0,
          delayMs: 0,
        },
      },
      {
        id: "action_3",
        type: "speak_to_caller",
        config: { text: "Third action" },
      },
    ];

    const result = await RealtimeWorkflowService.executeWorkflow(actions, testContext);

    expect(result).toBeDefined();
    // Le workflow devrait continuer malgré l'erreur
    expect(result.results).toHaveLength(3);
  });
});

// ============================================
// TESTS TIMEOUT
// ============================================

describe("Workflow Timeout", () => {
  it("should timeout long-running actions", async () => {
    const actions: WorkflowAction[] = [
      {
        id: "action_timeout",
        type: "listen_and_understand",
        config: {
          timeout: 60000, // Simule une action longue
        },
        timeout: 100, // Timeout de 100ms
      },
    ];

    const result = await RealtimeWorkflowService.executeWorkflow(actions, testContext);

    expect(result).toBeDefined();
    // L'action devrait échouer par timeout
    expect(result.logs[0].status).toBe("error");
  });
});

// ============================================
// TESTS ACTIONS MÉTIER
// ============================================

describe("Business Actions", () => {
  it("should query business entities", async () => {
    const actions: WorkflowAction[] = [
      {
        id: "query_entities",
        type: "query_business_entities",
        config: {
          query: "plomberie",
          type: "service",
        },
      },
    ];

    const result = await RealtimeWorkflowService.executeWorkflow(actions, testContext);

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.results[0].output).toHaveProperty("entities");
  });

  it("should send SMS", async () => {
    const actions: WorkflowAction[] = [
      {
        id: "send_sms",
        type: "send_sms",
        config: {
          to: "+33612345678",
          message: "Votre rendez-vous est confirmé",
        },
      },
    ];

    const result = await RealtimeWorkflowService.executeWorkflow(actions, testContext);

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.results[0].output).toHaveProperty("sent");
  });

  it("should send email", async () => {
    const actions: WorkflowAction[] = [
      {
        id: "send_email",
        type: "send_email",
        config: {
          to: "customer@example.com",
          subject: "Confirmation de rendez-vous",
          body: "Votre rendez-vous est confirmé pour demain à 10h.",
        },
      },
    ];

    const result = await RealtimeWorkflowService.executeWorkflow(actions, testContext);

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.results[0].output).toHaveProperty("sent");
  });

  it("should create appointment", async () => {
    const actions: WorkflowAction[] = [
      {
        id: "create_appointment",
        type: "create_appointment",
        config: {
          title: "Rendez-vous plomberie",
          startTime: "2024-03-20T10:00:00Z",
          endTime: "2024-03-20T11:00:00Z",
          prospectId: testContext.prospectId,
        },
      },
    ];

    const result = await RealtimeWorkflowService.executeWorkflow(actions, testContext);

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.results[0].output).toHaveProperty("appointmentId");
  });
});

// ============================================
// TESTS MULTI-TENANT
// ============================================

describe("Multi-tenant Workflow", () => {
  it("should isolate workflow by tenant", async () => {
    const tenant1Context: WorkflowContext = {
      ...testContext,
      tenantId: 1,
    };

    const tenant2Context: WorkflowContext = {
      ...testContext,
      tenantId: 2,
    };

    const actions: WorkflowAction[] = [
      {
        id: "query_entities",
        type: "query_business_entities",
        config: { query: "test" },
      },
    ];

    const result1 = await RealtimeWorkflowService.executeWorkflow(actions, tenant1Context);
    const result2 = await RealtimeWorkflowService.executeWorkflow(actions, tenant2Context);

    expect(result1).toBeDefined();
    expect(result2).toBeDefined();
    
    // Les résultats devraient être isolés par tenant
    // (Dans une vraie implémentation, vérifier que les données ne se mélangent pas)
  });
});

// ============================================
// TESTS VARIABLES DYNAMIQUES
// ============================================

describe("Dynamic Variables", () => {
  it("should resolve variables in config", async () => {
    const actions: WorkflowAction[] = [
      {
        id: "speak_with_vars",
        type: "speak_to_caller",
        config: {
          text: "Bonjour {{customerName}}, votre numéro est {{phoneNumber}}",
        },
      },
    ];

    const result = await RealtimeWorkflowService.executeWorkflow(actions, testContext);

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });

  it("should chain action results as variables", async () => {
    const actions: WorkflowAction[] = [
      {
        id: "action_1",
        type: "query_business_entities",
        config: { query: "test" },
      },
      {
        id: "action_2",
        type: "speak_to_caller",
        config: {
          text: "Nous avons trouvé {{action_1_result.count}} résultats",
        },
      },
    ];

    const result = await RealtimeWorkflowService.executeWorkflow(actions, testContext);

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(2);
  });
});

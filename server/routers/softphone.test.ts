import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "../routers";
import * as db from "../db";
import type { TrpcContext } from "../_core/context";

// Mock the db module
vi.mock("../db", () => ({
  getProspectById: vi.fn(),
  getCallsByProspect: vi.fn(),
  getCallById: vi.fn(),
  updateCall: vi.fn(),
  getTenantUsers: vi.fn(),
  getUserRoleInTenant: vi.fn().mockResolvedValue("manager"),
}));

function createMockContext(tenantId: number = 1, role: string = "manager"): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} },
    res: { clearCookie: vi.fn() },
    tenantId,
    tenantRole: role,
  };
}

describe("softphone router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getProspectForCall", () => {
    it("should return prospect details with call history", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const mockProspect = {
        id: 1,
        firstName: "Jean",
        lastName: "Dupont",
        email: "jean@example.com",
        company: "Acme Corp",
        status: "qualified",
      };

      const mockCalls = [
        { id: 1, duration: 300, status: "completed" },
        { id: 2, duration: 450, status: "completed" },
      ];

      (db.getProspectById).mockResolvedValue(mockProspect);
      (db.getCallsByProspect).mockResolvedValue(mockCalls);

      const result = await caller.softphone.getProspectForCall({
        tenantId: 1,
        prospectId: 1,
      });

      expect(result.prospect).toEqual(mockProspect);
      expect(result.callHistory).toHaveLength(2);
      expect(result.totalCalls).toBe(2);
    });

    it("should throw NOT_FOUND if prospect does not exist", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      (db.getProspectById).mockResolvedValue(null);

      await expect(caller.softphone.getProspectForCall({
        tenantId: 1,
        prospectId: 999,
      })).rejects.toThrow("Prospect not found");
    });
  });

  describe("saveCallNotes", () => {
    it("should save notes for a call", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      (db.updateCall).mockResolvedValue({});

      const result = await caller.softphone.saveCallNotes({
        tenantId: 1,
        callId: 1,
        notes: "Client très intéressé par le produit",
      });

      expect(result.success).toBe(true);
      expect(db.updateCall).toHaveBeenCalledWith(1, 1, expect.objectContaining({
        summary: "Client très intéressé par le produit",
      }));
    });
  });

  describe("getAvailableAgents", () => {
    it("should return list of available agents", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const mockUsers = [
        { userId: 2, userName: "Agent 1", role: "agent" },
        { userId: 3, userName: "Agent 2", role: "agent" },
        { userId: 4, userName: "Manager", role: "manager" },
      ];

      (db.getTenantUsers).mockResolvedValue(mockUsers);

      const result = await caller.softphone.getAvailableAgents({ tenantId: 1 });

      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({
        userId: 2,
        name: "Agent 1",
        role: "agent",
        status: "available",
      });
    });
  });

  describe("blindTransfer", () => {
    it("should initiate a blind transfer", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.softphone.blindTransfer({
        tenantId: 1,
        callId: 1,
        targetPhoneNumber: "+33612345678",
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain("+33612345678");
    });
  });

  describe("consultativeTransfer", () => {
    it("should initiate a consultative transfer", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.softphone.consultativeTransfer({
        tenantId: 1,
        callId: 1,
        targetAgentId: 2,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain("agent 2");
      expect(result.transferId).toBeDefined();
    });
  });

  describe("GDPR Consent", () => {
    it("should get GDPR consent status", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const mockCall = {
        id: 1,
        metadata: {
          gdprConsent: {
            given: true,
            timestamp: "2026-01-08T10:00:00Z",
          },
        },
      };

      (db.getCallById).mockResolvedValue(mockCall);

      const result = await caller.softphone.getGDPRConsent({
        tenantId: 1,
        callId: 1,
      });

      expect(result.hasConsent).toBe(true);
      expect(result.recordingEnabled).toBe(true);
    });

    it("should record GDPR consent", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const mockCall = {
        id: 1,
        metadata: {},
      };

      (db.getCallById).mockResolvedValue(mockCall);
      (db.updateCall).mockResolvedValue({});

      const result = await caller.softphone.recordGDPRConsent({
        tenantId: 1,
        callId: 1,
        consentGiven: true,
      });

      expect(result.success).toBe(true);
      expect(result.consentRecorded).toBe(true);
    });

    it("should prevent recording without GDPR consent", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const mockCall = {
        id: 1,
        metadata: {
          gdprConsent: {
            given: false,
          },
        },
      };

      (db.getCallById).mockResolvedValue(mockCall);

      await expect(caller.softphone.toggleRecording({
        tenantId: 1,
        callId: 1,
        enabled: true,
      })).rejects.toThrow("Cannot record without GDPR consent");
    });
  });
});

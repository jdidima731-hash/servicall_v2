import { describe, it, expect, vi, beforeEach } from "vitest";
import { RightToBeForgottenService } from "./RightToBeForgottenService";
import { logger } from "../infrastructure/logger";

// Mock dependencies
vi.mock("./auditService", () => ({
  AuditService: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("../db", () => ({
  db: vi.fn().mockResolvedValue({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([]),
  }),
}));

vi.mock("./loggingService", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("RightToBeForgottenService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should be defined", () => {
    expect(RightToBeForgottenService).toBeDefined();
  });

  describe("forgetProspect", () => {
    it("should log starting process", async () => {
      const prospectId = 123;
      const tenantId = 1;
      try {
        await RightToBeForgottenService.forgetProspect(prospectId, tenantId);
      } catch (e) {
        // Ignore DB errors in this unit test as we only check logs
      }
      
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(`[RGPD] Starting Right to be Forgotten for prospect ${prospectId}`));
    });
  });

  describe("cleanupAIData", () => {
    it("should log AI data cleanup", async () => {
      const callId = 456;
      // Accessing private method for testing
      await (RightToBeForgottenService as any).cleanupAIData(callId);
      
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(`[RGPD][IA] Cleaning AI data for call ${callId}`));
    });
  });

  describe("cleanupThirdPartyData", () => {
    it("should skip if no callSid provided", async () => {
      await (RightToBeForgottenService as any).cleanupThirdPartyData(null);
      // Should not log anything if null
      expect(logger.info).not.toHaveBeenCalled();
    });

    it("should log third-party cleanup if callSid provided", async () => {
      const callSid = "CA123";
      await (RightToBeForgottenService as any).cleanupThirdPartyData(callSid);
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(`[RGPD][TIERS] Cleaning third-party data for ${callSid}`));
    });
  });
});

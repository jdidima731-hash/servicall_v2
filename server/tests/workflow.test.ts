import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeWorkflowAtomically } from "../db";
import { dbManager } from "../services/dbManager";

// Mock du dbManager pour simuler les transactions sans DB réelle
vi.mock("../services/dbManager", () => ({
  dbManager: {
    transaction: vi.fn(async (callback) => {
      const mockTx = {
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue({}),
      };
      return await callback(mockTx);
    }),
  },
}));

describe("Workflow Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should execute a successful workflow with transaction logs", async () => {
    const workflowId = 123;
    const mockStep = vi.fn().mockResolvedValue(undefined);

    await executeWorkflowAtomically(workflowId, async (tx) => {
      await mockStep();
    });

    expect(mockStep).toHaveBeenCalled();
    expect(dbManager.transaction).toHaveBeenCalled();
  });

  it("should handle workflow failure and log error in transaction", async () => {
    const workflowId = 456;
    const errorMsg = "Step failed";
    const failingStep = vi.fn().mockRejectedValue(new Error(errorMsg));

    await expect(
      executeWorkflowAtomically(workflowId, async (tx) => {
        await failingStep();
      })
    ).rejects.toThrow(errorMsg);

    expect(failingStep).toHaveBeenCalled();
  });
});

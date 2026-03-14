import { describe, it, expect, vi } from "vitest";
import { HealthService } from "../services/healthService";
import { IdempotencyService } from "../workflow-engine/utils/IdempotencyService";
import { jobQueue } from "../services/jobQueueService";

// ✅ Mocks robustes avec ioredis-mock
vi.mock("../infrastructure/redis/redis.client", () => {
  const RedisMock = require("ioredis-mock");
  const client = new RedisMock();
  return {
    getRedisClient: () => client,
    connectRedis: vi.fn().mockResolvedValue(client),
  };
});

vi.mock("../services/loggingService", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

vi.mock("../db", () => ({
  getDbInstance: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([{ 1: 1 }]),
    transaction: vi.fn().mockImplementation((cb) => cb({}))
  }),
  failedJobs: {},
  processedEvents: {}
}));

describe("Resilience Validation", () => {
  describe("Health Checks", () => {
    it("should have bullmq in health checks", async () => {
      const status = await HealthService.getFullStatus();
      expect(status.checks).toHaveProperty("bullmq");
    });
  });

  describe("Idempotency", () => {
    it("should generate consistent keys", () => {
      const payload = { event: "test", id: 123 };
      const key1 = IdempotencyService.generateKey(payload);
      const key2 = IdempotencyService.generateKey(payload);
      expect(key1).toBe(key2);
    });
  });

  describe("DLQ / Job Queue", () => {
    it("should have retryJob and getFailedJobs methods", () => {
      expect(jobQueue.retryJob).toBeDefined();
      expect(jobQueue.getFailedJobs).toBeDefined();
    });
  });
});

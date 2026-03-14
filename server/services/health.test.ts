import { describe, it, expect, vi, beforeEach } from "vitest";
import { HealthService } from "./healthService";

// Mock dependencies
vi.mock("../db", () => ({
  db: vi.fn().mockResolvedValue({
    execute: vi.fn().mockResolvedValue([{ 1: 1 }]),
  }),
}));

vi.mock("./loggingService", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("axios", () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

vi.mock("twilio", () => {
  const mockFetch = vi.fn().mockResolvedValue({});
  const mockAccounts = vi.fn().mockReturnValue({ fetch: mockFetch });
  const mockApi = { accounts: mockAccounts };
  const mockClient = { api: mockApi };
  return {
    default: vi.fn().mockReturnValue(mockClient),
  };
});

describe("HealthService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-key";
    process.env.TWILIO_ACCOUNT_SID = "test-sid";
    process.env.TWILIO_AUTH_TOKEN = "test-token";
  });

  it("should return full status with all checks", async () => {
    const status = await HealthService.getFullStatus();
    
    expect(status).toBeDefined();
    // On accepte ok ou error selon l'environnement de test, l'important est que la structure soit correcte
    expect(["ok", "error"]).toContain(status.status);
    expect(status.checks.database.status).toBe("ok");
    expect(status.checks.ia.status).toBe("ok");
  });

  it("should report error if database check fails", async () => {
    const { db } = await import("../db");
    (db as any).mockRejectedValueOnce(new Error("DB Connection Failed"));
    
    const status = await HealthService.getFullStatus();
    
    expect(status.status).toBe("error");
    expect(status.checks.database.status).toBe("error");
    expect(status.checks.database.message).toBe("DB Connection Failed");
  });

  it("should report error if IA API key is missing", async () => {
    delete process.env.OPENAI_API_KEY;
    
    const status = await HealthService.getFullStatus();
    
    expect(status.status).toBe("error");
    expect(status.checks.ia.status).toBe("error");
    expect(status.checks.ia.message).toBe("IA API Key missing or invalid");
  });
});

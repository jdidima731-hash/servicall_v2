import { describe, it, expect } from "vitest";
import { ENV } from "../_core/env";
import { encryptionService } from "../services/encryptionService";
import { HealthService } from "../services/healthService";

describe("Production Readiness Validation [BLOC 4]", () => {
  
  describe("Security & Secrets", () => {
    it("should have mandatory secrets configured with minimum length", () => {
      const secrets = [
        { name: "JWT_SECRET", value: ENV.cookieSecret },
        { name: "SESSION_SECRET", value: process.env.SESSION_SECRET },
        { name: "ENCRYPTION_KEY", value: process.env.ENCRYPTION_KEY },
        { name: "MASTER_KEY", value: process.env.MASTER_KEY },
      ];

      secrets.forEach(secret => {
        expect(secret.value, `${secret.name} is missing`).toBeDefined();
        expect(secret.value?.length, `${secret.name} is too short`).toBeGreaterThanOrEqual(32);
      });
    });

    it("should not have OAuth variables configured (deprecated)", () => {
      expect(process.env.OAUTH_SERVER_URL).toBeUndefined();
      expect(process.env.OAUTH_CLIENT_ID).toBeUndefined();
    });
  });

  describe("KMS & Encryption Logic", () => {
    it("should encrypt and decrypt data correctly using the new KMS logic", async () => {
      const plaintext = "Sensitive Data 123";
      const options = { tenantId: 1, dataType: 'personal' as const };

      const encrypted = await encryptionService.encrypt(plaintext, options);
      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.authTag).toBeDefined();

      const decrypted = await encryptionService.decrypt(encrypted, options);
      expect(decrypted).toBe(plaintext);
    });

    it("should use AES-256-GCM algorithm", async () => {
      const plaintext = "Algo Test";
      const options = { tenantId: 1, dataType: 'notes' as const };
      const encrypted = await encryptionService.encrypt(plaintext, options);
      expect(encrypted.algorithm).toBe("aes-256-gcm");
    });
  });

  describe("Observabilité & Health", () => {
    it("should have a functional health check service", async () => {
      const status = await HealthService.getFullStatus();
      expect(status).toHaveProperty("status");
      expect(status).toHaveProperty("checks");
      expect(status.checks).toHaveProperty("database");
      expect(status.checks).toHaveProperty("redis");
    });
  });
});

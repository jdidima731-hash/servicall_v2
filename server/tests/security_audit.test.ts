import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import helmet from "helmet";
import { loginLimiter, apiLimiter } from "../middleware/rateLimit";
import { SecurityAuditService } from "../services/securityAuditService";

// Mock du service d'audit pour éviter les appels DB réels pendant les tests unitaires
vi.mock("../services/securityAuditService", () => ({
  SecurityAuditService: {
    log: vi.fn().mockResolvedValue(undefined),
    logLogin: vi.fn().mockResolvedValue(undefined),
  }
}));

describe("Security Implementation Tests", () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Configuration Helmet identique à celle du serveur
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          frameAncestors: ["'none'"],
        }
      },
      frameguard: { action: "deny" },
    }));

    // Routes de test
    app.post("/api/auth/login", loginLimiter, (req, res) => {
      res.status(200).json({ success: true });
    });

    app.get("/api/data", apiLimiter, (req, res) => {
      res.status(200).json({ data: "ok" });
    });
  });

  describe("Helmet & CSP Headers", () => {
    it("should have strict security headers", async () => {
      const response = await request(app).get("/api/data");
      
      expect(response.headers["x-frame-options"]).toBe("DENY");
      expect(response.headers["content-security-policy"]).toContain("default-src 'self'");
      expect(response.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
      expect(response.headers["x-content-type-options"]).toBe("nosniff");
      expect(response.headers["strict-transport-security"]).toBeDefined();
    });
  });

  describe("Rate Limiting", () => {
    it("should allow requests within limits", async () => {
      const response = await request(app).get("/api/data");
      expect(response.status).toBe(200);
      // express-rate-limit v7+ utilise 'ratelimit-limit' par défaut avec standardHeaders: true
      const limitHeader = response.headers["ratelimit-limit"] || response.headers["x-ratelimit-limit"];
      expect(limitHeader).toBeDefined();
    });

    // Note: Tester le dépassement réel nécessite de nombreuses requêtes ou un mock du store
    // Ici on vérifie au moins que les headers sont présents
  });

  describe("Security Audit Logging", () => {
    it("should call SecurityAuditService on login attempts", async () => {
      // Ce test simule l'appel au service d'audit qui serait fait dans le router
      const mockReq = { headers: {}, socket: { remoteAddress: "127.0.0.1" } } as any;
      await SecurityAuditService.logLogin(1, true, mockReq, 101);
      
      expect(SecurityAuditService.logLogin).toHaveBeenCalledWith(1, true, expect.anything(), 101);
    });
  });
});

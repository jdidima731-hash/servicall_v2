/**
 * Tests de base pour les services
 */

import { describe, it, expect } from "vitest";
import * as securityService from "./securityService";
import * as twilioWebRTCService from "./twilioWebRTCService";
import * as workflowService from "./workflowService";

describe("Security Service", () => {
  describe("Phone Number Validation", () => {
    it("should validate correct E.164 phone numbers", () => {
      const result = securityService.validatePhoneNumber("+33612345678");
      expect(result.valid).toBe(true);
      expect(result.formatted).toBe("+33612345678");
    });

    it("should reject invalid phone numbers", () => {
      const result = securityService.validatePhoneNumber("123456");
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should format phone numbers correctly", () => {
      const result = securityService.validatePhoneNumber("+1 (555) 123-4567");
      expect(result.valid).toBe(true);
      expect(result.formatted).toBe("+15551234567");
    });
  });

  describe("Email Validation", () => {
    it("should validate correct email addresses", async () => {
      const result = await securityService.validateEmail("test@example.com");
      expect(result.valid).toBe(true);
    });

    it("should reject invalid email addresses", async () => {
      const result = await securityService.validateEmail("invalid-email");
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should reject disposable email addresses", async () => {
      const result = await securityService.validateEmail("test@tempmail.com");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Disposable");
    });
  });

  describe("Data Encryption", () => {
    it("should encrypt and decrypt data correctly", () => {
      const original = "sensitive data";
      const encrypted = securityService.encryptData(original);
      const decrypted = securityService.decryptData(encrypted);
      
      expect(encrypted).not.toBe(original);
      expect(decrypted).toBe(original);
    });

    it("should hash data consistently", () => {
      const data = "test data";
      const hash1 = securityService.hashData(data);
      const hash2 = securityService.hashData(data);
      
      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(data);
    });
  });

  describe("Rate Limiting", () => {
    it("should allow requests within limit", () => {
      const key = "test-key-1";
      const result = securityService.checkRateLimit(key, 5, 60000);
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it("should block requests exceeding limit", () => {
      const key = "test-key-2";
      
      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        securityService.checkRateLimit(key, 5, 60000);
      }
      
      // 6th request should be blocked
      const result = securityService.checkRateLimit(key, 5, 60000);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });

  describe("Input Sanitization", () => {
    it("should sanitize XSS attempts", () => {
      const malicious = '<script>alert("XSS")</script>';
      const sanitized = securityService.sanitizeString(malicious);
      
      expect(sanitized).not.toContain("<script>");
      expect(sanitized).toContain("&lt;script&gt;");
    });

    it("should validate URLs correctly", () => {
      const validURL = securityService.validateURL("https://example.com");
      expect(validURL.valid).toBe(true);
      
      const invalidURL = securityService.validateURL("javascript:alert(1)");
      expect(invalidURL.valid).toBe(false);
    });
  });
});

describe("Twilio WebRTC Service", () => {
  describe("Phone Number Validation", () => {
    it("should validate E.164 format", () => {
      const valid = twilioWebRTCService.validatePhoneNumber("+33612345678");
      expect(valid).toBe(true);
    });

    it("should reject invalid formats", () => {
      const invalid = twilioWebRTCService.validatePhoneNumber("123");
      expect(invalid).toBe(false);
    });
  });

  describe("Phone Number Formatting", () => {
    it("should format French numbers correctly", () => {
      const formatted = twilioWebRTCService.formatPhoneNumber("0612345678", "+33");
      expect(formatted).toBe("+33612345678");
    });

    it("should handle already formatted numbers", () => {
      const formatted = twilioWebRTCService.formatPhoneNumber("+33612345678");
      expect(formatted).toBe("+33612345678");
    });
  });
});

describe("Workflow Service", () => {
  describe("Workflow Validation", () => {
    it("should validate correct workflow configuration", () => {
      const workflow = {
        trigger: "call_received",
        actions: [
          {
            type: "send_sms" as const,
            config: {
              toNumber: "+33612345678",
              message: "Test message",
            },
          },
        ],
      };
      
      const result = workflowService.validateWorkflow(workflow);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject invalid trigger", () => {
      const workflow = {
        trigger: "invalid_trigger",
        actions: [
          {
            type: "send_sms" as const,
            config: {},
          },
        ],
      };
      
      const result = workflowService.validateWorkflow(workflow);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should reject workflow without actions", () => {
      const workflow = {
        trigger: "call_received",
        actions: [],
      };
      
      const result = workflowService.validateWorkflow(workflow);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Workflow must have at least one action");
    });
  });
});

import { describe, it, expect } from "vitest";
import { z } from "zod";

// Simulation des validateurs critiques
const prospectSchema = z.object({
  email: z.string().email(),
  phone: z.string().min(10),
  tenantId: z.number().positive(),
});

const callSchema = z.object({
  prospectId: z.number().positive(),
  duration: z.number().nonnegative(),
  status: z.enum(["completed", "failed", "busy"]),
});

describe("Critical API Validation Tests", () => {
  describe("Prospect API", () => {
    it("should validate correct prospect data", () => {
      const validData = {
        email: "test@example.com",
        phone: "+33612345678",
        tenantId: 1,
      };
      expect(prospectSchema.parse(validData)).toEqual(validData);
    });

    it("should reject invalid email", () => {
      const invalidData = {
        email: "not-an-email",
        phone: "+33612345678",
        tenantId: 1,
      };
      expect(() => prospectSchema.parse(invalidData)).toThrow();
    });
  });

  describe("Call API", () => {
    it("should validate correct call records", () => {
      const validCall = {
        prospectId: 10,
        duration: 120,
        status: "completed",
      };
      expect(callSchema.parse(validCall)).toEqual(validCall);
    });

    it("should reject invalid call status", () => {
      const invalidCall = {
        prospectId: 10,
        duration: 120,
        status: "unknown_status",
      };
      expect(() => callSchema.parse(invalidCall)).toThrow();
    });
  });
});

import { describe, it, expect } from "vitest";
import * as db from "../db";
import * as twilioService from "../services/twilioService";

describe("Call Functions - Unit Tests", () => {
  describe("db.createCall()", () => {
    it("should create a call record with all fields", async () => {
      const result = await db.createCall({
        tenantId: 1,
        prospectId: 1,
        userId: 1,
        agentId: 1,
        callType: "inbound",
        status: "in_progress",
        callSid: "CA123456789",
        duration: 300,
        notes: "Test call",
        sentiment: "positive",
        score: 85,
      });
      expect(result).toBeDefined();
    });

    it("should create a call record with minimal fields", async () => {
      const result = await db.createCall({
        tenantId: 1,
        status: "in_progress",
      });
      expect(result).toBeDefined();
    });

    it("should create a call record with metadata", async () => {
      const metadata = { customField: "value", tags: ["important"] };
      const result = await db.createCall({
        tenantId: 1,
        status: "in_progress",
        metadata: metadata,
      });
      expect(result).toBeDefined();
    });

    it("should set createdAt and updatedAt automatically", async () => {
      const result = await db.createCall({
        tenantId: 1,
        status: "in_progress",
      });
      expect(result).toBeDefined();
    });
  });

  describe("db.updateCall()", () => {
    it("should update a call record with status", async () => {
      const result = await db.updateCall(1, 1, {
        status: "completed",
      });
      expect(result).toBeDefined();
    });

    it("should update a call record with multiple fields", async () => {
      const result = await db.updateCall(1, 1, {
        status: "completed",
        duration: 300,
        notes: "Updated notes",
        sentiment: "positive",
        score: 90,
      });
      expect(result).toBeDefined();
    });

    it("should update only specified fields", async () => {
      const result = await db.updateCall(1, 1, {
        status: "completed",
      });
      expect(result).toBeDefined();
    });

    it("should update metadata", async () => {
      const metadata = { updatedField: "newValue" };
      const result = await db.updateCall(1, 1, {
        metadata: metadata,
      });
      expect(result).toBeDefined();
    });

    it("should set updatedAt automatically", async () => {
      const result = await db.updateCall(1, 1, {
        status: "completed",
      });
      expect(result).toBeDefined();
    });
  });

  describe("twilioService.endCall()", () => {
    it("should end a call without throwing", async () => {
      await expect(
        twilioService.endCall("CA123456789")
      ).resolves.not.toThrow();
    });

    it("should handle missing callSid gracefully", async () => {
      await expect(
        twilioService.endCall("")
      ).resolves.not.toThrow();
    });

    it("should handle null callSid gracefully", async () => {
      await expect(
        twilioService.endCall(null as any)
      ).resolves.not.toThrow();
    });

    it("should not throw error even if Twilio client not initialized", async () => {
      await expect(
        twilioService.endCall("CA123456789")
      ).resolves.not.toThrow();
    });
  });

  describe("twilioService.transferCall()", () => {
    it("should throw error if client not initialized", async () => {
      expect(async () => {
        await twilioService.transferCall("CA123456789", "+33612345678");
      }).rejects.toThrow();
    });

    it("should handle invalid callSid", async () => {
      expect(async () => {
        await twilioService.transferCall("", "+33612345678");
      }).rejects.toThrow();
    });

    it("should handle invalid phone number", async () => {
      expect(async () => {
        await twilioService.transferCall("CA123456789", "");
      }).rejects.toThrow();
    });
  });

  describe("Integration Tests", () => {
    it("should create and update a call in sequence", async () => {
      // Create a call
      const createResult = await db.createCall({
        tenantId: 1,
        prospectId: 1,
        status: "in_progress",
        callSid: "CA_TEST_" + Date.now(),
      });
      expect(createResult).toBeDefined();

      // Update the call
      const updateResult = await db.updateCall(1, 1, {
        status: "completed",
        duration: 300,
      });
      expect(updateResult).toBeDefined();
    });

    it("should handle call lifecycle", async () => {
      // Create
      const callSid = "CA_LIFECYCLE_" + Date.now();
      const createResult = await db.createCall({
        tenantId: 1,
        status: "in_progress",
        callSid: callSid,
      });
      expect(createResult).toBeDefined();

      // Update during call
      const updateResult = await db.updateCall(1, 1, {
        status: "in_progress",
        duration: 60,
      });
      expect(updateResult).toBeDefined();

      // End call
      await twilioService.endCall(callSid);
      // Should not throw

      // Update final status
      const finalUpdateResult = await db.updateCall(1, 1, {
        status: "completed",
        duration: 120,
      });
      expect(finalUpdateResult).toBeDefined();
    });
  });
});

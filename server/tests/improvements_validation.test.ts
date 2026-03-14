
import { describe, it, expect, vi } from "vitest";
import { detectSimpleIntent } from "../services/intentClassifier";
import { recordOpenAIUsage, getDailyUsage } from "../services/openaiUsageMonitor";
import { AI_MODEL } from "../_core/aiModels";
import { connectRedis } from "../infrastructure/redis/redis.client";
import { beforeAll } from "vitest";

describe("Improvements Validation [Action Plan]", () => {
  beforeAll(async () => {
    process.env.DISABLE_REDIS = "true";
    await connectRedis();
  });
  
  describe("Intent Detection (Point 4)", () => {
    it("should detect human transfer intent with expanded patterns", () => {
      expect(detectSimpleIntent("Je veux parler à un conseiller")).toBe("transfer_human");
      expect(detectSimpleIntent("Passez moi un humain")).toBe("transfer_human");
      expect(detectSimpleIntent("Je veux un opérateur")).toBe("transfer_human");
    });

    it("should detect appointment booking intent", () => {
      expect(detectSimpleIntent("Je voudrais prendre rendez-vous")).toBe("book_appointment");
      expect(detectSimpleIntent("Quelles sont vos disponibilités ?")).toBe("book_appointment");
    });

    it("should detect price inquiry intent", () => {
      expect(detectSimpleIntent("Quel est le tarif ?")).toBe("ask_price");
      expect(detectSimpleIntent("Combien ça coûte ?")).toBe("ask_price");
    });
  });

  describe("OpenAI Usage Monitoring (Point 6)", () => {
    it("should record and retrieve usage correctly", async () => {
      const tenantId = 999;
      const model = AI_MODEL.DEFAULT;
      
      await recordOpenAIUsage({
        tenantId,
        model,
        inputTokens: 100,
        outputTokens: 50
      });

      // Attendre un court instant pour que le pipeline Redis s'exécute
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const usage = await getDailyUsage(tenantId);
      expect(usage.totalTokens).toBeGreaterThanOrEqual(150);
      expect(usage.calls).toBeGreaterThanOrEqual(1);
      // Le coût peut être nul si le modèle n'est pas dans MODEL_COSTS, on vérifie juste les tokens
      expect(usage.totalTokens).toBe(150);
    });
  });

  describe("AI Models Configuration (Point 2 & 3)", () => {
    it("should have Realtime model and VAD configured", () => {
      expect(AI_MODEL.REALTIME).toBeDefined();
      expect(AI_MODEL.VAD_SETTINGS).toBeDefined();
      expect(AI_MODEL.VAD_SETTINGS.threshold).toBeGreaterThan(0);
    });
  });
});

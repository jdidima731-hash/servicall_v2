
import { describe, it, expect } from "vitest";
import { ScoringService } from "./scoringService";

describe("ScoringService - Logique Déterministe [BLOC 3]", () => {
  
  const mockProspect = {
    id: 1,
    email: "test@example.com",
    phone: "0123456789",
    company: "Test Corp"
  };

  it("should calculate a perfect score for a hot prospect", () => {
    const callHistory = [
      { urgency: "high", sentiment: "positive", createdAt: new Date() },
      { urgency: "medium", sentiment: "positive", createdAt: new Date(Date.now() - 10000) }
    ];

    const result = ScoringService.calculate(mockProspect, callHistory);
    
    // Profile: 15 (email) + 10 (phone) + 10 (company) = 35
    // Interaction: 10 (2 calls * 5) + 40 (high urgency) + 20 (positive sentiment) = 70
    // Total: 35 + 70 = 105 -> Clamped to 100
    expect(result.score).toBe(100);
    expect(result.qualification).toBe("HOT");
  });

  it("should calculate a medium score for a warm prospect", () => {
    const callHistory = [
      { urgency: "medium", sentiment: "neutral", createdAt: new Date() }
    ];

    const result = ScoringService.calculate(mockProspect, callHistory);
    
    // Profile: 35
    // Interaction: 5 (1 call) + 20 (medium urgency) + 0 (neutral) = 25
    // Total: 35 + 25 = 60
    expect(result.score).toBe(60);
    expect(result.qualification).toBe("WARM");
  });

  it("should calculate a low score for a cold prospect with negative sentiment", () => {
    const poorProspect = { id: 2, email: null, phone: null, company: null };
    const callHistory = [
      { urgency: "low", sentiment: "negative", createdAt: new Date() }
    ];

    const result = ScoringService.calculate(poorProspect, callHistory);
    
    // Profile: 0
    // Interaction: 5 (1 call) + 0 (low urgency) - 10 (negative sentiment) = -5 -> Clamped to 0
    expect(result.score).toBe(0);
    expect(result.qualification).toBe("COLD");
  });

  it("should be deterministic (same input = same output)", () => {
    const callHistory = [{ urgency: "high", sentiment: "positive", createdAt: new Date() }];
    
    const result1 = ScoringService.calculate(mockProspect, callHistory);
    const result2 = ScoringService.calculate(mockProspect, callHistory);
    
    expect(result1).toEqual(result2);
  });
});

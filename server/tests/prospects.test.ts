/**
 * Tests pour les opérations sur les prospects
 * BLOC 5 - Tests automatisés backend
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";

// Schéma de validation pour un prospect
const prospectSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  email: z.string().email("Email invalide").optional(),
  phone: z.string().min(10, "Numéro de téléphone invalide").optional(),
  company: z.string().optional(),
  status: z.enum(["new", "contacted", "qualified", "converted", "lost"]).default("new"),
  tenantId: z.number().positive("Tenant ID requis"),
  assignedTo: z.number().positive().optional(),
  score: z.number().min(0).max(100).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// Schéma pour la mise à jour d'un prospect
const prospectUpdateSchema = z.object({
  id: z.number().positive(),
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(10).optional(),
  company: z.string().optional(),
  status: z.enum(["new", "contacted", "qualified", "converted", "lost"]).optional(),
  assignedTo: z.number().positive().optional(),
  score: z.number().min(0).max(100).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

describe("Prospect Validation Tests", () => {
  
  describe("Prospect Creation", () => {
    
    it("should validate a complete prospect", () => {
      const validProspect = {
        name: "John Doe",
        email: "john.doe@example.com",
        phone: "+33612345678",
        company: "Acme Corp",
        status: "new" as const,
        tenantId: 1,
        assignedTo: 5,
        score: 75,
        tags: ["vip", "urgent"],
        metadata: { source: "website", campaign: "summer2026" },
      };
      
      const result = prospectSchema.parse(validProspect);
      expect(result).toEqual(validProspect);
    });
    
    it("should validate a minimal prospect", () => {
      const minimalProspect = {
        name: "Jane Smith",
        tenantId: 1,
      };
      
      const result = prospectSchema.parse(minimalProspect);
      expect(result.name).toBe("Jane Smith");
      expect(result.tenantId).toBe(1);
      expect(result.status).toBe("new"); // Valeur par défaut
    });
    
    it("should reject prospect without name", () => {
      const invalidProspect = {
        email: "test@example.com",
        tenantId: 1,
      };
      
      expect(() => prospectSchema.parse(invalidProspect)).toThrow();
    });
    
    it("should reject prospect without tenantId", () => {
      const invalidProspect = {
        name: "John Doe",
        email: "john.doe@example.com",
      };
      
      expect(() => prospectSchema.parse(invalidProspect)).toThrow();
    });
    
    it("should reject prospect with invalid email", () => {
      const invalidProspect = {
        name: "John Doe",
        email: "not-an-email",
        tenantId: 1,
      };
      
      expect(() => prospectSchema.parse(invalidProspect)).toThrow("Email invalide");
    });
    
    it("should reject prospect with invalid phone", () => {
      const invalidProspect = {
        name: "John Doe",
        phone: "123", // Trop court
        tenantId: 1,
      };
      
      expect(() => prospectSchema.parse(invalidProspect)).toThrow("Numéro de téléphone invalide");
    });
    
    it("should reject prospect with invalid status", () => {
      const invalidProspect = {
        name: "John Doe",
        status: "invalid_status",
        tenantId: 1,
      };
      
      expect(() => prospectSchema.parse(invalidProspect)).toThrow();
    });
    
    it("should reject prospect with invalid score", () => {
      const invalidProspects = [
        { name: "John Doe", tenantId: 1, score: -10 },  // Score négatif
        { name: "John Doe", tenantId: 1, score: 150 },  // Score > 100
      ];
      
      invalidProspects.forEach(prospect => {
        expect(() => prospectSchema.parse(prospect)).toThrow();
      });
    });
    
    it("should accept prospect with valid tags", () => {
      const prospectWithTags = {
        name: "John Doe",
        tenantId: 1,
        tags: ["vip", "urgent", "follow-up"],
      };
      
      const result = prospectSchema.parse(prospectWithTags);
      expect(result.tags).toEqual(["vip", "urgent", "follow-up"]);
    });
    
    it("should accept prospect with metadata", () => {
      const prospectWithMetadata = {
        name: "John Doe",
        tenantId: 1,
        metadata: {
          source: "linkedin",
          campaign: "q1_2026",
          notes: "Interested in enterprise plan",
        },
      };
      
      const result = prospectSchema.parse(prospectWithMetadata);
      expect(result.metadata).toEqual({
        source: "linkedin",
        campaign: "q1_2026",
        notes: "Interested in enterprise plan",
      });
    });
  });
  
  describe("Prospect Update", () => {
    
    it("should validate a complete update", () => {
      const validUpdate = {
        id: 123,
        name: "John Doe Updated",
        email: "john.updated@example.com",
        phone: "+33612345679",
        company: "New Corp",
        status: "qualified" as const,
        assignedTo: 10,
        score: 85,
        tags: ["vip"],
        metadata: { updated: true },
      };
      
      const result = prospectUpdateSchema.parse(validUpdate);
      expect(result).toEqual(validUpdate);
    });
    
    it("should validate a partial update", () => {
      const partialUpdate = {
        id: 123,
        status: "contacted" as const,
        score: 60,
      };
      
      const result = prospectUpdateSchema.parse(partialUpdate);
      expect(result.id).toBe(123);
      expect(result.status).toBe("contacted");
      expect(result.score).toBe(60);
    });
    
    it("should reject update without id", () => {
      const invalidUpdate = {
        name: "John Doe",
        status: "contacted" as const,
      };
      
      expect(() => prospectUpdateSchema.parse(invalidUpdate)).toThrow();
    });
    
    it("should reject update with invalid email", () => {
      const invalidUpdate = {
        id: 123,
        email: "not-an-email",
      };
      
      expect(() => prospectUpdateSchema.parse(invalidUpdate)).toThrow();
    });
  });
  
  describe("Prospect Status Transitions", () => {
    
    const validStatuses = ["new", "contacted", "qualified", "converted", "lost"];
    
    it("should allow all valid status values", () => {
      validStatuses.forEach(status => {
        const prospect = {
          name: "John Doe",
          tenantId: 1,
          status,
        };
        
        const result = prospectSchema.parse(prospect);
        expect(result.status).toBe(status);
      });
    });
    
    it("should reject invalid status transitions", () => {
      const invalidStatuses = ["pending", "archived", "deleted"];
      
      invalidStatuses.forEach(status => {
        const prospect = {
          name: "John Doe",
          tenantId: 1,
          status,
        };
        
        expect(() => prospectSchema.parse(prospect)).toThrow();
      });
    });
  });
  
  describe("Prospect Score Validation", () => {
    
    it("should accept valid scores", () => {
      const validScores = [0, 25, 50, 75, 100];
      
      validScores.forEach(score => {
        const prospect = {
          name: "John Doe",
          tenantId: 1,
          score,
        };
        
        const result = prospectSchema.parse(prospect);
        expect(result.score).toBe(score);
      });
    });
    
    it("should reject out-of-range scores", () => {
      const invalidScores = [-1, -10, 101, 150, 1000];
      
      invalidScores.forEach(score => {
        const prospect = {
          name: "John Doe",
          tenantId: 1,
          score,
        };
        
        expect(() => prospectSchema.parse(prospect)).toThrow();
      });
    });
  });
  
  describe("Prospect Assignment", () => {
    
    it("should accept valid assignedTo", () => {
      const prospect = {
        name: "John Doe",
        tenantId: 1,
        assignedTo: 42,
      };
      
      const result = prospectSchema.parse(prospect);
      expect(result.assignedTo).toBe(42);
    });
    
    it("should reject invalid assignedTo", () => {
      const invalidProspects = [
        { name: "John Doe", tenantId: 1, assignedTo: 0 },
        { name: "John Doe", tenantId: 1, assignedTo: -5 },
      ];
      
      invalidProspects.forEach(prospect => {
        expect(() => prospectSchema.parse(prospect)).toThrow();
      });
    });
    
    it("should accept prospect without assignedTo", () => {
      const prospect = {
        name: "John Doe",
        tenantId: 1,
      };
      
      const result = prospectSchema.parse(prospect);
      expect(result.assignedTo).toBeUndefined();
    });
  });
  
  describe("Prospect Contact Information", () => {
    
    it("should accept prospect with email only", () => {
      const prospect = {
        name: "John Doe",
        email: "john@example.com",
        tenantId: 1,
      };
      
      const result = prospectSchema.parse(prospect);
      expect(result.email).toBe("john@example.com");
      expect(result.phone).toBeUndefined();
    });
    
    it("should accept prospect with phone only", () => {
      const prospect = {
        name: "John Doe",
        phone: "+33612345678",
        tenantId: 1,
      };
      
      const result = prospectSchema.parse(prospect);
      expect(result.phone).toBe("+33612345678");
      expect(result.email).toBeUndefined();
    });
    
    it("should accept prospect with both email and phone", () => {
      const prospect = {
        name: "John Doe",
        email: "john@example.com",
        phone: "+33612345678",
        tenantId: 1,
      };
      
      const result = prospectSchema.parse(prospect);
      expect(result.email).toBe("john@example.com");
      expect(result.phone).toBe("+33612345678");
    });
    
    it("should accept prospect with neither email nor phone", () => {
      const prospect = {
        name: "John Doe",
        tenantId: 1,
      };
      
      const result = prospectSchema.parse(prospect);
      expect(result.email).toBeUndefined();
      expect(result.phone).toBeUndefined();
    });
  });
});

describe("Prospect Business Logic Tests", () => {
  
  describe("Prospect Scoring", () => {
    
    it("should calculate score based on engagement", () => {
      // Logique de scoring simplifiée
      const calculateScore = (engagement: {
        emailOpened: boolean;
        linkClicked: boolean;
        callAnswered: boolean;
        meetingScheduled: boolean;
      }) => {
        let score = 0;
        if (engagement.emailOpened) score += 10;
        if (engagement.linkClicked) score += 20;
        if (engagement.callAnswered) score += 30;
        if (engagement.meetingScheduled) score += 40;
        return score;
      };
      
      expect(calculateScore({
        emailOpened: true,
        linkClicked: true,
        callAnswered: true,
        meetingScheduled: true,
      })).toBe(100);
      
      expect(calculateScore({
        emailOpened: true,
        linkClicked: false,
        callAnswered: false,
        meetingScheduled: false,
      })).toBe(10);
    });
  });
  
  describe("Prospect Status Logic", () => {
    
    it("should determine if prospect is active", () => {
      const isActive = (status: string) => {
        return ["new", "contacted", "qualified"].includes(status);
      };
      
      expect(isActive("new")).toBe(true);
      expect(isActive("contacted")).toBe(true);
      expect(isActive("qualified")).toBe(true);
      expect(isActive("converted")).toBe(false);
      expect(isActive("lost")).toBe(false);
    });
    
    it("should determine if prospect is convertible", () => {
      const isConvertible = (status: string) => {
        return status === "qualified";
      };
      
      expect(isConvertible("qualified")).toBe(true);
      expect(isConvertible("new")).toBe(false);
      expect(isConvertible("contacted")).toBe(false);
    });
  });
});

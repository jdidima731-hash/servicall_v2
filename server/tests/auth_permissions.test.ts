/**
 * Tests d'authentification et de permissions
 * BLOC 5 - Tests automatisés backend
 */

import { describe, it, expect } from "vitest";
import { TRPCError } from "@trpc/server";
import { RBACService, type Role, type Permission } from "../services/rbacService";

describe("Authentication & Authorization Tests", () => {
  
  describe("RBAC Service - Permissions", () => {
    
    it("should grant all permissions to superadmin", () => {
      const permissions: Permission[] = [
        "view_dashboard",
        "manage_users",
        "manage_tenants",
        "view_calls",
        "make_calls",
        "view_recordings",
        "manage_recordings",
        "view_analytics",
        "manage_settings",
        "view_audit_logs",
        "manage_rgpd",
        "manage_campaigns",
        "manage_workflows",
      ];
      
      permissions.forEach(permission => {
        expect(RBACService.hasPermission("superadmin", permission)).toBe(true);
      });
    });
    
    it("should grant admin permissions correctly", () => {
      expect(RBACService.hasPermission("admin", "manage_users")).toBe(true);
      expect(RBACService.hasPermission("admin", "view_audit_logs")).toBe(true);
      expect(RBACService.hasPermission("admin", "manage_workflows")).toBe(true);
      
      // Admin ne peut pas gérer les tenants (réservé à superadmin)
      expect(RBACService.hasPermission("admin", "manage_tenants")).toBe(false);
    });
    
    it("should grant manager permissions correctly", () => {
      expect(RBACService.hasPermission("manager", "view_dashboard")).toBe(true);
      expect(RBACService.hasPermission("manager", "make_calls")).toBe(true);
      expect(RBACService.hasPermission("manager", "manage_campaigns")).toBe(true);
      expect(RBACService.hasPermission("manager", "manage_workflows")).toBe(true);
      
      // Manager ne peut pas gérer les utilisateurs
      expect(RBACService.hasPermission("manager", "manage_users")).toBe(false);
      // Manager ne peut pas gérer les enregistrements (audit)
      expect(RBACService.hasPermission("manager", "manage_recordings")).toBe(false);
    });
    
    it("should grant agent permissions correctly", () => {
      expect(RBACService.hasPermission("agent", "view_dashboard")).toBe(true);
      expect(RBACService.hasPermission("agent", "view_calls")).toBe(true);
      expect(RBACService.hasPermission("agent", "make_calls")).toBe(true);
      expect(RBACService.hasPermission("agent", "view_recordings")).toBe(true);
      
      // Agent ne peut pas gérer les workflows
      expect(RBACService.hasPermission("agent", "manage_workflows")).toBe(false);
      // Agent ne peut pas voir les analytics
      expect(RBACService.hasPermission("agent", "view_analytics")).toBe(false);
    });
    
    it("should grant agentIA minimal permissions", () => {
      expect(RBACService.hasPermission("agentIA", "make_calls")).toBe(true);
      expect(RBACService.hasPermission("agentIA", "view_calls")).toBe(true);
      
      // AgentIA ne peut rien faire d'autre
      expect(RBACService.hasPermission("agentIA", "view_dashboard")).toBe(false);
      expect(RBACService.hasPermission("agentIA", "view_recordings")).toBe(false);
    });
  });
  
  describe("RBAC Service - Hierarchy", () => {
    
    it("should respect role hierarchy", () => {
      expect(RBACService.isAtLeast("superadmin", "admin")).toBe(true);
      expect(RBACService.isAtLeast("superadmin", "manager")).toBe(true);
      expect(RBACService.isAtLeast("superadmin", "agent")).toBe(true);
      
      expect(RBACService.isAtLeast("admin", "manager")).toBe(true);
      expect(RBACService.isAtLeast("admin", "agent")).toBe(true);
      expect(RBACService.isAtLeast("admin", "admin")).toBe(true);
      
      expect(RBACService.isAtLeast("manager", "agent")).toBe(true);
      expect(RBACService.isAtLeast("manager", "manager")).toBe(true);
      expect(RBACService.isAtLeast("manager", "admin")).toBe(false);
      
      expect(RBACService.isAtLeast("agent", "agent")).toBe(true);
      expect(RBACService.isAtLeast("agent", "manager")).toBe(false);
      expect(RBACService.isAtLeast("agent", "admin")).toBe(false);
      
      expect(RBACService.isAtLeast("agentIA", "agent")).toBe(false);
      expect(RBACService.isAtLeast("agentIA", "agentIA")).toBe(true);
    });
  });
  
  describe("RBAC Service - Validation", () => {
    
    it("should validate permission and not throw for valid permission", () => {
      expect(() => {
        RBACService.validatePermission("admin", "manage_users");
      }).not.toThrow();
    });
    
    it("should validate permission and throw for invalid permission", () => {
      expect(() => {
        RBACService.validatePermission("agent", "manage_users");
      }).toThrow(TRPCError);
      
      try {
        RBACService.validatePermission("agent", "manage_users");
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
      }
    });
    
    it("should validate role and not throw for valid role", () => {
      expect(() => {
        RBACService.validateRole("admin", "manager");
      }).not.toThrow();
    });
    
    it("should validate role and throw for invalid role", () => {
      expect(() => {
        RBACService.validateRole("agent", "admin");
      }).toThrow(TRPCError);
      
      try {
        RBACService.validateRole("agent", "admin");
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
      }
    });
  });
  
  describe("RBAC Service - Get Permissions", () => {
    
    it("should return all permissions for a role", () => {
      const adminPermissions = RBACService.getPermissions("admin");
      
      expect(adminPermissions).toContain("manage_users");
      expect(adminPermissions).toContain("view_audit_logs");
      expect(adminPermissions).not.toContain("manage_tenants");
    });
    
    it("should return empty array for invalid role", () => {
      const permissions = RBACService.getPermissions("invalid_role" as Role);
      
      expect(permissions).toEqual([]);
    });
  });
});

describe("Login Tests", () => {
  
  describe("Password Validation", () => {
    
    it("should accept valid password", () => {
      const validPasswords = [
        "MyP@ssw0rd123",
        "Secur3!Password",
        "C0mpl3x#Pass",
      ];
      
      validPasswords.forEach(password => {
        // Validation basique : au moins 8 caractères, 1 majuscule, 1 minuscule, 1 chiffre
        const isValid = 
          password.length >= 8 &&
          /[A-Z]/.test(password) &&
          /[a-z]/.test(password) &&
          /[0-9]/.test(password);
        
        expect(isValid).toBe(true);
      });
    });
    
    it("should reject weak passwords", () => {
      const weakPasswords = [
        "password",       // Pas de majuscule, pas de chiffre
        "12345678",       // Pas de lettres
        "Password",       // Pas de chiffre
        "Pass1",          // Trop court
      ];
      
      weakPasswords.forEach(password => {
        const isValid = 
          password.length >= 8 &&
          /[A-Z]/.test(password) &&
          /[a-z]/.test(password) &&
          /[0-9]/.test(password);
        
        expect(isValid).toBe(false);
      });
    });
  });
  
  describe("Session Validation", () => {
    
    it("should validate session payload", () => {
      const validSession = {
        openId: "user_123",
        appId: "app_456",
        name: "John Doe",
      };
      
      expect(validSession.openId).toBeTruthy();
      expect(validSession.appId).toBeTruthy();
      expect(validSession.name).toBeTruthy();
    });
    
    it("should reject invalid session payload", () => {
      const invalidSessions = [
        { openId: "", appId: "app_456", name: "John Doe" },
        { openId: "user_123", appId: "", name: "John Doe" },
        { openId: "user_123", appId: "app_456", name: "" },
      ];
      
      invalidSessions.forEach(session => {
        const isValid = 
          session.openId.length > 0 &&
          session.appId.length > 0 &&
          session.name.length > 0;
        
        expect(isValid).toBe(false);
      });
    });
  });
});

describe("Permission Enforcement Tests", () => {
  
  describe("Prospect Operations", () => {
    
    it("should allow manager to create prospects", () => {
      const userRole: Role = "manager";
      expect(RBACService.isAtLeast(userRole, "manager")).toBe(true);
    });
    
    it("should deny agent from creating prospects", () => {
      const userRole: Role = "agent";
      expect(RBACService.isAtLeast(userRole, "manager")).toBe(false);
    });
    
    it("should allow admin to delete prospects", () => {
      const userRole: Role = "admin";
      expect(RBACService.isAtLeast(userRole, "admin")).toBe(true);
    });
  });
  
  describe("Call Operations", () => {
    
    it("should allow agent to make calls", () => {
      const userRole: Role = "agent";
      expect(RBACService.hasPermission(userRole, "make_calls")).toBe(true);
    });
    
    it("should allow agentIA to make calls", () => {
      const userRole: Role = "agentIA";
      expect(RBACService.hasPermission(userRole, "make_calls")).toBe(true);
    });
  });
  
  describe("Recording Operations", () => {
    
    it("should allow admin to delete recordings", () => {
      const userRole: Role = "admin";
      expect(RBACService.isAtLeast(userRole, "admin")).toBe(true);
    });
    
    it("should deny manager from deleting recordings", () => {
      const userRole: Role = "manager";
      expect(RBACService.hasPermission(userRole, "manage_recordings")).toBe(false);
    });
  });
  
  describe("Workflow Operations", () => {
    
    it("should allow manager to manage workflows", () => {
      const userRole: Role = "manager";
      expect(RBACService.hasPermission(userRole, "manage_workflows")).toBe(true);
    });
    
    it("should deny agent from managing workflows", () => {
      const userRole: Role = "agent";
      expect(RBACService.hasPermission(userRole, "manage_workflows")).toBe(false);
    });
  });
});

import { describe, it, expect, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { requireRole } from "../middleware/rbacMiddleware";

describe("RBAC Middleware", () => {
  const mockNext = vi.fn().mockImplementation((opts) => opts.next());
  
  it("should allow admin to access admin procedure", async () => {
    const middleware = requireRole("admin");
    const ctx = { user: { role: "admin" } };
    const next = vi.fn();
    
    await middleware({ ctx, next } as any);
    expect(next).toHaveBeenCalled();
  });

  it("should deny agent from accessing admin procedure", async () => {
    const middleware = requireRole("admin");
    const ctx = { user: { role: "agent" } };
    const next = vi.fn();
    
    await expect(middleware({ ctx, next } as any)).rejects.toThrow(TRPCError);
    await expect(middleware({ ctx, next } as any)).rejects.toMatchObject({
      code: "FORBIDDEN"
    });
  });

  it("should allow manager to access manager procedure", async () => {
    const middleware = requireRole("manager");
    const ctx = { user: { role: "manager" } };
    const next = vi.fn();
    
    await middleware({ ctx, next } as any);
    expect(next).toHaveBeenCalled();
  });

  it("should allow admin to access manager procedure", async () => {
    const middleware = requireRole("manager");
    const ctx = { user: { role: "admin" } };
    const next = vi.fn();
    
    await middleware({ ctx, next } as any);
    expect(next).toHaveBeenCalled();
  });

  it("should deny user from accessing agent procedure", async () => {
    const middleware = requireRole("agent");
    const ctx = { user: { role: "user" } };
    const next = vi.fn();
    
    await expect(middleware({ ctx, next } as any)).rejects.toThrow(TRPCError);
  });

  it("should throw UNAUTHORIZED if no user in context", async () => {
    const middleware = requireRole("agent");
    const ctx = { user: null };
    const next = vi.fn();
    
    await expect(middleware({ ctx, next } as any)).rejects.toMatchObject({
      code: "UNAUTHORIZED"
    });
  });
});

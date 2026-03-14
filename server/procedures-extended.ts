/**
 * Extended RBAC Procedures for Agent and Viewer Roles
 * These extend the base procedures.ts with agent and viewer-specific procedures
 */

import { tenantProcedure } from "./procedures";

// Re-export procedures for convenience
export { adminProcedure, tenantProcedure } from "./procedures";
import { TRPCError } from "@trpc/server";

/**
 * Procedure that requires manager role in the tenant
 * Managers can manage their team and access advanced features
 */
export const managerProcedure = tenantProcedure.use(({ ctx, next }) => {
  if (ctx.tenantRole !== "manager" && ctx.tenantRole !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only managers and admins can perform this action",
    });
  }
  return next({ ctx });
});

/**
 * Procedure that requires agent role in the tenant
 * Agents can view and modify their own data, but not team data
 */
export const agentProcedure = tenantProcedure.use(({ ctx, next }) => {
  if (ctx.tenantRole !== "agent" && ctx.tenantRole !== "manager" && ctx.tenantRole !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only agents and above can perform this action",
    });
  }
  return next({ ctx });
});

/**
 * Procedure that requires viewer role in the tenant
 * Viewers can only read data, no modifications allowed
 */
export const viewerProcedure = tenantProcedure.use(({ ctx, next }) => {
  if (!["viewer", "agent", "manager", "admin"].includes(ctx.tenantRole as string)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to this resource",
    });
  }
  return next({ ctx });
});

/**
 * Procedure for read-only operations accessible to all authenticated users
 * Used for queries that should be accessible to viewers
 */
export const readOnlyProcedure = tenantProcedure.use(({ ctx, next }) => {
  // All roles can read
  return next({ ctx });
});

/**
 * Procedure that prevents write operations for viewers
 * Used to ensure viewers cannot perform mutations
 */
export const writeProtectedProcedure = tenantProcedure.use(({ ctx, next }) => {
  if (ctx.tenantRole === "viewer") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Viewers cannot perform this action",
    });
  }
  return next({ ctx });
});

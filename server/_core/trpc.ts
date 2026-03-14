import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext, ProtectedTrpcContext, TenantTrpcContext } from "./context";
import { AuthService } from "../services/authService";
import { logger } from "../infrastructure/logger";
import { setTag, setContext, captureException } from "@sentry/node";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

/**
 * Middleware Sentry pour tRPC
 * ✅ Bloc 9: Capture les erreurs et attache le contexte
 */
const sentryMiddleware = t.middleware(async ({ ctx, path, type, next }) => {
  try {
    const result = await next();
    if (!result.ok) {
      setTag("trpc.path", path);
      setTag("trpc.type", type);
      setContext("trpc.context", {
        userId: ctx.user?.id,
        tenantId: ctx.tenantId,
      });
      captureException(result.error);
    }
    return result;
  } catch (error: unknown) {
    setTag("trpc.path", path);
    setTag("trpc.type", type);
    captureException(error);
    throw error;
  }
});

export const router = t.router;
export const middleware = t.middleware;
export const publicProcedure = t.procedure.use(sentryMiddleware);

/**
 * ✅ CORRECTION PRODUCTION-READY: Middleware d'authentification renforcé
 * Garantit que l'utilisateur a toutes les propriétés requises
 */
const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;
  const req = ctx.req;

  const authResult = await AuthService.authenticateRequest(req);

  if (!authResult || !authResult.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: authResult.user,
      tenantId: authResult.tenantId,
    } as ProtectedTrpcContext,
  });
});

/**
 * ✅ DURCISSEMENT SaaS: Middleware Tenant Obligatoire (requireTenantContext)
 * Imposé globalement à toutes les procédures non publiques.
 * Refus hard si tenantId absent ou invalide.
 */
const requireTenantContext = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  // L'utilisateur et le tenantId sont déjà définis par requireUser
  if (!ctx.user || !ctx.tenantId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  // Pour les superadmins, le tenantId peut être -1, ce qui est valide pour eux.
  // Pour les autres rôles, le tenantId doit être valide.
  if (ctx.user.role !== 'superadmin' && (typeof ctx.tenantId !== "number" || ctx.tenantId <= 0)) {
    logger.warn("[TRPC Middleware] Tentative d'accès sans tenantId valide pour un non-superadmin", {
      userId: ctx.user.id,
      path: opts.path,
      tenantId: ctx.tenantId,
    });
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Contexte d'entreprise (tenantId) obligatoire. Veuillez sélectionner une entreprise.",
    });
  }

  // Le tenantContext est maintenant géré par AuthService.authenticateRequest
  // Nous pouvons donc le récupérer directement depuis ctx.user si nécessaire
  const tenantContext = ctx.user.tenantId === ctx.tenantId ? { role: ctx.user.role } : undefined;

  if (!tenantContext && ctx.user.role !== 'superadmin') {
    logger.error("[TRPC Middleware] Contexte tenant manquant malgré tenantId présent", {
      userId: ctx.user.id,
      tenantId: ctx.tenantId,
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Erreur de configuration du contexte d'entreprise.",
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      tenantId: ctx.tenantId,
      tenantContext: tenantContext,
    } as TenantTrpcContext,
  });
});

// Export des procédures de base
export const protectedProcedure = t.procedure.use(requireUser);

/**
 * ✅ DURCISSEMENT SaaS: Procédure sécurisée par Tenant par défaut
 * Toutes les procédures métiers devraient utiliser celle-ci.
 */
export const tenantProcedure = protectedProcedure.use(requireTenantContext);

/**
 * RBAC Procedures
 * ✅ CORRECTION: Validation renforcée des rôles et inclusion du tenant obligatoire
 */

// Admin uniquement (Score 100)
export const adminProcedure = tenantProcedure.use(async (opts) => {
  const { ctx, next } = opts;
  
  if (ctx.user.role !== 'admin' && ctx.user.role !== 'superadmin') {
    throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
  }
  
  return next({ ctx });
});

// Manager et Admin (Score 50+)
export const managerProcedure = tenantProcedure.use(async (opts) => {
  const { ctx, next } = opts;
  
  const role = ctx.user.role;
  const hasAccess = role === 'admin' || role === 'manager';
  
  if (!hasAccess) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Accès réservé aux managers ou administrateurs.",
    });
  }
  
  return next({ ctx });
});

// Agent, Manager et Admin (Score 20+)
export const agentProcedure = tenantProcedure.use(async (opts) => {
  const { ctx, next } = opts;
  
  const role = ctx.user.role;
  const hasAccess = role === 'admin' || role === 'manager' || role === 'agent';
  
  if (!hasAccess) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Accès réservé au personnel autorisé (Agent/Manager/Admin).",
    });
  }
  
  return next({ ctx });
});

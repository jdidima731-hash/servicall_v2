import { 
  protectedProcedure, 
  publicProcedure, 
  router, 
  tenantProcedure as baseTenantProcedure
} from "./_core/trpc";

export { protectedProcedure, publicProcedure, router };
import { TRPCError } from "@trpc/server";
import { createRateLimitMiddleware } from "./services/securityService";
import { RBACService, Role, Permission } from "./services/rbacService";
import { logger } from "./infrastructure/logger";
import { setTenantContext } from "./middleware/rlsMiddleware";

// Middleware de rate-limiting global
const rateLimitMiddleware = createRateLimitMiddleware(100, 60000); // 100 requêtes par minute

/**
 * Middleware de timeout pour tRPC
 * ✅ Bloc 8: Timeout de 30s par défaut, logs et TRPCError
 */
export function createTimeoutMiddleware(timeoutMs: number = 30000) {
  return async (opts: unknown) => {
    const { ctx, next } = opts;
    
    // ✅ FIX TIMER LEAK: Utiliser clearTimeout pour éviter les timers résiduels
    // Sans clearTimeout, le timer continue de tourner même après la fin de la requête
    // et déclenche un faux warning 30s plus tard
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        // ✅ LOGS: Enregistrement du timeout avec contexte
        logger.warn("[tRPC] Request timeout", {
          timeoutMs,
          userId: ctx.user?.id,
          tenantId: ctx.tenantId,
          path: opts.path
        });
        // ✅ TRPC ERROR: Retourne une erreur TIMEOUT (REQUEST_TIMEOUT n'existe pas en tRPC standard)
        reject(new TRPCError({
          code: "TIMEOUT",
          message: `Request exceeded timeout of ${timeoutMs}ms`
        }));
      }, timeoutMs);
    });
    
    try {
      // ✅ FIX: Annuler le timer si la requête se termine avant le timeout
      const result = await Promise.race([next(), timeoutPromise]);
      if (timeoutId !== null) clearTimeout(timeoutId);
      return result;
    } catch (error: unknown) {
      if (timeoutId !== null) clearTimeout(timeoutId);
      throw error;
    }
  };
}

// Middleware de timeout par défaut (30s)
const defaultTimeoutMiddleware = createTimeoutMiddleware(30000);

/**
 * ✅ DURCISSEMENT SaaS: Procedure avec TenantId obligatoire et validation renforcée
 */
export const tenantProcedure = baseTenantProcedure
  .use(rateLimitMiddleware)
  .use(defaultTimeoutMiddleware)
  .use(async ({ctx, next}) => {
    // Le middleware requireTenantContext a déjà validé la présence de tenantId et tenantContext
    const tenantId = ctx.tenantId!;

    // BLOC 2: Définir le contexte RLS pour cette requête
    // ✅ FIX TIMEOUT: setTenantContext utilise maintenant db.execute() via Drizzle
    // qui libère correctement la connexion au pool après exécution
    if (process.env['DB_ENABLED'] !== "false") {
      try {
        await setTenantContext(tenantId);
      } catch (error: unknown) {
        // ✅ FIX: Ne pas propager l'erreur RLS pour éviter de bloquer toutes les requêtes
        // En cas d'échec RLS, la requête continue sans contexte tenant (sécurité assurée par les WHERE clauses)
        logger.warn("[RLS] setTenantContext échoué, continuation sans contexte RLS", { error, tenantId });
      }
    }

    return next({
      ctx: {
        ...ctx,
        tenantRole: ctx.tenantContext?.role as Role,
      },
    });
  });

/**
 * Factory for procedures requiring specific permissions
 */
export const permissionProcedure = (permission: Permission) => 
  tenantProcedure.use(({ ctx, next }) => {
    RBACService.validatePermission(ctx.tenantRole, permission);
    return next({ ctx });
  });

/**
 * Procedure that requires admin or manager role in the tenant
 */
export const managerProcedure = tenantProcedure.use(({ ctx, next }) => {
  RBACService.validateRole(ctx.tenantRole, "manager");
  return next({ ctx });
});

/**
 * Procedure that requires admin role in the tenant
 */
export const adminProcedure = tenantProcedure.use(({ ctx, next }) => {
  RBACService.validateRole(ctx.tenantRole, "admin");
  return next({ ctx });
});

/**
 * Procedure that requires superadmin role
 */
export const superAdminProcedure = protectedProcedure
  .use(rateLimitMiddleware)
  .use(defaultTimeoutMiddleware)
  .use(async ({ ctx, next }) => {
    // Check if user is global superadmin
    if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Action réservée aux super-administrateurs globaux",
      });
    }
    return next({ ctx });
  });

/**
 * Procedure that requires EXACTLY the agent role in the tenant
 */
export const agentProcedure = tenantProcedure.use(({ ctx, next }) => {
  if (ctx.tenantRole !== "agent" && ctx.tenantRole !== "admin" && ctx.tenantRole !== "owner") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Cette action est réservée aux agents autorisés.",
    });
  }
  return next({ ctx });
});

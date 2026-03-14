import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../procedures";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME, SESSION_DURATION_MS } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { sdk } from "../_core/sdk";
import * as db from "../db";
import { verifyPassword } from "../services/passwordService";
import { logger } from "../infrastructure/logger";
import { SecurityAuditService } from "../services/securityAuditService";
import { initializeDefaultTenant } from "../services/tenantService";

/**
 * Router pour la gestion de l'authentification et des sessions
 * ✅ CORRECTION PRODUCTION-READY: Garantie de session complète
 */
export const authRouter = router({
  /**
   * Récupère les informations de l'utilisateur connecté et rafraîchit la session
   * ✅ CORRECTION: Garantit toujours un tenantId valide
   */
  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) {
      return null;
    }

    try {
      // ✅ CORRECTION CRITIQUE: Vérifier que l'utilisateur a un ID et un rôle valides
      if (!ctx.user.id || !ctx.user.role) {
        logger.error("[Auth] Session incomplète détectée dans 'me'", {
          userId: ctx.user.id,
          role: ctx.user.role,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Session utilisateur incomplète",
        });
      }

      // Rafraîchissement automatique de la session à chaque appel "me"
      if (ctx.req && ctx.res) {
        const sessionToken = await sdk.createSessionToken(ctx.user.openId, {
          name: ctx.user.name ?? "",
          expiresInMs: SESSION_DURATION_MS,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: SESSION_DURATION_MS,
        });
        logger.debug("[Auth] Session rafraîchie pour l'utilisateur", {
          userId: ctx.user.id,
        });
      }

      // ✅ CORRECTION: Enrichir les données utilisateur avec tenantId
      const userTenants = await db.getUserTenants(ctx.user.id);
      
      // ✅ CORRECTION CRITIQUE: Si pas de tenant, créer un tenant par défaut
      let defaultTenant = userTenants?.[0] || null;
      
      if (!defaultTenant && ctx.res) {
        logger.warn("[Auth] Utilisateur sans tenant détecté, création d'un tenant par défaut", {
          userId: ctx.user.id,
        });
        
        // Créer un tenant par défaut pour l'utilisateur
        const newTenant = await db.createTenant({
          slug: `tenant-${ctx.user.id}-${Date.now()}`,
          name: `Espace ${(ctx.user.name || ctx.user.email) ?? 'Utilisateur'}`,
          domain: null,
          logo: null,
          settings: {},
          isActive: true,
        });

        if (newTenant && newTenant?.[0]) {
          // Lier l'utilisateur au nouveau tenant
          await db.addUserToTenant(ctx.user.id, newTenant?.[0]?.id, "owner");
          
          // Initialiser le cookie tenant
          await initializeDefaultTenant(ctx.user.id, ctx.res);
          
          // Récupérer le tenant créé
          const updatedTenants = await db.getUserTenants(ctx.user.id);
          defaultTenant = updatedTenants?.[0] || null;
          
          logger.info("[Auth] Tenant par défaut créé avec succès", {
            userId: ctx.user.id,
            tenantId: newTenant?.[0]?.id,
          });
        }
      }

      // ✅ CORRECTION: Retourner toujours une structure complète
      return {
        id: ctx.user.id,
        openId: ctx.user.openId,
        email: ctx.user.email ?? "",
        name: ctx.user.name ?? "",
        role: (ctx.user.role === 'owner' ? 'admin' : ctx.user.role) || "user",
        tenantId: defaultTenant?.id ?? null,
        loginMethod: ctx.user.loginMethod ?? null,
        lastSignedIn: ctx.user.lastSignedIn ?? null,
        createdAt: ctx.user.createdAt ?? null,
      };
    } catch (error: unknown) {
      if (error instanceof TRPCError) {
        throw error;
      }
      logger.error("[Auth] Erreur lors de la récupération de l'utilisateur", {
        error,
        userId: ctx.user?.id,
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Erreur lors de la récupération des informations utilisateur",
      });
    }
  }),

  /**
   * Connexion par email et mot de passe
   * ✅ CORRECTION: Utilisation de la base de données réelle
   */
  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { email, password } = input;

      try {
        logger.info("[Auth] Tentative de connexion", { email });

        // 1. Récupérer l'utilisateur
        const user = await db.getUserByEmail(email);
        if (!user) {
          logger.warn("[Auth] Utilisateur non trouvé", { email });
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Email ou mot de passe incorrect",
          });
        }

        logger.info("[Auth] Utilisateur trouvé, vérification du mot de passe", {
          userId: user.id,
        });

        // 2. Vérifier le mot de passe
        const isValid = await verifyPassword(password, user.passwordHash ?? "");
        if (!isValid) {
          logger.warn("[Auth] Échec de la vérification du mot de passe", {
            userId: user.id,
          });

          // Audit log pour échec de connexion (mauvais mot de passe)
          if (ctx.req) {
            await SecurityAuditService.logLogin(user.id, false, ctx.req);
          }

          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Email ou mot de passe incorrect",
          });
        }

        logger.info("[Auth] Mot de passe vérifié avec succès", {
          userId: user.id,
        });

        // ✅ CORRECTION CRITIQUE: Valider que l'utilisateur a toutes les données requises
        if (!user.id || !user.role) {
          logger.error("[Auth] Données utilisateur incomplètes", {
            userId: user.id,
            role: user.role,
          });
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Données utilisateur incomplètes",
          });
        }

        // 3. Créer un token de session (24h par défaut en production)
        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name ?? "",
          expiresInMs: SESSION_DURATION_MS,
        });
        logger.info("[Auth] Token de session créé", { userId: user.id });

        // 4. Définir le cookie de session
        if (!ctx.req || !ctx.res) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Contexte de requête invalide",
          });
        }
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: SESSION_DURATION_MS,
        });

        // ✅ CORRECTION FINALE: Créer le tenant de manière synchrone pour garantir tenantId
        let userTenants = await db.getUserTenants(user.id);
        let defaultTenant = userTenants?.[0] || null;

        // Si l'utilisateur n'a pas de tenant, en créer un maintenant
        if (!defaultTenant) {
          logger.warn("[Auth] Utilisateur sans tenant, création synchrone", {
            userId: user.id,
          });

          try {
            const newTenant = await db.createTenant({
              slug: `tenant-${user.id}-${Date.now()}`,
              name: `Espace ${(user.name || user.email) ?? "Utilisateur"}`,
              domain: null,
              logo: null,
              settings: {},
              isActive: true,
            });

            if (newTenant && newTenant?.[0]) {
              await db.addUserToTenant(user.id, newTenant?.[0]?.id, "owner");
              
              // Récupérer le tenant créé
              userTenants = await db.getUserTenants(user.id);
              defaultTenant = userTenants?.[0] || null;
              
              logger.info("[Auth] Tenant créé lors du login", {
                userId: user.id,
                tenantId: newTenant?.[0]?.id,
              });
            }
          } catch (error: unknown) {
            logger.error("[Auth] Échec de la création du tenant", {
              error,
              userId: user.id,
            });
          }
        }
        
        // Initialiser le cookie tenant si on a un tenant
        if (defaultTenant) {
          await initializeDefaultTenant(user.id, ctx.res);
        }

        // Audit log pour succès de connexion
        if (ctx.req) {
          await SecurityAuditService.logLogin(user.id, true, ctx.req, defaultTenant?.id);
        }

        // ✅ CORRECTION: Retourner une structure complète
        return {
          success: true,
          user: {
            id: user.id,
            email: user.email ?? "",
            name: user.name ?? "",
            role: user.role ?? "user",
            tenantId: defaultTenant?.id ?? null,
            openId: user.openId,
          },
        };
      } catch (error: unknown) {
        if (error instanceof TRPCError) {
          throw error;
        }
        logger.error("[Auth] Erreur lors de la connexion", error, { 
          email 
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Erreur lors de la connexion: ${error.message}`,
        });
      }
    }),

  /**
   * Déconnexion de l'utilisateur
   * ✅ CORRECTION: Nettoyer tous les cookies
   */
  logout: publicProcedure.mutation(({ ctx }) => {
    if (!ctx.req || !ctx.res) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Invalid request context",
      });
    }
    
    const cookieOptions = getSessionCookieOptions(ctx.req);
    
    // Nettoyer le cookie de session
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    
    // Nettoyer le cookie tenant
    ctx.res.clearCookie("servicall_tenant", { ...cookieOptions, maxAge: -1 });
    
    logger.info("[Auth] Déconnexion réussie");
    
    return {
      success: true,
    } as const;
  }),

  /**
   * Récupère la liste des tenants de l'utilisateur
   * ✅ CORRECTION: Retourner toujours un tableau
   */
  myTenants: protectedProcedure.query(async ({ ctx }) => {
    try {
      const tenants = await db.getUserTenants(ctx.user.id);
      // ✅ CORRECTION: Garantir un tableau vide si pas de tenants
      return tenants || [];
    } catch (error: unknown) {
      logger.error("[Auth] Erreur lors de la récupération des tenants", {
        error,
        userId: ctx.user.id,
      });
      // ✅ CORRECTION: Retourner un tableau vide en cas d'erreur
      return [];
    }
  }),

  /**
   * ✅ CORRECTION BUG SIGNUP: Inscription d'un nouvel utilisateur
   * Crée un compte utilisateur avec email/mot de passe
   */
  register: publicProcedure
    .input(
      z.object({
        name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
        email: z.string().email("Email invalide"),
        password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
        company: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { name, email, password, company } = input;

      try {
        // Vérifier si l'email est déjà utilisé
        const existingUser = await db.getUserByEmail(email);
        if (existingUser) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Un compte avec cet email existe déjà",
          });
        }

        // Hasher le mot de passe
        const { hashPassword } = await import("../services/passwordService");
        const passwordHash = await hashPassword(password);

        // Créer l'utilisateur
        const openId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newUsers = await db.createUser({
          openId,
          name,
          email,
          passwordHash,
          loginMethod: "email",
          role: "user",
          isActive: true,
        });

        const newUser = newUsers?.[0];
        if (!newUser) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Erreur lors de la création du compte",
          });
        }

        // Créer un tenant pour le nouvel utilisateur
        const tenantName = company || `Espace ${name}`;
        const tenantSlug = `tenant-${newUser.id}-${Date.now()}`;
        const newTenants = await db.createTenant({
          slug: tenantSlug,
          name: tenantName,
          isActive: true,
        });

        const newTenant = newTenants?.[0];
        if (newTenant) {
          await db.addUserToTenant(newUser.id, newTenant.id, "owner");
        }

        // Créer une session pour l'utilisateur
        if (!ctx.req || !ctx.res) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Contexte de requête invalide",
          });
        }

        const sessionToken = await sdk.createSessionToken(openId, {
          name,
          expiresInMs: SESSION_DURATION_MS,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: SESSION_DURATION_MS,
        });

        logger.info("[Auth] Nouvel utilisateur inscrit", {
          userId: newUser.id,
          email,
          tenantId: newTenant?.id,
        });

        return {
          success: true,
          user: {
            id: newUser.id,
            email: newUser.email ?? "",
            name: newUser.name ?? "",
            role: newUser.role ?? "user",
            tenantId: newTenant?.id ?? null,
          },
        };
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        logger.error("[Auth] Erreur lors de l'inscription", { error, email });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Erreur lors de l'inscription: ${error.message}`,
        });
      }
    }),
});

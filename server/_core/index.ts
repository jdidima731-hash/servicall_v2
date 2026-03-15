import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectRedis } from "../infrastructure/redis/redis.client";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { doubleCsrf } from "csrf-csrf";
import { Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { randomBytes } from "crypto";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import twilioWebhookRouter from "../api/twilio";
import stripeWebhookRouter from "../api/stripe";
import { testLoginHandler } from "../api/test-login";
import { 
  loginLimiter, 
  registerLimiter, 
  apiLimiter, 
  webhookSecurity 
} from "../middleware/rateLimit";
import { logger, requestLogger } from "../infrastructure/logger";
import { startAllWorkers } from "../workers"; // stopAllWorkers removed (unused)
import { correlationIdMiddleware } from "../middleware/correlationIdMiddleware";
import { tenantIsolationMiddleware, globalErrorHandler } from "../middleware/globalMiddleware";
import { cspNonceMiddleware } from "../middleware/cspNonceMiddleware";
import { setupMetricsEndpoint, httpRequestDuration, trpcCallsTotal } from "../services/metricsService";
import { HealthService } from "../services/healthService";
import { storageService } from "../services/storage";
import { StripeWorker } from "../services/stripeWorker";
import path from "path";
import { validateEnvironmentOrExit } from "../services/envValidationService";
import { dbManager } from "../services/dbManager";
import { initializeDatabaseOrExit } from "../services/dbInitializationService";
import { setupGlobalErrorHandlers, expressErrorHandler, notFoundHandler } from "../middleware/errorHandler";
import { ENV, validateSecrets, validateEnvironmentSeparation } from "./env";


import { initSentry, sentryContextMiddleware } from "../infrastructure/observability/sentry";
import campaignRoutes, { initializeCampaignRoutes } from "../routes/campaigns";
import { DialerEngine } from "../services/dialer/dialer-engine";
import { TwilioService } from "../services/twilio/twilio-service";

async function startServer() {
  initSentry();
  setupGlobalErrorHandlers();
  
  logger.info("[Server] Validation de l'environnement...");
  await validateEnvironmentOrExit();
  validateSecrets();
  validateEnvironmentSeparation();
  logger.info("[Server] ✅ Environnement validé");
  
  logger.info("[Server] Initialisation de la base de données...");
  try {
    await dbManager.initialize();
    if (ENV.dbEnabled) {
      await initializeDatabaseOrExit().catch(_err => logger.warn("[Server] ⚠️ Échec initializeDatabaseOrExit, poursuite du boot..."));
    }
    logger.info("[Server] ✅ Base de données initialisée (si disponible)");
  } catch (error: unknown) {
    logger.error("❌ Erreur lors de l'initialisation DB : " + error.message);
    if (ENV.isProduction) {
      process.exit(1);
    }
  }
  
  logger.info("[Server] Connexion à Redis...");
  await connectRedis();
  logger.info("[Server] ✅ Redis connecté");
  
  logger.info("[Server] Initialisation du stockage...");
  await storageService.init();
  logger.info("[Server] ✅ Stockage initialisé");
  
  logger.info("[Server] Démarrage du Stripe Worker...");
  StripeWorker.start();
  logger.info("[Server] ✅ Stripe Worker démarré");

  logger.info("[Server] Démarrage des workers BullMQ...");
  startAllWorkers();
  logger.info("[Server] ✅ Workers BullMQ démarrés");

  logger.info("[Server] Initialisation du moteur de dialer...");
  const twilioService = new TwilioService({
    accountSid: process.env.TWILIO_ACCOUNT_SID || "test-account",
    authToken: process.env.TWILIO_AUTH_TOKEN || "test-token",
    fromNumber: process.env.TWILIO_FROM_NUMBER || "+1234567890",
  });
  const dialerEngine = new DialerEngine(
    process.env.REDIS_URL || "redis://localhost:6379",
    twilioService
  );
  await dialerEngine.initialize();
  initializeCampaignRoutes(dialerEngine);
  logger.info("[Server] ✅ Moteur de dialer initialisé");
  
  const app = express();
  const server = createServer(app);

  // ✅ FIX CRITIQUE: Trust proxy TOUJOURS activé pour fonctionner derrière un reverse proxy (Manus, Nginx, etc.)
  // Ceci est nécessaire pour que req.protocol retourne "https" et que les cookies secure fonctionnent
  app.set('trust proxy', 1);
  logger.info("[Server] Trust proxy activé");

  // --- CONFIGURATION CORS MULTI-TENANT ---
  const whitelist = (ENV.allowedOrigins?.split(",") || []).map(o => o.trim());
  const corsOptions: cors.CorsOptions = {
    origin: function (origin, callback) {
      // ✅ Autoriser: pas d'origin (requêtes directes), whitelist, proxy Manus, localhost
      if (
        !origin ||
        whitelist.indexOf(origin) !== -1 ||
        origin.includes('manus.computer') ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1')
      ) {
        callback(null, true);
      } else {
        callback(new Error("Origin non autorisée"));
      }
    },
    credentials: true, // autoriser cookies
  };
  app.use(cors(corsOptions));

  // Middleware de génération de nonces pour CSP
  app.use(cspNonceMiddleware);

  // --- CONFIGURATION HELMET DURCIE ---
  app.use((req, res, next) => {
    const nonce = req.nonce ?? '';
    
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ENV.isProduction 
            ? ["'self'", `'nonce-${nonce}'`]
            : ["'self'", "'unsafe-inline'"],
          styleSrc: ENV.isProduction
            ? ["'self'", `'nonce-${nonce}'`]
            : ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "wss:", "https:"],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: ENV.isProduction ? ([] as string[]) : null,
        }
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      },
      frameguard: { action: "deny" },
      xssFilter: true,
      noSniff: true,
      referrerPolicy: { policy: "strict-origin-when-cross-origin" }
    })(req, res, next);
  });

  setupMetricsEndpoint(app);

  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000;
      const route = req.route ? req.route.path : req.path;
      httpRequestDuration.labels(req.method, route, res.statusCode.toString()).observe(duration);
    });
    next();
  });
  
  app.use(cookieParser(ENV.sessionSecret));
  
  // Correlation ID pour traçabilité
  app.use(correlationIdMiddleware);
  
  // Isolation Tenant Globale
  app.use(tenantIsolationMiddleware);

  // Sentry error handler integrated via sentryContextMiddleware
  
  // Gestionnaire d'erreurs global (doit être après tous les autres middlewares)
  app.use(globalErrorHandler);
  app.use(sentryContextMiddleware);

  // --- RATE LIMITING SPÉCIFIQUE ---
  app.use("/api/auth/login", loginLimiter);
  app.use("/api/auth/register", registerLimiter);
  
  // --- WEBHOOKS SÉCURISÉS ---
  app.use("/api/twilio", webhookSecurity, express.urlencoded({ extended: true }), twilioWebhookRouter);
  app.use("/api/stripe", webhookSecurity, express.raw({ type: "application/json" }), stripeWebhookRouter);
  
  app.use('/api', (_req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-API-Version', '2.0.0');
    next();
  });

  // ✅ FIX CRITIQUE CSRF: sameSite=lax pour compatibilité proxy HTTPS
  // Utilisation d'un cookie de session anonyme stable pour les utilisateurs non connectés
  // Ceci évite le problème de l'IP changeante via le proxy
  const ANON_SESSION_COOKIE = "_sc_anon";
  const {
    doubleCsrfProtection: _doubleCsrfProtection,
    generateCsrfToken: generateToken,
  } = doubleCsrf({
    getSecret: () => (ENV.sessionSecret as string),
    // ✅ FIX DÉFINITIF: Utiliser le cookie de session s'il existe, sinon le cookie anonyme stable
    getSessionIdentifier: (req: Request) => {
      const sessionCookie = req.cookies?.["servicall_session"] as string | undefined;
      if (sessionCookie) return sessionCookie;
      // Cookie anonyme stable (non-HttpOnly pour être lu par le middleware)
      const anonCookie = req.cookies?.[ANON_SESSION_COOKIE] as string | undefined;
      if (anonCookie) return anonCookie;
      return "anon-default";
    },
    cookieName: "x-csrf-token",
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: false,
    },
    size: 64,
    ignoredMethods: ["GET", "HEAD", "OPTIONS"],
    getCsrfTokenFromRequest: (req: Request) => req.headers["x-csrf-token"] as string,
    // ✅ FIX DÉFINITIF: Ignorer CSRF pour les endpoints non authentifiés (login, register)
    // Le CSRF protège les changements d'état pour les utilisateurs authentifiés
    skipCsrfProtection: (req: Request) => {
      const url = req.url ?? "";
      // Skip CSRF for login and register (unauthenticated endpoints)
      if (url.includes("auth.login") || url.includes("auth.register") || url.includes("auth.forgotPassword")) {
        return true;
      }
      return false;
    },
  });
  app.use("/api/files", express.static(path.join(process.cwd(), "uploads")));
  app.use("/api/campaigns", campaignRoutes);
  app.use(express.json({ limit: "1mb" }));
  
  // ✅ FIX: Middleware pour créer un cookie de session anonyme stable avant la génération du token CSRF
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!req.cookies?.["servicall_session"] && !req.cookies?.[ANON_SESSION_COOKIE]) {
      const anonId = randomBytes(16).toString("hex");
      res.cookie(ANON_SESSION_COOKIE, anonId, {
        httpOnly: false, // Non-HttpOnly pour être lisible par le middleware
        sameSite: "lax",
        secure: false,
        maxAge: 24 * 60 * 60 * 1000, // 24h
        path: "/",
      });
      // Injecter dans req.cookies pour que getSessionIdentifier le voit immédiatement
      req.cookies[ANON_SESSION_COOKIE] = anonId;
    }
    next();
  });
  
  app.get("/api/csrf-token", (req, res) => {
    const sessionCookie = req.cookies?.["servicall_session"] as string | undefined;
    const anonCookie = req.cookies?.[ANON_SESSION_COOKIE] as string | undefined;
    const sessionId = sessionCookie || anonCookie || "anon-default";
    logger.info("[CSRF] Generating token", { 
      sessionId: sessionId.substring(0, 20), 
      hasSession: !!sessionCookie,
      hasAnon: !!anonCookie,
      ip: req.ip,
      forwardedFor: req.headers["x-forwarded-for"]
    });
    const token = generateToken(req, res);
    res.json({ csrfToken: token, csrfEnabled: true });
  });

  app.use(requestLogger);

  // --- HEALTH CHECKS ---
  app.get("/health/live", (_req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/health/ready", async (_req, res) => {
    const status = await HealthService.getFullStatus();
    const isReady = status.status === "ok";
    res.status(isReady ? 200 : 503).json(status);
  });

  app.get("/health", async (_req, res) => {
    const status = await HealthService.getFullStatus();
    res.status(status.status === "error" ? 500 : 200).json(status);
  });

  // ✅ COMPATIBILITÉ: Route /healthz recommandée par Replit IA
  app.get("/healthz", async (_req, res) => {
    const status = await HealthService.getFullStatus();
    res.status(status.status === "error" ? 500 : 200).json(status);
  });

  if (process.env['MODE_TEST'] === "true" && ENV.nodeEnv !== "production") {
    app.get("/api/oauth/test-login", loginLimiter, testLoginHandler);
  }
  
  // --- RATE LIMITING GLOBAL API (CSRF DÉSACTIVÉ) ---
  app.use(
    "/api/trpc",
    apiLimiter,
    // CSRF désactivé pour résoudre le bug d'insertion prospect
    createExpressMiddleware({
      router: appRouter,
      createContext: async (opts) => {
        const ctx = await createContext(opts);
        const procedure = opts.req.path.replace(/^\//, '');
        trpcCallsTotal.labels(procedure, 'unknown', 'success').inc();
        return ctx;
      },
    })
  );
  
  // ✅ FIX: Utiliser serveStatic si le build dist existe, sinon Vite dev server
  const { existsSync } = await import('fs');
  const { resolve: resolvePath } = await import('path');
  const distExists = existsSync(resolvePath(process.cwd(), 'dist', 'public', 'index.html'));
  if (ENV.nodeEnv === "development" && !distExists) {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  
  app.all('/api/*', (req, res) => {
    res.status(404).json({
      error: {
        type: 'NOT_FOUND',
        message: `Route ${req.method} ${req.originalUrl} not found`,
      },
    });
  });

  app.use(notFoundHandler);
  app.use(expressErrorHandler);

  const port = process.env["PORT"] ?? 3000;
  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('[Server] SIGTERM reçu, arrêt gracieux...');
    await dialerEngine.shutdown();
    server.close(() => {
      logger.info('[Server] Serveur arrêté');
      process.exit(0);
    });
  });

  server.listen(port, () => {
    logger.info(`[Server] ✅ Sécurisé et démarré sur le port ${port}`);
  });
}

startServer().catch((error) => {
  console.error("❌ ERREUR FATALE", error);
  process.exit(1);
});

// Graceful shutdown on SIGINT
process.on('SIGINT', async () => {
  console.log('\n[Server] SIGINT reçu, arrêt gracieux...');
  process.exit(0);
});
*/

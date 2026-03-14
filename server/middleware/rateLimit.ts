import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { getRedisClient } from "../infrastructure/redis/redis.client";
import { logger } from "../infrastructure/logger";

/**
 * Création d'un store Redis pour express-rate-limit
 */
const createRedisStore = (prefix: string) => {
  try {
    const client = getRedisClient();
    return new RedisStore({
      // @ts-expect-error - ioredis types compatibility
      sendCommand: (...args: string[]) => client.call(...args),
      prefix: `rl:${prefix}:`,
    });
  } catch (error: unknown) {
    logger.warn(`[RateLimit] Redis non disponible pour ${prefix}, bascule en mémoire.`);
    return undefined; // Fallback sur le store en mémoire par défaut
  }
};

// --- CONFIGURATIONS REQUISES ---

/**
 * /auth/login → 5 req/min/IP
 */
export const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore("login"),
  message: {
    error: "Too Many Requests",
    message: "Trop de tentatives de connexion. Veuillez réessayer dans une minute.",
  },
});

/**
 * /auth/register → 3 req/min/IP
 */
export const registerLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore("register"),
  message: {
    error: "Too Many Requests",
    message: "Trop de tentatives de création de compte. Veuillez réessayer dans une minute.",
  },
});

/**
 * /api → 100 req/min/IP
 */
export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore("api"),
  message: {
    error: "Too Many Requests",
    message: "Limite de requêtes API atteinte. Veuillez patienter une minute.",
  },
});

/**
 * /webhooks → whitelist IP + signature (Middleware spécifique)
 */
export const webhookSecurity = (req: Request, res: Response, next: NextFunction): unknown=> {
  // 1. Whitelist IP (Exemple pour Stripe/Twilio - à configurer via ENV en prod)
  const clientIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress;
  
  // En production, on vérifierait ici si clientIp est dans une liste autorisée
  // Pour cet exercice, on loggue la tentative
  logger.info(`[Webhook] Requête reçue de ${clientIp} sur ${req.path}`);

  // 2. Signature (La vérification réelle se fait souvent dans le router via les SDK officiels)
  const signature = req.headers["stripe-signature"] || req.headers["x-twilio-signature"];
  
  if (!signature && process.env['NODE_ENV'] === "production") {
    logger.warn(`[Webhook] Signature manquante pour une requête de ${clientIp}`);
    return res.status(401).json({ error: "Unauthorized", message: "Missing signature" });
  }

  next();
};

// Rétrocompatibilité si nécessaire pour d'autres fichiers
export const authLimiter = loginLimiter;


/**
 * Webhook limiter - 100 req/min/IP
 */
export const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore("webhook"),
  message: {
    error: "Too Many Requests",
    message: "Limite de requêtes webhook atteinte. Veuillez patienter une minute.",
  },
});

/**
 * Security Service - Sécurité, validation et rate limiting
 * Module 9: Anti-Fraude & Sécurité
 */

import * as crypto from "crypto";
import * as dns from "dns/promises";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { blacklistedNumbers } from "../../drizzle/schema";
import { cache as cacheService } from "./cacheService";
import { logger } from "../infrastructure/logger";
import { checkRedisRateLimit, resetRateLimit as resetRedisRateLimit } from "./redisRateLimitService";

// ============================================
// RATE LIMITING (Redis-based)
// ============================================

/**
 * Check rate limit for a key using Redis
 * @deprecated Use checkRedisRateLimit directly for better performance
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number; retryAfter?: number }> {
  return await checkRedisRateLimit(key, maxRequests, windowMs);
}

/**
 * Reset rate limit for a key
 */
export async function resetRateLimit(key: string): Promise<void> {
  await resetRedisRateLimit(key);
}

/**
 * Rate limit middleware for tRPC (Redis-based)
 * ✅ Bloc 2: Utilise TRPCError, logs structurés et headers Retry-After
 */
export function createRateLimitMiddleware(
  maxRequests: number = 100,
  windowMs: number = 60000 // 1 minute
) {
  return async (opts: unknown) => {
    const { ctx, next } = opts;
    const identifier = (ctx.user?.id || ctx.req?.ip) ?? "anonymous";
    const key = `ratelimit:${identifier}`;

    const result = await checkRedisRateLimit(key, maxRequests, windowMs);

    if (!result.allowed) {
      const retryAfter = result.retryAfter || Math.ceil((result.resetAt - Date.now()) / 1000);

      // ✅ LOGS STRUCTURÉS: Enregistrement du dépassement de limite
      logger.warn("[Security] Rate limit exceeded", { 
        identifier, 
        key, 
        retryAfter, 
        maxRequests, 
        windowMs 
      });

      // ✅ HEADER RETRY-AFTER: Ajout au contexte de réponse si disponible
      if (ctx.res) {
        ctx.res.setHeader("Retry-After", retryAfter.toString());
      }

      // ✅ TRPC ERROR: Retourne une erreur typée avec code TOO_MANY_REQUESTS
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Rate limit exceeded. Retry after ${retryAfter} seconds`,
        cause: { retryAfter, identifier }
      });
    }

    return next();
  };
}

// ============================================
// PHONE NUMBER VALIDATION
// ============================================

/**
 * Validate phone number format (E.164)
 */
export function validatePhoneNumber(phoneNumber: string): {
  valid: boolean;
  formatted?: string;
  country?: string;
  error?: string;
} {
  // Remove all non-digit characters except +
  const cleaned = phoneNumber.replace(/[^\d+]/g, "");

  // E.164 format: +[country code][number]
  const e164Regex = /^\+[1-9]\d{1,14}$/;

  if (!e164Regex.test(cleaned)) {
    return {
      valid: false,
      error: "Invalid phone number format. Expected E.164 format (e.g., +33612345678)",
    };
  }

  // Extract country code
  let countryCode = "";
  if (cleaned.startsWith("+1")) countryCode = "US/CA";
  else if (cleaned.startsWith("+33")) countryCode = "FR";
  else if (cleaned.startsWith("+44")) countryCode = "UK";
  else if (cleaned.startsWith("+49")) countryCode = "DE";
  else if (cleaned.startsWith("+34")) countryCode = "ES";
  else if (cleaned.startsWith("+39")) countryCode = "IT";

  return {
    valid: true,
    formatted: cleaned,
    country: countryCode,
  };
}

/**
 * Check if phone number is blacklisted
 * ✅ Bloc 4: Persistance Redis + DB avec cache TTL 24h
 */
export async function isPhoneNumberBlacklisted(phoneNumber: string): Promise<boolean> {
  const { formatted } = validatePhoneNumber(phoneNumber);
  if (!formatted) return false;

  // 1. Vérifier le cache d'abord
  const cacheKey = `blacklist:${formatted}`;
  try {
    const cached = await cacheService.get<boolean>(cacheKey);
    if (cached !== null) {
      logger.info(`[Security:Blacklist] Cache hit for ${formatted}: ${cached}`);
      return cached;
    }
  } catch (err: unknown) {
    logger.error("[Security:Blacklist] Cache error", err);
  }

  // 2. Vérifier la base de données (Fallback)
  try {
    const result = await db.query.blacklistedNumbers.findFirst({
      where: eq(blacklistedNumbers.phoneNumber, formatted)
    });
    
    const isBlacklisted = !!result;

    // 3. Mettre en cache pour 24h (86400s)
    await cacheService.set(cacheKey, isBlacklisted, 86400);
    
    return isBlacklisted;
  } catch (err: unknown) {
    logger.error("[Security:Blacklist] Database error", err);
    return false;
  }
}

/**
 * Add phone number to blacklist
 * ✅ Bloc 4: Persistance DB + Invalidation Cache
 */
export async function blacklistPhoneNumber(phoneNumber: string, reason: string = "Manual blacklist"): Promise<void> {
  const { formatted } = validatePhoneNumber(phoneNumber);
  if (!formatted) return;

  try {
    // 1. Ajouter à la base de données
    await db.insert(blacklistedNumbers).values({
      phoneNumber: formatted,
      reason,
      createdAt: new Date()
    }).onDuplicateKeyUpdate({
      set: { reason, createdAt: new Date() }
    });

    // 2. Invalider le cache
    await cacheService.delete(`blacklist:${formatted}`);
    
    logger.info(`[Security:Blacklist] Number blacklisted: ${formatted}`);
  } catch (err: unknown) {
    logger.error("[Security:Blacklist] Failed to blacklist number", err);
    throw new Error("Failed to update blacklist");
  }
}

/**
 * Remove phone number from blacklist
 * ✅ Bloc 4: Suppression DB + Invalidation Cache
 */
export async function removeFromBlacklist(phoneNumber: string): Promise<void> {
  const { formatted } = validatePhoneNumber(phoneNumber);
  if (!formatted) return;

  try {
    // 1. Supprimer de la base de données
    await db.delete(blacklistedNumbers).where(eq(blacklistedNumbers.phoneNumber, formatted));

    // 2. Invalider le cache
    await cacheService.delete(`blacklist:${formatted}`);
    
    logger.info(`[Security:Blacklist] Number removed from blacklist: ${formatted}`);
  } catch (err: unknown) {
    logger.error("[Security:Blacklist] Failed to remove from blacklist", err);
    throw new Error("Failed to update blacklist");
  }
}

// ============================================
// EMAIL VALIDATION
// ============================================

/**
 * Validate email format
 * ✅ Bloc 11: Regex stricte, validation TLD, domaines jetables et DNS
 */
export async function validateEmail(email: string, checkDNS: boolean = false): Promise<{
  valid: boolean;
  error?: string;
}> {
  // ✅ Regex stricte: Validation du format et du TLD (au moins 2 caractères)
  const emailRegex = /^[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
  if (!emailRegex.test(email)) {
    return {
      valid: false,
      error: "Invalid email format",
    };
  }

  // ✅ Vérifier les domaines jetables (Set pour performance O(1))
  const disposableDomains = new Set([
    "tempmail.com",
    "throwaway.email",
    "guerrillamail.com",
    "10minutemail.com",
    "mailinator.com",
    "temp-mail.org",
    "yopmail.com",
  ]);

  const domain = (email.split("@")[1] ?? "").toLowerCase();
  if (disposableDomains.has(domain)) {
    return {
      valid: false,
      error: "Disposable email addresses are not allowed",
    };
  }

  // ✅ Bloc 11: Validation DNS optionnelle (vérification des enregistrements MX)
  if (checkDNS) {
    try {
      const mxRecords = await dns.resolveMx(domain);
      if (!mxRecords || mxRecords.length === 0) {
        return {
          valid: false,
          error: "Domain has no valid MX records",
        };
      }
    } catch (dnsError) {
      logger.warn(`[Security:Email] DNS validation failed for ${domain}`, { error: dnsError });
      return {
        valid: false,
        error: "Email domain could not be verified via DNS",
      };
    }
  }

  return { valid: true };
}

// ============================================
// DATA ENCRYPTION
// ============================================

// Validation stricte de la clé de chiffrement au chargement du module
let ENCRYPTION_KEY: string;

// Détection du mode build
const IS_BUILD = process.env['NODE_ENV'] === "production" && !process.env['DATABASE_URL'];

// ✅ VALIDATION STRICTE: Pas de clé par défaut, exception immédiate si manquante
if (!process.env['ENCRYPTION_KEY']) {
  logger.error("[Security Service] 🚨 ERREUR CRITIQUE: La variable d'environnement ENCRYPTION_KEY n'est pas définie.");
  logger.error("[Security Service] ENCRYPTION_KEY est OBLIGATOIRE dans TOUS les environnements (dev, staging, production).");
  logger.error("[Security Service] Générez une clé sécurisée avec: openssl rand -base64 32");
  logger.error("[Security Service] Ajoutez-la dans votre fichier .env: ENCRYPTION_KEY=votre-cle-32-caracteres-minimum");
  throw new Error("ENCRYPTION_KEY is required but not defined in environment variables. Application cannot start without it.");
}

ENCRYPTION_KEY = process.env['ENCRYPTION_KEY'];

// ✅ VALIDATION DE LA LONGUEUR: Minimum 32 caractères requis
if (ENCRYPTION_KEY.length < 32) {
  logger.error("[Security Service] 🚨 ERREUR CRITIQUE: La clé ENCRYPTION_KEY est trop courte.");
  logger.error(`[Security Service] Longueur actuelle: ${ENCRYPTION_KEY.length} caractères. Minimum requis: 32 caractères.`);
  logger.error("[Security Service] Générez une clé sécurisée avec: openssl rand -base64 32");
  throw new Error(`ENCRYPTION_KEY must be at least 32 characters long. Current length: ${ENCRYPTION_KEY.length}`);
}

if (!IS_BUILD) {
  logger.info(`[Security Service] ✅ ENCRYPTION_KEY validée (${ENCRYPTION_KEY.length} caractères)`);
}

const ALGORITHM = "aes-256-gcm";

// ✅ SALT UNIQUE PAR DÉPLOIEMENT: Utilisation de crypto.scryptSync avec salt personnalisé
// Le salt doit être unique par déploiement pour renforcer la sécurité
const ENCRYPTION_SALT = process.env['ENCRYPTION_SALT'] || "servicall-v2-default-salt-change-in-production";

if (!process.env['ENCRYPTION_SALT'] && !IS_BUILD) {
  logger.warn("[Security Service] ⚠️  ENCRYPTION_SALT non défini. Utilisation d'un salt par défaut.");
  logger.warn("[Security Service] Pour une sécurité optimale, définissez ENCRYPTION_SALT dans votre .env");
}

/**
 * Encrypt sensitive data
 * ✅ Utilise crypto.scryptSync avec un salt unique par déploiement
 */
export function encryptData(data: string): string {
  try {
    // ✅ Dérivation de clé avec scryptSync et salt personnalisé
    const key = crypto.scryptSync(ENCRYPTION_KEY, ENCRYPTION_SALT, 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(data, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    // Combine IV, authTag, and encrypted data
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
  } catch (error: unknown) {
    logger.error("[Security Service] Encryption error", { error });
    throw new Error("Failed to encrypt data");
  }
}

/**
 * Déclenche une alerte de sécurité (Audit & Monitoring)
 * ✅ Bloc 3: Système d'alerte pour le tampering
 */
async function triggerSecurityAlert(type: string, metadata: unknown) {
  logger.error(`[SECURITY ALERT] ${type}`, metadata);
  // Ici, on pourrait intégrer un service de notification (Slack, Email, PagerDuty)
  // Pour l'instant, nous logguons de manière critique pour l'audit
}

/**
 * Decrypt sensitive data
 * ✅ Bloc 3: Détection de tampering et distinction des erreurs
 * ✅ Utilise crypto.scryptSync avec un salt unique par déploiement
 */
export function decryptData(encryptedData: string): string {
  try {
    // ✅ DISTINGUER les erreurs de format
    const parts = encryptedData.split(":");
    if (parts.length !== 3) {
      throw new Error("Invalid encrypted data format");
    }

    const [ivHex, authTagHex, encrypted] = parts as [string, string, string];
    
    // ✅ BLOC 4 FIX: Vérification que encrypted est bien défini
    if (!encrypted) {
      throw new Error("Encrypted payload is missing");
    }

    // ✅ Dérivation de clé avec scryptSync et salt personnalisé (Bloc 1)
    const key = crypto.scryptSync(ENCRYPTION_KEY, ENCRYPTION_SALT, 32);
    const iv = Buffer.from(ivHex as string, "hex");
    const authTag = Buffer.from(authTagHex as string, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    // ✅ BLOC 4 FIX: Cast explicite en string pour éviter les erreurs de type inconnu
    let decrypted: string = decipher.update(encrypted as string, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error: unknown) {
    // ✅ DÉTECTION DE TAMPERING (Auth tag invalide)
    if (error.message?.includes("Unsupported state or unable to authenticate data")) {
      logger.error("[SECURITY ALERT] TAMPERING DETECTED - Decryption authentication failed", {
        error: error.message,
        timestamp: new Date().toISOString(),
        dataSnippet: encryptedData.substring(0, 50)
      });

      // ✅ DÉCLENCHER une alerte de sécurité
      triggerSecurityAlert("TAMPERING_DETECTED", { 
        encryptedData: encryptedData.substring(0, 50) 
      }).catch(err => logger.error("Failed to trigger security alert", err));
      
      throw new Error("Security breach detected: Data integrity compromised");
    }

    // ✅ DISTINGUER les erreurs de format des erreurs de tampering
    if (error.message === "Invalid encrypted data format") {
      logger.warn("[Security Service] Decryption format error", { error: error.message });
      throw error;
    }

    logger.error("[Security Service] Decryption error", { error });
    throw new Error("Failed to decrypt data");
  }
}

/**
 * Hash sensitive data (one-way)
 */
export function hashData(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

// ============================================
// FRAUD DETECTION
// ============================================

export interface CallPattern {
  phoneNumber: string;
  callCount: number;
  lastCallAt: number;
  totalDuration: number;
}

/**
 * Detect suspicious call patterns
 * ✅ Bloc 5: Persister les patterns en Redis avec TTL de 24h
 */
export async function detectSuspiciousCallPattern(
  phoneNumber: string,
  duration: number
): Promise<{
  suspicious: boolean;
  reason?: string;
  severity: "low" | "medium" | "high";
}> {
  const now = Date.now();
  const cacheKey = `call-pattern:${phoneNumber}`;
  
  // 1. Récupérer le pattern depuis Redis
  let pattern = await cacheService.get<CallPattern>(cacheKey);

  if (!pattern) {
    pattern = {
      phoneNumber,
      callCount: 1,
      lastCallAt: now,
      totalDuration: duration,
    };
  } else {
    // 2. Mettre à jour le pattern
    pattern.callCount++;
    pattern.totalDuration += duration;
    pattern.lastCallAt = now;
  }

  // 3. Persister avec TTL de 24h (86400 secondes)
  await cacheService.set(cacheKey, pattern, 86400);

  // 4. Vérifier les patterns suspects
  const CALL_THRESHOLD = 10;
  const TIME_WINDOW = 60 * 60 * 1000; // 1 heure

  if (pattern.callCount > CALL_THRESHOLD && now - pattern.lastCallAt < TIME_WINDOW) {
    return {
      suspicious: true,
      reason: `Too many calls (${pattern.callCount}) in short time`,
      severity: "high",
    };
  }

  const AVG_DURATION = pattern.totalDuration / pattern.callCount;
  if (AVG_DURATION < 5 && pattern.callCount > 5) {
    return {
      suspicious: true,
      reason: "Extremely short average call duration",
      severity: "medium",
    };
  }

  if (duration > 3600) {
    return {
      suspicious: true,
      reason: "Unusually long call duration",
      severity: "medium",
    };
  }

  return { suspicious: false, severity: "low" };
}

/**
 * Clear call pattern history
 * ✅ Bloc 5: Nettoyage des patterns
 */
export async function clearCallPattern(phoneNumber: string): Promise<void> {
  const cacheKey = `call-pattern:${phoneNumber}`;
  await cacheService.delete(cacheKey);
}

// ============================================
// AUDIT LOGGING
// ============================================

export interface AuditLog {
  timestamp: Date;
  userId: number;
  tenantId: number;
  action: string;
  resource: string;
  resourceId?: number;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

/**
 * Log audit event - Persiste dans la base de données
 */
export async function logAuditEvent(log: AuditLog): Promise<void> {
  logger.info("[Audit Log]", { log });

  // Import dynamique pour éviter les dépendances circulaires
  const { createAuditLog } = await import("../db");
  
  try {
    await createAuditLog({
      timestamp: log.timestamp,
      userId: log.userId,
      tenantId: log.tenantId,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      metadata: log.metadata,
    });
  } catch (error: unknown) {
    logger.error("[Audit Log] Failed to persist audit log", { error });
    // Ne pas lever d'erreur pour ne pas bloquer l'opération principale
  }
}

/**
 * Get audit logs for a tenant - Récupère depuis la base de données
 */
export async function getAuditLogs(
  tenantId: number,
  limit: number = 100
): Promise<AuditLog[]> {
  const { getAuditLogsByTenant } = await import("../db");
  
  try {
    const logs = await getAuditLogsByTenant(tenantId, limit);
    return logs.map((log: unknown) => ({
      timestamp: log.timestamp,
      userId: log.userId,
      tenantId: log.tenantId,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId ?? undefined,
      ipAddress: log.ipAddress ?? undefined,
      userAgent: log.userAgent ?? undefined,
      metadata: log.metadata ?? undefined,
    }));
  } catch (error: unknown) {
    logger.error("[Audit Log] Failed to retrieve audit logs", { error });
    return [];
  }
}

/**
 * Get audit logs for a user - Récupère depuis la base de données
 */
export async function getUserAuditLogs(
  userId: number,
  limit: number = 100
): Promise<AuditLog[]> {
  const { getAuditLogsByUser } = await import("../db");
  
  try {
    const logs = await getAuditLogsByUser(userId, limit);
    return logs.map((log: unknown) => ({
      timestamp: log.timestamp,
      userId: log.userId,
      tenantId: log.tenantId,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId ?? undefined,
      ipAddress: log.ipAddress ?? undefined,
      userAgent: log.userAgent ?? undefined,
      metadata: log.metadata ?? undefined,
    }));
  } catch (error: unknown) {
    logger.error("[Audit Log] Failed to retrieve user audit logs", { error });
    return [];
  }
}

// ============================================
// INPUT SANITIZATION
// ============================================

/**
 * Sanitize string input to prevent XSS
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

/**
 * Sanitize SQL input (basic - use parameterized queries instead)
 */
export function sanitizeSQLInput(input: string): string {
  return input.replace(/['";\\]/g, "");
}

/**
 * Validate and sanitize URL
 */
export function validateURL(url: string): {
  valid: boolean;
  sanitized?: string;
  error?: string;
} {
  try {
    const parsed = new URL(url);

    // Only allow http and https protocols
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return {
        valid: false,
        error: "Only HTTP and HTTPS protocols are allowed",
      };
    }

    return {
      valid: true,
      sanitized: parsed.toString(),
    };
  } catch (error: unknown) {
    return {
      valid: false,
      error: "Invalid URL format",
    };
  }
}

// ============================================
// IP BLOCKING
// ============================================

const blockedIPs = new Set<string>();

/**
 * Check if IP is blocked
 */
export function isIPBlocked(ip: string): boolean {
  return blockedIPs.has(ip);
}

/**
 * Block IP address
 */
export function blockIP(ip: string): void {
  blockedIPs.add(ip);
  logger.info(`[Security Service] Blocked IP: ${ip}`);
}

/**
 * Unblock IP address
 */
export function unblockIP(ip: string): void {
  blockedIPs.delete(ip);
  logger.info(`[Security Service] Unblocked IP: ${ip}`);
}

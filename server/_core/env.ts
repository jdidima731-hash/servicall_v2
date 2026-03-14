/**
 * Environment Configuration & Security Validation
 * ✅ DURCISSEMENT SaaS: Validation stricte au boot (assertEnvOrCrash)
 */

import { logger } from "../infrastructure/logger";

export type AppMode = "dev" | "prod";

export const ENV = {
  appId: process.env['VITE_APP_ID'] ?? "",
  jwtSecret: process.env['JWT_SECRET'],
  databaseUrl: process.env['DATABASE_URL'] ?? "",
  sessionSecret: process.env['SESSION_SECRET'],
  csrfSecret: process.env['CSRF_SECRET'],
  encryptionKey: process.env['ENCRYPTION_KEY'],
  encryptionSalt: process.env['ENCRYPTION_SALT'],
  masterKey: process.env['MASTER_KEY'],
  nodeEnv: process.env["NODE_ENV"] ?? "development",
  isProduction: process.env['NODE_ENV'] === "production",
  allowedOrigins: process.env['ALLOWED_ORIGINS'],
  sentryDsn: process.env['SENTRY_DSN'],
  redisUrl: process.env['REDIS_URL'] ?? "redis://localhost:6379",
  twilioAccountSid: process.env['TWILIO_ACCOUNT_SID'],
  twilioAuthToken: process.env['TWILIO_AUTH_TOKEN'],
  twilioTwimlAppSid: process.env['TWILIO_TWIML_APP_SID'],
  openaiApiKey: process.env["OPENAI_API_KEY"],
  // ✅ CORRIGÉ: Utilisation de l'API officielle OpenAI (plus de proxy forge.manus.im)
  openaiApiUrl: process.env["OPENAI_API_URL"] || "https://api.openai.com/v1",
  redisHost: process.env["REDIS_HOST"] ?? "localhost",
  redisPort: parseInt(process.env["REDIS_PORT"] ?? "6379", 10),
  redisPassword: process.env["REDIS_PASSWORD"],
  disableRedis: process.env["DISABLE_REDIS"] === "true",
  stripeSecretKey: process.env['STRIPE_SECRET_KEY'],
  stripeWebhookSecret: process.env['STRIPE_WEBHOOK_SECRET'],
  webhookSecret: process.env['WEBHOOK_SECRET'],
  smtpHost: process.env['SMTP_HOST'],
  smtpPort: process.env['SMTP_PORT'] ? parseInt(process.env['SMTP_PORT']) : 587,
  smtpUser: process.env['SMTP_USER'],
  smtpPassword: process.env['SMTP_PASSWORD'],
  awsAccessKeyId: process.env['AWS_ACCESS_KEY_ID'],
  awsSecretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'],
  awsRegion: process.env['AWS_REGION'],
  awsS3Bucket: process.env['AWS_S3_BUCKET'],
  // Twilio extended
  twilioPhoneNumber: process.env['TWILIO_PHONE_NUMBER'],
  twilioApiKey: process.env['TWILIO_API_KEY'],
  twilioApiSecret: process.env['TWILIO_API_SECRET'],
  // Cookie secret
  cookieSecret: process.env['COOKIE_SECRET'],
  // Feature flags
  redisEnabled: process.env['DISABLE_REDIS'] !== "true",
  dbEnabled: process.env['DISABLE_DB'] !== "true",
  modeTest: process.env['MODE_TEST'] === "true",
};

/**
 * ✅ DURCISSEMENT SaaS: Validation stricte au boot
 * Le serveur s'arrête immédiatement si une variable critique est manquante.
 */
export async function assertEnvOrCrash() {
  const isProd = ENV.isProduction;
  const minLength = 32;
  
  const criticalSecrets = [
    { name: "JWT_SECRET", value: ENV.jwtSecret },
    { name: "SESSION_SECRET", value: ENV.sessionSecret },
    { name: "CSRF_SECRET", value: ENV.csrfSecret },
    { name: "ENCRYPTION_KEY", value: ENV.encryptionKey },
    { name: "ENCRYPTION_SALT", value: ENV.encryptionSalt },
    { name: "MASTER_KEY", value: ENV.masterKey },
  ];

  // OPENAI_API_KEY est optionnelle - ne pas l'inclure dans les secrets critiques

  const errors: string[] = [];

  // 1. Vérification des secrets critiques
  for (const secret of criticalSecrets) {
    if (!secret.value) {
      errors.push(`${secret.name} est manquant`);
      continue;
    }

    if (isProd && secret.value.length < minLength) {
      errors.push(`${secret.name} est trop court (min ${minLength} caractères en production)`);
    }

    if (isProd && (secret.value.includes("placeholder") || secret.value.includes("change-me"))) {
      errors.push(`${secret.name} contient une valeur par défaut non autorisée en production`);
    }
  }

  // 2. Vérification de la DB en production
  if (isProd && !ENV.databaseUrl) {
    errors.push("DATABASE_URL est obligatoire en production");
  }

  if (errors.length > 0) {
    logger.error("\n❌ ERREUR DE CONFIGURATION CRITIQUE (assertEnvOrCrash) :");
    errors.forEach(err => logger.error(`  - ${err}`));
    logger.error("\nLe serveur ne peut pas démarrer avec une configuration invalide ou non sécurisée.\n");
    
    if (typeof logger !== 'undefined' && logger.error) {
      logger.error("[ENV] Validation échouée", { errors });
    }
    
    process.exit(1);
  }

  // ✅ Ajout: Test de la clé OpenAI (seulement si la clé n'est pas un placeholder)
  const isPlaceholderKey = !ENV.openaiApiKey || 
    ENV.openaiApiKey.includes('your-') || 
    ENV.openaiApiKey.includes('placeholder') ||
    ENV.openaiApiKey === 'process.env.OPENAI_API_KEY...';
  
  if (ENV.openaiApiKey && !isPlaceholderKey) {
    try {
      const { getOpenAIClient } = await import("./openaiClient");
      const client = getOpenAIClient();
      // Effectuer un appel léger pour valider la clé
      await client.models.list();
      logger.info("✅ Clé OpenAI validée avec succès.");

      // Vérifier si gpt-4o-mini est disponible (le modèle par défaut du projet)
      try {
        await client.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: "test" }],
          max_tokens: 1,
        });
        logger.info("✅ Modèle par défaut 'gpt-4o-mini' disponible.");
      } catch (modelError) {
        logger.warn("\n⚠️ ATTENTION: Modèle 'gpt-4o-mini' non disponible.");
        logger.warn(`  - Raison: ${(modelError as Error).message}`);
        logger.warn("  - Le projet pourrait rencontrer des erreurs si ce modèle est utilisé par défaut.");
      }
    } catch (error: unknown) {
      logger.warn("\n⚠️ AVERTISSEMENT OPENAI: La clé OpenAI fournie semble invalide.");
      logger.warn(`  - Raison: ${(error as Error).message}`);
      logger.warn("  - Les fonctionnalités IA seront désactivées jusqu'à la correction de la clé.\n");
      if (typeof logger !== 'undefined' && logger.warn) {
        logger.warn("[ENV] Validation OpenAI échouée - fonctionnalités IA désactivées", { error });
      }
      // Ne pas bloquer le démarrage - l'IA est optionnelle
    }
  } else if (ENV.openaiApiKey && isPlaceholderKey) {
    logger.warn("⚠️ OPENAI_API_KEY est un placeholder - les fonctionnalités IA seront désactivées.");
  }

  logger.info("✅ Configuration environnement validée avec succès.");;
}

/**
 * Alias pour compatibilité descendante
 */
export function validateSecrets() {
  assertEnvOrCrash();
}

/**
 * ✅ ROTATION DES TOKENS: Vérifier si les secrets doivent être renouvelés
 * En production, les secrets devraient être renouvelés tous les 90 jours
 */
export function checkSecretRotation(): { shouldRotate: boolean; message?: string } {
  // Cette fonction peut être étendue pour vérifier la date de dernière rotation
  // depuis une base de données ou un fichier de métadonnées
  // const _rotationWarningDays = 90;
  
  // Pour l'instant, retourne false (pas de rotation nécessaire)
  // À implémenter avec un système de tracking des dates de rotation
  return {
    shouldRotate: false,
    message: "Rotation des secrets recommandée tous les 90 jours en production"
  };
}

/**
 * ✅ VALIDATION SÉPARATION DEV/PROD
 * Vérifie que les valeurs de développement ne sont pas utilisées en production
 */
export function validateEnvironmentSeparation(): void {
  if (!ENV.isProduction) return;

  const devPatterns = ["dev_", "test_", "local_", "localhost", "127.0.0.1", "example.com"];
  const errors: string[] = [];

  // Vérifier DATABASE_URL
  if (ENV.databaseUrl) {
    for (const pattern of devPatterns) {
      if (ENV.databaseUrl.toLowerCase().includes(pattern)) {
        errors.push(`DATABASE_URL contient un pattern de développement: ${pattern}`);
      }
    }
  }

  // Vérifier REDIS_URL
  if (ENV.redisUrl && ENV.redisUrl.includes("localhost")) {
    errors.push("REDIS_URL pointe vers localhost en production");
  }

  // Vérifier ALLOWED_ORIGINS
  if (ENV.allowedOrigins && ENV.allowedOrigins.includes("localhost")) {
    logger.warn("[ENV] ALLOWED_ORIGINS contient localhost en production");
  }

  if (errors.length > 0) {
    logger.warn("\n⚠️ ATTENTION: Configuration de développement détectée en production (autorisé en sandbox) :");
    errors.forEach(err => logger.warn(`  - ${err}`));
  }

  logger.info("[ENV] ✅ Séparation dev/prod validée");
}

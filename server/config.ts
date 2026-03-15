import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // App
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  appName: process.env.APP_NAME || 'Servicall',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  apiUrl: process.env.API_URL || 'http://localhost:3000/api',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  // Database
  databaseUrl: process.env.DATABASE_URL || '',
  directUrl: process.env.DIRECT_URL || '',

  // Security
  jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret-change-me',
  sessionSecret: process.env.SESSION_SECRET || 'dev-session-secret-change-me',
  encryptionKey: process.env.ENCRYPTION_KEY || 'dev-encryption-key-32-chars',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:3000',

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  redisPassword: process.env.REDIS_PASSWORD,

  // Twilio
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
  twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER,

  // Stripe
  stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,

  // Email
  resendApiKey: process.env.RESEND_API_KEY,
  adminEmail: process.env.ADMIN_EMAIL || 'admin@servicall.com',
  supportEmail: process.env.SUPPORT_EMAIL || 'support@servicall.com',

  // Monitoring
  sentryDsn: process.env.SENTRY_DSN,
  logtailToken: process.env.LOGTAIL_TOKEN,
  logLevel: process.env.LOG_LEVEL || 'info',

  // Rate Limiting
  rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),

  // File Upload
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10),
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  allowedFileTypes: (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/gif,application/pdf').split(','),

  // Feature Flags
  enableMfa: process.env.ENABLE_MFA === 'true',
  enableAnalytics: process.env.ENABLE_ANALYTICS !== 'false',
  enableWebsockets: process.env.ENABLE_WEBSOCKETS !== 'false',
  enableFileUploads: process.env.ENABLE_FILE_UPLOADS !== 'false',
};

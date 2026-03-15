import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import passport from 'passport';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as Sentry from '@sentry/node';
import { pinoHttp } from 'pino-http';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
dotenv.config();

// Import configurations
import { setupAuth } from './auth.js';
import { setupRoutes } from './routes.js';
import { setupWebSocket } from './websocket.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { logger } from './utils/logger.js';
import { config } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialisation
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { 
    origin: config.corsOrigin.split(','), 
    credentials: true 
  },
  transports: ['websocket', 'polling']
});

// Sentry (monitoring)
if (config.sentryDsn) {
  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.nodeEnv,
    tracesSampleRate: 1.0,
  });
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}

// Middleware de sécurité
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", config.apiUrl, config.clientUrl],
    },
  },
}));

app.use(compression());
app.use(cors({
  origin: config.corsOrigin.split(','),
  credentials: true,
  optionsSuccessStatus: 200
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimitWindow,
  max: config.rateLimitMax,
  message: { error: 'Trop de requêtes, veuillez réessayer plus tard.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Logging
app.use(pinoHttp({ 
  logger,
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  }
}));
app.use(requestLogger);

// Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session
app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: config.nodeEnv === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 jours
    sameSite: 'lax'
  },
  name: 'servicall.sid'
}));

// Passport (auth)
app.use(passport.initialize());
app.use(passport.session());

// Database connection
const sql = neon(config.databaseUrl);
export const db = drizzle(sql);

// Setup authentication
setupAuth(app);

// Routes API
app.use('/api', setupRoutes(db));

// WebSocket
setupWebSocket(io, db);

// Serve static files in production
if (config.nodeEnv === 'production') {
  app.use(express.static(join(__dirname, '../../dist/client')));
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '../../dist/client/index.html'));
  });
}

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    uptime: process.uptime()
  });
});

// Sentry error handler
if (config.sentryDsn) {
  app.use(Sentry.Handlers.errorHandler());
}

// Error handling
app.use(errorHandler);

// Démarrage du serveur
const PORT = config.port;
server.listen(PORT, () => {
  logger.info(`🚀 Serveur démarré sur le port ${PORT} en mode ${config.nodeEnv}`);
  logger.info(`📡 WebSocket prêt sur ws://localhost:${PORT}`);
  logger.info(`📚 API disponible sur http://localhost:${PORT}/api`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM reçu, arrêt gracieux...');
  server.close(() => {
    logger.info('Serveur arrêté');
    process.exit(0);
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

export { app, server, io };

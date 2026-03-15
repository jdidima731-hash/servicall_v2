import pino from 'pino';
import { config } from '../config.js';

const transports = pino.transport({
  targets: [
    {
      target: 'pino-pretty',
      level: config.logLevel,
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname'
      }
    },
    ...(config.logtailToken ? [{
      target: '@logtail/pino',
      level: config.logLevel,
      options: {
        sourceToken: config.logtailToken
      }
    }] : [])
  ]
});

export const logger = pino(
  {
    level: config.logLevel,
    base: {
      env: config.nodeEnv,
      app: config.appName
    },
    timestamp: pino.stdTimeFunctions.isoTime
  },
  transports
);

// Logger pour les erreurs critiques
export const criticalLogger = {
  log: (error: Error, context?: any) => {
    logger.fatal({
      msg: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString()
    });

    // Envoyer une alerte (email, slack, etc.)
    if (config.nodeEnv === 'production') {
      // Implémenter l'envoi d'alertes
    }
  }
}

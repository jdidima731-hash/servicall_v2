/**
 * FRONTEND LOGGER (BLOC 5)
 * Utilitaire de logging pour la production
 */

export const logger = {
  info: (message: string, data?: any) => {
    if (process.env['NODE_ENV'] !== 'production') {
      console.log(`[INFO] ${message}`, data || '');
    }
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${message}`, error || '');
  },
  warn: (message: string, data?: any) => {
    console.warn(`[WARN] ${message}`, data || '');
  }
};

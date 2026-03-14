/**
 * LOGGER UTILITY
 * Wrappe le service de logging existant avec typage strict
 * ✅ Supporte les logs structurés et les contextes enfants.
 */

import { logger as baseLogger, LogContext } from "../../infrastructure/logger";

type LogMeta = Omit<LogContext, 'module' | 'workflow' | 'timestamp'>;

export class Logger {
  constructor(private context: string) {}

  private getContext(meta?: LogMeta): LogContext {
    return {
      module: "WORKFLOW",
      workflow: this.context,
      timestamp: new Date().toISOString(),
      ...(meta ?? {})
    };
  }

  info(message: string, meta?: LogMeta): void {
    try {
      baseLogger.info(`[${this.context}] ${message}`, this.getContext(meta));
    } catch (e) {
      console.error(`Logger.info failed for context ${this.context}:`, e);
    }
  }

  warn(message: string, meta?: LogMeta): void {
    try {
      baseLogger.warn(`[${this.context}] ${message}`, this.getContext(meta));
    } catch (e) {
      console.error(`Logger.warn failed for context ${this.context}:`, e);
    }
  }

  error(message: string, meta?: LogMeta): void {
    try {
      const error = meta?.['error'] || meta;
      baseLogger.error(`[${this.context}] ${message}`, error, this.getContext(meta));
    } catch (e) {
      console.error(`Logger.error failed for context ${this.context}:`, e);
    }
  }

  debug(message: string, meta?: LogMeta): void {
    try {
      if (typeof baseLogger.debug === 'function') {
        baseLogger.debug(`[${this.context}] ${message}`, this.getContext(meta));
      } else {
        console.debug(`[${this.context}] ${message}`, this.getContext(meta));
      }
    } catch (e) {
      console.error(`Logger.debug failed for context ${this.context}:`, e);
    }
  }
}

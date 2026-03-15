import { logger } from './logger.js';
import os from 'os';
import { db } from '../index.js';
import { sql } from 'drizzle-orm';

class MonitoringService {
  private metrics: Map<string, number> = new Map();
  private alerts: any[] = [];
  private startTime: number = Date.now();

  trackMetric(name: string, value: number) {
    this.metrics.set(name, value);
    
    // Alertes automatiques
    if (name === 'cpu_usage' && value > 80) {
      this.triggerAlert('critical', `⚠️ CPU usage élevé: ${value}%`);
    }
    
    if (name === 'memory_usage' && value > 90) {
      this.triggerAlert('critical', `⚠️ Mémoire élevée: ${value}%`);
    }
    
    if (name === 'error_rate' && value > 5) {
      this.triggerAlert('warning', `⚠️ Taux d'erreur élevé: ${value}%`);
    }

    if (name === 'db_connections' && value > 80) {
      this.triggerAlert('warning', `⚠️ Connexions DB élevées: ${value}`);
    }
  }

  triggerAlert(level: 'info' | 'warning' | 'critical', message: string) {
    const alert = {
      level,
      message,
      timestamp: new Date().toISOString(),
      server: os.hostname()
    };
    
    this.alerts.push(alert);
    
    // Log
    logger[level](`🚨 ALERTE ${level.toUpperCase()}: ${message}`);
    
    // Envoyer email si critique
    if (level === 'critical') {
      this.sendEmailAlert(alert);
    }
    
    // Webhook Slack
    this.sendSlackAlert(alert);
  }

  private async sendEmailAlert(alert: any) {
    // Implémentation avec Resend
    logger.info(`Email alert would be sent: ${alert.message}`);
  }

  private async sendSlackAlert(alert: any) {
    // Implémentation webhook Slack
    logger.info(`Slack alert would be sent: ${alert.message}`);
  }

  async getSystemMetrics() {
    const dbStatus = await this.checkDatabase();
    const memoryUsage = (os.totalmem() - os.freemem()) / os.totalmem() * 100;
    const cpuLoad = os.loadavg()[0] * 100;

    this.trackMetric('memory_usage', memoryUsage);
    this.trackMetric('cpu_usage', cpuLoad);

    return {
      system: {
        cpu: {
          loadavg: os.loadavg(),
          usage: cpuLoad,
          cores: os.cpus().length
        },
        memory: {
          total: os.totalmem(),
          free: os.freemem(),
          usage: memoryUsage
        },
        uptime: os.uptime(),
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch()
      },
      process: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        pid: process.pid,
        version: process.version
      },
      database: dbStatus,
      metrics: Object.fromEntries(this.metrics),
      alerts: this.alerts.slice(-10), // 10 dernières alertes
      appUptime: Date.now() - this.startTime
    };
  }

  private async checkDatabase() {
    try {
      const start = Date.now();
      await db.execute(sql`SELECT 1`);
      const latency = Date.now() - start;
      
      return {
        status: 'healthy',
        latency: `${latency}ms`,
        connections: await this.getDbConnections()
      };
    } catch (error) {
      logger.error('Database health check failed:', error);
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  private async getDbConnections() {
    try {
      const result = await db.execute(sql`
        SELECT count(*) FROM pg_stat_activity
      `);
      return result.rows[0].count;
    } catch {
      return 'unknown';
    }
  }
}

export const monitoring = new MonitoringService();

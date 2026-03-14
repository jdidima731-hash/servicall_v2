import { Queue, Worker, Job as BullJob } from 'bullmq';
import { ENV } from '../_core/env';
import { logger } from "../infrastructure/logger";
import { getDbInstance } from '../db';
import { failedJobs } from '../../drizzle/schema';

// BullMQ bundles its own ioredis - pass connection options directly to avoid version conflicts
const redisUrl = ENV.redisEnabled ? new URL(ENV.redisUrl || 'redis://localhost:6379') : null;
const connection = redisUrl ? {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port ?? '6379'),
  password: redisUrl.password || undefined,
  maxRetriesPerRequest: null as unknown as undefined,
} : null;

export type JobType = 'SEND_CAMPAIGN' | 'PROCESS_IA_BULK' | 'EXPORT_DATA' | 'CLEANUP_SYSTEM' | 'WEBHOOK_PROCESS' | 'WORKFLOW_EXECUTE';

// Queue principale
const mainQueue = connection ? new Queue('servicall-main', { connection }) : null;

// Fonctions de traitement (Placeholders à implémenter selon les besoins du projet)
async function processCampaign(tenantId: number, payload: unknown) {
  // const {_CampaignService} = await import('./campaignService');
  logger.info(`[JobQueue] Processing campaign for tenant ${tenantId}`, { payload });
  // Logique d'envoi de campagne ici
}

async function processAIBulk(tenantId: number, payload: unknown) {
  logger.info(`[JobQueue] Processing AI Bulk for tenant ${tenantId}`, { payload });
}

async function processExport(tenantId: number, payload: unknown) {
  logger.info(`[JobQueue] Processing Export for tenant ${tenantId}`, { payload });
}

async function processCleanup(payload: unknown) {
  logger.info(`[JobQueue] Processing System Cleanup`, { payload });
}

async function processWebhook(payload: unknown) {
  // const {_WebhookService} = await import('./webhookService');
  logger.info(`[JobQueue] Processing Webhook`, { payload });
}

async function processWorkflow(tenantId: number, payload: unknown) {
  const { WorkflowEngine } = await import('../workflow-engine/core/WorkflowEngine');
  const engine = new WorkflowEngine();
  logger.info(`[JobQueue] Processing Workflow for tenant ${tenantId}`, { payload });
  await engine.handle(payload);
}

// Worker pour traiter les jobs
if (connection) {
  const worker = new Worker('servicall-main', async (job: BullJob) => {
    const { type, tenantId, payload } = job.data;
    logger.info(`[BullMQ] Processing job ${job.id}`, { type, tenantId });
    
    switch (type as JobType) {
      case 'SEND_CAMPAIGN': return await processCampaign(tenantId, payload);
      case 'PROCESS_IA_BULK': return await processAIBulk(tenantId, payload);
      case 'EXPORT_DATA': return await processExport(tenantId, payload);
      case 'CLEANUP_SYSTEM': return await processCleanup(payload);
      case 'WEBHOOK_PROCESS': return await processWebhook(payload);
      case 'WORKFLOW_EXECUTE': return await processWorkflow(tenantId, payload);
      default: throw new Error(`Unknown job type: ${type}`);
    }
  }, { 
    connection,
    concurrency: 5,
    limiter: { max: 10, duration: 1000 } // 10 jobs/sec max
  });

  worker.on('failed', async (job, err) => {
    logger.error(`[BullMQ] Job ${job?.id} failed`, { error: err.message, type: job?.data.type });
    
    if (job) {
      try {
        const db = getDbInstance();
        await db.insert(failedJobs).values({
          jobId: job.id ?? 'unknown',
          queueName: 'servicall-main',
          payload: job.data,
          error: err.message,
          retryCount: job.attemptsMade,
          lastAttempt: new Date(),
        });
        logger.info(`[DLQ] Job ${job.id} stored in failed_jobs table`);
      } catch (dbErr) {
        logger.error(`[DLQ] Failed to store failed job in DB`, { error: (dbErr as Error).message });
      }
    }
  });
}

// API publique
export const jobQueue = {
  async enqueue(type: JobType, tenantId: number, payload: unknown, options?: { delay?: number; priority?: number }): Promise<string> {
    if (!mainQueue) {
      logger.warn('[JobQueue] Redis not available, job dropped', { type });
      return 'no-redis';
    }
    const job = await mainQueue.add(type, { type, tenantId, payload }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 500,
      ...options,
    });
    return job.id ?? 'unknown';
  },
  
  async getQueueStats() {
    if (!mainQueue) return null;
    const [waiting, active, completed, failed] = await Promise.all([
      mainQueue.getWaitingCount(),
      mainQueue.getActiveCount(),
      mainQueue.getCompletedCount(),
      mainQueue.getFailedCount(),
    ]);
    return { waiting, active, completed, failed };
  },

  async retryJob(failedJobId: number) {
    const db = getDbInstance();
    const { eq } = await import('drizzle-orm');
    
    const [failedJob] = await db.select().from(failedJobs).where(eq(failedJobs.id, failedJobId)).limit(1);
    
    if (!failedJob) {
      throw new Error(`Failed job with ID ${failedJobId} not found`);
    }

    logger.info(`[DLQ] Retrying job ${failedJob.jobId} from DB`);
    
    // Ré-enfiler le job
    await this.enqueue(
      failedJob.payload.type as JobType,
      failedJob.payload.tenantId,
      failedJob.payload.payload
    );

    // Supprimer de la table des échecs après ré-essai réussi
    await db.delete(failedJobs).where(eq(failedJobs.id, failedJobId));
    
    return { success: true, jobId: failedJob.jobId };
  },

  async getFailedJobs(limit = 50) {
    const db = getDbInstance();
    const { desc } = await import('drizzle-orm');
    return await db.select().from(failedJobs).orderBy(desc(failedJobs.createdAt)).limit(limit);
  }
};

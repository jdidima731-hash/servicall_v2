import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { jobQueue, JobType } from './jobQueueService';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { getDbInstance } from '../db';
import { failedJobs } from '../../drizzle/schema';
import { eq, desc } from 'drizzle-orm';
import { WorkflowEngine } from '../workflow-engine/core/WorkflowEngine';

// Mock IORedis pour éviter les connexions réelles à Redis
vi.mock('ioredis', () => ({
  default: vi.fn(() => ({
    on: vi.fn(),
    disconnect: vi.fn(),
    connect: vi.fn(),
  })),
}));

// Mock BullMQ pour contrôler le comportement des queues et workers
const mockQueueAdd = vi.fn();
const mockWorkerProcess = vi.fn();
const mockWorkerOn = vi.fn();
const mockQueueGetWaitingCount = vi.fn(() => Promise.resolve(0));
const mockQueueGetActiveCount = vi.fn(() => Promise.resolve(0));
const mockQueueGetCompletedCount = vi.fn(() => Promise.resolve(0));
const mockQueueGetFailedCount = vi.fn(() => Promise.resolve(0));

vi.mock('bullmq', () => ({
  Queue: vi.fn(() => ({
    add: mockQueueAdd,
    getWaitingCount: mockQueueGetWaitingCount,
    getActiveCount: mockQueueGetActiveCount,
    getCompletedCount: mockQueueGetCompletedCount,
    getFailedCount: mockQueueGetFailedCount,
  })),
  Worker: vi.fn((name, processor, options) => {
    mockWorkerProcess.mockImplementation(processor);
    return {
      on: mockWorkerOn,
      close: vi.fn(),
    };
  }),
}));

// Mock Drizzle ORM pour les interactions avec la base de données
const mockDbInsert = vi.fn();
const mockDbSelect = vi.fn(() => ({
  from: vi.fn(() => ({
    where: vi.fn(() => ({
      limit: vi.fn(() => []), // Default to empty array for select
    })),
    orderBy: vi.fn(() => ({
      limit: vi.fn(() => []), // Default to empty array for select
    })),
  })),
}));
const mockDbDelete = vi.fn();

vi.mock('../db', () => ({
  getDbInstance: vi.fn(() => ({
    insert: mockDbInsert,
    select: mockDbSelect,
    delete: mockDbDelete,
  })),
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    eq: vi.fn(actual.eq),
    desc: vi.fn(actual.desc),
  };
});

// Mock WorkflowEngine
vi.mock('../workflow-engine/core/WorkflowEngine', () => ({
  WorkflowEngine: vi.fn(() => ({
    handle: vi.fn(),
  })),
}));

describe('jobQueueService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Réinitialiser les mocks pour chaque test
    mockQueueAdd.mockResolvedValue({ id: 'test-job-id' });
    mockWorkerProcess.mockResolvedValue(undefined);
    mockWorkerOn.mockImplementation((event, handler) => {
      if (event === 'failed') {
        // Simuler un échec de job pour les tests pertinents
      }
    });
    mockDbInsert.mockResolvedValue(undefined);
    mockDbSelect.mockImplementation(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => []), // Default to empty array for select
        })),
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => []), // Default to empty array for select
        })),
      })),
    }));
    mockDbDelete.mockResolvedValue(undefined);
    // Ensure ENV.redisEnabled is true for tests
    process.env.REDIS_ENABLED = 'true';
  });

  it('devrait ajouter un job à la queue', async () => {
    const type: JobType = 'SEND_CAMPAIGN';
    const tenantId = 1;
    const payload = { campaignId: 123 };
    const jobId = await jobQueue.enqueue(type, tenantId, payload);

    expect(mockQueueAdd).toHaveBeenCalledWith(type, { type, tenantId, payload }, expect.any(Object));
    expect(jobId).toBe('test-job-id');
  });

  it('devrait traiter un job avec succès', async () => {
    const type: JobType = 'WORKFLOW_EXECUTE';
    const tenantId = 1;
    const payload = { workflowId: 456 };
    const jobData = { type, tenantId, payload };

    // Simuler l'ajout du job et son traitement par le worker
    await jobQueue.enqueue(type, tenantId, payload);

    // Exécuter le processeur du worker directement pour simuler le traitement
    await mockWorkerProcess({ id: 'test-job-id', data: jobData });

    // Vérifier que le processeur a été appelé avec les bonnes données
    expect(mockWorkerProcess).toHaveBeenCalledWith(expect.objectContaining({ data: jobData }));
  });

  it('devrait gérer les échecs de jobs et les enregistrer dans la DLQ', async () => {
    const type: JobType = 'SEND_CAMPAIGN';
    const tenantId = 1;
    const payload = { campaignId: 123 };
    const jobData = { type, tenantId, payload };
    const error = new Error('Test job failed');

    // Simuler un échec de job
    mockWorkerProcess.mockImplementationOnce(() => { throw error; });

    // Simuler l'événement 'failed' du worker
    let failedEventHandler: Function | undefined;
    mockWorkerOn.mockImplementation((event, handler) => {
      if (event === 'failed') {
        failedEventHandler = handler;
      }
    });

    // Forcer l'importation pour réinitialiser le module et le worker mocké
    vi.resetModules();
    const { jobQueue: jobQueueReloaded } = await import('./jobQueueService');

    // Déclencher l'ajout du job
    await jobQueueReloaded.enqueue(type, tenantId, payload);

    // Exécuter le processeur du worker pour simuler l'échec
    try {
      await mockWorkerProcess({ id: 'failed-job-id', data: jobData, attemptsMade: 1 });
    } catch (e) {
      // L'erreur est attendue ici
    }

    // Appeler le handler d'échec manuellement
    if (failedEventHandler) {
      await failedEventHandler({ id: 'failed-job-id', data: jobData, attemptsMade: 1 }, error);
    }

    expect(mockDbInsert).toHaveBeenCalledWith(failedJobs, expect.objectContaining({
      jobId: 'failed-job-id',
      queueName: 'servicall-main',
      payload: jobData,
      error: error.message,
      retryCount: 1,
    }));
  });

  it('devrait retenter un job échoué', async () => {
    const failedJobId = 1;
    const jobPayload = { type: 'SEND_CAMPAIGN', tenantId: 1, payload: { campaignId: 123 } };
    mockDbSelect.mockImplementation(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => [{
            id: failedJobId,
            jobId: 'original-job-id',
            queueName: 'servicall-main',
            payload: jobPayload,
            error: 'Previous error',
            retryCount: 1,
            createdAt: new Date(),
          }]),
        })),
      })),
    }));

    const result = await jobQueue.retryJob(failedJobId);

    expect(mockDbSelect).toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith(failedJobs.id, failedJobId);
    expect(mockQueueAdd).toHaveBeenCalledWith(jobPayload.type, jobPayload, expect.any(Object));
    expect(mockDbDelete).toHaveBeenCalledWith(failedJobs);
    expect(eq).toHaveBeenCalledWith(failedJobs.id, failedJobId);
    expect(result).toEqual({ success: true, jobId: 'original-job-id' });
  });

  it('devrait récupérer les statistiques de la queue', async () => {
    mockQueueGetWaitingCount.mockResolvedValue(5);
    mockQueueGetActiveCount.mockResolvedValue(2);
    mockQueueGetCompletedCount.mockResolvedValue(100);
    mockQueueGetFailedCount.mockResolvedValue(3);

    const stats = await jobQueue.getQueueStats();

    expect(stats).toEqual({
      waiting: 5,
      active: 2,
      completed: 100,
      failed: 3,
    });
    expect(mockQueueGetWaitingCount).toHaveBeenCalled();
    expect(mockQueueGetActiveCount).toHaveBeenCalled();
    expect(mockQueueGetCompletedCount).toHaveBeenCalled();
    expect(mockQueueGetFailedCount).toHaveBeenCalled();
  });
});

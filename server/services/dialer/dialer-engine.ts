import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { db } from "../../infrastructure/db";
import { campaignProspects, calls } from "../../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { TwilioService } from "../twilio/twilio-service";

export interface DialerConfig {
  pacingRatio: number; // Nombre d'appels par agent
  maxAttempts: number;
  retryDelaySeconds: number;
  maxConcurrentCalls: number;
}

export interface CallJob {
  campaignId: number;
  prospectId: number;
  tenantId: number;
  phoneNumber: string;
  prospectName: string;
  attemptNumber: number;
}

export class DialerEngine {
  private callQueue: Queue<CallJob>;
  private worker: Worker<CallJob> | null = null;
  private redis: Redis;
  private twilioService: TwilioService;

  constructor(redisUrl: string, twilioService: TwilioService) {
    this.redis = new Redis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: false });
    this.twilioService = twilioService;

    this.callQueue = new Queue<CallJob>("predictive-dialer", {
      connection: this.redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
        removeOnComplete: true,
      },
    });
  }

  /**
   * Initialiser le moteur de dialer
   */
  async initialize(): Promise<void> {
    console.log("🚀 Initializing Dialer Engine...");

    this.worker = new Worker<CallJob>("predictive-dialer", this.processCall.bind(this), {
      connection: this.redis,
      concurrency: 5, // Max 5 appels simultanés
    });

    this.worker.on("completed", (job) => {
      console.log(`✅ Call completed: ${job.id}`);
    });

    this.worker.on("failed", (job, err) => {
      console.error(`❌ Call failed: ${job?.id} - ${err.message}`);
    });
  }

  /**
   * Démarrer une campagne
   */
  async startCampaign(campaignId: number, config: DialerConfig): Promise<void> {
    console.log(`📞 Starting campaign ${campaignId}`);

    // Récupérer tous les prospects de la campagne
    const prospects = await db
      .select()
      .from(campaignProspects)
      .where(eq(campaignProspects.campaignId, campaignId));

    // Ajouter les appels à la queue
    for (const prospect of prospects) {
      const prospectData = await db
        .select()
        .from(prospects as any)
        .where(eq((prospects as any).id, prospect.prospectId));

      if (prospectData.length > 0) {
        const job: CallJob = {
          campaignId,
          prospectId: prospect.prospectId,
          tenantId: prospect.campaignId, // À adapter selon votre schéma
          phoneNumber: prospectData[0].phone,
          prospectName: `${prospectData[0].firstName} ${prospectData[0].lastName}`,
          attemptNumber: 1,
        };

        await this.callQueue.add(job, {
          delay: Math.random() * 5000, // Délai aléatoire pour respecter le pacing
        });
      }
    }

    console.log(`✅ Campaign ${campaignId} queued with ${prospects.length} calls`);
  }

  /**
   * Traiter un appel
   */
  private async processCall(job: any): Promise<void> {
    const { campaignId, prospectId, phoneNumber, prospectName, attemptNumber } = job.data as CallJob;

    console.log(`📞 Processing call to ${prospectName} (${phoneNumber})`);

    try {
      // Créer un enregistrement d'appel
      const callRecord = await db.insert(calls).values({
        campaignId,
        prospectId,
        status: "scheduled",
        toNumber: phoneNumber,
        fromNumber: "YOUR_TWILIO_NUMBER", // À configurer
        callType: "outbound",
        direction: "outbound",
      });

      // Appeler via Twilio
      const callSid = await this.twilioService.makeCall(phoneNumber, "Bonjour, ceci est un appel de Servicall");

      // Mettre à jour l'enregistrement d'appel
      await db
        .update(calls)
        .set({
          callSid,
          status: "in_progress",
          startedAt: new Date(),
        })
        .where(eq(calls.id, callRecord[0].id));

      // Mettre à jour le statut du prospect dans la campagne
      await db
        .update(campaignProspects)
        .set({
          status: "dialing",
          lastAttemptAt: new Date(),
          callAttempts: attemptNumber,
        })
        .where(and(eq(campaignProspects.campaignId, campaignId), eq(campaignProspects.prospectId, prospectId)));

      console.log(`✅ Call initiated: ${callSid}`);
    } catch (error) {
      console.error(`❌ Error processing call: ${error}`);

      // Mettre à jour le statut en cas d'erreur
      if (attemptNumber < 3) {
        // Réessayer jusqu'à 3 fois
        await this.callQueue.add(
          {
            campaignId,
            prospectId,
            phoneNumber,
            prospectName,
            attemptNumber: attemptNumber + 1,
          } as CallJob,
          {
            delay: 300000, // Attendre 5 minutes avant de réessayer
          }
        );
      } else {
        // Marquer comme échoué après 3 tentatives
        await db
          .update(campaignProspects)
          .set({
            status: "failed",
          })
          .where(and(eq(campaignProspects.campaignId, campaignId), eq(campaignProspects.prospectId, prospectId)));
      }

      throw error;
    }
  }

  /**
   * Arrêter une campagne
   */
  async stopCampaign(campaignId: number): Promise<void> {
    console.log(`⏹️  Stopping campaign ${campaignId}`);

    // Récupérer tous les jobs de cette campagne
    const jobs = await this.callQueue.getJobs(["active", "waiting"]);
    const campaignJobs = jobs.filter((job) => job.data.campaignId === campaignId);

    // Supprimer les jobs
    for (const job of campaignJobs) {
      await job.remove();
    }

    console.log(`✅ Campaign ${campaignId} stopped`);
  }

  /**
   * Obtenir le statut d'une campagne
   */
  async getCampaignStatus(campaignId: number): Promise<any> {
    const prospects = await db
      .select()
      .from(campaignProspects)
      .where(eq(campaignProspects.campaignId, campaignId));

    const statuses = {
      pending: prospects.filter((p) => p.status === "pending").length,
      dialing: prospects.filter((p) => p.status === "dialing").length,
      completed: prospects.filter((p) => p.status === "completed").length,
      failed: prospects.filter((p) => p.status === "failed").length,
    };

    return {
      campaignId,
      total: prospects.length,
      statuses,
      queueSize: await this.callQueue.count(),
    };
  }

  /**
   * Arrêter le moteur de dialer
   */
  async shutdown(): Promise<void> {
    console.log("🛑 Shutting down Dialer Engine...");
    if (this.worker) {
      await this.worker.close();
    }
    await this.redis.quit();
  }
}

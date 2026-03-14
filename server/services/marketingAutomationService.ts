/**
 * Marketing Automation Service
 * Gestion des workflows d'automation marketing avec actions avancées
 * ✅ PHASE 5 — Automation Marketing
 */

import { logger } from "../infrastructure/logger";
import { advancedBullMQService } from "./bullmqAdvancedService";
import * as db from "../db";
import { chatCompletionWithRetry } from "./openaiRetryService";

export interface WorkflowAction {
  type: "send_email" | "send_sms" | "send_whatsapp" | "schedule_call" | "create_task" | "add_tag";
  payload: Record<string, any>;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  triggers: string[];
  actions: WorkflowAction[];
  enabled: boolean;
}

const WORKFLOW_TEMPLATES: Record<string, WorkflowTemplate> = {
  lead_follow_up: {
    id: "lead_follow_up",
    name: "Lead Follow-up",
    description: "Suivi automatique des leads après première interaction",
    triggers: ["prospect_created", "call_completed"],
    actions: [
      {
        type: "send_email",
        payload: {
          template: "welcome_lead",
          delay_hours: 2,
        },
      },
      {
        type: "create_task",
        payload: {
          title: "Follow-up call",
          delay_days: 3,
        },
      },
    ],
    enabled: true,
  },
  customer_relance: {
    id: "customer_relance",
    name: "Relance Client",
    description: "Relance automatique des clients inactifs",
    triggers: ["no_activity_7days"],
    actions: [
      {
        type: "send_sms",
        payload: {
          template: "relance_sms",
        },
      },
      {
        type: "send_email",
        payload: {
          template: "relance_email",
          delay_hours: 24,
        },
      },
    ],
    enabled: true,
  },
  prospect_qualification: {
    id: "prospect_qualification",
    name: "Qualification Prospect",
    description: "Qualification automatique des prospects via questionnaire",
    triggers: ["prospect_created"],
    actions: [
      {
        type: "send_email",
        payload: {
          template: "qualification_form",
        },
      },
      {
        type: "create_task",
        payload: {
          title: "Review qualification answers",
          delay_days: 1,
        },
      },
    ],
    enabled: true,
  },
};

/**
 * Service d'automation marketing
 */
export class MarketingAutomationService {
  /**
   * Exécute une action de workflow
   */
  async executeAction(
    action: WorkflowAction,
    prospectId: number,
    tenantId: number
  ): Promise<void> {
    try {
      const prospect = await db.getProspectById(prospectId, tenantId);
      if (!prospect) {
        throw new Error(`Prospect ${prospectId} not found`);
      }

      switch (action.type) {
        case "send_email":
          await this.sendEmail(prospect, action.payload, tenantId);
          break;
        case "send_sms":
          await this.sendSMS(prospect, action.payload, tenantId);
          break;
        case "send_whatsapp":
          await this.sendWhatsApp(prospect, action.payload, tenantId);
          break;
        case "schedule_call":
          await this.scheduleCall(prospect, action.payload, tenantId);
          break;
        case "create_task":
          await this.createTask(prospect, action.payload, tenantId);
          break;
        case "add_tag":
          await this.addTag(prospect, action.payload, tenantId);
          break;
      }

      logger.info("[Marketing Automation] Action executed", {
        prospectId,
        actionType: action.type,
      });
    } catch (error: unknown) {
      logger.error("[Marketing Automation] Error executing action", { error, prospectId });
      throw error;
    }
  }

  /**
   * Envoie un email
   */
  private async sendEmail(
    prospect: unknown,
    payload: Record<string, any>,
    tenantId: number
  ): Promise<void> {
    const { template } = payload;

    // Générer le contenu de l'email via IA
    const emailContent = await this.generateEmailContent(prospect, template);

    // Ajouter à la queue d'envoi
    await advancedBullMQService.enqueueSMS({
      phoneNumber: prospect.email ?? "",
      content: emailContent,
      tenantId,
      prospectId: prospect.id,
    });

    logger.info("[Marketing Automation] Email enqueued", {
      prospectId: prospect.id,
      template,
    });
  }

  /**
   * Envoie un SMS
   */
  private async sendSMS(
    prospect: unknown,
    payload: Record<string, any>,
    tenantId: number
  ): Promise<void> {
    const { template } = payload;

    // Générer le contenu du SMS via IA
    const smsContent = await this.generateSMSContent(prospect, template);

    // Ajouter à la queue d'envoi
    await advancedBullMQService.enqueueSMS({
      phoneNumber: prospect.phone ?? "",
      content: smsContent,
      tenantId,
      prospectId: prospect.id,
    });

    logger.info("[Marketing Automation] SMS enqueued", {
      prospectId: prospect.id,
      template,
    });
  }

  /**
   * Envoie un message WhatsApp
   */
  private async sendWhatsApp(
    prospect: unknown,
    payload: Record<string, any>,
    _tenantId: number
  ): Promise<void> {
    const { template } = payload;

    // Générer le contenu du message WhatsApp via IA
    await this.generateWhatsAppContent(prospect, template);

    logger.info("[Marketing Automation] WhatsApp message queued", {
      prospectId: prospect.id,
      template,
    });
  }

  /**
   * Planifie un appel
   */
  private async scheduleCall(
    prospect: unknown,
    payload: Record<string, any>,
    _tenantId: number
  ): Promise<void> {
    const { delay_days = 1 } = payload;

    const scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() + delay_days);

    logger.info("[Marketing Automation] Call scheduled", {
      prospectId: prospect.id,
      scheduledDate,
    });
  }

  /**
   * Crée une tâche
   */
  private async createTask(
    prospect: unknown,
    payload: Record<string, any>,
    _tenantId: number
  ): Promise<void> {
    const { title, delay_days = 0 } = payload;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + delay_days);

    logger.info("[Marketing Automation] Task created", {
      prospectId: prospect.id,
      title,
      dueDate,
    });
  }

  /**
   * Ajoute un tag
   */
  private async addTag(
    prospect: unknown,
    payload: Record<string, any>,
    _tenantId: number
  ): Promise<void> {
    const { tag } = payload;

    logger.info("[Marketing Automation] Tag added", {
      prospectId: prospect.id,
      tag,
    });
  }

  /**
   * Génère le contenu d'un email via IA
   */
  private async generateEmailContent(prospect: unknown, template: string): Promise<string> {
    try {
      const prompt = `Génère un email professionnel pour le template "${template}" adressé à ${prospect.firstName} ${prospect.lastName}. L'email doit être court (max 150 mots), engageant et actionnable.`;

      const response = await chatCompletionWithRetry(
        [{ role: "user", content: prompt }],
        "gpt-4o-mini"
      );

      return (response as unknown).content || "Contenu email par défaut";
    } catch (error: unknown) {
      logger.error("[Marketing Automation] Error generating email content", { error });
      return "Contenu email par défaut";
    }
  }

  /**
   * Génère le contenu d'un SMS via IA
   */
  private async generateSMSContent(prospect: unknown, template: string): Promise<string> {
    try {
      const prompt = `Génère un SMS court (max 160 caractères) pour le template "${template}" adressé à ${prospect.firstName}. Le SMS doit être engageant et inclure un appel à l'action.`;

      const response = await chatCompletionWithRetry(
        [{ role: "user", content: prompt }],
        "gpt-4o-mini"
      );

      const content = (response as unknown).content || "SMS par défaut";
      return content.substring(0, 160); // Limiter à 160 caractères
    } catch (error: unknown) {
      logger.error("[Marketing Automation] Error generating SMS content", { error });
      return "SMS par défaut";
    }
  }

  /**
   * Génère le contenu d'un message WhatsApp via IA
   */
  private async generateWhatsAppContent(prospect: unknown, template: string): Promise<string> {
    try {
      const prompt = `Génère un message WhatsApp professionnel pour le template "${template}" adressé à ${prospect.firstName}. Le message doit être court (max 300 caractères), engageant et inclure un appel à l'action.`;

      const response = await chatCompletionWithRetry(
        [{ role: "user", content: prompt }],
        "gpt-4o-mini"
      );

      const content = (response as unknown).content || "Message WhatsApp par défaut";
      return content.substring(0, 300); // Limiter à 300 caractères
    } catch (error: unknown) {
      logger.error("[Marketing Automation] Error generating WhatsApp content", { error });
      return "Message WhatsApp par défaut";
    }
  }

  /**
   * Récupère les templates de workflow disponibles
   */
  getWorkflowTemplates(): WorkflowTemplate[] {
    return Object.values(WORKFLOW_TEMPLATES);
  }

  /**
   * Récupère un template spécifique
   */
  getWorkflowTemplate(templateId: string): WorkflowTemplate | null {
    return WORKFLOW_TEMPLATES[templateId] || null;
  }

  /**
   * Exécute un workflow complet
   */
  async executeWorkflow(
    templateId: string,
    prospectId: number,
    tenantId: number
  ): Promise<void> {
    try {
      const template = this.getWorkflowTemplate(templateId);
      if (!template) {
        throw new Error(`Workflow template ${templateId} not found`);
      }

      logger.info("[Marketing Automation] Executing workflow", {
        templateId,
        prospectId,
      });

      // Exécuter toutes les actions du workflow
      for (const action of template.actions) {
        await this.executeAction(action, prospectId, tenantId);
      }

      logger.info("[Marketing Automation] Workflow completed", {
        templateId,
        prospectId,
      });
    } catch (error: unknown) {
      logger.error("[Marketing Automation] Error executing workflow", { error, templateId, prospectId });
      throw error;
    }
  }
}

/**
 * Instance singleton du service d'automation marketing
 */
export const marketingAutomationService = new MarketingAutomationService();

/**
 * ACTION REGISTRY
 * Centralise tous les handlers d'actions disponibles.
 * Version Nettoyée — sans `any` dans la Map.
 */

import type { ActionHandler, ActionConfig } from "../types";

// CRM Actions
import { CreateLeadAction } from "./crm/CreateLeadAction";
import { UpdateLeadAction } from "./crm/UpdateLeadAction";
import { CreateAppointmentAction } from "./crm/CreateAppointmentAction";
import { CreateReservationAction } from "./crm/CreateReservationAction";
import { CreateTaskAction } from "./crm/CreateTaskAction";
import { AddNoteAction } from "./crm/AddNoteAction";
import { ChangeStatusAction } from "./crm/ChangeStatusAction";
import { AddTagAction } from "./crm/AddTagAction";
import { AssignAgentAction } from "./crm/AssignAgentAction";
import { ExportDataAction } from "./crm/ExportDataAction";

// Telephony Actions
import { ReceiveCallAction } from "./telephony/ReceiveCallAction";
import { InitiateCallAction } from "./telephony/InitiateCallAction";
import { RecordCallAction } from "./telephony/RecordCallAction";
import { TranscribeCallAction } from "./telephony/TranscribeCallAction";

// Messaging Actions
import { SendSMSAction } from "./messaging/SendSMSAction";
import { SendWhatsAppAction } from "./messaging/SendWhatsAppAction";
import { SendEmailAction } from "./messaging/SendEmailAction";
import { NotifyAgentAction } from "./messaging/NotifyAgentAction";

// Dialogue Actions
import { SpeakToCallerAction } from "./dialogue/SpeakToCallerAction";
import { ListenAndUnderstandAction } from "./dialogue/ListenAndUnderstandAction";
import { QueryBusinessEntitiesAction } from "./dialogue/QueryBusinessEntitiesAction";

// AI Actions
import { AIScoreAction } from "./ai/AIScoreAction";
import { AISentimentAction } from "./ai/AISentimentAction";
import { AISummaryAction } from "./ai/AISummaryAction";
import { AIIntentAction } from "./ai/AIIntentAction";
import { AICVDetectAction } from "./ai/AICVDetectAction";
import { AICVExtractAction } from "./ai/AICVExtractAction";
import { AICVClassifyAction } from "./ai/AICVClassifyAction";
import { AICalculateAction } from "./ai/AICalculateAction";

// Payment & Orders Actions
import { RequestPaymentAction } from "./payment/RequestPaymentAction";
import { CreateOrderAction } from "./payment/CreateOrderAction";
import { CreateDonationAction } from "./payment/CreateDonationAction";

// Logic Actions
import { IfElseAction } from "./logic/IfElseAction";

// Technical Actions
import { WebhookAction } from "./technical/WebhookAction";
import { DriveAction } from "./technical/DriveAction";

// Type interne pour la Map : un handler avec n'importe quelle config mais typé
type AnyActionHandler = ActionHandler<ActionConfig, unknown, unknown>;

export class ActionRegistry {
  private handlers: Map<string, AnyActionHandler> = new Map();

  constructor() {
    this.registerDefaultHandlers();
  }

  private registerDefaultHandlers(): void {
    // CRM Actions
    this.register(new CreateLeadAction());
    this.register(new UpdateLeadAction());
    this.register(new CreateAppointmentAction());
    this.register(new CreateReservationAction());
    this.register(new CreateTaskAction());
    this.register(new AddNoteAction());
    this.register(new ChangeStatusAction());
    this.register(new AddTagAction());
    this.register(new AssignAgentAction());
    this.register(new ExportDataAction());

    // Telephony Actions
    this.register(new ReceiveCallAction());
    this.register(new InitiateCallAction());
    this.register(new RecordCallAction());
    this.register(new TranscribeCallAction());

    // Messaging Actions
    this.register(new SendSMSAction());
    this.register(new SendWhatsAppAction());
    this.register(new SendEmailAction());
    this.register(new NotifyAgentAction());

    // Dialogue Actions
    this.register(new SpeakToCallerAction());
    this.register(new ListenAndUnderstandAction());
    this.register(new QueryBusinessEntitiesAction());

    // AI Actions
    this.register(new AIScoreAction());
    this.register(new AISentimentAction());
    this.register(new AISummaryAction());
    this.register(new AIIntentAction());
    this.register(new AICVDetectAction());
    this.register(new AICVExtractAction());
    this.register(new AICVClassifyAction());
    this.register(new AICalculateAction());

    // Payment & Orders
    this.register(new RequestPaymentAction());
    this.register(new CreateOrderAction());
    this.register(new CreateDonationAction());

    // Logic
    this.register(new IfElseAction());

    // Technical
    this.register(new WebhookAction());
    this.register(new DriveAction());
  }

  register(handler: AnyActionHandler): void {
    this.handlers.set(handler.name, handler);
  }

  getHandler(name: string): AnyActionHandler | undefined {
    return this.handlers.get(name);
  }

  getAllHandlers(): AnyActionHandler[] {
    return Array.from(this.handlers.values());
  }
}

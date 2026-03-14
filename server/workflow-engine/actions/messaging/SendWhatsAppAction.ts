/**
 * SEND WHATSAPP ACTION
 * Envoie un message WhatsApp via Twilio
 */

import { z } from "zod";
import type { ActionHandler, ActionResult } from "../../types";
import type { FinalExecutionContext } from "../../structured-types";
import { Logger } from "../../utils/Logger";
import twilio from "twilio";
import { ENV } from "../../_core/env";

// Configuration structurée
const SendWhatsAppConfigSchema = z.object({
  to: z.string().optional(),
  from: z.string().optional(),
  message: z.string().optional(),
  body: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).refine(data => data.message || data.body, {
  message: "Le champ 'message' ou 'body' est obligatoire",
});
type SendWhatsAppConfig = z.infer<typeof SendWhatsAppConfigSchema>;

// Résultat structuré
interface SendWhatsAppResult {
  to: string;
  from: string;
  body: string;
  tenant_id: number;
  sent_at: Date;
  status: 'sent';
  metadata: Record<string, unknown>;
}

export class SendWhatsAppAction implements ActionHandler<SendWhatsAppConfig, FinalExecutionContext, SendWhatsAppResult> {
  name = 'send_whatsapp';
  private logger = new Logger('SendWhatsAppAction');

  async execute(
    context: FinalExecutionContext,
    config: SendWhatsAppConfig
  ): Promise<ActionResult<SendWhatsAppResult>> {
    try {
      const rawTo =
        config.to ??
        context.variables.phone ??
        context.variables.caller_phone ??
        context.event.source;

      if (!rawTo) {
        throw new Error('No destination phone number provided for WhatsApp');
      }

      const whatsappNumber = rawTo.startsWith('whatsapp:') ? rawTo : `whatsapp:${rawTo}`;
      const message = config.message ?? config.body ?? 'Message automatique';
      const fromNumber = config.from ?? `whatsapp:${context.tenant.phoneNumber ?? ''}`;

      if (!ENV.twilioAccountSid || !ENV.twilioAuthToken || !ENV.twilioPhoneNumber) {
        throw new Error("Twilio credentials or phone number not configured for WhatsApp.");
      }

      const client = twilio(ENV.twilioAccountSid, ENV.twilioAuthToken);

      await client.messages.create({
        body: message,
        to: whatsappNumber,
        from: `whatsapp:${ENV.twilioPhoneNumber}`,
      });

      const whatsappData: SendWhatsAppResult = {
        to: whatsappNumber,
        from: fromNumber,
        body: message,
        tenant_id: context.tenant.id,
        sent_at: new Date(),
        status: 'sent',
        metadata: {
          workflow_id: context.workflow.id,
          workflow_execution_id: context.event.id,
          ...(config.metadata ?? {}),
        }
      };

      this.logger.info('WhatsApp message sent successfully via Twilio', {
        to: whatsappData.to,
        tenant: context.tenant.id
      });

      context.variables['whatsapp_sent'] = whatsappData;

      return { success: true, data: whatsappData };
    } catch (error: unknown) {
      this.logger.error('Failed to send WhatsApp message', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  validate(config: Record<string, unknown>): boolean {
    const result = SendWhatsAppConfigSchema.safeParse(config);
    if (!result.success) {
      this.logger.error('Validation failed', { errors: result.error.format() });
      return false;
    }
    return true;
  }
}

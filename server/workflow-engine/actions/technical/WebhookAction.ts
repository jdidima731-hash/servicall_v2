/**
 * WEBHOOK ACTION - VERSION OPTIMISÉE
 * Envoie les données du contexte vers un service tiers.
 * ✅ BLOC 3 & 5 : Validation stricte et traçabilité.
 */

import { z } from "zod";
import type { ActionHandler, ActionResult } from "../../types";
import type { FinalExecutionContext } from "../../structured-types";
import { Logger } from "../../utils/Logger";
import axios from "axios";

// Configuration structurée
const WebhookConfigSchema = z.object({
  url: z.string().url("L'URL du webhook est invalide"),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional(),
  headers: z.record(z.string(), z.string()).optional(),
});
type WebhookConfig = z.infer<typeof WebhookConfigSchema>;

// Résultat structuré
interface WebhookResult {
  webhook_status: 'sent';
  status_code: number;
  target_url: string;
  sent_at: string;
  response: unknown;
}

export class WebhookAction implements ActionHandler<WebhookConfig, FinalExecutionContext, WebhookResult> {
  name = 'tech_webhook';
  private logger = new Logger('WebhookAction');

  async execute(
    context: FinalExecutionContext,
    config: WebhookConfig
  ): Promise<ActionResult<WebhookResult>> {
    try {
      const { url, method = 'POST', headers = {} } = config;

      this.logger.info('Triggering Webhook', {
        url,
        method,
        workflow_id: context.workflow.id,
        event_id: context.event.id
      });

      const payload = {
        event: {
          id: context.event.id,
          channel: context.event.channel,
          source: context.event.source
        },
        variables: context.variables,
        tenant_slug: context.tenant.slug,
        timestamp: new Date().toISOString()
      };

      const response = await axios({
        url,
        method,
        data: payload,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        timeout: 10000
      });

      this.logger.info('Webhook executed successfully', { status: response.status });

      return {
        success: true,
        data: {
          webhook_status: 'sent',
          status_code: response.status,
          target_url: url,
          sent_at: new Date().toISOString(),
          response: response.data
        }
      };
    } catch (error: unknown) {
      this.logger.error('Webhook execution failed', { error });
      return { success: false, error: String(error) };
    }
  }

  /**
   * ✅ BLOC 3 : VALIDATION ROBUSTE
   */
  validate(config: Record<string, unknown>): boolean {
    const urlValue = config['url'];
    if (typeof urlValue !== 'string' || !urlValue) {
      this.logger.error('Validation failed: Missing URL');
      return false;
    }

    try {
      const parsedUrl = new URL(urlValue);
      const forbiddenHosts = ['localhost', '127.0.0.1', '0.0.0.0'];
      if (forbiddenHosts.includes(parsedUrl.hostname)) return false;
      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch {
      this.logger.error('Validation failed: Invalid URL format');
      return false;
    }
  }
}

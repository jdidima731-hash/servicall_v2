/**
 * REQUEST PAYMENT ACTION - HARDENED
 * Crée une demande de paiement avec idempotence et audit.
 */

import { z } from "zod";
import type { ActionHandler, ActionResult } from "../../types";
import type { FinalExecutionContext } from "../../structured-types";
import { Logger } from "../../utils/Logger";
import { IdempotencyService } from "../../utils/IdempotencyService";
import { AuditService } from "../../../services/auditService";

// Configuration structurée
const RequestPaymentConfigSchema = z.object({
  amount: z.number().positive("Le montant doit être positif"),
  currency: z.string().optional(),
  description: z.string().optional(),
  customer_email: z.string().email().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
type RequestPaymentConfig = z.infer<typeof RequestPaymentConfigSchema>;

// Résultat structuré
interface RequestPaymentResult {
  tenant_id: number;
  prospect_id: number | undefined;
  amount: number;
  currency: string;
  description: string;
  customer_email: string | undefined;
  status: 'pending';
  payment_url: string;
  created_at: Date;
  metadata: Record<string, unknown>;
  skipped?: boolean;
}

export class RequestPaymentAction implements ActionHandler<RequestPaymentConfig, FinalExecutionContext, RequestPaymentResult> {
  name = 'request_payment';
  private logger = new Logger('RequestPaymentAction');

  async execute(
    context: FinalExecutionContext,
    config: RequestPaymentConfig
  ): Promise<ActionResult<RequestPaymentResult>> {
    try {
      const { amount, currency = 'EUR', description = 'Paiement ServiceCall' } = config;
      const customerEmail =
        config.customer_email ??
        context.variables.email ??
        context.variables.prospect?.email;

      // 1. Idempotency Check
      const idempotencyKey = IdempotencyService.generateKey({
        amount,
        currency,
        customerEmail,
        eventId: context.event.id
      });

      const isFirstTime = await IdempotencyService.checkAndSet(idempotencyKey, 'request_payment');
      if (!isFirstTime) {
        this.logger.info('Duplicate request_payment detected, skipping', { customerEmail });
        return {
          success: true,
          data: {
            skipped: true,
            tenant_id: context.tenant.id,
            prospect_id: undefined,
            amount,
            currency,
            description,
            customer_email: customerEmail,
            status: 'pending',
            payment_url: '',
            created_at: new Date(),
            metadata: {}
          }
        };
      }

      // 2. Data Preparation
      const paymentData: RequestPaymentResult = {
        tenant_id: context.tenant.id,
        prospect_id: context.variables.prospect?.id,
        amount,
        currency,
        description,
        customer_email: customerEmail,
        status: 'pending',
        payment_url: `https://pay.servicall.com/checkout/${Date.now()}`,
        created_at: new Date(),
        metadata: {
          workflow_id: context.workflow.id,
          workflow_execution_id: context.event.id,
          ...(config.metadata ?? {}),
        }
      };

      // 3. Audit Logging
      await AuditService.log({
        tenantId: context.tenant.id,
        userId: Number(context.event.metadata?.triggered_by) || 0,
        action: "INVOICE_CREATE",
        resource: "payment_request",
        resourceId: context.event.id,
        actorType: "system",
        source: "SYSTEM",
        metadata: { amount, currency, customerEmail, description }
      });

      context.variables['payment'] = paymentData;
      context.variables['payment_url'] = paymentData.payment_url;

      this.logger.info('Payment request created', {
        amount: paymentData.amount,
        tenant: context.tenant.id
      });

      return { success: true, data: paymentData };
    } catch (error: unknown) {
      this.logger.error('Failed to create payment request', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  validate(config: Record<string, unknown>): boolean {
    const result = RequestPaymentConfigSchema.safeParse(config);
    if (!result.success) {
      this.logger.error('Validation failed', { errors: result.error.format() });
      return false;
    }
    return true;
  }
}

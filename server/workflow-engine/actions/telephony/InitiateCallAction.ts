/**
 * INITIATE CALL ACTION
 * Gère le déclenchement d'un appel sortant (CALL_OUT)
 */

import { z } from "zod";
import type { ActionHandler, ActionResult } from "../../types";
import type { FinalExecutionContext } from "../../structured-types";
import { Logger } from "../../utils/Logger";

// Configuration structurée
const InitiateCallConfigSchema = z.object({
  to: z.string().optional(),
  from: z.string().optional(),
  reason: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
type InitiateCallConfig = z.infer<typeof InitiateCallConfigSchema>;

// Résultat structuré
interface InitiateCallResult {
  call_sid: string;
  from: string;
  to: string;
  direction: 'outbound';
  status: 'initiated';
  tenant_id: number;
  initiated_at: Date;
  metadata: Record<string, unknown>;
}

export class InitiateCallAction implements ActionHandler<InitiateCallConfig, FinalExecutionContext, InitiateCallResult> {
  name = 'initiate_call';
  private logger = new Logger('InitiateCallAction');

  async execute(
    context: FinalExecutionContext,
    config: InitiateCallConfig
  ): Promise<ActionResult<InitiateCallResult>> {
    try {
      const toNumber = config.to ?? context.variables.phone ?? context.variables.caller_phone;
      const fromNumber = config.from ?? context.tenant.phoneNumber ?? "";

      if (!toNumber) {
        throw new Error('No destination phone number provided');
      }

      const callData: InitiateCallResult = {
        call_sid: `call_out_${Date.now()}`,
        from: fromNumber,
        to: toNumber,
        direction: 'outbound',
        status: 'initiated',
        tenant_id: context.tenant.id,
        initiated_at: new Date(),
        metadata: {
          workflow_id: context.workflow.id,
          reason: config.reason ?? 'workflow_triggered',
          ...(config.metadata ?? {}),
        }
      };

      // Stocker les informations de l'appel dans le contexte structuré
      context.variables.call = { call_sid: callData.call_sid };
      context.variables['outbound_call_sid'] = callData.call_sid;

      this.logger.info('Call initiated', {
        from: callData.from,
        to: callData.to,
        tenant: context.tenant.id,
        reason: callData.metadata['reason']
      });

      return { success: true, data: callData };
    } catch (error: unknown) {
      this.logger.error('Failed to initiate call', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  validate(_config: Record<string, unknown>): boolean {
    return true;
  }
}

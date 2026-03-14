/**
 * CREATE DONATION ACTION
 * Crée une demande de don pour les associations et ONG
 */

import { ActionHandler, ActionResult, ExecutionContext, ActionConfig, CommonExecutionVariables } from "../../types";
import { Logger } from "../../utils/Logger";

export class CreateDonationAction implements ActionHandler<ActionConfig, ExecutionContext<CommonExecutionVariables>> {
  name = 'create_donation';
  private logger = new Logger('CreateDonationAction');

  async execute(context: ExecutionContext<CommonExecutionVariables>, config: ActionConfig): Promise<ActionResult<unknown>> {
    try {
      const prospectId = config["prospect_id"] || context.variables.prospect?.id;
      const amount = config["amount"];
      const donorName = config["donor_name"] || context.variables.prospect?.firstName;
      const donorEmail = config["donor_email"] || context.variables.email || context.variables.prospect?.email;
      const donorPhone = config["donor_phone"] || context.variables.phone || context.variables.caller_phone;

      const donationData = {
        tenant_id: context.tenant.id,
        prospect_id: prospectId,
        donation_id: `DON-${Date.now()}`,
        donor_name: donorName,
        donor_email: donorEmail,
        donor_phone: donorPhone,
        amount: amount ?? 0,
        currency: (config["currency"] as string | undefined) || 'EUR',
        campaign: (config["campaign"] as string | undefined) || 'general',
        is_recurring: config["is_recurring"] || false,
        frequency: (config["frequency"] as string | undefined) || 'one_time', // one_time, monthly, yearly
        status: (config["status"] as string | undefined) || 'pledged',
        payment_status: 'pending',
        tax_receipt_requested: config["tax_receipt"] || true,
        created_at: new Date(),
        metadata: {
          workflow_id: context.workflow.id,
          workflow_execution_id: context.event.id,
          source: 'phone_campaign',
          ...config["metadata"] as Record<string, unknown>
        }
      };

      // Stocker le don dans le contexte
      context.variables["donation"] = donationData;
      context.variables["donation_id"] = donationData.donation_id;
      context.variables["donation_amount"] = donationData.amount;

      this.logger.info('Donation created', { 
        donation_id: donationData.donation_id,
        amount: donationData.amount,
        donor: donorName,
        campaign: donationData.campaign,
        tenant: context.tenant.id 
      });

      // TODO: Sauvegarder le don en base de données
      // await donationService.createDonation(donationData);

      return {
        success: true,
        data: donationData
      };

    } catch (error: unknown) {
      this.logger.error('Failed to create donation', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  validate(_config: ActionConfig): boolean {
    return true; // Le montant peut être 0 pour une promesse de don
  }
}

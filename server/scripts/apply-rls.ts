import { dbManager } from "../services/dbManager";
import { logger } from "../infrastructure/logger";

const tablesWithTenantId = [
  'rgpd_consents', 'call_execution_metrics', 'call_scoring', 'customer_invoices', 'command_validations',
  'predictive_scores', 'campaigns', 'coaching_feedback', 'simulated_calls', 'encryption_keys',
  'compliance_logs', 'compliance_alerts', 'usage_metrics', 'documents', 'appointment_reminders',
  'properties', 'visits', 'deals', 'tenant_industry_config', 'tenant_ai_keys', 'workflow_templates',
  'audit_ai_usage', 'message_templates', 'messages', 'ai_suggestions',
  'prospects', 'calls', 'appointments', 'workflows', 'workflow_steps'
];

async function applyRLS() {
  logger.info("[RLS] Starting RLS application...");

  try {
    const client = dbManager.client;
    if (!client) {
      throw new Error("Database client not initialized");
    }

    for (const table of tablesWithTenantId) {
      logger.info(`[RLS] Applying RLS to table: ${table}`);
      
      await client.unsafe(`
        ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;
        ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS tenant_isolation ON ${table};
        CREATE POLICY tenant_isolation ON ${table}
          USING (
            current_setting('app.current_tenant_id', true) IS NULL 
            OR current_setting('app.current_tenant_id', true) = ''
            OR tenant_id = current_setting('app.current_tenant_id')::integer
          );

        DROP POLICY IF EXISTS tenant_insert ON ${table};
        CREATE POLICY tenant_insert ON ${table}
          FOR INSERT
          WITH CHECK (
            current_setting('app.current_tenant_id', true) IS NULL 
            OR current_setting('app.current_tenant_id', true) = ''
            OR tenant_id = current_setting('app.current_tenant_id')::integer
          );
      `);
    }

    logger.info("[RLS] ✅ RLS policies applied successfully to all tables");
    process.exit(0);
  } catch (error: unknown) {
    logger.error("[RLS] ❌ Failed to apply RLS", { error });
    process.exit(1);
  }
}

applyRLS();

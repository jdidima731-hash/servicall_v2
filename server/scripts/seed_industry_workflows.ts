/**
 * SEED INDUSTRY WORKFLOWS
 * Script pour insérer tous les templates de workflows multi-métiers en base de données
 */

import { getDb, workflows } from "../db";
import { ALL_TEMPLATES } from "../workflow-engine/templates/industryTemplates";
import { logger } from '../core/logger/index';

async function seedIndustryWorkflows() {
  logger.info('🚀 Starting industry workflows seed...');
  
  const db = await getDb();
  if (!db) {
    logger.error('❌ Database not available');
    process.exit(1);
  }

  let successCount = 0;
  let errorCount = 0;

  for (const template of ALL_TEMPLATES) {
    try {
      // Convertir le template en format de base de données
      const workflowData = {
        tenantId: 1, // Tenant par défaut - à adapter selon vos besoins
        name: template.name,
        description: template.description,
        triggerType: template.trigger_type,
        triggerConfig: {
          channel: 'call',
          event_type: template.trigger_type,
          industry: template.industry
        },
        steps: template.steps,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          industry: template.industry,
          template_version: '1.0',
          auto_generated: true,
          source: 'industry_templates'
        }
      };

      await db.insert(workflows).values(workflowData).execute();
      logger.info(`✅ Created workflow: ${template.name}`);
      successCount++;

    } catch (error: unknown) {
      logger.error(`❌ Failed to create workflow: ${template.name}`, error);
      errorCount++;
    }
  }

  logger.info('\n📊 Seed Summary:');
  logger.info(`   ✅ Success: ${successCount} workflows`);
  logger.info(`   ❌ Errors: ${errorCount} workflows`);
  logger.info(`   📦 Total templates: ${ALL_TEMPLATES.length}`);
  logger.info('\n🎉 Industry workflows seed completed!');

  process.exit(0);
}

// Exécuter le seed
seedIndustryWorkflows().catch((error) => {
  logger.error('❌ Seed failed:', error);
  process.exit(1);
});

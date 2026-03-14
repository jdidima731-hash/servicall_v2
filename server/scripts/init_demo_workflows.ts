import { AI_MODEL } from '../_core/aiModels';
/**
 * Script d'initialisation des workflows de démonstration
 * Ce script crée des workflows prêts à l'emploi pour tester le système
 */

import { getDb } from "../db";
import { workflows } from "../../drizzle/schema";
import { logger } from '../core/logger/index';

const DEMO_WORKFLOWS = [
  {
    tenantId: 1,
    name: "Accueil Client Intelligent",
    description: "Analyse automatique du sentiment client et génération d'un résumé après chaque appel",
    triggerType: "event" as const,
    triggerConfig: JSON.stringify({ event: "call_received" }),
    actions: JSON.stringify([
      { 
        id: 'action-1', 
        type: 'ai_sentiment_analysis', 
        config: { 
          model: AI_MODEL.DEFAULT,
          industry: 'generic'
        } 
      },
      { 
        id: 'action-2', 
        type: 'ai_summary', 
        config: { 
          type: 'standard',
          industry: 'generic'
        } 
      }
    ]),
    isActive: true,
  },
  {
    tenantId: 1,
    name: "Qualification Prospect Automatique",
    description: "Score automatique des nouveaux prospects et envoi d'un SMS de bienvenue",
    triggerType: "event" as const,
    triggerConfig: JSON.stringify({ event: "prospect_created" }),
    actions: JSON.stringify([
      { 
        id: 'action-1', 
        type: 'ai_score', 
        config: { 
          criteria: ['budget', 'urgency', 'fit'],
          industry: 'generic'
        } 
      },
      { 
        id: 'action-2', 
        type: 'send_sms', 
        config: { 
          message: "Merci de votre intérêt ! Notre équipe vous contactera sous 24h."
        } 
      },
      { 
        id: 'action-3', 
        type: 'create_task', 
        config: { 
          title: "Contacter le nouveau prospect",
          priority: "high"
        } 
      }
    ]),
    isActive: true,
  },
  {
    tenantId: 1,
    name: "Suivi Post-Appel Complet",
    description: "Workflow complet après un appel : analyse, résumé, scoring et création de tâche",
    triggerType: "event" as const,
    triggerConfig: JSON.stringify({ event: "call_completed" }),
    actions: JSON.stringify([
      { 
        id: 'action-1', 
        type: 'ai_sentiment_analysis', 
        config: { 
          model: AI_MODEL.DEFAULT,
          industry: 'generic'
        } 
      },
      { 
        id: 'action-2', 
        type: 'ai_summary', 
        config: { 
          type: 'detailed',
          industry: 'generic'
        } 
      },
      { 
        id: 'action-3', 
        type: 'ai_score', 
        config: { 
          criteria: ['interest', 'engagement', 'conversion_potential'],
          industry: 'generic'
        } 
      },
      { 
        id: 'action-4', 
        type: 'create_task', 
        config: { 
          title: "Relance client suite à l'appel",
          priority: "medium"
        } 
      }
    ]),
    isActive: true,
  },
  {
    tenantId: 1,
    name: "Rappel Rendez-vous Automatique",
    description: "Envoie un SMS de rappel 24h avant un rendez-vous planifié",
    triggerType: "scheduled" as const,
    triggerConfig: JSON.stringify({ 
      schedule: "daily",
      time: "09:00",
      checkAppointments: true 
    }),
    actions: JSON.stringify([
      { 
        id: 'action-1', 
        type: 'send_sms', 
        config: { 
          message: "Rappel : Vous avez un rendez-vous demain à {appointment_time}. À bientôt !"
        } 
      }
    ]),
    isActive: true,
  },
  {
    tenantId: 1,
    name: "Alerte Prospect Chaud",
    description: "Notifie l'équipe commerciale quand un prospect à fort potentiel est identifié",
    triggerType: "event" as const,
    triggerConfig: JSON.stringify({ event: "prospect_created" }),
    actions: JSON.stringify([
      { 
        id: 'action-1', 
        type: 'ai_score', 
        config: { 
          criteria: ['budget', 'urgency', 'fit', 'authority'],
          threshold: 75,
          industry: 'generic'
        } 
      },
      { 
        id: 'action-2', 
        type: 'send_email', 
        config: { 
          to: 'commercial@entreprise.com',
          subject: '🔥 Nouveau prospect à fort potentiel',
          template: 'hot_lead_alert'
        } 
      },
      { 
        id: 'action-3', 
        type: 'assign_prospect', 
        config: { 
          assignTo: 'best_available',
          priority: 'high'
        } 
      }
    ]),
    isActive: true,
  }
];

async function initDemoWorkflows() {
  logger.info('🚀 Initialisation des workflows de démonstration...');
  
  const db = await getDb();
  if (!db) {
    logger.error('❌ Base de données non disponible');
    return;
  }

  try {
    // Supprimer les workflows existants du tenant 1 (optionnel)
    // await db.delete(workflows).where(eq(workflows.tenantId, 1));
    
    // Insérer les workflows de démonstration
    for (const workflow of DEMO_WORKFLOWS) {
      await db.insert(workflows).values({
        ...workflow,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      logger.info(`✅ Workflow créé: ${workflow.name}`);
    }
    
    logger.info('🎉 Tous les workflows de démonstration ont été créés avec succès !');
  } catch (error: unknown) {
    logger.error('❌ Erreur lors de la création des workflows:', error);
  }
}

// Exécuter le script
initDemoWorkflows().catch(console.error);

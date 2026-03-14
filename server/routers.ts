import { router } from "./_core/trpc";

// Core & Auth
import { systemRouter } from "./_core/systemRouter";
import { authRouter } from "./routers/authRouter";
import { userRouter } from "./routers/userRouter";
import { tenantRouter } from "./routers/tenantRouter";
import { securityRouter } from "./routers/securityRouter";

// Communication & Telephony
import { phoneRouter } from "./routers/phoneRouter";
import { softphoneRouter } from "./routers/softphoneRouter";
import { callsRouter } from "./routers/callsRouter";
import { emailConfigRouter } from "./routers/emailConfigRouter";
import { callsTwilioRouter } from "./routers/callsRouter-twilio";
import { twilioRouter } from "./routers/twilioRouter";
import { recordingRouter } from "./routers/recordingRouter";

// Business Modules
import { prospectRouter } from "./routers/prospectRouter";
import { campaignRouter } from "./routers/campaignRouter";
import { appointmentRouter } from "./routers/appointmentRouter";
import { appointmentReminderRouter } from "./routers/appointmentReminderRouter";
import { realEstateRouter } from "./routers/realEstateRouter";
import { businessEntitiesRouter } from "./routers/businessEntitiesRouter";
import { posRouter } from "./routers/posRouter";
import { realTimeMonitoringRouter } from "./routers/realTimeMonitoringRouter";

// AI & Automation
import { aiRouter } from "./routers/aiRouter";
import { dialogueRouter } from "./routers/dialogueRouter";
import { agentSwitchRouter } from "./routers/agentSwitchRouter";
import { leadScoringRouter } from "./routers/leadScoringRouter";
import { workflowRouter } from "./routers/workflowRouter";
import { workflowEngineRouter } from "./routers/workflowEngineRouter";
import { realtimeWorkflowRouter } from "./routers/realtimeWorkflowRouter";
import { industryConfigRouter } from "./routers/industryConfigRouter";
import { industryRouter } from "./routers/industryRouter";
import { callScoringRouter } from "./routers/callScoringRouter";
import { coachingRouter } from "./routers/coachingRouter";
import { recruitmentRouter } from "./routers/recruitmentRouter";
import { recruitmentEnhancedRouter } from "./routers/recruitmentEnhancedRouter";

// Billing & Legal
import { billingRouter } from "./routers/billingRouter";
import { invoiceRouter } from "./routers/invoiceRouter";
import { orderRouter } from "./routers/orderRouter";
import { paymentRouter } from "./routers/paymentRouter";
import { rgpdRouter } from "./routers/rgpdRouter";

// Data & Utils
import { dashboardRouter } from "./routers/dashboardRouter";
import { documentRouter } from "./routers/documentRouter";
import { predictiveRouter } from "./routers/predictiveRouter";
import { commandValidationRouter } from "./routers/commandValidationRouter";
import { healthRouter } from "./routers/healthRouter";
import { messagingRouter } from "./routers/messagingRouter";
import { aiSuggestionsRouter } from "./routers/aiSuggestionsRouter";
import { copilotRouter } from "./routers/copilotRouter";
import { roiRouter } from "./routers/roiRouter";
import { contactRouter } from "./routers/contactRouter";
import { socialRouter } from "./routers/socialRouter";
import { servicallV3Router } from "./routers/servicallV3Router"; // Servicall v3 — Intelligence Centrale

// Procedures re-export for backwards compatibility
import { tenantProcedure, managerProcedure, adminProcedure } from "./procedures";
export { tenantProcedure, managerProcedure, adminProcedure };

/**
 * AppRouter - Centralisation de tous les modules de l'application
 * Chaque module est isolé dans son propre fichier pour une meilleure maintenabilité.
 */
export const appRouter = router({
  // Core
  system: systemRouter,
  auth: authRouter,
  user: userRouter,
  tenant: tenantRouter,
  security: securityRouter,

  // Communication
  phone: phoneRouter,
  softphone: softphoneRouter,
  calls: callsRouter,
  emailConfig: emailConfigRouter,
  callsTwilio: callsTwilioRouter,
  twilio: twilioRouter,
  recording: recordingRouter,

  // Business
  prospect: prospectRouter,
  campaign: campaignRouter,
  appointment: appointmentRouter,
  appointmentReminder: appointmentReminderRouter,
  realEstate: realEstateRouter,
  businessEntities: businessEntitiesRouter,
  pos: posRouter,
  monitoring: realTimeMonitoringRouter,

  // AI & Automation
  ai: aiRouter,
  dialogue: dialogueRouter,
  aiSuggestions: aiSuggestionsRouter,
  copilot: copilotRouter,
  roi: roiRouter,
  agentSwitch: agentSwitchRouter,
  leadScoring: leadScoringRouter,
  workflow: workflowRouter,
  workflows: workflowRouter, // Alias pour la compatibilité client (IndustryWorkflowsList, WorkflowSimulator)
  workflowEngine: workflowEngineRouter,
  realtimeWorkflow: realtimeWorkflowRouter,
  industryConfig: industryConfigRouter,
  industry: industryRouter,
  callScoring: callScoringRouter,
  coaching: coachingRouter,
  recruitment: recruitmentRouter,
  recruitmentEnhanced: recruitmentEnhancedRouter,

  // Billing & Legal
  billing: billingRouter,
  invoice: invoiceRouter,
  order: orderRouter,
  payment: paymentRouter,
  rgpd: rgpdRouter,

  // Data & Utils
  dashboard: dashboardRouter,
  documents: documentRouter,
  predictive: predictiveRouter,
  commandValidation: commandValidationRouter,
  health: healthRouter,
  messaging: messagingRouter,
  contact: contactRouter,
  social: socialRouter,

  // Servicall v3 — Intelligence Centrale (4 modules IA)
  servicallV3: servicallV3Router,
});

export type AppRouter = typeof appRouter;

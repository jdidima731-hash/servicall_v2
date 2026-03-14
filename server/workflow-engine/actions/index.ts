/**
 * WORKFLOW ACTIONS INDEX
 * Export centralisé de toutes les actions disponibles
 */

// CRM Actions
export { CreateLeadAction } from './crm/CreateLeadAction';
export { UpdateLeadAction } from './crm/UpdateLeadAction';
export { CreateAppointmentAction } from './crm/CreateAppointmentAction';
export { CreateReservationAction } from './crm/CreateReservationAction';

// Telephony Actions
export { ReceiveCallAction } from './telephony/ReceiveCallAction';
export { InitiateCallAction } from './telephony/InitiateCallAction';
export { RecordCallAction } from './telephony/RecordCallAction';
export { TranscribeCallAction } from './telephony/TranscribeCallAction';

// Messaging Actions
export { SendSMSAction } from './messaging/SendSMSAction';
export { SendWhatsAppAction } from './messaging/SendWhatsAppAction';
export { SendEmailAction } from './messaging/SendEmailAction';

// Dialogue Actions
export { SpeakToCallerAction } from './dialogue/SpeakToCallerAction';
export { ListenAndUnderstandAction } from './dialogue/ListenAndUnderstandAction';
export { QueryDatabaseAction } from './dialogue/QueryDatabaseAction';
export { QueryBusinessEntitiesAction } from './dialogue/QueryBusinessEntitiesAction';
export { SaveToDriveAction } from './dialogue/SaveToDriveAction';
export { CalendarSyncAction } from './dialogue/CalendarSyncAction';

// AI Actions
export { AIScoreAction } from './ai/AIScoreAction';

// Payment Actions
export { RequestPaymentAction } from './payment/RequestPaymentAction';
export { CreateOrderAction } from './payment/CreateOrderAction';
export { CreateDonationAction } from './payment/CreateDonationAction';

// Action Registry
export { ActionRegistry } from './ActionRegistry';

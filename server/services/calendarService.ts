/**
 * Calendar Service - Intégration Google Calendar et Outlook
 * Module 4: Prise de Rendez-vous
 */

import axios from "axios";
import { ResilienceService } from "./resilienceService";
import { logger } from "../infrastructure/logger";

// ============================================
// GOOGLE CALENDAR INTEGRATION
// ============================================

interface GoogleCalendarEvent {
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
  }>;
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{
      method: "email" | "popup";
      minutes: number;
    }>;
  };
}

/**
 * Create Google Calendar event
 */
export async function createGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  event: GoogleCalendarEvent
): Promise<{ eventId: string; htmlLink: string }> {
   return ResilienceService.execute(
     async () => {
       const response = await axios.post(
         `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
         event,
         {
           headers: {
             Authorization: `Bearer ${accessToken}`,
             "Content-Type": "application/json",
           },
         }
       );
56
       return {
         eventId: response.data.id,
         htmlLink: response.data.htmlLink,
       };
     },
     {
       name: "GOOGLE_CALENDAR_CREATE",
       module: "WORKFLOW",
       validateResponse: (data) => !!data.eventId,
       // Idempotence via le summary et le temps de début (simplifié pour l'exemple)
       idempotencyKey: `gcal_${calendarId}_${event.start.dateTime}_${event.summary.substring(0, 10)}`
     }
   );
}

/**
 * Update Google Calendar event
 */
export async function updateGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  event: Partial<GoogleCalendarEvent>
): Promise<void> {
   return ResilienceService.execute(
     async () => {
       await axios.patch(
         `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`,
         event,
         {
           headers: {
             Authorization: `Bearer ${accessToken}`,
             "Content-Type": "application/json",
           },
         }
       );
     },
     {
       name: "GOOGLE_CALENDAR_UPDATE",
       module: "WORKFLOW"
     }
   );
}

/**
 * Delete Google Calendar event
 */
export async function deleteGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<void> {
   return ResilienceService.execute(
     async () => {
       await axios.delete(
         `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`,
         {
           headers: {
             Authorization: `Bearer ${accessToken}`,
           },
         }
       );
     },
     {
       name: "GOOGLE_CALENDAR_DELETE",
       module: "WORKFLOW"
     }
   );
}

/**
 * Get Google Calendar events
 */
export async function getGoogleCalendarEvents(
  accessToken: string,
  calendarId: string,
  timeMin: Date,
  timeMax: Date
): Promise<any[]> {
   return ResilienceService.execute(
     async () => {
       const response = await axios.get(
         `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
         {
           headers: {
             Authorization: `Bearer ${accessToken}`,
           },
           params: {
             timeMin: timeMin.toISOString(),
             timeMax: timeMax.toISOString(),
             singleEvents: true,
             orderBy: "startTime",
           },
         }
       );
152
       return response.data.items || [];
     },
     {
       name: "GOOGLE_CALENDAR_LIST",
       module: "WORKFLOW"
     }
   );
}

// ============================================
// OUTLOOK CALENDAR INTEGRATION
// ============================================

interface OutlookCalendarEvent {
  subject: string;
  body?: {
    contentType: "HTML" | "Text";
    content: string;
  };
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  attendees?: Array<{
    emailAddress: {
      address: string;
      name?: string;
    };
    type: "required" | "optional";
  }>;
  reminderMinutesBeforeStart?: number;
}

/**
 * Create Outlook Calendar event
 */
export async function createOutlookCalendarEvent(
  accessToken: string,
  event: OutlookCalendarEvent
): Promise<{ eventId: string; webLink: string }> {
   return ResilienceService.execute(
     async () => {
       const response = await axios.post(
         "https://graph.microsoft.com/v1.0/me/events",
         event,
         {
           headers: {
             Authorization: `Bearer ${accessToken}`,
             "Content-Type": "application/json",
           },
         }
       );
209
       return {
         eventId: response.data.id,
         webLink: response.data.webLink,
       };
     },
     {
       name: "OUTLOOK_CALENDAR_CREATE",
       module: "WORKFLOW",
       validateResponse: (data) => !!data.eventId
     }
   );
}

/**
 * Update Outlook Calendar event
 */
export async function updateOutlookCalendarEvent(
  accessToken: string,
  eventId: string,
  event: Partial<OutlookCalendarEvent>
): Promise<void> {
   return ResilienceService.execute(
     async () => {
       await axios.patch(
         `https://graph.microsoft.com/v1.0/me/events/${eventId}`,
         event,
         {
           headers: {
             Authorization: `Bearer ${accessToken}`,
             "Content-Type": "application/json",
           },
         }
       );
     },
     {
       name: "OUTLOOK_CALENDAR_UPDATE",
       module: "WORKFLOW"
     }
   );
}

/**
 * Delete Outlook Calendar event
 */
export async function deleteOutlookCalendarEvent(
  accessToken: string,
  eventId: string
): Promise<void> {
   return ResilienceService.execute(
     async () => {
       await axios.delete(
         `https://graph.microsoft.com/v1.0/me/events/${eventId}`,
         {
           headers: {
             Authorization: `Bearer ${accessToken}`,
           },
         }
       );
     },
     {
       name: "OUTLOOK_CALENDAR_DELETE",
       module: "WORKFLOW"
     }
   );
}

/**
 * Get Outlook Calendar events
 */
export async function getOutlookCalendarEvents(
  accessToken: string,
  startDateTime: Date,
  endDateTime: Date
): Promise<any[]> {
   return ResilienceService.execute(
     async () => {
       const response = await axios.get(
         "https://graph.microsoft.com/v1.0/me/calendarview",
         {
           headers: {
             Authorization: `Bearer ${accessToken}`,
           },
           params: {
             startDateTime: startDateTime.toISOString(),
             endDateTime: endDateTime.toISOString(),
             $orderby: "start/dateTime",
           },
         }
       );
299
       return response.data.value || [];
     },
     {
       name: "OUTLOOK_CALENDAR_LIST",
       module: "WORKFLOW"
     }
   );
}

// ============================================
// APPOINTMENT NOTIFICATIONS
// ============================================

/**
 * Send appointment confirmation email
 */
export async function sendAppointmentConfirmationEmail(
  recipientEmail: string,
  appointment: {
    title: string;
    startTime: Date;
    endTime: Date;
    location?: string;
  }
): Promise<void> {
  // Email sending via notification service
  const { sendEmail } = await import("./notificationService");
  await sendEmail({
    to: recipientEmail,
    subject: `Confirmation: ${appointment.title}`,
    text: `Votre rendez-vous "${appointment.title}" est confirmé pour le ${appointment.startTime.toLocaleString('fr-FR')}.${appointment.location ? ` Lieu: ${appointment.location}` : ''}`,
  });
  logger.info("[Calendar Service] Confirmation email sent", { 
     module: "WORKFLOW",
     recipient: recipientEmail 
   });
}

/**
 * Send appointment reminder SMS
 */
export async function sendAppointmentReminderSMS(
  recipientPhone: string,
  appointment: {
    title: string;
    startTime: Date;
    location?: string;
  }
): Promise<void> {
  // SMS sending via Twilio service
  const { sendSMS } = await import("./twilioService");
  const message = `Rappel: ${appointment.title} le ${appointment.startTime.toLocaleString('fr-FR')}${appointment.location ? ` à ${appointment.location}` : ''}`;
  await sendSMS({ to: recipientPhone, body: message });
  logger.info("[Calendar Service] Reminder SMS sent", {
     module: "TWILIO",
     recipient: recipientPhone
   });
}

/**
 * Send appointment cancellation notification
 */
export async function sendAppointmentCancellationNotification(
  recipientEmail: string,
  recipientPhone: string,
  appointment: {
    title: string;
    startTime: Date;
  }
): Promise<void> {
  // Cancellation notification via email and SMS
  const { sendEmail } = await import("./notificationService");
  const { sendSMS } = await import("./twilioService");
  
  await sendEmail({
    to: recipientEmail,
    subject: `Annulation: ${appointment.title}`,
    text: `Votre rendez-vous "${appointment.title}" prévu le ${appointment.startTime.toLocaleString('fr-FR')} a été annulé.`,
  });
  
  await sendSMS({ to: recipientPhone, body: `Annulation: ${appointment.title} le ${appointment.startTime.toLocaleString('fr-FR')}` });
  
  logger.info("[Calendar Service] Cancellation notifications sent", { module: "WORKFLOW" });
}

/**
 * Format appointment for calendar event
 */
export function formatAppointmentForGoogleCalendar(
  appointment: {
    title: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    prospectEmail?: string;
    prospectName?: string;
  },
  timezone: string = "Europe/Paris"
): GoogleCalendarEvent {
  return {
    summary: appointment.title,
    description: appointment.description,
    start: {
      dateTime: appointment.startTime.toISOString(),
      timeZone: timezone,
    },
    end: {
      dateTime: appointment.endTime.toISOString(),
      timeZone: timezone,
    },
    attendees: appointment.prospectEmail
      ? [
          {
            email: appointment.prospectEmail,
            displayName: appointment.prospectName,
          },
        ]
      : undefined,
    reminders: {
      useDefault: false,
      overrides: [
        { method: "email", minutes: 24 * 60 }, // 24h before
        { method: "popup", minutes: 30 }, // 30min before
      ],
    },
  };
}

/**
 * Format appointment for Outlook calendar event
 */
export function formatAppointmentForOutlookCalendar(
  appointment: {
    title: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    prospectEmail?: string;
    prospectName?: string;
  },
  timezone: string = "Europe/Paris"
): OutlookCalendarEvent {
  return {
    subject: appointment.title,
    body: appointment.description
      ? {
          contentType: "HTML",
          content: appointment.description,
        }
      : undefined,
    start: {
      dateTime: appointment.startTime.toISOString(),
      timeZone: timezone,
    },
    end: {
      dateTime: appointment.endTime.toISOString(),
      timeZone: timezone,
    },
    attendees: appointment.prospectEmail
      ? [
          {
            emailAddress: {
              address: appointment.prospectEmail,
              name: appointment.prospectName,
            },
            type: "required",
          },
        ]
      : undefined,
    reminderMinutesBeforeStart: 30,
  };
}

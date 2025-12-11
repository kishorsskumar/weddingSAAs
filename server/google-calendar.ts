// Google Calendar Integration for Oak Event Management
// Uses Replit's Google Calendar connector

import { google, calendar_v3 } from 'googleapis';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-calendar',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Calendar not connected');
  }
  return accessToken;
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
async function getGoogleCalendarClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

// Check if Google Calendar is connected
export async function isGoogleCalendarConnected(): Promise<boolean> {
  try {
    await getAccessToken();
    return true;
  } catch {
    return false;
  }
}

// List available calendars
export async function listCalendars(): Promise<calendar_v3.Schema$CalendarListEntry[]> {
  const calendar = await getGoogleCalendarClient();
  const response = await calendar.calendarList.list();
  return response.data.items || [];
}

// Create event in Google Calendar
export async function createGoogleCalendarEvent(
  event: {
    id: string;
    title: string;
    date: string;
    time?: string | null;
    venue: string;
    customer: string;
    type: string;
    planner: string;
  },
  calendarId: string = 'primary'
): Promise<calendar_v3.Schema$Event> {
  const calendar = await getGoogleCalendarClient();
  
  // Parse date and time
  const eventDate = new Date(event.date);
  let startDateTime: string;
  let endDateTime: string;
  
  if (event.time) {
    // If time is provided, create a timed event (assume 3 hour duration for events)
    const [hours, minutes] = event.time.split(':').map(Number);
    eventDate.setHours(hours, minutes, 0, 0);
    startDateTime = eventDate.toISOString();
    
    const endDate = new Date(eventDate);
    endDate.setHours(endDate.getHours() + 3); // 3 hour default duration
    endDateTime = endDate.toISOString();
  } else {
    // All-day event
    startDateTime = event.date;
    endDateTime = event.date;
  }

  const googleEvent: calendar_v3.Schema$Event = {
    summary: `${event.title} - ${event.type}`,
    description: `Customer: ${event.customer}\nVenue: ${event.venue}\nPlanner: ${event.planner}\n\nEvent ID: ${event.id}`,
    location: event.venue,
    start: event.time 
      ? { dateTime: startDateTime, timeZone: 'Asia/Kolkata' }
      : { date: startDateTime },
    end: event.time
      ? { dateTime: endDateTime, timeZone: 'Asia/Kolkata' }
      : { date: endDateTime },
    extendedProperties: {
      private: {
        oakEventId: event.id
      }
    }
  };

  const response = await calendar.events.insert({
    calendarId,
    requestBody: googleEvent,
  });

  return response.data;
}

// Update event in Google Calendar
export async function updateGoogleCalendarEvent(
  googleEventId: string,
  event: {
    id: string;
    title: string;
    date: string;
    time?: string | null;
    venue: string;
    customer: string;
    type: string;
    planner: string;
  },
  calendarId: string = 'primary'
): Promise<calendar_v3.Schema$Event> {
  const calendar = await getGoogleCalendarClient();
  
  const eventDate = new Date(event.date);
  let startDateTime: string;
  let endDateTime: string;
  
  if (event.time) {
    const [hours, minutes] = event.time.split(':').map(Number);
    eventDate.setHours(hours, minutes, 0, 0);
    startDateTime = eventDate.toISOString();
    
    const endDate = new Date(eventDate);
    endDate.setHours(endDate.getHours() + 3);
    endDateTime = endDate.toISOString();
  } else {
    startDateTime = event.date;
    endDateTime = event.date;
  }

  const googleEvent: calendar_v3.Schema$Event = {
    summary: `${event.title} - ${event.type}`,
    description: `Customer: ${event.customer}\nVenue: ${event.venue}\nPlanner: ${event.planner}\n\nEvent ID: ${event.id}`,
    location: event.venue,
    start: event.time 
      ? { dateTime: startDateTime, timeZone: 'Asia/Kolkata' }
      : { date: startDateTime },
    end: event.time
      ? { dateTime: endDateTime, timeZone: 'Asia/Kolkata' }
      : { date: endDateTime },
    extendedProperties: {
      private: {
        oakEventId: event.id
      }
    }
  };

  const response = await calendar.events.update({
    calendarId,
    eventId: googleEventId,
    requestBody: googleEvent,
  });

  return response.data;
}

// Delete event from Google Calendar
export async function deleteGoogleCalendarEvent(
  googleEventId: string,
  calendarId: string = 'primary'
): Promise<void> {
  const calendar = await getGoogleCalendarClient();
  await calendar.events.delete({
    calendarId,
    eventId: googleEventId,
  });
}

// Find Google Calendar event by Oak Event ID
export async function findGoogleCalendarEventByOakId(
  oakEventId: string,
  calendarId: string = 'primary'
): Promise<calendar_v3.Schema$Event | null> {
  const calendar = await getGoogleCalendarClient();
  
  // Search for events with the oakEventId in extended properties
  const response = await calendar.events.list({
    calendarId,
    privateExtendedProperty: `oakEventId=${oakEventId}`,
    maxResults: 1,
  });

  return response.data.items?.[0] || null;
}

// Sync a single event to Google Calendar (create or update)
export async function syncEventToGoogleCalendar(
  event: {
    id: string;
    title: string;
    date: string;
    time?: string | null;
    venue: string;
    customer: string;
    type: string;
    planner: string;
    googleCalendarEventId?: string | null;
  },
  calendarId: string = 'primary'
): Promise<{ googleEventId: string; action: 'created' | 'updated' }> {
  // Check if event already has a Google Calendar ID
  if (event.googleCalendarEventId) {
    try {
      const updated = await updateGoogleCalendarEvent(event.googleCalendarEventId, event, calendarId);
      return { googleEventId: updated.id!, action: 'updated' };
    } catch (error: any) {
      // If event not found, create a new one
      if (error.code === 404) {
        const created = await createGoogleCalendarEvent(event, calendarId);
        return { googleEventId: created.id!, action: 'created' };
      }
      throw error;
    }
  }

  // Try to find existing event by Oak ID
  const existing = await findGoogleCalendarEventByOakId(event.id, calendarId);
  if (existing) {
    const updated = await updateGoogleCalendarEvent(existing.id!, event, calendarId);
    return { googleEventId: updated.id!, action: 'updated' };
  }

  // Create new event
  const created = await createGoogleCalendarEvent(event, calendarId);
  return { googleEventId: created.id!, action: 'created' };
}

// Get upcoming events from Google Calendar
export async function getGoogleCalendarEvents(
  calendarId: string = 'primary',
  maxResults: number = 50
): Promise<calendar_v3.Schema$Event[]> {
  const calendar = await getGoogleCalendarClient();
  
  const response = await calendar.events.list({
    calendarId,
    timeMin: new Date().toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: 'startTime',
  });

  return response.data.items || [];
}

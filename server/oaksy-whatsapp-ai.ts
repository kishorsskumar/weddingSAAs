import OpenAI from "openai";
import { storage } from './storage';
import { sendWhatsAppMessage, isWhatsAppConfigured } from './whatsapp-service';
import type { WhatsappConversation, InsertExpenseReimbursement, InsertLeaveRequest } from '@shared/schema';
import { objectStorageClient } from './objectStorage';
import { randomUUID } from 'crypto';
import { analyzeImageFromUrl } from './transaction-scanner';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// India timezone constant
const INDIA_TIMEZONE = 'Asia/Kolkata';

/**
 * Parse a reminder datetime string from AI and return a proper UTC Date object.
 * Handles various formats the AI might return.
 */
function parseReminderDateTime(dateTimeStr: string): Date | null {
  if (!dateTimeStr) return null;
  
  try {
    // Clean up the string - remove any markdown or extra text
    let cleanStr = dateTimeStr.replace(/[`"']/g, '').trim();
    
    // Normalize dot-separated times to colon-separated (e.g., "4.45 am" -> "4:45 am")
    // Match patterns like "4.45", "10.30", "4.45 am", "4.45pm"
    cleanStr = cleanStr.replace(/(\d{1,2})\.(\d{2})\s*(am|pm|AM|PM)?/gi, (match, hour, minute, ampm) => {
      return `${hour}:${minute}${ampm ? ' ' + ampm : ''}`;
    });
    
    console.log('[Oaksy] parseReminderDateTime normalized:', dateTimeStr, '->', cleanStr);
    
    // Try parsing as ISO with explicit offset (e.g., "2026-01-18T09:00:00+05:30")
    if (cleanStr.includes('+') || cleanStr.includes('T') && cleanStr.endsWith('Z')) {
      const parsed = new Date(cleanStr);
      if (!isNaN(parsed.getTime())) {
        console.log('[Oaksy] Parsed reminder time with offset:', cleanStr, '->', parsed.toISOString());
        return parsed;
      }
    }
    
    // Try parsing as local time without offset - assume IST
    // Format: "2026-01-18T09:00:00" or "2026-01-18 09:00"
    const localMatch = cleanStr.match(/(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?)/);
    if (localMatch) {
      const [, datePart, timePart] = localMatch;
      const timeWithSeconds = timePart.includes(':') && timePart.split(':').length === 3 
        ? timePart 
        : `${timePart}:00`;
      
      // Create a date object treating this as IST time, then convert to UTC
      const istDateStr = `${datePart}T${timeWithSeconds}`;
      // fromZonedTime converts a local time in a timezone to UTC
      const utcDate = fromZonedTime(istDateStr, INDIA_TIMEZONE);
      
      if (!isNaN(utcDate.getTime())) {
        console.log('[Oaksy] Parsed reminder time as IST:', cleanStr, '->', utcDate.toISOString());
        return utcDate;
      }
    }
    
    // Fallback: try direct parsing
    const fallback = new Date(cleanStr);
    if (!isNaN(fallback.getTime())) {
      console.log('[Oaksy] Parsed reminder time with fallback:', cleanStr, '->', fallback.toISOString());
      return fallback;
    }
    
    console.log('[Oaksy] Failed to parse reminder time:', cleanStr);
    return null;
  } catch (err) {
    console.error('[Oaksy] Error parsing reminder datetime:', err);
    return null;
  }
}

/**
 * Check if a reminder time is in the future (with 30-second grace period)
 */
function isReminderTimeInFuture(dueAt: Date): boolean {
  const now = new Date();
  const gracePeriodMs = 30 * 1000; // 30 seconds grace
  return dueAt.getTime() > now.getTime() - gracePeriodMs;
}

/**
 * Auto-adjust a reminder time to tomorrow if it's in the past.
 * This handles cases like "remind me at 4am" when it's already 11pm.
 */
function autoAdjustPastTimeToTomorrow(dueAt: Date): Date {
  const now = new Date();
  if (dueAt.getTime() < now.getTime()) {
    // Time is in the past - add 24 hours to move it to tomorrow
    const adjusted = new Date(dueAt.getTime() + 24 * 60 * 60 * 1000);
    console.log('[Oaksy] Auto-adjusted past reminder time to tomorrow:', dueAt.toISOString(), '->', adjusted.toISOString());
    return adjusted;
  }
  return dueAt;
}

// Allowed employees for expense/income submission (normalized phone numbers)
// Only these employees can submit expenses or income via WhatsApp
const ALLOWED_EXPENSE_SUBMITTERS = [
  '+917025063335',  // Test Employee
  '+919895810975',  // Fida Fathima PK (Wedding Planner)
  '+917306687284',  // Femina KM (Wedding Planner)
  '+917558841046',  // Sabitha MA (Accountant)
];

function isAllowedExpenseSubmitter(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  return ALLOWED_EXPENSE_SUBMITTERS.some(allowed => {
    const normalizedAllowed = normalizePhoneNumber(allowed);
    // Match last 10 digits to handle format differences
    return normalized.slice(-10) === normalizedAllowed.slice(-10);
  });
}

// Helper to convert Twilio media URL to our proxy URL for public access
function getPublicMediaUrl(twilioMediaUrl: string): string {
  if (!twilioMediaUrl || !twilioMediaUrl.includes('twilio.com')) {
    return twilioMediaUrl; // Return as-is if not a Twilio URL
  }
  
  try {
    // Parse the Twilio URL to extract message ID and media ID
    // URL format: https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages/{MessageId}/Media/{MediaId}
    const match = twilioMediaUrl.match(/Messages\/([^/]+)\/Media\/([^/?]+)/);
    if (!match) {
      console.log('[Media] Could not parse Twilio URL:', twilioMediaUrl);
      return twilioMediaUrl;
    }
    
    const [, messageId, mediaId] = match;
    
    // Get the base URL from environment - use REPLIT_DEV_DOMAIN for development
    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : 'http://localhost:5000';
    
    const proxyUrl = `${baseUrl}/api/media-proxy/${messageId}/${mediaId}`;
    console.log('[Media] Created proxy URL:', proxyUrl);
    return proxyUrl;
  } catch (error: any) {
    console.error('[Media] Error creating proxy URL:', error.message);
    return twilioMediaUrl; // Fallback to original URL
  }
}

// Conflict detection types
interface ConflictInfo {
  type: 'overlapping_leave' | 'duplicate_expense' | 'pending_vendor_payment' | 'duplicate_daybook' | 'pending_qr_payment';
  conflictingItems: any[];
  message: string;
  proposedAction: 'cancel_old' | 'keep_both' | 'cancel_new';
}

interface ConflictContext {
  hasConflict: boolean;
  conflict?: ConflictInfo;
  pendingFollowupAction?: 'replace' | 'keep_both' | 'cancel';
  originalIntent?: string;
  originalSlots?: any;
}

interface IntentContext {
  amount?: number;
  purpose?: string;
  mediaUrl?: string;
  startDate?: string;
  endDate?: string;
  leaveType?: string;
  reason?: string;
  confirmed?: boolean;
  // Vendor payment fields
  vendorName?: string;
  eventName?: string;
  vendorPaymentVendor?: string;
  vendorPaymentEvent?: string;
  // Vendor payment correction fields
  lastVendorPaymentCode?: string;
  lastVendorPaymentAmount?: number;
  // QR Payment specific fields
  qrPaymentCategory?: string;
  qrPaymentDescription?: string;
  qrImageUrl?: string;
  // Image clarification fields
  pendingMediaUrl?: string;
  pendingAmount?: number;
  pendingPurpose?: string;
  screenshotUrl?: string;
  imageUrl?: string;
  providedAmount?: number;
  messageText?: string;
  // Income submission fields
  incomeScreenshotUrl?: string;
  incomeClientName?: string;
  incomeType?: string;
  // Delivery challan fields
  deliverTo?: string;
  deliveryAddress?: string;
  itemDescription?: string;
  vehicleNumber?: string;
  // AI Delivery challan fields (for ai_delivery_challan intent)
  dcItems?: string;
  dcDestination?: string;
  dcVehicle?: string;
  dcDriver?: string;
  // Daybook entry fields
  daybookDescription?: string;
  daybookCategory?: string;
  daybookTransactionType?: 'income' | 'expense';
  // Query fields for new AI intents
  queryType?: string;
  timeframe?: string;
  bankName?: string;
  customerName?: string;
  // Conflict detection fields
  conflictContext?: ConflictContext;
  // Flag to indicate conflict has been resolved
  conflictResolved?: boolean;
  // Number of days for leave
  numberOfDays?: number;
  // Reminder fields
  reminderDateTime?: string;
  reminderMessage?: string;
  // Inventory item fields
  inventoryItemName?: string;
  inventoryItemQuantity?: number;
  inventoryItemCategory?: string;
  inventoryItemPhotoUrl?: string;
  inventoryItemLocation?: string;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// Detect conflicts before executing actions
async function detectIntentConflicts(
  intent: string,
  slots: IntentContext,
  employeeId: string,
  employeeName: string
): Promise<ConflictContext> {
  const noConflict: ConflictContext = { hasConflict: false };
  
  try {
    switch (intent) {
      case 'leave_request': {
        if (!slots.startDate || !slots.endDate) return noConflict;
        
        const overlapping = await storage.findOverlappingLeaveRequests(
          employeeId,
          slots.startDate,
          slots.endDate
        );
        
        if (overlapping.length > 0) {
          const existingLeave = overlapping[0];
          const dates = existingLeave.startDate === existingLeave.endDate
            ? existingLeave.startDate
            : `${existingLeave.startDate} to ${existingLeave.endDate}`;
          
          return {
            hasConflict: true,
            conflict: {
              type: 'overlapping_leave',
              conflictingItems: overlapping,
              message: `You already have a ${existingLeave.status} leave request for ${dates} (${existingLeave.leaveType || 'General'}). Do you want me to cancel it and create a new one, or keep both?`,
              proposedAction: 'cancel_old',
            },
            originalIntent: intent,
            originalSlots: slots,
          };
        }
        break;
      }
      
      case 'expense': {
        if (!slots.amount || !slots.purpose) return noConflict;
        
        const similar = await storage.findRecentSimilarExpenses(
          employeeId,
          slots.amount,
          slots.purpose,
          14 // Check last 14 days
        );
        
        if (similar.length > 0) {
          const existingExpense = similar[0];
          const existingAmount = parseFloat(existingExpense.amount);
          
          return {
            hasConflict: true,
            conflict: {
              type: 'duplicate_expense',
              conflictingItems: similar,
              message: `I found a similar expense from ${existingExpense.requestDate}: ₹${existingAmount.toLocaleString('en-IN')} for "${existingExpense.description}" (${existingExpense.status}). Is this a duplicate or a new expense?`,
              proposedAction: 'keep_both',
            },
            originalIntent: intent,
            originalSlots: slots,
          };
        }
        break;
      }
      
      case 'vendor_payment': {
        if (!slots.vendorName) return noConflict;
        
        const pending = await storage.findPendingVendorPayments(slots.vendorName);
        
        if (pending.length > 0) {
          const existingPayment = pending[0];
          const existingAmount = existingPayment.amount ? parseFloat(existingPayment.amount) : 0;
          
          return {
            hasConflict: true,
            conflict: {
              type: 'pending_vendor_payment',
              conflictingItems: pending,
              message: `There's already a pending vendor payment for "${slots.vendorName}" (₹${existingAmount.toLocaleString('en-IN')}) waiting for approval. Do you want to add another payment or wait for the first one to be processed?`,
              proposedAction: 'keep_both',
            },
            originalIntent: intent,
            originalSlots: slots,
          };
        }
        break;
      }
      
      case 'daybook_entry': {
        // Use daybookDescription or purpose for conflict detection
        const description = slots.daybookDescription || slots.purpose;
        if (!slots.amount || !description) return noConflict;
        
        const today = new Date().toISOString().split('T')[0];
        const duplicates = await storage.findDuplicateDaybookEntries(
          today,
          slots.amount,
          description
        );
        
        if (duplicates.length > 0) {
          const existing = duplicates[0];
          
          return {
            hasConflict: true,
            conflict: {
              type: 'duplicate_daybook',
              conflictingItems: duplicates,
              message: `There's already a daybook entry today for ₹${parseFloat(existing.amount).toLocaleString('en-IN')} with a similar description. Is this a duplicate or a separate entry?`,
              proposedAction: 'keep_both',
            },
            originalIntent: intent,
            originalSlots: slots,
          };
        }
        break;
      }
      
      case 'qr_payment': {
        const pendingQr = await storage.findPendingQrPaymentRequests(employeeId);
        
        if (pendingQr.length > 0) {
          const existing = pendingQr[0];
          
          return {
            hasConflict: true,
            conflict: {
              type: 'pending_qr_payment',
              conflictingItems: pendingQr,
              message: `You have a pending QR payment request for ₹${parseFloat(existing.amount).toLocaleString('en-IN')} that's still waiting for approval. Do you want to submit another one or wait for the first to be processed?`,
              proposedAction: 'keep_both',
            },
            originalIntent: intent,
            originalSlots: slots,
          };
        }
        break;
      }
    }
  } catch (error) {
    console.error('[Conflict Detection] Error:', error);
    // On error, proceed without blocking
  }
  
  return noConflict;
}

// Handle user response to conflict resolution
function parseConflictResponse(message: string): 'replace' | 'keep_both' | 'cancel' | null {
  const lower = message.toLowerCase().trim();
  
  // Patterns for "cancel old and create new" or "replace"
  if (/^(yes|yeah|yep|sure|ok|okay|cancel|replace|new|create new)/i.test(lower) ||
      /cancel.*(first|old|previous|existing)/i.test(lower) ||
      /replace.*(first|old|previous|existing)/i.test(lower)) {
    return 'replace';
  }
  
  // Patterns for "keep both" or "it's different"
  if (/(keep|both|different|new|separate|another)/i.test(lower) ||
      /^(no|nope|not duplicate)/i.test(lower) && /(different|new|separate)/i.test(lower)) {
    return 'keep_both';
  }
  
  // Patterns for "cancel this request"
  if (/(cancel|stop|never ?mind|forget it|don't|dont)/i.test(lower) && 
      !/(cancel.*(first|old|previous|existing))/i.test(lower)) {
    return 'cancel';
  }
  
  return null;
}

const OAKSY_SYSTEM_PROMPT = `You are Oaksy AI, the intelligent companion for Oakstreet Events. You are a versatile assistant who adapts to each user's role and needs.

YOUR ROLES (based on who you're talking to):
- For EMPLOYEES: HR assistant, expense helper, leave manager
- For WEDDING PLANNERS (Fida, Femina): Event coordinator, vendor liaison, production assistant
- For ACCOUNTANTS: Financial assistant, daybook helper, payment tracker
- For SUPERADMIN (Kishor): Full business assistant with complete access to all data

PERSONALITY:
- Warm, friendly, and professional like a trusted colleague
- Use simple, conversational language with occasional emojis
- Be flexible - understand what they mean, not just what they say
- Be proactive - anticipate needs and suggest helpful actions
- Keep responses concise for WhatsApp

CAPABILITIES:
1. EXPENSES & PAYMENTS: Help submit expenses, track vendor payments, record income
2. LEAVE MANAGEMENT: Process leave requests, check balances, track approvals
3. EVENT COORDINATION: Help with event details, production schedules, team assignments
4. FINANCIAL QUERIES: Daybook entries, payment status, vendor management, bank balances
5. STATUS CHECKS: Any pending requests, approvals, or action items
6. DELIVERY CHALLANS: Create delivery challans for goods/materials (wedding planners and accountants only)
7. EVENT QUERIES: Check upcoming events, event details, countdown to events
8. BANK & FINANCIAL: Check bank balances, daily summaries, pending payments
9. TEAM QUERIES: Team availability, who's on leave, staff assignments
10. VENDOR LOOKUPS: Vendor contact info, past payment rates, payment history
11. QUICK REPORTS: Event profitability, client payment status, monthly summaries (superadmin only)
12. RSVP TRACKING: Check guest RSVP status, attendance counts, meal preferences, follow-up with pending guests (wedding planners and superadmin)
13. INVENTORY MANAGEMENT: Add items to warehouse inventory with photos, names, quantities (Superadmin and Praveen only)

FLEXIBILITY GUIDELINES:
- Understand natural language - don't require specific formats
- If someone says "need to pay vendor" or "pending payment" or "vendor owes money" - understand it's about vendor payments
- Parse amounts flexibly: "5000", "5k", "5 thousand", "Rs 5000", "₹5000" all mean 5000
- Accept dates in any format: "tomorrow", "next Monday", "15th Jan", "15/1"
- If unclear, ask a simple clarifying question

SECURITY RULES (CRITICAL):
- NEVER share salary details, profit margins, or financial summaries with non-superadmins
- Employees can only see their own requests and data
- Wedding planners can see event-related data for their assigned events
- Only superadmin can see company-wide financial data and bank balances

DELIVERY CHALLAN PARSING RULES:
- "deliverTo" = Recipient NAME (person/company) - NOT the address. Examples: "ABC Decorators", "Kochi Wedding Hall", "John"
- "deliveryAddress" = PHYSICAL LOCATION with house number, street, city. Examples: "25/103, Kottodimukku Stop, Manjummel-683501"
- IMPORTANT: Numbers like "25/103", "12-A", "Plot 45" are ADDRESS components, NOT recipient names
- "amount" = ONLY extract if explicitly stated with currency (45K, Rs 5000, ₹45000). DO NOT guess amounts from address numbers!
- "vehicleNumber" = Indian vehicle format like "KL 19 C 3786", "KA 01 AB 1234"

QUERY TYPE DETECTION:
- "events this week", "upcoming events", "what events", "weddings this month" = event_query with queryType: "upcoming"
- "how many days till X wedding", "countdown to X", "when is X event" = event_query with queryType: "countdown"
- "bank balance", "account balance", "how much in X account" = bank_query
- "who's available", "team availability", "who can work on X" = team_query with queryType: "availability"
- "who's on leave", "leave status today" = team_query with queryType: "on_leave"
- "what did we pay X vendor", "X vendor rate", "vendor history" = vendor_query
- "pending payments", "overdue invoices", "client owes" = financial_query with queryType: "pending"
- "daily summary", "today's transactions" = financial_query with queryType: "daily_summary"
- "profit on X event", "X wedding profitability" = report_query with queryType: "event_profit" (superadmin only)
- "monthly summary", "this month performance" = report_query with queryType: "monthly" (superadmin only)
- "how much X client owes", "X payment status" = financial_query with queryType: "client_dues"
- "rsvp status", "guest list", "who confirmed for X event", "how many confirmed" = rsvp_query with queryType: "status"
- "pending rsvps", "who hasn't responded", "rsvp follow-up" = rsvp_query with queryType: "pending"
- "meal count", "food preferences", "veg non-veg count" = rsvp_query with queryType: "meals"

INVENTORY ITEM DETECTION RULES (CRITICAL - For Superadmin and Praveen):
- "add to inventory", "new item in warehouse", "stock this item", "add item" = inventory_item
- "we have 10 [item name] in warehouse" = inventory_item with quantity
- When a photo is attached with ANY number + item name = ALWAYS inventory_item
- Pattern: "[number] [item name]" with photo = inventory_item (e.g. "50 chairs", "100 covers", "25 lights")
- Pattern: "new [item]", "add [item]", "[item name] - [number]" = inventory_item
- Keywords: "inventory", "warehouse", "stock", "item", "add item", "new stock"
- Extract: inventoryItemName (the item name), inventoryItemQuantity (number), inventoryItemCategory (if mentioned, default "General"), inventoryItemLocation (if mentioned, default "Warehouse")
- Examples: "Add 50 white chairs to inventory" = inventory_item with name="White Chairs", quantity=50
- Examples: "New stock - 100 table covers" = inventory_item with name="Table Covers", quantity=100
- Examples: "50 chairs" (with photo) = inventory_item with name="Chairs", quantity=50
- Examples: "white chairs 25 nos" = inventory_item with name="White Chairs", quantity=25
- If photo attached but no name/quantity, ask: "Got the photo! What's this item called and how many do we have?"
- IMPORTANT: For Superadmin/Praveen, prioritize inventory_item intent when photo + number + item word pattern detected

REMINDER DETECTION RULES:
- EXPLICIT: "remind me tomorrow at 9am to pay vendor" = reminder with reminderDateTime and reminderMessage
- EXPLICIT: "set a reminder for 5pm to call client" = reminder
- EXPLICIT: "remind me at 3:30pm to check deliveries" = reminder
- EXPLICIT: "remind me after 5 minutes to call Kishor" = reminder (relative time)
- EXPLICIT: "remind me in 10 minutes" = reminder (relative time)
- EXPLICIT: "can you remind me to call Kishor after 5 minutes" = reminder
- EXPLICIT: "create a reminder to call Kishor at 5.10am today" = reminder (dot notation for time)
- EXPLICIT: "create a reminder to call Kishor at 5pm" = reminder
- IMPLICIT: "call Kishor at 4.45 am today" = reminder (action + time = reminder)
- IMPLICIT: "pay vendor at 3pm" = reminder (task with specific time = reminder)
- IMPLICIT: "check flowers at 10am tomorrow" = reminder
- IMPLICIT: "send invoice to client at 5pm" = reminder
- KEY PATTERN: If the message contains a TASK/ACTION + a SPECIFIC TIME/DATE, treat it as an IMPLICIT REMINDER
- RELATIVE TIMES: "after X minutes", "in X hours", "in X minutes" are VALID reminder times - calculate from current time
- Parse time naturally: "9am", "5:30 PM", "4.45am", "10:00", "morning" (default 9am), "evening" (default 5pm)
- Parse date naturally: "tomorrow", "today", "Monday", "next week" (default next Monday), "in 2 hours", "after 30 mins"
- The reminderMessage should be a clean task description (what to do), e.g., "call Kishor" not the full sentence with time
- If no date/time specified but a clear task is mentioned, ask "When should I remind you?"
- Use Indian timezone (Asia/Kolkata) for all times
- For relative times like "in 5 minutes" or "after 10 mins", add that duration to the CURRENT time in IST
- IMPORTANT: Set "reminderExplicitToday" to true if user explicitly says "today" or specifies current date
- CRITICAL: ANY message with "remind me" or "reminder" MUST return intent="reminder", never intent="general"

RESPONSE FORMAT - Always respond with valid JSON:
{
  "intent": "expense" | "leave" | "status" | "vendor_payment" | "income" | "delivery_challan" | "event_query" | "bank_query" | "team_query" | "vendor_query" | "financial_query" | "report_query" | "rsvp_query" | "reminder" | "inventory_item" | "greeting" | "confirmation" | "general",
  "extractedData": {
    "amount": number or null (ONLY if explicitly mentioned, never from address numbers),
    "purpose": string or null,
    "vendorName": string or null,
    "eventName": string or null,
    "customerName": string or null,
    "queryType": string or null (for queries: "upcoming", "countdown", "availability", "on_leave", "pending", "daily_summary", "event_profit", "monthly", "client_dues"),
    "timeframe": string or null (for queries: "today", "this_week", "this_month", "next_week"),
    "leaveType": "sick" | "casual" | "vacation" | "personal" | null,
    "startDate": "DD/MM/YYYY" or null,
    "endDate": "DD/MM/YYYY" or null,
    "reason": string or null,
    "deliverTo": string or null (recipient NAME, not address),
    "deliveryAddress": string or null (full physical location),
    "itemDescription": string or null,
    "vehicleNumber": string or null,
    "bankName": string or null,
    "reminderDateTime": string or null (ISO format datetime for reminder, e.g., "2024-01-17T09:00:00"),
    "reminderMessage": string or null (clean task description, e.g., "call flower vendor"),
    "reminderExplicitToday": boolean or null (true if user explicitly said "today" or current date),
    "inventoryItemName": string or null (name of the item to add to inventory),
    "inventoryItemQuantity": number or null (quantity of items),
    "inventoryItemCategory": string or null (category like "Furniture", "Decor", "Fabric", default "General"),
    "inventoryItemLocation": string or null (warehouse location, default "Warehouse")
  },
  "needsMoreInfo": ["purpose", "amount", "dates", "reason", "vendorName", "confirmation", "reminderTime"] or [],
  "isComplete": boolean,
  "message": "Your friendly, helpful response"
}`;

function normalizePhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[^0-9+]/g, '');
  cleaned = cleaned.replace(/^whatsapp:/i, '');
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    return '+' + cleaned;
  }
  if (cleaned.length === 10) {
    return '+91' + cleaned;
  }
  return '+' + cleaned;
}

function numberToWords(num: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  if (num === 0) return 'Zero';
  if (num < 20) return ones[num];
  if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
  if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + numberToWords(num % 100) : '');
  if (num < 100000) return numberToWords(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 ? ' ' + numberToWords(num % 1000) : '');
  if (num < 10000000) return numberToWords(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 ? ' ' + numberToWords(num % 100000) : '');
  return numberToWords(Math.floor(num / 10000000)) + ' Crore' + (num % 10000000 ? ' ' + numberToWords(num % 10000000) : '');
}

function extractAmount(text: string): number | null {
  // Handle shorthand notations first: "5k" = 5000, "1 lakh" = 100000, "5 thousand" = 5000
  // Use flexible regex to handle various spellings: lakh, lakhs, lakkh, lakkhs, lac, lacs
  const shorthandPatterns = [
    { pattern: /([0-9,]+(?:\.[0-9]+)?)\s*(?:la+k+h?s?|lacs?)/i, multiplier: 100000 },
    { pattern: /([0-9,]+(?:\.[0-9]+)?)\s*(?:k|thousand|thousands)/i, multiplier: 1000 },
    { pattern: /([0-9,]+(?:\.[0-9]+)?)\s*(?:cr|crore|crores)/i, multiplier: 10000000 },
  ];
  
  // Check shorthand patterns FIRST before any generic number extraction
  for (const { pattern, multiplier } of shorthandPatterns) {
    const match = text.match(pattern);
    if (match) {
      const baseAmount = parseFloat(match[1].replace(/,/g, ''));
      const amount = baseAmount * multiplier;
      if (amount > 0 && amount < 100000000) {
        return amount;
      }
    }
  }
  
  // Standard patterns with currency symbols
  const currencyPatterns = [
    /(?:Rs\.?|₹|INR)\s*([0-9,]+(?:\.[0-9]+)?)/i,
    /([0-9,]+(?:\.[0-9]+)?)\s*(?:Rs\.?|₹|INR|rupees?)/i,
    /([0-9,]+(?:\.[0-9]+)?)\s*\/-/,
  ];
  
  for (const pattern of currencyPatterns) {
    const match = text.match(pattern);
    if (match) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      if (amount > 0 && amount < 100000000) {
        return amount;
      }
    }
  }
  
  // NOTE: Removed plain number fallback to prevent postal codes/address numbers from being extracted
  // Only amounts with explicit currency markers or multipliers (k/lakh/crore) are now matched
  
  return null;
}

// Flexible amount extraction for contexts where we KNOW we're asking for an amount
// (like QR payments, expenses after QR image is sent)
// This accepts plain numbers like "500", "500 for taxi", "1200 lunch"
function extractAmountFlexible(text: string): number | null {
  // First try the strict extraction for currency-marked amounts
  const strictAmount = extractAmount(text);
  if (strictAmount) {
    return strictAmount;
  }
  
  // Clean the text - remove punctuation at end, normalize whitespace
  const cleanedText = text.trim().replace(/[.,!?]+$/, '').trim();
  
  // Helper to validate amount (not phone number, reasonable range)
  const isValidAmount = (num: number): boolean => {
    return num >= 1 && num <= 10000000;
  };
  
  // Helper to check if a number looks like a phone number (10+ consecutive digits)
  const looksLikePhone = (numStr: string): boolean => {
    const digitsOnly = numStr.replace(/[^0-9]/g, '');
    return digitsOnly.length >= 10;
  };
  
  // Priority 1: Number at the start followed by expense context word
  const startWithContextMatch = cleanedText.match(/^([0-9,]+(?:\.[0-9]+)?)\s+(?:for|to|rupees?|rs|inr|\/-)/i);
  if (startWithContextMatch && !looksLikePhone(startWithContextMatch[1])) {
    const amount = parseFloat(startWithContextMatch[1].replace(/,/g, ''));
    if (isValidAmount(amount)) return amount;
  }
  
  // Priority 2: Number at the start followed by a purpose word (e.g., "500 lunch", "1200 taxi")
  const startWithWordMatch = cleanedText.match(/^([0-9,]+(?:\.[0-9]+)?)\s+[a-zA-Z]/);
  if (startWithWordMatch && !looksLikePhone(startWithWordMatch[1])) {
    const amount = parseFloat(startWithWordMatch[1].replace(/,/g, ''));
    if (isValidAmount(amount)) return amount;
  }
  
  // Priority 3: Number at the very start or alone (e.g., just "500")
  const startAloneMatch = cleanedText.match(/^([0-9,]+(?:\.[0-9]+)?)\s*$/);
  if (startAloneMatch && !looksLikePhone(startAloneMatch[1])) {
    const amount = parseFloat(startAloneMatch[1].replace(/,/g, ''));
    if (isValidAmount(amount)) return amount;
  }
  
  // Priority 4: Number preceded by expense cue (for/to/amount/total)
  const expenseCueMatch = cleanedText.match(/(?:for|to|amount|total|pay|payment)\s+([0-9,]+(?:\.[0-9]+)?)/i);
  if (expenseCueMatch && !looksLikePhone(expenseCueMatch[1])) {
    const amount = parseFloat(expenseCueMatch[1].replace(/,/g, ''));
    if (isValidAmount(amount)) return amount;
  }
  
  // NO FALLBACK - don't just grab any number, it could be a phone/invoice number
  return null;
}

// Stricter extraction for delivery challans - matches explicit currency/value markers
// Also matches keyword-based amounts (amount/value/total + digits) with validation
function extractAmountStrict(text: string): number | null {
  // Handle shorthand notations: "5k" = 5000, "1 lakh" = 100000
  const shorthandPatterns = [
    { pattern: /([0-9,]+(?:\.[0-9]+)?)\s*(?:la+k+h?s?|lacs?)/i, multiplier: 100000 },
    { pattern: /([0-9,]+(?:\.[0-9]+)?)\s*(?:k|thousand|thousands)/i, multiplier: 1000 },
    { pattern: /([0-9,]+(?:\.[0-9]+)?)\s*(?:cr|crore|crores)/i, multiplier: 10000000 },
  ];
  
  for (const { pattern, multiplier } of shorthandPatterns) {
    const match = text.match(pattern);
    if (match) {
      const baseAmount = parseFloat(match[1].replace(/,/g, ''));
      const amount = baseAmount * multiplier;
      if (amount > 0 && amount < 100000000) {
        return amount;
      }
    }
  }
  
  // Standard patterns with currency symbols
  const currencyPatterns = [
    /(?:Rs\.?|₹|INR)\s*([0-9,]+(?:\.[0-9]+)?)/i,
    /([0-9,]+(?:\.[0-9]+)?)\s*(?:Rs\.?|₹|INR|rupees?)/i,
    /([0-9,]+(?:\.[0-9]+)?)\s*\/-/,
  ];
  
  for (const pattern of currencyPatterns) {
    const match = text.match(pattern);
    if (match) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      if (amount > 0 && amount < 100000000) {
        return amount;
      }
    }
  }
  
  // Keyword-based pattern: "amount is 45000", "total: 50,000", "value approx. 45K"
  // Match: keyword + optional filler (up to 20 chars) + digits
  const keywordMatch = text.match(/(?:amount|value|total|price|cost)[\s:=\-–—.,]*(?:\w+[\s:=\-–—.,]*){0,3}([0-9,]+(?:\.[0-9]+)?)/i);
  if (keywordMatch) {
    const amount = parseFloat(keywordMatch[1].replace(/,/g, ''));
    // Validate: must be >= 500 to exclude house numbers, and NOT look like address/postal
    if (amount >= 500 && amount < 100000000) {
      // Additional validation: make sure this number isn't part of an address pattern
      const numberStr = keywordMatch[1].replace(/,/g, '');
      // Check if this same number appears in an address context (after dash or in fraction)
      const isPostalCode = new RegExp(`-${numberStr}\\b`).test(text);
      const isAddressFraction = new RegExp(`\\d+[/]${numberStr}\\b|${numberStr}[/]\\d+`).test(text);
      
      if (!isPostalCode && !isAddressFraction) {
        return amount;
      }
    }
  }
  
  return null;
}

// Detect if message is an income/payment received submission (not expense/QR payment)
function detectIncomeSubmission(text: string): { isIncome: boolean; clientName?: string; bankName?: string; type: 'client_payment' | 'bank_transfer' } {
  const lowerText = text.toLowerCase();
  
  // Expense phrases that indicate outgoing payment request (NOT income) - check first
  const expensePhrases = [
    /\bplease\s+pay\b/i,
    /\bneed\s+(?:to\s+)?pay\b/i,
    /\bfor\s+payment\b/i,
    /\bpay\s+(?:for|to|this)\b/i,
    /\bpending\s+payment\b/i,
    /\bqr\s*(?:code)?\b/i,  // QR code mentions are NOT income
    /\bvendor\s+payment\b/i, // Vendor payments are NOT income
  ];
  
  // Check for expense/QR phrases first - these indicate NOT income
  for (const phrase of expensePhrases) {
    if (phrase.test(lowerText)) {
      return { isIncome: false, type: 'client_payment' };
    }
  }
  
  // Extract bank name from message - patterns like "bank Kishor", "to Kishor bank", "Kishor account"
  let bankName: string | undefined;
  const bankPatterns = [
    /bank\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/i,  // "bank Kishor" or "bank HDFC"
    /(?:to|in)\s+([a-zA-Z]+)\s+(?:bank|account)/i,  // "to Kishor bank" or "in Kishor account"
    /([a-zA-Z]+)\s+(?:bank|account)\b/i,  // "Kishor bank" or "HDFC account"
  ];
  
  for (const pattern of bankPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      // Don't capture income-related keywords as bank names
      const captured = match[1].trim().toLowerCase();
      if (!['income', 'transfer', 'payment', 'received', 'from', 'to', 'the'].includes(captured)) {
        bankName = match[1].trim();
        break;
      }
    }
  }
  
  // Income patterns with client name extraction
  const incomePatterns = [
    /income\s+from\s+(.+)/i,
    /received\s+from\s+(.+)/i,
    /payment\s+received\s*(?:from\s+)?(.+)?/i,
    /client\s+payment\s*(?:from\s+)?(.+)?/i,
    /customer\s+payment\s*(?:from\s+)?(.+)?/i,
    /credited\s+(?:by|from)\s+(.+)/i,
    /bank\s+(?:to\s+bank|transfer)\s*(?:from\s+)?(.+)?/i,
    /transfer\s+received\s*(?:from\s+)?(.+)?/i,
    /advance\s+(?:from|received)\s*(.+)?/i,
    /amount\s+received\s*(?:from\s+)?(.+)?/i,
    /payment\s+from\s+(.+)/i,
    /received\s+payment\s*(?:from\s+)?(.+)?/i,
    /got\s+payment\s*(?:from\s+)?(.+)?/i,
  ];
  
  // Check for income patterns with client name
  for (const pattern of incomePatterns) {
    const match = text.match(pattern);
    if (match) {
      let clientName = match[1]?.trim() || undefined;
      if (clientName) {
        // Remove amount and bank references from client name
        clientName = clientName.replace(/₹?\s*\d+[,\d]*\.?\d*/g, '').replace(/rs\.?\s*/gi, '').replace(/\bbank\s+\w+/gi, '').trim() || clientName;
      }
      const isBankTransfer = /bank\s+(?:to\s+bank|transfer)/i.test(text);
      return { 
        isIncome: true, 
        clientName: clientName || 'Client',
        bankName,
        type: isBankTransfer ? 'bank_transfer' : 'client_payment'
      };
    }
  }
  
  // Simple keyword triggers - "income" keyword is primary indicator
  const simpleIncomeKeywords = [
    /\bcustomer\s+payment\b/i,
    /\bclient\s+payment\b/i,
    /\bincome\s+screenshot\b/i,
    /\bpayment\s+screenshot\b/i,
    /\breceived\s+amount\b/i,
    /\bamount\s+credited\b/i,
    /\bmoney\s+received\b/i,
    /\bfunds\s+received\b/i,
    /\bincome\b/i,  // Simple "income" keyword - highest priority
  ];
  
  for (const keyword of simpleIncomeKeywords) {
    if (keyword.test(lowerText)) {
      return { 
        isIncome: true, 
        clientName: 'Client',
        bankName,
        type: 'client_payment'
      };
    }
  }
  
  return { isIncome: false, type: 'client_payment' };
}

// ============================================================================
// CONVERSATIONAL AI ORCHESTRATOR
// Uses GPT-4o function calling for natural language understanding
// ============================================================================

interface AIParseResult {
  intent: 'leave_request' | 'expense' | 'vendor_payment' | 'income' | 'qr_payment' | 'status_check' | 
          'event_query' | 'bank_query' | 'team_query' | 'delivery_challan' | 'daybook_entry' | 'inventory_item' |
          'greeting' | 'confirmation' | 'correction' | 'cancellation' | 'help' | 'general_question' | 'unknown';
  slots: {
    leaveType?: 'casual' | 'sick' | 'vacation' | 'personal';
    startDate?: string;
    endDate?: string;
    numberOfDays?: number;
    reason?: string;
    amount?: number;
    purpose?: string;
    vendorName?: string;
    eventName?: string;
    clientName?: string;
    bankName?: string;
    queryType?: string;
    timeframe?: string;
    // DC slots
    dcItems?: string;
    dcVehicle?: string;
    dcDestination?: string;
    dcDriver?: string;
    // Daybook slots
    daybookType?: 'income' | 'expense';
    daybookCategory?: string;
    daybookDescription?: string;
    // Inventory item slots
    inventoryItemName?: string;
    inventoryItemQuantity?: number;
    inventoryItemCategory?: string;
    inventoryItemLocation?: string;
  };
  confidence: number;
  needsClarification: string[];
  suggestedResponse: string;
  readyToExecute: boolean;
  userConfirmed: boolean;
}

const AI_ORCHESTRATOR_PROMPT = `You are Oaksy AI, the intelligent WhatsApp assistant for Oakstreet Events. Your job is to understand what employees want to do and help them accomplish it naturally.

ROLE: You're a friendly, smart assistant that understands natural language. You don't require specific formats - you figure out what people mean.

YOUR CAPABILITIES:
1. LEAVE REQUESTS - casual leave, sick leave, vacation, personal leave
2. EXPENSES - petty cash, reimbursements, payments made
3. VENDOR PAYMENTS - payments to vendors/suppliers for events
4. INCOME - client payments, deposits received
5. DELIVERY CHALLAN (DC) - create delivery challans for items being sent to venues
   - Need: items, destination/venue, vehicle number (optional), driver name (optional)
   - Example: "create DC for 5 chairs and 2 tables to Marina Hall"
6. DAYBOOK ENTRY - record income or expense entries
   - Need: type (income/expense), amount, description, category
   - Example: "add daybook entry - expense 5000 for petrol"
7. INVENTORY ITEMS - add items to warehouse inventory (Superadmin and Praveen only)
   - Need: item name, quantity, category (optional), location (optional)
   - Example: "add 50 white chairs to inventory", "new stock - 100 table covers"
8. STATUS CHECKS - pending requests, approvals, balances
9. QUERIES - events, team, financial info, RSVP status

CONVERSATION STYLE:
- Be warm and friendly like a helpful colleague
- Use simple language
- ALWAYS confirm before taking action
- Ask ONE clarifying question at a time if needed
- Be smart about extracting dates - "tomorrow", "next Monday", "19th" should be understood

DATE UNDERSTANDING (Today is ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}):
- "tomorrow" = next day
- "19th" or "19 Jan" = January 19th of current/next occurrence
- "next Monday" = coming Monday
- "2 days from tomorrow" = calculate appropriately
- Convert all dates to DD/MM/YYYY format

AMOUNT UNDERSTANDING:
- "5k" = 5000, "1 lakh" = 100000, "5 thousand" = 5000
- "Rs 5000", "₹5000", "5000/-" = 5000

CONFIRMATION FLOW:
- NEVER execute actions without confirmation
- After understanding the request, summarize and ask "Should I send this for approval?"
- Only set readyToExecute=true when user explicitly confirms (yes, ok, confirm, sure, go ahead, do it)

HANDLING CORRECTIONS:
- If user says "no, 2 days" or "actually 3 days", understand they're correcting
- Update the slots and ask for confirmation again

Respond with valid JSON only.`;

const aiParseMessageFunction = {
  name: "parse_employee_message",
  description: "Parse an employee's WhatsApp message to understand their intent and extract relevant details",
  parameters: {
    type: "object",
    properties: {
      intent: {
        type: "string",
        enum: ["leave_request", "expense", "vendor_payment", "income", "qr_payment", "status_check", 
               "event_query", "bank_query", "team_query", "delivery_challan", "daybook_entry", "inventory_item",
               "greeting", "confirmation", "correction", "cancellation", "help", "general_question", "unknown"],
        description: "The primary intent of the user's message"
      },
      slots: {
        type: "object",
        properties: {
          // Leave request slots
          leaveType: { type: "string", enum: ["casual", "sick", "vacation", "personal"], description: "Type of leave requested" },
          startDate: { type: "string", description: "Start date in DD/MM/YYYY format" },
          endDate: { type: "string", description: "End date in DD/MM/YYYY format (same as startDate for single day)" },
          numberOfDays: { type: "number", description: "Number of days for leave" },
          reason: { type: "string", description: "Reason for leave or expense" },
          // Expense/payment slots
          amount: { type: "number", description: "Amount in rupees (convert 5k to 5000, 1 lakh to 100000)" },
          purpose: { type: "string", description: "Purpose of expense or payment" },
          vendorName: { type: "string", description: "Name of vendor for payment" },
          eventName: { type: "string", description: "Event name if mentioned" },
          clientName: { type: "string", description: "Client name for income" },
          bankName: { type: "string", description: "Bank name if mentioned" },
          // Query slots
          queryType: { type: "string", description: "Type of query (balance, status, list, etc.)" },
          timeframe: { type: "string", description: "Timeframe for queries (today, this_week, etc.)" },
          // Delivery challan slots
          dcItems: { type: "string", description: "Items being delivered (comma-separated or description)" },
          dcVehicle: { type: "string", description: "Vehicle number or description" },
          dcDestination: { type: "string", description: "Delivery destination/venue" },
          dcDriver: { type: "string", description: "Driver name" },
          // Daybook slots
          daybookType: { type: "string", enum: ["income", "expense"], description: "Type of daybook entry" },
          daybookCategory: { type: "string", description: "Category for daybook entry" },
          daybookDescription: { type: "string", description: "Description for daybook entry" },
          // Inventory item slots
          inventoryItemName: { type: "string", description: "Name of the inventory item" },
          inventoryItemQuantity: { type: "number", description: "Quantity of items to add" },
          inventoryItemCategory: { type: "string", description: "Category like Furniture, Decor, Fabric, etc." },
          inventoryItemLocation: { type: "string", description: "Warehouse location" }
        },
        description: "Extracted slot values from the message"
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
        description: "How confident you are in understanding the intent (0-1)"
      },
      needsClarification: {
        type: "array",
        items: { type: "string" },
        description: "List of missing information needed (e.g., ['endDate', 'reason'])"
      },
      suggestedResponse: {
        type: "string",
        description: "A friendly response to send to the user. If all info is available, ask for confirmation. If info is missing, ask for it."
      },
      readyToExecute: {
        type: "boolean",
        description: "True ONLY if user explicitly confirmed (said yes/ok/confirm/sure/go ahead). False otherwise."
      },
      userConfirmed: {
        type: "boolean",
        description: "True if the current message is a confirmation (yes, ok, confirm, sure, proceed, go ahead, do it)"
      }
    },
    required: ["intent", "slots", "confidence", "needsClarification", "suggestedResponse", "readyToExecute", "userConfirmed"]
  }
};

async function aiParseMessage(
  message: string, 
  conversationHistory: ConversationMessage[], 
  currentContext: IntentContext,
  employeeName: string,
  employeeRole: string
): Promise<AIParseResult> {
  try {
    // Build context from conversation history
    const historyContext = conversationHistory.slice(-6).map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }));

    // Add current context if we're in a flow
    let contextPrompt = '';
    if (currentContext && Object.keys(currentContext).length > 0) {
      contextPrompt = `\n\nCURRENT PENDING REQUEST:
${JSON.stringify(currentContext, null, 2)}
If the user confirms, set readyToExecute=true and userConfirmed=true.
If the user corrects something, update the slots and ask for confirmation again.`;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
          role: "system", 
          content: AI_ORCHESTRATOR_PROMPT + contextPrompt + `\n\nEmployee: ${employeeName} (${employeeRole})`
        },
        ...historyContext,
        { role: "user", content: message }
      ],
      tools: [{ type: "function", function: aiParseMessageFunction }],
      tool_choice: { type: "function", function: { name: "parse_employee_message" } },
      temperature: 0.3,
    });

    const toolCall = response.choices[0]?.message?.tool_calls?.[0];
    if (toolCall && 'function' in toolCall && toolCall.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments) as AIParseResult;
      console.log('[AI Orchestrator] Parsed:', JSON.stringify(parsed, null, 2));
      return parsed;
    }

    // Fallback if function calling fails
    return {
      intent: 'unknown',
      slots: {},
      confidence: 0.3,
      needsClarification: [],
      suggestedResponse: "I'm not quite sure what you need. Could you tell me more? For example:\n• Leave request\n• Expense submission\n• Check status",
      readyToExecute: false,
      userConfirmed: false
    };
  } catch (error: any) {
    console.error('[AI Orchestrator] Error:', error.message);
    return {
      intent: 'unknown',
      slots: {},
      confidence: 0,
      needsClarification: [],
      suggestedResponse: "I'm having trouble understanding. Could you please rephrase that?",
      readyToExecute: false,
      userConfirmed: false
    };
  }
}

// Helper to format date from DD/MM/YYYY to Date object
function parseAIDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts.map(p => parseInt(p, 10));
    return new Date(year, month - 1, day);
  }
  return null;
}

// Calculate number of days between two dates (inclusive)
function calculateLeaveDays(startDate: string, endDate: string): number {
  const start = parseAIDate(startDate);
  const end = parseAIDate(endDate);
  if (!start || !end) return 1;
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
}

// ============================================================================
// END CONVERSATIONAL AI ORCHESTRATOR
// ============================================================================

// Detect if message is a vendor payment submission
// Simplified: triggers on "vendor payment", "vendor payments", or "vendor pending payment"
// Format: vendor name, amount (optional event)
// Example: "vendor payments\nFlower shop 5000" or "vendor payment flower shop 5000 sharma wedding"
function detectPendingVendorPayment(text: string): { isPending: boolean; vendorName?: string; amount?: number; eventName?: string } {
  const lowerText = text.toLowerCase().trim();
  
  // Trigger on variations: "vendor payment(s)", "pending vendor payment", "vendor pending payment"
  const triggerPatterns = [
    /vendor\s+payment[s]?/i,
    /pending\s+vendor\s+payment[s]?/i,
    /vendor\s+pending\s+payment[s]?/i,
  ];
  
  const hasTrigger = triggerPatterns.some(p => p.test(lowerText));
  if (!hasTrigger) {
    return { isPending: false };
  }
  
  // Remove the trigger phrase to parse the rest
  let remainingText = text
    .replace(/vendor\s+pending\s+payment[s]?/gi, '')
    .replace(/pending\s+vendor\s+payment[s]?/gi, '')
    .replace(/vendor\s+payment[s]?/gi, '')
    .trim();
  
  // If nothing after trigger, just starting the flow
  if (!remainingText) {
    return { isPending: true };
  }
  
  // Parse simple format: "vendor name amount [event]"
  // Examples:
  // "Flower shop 5000"
  // "Flower shop 5000 sharma wedding"
  // "Ajish Flowers 25000 Megha Wedding"
  
  // Extract amount (any number, no Rs prefix needed)
  const amount = extractAmount(remainingText);
  
  // Extract vendor name (text before the amount)
  let vendorName: string | undefined;
  let eventName: string | undefined;
  
  if (amount) {
    // Find the amount in text and split around it
    const amountMatch = remainingText.match(/(\d{1,3}(?:[,\d]*)?(?:\.\d+)?)/);
    if (amountMatch) {
      const amountIndex = remainingText.indexOf(amountMatch[0]);
      const beforeAmount = remainingText.substring(0, amountIndex).trim();
      const afterAmount = remainingText.substring(amountIndex + amountMatch[0].length).trim();
      
      // Clean up vendor name (remove Rs, ₹, etc.)
      vendorName = beforeAmount
        .replace(/[\-:,]+$/g, '')
        .replace(/^[\-:,]+/g, '')
        .replace(/\brs\.?\s*$/gi, '')
        .replace(/₹\s*$/g, '')
        .trim();
      
      // Event name is anything after the amount
      if (afterAmount && afterAmount.length > 1) {
        eventName = afterAmount
          .replace(/^[\-:,\s]+/g, '')
          .replace(/\bfor\s+/gi, '')
          .replace(/\bevent[\s:]+/gi, '')
          .trim();
      }
    }
  } else {
    // No amount found - treat entire text as vendor name
    vendorName = remainingText.replace(/^[\-:,\s]+/g, '').trim();
  }
  
  // Clean up vendor name
  if (vendorName && vendorName.length < 2) {
    vendorName = undefined;
  }
  
  return { 
    isPending: true, 
    vendorName: vendorName || undefined,
    amount: amount || undefined,
    eventName: eventName || undefined
  };
}

function parseDate(text: string): string | null {
  const patterns = [
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/,
    /(\d{1,2})\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(\d{2,4})?/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }
  return null;
}

// ============== QUERY HANDLER FUNCTIONS ==============

// Get upcoming events based on timeframe
async function getUpcomingEvents(timeframe: string = 'this_week', plannerName?: string): Promise<string> {
  const events = await storage.getAllEvents();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  let endDate: Date;
  let periodLabel: string;
  
  let startDate = new Date(today);
  
  switch (timeframe) {
    case 'today':
      endDate = new Date(today);
      endDate.setHours(23, 59, 59);
      periodLabel = 'today';
      break;
    case 'this_week':
      endDate = new Date(today);
      endDate.setDate(today.getDate() + 7);
      periodLabel = 'this week';
      break;
    case 'next_week':
      startDate = new Date(today);
      startDate.setDate(today.getDate() + 7);
      endDate = new Date(today);
      endDate.setDate(today.getDate() + 14);
      periodLabel = 'next week';
      break;
    case 'this_month':
    default:
      endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      periodLabel = 'this month';
      break;
  }
  
  let filteredEvents = events.filter(e => {
    const eventDate = new Date(e.date);
    return eventDate >= startDate && eventDate <= endDate;
  });
  
  // Filter by planner if specified
  if (plannerName) {
    filteredEvents = filteredEvents.filter(e => 
      e.planner?.toLowerCase().includes(plannerName.toLowerCase())
    );
  }
  
  // Sort by date
  filteredEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  if (filteredEvents.length === 0) {
    return `📅 No events scheduled ${periodLabel}${plannerName ? ` for ${plannerName}` : ''}.`;
  }
  
  const eventList = filteredEvents.slice(0, 5).map(e => {
    const eventDate = new Date(e.date);
    const dateStr = eventDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    return `• *${e.customer || e.title}* - ${dateStr}\n  📍 ${e.venue || 'TBD'}`;
  }).join('\n\n');
  
  const moreText = filteredEvents.length > 5 ? `\n\n_...and ${filteredEvents.length - 5} more events_` : '';
  
  return `📅 *Events ${periodLabel}${plannerName ? ` (${plannerName})` : ''}:*\n\n${eventList}${moreText}`;
}

// Get countdown to a specific event
async function getEventCountdown(eventName: string): Promise<string> {
  const events = await storage.getAllEvents();
  const now = new Date();
  
  // Find matching event
  const matchingEvent = events.find(e => 
    e.customer?.toLowerCase().includes(eventName.toLowerCase()) ||
    e.title?.toLowerCase().includes(eventName.toLowerCase()) ||
    e.venue?.toLowerCase().includes(eventName.toLowerCase())
  );
  
  if (!matchingEvent) {
    return `❌ Couldn't find an event matching "${eventName}". Try the customer name or venue.`;
  }
  
  const eventDate = new Date(matchingEvent.date);
  const diffTime = eventDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return `📅 *${matchingEvent.customer || matchingEvent.title}*\n\nThis event was ${Math.abs(diffDays)} days ago (${eventDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}).`;
  } else if (diffDays === 0) {
    return `🎉 *${matchingEvent.customer || matchingEvent.title}*\n\n*TODAY IS THE DAY!* 🌟\n📍 ${matchingEvent.venue || 'Venue TBD'}`;
  } else if (diffDays === 1) {
    return `⏰ *${matchingEvent.customer || matchingEvent.title}*\n\n*TOMORROW!* Just 1 day to go!\n📍 ${matchingEvent.venue || 'Venue TBD'}`;
  } else {
    return `📅 *${matchingEvent.customer || matchingEvent.title}*\n\n⏳ *${diffDays} days* until the event\n📆 ${eventDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}\n📍 ${matchingEvent.venue || 'Venue TBD'}`;
  }
}

// Get bank balances (superadmin only)
async function getBankBalances(bankName?: string): Promise<string> {
  const banks = await storage.getAllBanks();
  
  if (bankName) {
    const matchingBank = banks.find((b: any) => 
      b.name.toLowerCase().includes(bankName.toLowerCase()) ||
      b.accountNumber?.includes(bankName)
    );
    
    if (!matchingBank) {
      return `❌ Bank "${bankName}" not found.`;
    }
    
    return `🏦 *${matchingBank.name}*\n\n💰 Balance: *₹${parseFloat(matchingBank.balance).toLocaleString('en-IN')}*`;
  }
  
  // Return all banks
  let totalBalance = 0;
  const bankList = banks.map((b: any) => {
    const balance = parseFloat(b.balance);
    totalBalance += balance;
    return `• *${b.name}*: ₹${balance.toLocaleString('en-IN')}`;
  }).join('\n');
  
  return `🏦 *Bank Balances:*\n\n${bankList}\n\n━━━━━━━━━━━━━━\n💰 *Total:* ₹${totalBalance.toLocaleString('en-IN')}`;
}

// Get daily financial summary
async function getDailySummary(date?: string): Promise<string> {
  const targetDate = date || new Date().toISOString().split('T')[0];
  const entries = await storage.getAllDaybookEntries();
  
  const dailyEntries = entries.filter((e: any) => e.date === targetDate);
  
  let totalIncome = 0;
  let totalExpense = 0;
  
  dailyEntries.forEach((e: any) => {
    const amount = parseFloat(e.amount);
    if (e.type === 'income') {
      totalIncome += amount;
    } else {
      totalExpense += amount;
    }
  });
  
  const dateLabel = targetDate === new Date().toISOString().split('T')[0] ? 'Today' : targetDate;
  
  if (dailyEntries.length === 0) {
    return `📊 *${dateLabel}'s Summary:*\n\nNo transactions recorded.`;
  }
  
  // Show last 5 entries
  const recentEntries = dailyEntries.slice(-5).map((e: any) => {
    const emoji = e.type === 'income' ? '📥' : '📤';
    return `${emoji} ₹${parseFloat(e.amount).toLocaleString('en-IN')} - ${e.description?.substring(0, 25) || e.category}`;
  }).join('\n');
  
  return `📊 *${dateLabel}'s Summary:*\n\n📥 Income: ₹${totalIncome.toLocaleString('en-IN')}\n📤 Expense: ₹${totalExpense.toLocaleString('en-IN')}\n💰 Net: ₹${(totalIncome - totalExpense).toLocaleString('en-IN')}\n\n*Recent:*\n${recentEntries}`;
}

// Get pending payments (client dues)
async function getPendingPayments(customerName?: string): Promise<string> {
  const events = await storage.getAllEvents();
  
  let pendingEvents = events.filter((e: any) => {
    const salesValue = parseFloat(e.salesValue || '0');
    const paid = parseFloat(e.paymentReceived || '0');
    return salesValue > paid && salesValue > 0;
  });
  
  if (customerName) {
    pendingEvents = pendingEvents.filter((e: any) => 
      e.customer?.toLowerCase().includes(customerName.toLowerCase())
    );
  }
  
  if (pendingEvents.length === 0) {
    return `✅ No pending payments${customerName ? ` from ${customerName}` : ''}.`;
  }
  
  // Sort by pending amount (highest first)
  pendingEvents.sort((a: any, b: any) => {
    const pendingA = parseFloat(a.salesValue || '0') - parseFloat(a.paymentReceived || '0');
    const pendingB = parseFloat(b.salesValue || '0') - parseFloat(b.paymentReceived || '0');
    return pendingB - pendingA;
  });
  
  let totalPending = 0;
  const pendingList = pendingEvents.slice(0, 5).map((e: any) => {
    const salesValue = parseFloat(e.salesValue || '0');
    const paid = parseFloat(e.paymentReceived || '0');
    const pending = salesValue - paid;
    totalPending += pending;
    return `• *${e.customer}*: ₹${pending.toLocaleString('en-IN')} pending\n  (Paid: ₹${paid.toLocaleString('en-IN')} of ₹${salesValue.toLocaleString('en-IN')})`;
  }).join('\n\n');
  
  const moreText = pendingEvents.length > 5 ? `\n\n_...and ${pendingEvents.length - 5} more clients_` : '';
  
  return `💳 *Pending Payments:*\n\n${pendingList}${moreText}\n\n━━━━━━━━━━━━━━\n💰 *Total Pending:* ₹${totalPending.toLocaleString('en-IN')}`;
}

// Get team availability / who's on leave
async function getTeamStatus(queryType: string, targetDate?: string): Promise<string> {
  const employees = await storage.getAllEmployees();
  const leaveRequests = await storage.getAllLeaveRequests();
  
  const today = targetDate || new Date().toISOString().split('T')[0];
  
  // Get approved leaves for today
  const onLeave = leaveRequests.filter((lr: any) => {
    if (lr.status !== 'approved') return false;
    const start = new Date(lr.startDate);
    const end = new Date(lr.endDate);
    const checkDate = new Date(today);
    return checkDate >= start && checkDate <= end;
  });
  
  const onLeaveNames = onLeave.map((lr: any) => lr.employeeName);
  
  if (queryType === 'on_leave') {
    if (onLeaveNames.length === 0) {
      return `✅ *Team Attendance Today:*\n\nNo one is on leave today. Full team available!`;
    }
    
    return `📋 *On Leave Today:*\n\n${onLeaveNames.map((n: string) => `• ${n}`).join('\n')}\n\n_${employees.length - onLeaveNames.length} team members available._`;
  } else {
    // availability query
    const available = employees.filter((e: any) => !onLeaveNames.includes(e.name));
    
    if (available.length === 0) {
      return `⚠️ No team members available today!`;
    }
    
    const availableList = available.slice(0, 8).map((e: any) => {
      const role = e.designation || '';
      return `• *${e.name}*${role ? ` (${role})` : ''}`;
    }).join('\n');
    
    return `👥 *Available Today:*\n\n${availableList}${available.length > 8 ? `\n\n_...and ${available.length - 8} more_` : ''}`;
  }
}

// Get vendor payment history
async function getVendorHistory(vendorName: string): Promise<string> {
  const entries = await storage.getAllDaybookEntries();
  
  // Filter vendor payments
  const vendorPayments = entries.filter((e: any) => 
    e.type === 'expense' && 
    (e.vendorName?.toLowerCase().includes(vendorName.toLowerCase()) ||
     e.description?.toLowerCase().includes(vendorName.toLowerCase()))
  );
  
  if (vendorPayments.length === 0) {
    return `❌ No payment history found for "${vendorName}".`;
  }
  
  // Calculate total and find recent payments
  let totalPaid = 0;
  vendorPayments.forEach((p: any) => {
    totalPaid += parseFloat(p.amount);
  });
  
  // Sort by date (recent first) and get last 5
  const recentPayments = vendorPayments
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);
  
  const paymentList = recentPayments.map((p: any) => {
    const date = new Date(p.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    return `• ${date}: ₹${parseFloat(p.amount).toLocaleString('en-IN')}${p.eventName ? ` (${p.eventName})` : ''}`;
  }).join('\n');
  
  return `🏪 *${vendorName} - Payment History:*\n\n${paymentList}\n\n━━━━━━━━━━━━━━\n💰 *Total Paid:* ₹${totalPaid.toLocaleString('en-IN')} (${vendorPayments.length} payments)`;
}

// Get event profitability (superadmin only)
async function getEventProfitability(eventName: string): Promise<string> {
  const events = await storage.getAllEvents();
  const entries = await storage.getAllDaybookEntries();
  
  // Find the event
  const event = events.find(e => 
    e.customer?.toLowerCase().includes(eventName.toLowerCase()) ||
    e.title?.toLowerCase().includes(eventName.toLowerCase())
  );
  
  if (!event) {
    return `❌ Event "${eventName}" not found.`;
  }
  
  // Get event income and expenses
  const eventEntries = entries.filter((e: any) => e.eventId === event.id || e.eventName === event.title);
  
  let totalIncome = parseFloat(event.paymentReceived || '0');
  let totalExpense = 0;
  
  eventEntries.forEach((e: any) => {
    const amount = parseFloat(e.amount);
    if (e.type === 'income') {
      totalIncome += amount;
    } else {
      totalExpense += amount;
    }
  });
  
  const salesValue = parseFloat(event.salesValue || '0');
  const profit = totalIncome - totalExpense;
  const pending = salesValue - totalIncome;
  
  return `📊 *${event.customer || event.title}*\n\n💵 Sales Value: ₹${salesValue.toLocaleString('en-IN')}\n📥 Received: ₹${totalIncome.toLocaleString('en-IN')}\n📤 Expenses: ₹${totalExpense.toLocaleString('en-IN')}\n💳 Pending: ₹${pending.toLocaleString('en-IN')}\n\n━━━━━━━━━━━━━━\n${profit >= 0 ? '✅' : '❌'} *Profit:* ₹${profit.toLocaleString('en-IN')}`;
}

// Get monthly summary (superadmin only)
async function getMonthlySummary(year?: number, month?: number): Promise<string> {
  const now = new Date();
  const targetYear = year || now.getFullYear();
  const targetMonth = month || now.getMonth() + 1;
  
  const entries = await storage.getAllDaybookEntries();
  const events = await storage.getAllEvents();
  
  // Filter entries for the month
  const monthStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
  const monthEntries = entries.filter((e: any) => e.date.startsWith(monthStr));
  
  let totalIncome = 0;
  let totalExpense = 0;
  
  monthEntries.forEach((e: any) => {
    const amount = parseFloat(e.amount);
    if (e.type === 'income') {
      totalIncome += amount;
    } else {
      totalExpense += amount;
    }
  });
  
  // Count events this month
  const monthEvents = events.filter(e => e.date.startsWith(monthStr));
  
  const monthName = new Date(targetYear, targetMonth - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  
  return `📊 *${monthName} Summary:*\n\n📅 Events: ${monthEvents.length}\n📥 Income: ₹${totalIncome.toLocaleString('en-IN')}\n📤 Expenses: ₹${totalExpense.toLocaleString('en-IN')}\n\n━━━━━━━━━━━━━━\n💰 *Net:* ₹${(totalIncome - totalExpense).toLocaleString('en-IN')}`;
}

// Check if user is superadmin (by phone)
function isSuperadminPhone(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  // Kishor's number
  return normalized.slice(-10) === '7902373354';
}

// Get RSVP status for an event
async function getRsvpStatus(eventName?: string, queryType: string = 'status'): Promise<string> {
  const events = await storage.getAllEvents();
  
  // If event name provided, find that specific event
  let targetEvent = null;
  if (eventName) {
    const searchTerm = eventName.toLowerCase();
    targetEvent = events.find(e => 
      e.title?.toLowerCase().includes(searchTerm) || 
      e.customer?.toLowerCase().includes(searchTerm)
    );
    
    if (!targetEvent) {
      return `❌ Event "${eventName}" not found.\n\n_Try: "RSVP status for [event name]"_`;
    }
  } else {
    // Get next upcoming event
    const now = new Date();
    const upcomingEvents = events
      .filter(e => new Date(e.date) >= now)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    if (upcomingEvents.length === 0) {
      return `📋 No upcoming events found for RSVP tracking.`;
    }
    
    targetEvent = upcomingEvents[0];
  }
  
  try {
    const stats = await storage.getRsvpStatsByEvent(targetEvent.id);
    const guests = await storage.getEventGuestsByEvent(targetEvent.id);
    
    const eventTitle = targetEvent.customer || targetEvent.title || 'Event';
    const eventDate = new Date(targetEvent.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    
    if (queryType === 'pending') {
      const responses = await storage.getRsvpResponsesByEvent(targetEvent.id);
      const respondedGuestIds = responses.map(r => r.guestId);
      const pendingGuests = guests.filter(g => !respondedGuestIds.includes(g.id));
      
      if (pendingGuests.length === 0) {
        return `✅ All guests have responded for *${eventTitle}*! 🎉`;
      }
      
      const guestList = pendingGuests.slice(0, 10).map(g => `• ${g.name} (${g.phone})`).join('\n');
      const moreText = pendingGuests.length > 10 ? `\n_...and ${pendingGuests.length - 10} more_` : '';
      
      return `📋 *Pending RSVPs for ${eventTitle}*\n📅 ${eventDate}\n\n⏳ *${pendingGuests.length} guests haven't responded:*\n${guestList}${moreText}\n\n_Need help following up?_`;
    }
    
    if (queryType === 'meals') {
      return `🍽️ *Meal Preferences for ${eventTitle}*\n📅 ${eventDate}\n\n🥬 Vegetarian: ${stats.vegetarian}\n🍗 Non-Vegetarian: ${stats.nonVegetarian}\n\n👥 Total Confirmed Attendees: ${stats.totalAttendees}`;
    }
    
    // Default: full status
    const responseRate = stats.total > 0 ? Math.round(((stats.confirmed + stats.declined + stats.maybe) / stats.total) * 100) : 0;
    
    return `📋 *RSVP Status for ${eventTitle}*\n📅 ${eventDate}\n\n📊 Response Rate: ${responseRate}%\n\n✅ Confirmed: ${stats.confirmed}\n❌ Declined: ${stats.declined}\n🤔 Maybe: ${stats.maybe}\n⏳ Pending: ${stats.pending}\n\n👥 Total Attendees: ${stats.totalAttendees}\n🏨 Need Accommodation: ${stats.needsAccommodation}\n🚗 Need Transport: ${stats.needsTransportation}`;
  } catch (error: any) {
    console.error('[RSVP Query] Error:', error.message);
    return `❌ Could not fetch RSVP status. Please try again.`;
  }
}

// ============== END QUERY HANDLER FUNCTIONS ==============

async function analyzeWithAI(
  message: string,
  context: IntentContext,
  conversationHistory: ConversationMessage[],
  hasMedia: boolean,
  userRole?: string,
  userName?: string
): Promise<{
  intent: string;
  extractedData: Partial<IntentContext>;
  needsMoreInfo: string[];
  isComplete: boolean;
  message: string;
}> {
  const recentHistory = conversationHistory.slice(-6);
  
  const historyText = recentHistory.map(m => 
    `${m.role === 'user' ? 'User' : 'Oaksy'}: ${m.content}`
  ).join('\n');

  const currentContext = context ? JSON.stringify(context) : '{}';
  
  // Determine role context
  let roleContext = 'Employee';
  if (userRole === 'superadmin') {
    roleContext = 'Superadmin (full access to all data)';
  } else if (userRole === 'wedding_planner' || userName?.toLowerCase().includes('fida') || userName?.toLowerCase().includes('femina')) {
    roleContext = 'Wedding Planner (can manage events, vendors, production)';
  } else if (userRole === 'accountant') {
    roleContext = 'Accountant (can manage finances, daybook)';
  } else if (userRole === 'manager' || userRole === 'admin') {
    roleContext = 'Manager (can view team data)';
  }
  
  // Get current date/time in IST for the AI to know "today", "in 5 minutes", etc.
  const nowIST = toZonedTime(new Date(), INDIA_TIMEZONE);
  const currentDateTimeIST = `${nowIST.getFullYear()}-${String(nowIST.getMonth() + 1).padStart(2, '0')}-${String(nowIST.getDate()).padStart(2, '0')}T${String(nowIST.getHours()).padStart(2, '0')}:${String(nowIST.getMinutes()).padStart(2, '0')}:00`;
  const readableDateTime = nowIST.toLocaleString('en-IN', { 
    weekday: 'short', 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric', 
    hour: 'numeric', 
    minute: '2-digit', 
    hour12: true,
    timeZone: 'Asia/Kolkata'
  });

  const userPrompt = `CURRENT DATE/TIME (IST - India): ${currentDateTimeIST} (${readableDateTime})

Current conversation context: ${currentContext}
User: ${userName || 'Unknown'} (Role: ${roleContext})
Has image attached: ${hasMedia ? 'Yes' : 'No'}

Recent conversation:
${historyText}

New message: "${message}"

IMPORTANT FOR REMINDERS:
- Use the CURRENT DATE/TIME above when calculating relative times like "in 5 minutes", "after 30 mins", "in 2 hours"
- For "in 5 minutes" at current time, add 5 minutes to the current time and return as reminderDateTime
- Any message containing "remind me" or "create a reminder" or "set a reminder" MUST be intent="reminder"

Understand the intent flexibly - don't require specific formats. Be helpful and conversational.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: OAKSY_SYSTEM_PROMPT },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content || '';
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return {
      intent: 'general',
      extractedData: {},
      needsMoreInfo: [],
      isComplete: false,
      message: content || "Hi! I'm Oaksy, your companion at Oakstreet Events. How can I help you today? 🌳"
    };
  } catch (error: any) {
    console.error('[Oaksy AI] Error:', error.message);
    return {
      intent: 'general',
      extractedData: {},
      needsMoreInfo: [],
      isComplete: false,
      message: "Hi! I'm Oaksy, your companion at Oakstreet Events. How can I help you? 🌳"
    };
  }
}

// Superadmin WhatsApp number for approval notifications
const SUPERADMIN_WHATSAPP = '+917902373354';

// Authorized lead submitters (can add leads to Oak Sales via WhatsApp)
const AUTHORIZED_LEAD_SUBMITTERS: Record<string, string> = {
  'kishor': '+917902373354',
  'anjana saji': '+918281569046',
};

// Wedding Planner phone numbers for lead notifications
const WEDDING_PLANNER_PHONES: Record<string, string> = {
  'fida fathima': '+919895810975',
  'fida': '+919895810975',
  'femina km': '+917306687284',
  'femina': '+917306687284',
};

// Authorized DC creators (can create Delivery Challans via WhatsApp)
const AUTHORIZED_DC_CREATORS: Record<string, string> = {
  'kishor': '+917902373354',           // Superadmin
  'fida fathima': '+919895810975',     // Wedding Planner
  'femina km': '+917306687284',        // Wedding Planner
  'sabitha': '+917558841046',          // Accountant (Sabitha MA)
  'praveen': '+917736126539',          // Employee (Praveen P V)
  'test employee': '+917025063335',    // Test Employee
};

// Authorized Inventory creators (can add inventory items via WhatsApp)
const AUTHORIZED_INVENTORY_CREATORS: Record<string, string> = {
  'kishor': '+917902373354',           // Superadmin
  'praveen': '+917736126539',          // Employee (Praveen P V)
  'test employee': '+917025063335',    // Test Employee
};

async function getSuperadminPhone(): Promise<string> {
  return SUPERADMIN_WHATSAPP;
}

function isAuthorizedLeadSubmitter(phone: string): boolean {
  const normalizedPhone = phone.replace(/\D/g, '').slice(-10);
  return Object.values(AUTHORIZED_LEAD_SUBMITTERS).some(authPhone => {
    const normalizedAuthPhone = authPhone.replace(/\D/g, '').slice(-10);
    return normalizedPhone === normalizedAuthPhone;
  });
}

function getLeadSubmitterName(phone: string): string {
  const normalizedPhone = phone.replace(/\D/g, '').slice(-10);
  for (const [name, authPhone] of Object.entries(AUTHORIZED_LEAD_SUBMITTERS)) {
    const normalizedAuthPhone = authPhone.replace(/\D/g, '').slice(-10);
    if (normalizedPhone === normalizedAuthPhone) {
      return name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }
  return 'Unknown';
}

function getWeddingPlannerPhone(plannerName: string): string | null {
  const normalized = plannerName.toLowerCase().trim();
  for (const [key, phone] of Object.entries(WEDDING_PLANNER_PHONES)) {
    // Check both directions: planner name matches key OR key contains planner name
    if (normalized.includes(key) || key.includes(normalized)) {
      return phone;
    }
  }
  return null;
}

function isAuthorizedDcCreator(phone: string): boolean {
  const normalizedPhone = phone.replace(/\D/g, '').slice(-10);
  return Object.values(AUTHORIZED_DC_CREATORS).some(authPhone => {
    const normalizedAuthPhone = authPhone.replace(/\D/g, '').slice(-10);
    return normalizedPhone === normalizedAuthPhone;
  });
}

function isAuthorizedInventoryCreator(phone: string): boolean {
  const normalizedPhone = phone.replace(/\D/g, '').slice(-10);
  return Object.values(AUTHORIZED_INVENTORY_CREATORS).some(authPhone => {
    const normalizedAuthPhone = authPhone.replace(/\D/g, '').slice(-10);
    return normalizedPhone === normalizedAuthPhone;
  });
}

async function downloadAndUploadInventoryPhoto(
  mediaUrl: string,
  itemName: string
): Promise<string | null> {
  try {
    // Skip if URL is already a signed GCS URL (already uploaded)
    if (mediaUrl.includes('storage.googleapis.com') || mediaUrl.includes('storage.cloud.google.com')) {
      console.log('[Inventory] Photo already uploaded, using existing URL');
      return mediaUrl;
    }
    
    const { ObjectStorageService } = await import('./objectStorage');
    
    // Build headers for Twilio URLs
    const headers: Record<string, string> = {};
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (mediaUrl.includes('twilio.com') && twilioAccountSid && twilioAuthToken) {
      const auth = Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64');
      headers['Authorization'] = `Basic ${auth}`;
    }
    
    console.log('[Inventory] Downloading image from:', mediaUrl.substring(0, 50) + '...');
    const response = await fetch(mediaUrl, { headers });
    
    if (!response.ok) {
      console.error('[Inventory] Failed to download image:', response.status, response.statusText);
      return null;
    }
    
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await response.arrayBuffer());
    
    if (buffer.length === 0) {
      console.error('[Inventory] Downloaded empty image buffer');
      return null;
    }
    
    const sanitizedName = itemName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').substring(0, 30);
    const extension = contentType.includes('png') ? 'png' : 
                     contentType.includes('gif') ? 'gif' : 
                     contentType.includes('webp') ? 'webp' : 'jpg';
    const filename = `inventory-photos/${sanitizedName}-${Date.now()}.${extension}`;
    
    const objectStorage = new ObjectStorageService();
    const uploadedUrl = await objectStorage.uploadPublicBuffer(buffer, filename, contentType);
    
    console.log('[Inventory] Photo uploaded successfully:', filename);
    return uploadedUrl;
  } catch (error: any) {
    console.error('[Inventory] Error uploading photo:', error.message);
    return null;
  }
}

async function handleInventoryItemCreation(
  context: IntentContext,
  mediaUrl: string | undefined,
  fromNumber: string,
  conversation: any
): Promise<{ success: boolean; message: string }> {
  try {
    const itemName = context.inventoryItemName;
    const quantity = context.inventoryItemQuantity || 0;
    const category = context.inventoryItemCategory || 'General';
    const location = context.inventoryItemLocation || 'Warehouse';
    
    if (!itemName) {
      return { success: false, message: 'Missing item name' };
    }
    
    let photoUrl: string | null = null;
    if (mediaUrl || context.inventoryItemPhotoUrl) {
      const photoSource = mediaUrl || context.inventoryItemPhotoUrl;
      if (photoSource) {
        photoUrl = await downloadAndUploadInventoryPhoto(photoSource, itemName);
      }
    }
    
    const inventoryItem = await storage.createInventoryItem({
      name: itemName,
      category: category,
      stockQuantity: quantity,
      location: location,
      photos: photoUrl ? [photoUrl] : [],
      isActive: true,
      unitCost: '0',
    });
    
    console.log('[Inventory] Item created:', inventoryItem.id, itemName, quantity);
    
    await storage.updateWhatsappConversation(conversation.id, {
      activeIntent: null,
      intentContext: {},
      conversationHistory: [],
      currentState: 'idle',
    });
    
    const photoNote = photoUrl ? ' Photo saved too!' : '';
    return {
      success: true,
      message: `Done! ${itemName} (${quantity} units) has been added to the warehouse.${photoNote}\n\nCategory: ${category} | Location: ${location}`
    };
  } catch (error: any) {
    console.error('[Inventory] Error creating item:', error.message);
    return {
      success: false,
      message: `Hmm, something went wrong while adding that to inventory. Can you try again?`
    };
  }
}

function generateUniqueApprovalCode(prefix: string): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 4).toUpperCase();
  return `${prefix}${timestamp.slice(-4)}${random}`;
}

// Save pending approval context to superadmin's conversation for natural language approval
async function saveSuperadminPendingContext(pendingContext: {
  type: 'leave_request' | 'expense' | 'vendor_payment' | 'qr_payment' | 'income';
  requestId: string | number;
  employeeId: string;
  employeeName: string;
  employeePhone: string;
  details: string;
  reason?: string;
  amount?: number | string;
  vendorName?: string;
  purpose?: string;
  eventName?: string;
}): Promise<void> {
  try {
    // Get or create superadmin's conversation
    let superadminConvo = await storage.getWhatsappConversationByPhone(SUPERADMIN_WHATSAPP);
    
    if (!superadminConvo) {
      superadminConvo = await storage.createWhatsappConversation({
        phoneNumber: SUPERADMIN_WHATSAPP,
        currentState: 'idle',
      });
    }
    
    // Save the pending context for natural language approval
    await storage.updateWhatsappConversation(superadminConvo.id, {
      activeIntent: 'pending_approval',
      intentContext: pendingContext,
      currentState: 'awaiting_approval_decision',
    });
    
    console.log('[Superadmin Context] Saved pending approval:', pendingContext.type, pendingContext.requestId);
  } catch (err) {
    console.error('[Superadmin Context] Failed to save context:', err);
  }
}

async function createExpenseRequest(
  employeeId: string,
  employeeName: string,
  purpose: string,
  amount: number,
  mediaUrl?: string
): Promise<{ approvalCode: string; requestId: string }> {
  const approvalCode = generateUniqueApprovalCode('EXP');
  const today = new Date().toISOString().split('T')[0];

  const expenseData: InsertExpenseReimbursement = {
    employeeId,
    requestDate: today,
    expenseDate: today,
    category: 'other',
    description: purpose,
    amount: amount.toString(),
    status: 'pending',
    voucherPath: mediaUrl || null,
  };

  const expense = await storage.createExpenseReimbursement(expenseData);
  const superadminPhone = await getSuperadminPhone();

  await storage.createWhatsappPendingApproval({
    approvalCode,
    type: 'expense',
    requestId: expense.id,
    employeeId,
    employeeName,
    description: purpose,
    amount: amount.toString(),
    mediaUrl: mediaUrl || null,
    status: 'pending',
    approverPhone: superadminPhone,
  });

  return { approvalCode, requestId: expense.id };
}

async function createLeaveRequest(
  employeeId: string,
  employeeName: string,
  startDate: string,
  endDate: string,
  reason: string,
  leaveType: string
): Promise<{ approvalCode: string; requestId: string }> {
  const approvalCode = generateUniqueApprovalCode('LV');

  const leaveData: InsertLeaveRequest = {
    employeeId,
    startDate,
    endDate,
    reason,
    leaveType: leaveType || 'casual',
    status: 'pending',
  };

  const leave = await storage.createLeaveRequest(leaveData);
  const superadminPhone = await getSuperadminPhone();

  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  await storage.createWhatsappPendingApproval({
    approvalCode,
    type: 'leave',
    requestId: leave.id,
    employeeId,
    employeeName,
    description: `${leaveType || 'Leave'} (${days} day${days > 1 ? 's' : ''}) - ${reason}`,
    status: 'pending',
    approverPhone: superadminPhone,
  });

  return { approvalCode, requestId: leave.id };
}

async function getEmployeeStatus(employeeId: string, employeeName: string): Promise<string> {
  const pendingExpenses = await storage.getExpenseReimbursementsByEmployee(employeeId);
  const pendingLeaves = await storage.getLeaveRequestsByEmployee(employeeId);
  
  const recentExpenses = pendingExpenses.slice(0, 3);
  const recentLeaves = pendingLeaves.slice(0, 3);
  
  let statusMessage = `📋 *Your Request Status*\n━━━━━━━━━━━━━━━━━━\n\n`;
  
  if (recentExpenses.length > 0) {
    statusMessage += `💰 *Recent Expenses:*\n`;
    recentExpenses.forEach((exp: any) => {
      const icon = exp.status === 'approved' ? '✅' : exp.status === 'rejected' ? '❌' : '⏳';
      statusMessage += `${icon} ₹${exp.amount} - ${exp.purpose} (${exp.status})\n`;
    });
    statusMessage += `\n`;
  }
  
  if (recentLeaves.length > 0) {
    statusMessage += `📅 *Recent Leave Requests:*\n`;
    recentLeaves.forEach((leave: any) => {
      const icon = leave.status === 'approved' ? '✅' : leave.status === 'rejected' ? '❌' : '⏳';
      statusMessage += `${icon} ${leave.startDate} - ${leave.reason} (${leave.status})\n`;
    });
  }
  
  if (recentExpenses.length === 0 && recentLeaves.length === 0) {
    statusMessage += `_No recent requests found._\n\nNeed to submit something? Just tell me! 🌳`;
  }
  
  return statusMessage;
}

async function notifySuperadmin(
  type: 'expense' | 'leave',
  approvalCode: string,
  employeeName: string,
  details: string,
  amount?: number,
  mediaUrl?: string
): Promise<void> {
  const superadminPhone = await getSuperadminPhone();
  if (!superadminPhone) return;

  let message = '';
  if (type === 'expense') {
    message = `🔔 *New Expense Request*\n━━━━━━━━━━━━━━━━━━\n\n👤 *From:* ${employeeName}\n📝 *Purpose:* ${details}\n💰 *Amount:* ₹${amount?.toLocaleString('en-IN')}\n📸 *Receipt:* ${mediaUrl ? 'Attached' : 'None'}\n🔖 *Code:* ${approvalCode}\n\n━━━━━━━━━━━━━━━━━━\n_Reply:_\n*A ${approvalCode}* - Approve\n*R ${approvalCode} reason* - Reject`;
  } else {
    message = `🔔 *New Leave Request*\n━━━━━━━━━━━━━━━━━━\n\n👤 *From:* ${employeeName}\n📅 *Details:* ${details}\n🔖 *Code:* ${approvalCode}\n\n━━━━━━━━━━━━━━━━━━\n_Reply:_\n*A ${approvalCode}* - Approve\n*R ${approvalCode} reason* - Reject`;
  }

  await sendWhatsAppMessage(superadminPhone, message);
}

// Superadmin Lead System Prompt
const SUPERADMIN_LEAD_PROMPT = `You are Oaksy AI, helping the Superadmin of Oakstreet Events add leads to Oak Sales via WhatsApp.

When the superadmin sends a message about a potential client/lead, extract:
1. Customer Name (required)
2. Customer Phone (if available) 
3. Event Date (if available)
4. Venue (if available)
5. Assigned Wedding Planner - must be either "Fida Fathima" or "Femina KM"

PERSONALITY:
- Professional and efficient
- Quick to extract and confirm information
- Use simple confirmations

RESPONSE FORMAT - Always respond with valid JSON:
{
  "isLead": true/false,
  "extractedData": {
    "customerName": string or null,
    "customerPhone": string or null,
    "eventDate": "YYYY-MM-DD" or null,
    "venue": string or null,
    "weddingPlanner": "Fida Fathima" | "Femina KM" | null
  },
  "needsMoreInfo": ["customerName", "weddingPlanner"] or [],
  "isComplete": boolean,
  "message": "Your response to the superadmin"
}

If the message doesn't look like a lead (e.g., approval commands), set isLead: false.`;

interface LeadContext {
  customerName?: string;
  customerPhone?: string;
  eventDate?: string;
  venue?: string;
  weddingPlanner?: string;
  confirmed?: boolean;
}

async function analyzeLeadWithAI(
  message: string,
  context: LeadContext,
  conversationHistory: ConversationMessage[]
): Promise<{
  isLead: boolean;
  extractedData: Partial<LeadContext>;
  needsMoreInfo: string[];
  isComplete: boolean;
  message: string;
}> {
  const recentHistory = conversationHistory.slice(-6);
  
  const historyText = recentHistory.map(m => 
    `${m.role === 'user' ? 'Superadmin' : 'Oaksy'}: ${m.content}`
  ).join('\n');
  
  const userPrompt = `Current context: ${JSON.stringify(context)}
Recent conversation:
${historyText}

Superadmin's message: "${message}"

Extract lead information and respond.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SUPERADMIN_LEAD_PROMPT },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.5,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content || '';
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return {
      isLead: false,
      extractedData: {},
      needsMoreInfo: [],
      isComplete: false,
      message: content || "I can help you add leads. Send me customer details!"
    };
  } catch (error: any) {
    console.error('[Oaksy AI Lead] Error:', error.message);
    return {
      isLead: false,
      extractedData: {},
      needsMoreInfo: [],
      isComplete: false,
      message: "Sorry, I had trouble processing that. Please try again."
    };
  }
}

async function createLeadInOakSales(
  leadContext: LeadContext,
  createdBy: string
): Promise<{ dealId: string; contactId: string }> {
  // Find the wedding planner user ID first
  let ownerId: string | null = null;
  let plannerUser: any = null;
  
  if (leadContext.weddingPlanner) {
    const users = await storage.getAllUsers();
    plannerUser = users.find(u => 
      u.name.toLowerCase().includes(leadContext.weddingPlanner!.toLowerCase().split(' ')[0])
    );
    if (plannerUser) {
      ownerId = plannerUser.id;
    }
  }
  
  // Get or create a pipeline for the wedding planner
  const pipelines = await storage.getAllSalesPipelines();
  const plannerName = leadContext.weddingPlanner || 'General';
  
  // Look for existing pipeline matching the planner's name
  let pipeline = pipelines.find(p => 
    p.name.toLowerCase().includes(plannerName.toLowerCase().split(' ')[0])
  );
  
  if (!pipeline) {
    // Create a new pipeline for this wedding planner
    pipeline = await storage.createSalesPipeline({
      name: plannerName,
      description: `Pipeline for ${plannerName}`,
      isDefault: false,
    });
    console.log(`[Oaksy] Created new pipeline for ${plannerName}: ${pipeline.id}`);
  }
  
  const stages = await storage.getSalesStagesByPipelineId(pipeline.id);
  let firstStage = stages.sort((a, b) => a.order - b.order)[0];
  
  if (!firstStage) {
    // Create default stages for the pipeline
    firstStage = await storage.createSalesStage({
      pipelineId: pipeline.id,
      name: 'Lead',
      order: 1,
      color: '#6B7280',
      probability: 10,
    });
    
    // Add more stages
    await storage.createSalesStage({
      pipelineId: pipeline.id,
      name: 'Contacted',
      order: 2,
      color: '#3B82F6',
      probability: 30,
    });
    
    await storage.createSalesStage({
      pipelineId: pipeline.id,
      name: 'Meeting Scheduled',
      order: 3,
      color: '#F59E0B',
      probability: 50,
    });
    
    await storage.createSalesStage({
      pipelineId: pipeline.id,
      name: 'Proposal Sent',
      order: 4,
      color: '#8B5CF6',
      probability: 70,
    });
    
    await storage.createSalesStage({
      pipelineId: pipeline.id,
      name: 'Won',
      order: 5,
      color: '#10B981',
      probability: 100,
    });
    
    await storage.createSalesStage({
      pipelineId: pipeline.id,
      name: 'Lost',
      order: 6,
      color: '#EF4444',
      probability: 0,
    });
  }
  
  // Create the contact
  const nameParts = (leadContext.customerName || 'Unknown').split(' ');
  const contact = await storage.createSalesContact({
    firstName: nameParts[0],
    lastName: nameParts.slice(1).join(' ') || null,
    phone: leadContext.customerPhone || null,
    source: 'WhatsApp',
    ownerId,
  });
  
  // Create the deal
  const deal = await storage.createSalesDeal({
    title: `${leadContext.customerName || 'New Lead'} - ${leadContext.venue || 'TBD'}`,
    pipelineId: pipeline.id,
    stageId: firstStage.id,
    contactId: contact.id,
    ownerId,
    eventDate: leadContext.eventDate || null,
    venue: leadContext.venue || null,
    source: 'WhatsApp',
    status: 'open',
    eventType: 'wedding',
  });
  
  return { dealId: deal.id, contactId: contact.id };
}

async function notifyWeddingPlanner(
  plannerName: string,
  leadDetails: LeadContext,
  submitterName?: string
): Promise<boolean> {
  console.log('[Oaksy] Attempting to notify wedding planner:', plannerName);
  const plannerPhone = getWeddingPlannerPhone(plannerName);
  if (!plannerPhone) {
    console.log('[Oaksy] No phone number found for planner:', plannerName, '- Available planners:', Object.keys(WEDDING_PLANNER_PHONES).join(', '));
    return false;
  }
  
  console.log('[Oaksy] Found phone for planner:', plannerName, '→', plannerPhone);
  const submittedBy = submitterName || 'Superadmin';
  
  const message = `🌳 *New Lead Assigned*\n━━━━━━━━━━━━━━━━━━\n\n👤 *Customer:* ${leadDetails.customerName || 'Not specified'}\n📞 *Phone:* ${leadDetails.customerPhone || 'Not provided'}\n📅 *Event Date:* ${leadDetails.eventDate || 'TBD'}\n📍 *Venue:* ${leadDetails.venue || 'TBD'}\n\n_Added via WhatsApp by ${submittedBy}_\n\nCheck Oak Sales for more details 🌿`;
  
  try {
    console.log('[Oaksy] Sending WhatsApp notification to planner:', plannerPhone);
    await sendWhatsAppMessage(plannerPhone, message);
    console.log('[Oaksy] Successfully notified wedding planner:', plannerName);
    return true;
  } catch (error) {
    console.error('[Oaksy] Failed to notify planner:', plannerName, 'at', plannerPhone, '- Error:', error);
    return false;
  }
}

async function handleSuperadminLeadMessage(
  messageText: string,
  fromNumber: string
): Promise<string | null> {
  // Get or create conversation for superadmin
  const conversation = await storage.getOrCreateWhatsappConversation(fromNumber);
  
  let leadContext: LeadContext = {};
  let history: ConversationMessage[] = [];
  
  try {
    const rawContext = conversation.intentContext;
    if (typeof rawContext === 'string') {
      leadContext = JSON.parse(rawContext) || {};
    } else if (rawContext && typeof rawContext === 'object') {
      leadContext = rawContext as LeadContext;
    }
  } catch {
    leadContext = {};
  }
  
  try {
    const rawHistory = conversation.conversationHistory;
    if (typeof rawHistory === 'string') {
      history = JSON.parse(rawHistory) || [];
    } else if (Array.isArray(rawHistory)) {
      history = rawHistory as ConversationMessage[];
    }
  } catch {
    history = [];
  }
  
  history.push({ role: 'user', content: messageText, timestamp: Date.now() });
  if (history.length > 10) history = history.slice(-10);
  
  // Analyze the message for lead content
  const analysis = await analyzeLeadWithAI(messageText, leadContext, history);
  
  // If it's not a lead message, return null to let other handlers process it
  if (!analysis.isLead) {
    return null;
  }
  
  // Merge extracted data into context
  leadContext = { ...leadContext, ...analysis.extractedData };
  
  // Check if user is confirming
  const lowerMessage = messageText.toLowerCase();
  if ((lowerMessage === 'yes' || lowerMessage === 'confirm' || lowerMessage === 'ok') && 
      leadContext.customerName && leadContext.weddingPlanner) {
    leadContext.confirmed = true;
  }
  
  // If complete and confirmed, create the lead
  if (analysis.isComplete && leadContext.confirmed && leadContext.customerName && leadContext.weddingPlanner) {
    try {
      const { dealId } = await createLeadInOakSales(leadContext, 'superadmin');
      
      // Notify the wedding planner
      const submitterName = getLeadSubmitterName(fromNumber);
      await notifyWeddingPlanner(leadContext.weddingPlanner, leadContext, submitterName);
      
      // Reset context
      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: null,
        intentContext: {},
        conversationHistory: [],
        currentState: 'idle',
      });
      
      const response = `✅ *Lead Added Successfully!*\n\n👤 ${leadContext.customerName}\n📍 ${leadContext.venue || 'TBD'}\n📅 ${leadContext.eventDate || 'TBD'}\n👰 Assigned to: ${leadContext.weddingPlanner}\n\n_${leadContext.weddingPlanner} has been notified via WhatsApp!_ 🌳`;
      
      return response;
    } catch (error: any) {
      console.error('[Oaksy] Error creating lead:', error.message);
      return `❌ Sorry, I couldn't create this lead. Error: ${error.message}\n\nPlease try again or add it directly in Oak Sales.`;
    }
  }
  
  // If we have enough info but not confirmed, ask for confirmation
  if (leadContext.customerName && leadContext.weddingPlanner && !leadContext.confirmed) {
    await storage.updateWhatsappConversation(conversation.id, {
      activeIntent: 'lead',
      intentContext: leadContext,
      conversationHistory: history,
      currentState: 'awaiting_lead_confirmation',
    });
    
    const response = `📝 *Confirm Lead Details:*\n━━━━━━━━━━━━━━━━━━\n\n👤 *Customer:* ${leadContext.customerName}\n📞 *Phone:* ${leadContext.customerPhone || 'Not provided'}\n📅 *Event Date:* ${leadContext.eventDate || 'TBD'}\n📍 *Venue:* ${leadContext.venue || 'TBD'}\n👰 *Wedding Planner:* ${leadContext.weddingPlanner}\n\n_Reply "Yes" to add this lead_ 🌳`;
    
    history.push({ role: 'assistant', content: response, timestamp: Date.now() });
    await storage.updateWhatsappConversation(conversation.id, { conversationHistory: history });
    
    return response;
  }
  
  // Need more information
  await storage.updateWhatsappConversation(conversation.id, {
    activeIntent: 'lead',
    intentContext: leadContext,
    conversationHistory: history,
    currentState: 'collecting_lead_info',
  });
  
  history.push({ role: 'assistant', content: analysis.message, timestamp: Date.now() });
  await storage.updateWhatsappConversation(conversation.id, { conversationHistory: history });
  
  return analysis.message;
}

export async function handleOaksyWhatsAppMessage(
  fromNumber: string,
  body: string,
  mediaUrl?: string,
  mediaContentType?: string,
  messageId?: string
): Promise<string> {
  console.log('[Oaksy] Processing message from:', fromNumber, 'Body:', body?.substring(0, 50));
  
  const normalizedPhone = normalizePhoneNumber(fromNumber);
  console.log('[Oaksy] Normalized phone:', normalizedPhone);
  
  try {
    await storage.createWhatsappInboundMessage({
      messageId: messageId || `msg_${Date.now()}`,
      fromNumber: normalizedPhone,
      toNumber: process.env.TWILIO_WHATSAPP_NUMBER || '',
      body,
      mediaUrl,
      mediaContentType,
      conversationId: null,
      processedAt: new Date(),
    });
    console.log('[Oaksy] Saved inbound message');
  } catch (inboundError: any) {
    console.error('[Oaksy] Failed to save inbound message:', inboundError.message);
    // Continue processing even if saving inbound message fails
  }

  const conversation = await storage.getOrCreateWhatsappConversation(normalizedPhone);
  console.log('[Oaksy] Got conversation:', conversation.id);
  
  const messageText = body.trim();
  const lowerMessage = messageText.toLowerCase();
  
  // GLOBAL STOP/CANCEL COMMAND - Allows users to exit any ongoing flow
  const isStopCommand = /^(stop|cancel|exit|reset|start over|nevermind|never mind|forget it|cancel transaction|abort)$/i.test(lowerMessage);
  
  // Common greetings that should reset ongoing flows
  const isGreeting = /^(hi|hello|hey|hii|hiii|hiiii|hai|hola|good morning|good afternoon|good evening|namaste|yo)$/i.test(lowerMessage.trim());
  
  if (isStopCommand && conversation.activeIntent) {
    // User wants to cancel the current flow
    await storage.updateWhatsappConversation(conversation.id, {
      activeIntent: null,
      intentContext: null,
      currentState: 'idle',
      conversationHistory: [],
    });
    
    return `👍 Got it! I've cancelled the current action.\n\n_What would you like to do? Just say "help" if you need options._ 🌳`;
  }
  
  // If user sends a greeting while in an active flow, reset and greet them fresh
  if (isGreeting && conversation.activeIntent) {
    await storage.updateWhatsappConversation(conversation.id, {
      activeIntent: null,
      intentContext: null,
      currentState: 'idle',
      conversationHistory: [],
    });
    // Don't return here - let the greeting be processed normally below
  }
  
  // LOOP DETECTION - Check if we've sent the same message multiple times
  // This helps break out of stuck states
  let loopDetectionHistory: ConversationMessage[] = [];
  try {
    if (Array.isArray(conversation.conversationHistory)) {
      loopDetectionHistory = conversation.conversationHistory as ConversationMessage[];
    } else if (typeof conversation.conversationHistory === 'string') {
      loopDetectionHistory = JSON.parse(conversation.conversationHistory) || [];
    }
  } catch {
    loopDetectionHistory = [];
  }
  
  const recentAssistantMessages = loopDetectionHistory
    .filter(m => m.role === 'assistant')
    .slice(-3);
  
  // If we have 2+ identical recent responses, something is stuck - auto-reset
  if (recentAssistantMessages.length >= 2) {
    const lastTwo = recentAssistantMessages.slice(-2);
    if (lastTwo[0].content === lastTwo[1].content) {
      // Stuck in a loop - reset to idle
      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: null,
        intentContext: null,
        currentState: 'idle',
        conversationHistory: [],
      });
      
      return `I got a bit confused there! 😅\n\nLet's start fresh. What can I help you with?\n\n_Try "help" to see what I can do_ 🌳`;
    }
  }
  
  // Check if this is from the superadmin FIRST (before employee check)
  const isSuperadminByPhone = normalizedPhone === SUPERADMIN_WHATSAPP || 
                              normalizedPhone.endsWith(SUPERADMIN_WHATSAPP.slice(-10)) ||
                              SUPERADMIN_WHATSAPP.endsWith(normalizedPhone.slice(-10));
  
  // Handle superadmin (Kishor) messages directly
  if (isSuperadminByPhone) {
    // Handle approval commands (A/R for expenses/leave)
    if (lowerMessage.match(/^(a|approve)\s+([a-z]{2,3}\d+)/i) || 
        lowerMessage.match(/^(r|reject)\s+([a-z]{2,3}\w+)/i)) {
      return handleSuperadminApproval(messageText, normalizedPhone);
    }
    
    // ============================================================================
    // NATURAL LANGUAGE APPROVAL: Handle "approved", "rejected", etc.
    // ============================================================================
    const isApprovalWord = /^(approved?|yes|ok|okay|accept|go ahead|proceed|grant|allow|fine|done|yep)$/i.test(lowerMessage.trim());
    const isRejectionWord = /^(rejected?|no|deny|denied|decline|not approved|cancel|refuse|nope)$/i.test(lowerMessage.trim());
    
    if ((isApprovalWord || isRejectionWord) && conversation.activeIntent === 'pending_approval') {
      let pendingCtx: any = {};
      try {
        if (typeof conversation.intentContext === 'string') {
          pendingCtx = JSON.parse(conversation.intentContext) || {};
        } else if (conversation.intentContext) {
          pendingCtx = conversation.intentContext;
        }
      } catch { pendingCtx = {}; }
      
      console.log('[Natural Approval] Processing:', { isApprovalWord, isRejectionWord, pendingCtx });
      
      if (pendingCtx.requestId && pendingCtx.type) {
        const action = isApprovalWord ? 'approved' : 'rejected';
        
        try {
          if (pendingCtx.type === 'leave_request') {
            // Update leave request status
            await storage.updateLeaveRequest(pendingCtx.requestId, { 
              status: action,
              approvedAt: action === 'approved' ? new Date() : undefined,
            });
            
            // Reset superadmin conversation
            await storage.updateWhatsappConversation(conversation.id, {
              activeIntent: null,
              intentContext: null,
              currentState: 'idle',
            });
            
            // Notify employee
            if (pendingCtx.employeePhone) {
              const emoji = action === 'approved' ? '🎉' : '😔';
              const statusText = action === 'approved' ? 'approved! ✅\n\nEnjoy your time off! 🌴' : 'not approved. ❌';
              try {
                await sendWhatsAppMessage(pendingCtx.employeePhone, 
                  `${emoji} *Leave Request Update*\n\nYour leave request has been *${statusText}*`);
              } catch (notifyErr) {
                console.error('[Natural Approval] Failed to notify employee:', notifyErr);
              }
            }
            
            const emoji = action === 'approved' ? '✅' : '❌';
            return `${emoji} Leave request for *${pendingCtx.employeeName}* ${action}.\n\n_Employee has been notified._ 🌳`;
          } else if (pendingCtx.type === 'expense') {
            // Update expense status
            await storage.updateExpenseReimbursement(pendingCtx.requestId, { status: action });
            
            // Reset conversation
            await storage.updateWhatsappConversation(conversation.id, {
              activeIntent: null,
              intentContext: null,
              currentState: 'idle',
            });
            
            // Notify employee
            if (pendingCtx.employeePhone) {
              const emoji = action === 'approved' ? '🎉' : '😔';
              const amountText = pendingCtx.amount ? `₹${parseFloat(pendingCtx.amount).toLocaleString('en-IN')}` : '';
              try {
                await sendWhatsAppMessage(pendingCtx.employeePhone,
                  `${emoji} *Expense Update*\n\nYour expense request${amountText ? ` for ${amountText}` : ''} has been *${action}*!`);
              } catch (notifyErr) {
                console.error('[Natural Approval] Failed to notify employee:', notifyErr);
              }
            }
            
            const emoji = action === 'approved' ? '✅' : '❌';
            return `${emoji} Expense for *${pendingCtx.employeeName}* ${action}.\n\n_Employee has been notified._ 🌳`;
          }
        } catch (approvalErr) {
          console.error('[Natural Approval] Error:', approvalErr);
          return `❌ Sorry, there was a problem processing the ${action}. Please try again.`;
        }
      } else {
        // No pending context - ask what they want to approve
        return `I don't have a pending request to ${isApprovalWord ? 'approve' : 'reject'}. \n\n_To approve a specific request, you can still use codes like "A EXP123" or wait for a new request notification._ 🌳`;
      }
    }
    
    // Check if Kishor is in a QR payment flow (awaiting screenshot or event)
    if (conversation.activeIntent === 'kishor_qr_payment') {
      let kishorContext: any = {};
      try {
        if (typeof conversation.intentContext === 'string') {
          kishorContext = JSON.parse(conversation.intentContext) || {};
        } else if (conversation.intentContext) {
          kishorContext = conversation.intentContext;
        }
      } catch { kishorContext = {}; }
      
      // Waiting for screenshot
      if (conversation.currentState === 'awaiting_payment_screenshot') {
        if (mediaUrl) {
          // Got screenshot, now ask for event assignment
          kishorContext.paymentScreenshotUrl = mediaUrl;
          
          await storage.updateWhatsappConversation(conversation.id, {
            intentContext: kishorContext,
            currentState: 'awaiting_event_assignment',
          });
          
          return `📸 Got your payment screenshot!\n\nWhich event should this expense be recorded under?\n\n_Type the customer/event name, or "general" for general expenses_`;
        } else {
          return `Please send your payment screenshot so I can forward it to the employee.`;
        }
      }
      
      // Waiting for event assignment
      if (conversation.currentState === 'awaiting_event_assignment') {
        const eventName = messageText.trim();
        const qrCode = kishorContext.qrCode;
        const paymentScreenshotUrl = kishorContext.paymentScreenshotUrl;
        
        // Reject empty/whitespace input or media-only messages
        if (!eventName || eventName.length === 0) {
          return `Please type the event/customer name, or "general" for general expenses.`;
        }
        
        // Complete the QR payment with screenshot and event
        const result = await handleQrPaymentComplete(qrCode, eventName, paymentScreenshotUrl);
        
        // Reset Kishor's conversation
        await storage.updateWhatsappConversation(conversation.id, {
          activeIntent: null,
          intentContext: null,
          currentState: 'idle',
        });
        
        return result;
      }
    }
    
    // Check if Kishor is in income approval flow (awaiting event assignment)
    if (conversation.activeIntent === 'kishor_income_approval') {
      let kishorContext: any = {};
      try {
        if (typeof conversation.intentContext === 'string') {
          kishorContext = JSON.parse(conversation.intentContext) || {};
        } else if (conversation.intentContext) {
          kishorContext = conversation.intentContext;
        }
      } catch { kishorContext = {}; }
      
      // Waiting for event assignment
      if (conversation.currentState === 'awaiting_income_event') {
        const eventName = messageText.trim();
        const incCode = kishorContext.incCode;
        
        if (!eventName || eventName.length === 0) {
          return `Please type the event/customer name, or "general" for general income.`;
        }
        
        // Complete the income approval with event
        const result = await handleIncomeApprovalComplete(incCode, eventName);
        
        // Reset Kishor's conversation
        await storage.updateWhatsappConversation(conversation.id, {
          activeIntent: null,
          intentContext: null,
          currentState: 'idle',
        });
        
        return result;
      }
    }
    
    // Handle Income approval commands (A INC001 or A INC001 EventName)
    const approveIncMatch = lowerMessage.match(/^a\s+(inc\d+)(?:\s+(.+))?/i);
    const rejectIncMatch = lowerMessage.match(/^(?:r|reject)\s+(inc\d+)(?:\s+(.+))?/i);
    
    if (approveIncMatch) {
      const incCode = approveIncMatch[1].toUpperCase();
      const eventName = approveIncMatch[2]?.trim() || 'General';
      const incomeSubmission = await storage.getIncomeSubmissionByCode(incCode);
      
      if (!incomeSubmission) {
        return `❌ ${incCode} not found.`;
      }
      
      if (incomeSubmission.status !== 'pending') {
        return `⚠️ ${incCode} already ${incomeSubmission.status}.`;
      }
      
      // Approve immediately and record in daybook
      await storage.updateIncomeSubmission(incomeSubmission.id, {
        status: 'approved',
        approvedAt: new Date(),
        eventName: eventName,
      });
      
      const amount = parseFloat(incomeSubmission.amount);
      await storage.createDaybookEntry({
        date: new Date().toISOString().split('T')[0],
        type: 'income',
        category: incomeSubmission.type === 'bank_transfer' ? 'bank_transfer' : 'client_payment',
        description: `[${incCode}] ${incomeSubmission.description} - ${incomeSubmission.clientName} (Approved by Kishor)`,
        amount: amount.toString(),
        eventName: eventName === 'General' ? 'General' : eventName,
        bankId: (incomeSubmission as any).bankId || null,
      });
      
      // Notify employee
      const employeePhone = incomeSubmission.employeePhone;
      if (employeePhone) {
        try {
          await sendWhatsAppMessage(employeePhone, `✅ *${incCode} Approved!*\n₹${amount.toLocaleString('en-IN')} from ${incomeSubmission.clientName}`);
        } catch (e) {
          console.error('[Income] Failed to notify employee:', e);
        }
      }
      
      return `✅ *${incCode}* approved\n₹${amount.toLocaleString('en-IN')} • ${eventName}`;
    }
    
    if (rejectIncMatch) {
      return handleIncomeReject(rejectIncMatch[1], rejectIncMatch[2]);
    }
    
    // Handle QR payment PAID command - simple one-message flow
    // Format: "PAID Fida" or "PAID Fida EventName" (uses employee first name)
    const paidMatch = lowerMessage.match(/^paid\s+(\w+)(?:\s+(.+))?/i);
    const rejectQrMatch = lowerMessage.match(/^reject\s+(qr\d+)(?:\s+(.+))?/i);
    
    if (paidMatch) {
      const nameOrCode = paidMatch[1];
      
      // Find the pending QR request - either by code (QR001) or by employee first name
      let qrRequest;
      if (/^qr\d+$/i.test(nameOrCode)) {
        // Legacy: QR code format
        qrRequest = await storage.getQrPaymentRequestByCode(nameOrCode.toUpperCase());
      } else {
        // New: Employee first name - find most recent pending request
        qrRequest = await storage.getPendingQrPaymentByEmployeeName(nameOrCode);
      }
      
      if (!qrRequest) {
        return `❌ No pending payment found for "${nameOrCode}".`;
      }
      
      if (qrRequest.status !== 'pending') {
        return `⚠️ Payment already ${qrRequest.status}.`;
      }
      
      const qrCode = qrRequest.requestCode;
      const amount = parseFloat(qrRequest.amount);
      
      // Mark as paid (pending screenshot and event assignment)
      await storage.updateQrPaymentRequest(qrRequest.id, {
        status: 'paid',
        paidAt: new Date(),
      });
      
      // If Kishor attached a screenshot, save it and ask for event
      if (mediaUrl) {
        await storage.updateWhatsappConversation(conversation.id, {
          activeIntent: 'kishor_qr_payment',
          intentContext: { 
            qrCode: qrCode,
            paymentScreenshotUrl: mediaUrl,
          },
          currentState: 'awaiting_event_assignment',
        });
        
        return `📸 Got your payment screenshot for *${qrCode}*!\n\n💰 ₹${amount.toLocaleString('en-IN')}\n👤 ${qrRequest.employeeName}\n\nWhich event should this be recorded under?\n\n_Type the customer/event name, or "general" for general expenses_`;
      }
      
      // No screenshot attached - ask for it first
      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: 'kishor_qr_payment',
        intentContext: { qrCode: qrCode },
        currentState: 'awaiting_payment_screenshot',
      });
      
      return `✅ *${qrCode}* marked as paid!\n\n💰 ₹${amount.toLocaleString('en-IN')}\n👤 ${qrRequest.employeeName}\n📝 ${qrRequest.description}\n\n📸 Please send the payment screenshot to forward to the employee.`;
    }
    
    if (rejectQrMatch) {
      return handleQrPaymentReject(rejectQrMatch[1], rejectQrMatch[2]);
    }
    
    // Handle Vendor Payment PAID command
    const paidVpMatch = lowerMessage.match(/^paid\s+(vp\d+)/i);
    
    if (paidVpMatch) {
      const vpCode = paidVpMatch[1].toUpperCase();
      const payment = await storage.getPendingVendorPaymentByCode(vpCode);
      
      if (!payment) {
        return `❌ Vendor payment ${vpCode} not found.`;
      }
      
      if (payment.status === 'paid') {
        return `⚠️ Vendor payment ${vpCode} was already marked as paid.`;
      }
      
      // Mark as paid and record in daybook
      return handleVendorPaymentPaid(vpCode);
    }
    
    // Handle lead submissions
    const isInLeadFlow = conversation.activeIntent === 'lead';
    const looksLikeLead = /lead|customer|client|enquiry|assign|fida|femina|\d{10}/i.test(messageText);
    
    if (isInLeadFlow || looksLikeLead) {
      const leadResponse = await handleSuperadminLeadMessage(messageText, normalizedPhone);
      if (leadResponse) {
        return leadResponse;
      }
    }
    
    // Handle DC creation for superadmin - check if in DC flow or starting a DC
    const isInDcFlow = conversation.activeIntent === 'pending_delivery_challan';
    const looksLikeDc = /\bdc\b|delivery\s*challan|challan/i.test(messageText);
    
    // Check for inventory-related messages (should go to AI, not greeting)
    const isInInventoryFlow = conversation.activeIntent === 'ai_inventory_item';
    const looksLikeInventory = /inventory|warehouse|stock|item|quantity|create inventory|add item|new item/i.test(messageText);
    const hasPhotoWithQty = mediaUrl && /\d+/.test(messageText);
    
    if (isInDcFlow || looksLikeDc) {
      // Get superadmin as employee for DC creation
      const superadminEmployee = await storage.getEmployeeByPhone(normalizedPhone);
      if (superadminEmployee) {
        // Don't return - let execution continue to employee section below
        // The isSuperadminByPhone block will end and employee section will handle DC
      } else {
        return `❌ Could not find your employee record. Please ensure your phone is registered in the system.`;
      }
    } else if (isInInventoryFlow || looksLikeInventory || hasPhotoWithQty) {
      // Let inventory messages pass through to AI processing
      // Don't return greeting - continue to employee section
      console.log('[Oaksy] Superadmin inventory message detected, passing to AI...');
    } else {
      // Default Kishor greeting - only show if NOT in DC/inventory flow
      return `👋 Hi Kishor!\n\n*Quick Commands:*\n• PAID Fida → Mark paid\n• PAID Fida EventName → Paid + assign event\n• A INC001 → Approve income\n• R CODE reason → Reject\n• DC to [name] [amount] → Create Delivery Challan\n• Create Inventory + photo → Add to warehouse\n\n_Send lead info or ask anything!_ 🌳`;
    }
  }
  
  // Check if this is from an authorized lead submitter (non-superadmin like Anjana)
  const isLeadSubmitter = isAuthorizedLeadSubmitter(normalizedPhone) && !isSuperadminByPhone;
  
  if (isLeadSubmitter) {
    const submitterName = getLeadSubmitterName(normalizedPhone);
    
    // Handle lead submissions for authorized submitters
    const isInLeadFlow = conversation.activeIntent === 'lead';
    const looksLikeLead = /lead|customer|client|enquiry|assign|fida|femina|\d{10}/i.test(messageText);
    
    if (isInLeadFlow || looksLikeLead) {
      const leadResponse = await handleSuperadminLeadMessage(messageText, normalizedPhone);
      if (leadResponse) {
        return leadResponse;
      }
    }
    
    // Default greeting for lead submitters
    return `👋 Hi ${submitterName}!\n\nI'm *Oaksy AI* from Oakstreet Events 🌳\n\n*I can help you add leads to Oak Sales:*\n• Just send the client details (name, phone, event type)\n• Or forward any enquiry message\n\n_Example: "Lead: John 9876543210 wedding Dec 2025"_`;
  }
  
  // Try to get employee from conversation first, then fall back to phone lookup
  let employee = conversation.employeeId 
    ? await storage.getEmployee(conversation.employeeId)
    : null;
  
  // If no employee from conversation, try by phone (important for DC flow from superadmin/authorized users)
  if (!employee) {
    employee = await storage.getEmployeeByPhone(normalizedPhone);
  }

  if (!employee) {
    return `👋 Hi! I'm Oaksy, your AI companion at Oakstreet Events.\n\n❌ I couldn't find your employee record. Please contact HR to ensure your phone number is registered.\n\n_Once registered, I can help you submit expenses and apply for leave!_ 🌳`;
  }
  
  let context: IntentContext = {};
  let history: ConversationMessage[] = [];
  
  try {
    const rawContext = conversation.intentContext;
    if (typeof rawContext === 'string') {
      context = JSON.parse(rawContext) || {};
    } else if (rawContext && typeof rawContext === 'object') {
      context = rawContext as IntentContext;
    }
  } catch {
    context = {};
  }
  
  try {
    const rawHistory = conversation.conversationHistory;
    if (typeof rawHistory === 'string') {
      history = JSON.parse(rawHistory) || [];
    } else if (Array.isArray(rawHistory)) {
      history = rawHistory as ConversationMessage[];
    }
  } catch {
    history = [];
  }
  
  history.push({
    role: 'user',
    content: messageText,
    timestamp: Date.now()
  });
  if (history.length > 10) {
    history = history.slice(-10);
  }

  if (lowerMessage === 'status' || lowerMessage === 'my status' || lowerMessage.includes('check status')) {
    return await getEmployeeStatus(employee.id, employee.name);
  }

  // ============================================================================
  // AI-FIRST APPROACH: Use conversational AI for natural language understanding
  // This handles leave requests, expenses, and other requests with smart confirmation
  // ============================================================================
  
  // Check if we're in an AI-managed conversation flow
  const isInAiFlow = conversation.activeIntent?.startsWith('ai_');
  
  // Detect if this looks like a natural language request (no media, not in legacy flow)
  // Run AI for: leave requests, general questions, greetings, or when in AI flow
  const looksLikeLeave = /leave|day\s+off|off\s+on|sick|casual|vacation|annual|personal\s+day|time\s+off|chutti|छुट्टी/i.test(messageText);
  const looksLikeExpense = /expense|reimburse|spent|paid for|petty cash/i.test(messageText);
  const looksLikeQuery = /how|what|when|where|who|check|status|balance|pending|list|show me/i.test(messageText);
  const isShortMessage = messageText.length < 100 && !mediaUrl;
  
  // Legacy flows that should NOT use AI (they need specific state handling)
  const isInLegacyFlow = conversation.activeIntent && !conversation.activeIntent.startsWith('ai_') && 
    ['qr_payment', 'income_submission', 'pending_delivery_challan', 'vendor_payment'].some(flow => 
      conversation.activeIntent?.includes(flow)
    );
  
  // ============================================================================
  // DIRECT CONFIRMATION BYPASS: Execute leave request immediately if user confirms
  // This runs BEFORE the AI to ensure confirmations are handled reliably
  // ============================================================================
  const trimmedLower = messageText.trim().toLowerCase();
  const isConfirmationWord = /^(yes|ok|okay|confirm|sure|go ahead|do it|proceed|submit|haan|ha|ji|theek|thik|y|yep|yup)$/i.test(trimmedLower);
  const hasLeaveSlots = context.startDate && context.leaveType;
  const isAwaitingLeaveConfirm = conversation.activeIntent === 'ai_leave_request' && 
                                  conversation.currentState === 'awaiting_confirmation';
  
  console.log('[Direct Confirm Check]', { isConfirmationWord, hasLeaveSlots, isAwaitingLeaveConfirm, trimmedLower, context });
  
  if (isConfirmationWord && hasLeaveSlots && isAwaitingLeaveConfirm) {
    console.log('[Direct Confirm] BYPASSING AI - executing leave request directly');
    try {
      const rawEndDate = (context.endDate || context.startDate) as string;
      const rawStartDate = context.startDate as string;
      const numDays = (context as any).numberOfDays as number | undefined;
      const days = numDays || calculateLeaveDays(rawStartDate, rawEndDate);
      const leaveType = context.leaveType as string || 'casual';
      const reason = context.reason as string || 'Personal';
      
      // Convert DD/MM/YYYY to YYYY-MM-DD for database
      const convertDateFormat = (dateStr: string): string => {
        // Handle various formats: DD/MM/YYYY, D/M/YYYY, etc.
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          const year = parts[2];
          return `${year}-${month}-${day}`;
        }
        // Try parsing with parseAIDate if not in expected format
        const parsed = parseAIDate(dateStr);
        if (parsed) {
          return parsed.toISOString().split('T')[0];
        }
        return dateStr; // Return as-is if we can't parse
      };
      
      const startDateDb = convertDateFormat(rawStartDate);
      const endDateDb = convertDateFormat(rawEndDate);
      
      console.log('[Direct Confirm] Creating leave request:', { employeeId: employee.id, leaveType, startDate: startDateDb, endDate: endDateDb, reason, rawStartDate, rawEndDate });
      
      // Create the leave request
      const leaveRequest = await storage.createLeaveRequest({
        employeeId: employee.id,
        leaveType: leaveType,
        startDate: startDateDb,
        endDate: endDateDb,
        reason,
        status: 'pending',
      });
      
      console.log('[Direct Confirm] Leave request created:', leaveRequest.id);
      
      // Reset conversation state
      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: null,
        intentContext: null,
        currentState: 'idle',
        conversationHistory: [],
      });
      
      // Notify Kishor
      const startDateObj = parseAIDate(context.startDate as string);
      const formattedDate = startDateObj ? startDateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : context.startDate;
      
      try {
        const notifyMsg = `📅 *Leave Request*\n\n👤 ${employee.name}\n📋 ${leaveType.charAt(0).toUpperCase() + leaveType.slice(1)} Leave\n📆 ${formattedDate}${days > 1 ? ` (${days} days)` : ''}\n💬 ${reason}\n\n_Reply "approved" or "rejected"_`;
        await sendWhatsAppMessage(SUPERADMIN_WHATSAPP, notifyMsg);
        
        // Save pending approval context for superadmin's natural language approval
        await saveSuperadminPendingContext({
          type: 'leave_request',
          requestId: leaveRequest.id,
          employeeId: employee.id,
          employeeName: employee.name,
          employeePhone: normalizedPhone,
          details: `${leaveType} leave: ${formattedDate}${days > 1 ? ` (${days} days)` : ''}`,
          reason,
        });
        
        console.log('[Direct Confirm] Notification sent to superadmin with pending context');
      } catch (notifyError) {
        console.error('[Direct Confirm] Failed to notify superadmin:', notifyError);
      }
      
      const dayText = days === 1 ? 'day' : 'days';
      return `✅ *Leave Request Submitted!*\n\n📋 ${leaveType.charAt(0).toUpperCase() + leaveType.slice(1)} Leave\n📆 ${formattedDate}${days > 1 ? ` (${days} ${dayText})` : ''}\n💬 ${reason}\n\n_Waiting for Kishor's approval_ 🌳`;
    } catch (directExecError) {
      console.error('[Direct Confirm] FAILED:', directExecError);
      return `❌ Sorry, there was a problem submitting your leave request. Please try again.`;
    }
  }
  
  // ============================================================================
  // DIRECT CONFIRMATION BYPASS: Execute DC immediately if user confirms
  // This runs BEFORE the AI to ensure confirmations are handled reliably
  // ============================================================================
  const hasDcSlots = context.dcItems && context.dcDestination;
  const isAwaitingDcConfirm = conversation.activeIntent === 'ai_delivery_challan' && 
                               conversation.currentState === 'awaiting_confirmation';
  
  console.log('[Direct DC Confirm Check]', { isConfirmationWord, hasDcSlots, isAwaitingDcConfirm, trimmedLower, context });
  
  if (isConfirmationWord && hasDcSlots && isAwaitingDcConfirm) {
    console.log('[Direct DC Confirm] BYPASSING AI - executing delivery challan directly');
    try {
      const dcItems = context.dcItems as string;
      const dcDestination = context.dcDestination as string;
      const dcVehicle = context.dcVehicle as string | undefined;
      const dcDriver = context.dcDriver as string | undefined;
      
      // Generate DC number
      const dcNumber = `DC${Date.now().toString().slice(-6)}`;
      
      console.log('[Direct DC Confirm] Creating DC:', { dcItems, dcDestination, dcVehicle, dcDriver, dcNumber });
      
      // Reset conversation state
      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: null,
        intentContext: null,
        currentState: 'idle',
        conversationHistory: [],
      });
      
      // Notify superadmin about new DC (DC doesn't need approval, just notification)
      try {
        const notifyMsg = `📦 *Delivery Challan Created*\n\n👤 By: ${employee.name}\n📋 Items: ${dcItems}\n📍 To: ${dcDestination}\n${dcVehicle ? `🚗 Vehicle: ${dcVehicle}\n` : ''}${dcDriver ? `👨‍✈️ Driver: ${dcDriver}\n` : ''}\n🔑 DC#: ${dcNumber}`;
        await sendWhatsAppMessage(SUPERADMIN_WHATSAPP, notifyMsg);
        console.log('[Direct DC Confirm] Notification sent to superadmin');
      } catch (notifyError) {
        console.error('[Direct DC Confirm] Failed to notify superadmin:', notifyError);
      }
      
      return `✅ *Delivery Challan Created!*\n\n📦 Items: ${dcItems}\n📍 Destination: ${dcDestination}\n${dcVehicle ? `🚗 Vehicle: ${dcVehicle}\n` : ''}${dcDriver ? `👨‍✈️ Driver: ${dcDriver}\n` : ''}\n🔑 DC#: ${dcNumber}\n\n_Kishor has been notified_ 🌳`;
    } catch (directDcError) {
      console.error('[Direct DC Confirm] FAILED:', directDcError);
      return `❌ Sorry, there was a problem creating the delivery challan. Please try again.`;
    }
  }
  
  // Run AI orchestrator for text messages that look like natural requests
  const shouldUseAi = !mediaUrl && !isInLegacyFlow && 
    (looksLikeLeave || looksLikeExpense || looksLikeQuery || isInAiFlow || isShortMessage);
  
  if (shouldUseAi) {
    try {
      const employeeRole = employee.designation || 'employee';
      const aiResult = await aiParseMessage(messageText, history, context, employee.name, employeeRole);
      
      console.log('[AI Flow] Result:', JSON.stringify({ intent: aiResult.intent, readyToExecute: aiResult.readyToExecute, userConfirmed: aiResult.userConfirmed }, null, 2));
      
      // Handle leave request confirmation and execution
      if (aiResult.intent === 'leave_request' || aiResult.intent === 'confirmation' || conversation.activeIntent === 'ai_leave_request') {
        
        // Merge stored context with any new slots from AI
        const slots = { ...context, ...aiResult.slots };
        
        // User confirmed - execute the leave request
        // Check both AI flags AND simple confirmation words when in leave request flow
        const trimmedMessage = messageText.trim().toLowerCase();
        const isSimpleConfirm = /^(yes|ok|okay|confirm|sure|go ahead|do it|proceed|submit|haan|ha|ji|theek|thik)/i.test(trimmedMessage) ||
                                trimmedMessage === 'y' || trimmedMessage === 'yep' || trimmedMessage === 'yup';
        const isInAwaitingState = conversation.activeIntent === 'ai_leave_request' && 
                                   (conversation.currentState === 'awaiting_confirmation' || conversation.currentState === 'gathering_info');
        const shouldExecute = (aiResult.readyToExecute && aiResult.userConfirmed) || 
                              (isSimpleConfirm && isInAwaitingState && slots.startDate && slots.leaveType);
        
        console.log('[AI Leave] Execution check:', { shouldExecute, isSimpleConfirm, isInAwaitingState, trimmedMessage, activeIntent: conversation.activeIntent, currentState: conversation.currentState, slots });
        
        // Check if we're in conflict resolution state
        const isInConflictResolution = conversation.currentState === 'conflict_resolution';
        const existingConflict = context.conflictContext;
        
        // Handle conflict resolution response
        if (isInConflictResolution && existingConflict?.hasConflict) {
          const conflictResponse = parseConflictResponse(messageText);
          console.log('[AI Leave] Conflict resolution response:', conflictResponse);
          
          if (conflictResponse === 'replace' && existingConflict.conflict?.type === 'overlapping_leave') {
            // Cancel existing leave and proceed with new one
            const conflictingLeave = existingConflict.conflict.conflictingItems[0];
            await storage.cancelLeaveRequest(conflictingLeave.id);
            console.log('[AI Leave] Cancelled conflicting leave:', conflictingLeave.id);
            
            // Mark conflict as resolved and transition to awaiting_confirmation
            const resolvedSlots = { ...slots, conflictContext: undefined, conflictResolved: true };
            await storage.updateWhatsappConversation(conversation.id, {
              activeIntent: 'ai_leave_request',
              intentContext: resolvedSlots,
              currentState: 'awaiting_confirmation',
              conversationHistory: history,
            });
            
            return `Got it! I've cancelled the old leave request.\n\n📅 *${slots.leaveType?.charAt(0).toUpperCase()}${slots.leaveType?.slice(1)} Leave*\n📆 ${slots.startDate}${slots.endDate && slots.endDate !== slots.startDate ? ` to ${slots.endDate}` : ''}\n\n_Say "yes" to submit this leave request._`;
          } else if (conflictResponse === 'keep_both' || /new|different|both|anyway/i.test(messageText)) {
            // User wants to keep both - mark resolved and ask for confirmation
            console.log('[AI Leave] User chose to keep both leaves');
            
            const resolvedSlots = { ...slots, conflictContext: undefined, conflictResolved: true };
            await storage.updateWhatsappConversation(conversation.id, {
              activeIntent: 'ai_leave_request',
              intentContext: resolvedSlots,
              currentState: 'awaiting_confirmation',
              conversationHistory: history,
            });
            
            return `Got it! This will be a separate leave request.\n\n📅 *${slots.leaveType?.charAt(0).toUpperCase()}${slots.leaveType?.slice(1)} Leave*\n📆 ${slots.startDate}${slots.endDate && slots.endDate !== slots.startDate ? ` to ${slots.endDate}` : ''}\n\n_Say "yes" to submit this leave request._`;
          } else if (conflictResponse === 'cancel' || /duplicate|same|already|forget/i.test(messageText)) {
            // User wants to cancel the new request
            await storage.updateWhatsappConversation(conversation.id, {
              activeIntent: null,
              intentContext: null,
              currentState: 'idle',
              conversationHistory: [],
            });
            return "👍 No problem! I've cancelled the new leave request.\n\n_What else can I help you with?_ 🌳";
          } else {
            // Couldn't understand response - ask again
            return `I didn't quite understand. ${existingConflict.conflict?.message}\n\nPlease say:\n• "Cancel old one" to replace it\n• "Keep both" to have both leaves\n• "Cancel" to forget about this new request`;
          }
        }
        
        if (shouldExecute && slots.startDate && slots.leaveType) {
          // Check for conflicts before execution (if not already resolved)
          // Skip conflict check if conflictResolved flag is set (user already handled the conflict)
          if (!isInConflictResolution && !slots.conflictResolved) {
            const endDate = slots.endDate || slots.startDate;
            const conflictCheck = await detectIntentConflicts('leave_request', { ...slots, endDate }, employee.id, employee.name);
            
            if (conflictCheck.hasConflict && conflictCheck.conflict) {
              console.log('[AI Leave] Conflict detected:', conflictCheck.conflict.type);
              
              // Save conflict context and ask user
              await storage.updateWhatsappConversation(conversation.id, {
                activeIntent: 'ai_leave_request',
                intentContext: { ...slots, conflictContext: conflictCheck },
                currentState: 'conflict_resolution',
                conversationHistory: history,
              });
              
              return `⚠️ *Hold on!*\n\n${conflictCheck.conflict.message}\n\n_Reply "cancel old" to replace, "keep both" to have both, or "cancel" to forget this request._`;
            }
          } else if (slots.conflictResolved) {
            console.log('[AI Leave] Skipping conflict check - already resolved by user');
          }
          
          try {
            console.log('[AI Leave] EXECUTING leave request creation...');
            const endDate = slots.endDate || slots.startDate;
            const days = slots.numberOfDays || calculateLeaveDays(slots.startDate, endDate);
            const leaveType = slots.leaveType || 'casual';
            const reason = slots.reason || 'Personal';
            
            console.log('[AI Leave] Creating with data:', { employeeId: employee.id, leaveType, startDate: slots.startDate, endDate, reason });
            
            // Create the leave request
            const leaveRequest = await storage.createLeaveRequest({
              employeeId: employee.id,
              leaveType: leaveType,
              startDate: slots.startDate,
              endDate: endDate,
              reason,
              status: 'pending',
            });
            
            console.log('[AI Leave] Leave request created:', leaveRequest.id);
            
            // Reset conversation state
            await storage.updateWhatsappConversation(conversation.id, {
              activeIntent: null,
              intentContext: null,
              currentState: 'idle',
              conversationHistory: [],
            });
            
            // Notify Kishor
            const startDateObj = parseAIDate(slots.startDate);
            const formattedDate = startDateObj ? startDateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : slots.startDate;
            
            try {
              const notifyMsg = `📅 *Leave Request*\n\n👤 ${employee.name}\n📋 ${leaveType.charAt(0).toUpperCase() + leaveType.slice(1)} Leave\n📆 ${formattedDate}${days > 1 ? ` (${days} days)` : ''}\n💬 ${reason}\n\n_Reply "approved" or "rejected"_`;
              await sendWhatsAppMessage(SUPERADMIN_WHATSAPP, notifyMsg);
              
              // Save pending approval context for natural language approval
              await saveSuperadminPendingContext({
                type: 'leave_request',
                requestId: leaveRequest.id,
                employeeId: employee.id,
                employeeName: employee.name,
                employeePhone: normalizedPhone,
                details: `${leaveType} leave: ${formattedDate}${days > 1 ? ` (${days} days)` : ''}`,
                reason,
              });
            } catch (notifyError) {
              console.error('[AI Leave] Failed to notify superadmin:', notifyError);
            }
            
            const dayText = days === 1 ? 'day' : 'days';
            return `✅ *Leave Request Submitted!*\n\n📋 ${leaveType.charAt(0).toUpperCase() + leaveType.slice(1)} Leave\n📆 ${formattedDate}${days > 1 ? ` (${days} ${dayText})` : ''}\n💬 ${reason}\n\n_Waiting for Kishor's approval_ 🌳`;
          } catch (execError) {
            console.error('[AI Leave] EXECUTION FAILED:', execError);
            return `❌ Sorry, there was a problem submitting your leave request. Please try again or contact Kishor directly.`;
          }
        }
        
        // Not confirmed yet - save context and ask for confirmation
        if (aiResult.slots.startDate && aiResult.slots.leaveType && !aiResult.readyToExecute) {
          // Save the extracted slots to context
          await storage.updateWhatsappConversation(conversation.id, {
            activeIntent: 'ai_leave_request',
            intentContext: { ...context, ...aiResult.slots },
            currentState: 'awaiting_confirmation',
            conversationHistory: history,
          });
        } else if (Object.keys(aiResult.slots).length > 0) {
          // Partial info - save and ask for more
          await storage.updateWhatsappConversation(conversation.id, {
            activeIntent: 'ai_leave_request',
            intentContext: { ...context, ...aiResult.slots },
            currentState: 'gathering_info',
            conversationHistory: history,
          });
        }
        
        // Return AI's response (clarifying question or confirmation request)
        return aiResult.suggestedResponse;
      }
      
      // Handle cancellation
      if (aiResult.intent === 'cancellation') {
        await storage.updateWhatsappConversation(conversation.id, {
          activeIntent: null,
          intentContext: null,
          currentState: 'idle',
          conversationHistory: [],
        });
        return "👍 No problem! I've cancelled that.\n\n_What else can I help you with?_ 🌳";
      }
      
      // Handle greetings
      if (aiResult.intent === 'greeting') {
        await storage.updateWhatsappConversation(conversation.id, {
          activeIntent: null,
          intentContext: null,
          currentState: 'idle',
          conversationHistory: [],
        });
        return aiResult.suggestedResponse;
      }
      
      // Handle help requests
      if (aiResult.intent === 'help') {
        return `👋 Hi ${employee.name}! I'm *Oaksy*, your AI assistant.\n\n*I can help you with:*\n📅 Leave requests - "casual leave on 20th Jan"\n💰 Expenses - "spent 500 on cab for client visit"\n💸 Vendor payments - "pay 5k to Flower World"\n📦 Delivery challans - "create DC for chairs to Marina Hall"\n📊 Daybook entries - "add expense 2000 for petrol"\n📋 Status checks - "what's pending?"\n\n_Just tell me what you need in your own words!_ 🌳`;
      }
      
      // Handle status checks
      if (aiResult.intent === 'status_check') {
        return await getEmployeeStatus(employee.id, employee.name);
      }
      
      // ============================================================================
      // EXPENSE EXECUTION HANDLER - Natural language expense submission
      // ============================================================================
      if (aiResult.intent === 'expense' || conversation.activeIntent === 'ai_expense') {
        // Role check - only allowed submitters can create expenses
        if (!isAllowedExpenseSubmitter(normalizedPhone)) {
          return `❌ Sorry ${employee.name}, expense submission is only available for Wedding Planners and Accountants.\n\n_Contact Kishor if you need to submit an expense._ 🌳`;
        }
        
        const slots = { ...context, ...aiResult.slots };
        
        // Check for confirmation when in awaiting_confirmation state
        const trimmedMessage = messageText.trim().toLowerCase();
        const isSimpleConfirm = /^(yes|ok|okay|confirm|sure|go ahead|do it|proceed|submit|haan|ha|ji)/i.test(trimmedMessage);
        const isInAwaitingState = conversation.activeIntent === 'ai_expense' && 
                                   conversation.currentState === 'awaiting_confirmation';
        const shouldExecute = (aiResult.readyToExecute && aiResult.userConfirmed) || 
                              (isSimpleConfirm && isInAwaitingState && slots.amount && slots.purpose);
        
        console.log('[AI Expense] Check:', { shouldExecute, isSimpleConfirm, isInAwaitingState, slots });
        
        // Check if we're in conflict resolution state
        const isInConflictResolution = conversation.currentState === 'conflict_resolution';
        const existingConflict = context.conflictContext;
        
        // Handle conflict resolution response for expenses
        if (isInConflictResolution && existingConflict?.hasConflict && existingConflict.conflict?.type === 'duplicate_expense') {
          const conflictResponse = parseConflictResponse(messageText);
          console.log('[AI Expense] Conflict resolution response:', conflictResponse);
          
          if (conflictResponse === 'keep_both' || /new|different|separate/i.test(messageText)) {
            // User says it's a new/different expense - proceed to confirmation
            console.log('[AI Expense] User confirmed this is a new expense');
            
            // Mark conflict as resolved so we don't re-trigger detection
            const resolvedSlots = { ...slots, conflictContext: undefined, conflictResolved: true };
            
            // Transition out of conflict_resolution to proceed with execution
            await storage.updateWhatsappConversation(conversation.id, {
              activeIntent: 'ai_expense',
              intentContext: resolvedSlots,
              currentState: 'awaiting_confirmation',
              conversationHistory: history,
            });
            
            // Ask for final confirmation
            return `Got it! This is a separate expense.\n\n📋 *${slots.purpose}*\n💵 ₹${slots.amount.toLocaleString('en-IN')}\n\n_Say "yes" to submit this expense request._`;
          } else if (conflictResponse === 'cancel' || /duplicate|same|already/i.test(messageText)) {
            // User confirms it's a duplicate - cancel
            await storage.updateWhatsappConversation(conversation.id, {
              activeIntent: null,
              intentContext: null,
              currentState: 'idle',
              conversationHistory: [],
            });
            return "👍 Got it! I've cancelled this expense since it was a duplicate.\n\n_What else can I help you with?_ 🌳";
          } else {
            // Couldn't understand response - ask again
            return `I didn't quite understand. ${existingConflict.conflict.message}\n\nPlease say:\n• "It's a new expense" to submit it\n• "It's a duplicate" to cancel`;
          }
        }
        
        if (shouldExecute && slots.amount && slots.purpose) {
          // Check for conflicts before execution (if not already resolved)
          if (!isInConflictResolution && !slots.conflictResolved) {
            const conflictCheck = await detectIntentConflicts('expense', slots, employee.id, employee.name);
            
            if (conflictCheck.hasConflict && conflictCheck.conflict) {
              console.log('[AI Expense] Conflict detected:', conflictCheck.conflict.type);
              
              // Save conflict context and ask user
              await storage.updateWhatsappConversation(conversation.id, {
                activeIntent: 'ai_expense',
                intentContext: { ...slots, conflictContext: conflictCheck },
                currentState: 'conflict_resolution',
                conversationHistory: history,
              });
              
              return `⚠️ *Wait a moment!*\n\n${conflictCheck.conflict.message}\n\n_Reply "new expense" if this is different, or "duplicate" if it's the same._`;
            }
          }
          
          try {
            console.log('[AI Expense] EXECUTING expense submission...');
            
            // Use existing createExpenseRequest function which handles both expense and pending approval
            const { approvalCode, requestId } = await createExpenseRequest(
              employee.id,
              employee.name,
              slots.purpose,
              slots.amount,
              undefined // no media URL from chat
            );
            
            // Reset conversation state
            await storage.updateWhatsappConversation(conversation.id, {
              activeIntent: null,
              intentContext: null,
              currentState: 'idle',
              conversationHistory: [],
            });
            
            // Notify Kishor for approval
            const notifyMsg = `💰 *Expense Request*\n\n👤 ${employee.name}\n📋 ${slots.purpose}\n💵 ₹${slots.amount.toLocaleString('en-IN')}\n${slots.eventName ? `🎪 Event: ${slots.eventName}\n` : ''}\n🔑 Code: ${approvalCode}\n\n_Reply "approved" or "rejected"_`;
            await sendWhatsAppMessage(SUPERADMIN_WHATSAPP, notifyMsg);
            
            // Save pending approval context for natural language approval
            await saveSuperadminPendingContext({
              type: 'expense',
              requestId: requestId,
              employeeId: employee.id,
              employeeName: employee.name,
              employeePhone: normalizedPhone,
              details: `Expense: ₹${slots.amount.toLocaleString('en-IN')} for ${slots.purpose}`,
              amount: slots.amount,
              purpose: slots.purpose,
              eventName: slots.eventName,
            });
            
            return `✅ *Expense Submitted!*\n\n📋 ${slots.purpose}\n💵 ₹${slots.amount.toLocaleString('en-IN')}\n🔑 Code: ${approvalCode}\n\n_Waiting for Kishor's approval_ 🌳`;
          } catch (execError) {
            console.error('[AI Expense] EXECUTION FAILED:', execError);
            return `❌ Sorry, there was a problem submitting your expense. Please try again.`;
          }
        }
        
        // Not confirmed yet - save context and return AI's response
        if (slots.amount && slots.purpose && !aiResult.readyToExecute) {
          await storage.updateWhatsappConversation(conversation.id, {
            activeIntent: 'ai_expense',
            intentContext: slots,
            currentState: 'awaiting_confirmation',
            conversationHistory: history,
          });
        } else if (Object.keys(aiResult.slots).length > 0) {
          await storage.updateWhatsappConversation(conversation.id, {
            activeIntent: 'ai_expense',
            intentContext: slots,
            currentState: 'gathering_info',
            conversationHistory: history,
          });
        }
        
        return aiResult.suggestedResponse;
      }
      
      // ============================================================================
      // DELIVERY CHALLAN EXECUTION HANDLER - Natural language DC creation
      // ============================================================================
      if (aiResult.intent === 'delivery_challan' || conversation.activeIntent === 'ai_delivery_challan') {
        // Role check - only allowed submitters can create DCs (Wedding Planners, Accountants)
        if (!isAllowedExpenseSubmitter(normalizedPhone)) {
          return `❌ Sorry ${employee.name}, delivery challan creation is only available for Wedding Planners and Accountants.\n\n_Contact Kishor for DC requests._ 🌳`;
        }
        
        const slots = { ...context, ...aiResult.slots };
        
        const trimmedMessage = messageText.trim().toLowerCase();
        const isSimpleConfirm = /^(yes|ok|okay|confirm|sure|go ahead|do it|proceed|submit|haan|ha|ji)/i.test(trimmedMessage);
        const isInAwaitingState = conversation.activeIntent === 'ai_delivery_challan' && 
                                   conversation.currentState === 'awaiting_confirmation';
        const shouldExecute = (aiResult.readyToExecute && aiResult.userConfirmed) || 
                              (isSimpleConfirm && isInAwaitingState && slots.dcItems && slots.dcDestination);
        
        console.log('[AI DC] Check:', { shouldExecute, isSimpleConfirm, isInAwaitingState, slots });
        
        if (shouldExecute && slots.dcItems && slots.dcDestination) {
          try {
            console.log('[AI DC] EXECUTING delivery challan creation...');
            
            // Generate DC number
            const dcNumber = `DC${Date.now().toString().slice(-6)}`;
            
            // Reset conversation state
            await storage.updateWhatsappConversation(conversation.id, {
              activeIntent: null,
              intentContext: null,
              currentState: 'idle',
              conversationHistory: [],
            });
            
            // Notify superadmin about new DC (DC doesn't need approval, just notification)
            const notifyMsg = `📦 *Delivery Challan Created*\n\n👤 By: ${employee.name}\n📋 Items: ${slots.dcItems}\n📍 To: ${slots.dcDestination}\n${slots.dcVehicle ? `🚗 Vehicle: ${slots.dcVehicle}\n` : ''}${slots.dcDriver ? `👨‍✈️ Driver: ${slots.dcDriver}\n` : ''}\n🔑 DC#: ${dcNumber}`;
            await sendWhatsAppMessage(SUPERADMIN_WHATSAPP, notifyMsg);
            
            return `✅ *Delivery Challan Created!*\n\n📦 Items: ${slots.dcItems}\n📍 Destination: ${slots.dcDestination}\n${slots.dcVehicle ? `🚗 Vehicle: ${slots.dcVehicle}\n` : ''}${slots.dcDriver ? `👨‍✈️ Driver: ${slots.dcDriver}\n` : ''}\n🔑 DC#: ${dcNumber}\n\n_Kishor has been notified_ 🌳`;
          } catch (execError) {
            console.error('[AI DC] EXECUTION FAILED:', execError);
            return `❌ Sorry, there was a problem creating the delivery challan. Please try again.`;
          }
        }
        
        // Not confirmed yet - save context
        if (slots.dcItems && slots.dcDestination && !aiResult.readyToExecute) {
          await storage.updateWhatsappConversation(conversation.id, {
            activeIntent: 'ai_delivery_challan',
            intentContext: slots,
            currentState: 'awaiting_confirmation',
            conversationHistory: history,
          });
        } else if (Object.keys(aiResult.slots).length > 0) {
          await storage.updateWhatsappConversation(conversation.id, {
            activeIntent: 'ai_delivery_challan',
            intentContext: slots,
            currentState: 'gathering_info',
            conversationHistory: history,
          });
        }
        
        return aiResult.suggestedResponse;
      }
      
      // ============================================================================
      // VENDOR PAYMENT EXECUTION HANDLER - Natural language vendor payments
      // ============================================================================
      if (aiResult.intent === 'vendor_payment' || conversation.activeIntent === 'ai_vendor_payment') {
        // Role check - only allowed submitters can request vendor payments
        if (!isAllowedExpenseSubmitter(normalizedPhone)) {
          return `❌ Sorry ${employee.name}, vendor payment requests are only available for Wedding Planners and Accountants.\n\n_Contact Kishor for vendor payments._ 🌳`;
        }
        
        const slots = { ...context, ...aiResult.slots };
        
        const trimmedMessage = messageText.trim().toLowerCase();
        const isSimpleConfirm = /^(yes|ok|okay|confirm|sure|go ahead|do it|proceed|submit|haan|ha|ji)/i.test(trimmedMessage);
        const isInAwaitingState = conversation.activeIntent === 'ai_vendor_payment' && 
                                   conversation.currentState === 'awaiting_confirmation';
        const shouldExecute = (aiResult.readyToExecute && aiResult.userConfirmed) || 
                              (isSimpleConfirm && isInAwaitingState && slots.amount && slots.vendorName);
        
        console.log('[AI Vendor] Check:', { shouldExecute, isSimpleConfirm, isInAwaitingState, slots });
        
        // Check if we're in conflict resolution state
        const isInConflictResolution = conversation.currentState === 'conflict_resolution';
        const existingConflict = context.conflictContext;
        
        // Handle conflict resolution response for vendor payments
        if (isInConflictResolution && existingConflict?.hasConflict && existingConflict.conflict?.type === 'pending_vendor_payment') {
          const conflictResponse = parseConflictResponse(messageText);
          console.log('[AI Vendor] Conflict resolution response:', conflictResponse);
          
          if (conflictResponse === 'keep_both' || /yes|add|another|new/i.test(messageText)) {
            // User wants to add another payment - proceed
            console.log('[AI Vendor] User wants to add another vendor payment');
            slots.conflictContext = undefined;
          } else if (conflictResponse === 'cancel' || /wait|no|later/i.test(messageText)) {
            // User wants to wait for the first one
            await storage.updateWhatsappConversation(conversation.id, {
              activeIntent: null,
              intentContext: null,
              currentState: 'idle',
              conversationHistory: [],
            });
            return "👍 No problem! Let's wait for the first payment to be approved.\n\n_What else can I help you with?_ 🌳";
          } else {
            // Couldn't understand response - ask again
            return `I didn't quite understand. ${existingConflict.conflict.message}\n\nPlease say:\n• "Add another" to submit a new payment\n• "Wait" to hold off until the first is processed`;
          }
        }
        
        if (shouldExecute && slots.amount && slots.vendorName) {
          // Check for conflicts before execution (if not already resolved)
          if (!isInConflictResolution) {
            const conflictCheck = await detectIntentConflicts('vendor_payment', slots, employee.id, employee.name);
            
            if (conflictCheck.hasConflict && conflictCheck.conflict) {
              console.log('[AI Vendor] Conflict detected:', conflictCheck.conflict.type);
              
              // Save conflict context and ask user
              await storage.updateWhatsappConversation(conversation.id, {
                activeIntent: 'ai_vendor_payment',
                intentContext: { ...slots, conflictContext: conflictCheck },
                currentState: 'conflict_resolution',
                conversationHistory: history,
              });
              
              return `⚠️ *Hold on!*\n\n${conflictCheck.conflict.message}\n\n_Reply "add another" to submit anyway, or "wait" to hold off._`;
            }
          }
          
          try {
            console.log('[AI Vendor] EXECUTING vendor payment submission...');
            
            // Generate approval code for vendor payment
            const approvalCode = generateUniqueApprovalCode('VP');
            const superadminPhone = await getSuperadminPhone();
            const description = `${slots.vendorName}${slots.purpose ? ` - ${slots.purpose}` : ''}`;
            
            // Create pending approval record (daybook entry will be created only after approval)
            await storage.createWhatsappPendingApproval({
              approvalCode,
              type: 'vendor_payment',
              requestId: approvalCode, // Use approval code as request ID for vendor payments
              employeeId: employee.id,
              employeeName: employee.name,
              description: description,
              amount: slots.amount.toString(),
              mediaUrl: null,
              status: 'pending',
              approverPhone: superadminPhone,
            });
            
            // Reset conversation state
            await storage.updateWhatsappConversation(conversation.id, {
              activeIntent: null,
              intentContext: null,
              currentState: 'idle',
              conversationHistory: [],
            });
            
            // Notify Kishor for approval
            const notifyMsg = `💸 *Vendor Payment Request*\n\n👤 From: ${employee.name}\n🏪 Vendor: ${slots.vendorName}\n💵 Amount: ₹${slots.amount.toLocaleString('en-IN')}\n${slots.purpose ? `📋 For: ${slots.purpose}\n` : ''}${slots.eventName ? `🎪 Event: ${slots.eventName}\n` : ''}\n🔑 Code: ${approvalCode}\n\n_Reply "approved" or "rejected"_`;
            await sendWhatsAppMessage(SUPERADMIN_WHATSAPP, notifyMsg);
            
            // Save pending approval context for natural language approval
            await saveSuperadminPendingContext({
              type: 'vendor_payment',
              requestId: approvalCode,
              employeeId: employee.id,
              employeeName: employee.name,
              employeePhone: normalizedPhone,
              details: `Vendor: ${slots.vendorName} - ₹${slots.amount.toLocaleString('en-IN')}`,
              amount: slots.amount,
              vendorName: slots.vendorName,
              purpose: slots.purpose,
              eventName: slots.eventName,
            });
            
            return `✅ *Vendor Payment Submitted!*\n\n🏪 ${slots.vendorName}\n💵 ₹${slots.amount.toLocaleString('en-IN')}\n${slots.purpose ? `📋 For: ${slots.purpose}\n` : ''}🔑 Code: ${approvalCode}\n\n_Waiting for Kishor's approval_ 🌳`;
          } catch (execError) {
            console.error('[AI Vendor] EXECUTION FAILED:', execError);
            return `❌ Sorry, there was a problem submitting the vendor payment. Please try again.`;
          }
        }
        
        // Not confirmed yet - save context
        if (slots.amount && slots.vendorName && !aiResult.readyToExecute) {
          await storage.updateWhatsappConversation(conversation.id, {
            activeIntent: 'ai_vendor_payment',
            intentContext: slots,
            currentState: 'awaiting_confirmation',
            conversationHistory: history,
          });
        } else if (Object.keys(aiResult.slots).length > 0) {
          await storage.updateWhatsappConversation(conversation.id, {
            activeIntent: 'ai_vendor_payment',
            intentContext: slots,
            currentState: 'gathering_info',
            conversationHistory: history,
          });
        }
        
        return aiResult.suggestedResponse;
      }
      
      // ============================================================================
      // DAYBOOK ENTRY HANDLER - Natural language daybook entries
      // ============================================================================
      if (aiResult.intent === 'daybook_entry' || conversation.activeIntent === 'ai_daybook_entry') {
        // Role check - only allowed submitters can create daybook entries
        if (!isAllowedExpenseSubmitter(normalizedPhone)) {
          return `❌ Sorry ${employee.name}, daybook entries are only available for Wedding Planners and Accountants.\n\n_Contact Kishor for daybook entries._ 🌳`;
        }
        
        const slots = { ...context, ...aiResult.slots };
        
        const trimmedMessage = messageText.trim().toLowerCase();
        const isSimpleConfirm = /^(yes|ok|okay|confirm|sure|go ahead|do it|proceed|submit|haan|ha|ji)/i.test(trimmedMessage);
        const isInAwaitingState = conversation.activeIntent === 'ai_daybook_entry' && 
                                   conversation.currentState === 'awaiting_confirmation';
        const shouldExecute = (aiResult.readyToExecute && aiResult.userConfirmed) || 
                              (isSimpleConfirm && isInAwaitingState && slots.amount && slots.daybookType);
        
        console.log('[AI Daybook] Check:', { shouldExecute, isSimpleConfirm, isInAwaitingState, slots });
        
        // Check if we're in conflict resolution state
        const isInConflictResolution = conversation.currentState === 'conflict_resolution';
        const existingConflict = context.conflictContext;
        
        // Handle conflict resolution response for daybook entries
        if (isInConflictResolution && existingConflict?.hasConflict && existingConflict.conflict?.type === 'duplicate_daybook') {
          const conflictResponse = parseConflictResponse(messageText);
          console.log('[AI Daybook] Conflict resolution response:', conflictResponse);
          
          if (conflictResponse === 'keep_both' || /new|different|separate|add anyway/i.test(messageText)) {
            // User says it's a new/different entry - proceed to confirmation
            console.log('[AI Daybook] User confirmed this is a new entry');
            
            // Mark conflict as resolved so we don't re-trigger detection
            const resolvedSlots = { ...slots, conflictContext: undefined, conflictResolved: true };
            
            // Transition out of conflict_resolution to proceed with execution
            await storage.updateWhatsappConversation(conversation.id, {
              activeIntent: 'ai_daybook_entry',
              intentContext: resolvedSlots,
              currentState: 'awaiting_confirmation',
              conversationHistory: history,
            });
            
            const typeEmoji = slots.daybookType === 'income' ? '💚' : '💸';
            const description = slots.daybookDescription || slots.purpose || 'Entry via WhatsApp';
            // Ask for final confirmation
            return `Got it! This is a separate entry.\n\n${typeEmoji} *${slots.daybookType?.toUpperCase()}*\n💵 ₹${slots.amount.toLocaleString('en-IN')}\n📝 ${description}\n\n_Say "yes" to add this daybook entry._`;
          } else if (conflictResponse === 'cancel' || /duplicate|same|already/i.test(messageText)) {
            // User confirms it's a duplicate - cancel
            await storage.updateWhatsappConversation(conversation.id, {
              activeIntent: null,
              intentContext: null,
              currentState: 'idle',
              conversationHistory: [],
            });
            return "👍 Got it! I've cancelled this entry since it was a duplicate.\n\n_What else can I help you with?_ 🌳";
          } else {
            // Couldn't understand response - ask again
            return `I didn't quite understand. ${existingConflict.conflict.message}\n\nPlease say:\n• "Add anyway" to submit it\n• "It's a duplicate" to cancel`;
          }
        }
        
        if (shouldExecute && slots.amount && slots.daybookType) {
          // Check for conflicts before execution (if not already resolved)
          if (!isInConflictResolution && !slots.conflictResolved) {
            const conflictCheck = await detectIntentConflicts('daybook_entry', slots, employee.id, employee.name);
            
            if (conflictCheck.hasConflict && conflictCheck.conflict) {
              console.log('[AI Daybook] Conflict detected:', conflictCheck.conflict.type);
              
              // Save conflict context and ask user
              await storage.updateWhatsappConversation(conversation.id, {
                activeIntent: 'ai_daybook_entry',
                intentContext: { ...slots, conflictContext: conflictCheck },
                currentState: 'conflict_resolution',
                conversationHistory: history,
              });
              
              return `⚠️ *Wait a moment!*\n\n${conflictCheck.conflict.message}\n\n_Reply "add anyway" if this is different, or "duplicate" if it's the same._`;
            }
          }
          
          try {
            console.log('[AI Daybook] EXECUTING daybook entry creation...');
            
            const description = slots.daybookDescription || slots.purpose || 'Entry via WhatsApp';
            
            // Create actual daybook entry in database
            const daybookEntry = await storage.createDaybookEntry({
              date: new Date().toISOString().split('T')[0],
              type: slots.daybookType,
              amount: String(slots.amount),
              description: `${description} (by ${employee.name})`,
              category: slots.daybookCategory || 'General',
              bankId: null,
              eventId: null,
            });
            
            // Reset conversation state
            await storage.updateWhatsappConversation(conversation.id, {
              activeIntent: null,
              intentContext: null,
              currentState: 'idle',
              conversationHistory: [],
            });
            
            // Notify superadmin
            const typeEmoji = slots.daybookType === 'income' ? '💚' : '💸';
            const notifyMsg = `${typeEmoji} *Daybook Entry*\n\n👤 By: ${employee.name}\n📋 Type: ${slots.daybookType.toUpperCase()}\n💵 ₹${slots.amount.toLocaleString('en-IN')}\n📝 ${description}\n${slots.daybookCategory ? `📁 Category: ${slots.daybookCategory}\n` : ''}\n🔑 ID: ${daybookEntry.id}`;
            await sendWhatsAppMessage(SUPERADMIN_WHATSAPP, notifyMsg);
            
            return `✅ *Daybook Entry Recorded!*\n\n${typeEmoji} ${slots.daybookType.toUpperCase()}\n💵 ₹${slots.amount.toLocaleString('en-IN')}\n📝 ${description}\n🔑 ID: ${daybookEntry.id}\n\n_Kishor has been notified_ 🌳`;
          } catch (execError) {
            console.error('[AI Daybook] EXECUTION FAILED:', execError);
            return `❌ Sorry, there was a problem creating the daybook entry. Please try again.`;
          }
        }
        
        // Not confirmed yet - save context
        if (slots.amount && slots.daybookType && !aiResult.readyToExecute) {
          await storage.updateWhatsappConversation(conversation.id, {
            activeIntent: 'ai_daybook_entry',
            intentContext: slots,
            currentState: 'awaiting_confirmation',
            conversationHistory: history,
          });
        } else if (Object.keys(aiResult.slots).length > 0) {
          await storage.updateWhatsappConversation(conversation.id, {
            activeIntent: 'ai_daybook_entry',
            intentContext: slots,
            currentState: 'gathering_info',
            conversationHistory: history,
          });
        }
        
        return aiResult.suggestedResponse;
      }
      
      // ============================================================================
      // INVENTORY ITEM HANDLER - Add items to warehouse inventory via WhatsApp
      // ============================================================================
      if (aiResult.intent === 'inventory_item' || conversation.activeIntent === 'ai_inventory_item') {
        // Role check - only authorized creators can add inventory items
        if (!isAuthorizedInventoryCreator(normalizedPhone)) {
          return `❌ Sorry ${employee.name}, inventory management is only available for authorized users.\n\n_Contact Kishor for inventory updates._ 🌳`;
        }
        
        const slots = { ...context, ...aiResult.slots };
        
        // Store photo URL if media was attached
        if (mediaUrl && !slots.inventoryItemPhotoUrl) {
          slots.inventoryItemPhotoUrl = mediaUrl;
        }
        
        // HANDLE FOLLOW-UP: When in gathering_info or awaiting_quantity state, try to extract quantity from reply
        if (conversation.activeIntent === 'ai_inventory_item' && 
            (conversation.currentState === 'gathering_info' || conversation.currentState === 'awaiting_inventory_quantity')) {
          // Try to extract quantity from follow-up message (e.g., "20", "50 units", "100 nos")
          const qtyFromReply = messageText.match(/^\s*(\d+)\s*(nos?|pieces?|pcs?|units?|per\s+unit)?\s*$/i);
          if (qtyFromReply && !slots.inventoryItemQuantity) {
            slots.inventoryItemQuantity = parseInt(qtyFromReply[1]);
            console.log('[AI Inventory] Extracted quantity from follow-up:', slots.inventoryItemQuantity);
          }
          
          // Also check if user is providing rate/price info (ignore it for now, focus on quantity)
          const hasRateInfo = /per\s+unit|each|rate|cost|price|rupees|rs|₹/i.test(messageText);
          if (hasRateInfo && !slots.inventoryItemQuantity) {
            // User is providing rate but we need quantity - prompt for quantity instead
            await storage.updateWhatsappConversation(conversation.id, {
              activeIntent: 'ai_inventory_item',
              intentContext: slots,
              currentState: 'awaiting_inventory_quantity',
              conversationHistory: history,
            });
            return `Got it on the rate! But first, how many ${slots.inventoryItemName || 'of these'} do we have? Just send me the number.`;
          }
        }
        
        const trimmedMessage = messageText.trim().toLowerCase();
        const isSimpleConfirm = /^(yes|ok|okay|confirm|sure|go ahead|do it|proceed|submit|haan|ha|ji)/i.test(trimmedMessage);
        const isInAwaitingState = conversation.activeIntent === 'ai_inventory_item' && 
                                   conversation.currentState === 'awaiting_confirmation';
        const shouldExecute = (aiResult.readyToExecute && aiResult.userConfirmed) || 
                              (isSimpleConfirm && isInAwaitingState && slots.inventoryItemName);
        
        console.log('[AI Inventory] Check:', { shouldExecute, isSimpleConfirm, isInAwaitingState, slots });
        
        if (shouldExecute && slots.inventoryItemName) {
          try {
            console.log('[AI Inventory] EXECUTING inventory item creation...');
            
            const result = await handleInventoryItemCreation(
              slots as IntentContext,
              mediaUrl,
              fromNumber,
              conversation
            );
            
            if (result.success) {
              return result.message;
            } else {
              return result.message;
            }
          } catch (execError: any) {
            console.error('[AI Inventory] EXECUTION FAILED:', execError);
            return `❌ Sorry, there was a problem adding the inventory item. Please try again.`;
          }
        }
        
        // Not confirmed yet - save context and ask for missing info
        if (slots.inventoryItemName && slots.inventoryItemQuantity && !aiResult.readyToExecute) {
          // Have both name and quantity - ask for confirmation
          await storage.updateWhatsappConversation(conversation.id, {
            activeIntent: 'ai_inventory_item',
            intentContext: slots,
            currentState: 'awaiting_confirmation',
            conversationHistory: history,
          });
          
          const quantity = slots.inventoryItemQuantity;
          const colour = slots.inventoryItemColour ? ` (${slots.inventoryItemColour})` : '';
          const hasPhoto = slots.inventoryItemPhotoUrl ? ' with photo' : '';
          
          // Natural, conversational response like ChatGPT
          return `Perfect! Here's what I'm adding to inventory${hasPhoto}:\n\n${slots.inventoryItemName}${colour} - ${quantity} units\n\nDoes that look right? Just say yes to confirm, or let me know if anything needs changing.`;
        } else if (slots.inventoryItemName && !slots.inventoryItemQuantity) {
          // Have item name but need quantity
          await storage.updateWhatsappConversation(conversation.id, {
            activeIntent: 'ai_inventory_item',
            intentContext: slots,
            currentState: 'awaiting_inventory_quantity',
            conversationHistory: history,
          });
          
          const colour = slots.inventoryItemColour ? ` (${slots.inventoryItemColour})` : '';
          
          return `Got it - ${slots.inventoryItemName}${colour}. How many do we have in stock?`;
        } else if (Object.keys(aiResult.slots).length > 0 || mediaUrl) {
          // Have some info but need more
          await storage.updateWhatsappConversation(conversation.id, {
            activeIntent: 'ai_inventory_item',
            intentContext: slots,
            currentState: 'gathering_info',
            conversationHistory: history,
          });
          
          if (!slots.inventoryItemName) {
            return `Nice photo! What's this item called and how many do we have?`;
          }
        }
        
        return aiResult.suggestedResponse;
      }
      
      // For other AI intents with good confidence, return the suggested response
      if (aiResult.confidence > 0.5) {
        // Save context for multi-turn conversation
        if (aiResult.intent !== 'general_question' && aiResult.intent !== 'unknown') {
          await storage.updateWhatsappConversation(conversation.id, {
            activeIntent: `ai_${aiResult.intent}`,
            intentContext: { ...context, ...aiResult.slots },
            conversationHistory: history,
          });
        }
        return aiResult.suggestedResponse;
      }
      
    } catch (aiError: any) {
      console.error('[AI Flow] Error:', aiError.message);
      // Fall through to existing handlers on AI error
    }
  }
  
  // ============================================================================
  // END AI-FIRST APPROACH - Continue with existing state machine handlers
  // ============================================================================

  // VENDOR PAYMENT CORRECTION FLOW - Handle "no", "change", or amount corrections after vendor payment
  if (conversation.currentState === 'vendor_payment_recorded') {
    const lastCode = context.lastVendorPaymentCode as string | undefined;
    const lastAmount = context.lastVendorPaymentAmount as number | undefined;
    
    if (lastCode) {
      // Check for confirmation
      if (lowerMessage === 'ok' || lowerMessage === 'yes' || lowerMessage === 'confirm' || lowerMessage === 'correct') {
        await storage.updateWhatsappConversation(conversation.id, {
          activeIntent: null,
          intentContext: null,
          currentState: 'idle',
          conversationHistory: [],
        });
        return `✅ *Confirmed!* Vendor payment ${lastCode} has been recorded.\n\n_Kishor will be notified._ 🌳`;
      }
      
      // Check for correction - "no", "change to X", "make it X", or just a new amount
      const correctionPatterns = [
        /^no[,.]?\s*/i,
        /^change\s*(?:to|it)?\s*/i,
        /^make\s*it\s*/i,
        /^correct\s*(?:to|it)?\s*/i,
        /^update\s*(?:to|it)?\s*/i,
        /^wrong[,.]?\s*/i,
      ];
      
      let textAfterCorrection = messageText;
      let isCorrection = false;
      
      for (const pattern of correctionPatterns) {
        if (pattern.test(lowerMessage)) {
          textAfterCorrection = messageText.replace(pattern, '').trim();
          isCorrection = true;
          break;
        }
      }
      
      // Also treat any plain amount as a correction attempt
      const newAmount = extractAmount(textAfterCorrection) || extractAmount(messageText);
      
      if (newAmount && (isCorrection || newAmount !== lastAmount)) {
        // Update the vendor payment with new amount
        const payment = await storage.getPendingVendorPaymentByCode(lastCode);
        if (payment) {
          await storage.updatePendingVendorPayment(payment.id, {
            amount: newAmount.toString(),
          });
          
          await storage.updateWhatsappConversation(conversation.id, {
            activeIntent: null,
            intentContext: null,
            currentState: 'idle',
            conversationHistory: [],
          });
          
          return `✅ *Amount Updated!*\n\n📋 Code: *${lastCode}*\n💰 New Amount: ₹${newAmount.toLocaleString('en-IN')}\n\n_Vendor payment has been corrected._ 🌳`;
        }
      }
      
      if (isCorrection && !newAmount) {
        return `What's the correct amount? 💰\n\n_Just send the number, e.g., "50000" or "1 lakh"_`;
      }
    }
    
    // If none of the above, reset and continue with normal flow
    await storage.updateWhatsappConversation(conversation.id, {
      activeIntent: null,
      intentContext: null,
      currentState: 'idle',
      conversationHistory: [],
    });
  }

  // INCOME SUBMISSION FLOW - Check if message indicates income/payment received
  if (mediaUrl && !conversation.activeIntent) {
    const incomeCheck = detectIncomeSubmission(messageText);
    
    if (incomeCheck.isIncome) {
      // This is an income submission (payment received screenshot)
      const providedAmount = extractAmount(messageText);
      const clientName = incomeCheck.clientName || 'Unknown Client';
      const incomeType = incomeCheck.type;
      
      if (providedAmount) {
        // Got amount - submit income for approval
        const requestCode = await storage.generateIncomeCode();
        const description = incomeType === 'bank_transfer' 
          ? `Bank transfer from ${clientName}`
          : `Payment received from ${clientName}`;
        
        await storage.createIncomeSubmission({
          requestCode,
          employeeId: employee.id,
          employeeName: employee.name,
          employeePhone: employee.phone || normalizedPhone,
          type: incomeType,
          clientName,
          description,
          amount: providedAmount.toString(),
          screenshotUrl: mediaUrl,
          status: 'pending',
        });

        // Notify Kishor for approval
        await notifyKishorIncomeSubmission(
          requestCode,
          employee.name,
          incomeType,
          clientName,
          description,
          providedAmount,
          mediaUrl
        );

        await storage.updateWhatsappConversation(conversation.id, {
          activeIntent: null,
          intentContext: null,
          currentState: 'idle',
          conversationHistory: [],
        });

        const typeLabel = incomeType === 'bank_transfer' ? 'Bank Transfer' : 'Client Payment';
        return `✅ *Income Submitted for Approval!*\n\n📋 Code: *${requestCode}*\n💰 Amount: ₹${providedAmount.toLocaleString('en-IN')}\n👤 From: ${clientName}\n📁 Type: ${typeLabel}\n\n_Kishor will review and record this in the daybook._ 🌳`;
      } else {
        // No amount - ask for amount
        await storage.updateWhatsappConversation(conversation.id, {
          activeIntent: 'income_submission',
          intentContext: { 
            incomeScreenshotUrl: mediaUrl,
            incomeClientName: clientName,
            incomeType: incomeType,
          },
          conversationHistory: history,
          currentState: 'awaiting_income_amount',
        });

        return `📥 Got your payment screenshot from ${clientName}!\n\nHow much was received? 💰`;
      }
    }
  }

  // TEXT-ONLY INCOME SUBMISSION - Detect income messages without screenshot
  // This runs for text-only messages (no mediaUrl) before falling through to other flows
  if (!mediaUrl && !conversation.activeIntent) {
    const incomeCheck = detectIncomeSubmission(messageText);
    
    if (incomeCheck.isIncome) {
      const providedAmount = extractAmount(messageText);
      const clientName = incomeCheck.clientName || 'Client';
      const incomeType = incomeCheck.type;
      const extractedBankName = incomeCheck.bankName;
      
      if (providedAmount) {
        // Got amount - submit income for approval
        const requestCode = await storage.generateIncomeCode();
        const description = incomeType === 'bank_transfer' 
          ? `Bank transfer from ${clientName}`
          : `Payment received from ${clientName}`;
        
        // Try to match bank name to existing banks
        let bankId: string | undefined;
        let resolvedBankName = extractedBankName;
        
        if (extractedBankName) {
          const banks = await storage.getAllBanks();
          const matchingBank = banks.find(b => 
            b.name.toLowerCase().includes(extractedBankName.toLowerCase()) ||
            extractedBankName.toLowerCase().includes(b.name.toLowerCase())
          );
          if (matchingBank) {
            bankId = matchingBank.id;
            resolvedBankName = matchingBank.name;
          }
        }
        
        await storage.createIncomeSubmission({
          requestCode,
          employeeId: employee.id,
          employeeName: employee.name,
          employeePhone: employee.phone || normalizedPhone,
          type: incomeType,
          clientName,
          description,
          amount: providedAmount.toString(),
          screenshotUrl: null,
          bankId: bankId || null,
          bankName: resolvedBankName || null,
          status: 'pending',
        });

        // Notify Kishor for approval
        await notifyKishorIncomeSubmission(
          requestCode,
          employee.name,
          incomeType,
          clientName,
          description,
          providedAmount,
          undefined,  // No screenshot
          resolvedBankName
        );

        await storage.updateWhatsappConversation(conversation.id, {
          activeIntent: null,
          intentContext: null,
          currentState: 'idle',
          conversationHistory: [],
        });

        const typeLabel = incomeType === 'bank_transfer' ? 'Bank Transfer' : 'Client Payment';
        const bankLabel = resolvedBankName ? `\n🏦 Bank: ${resolvedBankName}` : '';
        return `✅ *Income Submitted for Approval!*\n\n📋 Code: *${requestCode}*\n💰 Amount: ₹${providedAmount.toLocaleString('en-IN')}\n👤 From: ${clientName}\n📁 Type: ${typeLabel}${bankLabel}\n\n_Kishor will review and record this in the daybook._ 🌳`;
      } else {
        // No amount - ask for amount
        await storage.updateWhatsappConversation(conversation.id, {
          activeIntent: 'income_submission',
          intentContext: { 
            incomeClientName: clientName,
            incomeType: incomeType,
            incomeBankName: extractedBankName,
          },
          conversationHistory: history,
          currentState: 'awaiting_income_amount',
        });

        return `📥 *Income Submission*\n\n👤 From: ${clientName}\n\nHow much was received? 💰`;
      }
    }
  }

  // PENDING VENDOR PAYMENT FLOW - Detect "pending payment" messages
  const pendingCheck = detectPendingVendorPayment(messageText);
  if (pendingCheck.isPending) {
    const { vendorName, amount, eventName } = pendingCheck;
    
    if (vendorName && amount) {
      // Got vendor and amount - create the pending payment entry
      const requestCode = await storage.generateVendorPaymentCode();
      
      // Try to find the event if specified
      let eventId: string | undefined;
      let resolvedEventName = eventName;
      
      if (eventName) {
        const events = await storage.getAllEvents();
        const matchingEvent = events.find(e => 
          e.title.toLowerCase().includes(eventName.toLowerCase()) ||
          (e.customer && e.customer.toLowerCase().includes(eventName.toLowerCase()))
        );
        if (matchingEvent) {
          eventId = matchingEvent.id;
          resolvedEventName = matchingEvent.title;
        }
      }
      
      await storage.createPendingVendorPayment({
        requestCode,
        employeeId: employee.id,
        employeeName: employee.name,
        employeePhone: employee.phone || normalizedPhone,
        vendorName,
        amount: amount.toString(),
        eventId: eventId || null,
        eventName: resolvedEventName || null,
        description: messageText,
        status: 'pending',
      });

      // Notify Kishor about the pending vendor payment
      await notifyKishorPendingVendorPayment(
        requestCode,
        employee.name,
        vendorName,
        amount,
        resolvedEventName || 'Not specified'
      );

      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: null,
        intentContext: { lastVendorPaymentCode: requestCode, lastVendorPaymentAmount: amount },
        currentState: 'vendor_payment_recorded',
        conversationHistory: [],
      });

      return `✅ *Pending Vendor Payment Recorded!*\n\n📋 Code: *${requestCode}*\n🏪 Vendor: ${vendorName}\n💰 Amount: ₹${amount.toLocaleString('en-IN')}\n📅 Event: ${resolvedEventName || 'Not specified'}\n\n_Say "change to [amount]" to correct it, or type "ok" to confirm._`;
    } else if (vendorName) {
      // Got vendor but no amount - ask for amount
      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: 'pending_vendor_payment',
        intentContext: { 
          vendorPaymentVendor: vendorName,
          vendorPaymentEvent: eventName,
        },
        conversationHistory: history,
        currentState: 'awaiting_vendor_amount',
      });

      return `📋 Vendor payment for *${vendorName}*\n\nWhat's the amount? 💰`;
    } else {
      // Got "vendor payment" but no vendor - ask for details
      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: 'pending_vendor_payment',
        intentContext: {},
        conversationHistory: history,
        currentState: 'awaiting_vendor_details',
      });

      return `📋 *Vendor Payment*\n\nSend: Vendor name, Amount\n\n_Example: "Flower shop 5000"_\n_Or with event: "Flower shop 5000 Sharma Wedding"_`;
    }
  }

  // SMART IMAGE DETECTION - Always analyze with AI first
  if (mediaUrl && !conversation.activeIntent) {
    context.screenshotUrl = mediaUrl;
    
    // Check message text for explicit clues
    const lowerText = messageText.toLowerCase();
    const textProvidedAmount = extractAmountFlexible(messageText);
    const purposeText = messageText.replace(/₹?\s*\d+[,\d]*\.?\d*/g, '').replace(/rs\.?\s*/gi, '').trim();
    
    // EARLY INVENTORY CHECK: If user is authorized for inventory and message looks like inventory item
    // Skip the expense flow and let the AI handle it for inventory processing
    const looksLikeInventoryEarly = /inventory|warehouse|stock|create inventory|add item|new item|item\s*:/i.test(lowerText);
    const hasQuantityPatternEarly = /quantity\s*[:]\s*\d+|\d+\s*(nos|pcs|pieces|units)/i.test(lowerText);
    const isAuthorizedForInventoryEarly = isAuthorizedInventoryCreator(normalizedPhone);
    
    if (isAuthorizedForInventoryEarly && (looksLikeInventoryEarly || hasQuantityPatternEarly)) {
      console.log('[Oaksy] Early inventory detection triggered, skipping expense flow for AI processing');
      // Store the photo URL in context and let AI handle it
      context.inventoryItemPhotoUrl = mediaUrl;
      // Don't return - continue to AI processing below
    } else {
      // Explicit QR indicator - only for actual QR code images user wants to pay
      const explicitQr = /\b(qr|qr\s*code|scan|pay\s+here)\b/i.test(lowerText);
    
      // ALWAYS analyze images with AI to extract amount and type
    let imageAnalysis: { imageType: string; amount: number | null; transactionType: string; counterparty: string | null; confidence: number; description: string } | null = null;
    
    console.log('[Oaksy] Analyzing image with AI for:', mediaUrl);
    try {
      imageAnalysis = await analyzeImageFromUrl(mediaUrl);
      console.log('[Oaksy] Image analysis result:', JSON.stringify(imageAnalysis));
    } catch (error) {
      console.error('[Oaksy] Image analysis failed:', error);
    }
    
    // Use AI-detected amount, fall back to text-provided amount
    const detectedAmount = imageAnalysis?.amount || textProvidedAmount || null;
    const detectedCounterparty = imageAnalysis?.counterparty || null;
    const detectedType = imageAnalysis?.transactionType || 'unknown';
    const isQrCode = explicitQr || (imageAnalysis?.imageType === 'qr_code' && imageAnalysis.confidence >= 0.6);
    
    // Check if user already told us it's a PETTY expense in their message (all employees can do this)
    const isPettyExpenseInMessage = /\b(petty|personal|reimbursement|taxi|food|lunch|dinner|travel|auto|uber|ola)\b/i.test(lowerText) && /\b(expense|spent|paid)\b/i.test(lowerText);
    
    // Check if user explicitly said it's an EVENT expense or income (authorized only)
    const isEventExpenseInMessage = /\b(vendor|event|client|income|received|payment\s+from|credited)\b/i.test(lowerText);
    
    const descriptionInMessage = messageText
      .replace(/₹?\s*\d+[,\d]*\.?\d*/g, '')
      .replace(/\b(expense|spent|paid\s+for|income|received|payment\s+from|credited|petty|personal|reimbursement)\b\s*(for|from)?\s*/gi, '')
      .replace(/rs\.?\s*/gi, '')
      .trim();
    
    // If user explicitly says "petty expense" + amount, complete immediately (open to all employees)
    if (detectedAmount && isPettyExpenseInMessage && !isEventExpenseInMessage) {
      const description = descriptionInMessage || detectedCounterparty || 'Petty Expense';
      
      const { requestCode } = await createQrPaymentRequest(
        employee.id,
        employee.name,
        employee.phone || normalizedPhone,
        'Petty',
        description,
        detectedAmount,
        mediaUrl,
        'petty'
      );

      await notifyKishorQrPayment(requestCode, employee.name, description, detectedAmount, mediaUrl);

      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: null,
        intentContext: null,
        currentState: 'idle',
        conversationHistory: [],
      });

      return `✅ *Thank you!*\n\nPetty expense recorded:\n💰 Amount: ₹${detectedAmount.toLocaleString('en-IN')}\n📝 For: ${description}\n\n_Sent to Kishor for approval_ 🌳`;
    }
    
    // If user says "event income/expense" but is not authorized, deny
    if (isEventExpenseInMessage && !isAllowedExpenseSubmitter(normalizedPhone)) {
      return `👋 Hi ${employee.name}!\n\n❌ Event income and vendor payments can only be submitted by authorized team members (Fida, Femina, or the Accountant).\n\n💡 For *personal expenses* (taxi, food, etc.), send the receipt and say "petty expense".\n\n🌳 Oaksy`;
    }
    
    // If authorized user says event income/expense + amount, complete immediately
    if (detectedAmount && isEventExpenseInMessage && isAllowedExpenseSubmitter(normalizedPhone)) {
      const description = descriptionInMessage || detectedCounterparty || 'Event Payment';
      
      if (/\b(income|received|credited|payment\s+from)\b/i.test(lowerText)) {
        // Event income
        const requestCode = await storage.generateIncomeCode();
        await storage.createIncomeSubmission({
          requestCode,
          employeeId: employee.id,
          employeeName: employee.name,
          employeePhone: employee.phone || normalizedPhone,
          type: 'client_payment',
          clientName: description,
          description: `Income from ${description}`,
          amount: detectedAmount.toString(),
          screenshotUrl: mediaUrl,
          status: 'pending',
        });

        await notifyKishorIncomeSubmission(requestCode, employee.name, 'client_payment', description, `Income from ${description}`, detectedAmount, mediaUrl);

        await storage.updateWhatsappConversation(conversation.id, {
          activeIntent: null,
          intentContext: null,
          currentState: 'idle',
          conversationHistory: [],
        });

        return `✅ *Thank you!*\n\nEvent income recorded:\n💰 Amount: ₹${detectedAmount.toLocaleString('en-IN')}\n👤 From: ${description}\n\n_Sent to Kishor for approval_ 🌳`;
      } else {
        // Event vendor expense
        const { requestCode } = await createQrPaymentRequest(
          employee.id,
          employee.name,
          employee.phone || normalizedPhone,
          'Vendor',
          description,
          detectedAmount,
          mediaUrl,
          'event'
        );

        await notifyKishorQrPayment(requestCode, employee.name, description, detectedAmount, mediaUrl);

        await storage.updateWhatsappConversation(conversation.id, {
          activeIntent: null,
          intentContext: null,
          currentState: 'idle',
          conversationHistory: [],
        });

        return `✅ *Thank you!*\n\nVendor expense recorded:\n💰 Amount: ₹${detectedAmount.toLocaleString('en-IN')}\n📝 For: ${description}\n\n_Sent to Kishor for approval_ 🌳`;
      }
    }
    
    // NEW FLOW: Different paths for authorized vs non-authorized users
    const providedAmount = detectedAmount;
    const isAuthorized = isAllowedExpenseSubmitter(normalizedPhone);
    
    let imageResponse: string;
    
    if (isAuthorized) {
      // Authorized users get category choice (petty vs event)
      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: 'image_classification',
        intentContext: { 
          qrImageUrl: mediaUrl,
          incomeScreenshotUrl: mediaUrl,
          providedAmount: providedAmount,
          detectedCounterparty: detectedCounterparty,
        },
        conversationHistory: history,
        currentState: 'awaiting_submission_category',
      });
      
      if (providedAmount) {
        imageResponse = `📸 *Rs.${providedAmount.toLocaleString('en-IN')}/-*\n\nWhat type of submission?\n\n*1.* 🧾 Petty Expense (personal: taxi, food, etc.)\n*2.* 💼 Event Payment (vendor/client)`;
      } else {
        imageResponse = `📸 *Got your screenshot!*\n\nWhat type of submission?\n\n*1.* 🧾 Petty Expense (personal: taxi, food, etc.)\n*2.* 💼 Event Payment (vendor/client)\n\n_(Also mention the amount)_`;
      }
    } else {
      // Non-authorized users go directly to petty expense flow
      if (providedAmount) {
        await storage.updateWhatsappConversation(conversation.id, {
          activeIntent: 'qr_payment',
          intentContext: { 
            qrImageUrl: mediaUrl,
            amount: providedAmount,
            submissionCategory: 'petty',
          },
          conversationHistory: history,
          currentState: 'awaiting_qr_purpose_only',
        });
        imageResponse = `📸 *Rs.${providedAmount.toLocaleString('en-IN')}/-*\n\n🧾 *Petty Expense*\n\nWhat is this expense for?\n_Example: "taxi to venue" or "lunch"_`;
      } else {
        await storage.updateWhatsappConversation(conversation.id, {
          activeIntent: 'qr_payment',
          intentContext: { 
            qrImageUrl: mediaUrl,
            submissionCategory: 'petty',
          },
          conversationHistory: history,
          currentState: 'awaiting_qr_details',
        });
        imageResponse = `📸 *Got your screenshot!*\n\n🧾 *Petty Expense*\n\nWhat is this expense for and how much?\n_Example: "500 taxi" or "200 lunch"_`;
      }
    }
    
    history.push({ role: 'assistant', content: imageResponse, timestamp: Date.now() });
    await storage.updateWhatsappConversation(conversation.id, { conversationHistory: history });
    
    return imageResponse;
    } // End of else block for non-inventory photos
  }
  
  // Handle image classification flow
  if (conversation.activeIntent === 'image_classification') {
    // NEW: Handle category selection (petty vs event)
    if (conversation.currentState === 'awaiting_submission_category') {
      const imgContext = context as any;
      const imageUrl = imgContext.qrImageUrl || imgContext.incomeScreenshotUrl || '';
      const savedAmount = imgContext.providedAmount;
      const savedCounterparty = imgContext.detectedCounterparty || '';
      
      // Check if user chose petty expense (1) or event payment (2)
      const isPettyChoice = /\b(1|petty|personal|reimbursement|taxi|food)\b/i.test(lowerMessage);
      const isEventChoice = /\b(2|event|vendor|client|income)\b/i.test(lowerMessage);
      
      // Extract any amount or description from the message
      const messageAmount = extractAmountFlexible(messageText);
      const finalAmount = savedAmount || messageAmount;
      const descriptionFromMessage = messageText
        .replace(/^(1|2)\s*/i, '')
        .replace(/\b(petty|personal|event|vendor|client|income|expense)\b\s*/gi, '')
        .replace(/₹?\s*\d+[,\d]*\.?\d*/g, '')
        .replace(/rs\.?\s*/gi, '')
        .trim();
      
      if (isPettyChoice && !isEventChoice) {
        // User chose petty expense - proceed for all employees
        if (finalAmount && descriptionFromMessage) {
          // Complete immediately
          const { requestCode } = await createQrPaymentRequest(
            employee.id,
            employee.name,
            employee.phone || normalizedPhone,
            'Petty',
            descriptionFromMessage,
            finalAmount,
            imageUrl,
            'petty'
          );
          
          await notifyKishorQrPayment(requestCode, employee.name, descriptionFromMessage, finalAmount, imageUrl);
          
          await storage.updateWhatsappConversation(conversation.id, {
            activeIntent: null,
            intentContext: null,
            currentState: 'idle',
            conversationHistory: [],
          });
          
          return `✅ *Thank you!*\n\nPetty expense recorded:\n💰 Amount: ₹${finalAmount.toLocaleString('en-IN')}\n📝 For: ${descriptionFromMessage}\n\n_Sent to Kishor for approval_ 🌳`;
        } else if (finalAmount) {
          // Have amount, need description
          await storage.updateWhatsappConversation(conversation.id, {
            activeIntent: 'qr_payment',
            intentContext: { qrImageUrl: imageUrl, amount: finalAmount, submissionCategory: 'petty' },
            conversationHistory: history,
            currentState: 'awaiting_qr_purpose_only',
          });
          return `🧾 *Petty Expense - ₹${finalAmount.toLocaleString('en-IN')}*\n\nWhat is this expense for?\n_Example: "taxi" or "lunch"_`;
        } else {
          // Need both amount and description
          await storage.updateWhatsappConversation(conversation.id, {
            activeIntent: 'qr_payment',
            intentContext: { qrImageUrl: imageUrl, submissionCategory: 'petty' },
            conversationHistory: history,
            currentState: 'awaiting_qr_details',
          });
          return `🧾 *Petty Expense*\n\nWhat's the amount and purpose?\n_Example: "500 taxi" or "200 lunch"_`;
        }
      }
      
      if (isEventChoice) {
        // User chose event payment - check authorization
        if (!isAllowedExpenseSubmitter(normalizedPhone)) {
          await storage.updateWhatsappConversation(conversation.id, {
            activeIntent: null,
            intentContext: null,
            currentState: 'idle',
            conversationHistory: [],
          });
          return `❌ Event income and vendor payments can only be submitted by authorized team members (Fida, Femina, or the Accountant).\n\n💡 For *personal expenses*, send the receipt again and choose option 1.\n\n🌳 Oaksy`;
        }
        
        // Authorized user - ask if it's expense or income
        await storage.updateWhatsappConversation(conversation.id, {
          activeIntent: 'image_classification',
          intentContext: { ...imgContext, submissionCategory: 'event' },
          conversationHistory: history,
          currentState: 'awaiting_event_type',
        });
        return `💼 *Event Payment*\n\nIs this:\n*1.* 💸 Vendor Expense (payment made)\n*2.* 💵 Client Income (payment received)`;
      }
      
      // Didn't understand - ask again
      return `Please choose:\n\n*1.* 🧾 Petty Expense (personal: taxi, food, etc.)\n*2.* 💼 Event Payment (vendor/client)`;
    }
    
    // NEW: Handle event type selection (expense vs income for authorized users)
    if (conversation.currentState === 'awaiting_event_type') {
      const imgContext = context as any;
      const imageUrl = imgContext.qrImageUrl || imgContext.incomeScreenshotUrl || '';
      const savedAmount = imgContext.providedAmount;
      const savedCounterparty = imgContext.detectedCounterparty || '';
      
      const isExpenseChoice = /\b(1|expense|vendor|paid|spent)\b/i.test(lowerMessage);
      const isIncomeChoice = /\b(2|income|client|received|got)\b/i.test(lowerMessage);
      
      const messageAmount = extractAmountFlexible(messageText);
      const finalAmount = savedAmount || messageAmount;
      const descriptionFromMessage = messageText
        .replace(/^(1|2)\s*/i, '')
        .replace(/\b(expense|income|vendor|client|paid|received)\b\s*(for|from)?\s*/gi, '')
        .replace(/₹?\s*\d+[,\d]*\.?\d*/g, '')
        .replace(/rs\.?\s*/gi, '')
        .trim();
      
      if (isExpenseChoice && !isIncomeChoice) {
        // Vendor expense
        if (finalAmount && descriptionFromMessage) {
          const { requestCode } = await createQrPaymentRequest(
            employee.id,
            employee.name,
            employee.phone || normalizedPhone,
            'Vendor',
            descriptionFromMessage,
            finalAmount,
            imageUrl,
            'event'
          );
          
          await notifyKishorQrPayment(requestCode, employee.name, descriptionFromMessage, finalAmount, imageUrl);
          
          await storage.updateWhatsappConversation(conversation.id, {
            activeIntent: null,
            intentContext: null,
            currentState: 'idle',
            conversationHistory: [],
          });
          
          return `✅ *Thank you!*\n\nVendor expense recorded:\n💰 Amount: ₹${finalAmount.toLocaleString('en-IN')}\n📝 For: ${descriptionFromMessage}\n\n_Sent to Kishor for approval_ 🌳`;
        } else if (finalAmount) {
          await storage.updateWhatsappConversation(conversation.id, {
            activeIntent: 'qr_payment',
            intentContext: { qrImageUrl: imageUrl, amount: finalAmount, submissionCategory: 'event' },
            conversationHistory: history,
            currentState: 'awaiting_qr_purpose_only',
          });
          return `💸 *Vendor Expense - ₹${finalAmount.toLocaleString('en-IN')}*\n\nWhich vendor is this for?`;
        } else {
          await storage.updateWhatsappConversation(conversation.id, {
            activeIntent: 'qr_payment',
            intentContext: { qrImageUrl: imageUrl, submissionCategory: 'event' },
            conversationHistory: history,
            currentState: 'awaiting_qr_details',
          });
          return `💸 *Vendor Expense*\n\nVendor name and amount?\n_Example: "Florist 5000" or "Caterer 20k"_`;
        }
      }
      
      if (isIncomeChoice) {
        // Client income
        if (finalAmount && descriptionFromMessage) {
          const requestCode = await storage.generateIncomeCode();
          await storage.createIncomeSubmission({
            requestCode,
            employeeId: employee.id,
            employeeName: employee.name,
            employeePhone: employee.phone || normalizedPhone,
            type: 'client_payment',
            clientName: descriptionFromMessage,
            description: `Income from ${descriptionFromMessage}`,
            amount: finalAmount.toString(),
            screenshotUrl: imageUrl,
            status: 'pending',
          });
          
          await notifyKishorIncomeSubmission(requestCode, employee.name, 'client_payment', descriptionFromMessage, `Income from ${descriptionFromMessage}`, finalAmount, imageUrl);
          
          await storage.updateWhatsappConversation(conversation.id, {
            activeIntent: null,
            intentContext: null,
            currentState: 'idle',
            conversationHistory: [],
          });
          
          return `✅ *Thank you!*\n\nClient income recorded:\n💰 Amount: ₹${finalAmount.toLocaleString('en-IN')}\n👤 From: ${descriptionFromMessage}\n\n_Sent to Kishor for approval_ 🌳`;
        } else if (finalAmount) {
          await storage.updateWhatsappConversation(conversation.id, {
            activeIntent: 'income_submission',
            intentContext: { incomeScreenshotUrl: imageUrl, amount: finalAmount, incomeType: 'client_payment' },
            conversationHistory: history,
            currentState: 'awaiting_income_client',
          });
          return `💵 *Client Income - ₹${finalAmount.toLocaleString('en-IN')}*\n\nWhich client is this from?`;
        } else {
          await storage.updateWhatsappConversation(conversation.id, {
            activeIntent: 'income_submission',
            intentContext: { incomeScreenshotUrl: imageUrl, incomeType: 'client_payment' },
            conversationHistory: history,
            currentState: 'awaiting_income_details',
          });
          return `💵 *Client Income*\n\nClient name and amount?\n_Example: "Sharma family 50000" or "Raj 1 lakh"_`;
        }
      }
      
      // Didn't understand
      return `Please choose:\n\n*1.* 💸 Vendor Expense (payment made)\n*2.* 💵 Client Income (payment received)`;
    }
    
    // EXISTING: Handle expense/income question (legacy flow for awaiting_image_type)
    if (conversation.currentState === 'awaiting_image_type') {
      const imgContext = context as any;
      const imageUrl = imgContext.qrImageUrl || imgContext.incomeScreenshotUrl || '';
      const savedAmount = imgContext.providedAmount;
      const savedCounterparty = imgContext.detectedCounterparty || '';
      
      // Check user's response - they may include description in same message
      // e.g., "Expense for Food Dr.Martin event" or "1 taxi fare" or "expense 500 lunch"
      const isExpenseResponse = /\b(1|expense|spent|paid)\b/i.test(lowerMessage);
      const isIncomeResponse = /\b(2|income|received|got)\b/i.test(lowerMessage);
      
      // Extract description from the message (everything after expense/income keywords)
      const descriptionFromMessage = messageText
        .replace(/^(1|2)\s*/i, '')
        .replace(/\b(expense|spent|paid|income|received|got)\b\s*(for|from)?\s*/gi, '')
        .trim();
      
      // Try to extract amount from message if not already detected
      const messageAmount = extractAmountFlexible(messageText);
      const finalAmount = savedAmount || messageAmount;
      
      if (isExpenseResponse) {
        // User said expense - if we have description too, complete. Otherwise ask for it.
        const description = descriptionFromMessage || '';
        
        if (finalAmount && description) {
          // We have both amount and description - complete the expense
          const { requestCode } = await createQrPaymentRequest(
            employee.id,
            employee.name,
            employee.phone || normalizedPhone,
            'Other',
            description,
            finalAmount,
            imageUrl
          );

          await notifyKishorQrPayment(requestCode, employee.name, description, finalAmount, imageUrl);

          await storage.updateWhatsappConversation(conversation.id, {
            activeIntent: null,
            intentContext: null,
            currentState: 'idle',
            conversationHistory: [],
          });

          return `✅ *Thank you!*\n\nExpense recorded:\n💰 Amount: ₹${finalAmount.toLocaleString('en-IN')}\n📝 For: ${description}\n\n_Sent to Kishor for approval_ 🌳`;
        } else if (finalAmount) {
          // Have amount, need description - ask what it's for
          const expenseContext: IntentContext = { qrImageUrl: imageUrl, amount: finalAmount };
          await storage.updateWhatsappConversation(conversation.id, {
            activeIntent: 'qr_payment',
            intentContext: expenseContext,
            conversationHistory: history,
            currentState: 'awaiting_qr_purpose_only',
          });
          return `📝 *Expense - ₹${finalAmount.toLocaleString('en-IN')}*\n\nWhat is this expense for?`;
        } else {
          // No amount - ask for amount and description
          const expenseContext: IntentContext = { qrImageUrl: imageUrl };
          await storage.updateWhatsappConversation(conversation.id, {
            activeIntent: 'qr_payment',
            intentContext: expenseContext,
            conversationHistory: history,
            currentState: 'awaiting_qr_details',
          });
          return `📝 *Expense*\n\nPlease tell me the amount and what it's for.\n_Example: "500 taxi" or "1200 lunch"_`;
        }
      }
      
      if (isIncomeResponse) {
        // User said income - if we have description too, complete. Otherwise ask for it.
        const clientName = descriptionFromMessage || '';
        
        if (finalAmount && clientName) {
          // We have both amount and client - complete the income
          const requestCode = await storage.generateIncomeCode();
          await storage.createIncomeSubmission({
            requestCode,
            employeeId: employee.id,
            employeeName: employee.name,
            employeePhone: employee.phone || normalizedPhone,
            type: 'client_payment',
            clientName,
            description: `Income from ${clientName}`,
            amount: finalAmount.toString(),
            screenshotUrl: imageUrl,
            status: 'pending',
          });

          await notifyKishorIncomeSubmission(requestCode, employee.name, 'client_payment', clientName, `Income from ${clientName}`, finalAmount, imageUrl);

          await storage.updateWhatsappConversation(conversation.id, {
            activeIntent: null,
            intentContext: null,
            currentState: 'idle',
            conversationHistory: [],
          });

          return `✅ *Thank you!*\n\nIncome recorded:\n💰 Amount: ₹${finalAmount.toLocaleString('en-IN')}\n👤 From: ${clientName}\n\n_Sent to Kishor for approval_ 🌳`;
        } else if (finalAmount) {
          // Have amount, need client name - ask who it's from
          const incomeContext: IntentContext = { 
            incomeScreenshotUrl: imageUrl,
            amount: finalAmount,
            incomeType: 'client_payment',
          };
          await storage.updateWhatsappConversation(conversation.id, {
            activeIntent: 'income_submission',
            intentContext: incomeContext,
            conversationHistory: history,
            currentState: 'awaiting_income_client',
          });
          return `💵 *Income - ₹${finalAmount.toLocaleString('en-IN')}*\n\nWho is this income from?`;
        } else {
          // No amount - ask for amount and client
          const incomeContext: IntentContext = { 
            incomeScreenshotUrl: imageUrl,
            incomeType: 'client_payment',
          };
          await storage.updateWhatsappConversation(conversation.id, {
            activeIntent: 'income_submission',
            intentContext: incomeContext,
            conversationHistory: history,
            currentState: 'awaiting_income_details',
          });
          return `💵 *Income*\n\nPlease tell me the amount and who it's from.\n_Example: "50000 Sharma Wedding" or "25000 Rahul"_`;
        }
      }
      
      // User didn't give a clear answer - ask again
      return `Please reply with:\n• *1* or *expense*\n• *2* or *income*`;
    }
  }
  
  // Handle simplified QR payment flow states
  if (conversation.activeIntent === 'qr_payment') {
    // Waiting for just purpose (amount already provided)
    if (conversation.currentState === 'awaiting_qr_purpose_only') {
      console.log(`[QR Purpose] Processing expense description: "${messageText}", amount: ${context.amount}, imageUrl: ${context.qrImageUrl}`);
      context.qrPaymentDescription = messageText;
      context.qrPaymentCategory = 'Other';
      
      const { requestCode } = await createQrPaymentRequest(
        employee.id,
        employee.name,
        employee.phone || normalizedPhone,
        'Other',
        messageText,
        context.amount || 0,
        context.qrImageUrl || ''
      );
      console.log(`[QR Purpose] Created request ${requestCode}, now sending notification to Kishor...`);

      try {
        await notifyKishorQrPayment(
          requestCode,
          employee.name,
          messageText,
          context.amount || 0,
          context.qrImageUrl || ''
        );
        console.log(`[QR Purpose] Notification to Kishor completed for ${requestCode}`);
      } catch (notifyError: any) {
        console.error(`[QR Purpose] FAILED to notify Kishor for ${requestCode}:`, notifyError.message);
      }

      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: null,
        intentContext: null,
        currentState: 'idle',
        conversationHistory: [],
      });

      return `✅ *Sent to Kishor!*\n\n📋 Code: *${requestCode}*\n💰 Amount: ₹${context.amount?.toLocaleString('en-IN')}\n📝 For: ${messageText}\n\n_You'll be notified once payment is done!_ 🌳`;
    }
    
    // Waiting for both amount and purpose
    if (conversation.currentState === 'awaiting_qr_details') {
      const amount = extractAmountFlexible(messageText);
      const purposeText = messageText.replace(/₹?\s*\d+[,\d]*\.?\d*/g, '').replace(/rs\.?\s*/gi, '').replace(/for\s+/i, '').trim();
      
      if (!amount && purposeText && purposeText.length > 1) {
        // User gave description but no amount - save description and ask just for amount
        context.qrPaymentDescription = purposeText;
        
        await storage.updateWhatsappConversation(conversation.id, {
          activeIntent: 'qr_payment',
          intentContext: context,
          conversationHistory: history,
          currentState: 'awaiting_qr_amount_only',
        });
        
        return `📝 Got it: *${purposeText}*\n\nWhat's the amount? 💰`;
      }
      
      if (!amount) {
        // Check if we already have a description saved - ask only for amount
        if (context.qrPaymentDescription) {
          return `What's the amount for "${context.qrPaymentDescription}"? 💰\n\n_Example: 500 or ₹1200_`;
        }
        return `Please send the amount and what it's for.\n\n_Example: "500 for taxi" or "1200 lunch"_`;
      }
      
      const description = purposeText || context.qrPaymentDescription || 'Payment';
      
      context.amount = amount;
      context.qrPaymentDescription = description;
      context.qrPaymentCategory = 'Other';
      
      const { requestCode } = await createQrPaymentRequest(
        employee.id,
        employee.name,
        employee.phone || normalizedPhone,
        'Other',
        description,
        amount,
        context.qrImageUrl || ''
      );

      await notifyKishorQrPayment(
        requestCode,
        employee.name,
        description,
        amount,
        context.qrImageUrl || ''
      );

      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: null,
        intentContext: null,
        currentState: 'idle',
        conversationHistory: [],
      });

      return `✅ *Sent to Kishor!*\n\n📋 Code: *${requestCode}*\n💰 Amount: ₹${amount.toLocaleString('en-IN')}\n📝 For: ${description}\n\n_You'll be notified once payment is done!_ 🌳`;
    }
    
    // Waiting for just amount (description already provided)
    if (conversation.currentState === 'awaiting_qr_amount_only') {
      const amount = extractAmountFlexible(messageText);
      if (!amount) {
        return `Just the amount please. Example: "500" or "₹1200"`;
      }
      
      const description = context.qrPaymentDescription || 'Payment';
      
      const { requestCode } = await createQrPaymentRequest(
        employee.id,
        employee.name,
        employee.phone || normalizedPhone,
        'Other',
        description,
        amount,
        context.qrImageUrl || ''
      );

      await notifyKishorQrPayment(
        requestCode,
        employee.name,
        description,
        amount,
        context.qrImageUrl || ''
      );

      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: null,
        intentContext: null,
        currentState: 'idle',
        conversationHistory: [],
      });

      return `✅ *Sent to Kishor!*\n\n📋 Code: *${requestCode}*\n💰 Amount: ₹${amount.toLocaleString('en-IN')}\n📝 For: ${description}\n\n_You'll be notified once payment is done!_ 🌳`;
    }
    
    // Legacy states - reset and ask to start over
    if (conversation.currentState === 'awaiting_qr_description' || 
        conversation.currentState === 'awaiting_qr_confirmation' ||
        conversation.currentState === 'awaiting_qr_category' ||
        conversation.currentState === 'awaiting_qr_amount') {
      // Reset to idle and ask to resend
      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: null,
        intentContext: null,
        currentState: 'idle',
        conversationHistory: [],
      });
      
      return `Let's start fresh! Please send your QR code again with the amount and purpose.\n\n_Example: Send QR image with "500 for taxi"_`;
    }
  }

  // Handle income submission flow states
  if (conversation.activeIntent === 'income_submission') {
    // Waiting for just client name (amount already provided from image classification)
    if (conversation.currentState === 'awaiting_income_client') {
      const incomeContext = context as any;
      const screenshotUrl = incomeContext.incomeScreenshotUrl || '';
      const savedAmount = incomeContext.amount || 0;
      const clientName = messageText.trim() || 'Client';
      
      const requestCode = await storage.generateIncomeCode();
      const description = `Payment received from ${clientName}`;
      
      await storage.createIncomeSubmission({
        requestCode,
        employeeId: employee.id,
        employeeName: employee.name,
        employeePhone: employee.phone || normalizedPhone,
        type: 'client_payment',
        clientName,
        description,
        amount: savedAmount.toString(),
        screenshotUrl,
        status: 'pending',
      });

      await notifyKishorIncomeSubmission(
        requestCode,
        employee.name,
        'client_payment',
        clientName,
        description,
        savedAmount,
        screenshotUrl
      );

      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: null,
        intentContext: null,
        currentState: 'idle',
        conversationHistory: [],
      });

      return `✅ *Income Submitted!*\n\n📋 Code: *${requestCode}*\n💰 Amount: ₹${savedAmount.toLocaleString('en-IN')}\n👤 From: ${clientName}\n\n_Waiting for approval from Kishor_ 🌳`;
    }
    
    // Waiting for both amount and client name (from image classification)
    if (conversation.currentState === 'awaiting_income_details') {
      const incomeContext = context as any;
      const screenshotUrl = incomeContext.incomeScreenshotUrl || '';
      
      // Try to extract amount and client name
      const amount = extractAmountFlexible(messageText);
      const clientText = messageText.replace(/₹?\s*\d+[,\d]*\.?\d*/g, '').replace(/rs\.?\s*/gi, '').replace(/\b(from|by)\b/gi, '').trim();
      const clientName = clientText || 'Client';
      
      if (!amount) {
        return `Please include the amount. Example: "50000 from Sharma Wedding"`;
      }
      
      const requestCode = await storage.generateIncomeCode();
      const description = `Payment received from ${clientName}`;
      
      await storage.createIncomeSubmission({
        requestCode,
        employeeId: employee.id,
        employeeName: employee.name,
        employeePhone: employee.phone || normalizedPhone,
        type: 'client_payment',
        clientName,
        description,
        amount: amount.toString(),
        screenshotUrl,
        status: 'pending',
      });

      await notifyKishorIncomeSubmission(
        requestCode,
        employee.name,
        'client_payment',
        clientName,
        description,
        amount,
        screenshotUrl
      );

      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: null,
        intentContext: null,
        currentState: 'idle',
        conversationHistory: [],
      });

      return `✅ *Income Submitted!*\n\n📋 Code: *${requestCode}*\n💰 Amount: ₹${amount.toLocaleString('en-IN')}\n👤 From: ${clientName}\n\n_Waiting for approval from Kishor_ 🌳`;
    }
    
    // Waiting for amount after sending income screenshot
    if (conversation.currentState === 'awaiting_income_amount') {
      const amount = extractAmountFlexible(messageText);
      if (!amount) {
        return `Please tell me the amount received. Example: "₹50000" or "25000"`;
      }
      
      const incomeContext = context as any;
      const clientName = incomeContext.incomeClientName || 'Client';
      const incomeType = incomeContext.incomeType || 'client_payment';
      const screenshotUrl = incomeContext.incomeScreenshotUrl || '';
      
      const requestCode = await storage.generateIncomeCode();
      const description = incomeType === 'bank_transfer' 
        ? `Bank transfer from ${clientName}`
        : `Payment received from ${clientName}`;
      
      await storage.createIncomeSubmission({
        requestCode,
        employeeId: employee.id,
        employeeName: employee.name,
        employeePhone: employee.phone || normalizedPhone,
        type: incomeType,
        clientName,
        description,
        amount: amount.toString(),
        screenshotUrl,
        status: 'pending',
      });

      // Notify Kishor for approval
      await notifyKishorIncomeSubmission(
        requestCode,
        employee.name,
        incomeType,
        clientName,
        description,
        amount,
        screenshotUrl
      );

      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: null,
        intentContext: null,
        currentState: 'idle',
        conversationHistory: [],
      });

      const typeLabel = incomeType === 'bank_transfer' ? 'Bank Transfer' : 'Client Payment';
      return `✅ *Income Submitted for Approval!*\n\n📋 Code: *${requestCode}*\n💰 Amount: ₹${amount.toLocaleString('en-IN')}\n👤 From: ${clientName}\n📁 Type: ${typeLabel}\n\n_Kishor will review and record this in the daybook._ 🌳`;
    }
  }

  // Handle reminder flow - awaiting time or message
  if (conversation.activeIntent === 'reminder') {
    const reminderContext = context as any;
    
    // Awaiting time for the reminder
    if (conversation.currentState === 'awaiting_reminder_time') {
      // Get current time in IST for the AI prompt
      const nowIST = toZonedTime(new Date(), INDIA_TIMEZONE);
      const nowISTStr = `${nowIST.getFullYear()}-${String(nowIST.getMonth() + 1).padStart(2, '0')}-${String(nowIST.getDate()).padStart(2, '0')}T${String(nowIST.getHours()).padStart(2, '0')}:${String(nowIST.getMinutes()).padStart(2, '0')}:00`;
      
      // Use AI to parse the time
      const timeParsePrompt = `Parse this time/date into ISO format datetime.
Current date/time in India (IST): ${nowISTStr}
User input: "${messageText}"

The user is in India (IST timezone, UTC+5:30). Parse their input as IST time.

If the user says:
- "tomorrow at 9am" -> add 1 day and set time to 09:00
- "5pm today" -> set time to 17:00 today
- "morning" -> default to 09:00
- "evening" -> default to 17:00
- "in 2 hours" -> add 2 hours to current IST time

Return ONLY the datetime in format: YYYY-MM-DDTHH:MM:SS (no timezone offset, I will handle it).
Return "INVALID" if you cannot parse the input.`;

      try {
        const timeResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: timeParsePrompt }],
          max_tokens: 100,
        });
        
        const parsedTime = timeResponse.choices[0]?.message?.content?.trim() || '';
        console.log('[Oaksy] Reminder time raw from AI:', parsedTime, 'from input:', messageText);
        
        if (parsedTime && parsedTime !== 'INVALID' && !parsedTime.includes('INVALID')) {
          // Use our helper to properly parse the time as IST
          let dueAt = parseReminderDateTime(parsedTime);
          
          if (!dueAt) {
            return `⏰ I couldn't understand that time. Try:\n\n• "tomorrow at 9am"\n• "5pm today"\n• "in 2 hours"`;
          }
          
          // Auto-adjust past times to tomorrow (e.g., "4am" at night means tomorrow 4am)
          dueAt = autoAdjustPastTimeToTomorrow(dueAt);
          
          // Create the reminder
          await storage.createReminder({
            employeeId: employee.id,
            employeeName: employee.name,
            employeePhone: employee.phone || normalizedPhone,
            reminderMessage: reminderContext.reminderMessage || 'Reminder',
            dueAt: dueAt,
            timezone: 'Asia/Kolkata',
            status: 'pending',
          });
          
          // Reset conversation
          await storage.updateWhatsappConversation(conversation.id, {
            activeIntent: null,
            intentContext: null,
            currentState: 'idle',
            conversationHistory: [],
          });
          
          const timeStr = dueAt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
          const dateStr = dueAt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
          
          return `✅ *Reminder Set!*\n\n🔔 *What:* ${reminderContext.reminderMessage}\n📅 *When:* ${dateStr} at ${timeStr}\n\n_I'll send you a WhatsApp message at that time!_ ⏰`;
        }
      } catch (err) {
        console.error('[Oaksy] Error parsing reminder time:', err);
      }
      
      return `⏰ I couldn't understand that time. Try:\n\n• "tomorrow at 9am"\n• "5pm today"\n• "Monday morning"\n• "in 2 hours"`;
    }
    
    // Awaiting message for the reminder
    if (conversation.currentState === 'awaiting_reminder_message') {
      const reminderMessage = messageText.trim();
      
      if (!reminderMessage || reminderMessage.length < 2) {
        return `📝 Please tell me what to remind you about.\n\n_Example: "call flower vendor" or "check delivery"_`;
      }
      
      try {
        const dueAt = new Date(reminderContext.reminderDateTime);
        
        // Create the reminder
        await storage.createReminder({
          employeeId: employee.id,
          employeeName: employee.name,
          employeePhone: employee.phone || normalizedPhone,
          reminderMessage: reminderMessage,
          dueAt: dueAt,
          timezone: 'Asia/Kolkata',
          status: 'pending',
        });
        
        // Reset conversation
        await storage.updateWhatsappConversation(conversation.id, {
          activeIntent: null,
          intentContext: null,
          currentState: 'idle',
          conversationHistory: [],
        });
        
        const timeStr = dueAt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
        const dateStr = dueAt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
        
        return `✅ *Reminder Set!*\n\n🔔 *What:* ${reminderMessage}\n📅 *When:* ${dateStr} at ${timeStr}\n\n_I'll send you a WhatsApp message at that time!_ ⏰`;
      } catch (err) {
        console.error('[Oaksy] Error creating reminder:', err);
        return `❌ Sorry, something went wrong. Please try again.\n\n_Say "remind me" to start over_`;
      }
    }
    
    // Awaiting confirmation for past time (user said "today" but time passed)
    if (conversation.currentState === 'awaiting_past_time_confirmation') {
      const lowerMessage = messageText.toLowerCase().trim();
      
      // Check if user confirmed tomorrow
      if (lowerMessage === 'yes' || lowerMessage === 'y' || lowerMessage === 'ok' || lowerMessage === 'sure' || lowerMessage === 'tomorrow') {
        try {
          // Parse the stored datetime and adjust to tomorrow
          let dueAt = parseReminderDateTime(reminderContext.reminderDateTime);
          if (dueAt) {
            dueAt = autoAdjustPastTimeToTomorrow(dueAt);
            
            await storage.createReminder({
              employeeId: employee.id,
              employeeName: employee.name,
              employeePhone: employee.phone || normalizedPhone,
              reminderMessage: reminderContext.reminderMessage || 'Reminder',
              dueAt: dueAt,
              timezone: 'Asia/Kolkata',
              status: 'pending',
            });
            
            // Reset conversation
            await storage.updateWhatsappConversation(conversation.id, {
              activeIntent: null,
              intentContext: null,
              currentState: 'idle',
              conversationHistory: [],
            });
            
            const timeStr = dueAt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
            const dateStr = dueAt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
            
            return `✅ *Reminder Set!*\n\n🔔 *What:* ${reminderContext.reminderMessage}\n📅 *When:* ${dateStr} at ${timeStr}\n\n_I'll send you a WhatsApp message at that time!_ ⏰`;
          }
        } catch (err) {
          console.error('[Oaksy] Error creating reminder after confirmation:', err);
        }
        return `❌ Sorry, something went wrong. Please try again with a new reminder.`;
      }
      
      // User wants to cancel or provide a different time
      if (lowerMessage === 'no' || lowerMessage === 'n' || lowerMessage === 'cancel') {
        await storage.updateWhatsappConversation(conversation.id, {
          activeIntent: null,
          intentContext: null,
          currentState: 'idle',
          conversationHistory: [],
        });
        return `👍 Okay, no reminder set. Just tell me whenever you need one!`;
      }
      
      // Try to parse as a new time
      // Reset to awaiting_reminder_time state and let that handler process it
      await storage.updateWhatsappConversation(conversation.id, {
        currentState: 'awaiting_reminder_time',
      });
      
      // Continue to awaiting_reminder_time handler by recursing through the same logic
      // For now, just prompt for clarification
      return `⏰ What time would you like the reminder?\n\n_Example: "tomorrow at 9am" or "5pm today"_`;
    }
  }

  // Handle pending vendor payment state - awaiting amount
  if (conversation.currentState === 'awaiting_vendor_amount') {
    const amount = extractAmount(messageText);
    if (!amount) {
      return `Please send the amount. Example: "5000"`;
    }
    
    const vendorContext = context as any;
    const vendorName = vendorContext.vendorPaymentVendor || 'Unknown Vendor';
    const eventName = vendorContext.vendorPaymentEvent || undefined;
    
    // Create the pending payment entry
    const requestCode = await storage.generateVendorPaymentCode();
    
    // Try to find the event if specified
    let eventId: string | undefined;
    let resolvedEventName = eventName;
    
    if (eventName) {
      const events = await storage.getAllEvents();
      const matchingEvent = events.find(e => 
        e.title.toLowerCase().includes(eventName.toLowerCase()) ||
        (e.customer && e.customer.toLowerCase().includes(eventName.toLowerCase()))
      );
      if (matchingEvent) {
        eventId = matchingEvent.id;
        resolvedEventName = matchingEvent.title;
      }
    }
    
    await storage.createPendingVendorPayment({
      requestCode,
      employeeId: employee.id,
      employeeName: employee.name,
      employeePhone: employee.phone || normalizedPhone,
      vendorName,
      amount: amount.toString(),
      eventId: eventId || null,
      eventName: resolvedEventName || null,
      description: `Pending payment for ${vendorName}`,
      status: 'pending',
    });

    // Notify Kishor
    await notifyKishorPendingVendorPayment(
      requestCode,
      employee.name,
      vendorName,
      amount,
      resolvedEventName || 'Not specified'
    );

    await storage.updateWhatsappConversation(conversation.id, {
      activeIntent: null,
      intentContext: { lastVendorPaymentCode: requestCode, lastVendorPaymentAmount: amount },
      currentState: 'vendor_payment_recorded',
      conversationHistory: [],
    });

    return `✅ *Pending Vendor Payment Recorded!*\n\n📋 Code: *${requestCode}*\n🏪 Vendor: ${vendorName}\n💰 Amount: ₹${amount.toLocaleString('en-IN')}\n📅 Event: ${resolvedEventName || 'Not specified'}\n\n_Say "change to [amount]" to correct it, or type "ok" to confirm._`;
  }

  // Handle pending vendor payment state - awaiting full details
  if (conversation.currentState === 'awaiting_vendor_details') {
    // Parse format: "vendor name amount [event]"
    // Example: "Flower shop 5000" or "Flower shop 5000 Sharma Wedding"
    const amount = extractAmount(messageText);
    
    let vendorName: string | undefined;
    let eventName: string | undefined;
    
    if (amount) {
      // Find the amount in text and split around it
      const amountMatch = messageText.match(/(\d{1,3}(?:[,\d]*)?(?:\.\d+)?)/);
      if (amountMatch) {
        const amountIndex = messageText.indexOf(amountMatch[0]);
        const beforeAmount = messageText.substring(0, amountIndex).trim();
        const afterAmount = messageText.substring(amountIndex + amountMatch[0].length).trim();
        
        // Vendor name is before the amount
        vendorName = beforeAmount
          .replace(/[\-:,]+$/g, '')
          .replace(/^[\-:,]+/g, '')
          .replace(/\brs\.?\s*$/gi, '')
          .replace(/₹\s*$/g, '')
          .trim();
        
        // Event name is anything after the amount
        if (afterAmount && afterAmount.length > 1) {
          eventName = afterAmount
            .replace(/^[\-:,\s]+/g, '')
            .replace(/\bfor\s+/gi, '')
            .replace(/\bevent[\s:]+/gi, '')
            .trim();
        }
      }
    } else {
      // No amount - treat first part as vendor name
      const vendorMatch = messageText.match(/^([^₹\d]+)/);
      if (vendorMatch) {
        vendorName = vendorMatch[1].replace(/^[\s\-:]+|[\s\-:]+$/g, '').trim();
      }
    }
    
    if (!vendorName || vendorName.length < 2 || !amount) {
      return `❌ I need both vendor name and amount.\n\n_Example: "Flower shop 5000"_`;
    }
    
    // Create the pending payment entry
    const requestCode = await storage.generateVendorPaymentCode();
    
    // Try to find the event if specified
    let eventId: string | undefined;
    let resolvedEventName = eventName;
    
    if (eventName) {
      const events = await storage.getAllEvents();
      const matchingEvent = events.find(e => 
        e.title.toLowerCase().includes(eventName.toLowerCase()) ||
        (e.customer && e.customer.toLowerCase().includes(eventName.toLowerCase()))
      );
      if (matchingEvent) {
        eventId = matchingEvent.id;
        resolvedEventName = matchingEvent.title;
      }
    }
    
    await storage.createPendingVendorPayment({
      requestCode,
      employeeId: employee.id,
      employeeName: employee.name,
      employeePhone: employee.phone || normalizedPhone,
      vendorName,
      amount: amount.toString(),
      eventId: eventId || null,
      eventName: resolvedEventName || null,
      description: messageText,
      status: 'pending',
    });

    // Notify Kishor
    await notifyKishorPendingVendorPayment(
      requestCode,
      employee.name,
      vendorName,
      amount,
      resolvedEventName || 'Not specified'
    );

    await storage.updateWhatsappConversation(conversation.id, {
      activeIntent: null,
      intentContext: { lastVendorPaymentCode: requestCode, lastVendorPaymentAmount: amount },
      currentState: 'vendor_payment_recorded',
      conversationHistory: [],
    });

    return `✅ *Pending Vendor Payment Recorded!*\n\n📋 Code: *${requestCode}*\n🏪 Vendor: ${vendorName}\n💰 Amount: ₹${amount.toLocaleString('en-IN')}\n📅 Event: ${resolvedEventName || 'Not specified'}\n\n_Say "change to [amount]" to correct it, or type "ok" to confirm._`;
  }

  // Handle pending delivery challan states
  if (conversation.activeIntent === 'pending_delivery_challan') {
    // Handle confirmation state
    if (conversation.currentState === 'awaiting_dc_confirmation') {
      if (lowerMessage === 'yes' || lowerMessage === 'y' || lowerMessage === 'ok' || lowerMessage === 'confirm') {
        const dcContext = context as IntentContext;
        const deliverTo = dcContext.deliverTo || '';
        const deliveryAddress = dcContext.deliveryAddress || '';
        const amount = dcContext.amount;
        const itemDescription = dcContext.itemDescription || 'Stage Decor Items';
        const vehicleNumber = dcContext.vehicleNumber;
        
        // Validate all required fields are present
        if (!amount) {
          await storage.updateWhatsappConversation(conversation.id, {
            activeIntent: 'pending_delivery_challan',
            intentContext: dcContext,
            currentState: 'awaiting_dc_amount',
            conversationHistory: history,
          });
          return `💰 I need the amount first. Please send the total amount.`;
        }
        if (!deliverTo) {
          await storage.updateWhatsappConversation(conversation.id, {
            activeIntent: 'pending_delivery_challan',
            intentContext: dcContext,
            currentState: 'awaiting_dc_details',
            conversationHistory: history,
          });
          return `📍 I need the recipient name. Who should this be delivered to?`;
        }
        if (!deliveryAddress) {
          await storage.updateWhatsappConversation(conversation.id, {
            activeIntent: 'pending_delivery_challan',
            intentContext: dcContext,
            currentState: 'awaiting_dc_address',
            conversationHistory: history,
          });
          return `📍 I need the delivery address. What's the address?`;
        }
        
        try {
          const challanNumber = await storage.generateDeliveryChallanNumber();
          const challanDate = new Date().toISOString().split('T')[0];
          const items = [{
            description: itemDescription,
            hsnCode: '44219160',
            quantity: 1,
            unit: 'nos',
            rate: amount,
            amount: amount
          }];
          
          const cgstRate = 9;
          const sgstRate = 9;
          const subTotal = amount;
          const cgstAmount = subTotal * cgstRate / 100;
          const sgstAmount = subTotal * sgstRate / 100;
          const totalBeforeRounding = subTotal + cgstAmount + sgstAmount;
          const totalAmount = Math.round(totalBeforeRounding);
          const rounding = totalAmount - totalBeforeRounding;
          const totalInWords = `Indian Rupee ${numberToWords(totalAmount)} Only`;
          const notes = `Created via Oaksy by ${employee.name}`;
          
          await storage.createDeliveryChallan({
            challanNumber,
            challanDate,
            challanType: 'Job Work',
            vehicleNumber: vehicleNumber || null,
            deliverTo,
            deliveryAddress,
            placeOfSupply: 'Kerala (32)',
            items,
            subTotal: subTotal.toFixed(2),
            cgstRate: cgstRate.toString(),
            cgstAmount: cgstAmount.toFixed(2),
            sgstRate: sgstRate.toString(),
            sgstAmount: sgstAmount.toFixed(2),
            rounding: rounding.toFixed(2),
            totalAmount: totalAmount.toFixed(2),
            totalInWords,
            notes,
            createdBy: employee.userId || null,
          });

          await storage.updateWhatsappConversation(conversation.id, {
            activeIntent: null,
            intentContext: null,
            currentState: 'idle',
            conversationHistory: [],
          });

          // Generate PDF and send via WhatsApp
          try {
            const { generateDeliveryChallanPdf } = await import('./document-service');
            const { ObjectStorageService } = await import('./objectStorage');
            const { sendWhatsAppMediaMessage } = await import('./whatsapp-service');
            
            const pdfBuffer = await generateDeliveryChallanPdf({
              challanNumber,
              challanDate,
              challanType: 'Job Work',
              vehicleNumber: vehicleNumber || null,
              deliverTo,
              deliveryAddress,
              placeOfSupply: 'Kerala (32)',
              items,
              subTotal: subTotal.toFixed(2),
              cgstRate: cgstRate.toString(),
              cgstAmount: cgstAmount.toFixed(2),
              sgstRate: sgstRate.toString(),
              sgstAmount: sgstAmount.toFixed(2),
              rounding: rounding.toFixed(2),
              totalAmount: totalAmount.toFixed(2),
              totalInWords,
              notes,
            });
            
            const objectStorage = new ObjectStorageService();
            const filename = `delivery-challans/DC-${challanNumber}-${Date.now()}.pdf`;
            const pdfUrl = await objectStorage.uploadPublicBuffer(pdfBuffer, filename, 'application/pdf');
            
            console.log('[Oaksy] DC PDF generated and uploaded:', pdfUrl);
            
            // Send PDF via WhatsApp
            const caption = `📋 *Delivery Challan ${challanNumber}*\n\n📍 To: ${deliverTo}\n💵 Total: ₹${totalAmount.toLocaleString('en-IN')}`;
            await sendWhatsAppMediaMessage(fromNumber, pdfUrl, caption);
            
            console.log('[Oaksy] DC PDF sent to:', fromNumber);
            
            return `✅ *Delivery Challan Created!*\n\n📋 Number: *${challanNumber}*\n📍 Deliver To: ${deliverTo}\n📦 Item: ${itemDescription}\n💰 Amount: ₹${amount.toLocaleString('en-IN')}\n💵 Total (incl. GST): ₹${totalAmount.toLocaleString('en-IN')}\n\n📄 _PDF sent!_`;
          } catch (pdfError: any) {
            console.error('[Oaksy] Error generating/sending DC PDF:', pdfError.message);
            console.error('[Oaksy] DC PDF Error Stack:', pdfError.stack);
            // Fall back to text-only confirmation if PDF fails
            return `✅ *Delivery Challan Created!*\n\n📋 Number: *${challanNumber}*\n📍 Deliver To: ${deliverTo}\n📦 Item: ${itemDescription}\n💰 Amount: ₹${amount.toLocaleString('en-IN')}\n💵 Total (incl. GST): ₹${totalAmount.toLocaleString('en-IN')}\n\n_Challan created successfully! (PDF could not be generated: ${pdfError.message})_`;
          }
        } catch (error: any) {
          console.error('[Oaksy] Delivery challan creation error:', error);
          return `❌ Error creating delivery challan. Please try again or use Oak Book in the app.`;
        }
      } else if (lowerMessage === 'no' || lowerMessage === 'n' || lowerMessage === 'cancel') {
        await storage.updateWhatsappConversation(conversation.id, {
          activeIntent: null,
          intentContext: null,
          currentState: 'idle',
          conversationHistory: [],
        });
        return `👍 Cancelled! Let me know if you need anything else.`;
      } else {
        // Check if user is trying to change the amount
        // Capture the multiplier in the regex to avoid scanning whole message
        const amountChangeMatch = messageText.match(/^(?:amount|value|change\s*(?:to)?)\s*[:\-]?\s*([0-9,]+(?:\.[0-9]+)?)\s*(k|thousand|lakh|lakhs|crore)?$/i);
        if (amountChangeMatch) {
          const numStr = amountChangeMatch[1].replace(/,/g, '');
          let newAmount = parseFloat(numStr);
          const multiplierStr = amountChangeMatch[2]?.toLowerCase();
          
          if (!isNaN(newAmount) && newAmount >= 0) {
            // Apply multiplier from captured group only
            if (multiplierStr === 'lakh' || multiplierStr === 'lakhs') {
              newAmount *= 100000;
            } else if (multiplierStr === 'crore') {
              newAmount *= 10000000;
            } else if (multiplierStr === 'k' || multiplierStr === 'thousand') {
              newAmount *= 1000;
            }
            
            const dcContext = context as IntentContext;
            const updatedContext: IntentContext = { ...dcContext, amount: newAmount };
            await storage.updateWhatsappConversation(conversation.id, {
              activeIntent: 'pending_delivery_challan',
              intentContext: updatedContext,
              currentState: 'awaiting_dc_confirmation',
              conversationHistory: history,
            });
            
            const vehicleInfo = dcContext.vehicleNumber ? `\n🚗 Vehicle: ${dcContext.vehicleNumber}` : '';
            return `📋 *Delivery Challan Summary*\n\n📍 Deliver To: ${dcContext.deliverTo}\n📍 Address: ${dcContext.deliveryAddress}${vehicleInfo}\n💰 Amount: ₹${newAmount.toLocaleString('en-IN')}\n\n*Ready to create?* Reply "yes" to confirm or "no" to cancel.`;
          }
        }
        return `Please reply *yes* to create the challan or *no* to cancel.\n\n_To change amount, reply with "amount [value]" e.g., "amount 50000"_`;
      }
    }
    
    // Awaiting delivery address
    if (conversation.currentState === 'awaiting_dc_address') {
      const dcContext = context as IntentContext;
      const deliverTo = dcContext.deliverTo || '';
      const existingAmount = dcContext.amount;
      
      // STRICT amount detection - ONLY accept if message has explicit currency markers
      // This prevents postal codes (682001) and building numbers from being treated as amounts
      const hasExplicitCurrencyMarker = /(?:rs\.?|₹|inr|amount)\s*\d+|^\d+[\d,]*\s*(?:k|thousand|lakh|lakhs|crore)$/i.test(messageText.trim());
      const isOnlyAmount = /^(?:amount\s*)?(?:rs\.?|₹|inr)?\s*\d+[\d,]*(?:\.\d+)?\s*(?:k|thousand|lakh|lakhs|crore)?$/i.test(messageText.trim());
      
      // Only extract amount if message has explicit currency context
      const newAmount = hasExplicitCurrencyMarker ? extractAmount(messageText) : null;
      
      if (isOnlyAmount && newAmount) {
        // User sent an explicit amount when we expected an address - save amount, ask for address again
        const updatedContext: IntentContext = { 
          ...dcContext, 
          amount: newAmount,
        };
        
        await storage.updateWhatsappConversation(conversation.id, {
          activeIntent: 'pending_delivery_challan',
          intentContext: updatedContext,
          currentState: 'awaiting_dc_address',
          conversationHistory: history,
        });
        
        return `💰 Got the amount: ₹${newAmount.toLocaleString('en-IN')}\n\n📍 Now I need the *delivery address*. Please send the full address where this should be delivered.`;
      }
      
      // Extract vehicle number if included (e.g., "Vehicle number KL19C3786" or just "KL19C3786")
      const vehiclePattern = /(?:vehicle\s*(?:no|number)?\.?\s*)?([A-Z]{2}\s*\d{1,2}\s*[A-Z]{1,2}\s*\d{4})/i;
      const vehicleMatch = messageText.match(vehiclePattern);
      const vehicleNumber = vehicleMatch ? vehicleMatch[1].replace(/\s/g, '').toUpperCase() : dcContext.vehicleNumber;
      
      // Clean address by removing vehicle number mention
      let deliveryAddress = messageText.trim();
      if (vehicleMatch) {
        deliveryAddress = deliveryAddress.replace(vehiclePattern, '').replace(/,\s*$/, '').trim();
      }
      
      // Remove any explicit amount patterns from address (if user included amount with address)
      deliveryAddress = deliveryAddress.replace(/,?\s*(?:amount\s*)?(?:rs\.?|₹|inr)\s*\d+[\d,]*(?:\.\d+)?\s*(?:k|thousand|lakh|lakhs|crore)?$/i, '').trim();
      
      if (deliveryAddress.length < 5) {
        return `📍 Please provide a valid delivery address (minimum 5 characters).`;
      }
      
      // ONLY use existing amount - do NOT extract from address messages
      // This prevents postal codes and building numbers from becoming the challan amount
      const finalAmount = existingAmount;
      
      // Immutably merge context - preserve all existing fields and add new ones
      const updatedContext: IntentContext = { 
        ...dcContext, 
        deliveryAddress,
        vehicleNumber,
      };
      
      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: 'pending_delivery_challan',
        intentContext: updatedContext,
        currentState: finalAmount ? 'awaiting_dc_confirmation' : 'awaiting_dc_amount',
        conversationHistory: history,
      });
      
      if (finalAmount) {
        const vehicleInfo = vehicleNumber ? `\n🚗 Vehicle: ${vehicleNumber}` : '';
        return `📋 *Delivery Challan Summary*\n\n📍 Deliver To: ${deliverTo}\n📍 Address: ${deliveryAddress}${vehicleInfo}\n💰 Amount: ₹${finalAmount.toLocaleString('en-IN')}\n\n*Ready to create?* Reply "yes" to confirm.`;
      }
      
      return `📍 Got the address!\n\nNow, what's the total amount? 💰\n\n_Send as: "45000", "Rs 45000", or "45K"_`;
    }
    
    // Awaiting amount
    if (conversation.currentState === 'awaiting_dc_amount') {
      const amount = extractAmount(messageText);
      if (!amount) {
        return `Please send the amount. Example: "5000" or "₹15000"`;
      }
      
      const dcContext = context as IntentContext;
      const deliverTo = dcContext.deliverTo || '';
      const deliveryAddress = dcContext.deliveryAddress || '';
      
      // Immutably merge context with new amount
      const updatedContext: IntentContext = { ...dcContext, amount };
      
      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: 'pending_delivery_challan',
        intentContext: updatedContext,
        currentState: 'awaiting_dc_confirmation',
        conversationHistory: history,
      });
      
      const vehicleNumber = dcContext.vehicleNumber;
      const vehicleInfo = vehicleNumber ? `\n🚗 Vehicle: ${vehicleNumber}` : '';
      return `📋 *Delivery Challan Summary*\n\n📍 Deliver To: ${deliverTo}\n📍 Address: ${deliveryAddress}${vehicleInfo}\n💰 Amount: ₹${amount.toLocaleString('en-IN')}\n\n*Ready to create?* Reply "yes" to confirm or "no" to cancel.`;
    }
    
    // Awaiting full details (generic state)
    if (conversation.currentState === 'awaiting_dc_details') {
      // Parse comprehensive DC message format:
      // "Name,Address,Vehicle number XXX Value/Amount YYY"
      
      // Extract vehicle number first (pattern: "Vehicle number KL19C3786" or just "KL19C3786")
      const vehiclePattern = /(?:vehicle\s*(?:no|number)?\.?\s*)?([A-Z]{2}\s*\d{1,2}\s*[A-Z]{1,2}\s*\d{4})/i;
      const vehicleMatch = messageText.match(vehiclePattern);
      const vehicleNumber = vehicleMatch ? vehicleMatch[1].replace(/\s/g, '').toUpperCase() : undefined;
      
      // Extract amount with explicit value/amount/total keyword or currency symbol
      // Use separate patterns to avoid ambiguity with address numbers
      let amount: number | undefined;
      
      // Pattern 1: Keyword followed by number (Value 450000, Amount 5000)
      const keywordAmountMatch = messageText.match(/(?:value|amount|total|price|cost)\s*[:\-]?\s*([0-9,]+(?:\.[0-9]+)?)\s*(k|thousand|lakh|lakhs|crore)?/i);
      if (keywordAmountMatch) {
        const baseAmount = parseFloat(keywordAmountMatch[1].replace(/,/g, ''));
        const multiplier = keywordAmountMatch[2]?.toLowerCase();
        if (!isNaN(baseAmount) && baseAmount > 0) {
          if (multiplier === 'lakh' || multiplier === 'lakhs') {
            amount = baseAmount * 100000;
          } else if (multiplier === 'crore') {
            amount = baseAmount * 10000000;
          } else if (multiplier === 'k' || multiplier === 'thousand') {
            amount = baseAmount * 1000;
          } else {
            amount = baseAmount;
          }
        }
      }
      
      // Pattern 2: Currency symbol (₹45000, Rs 5000)
      if (!amount) {
        const currencyAmountMatch = messageText.match(/(?:rs\.?|₹|inr)\s*([0-9,]+(?:\.[0-9]+)?)/i);
        if (currencyAmountMatch) {
          const baseAmount = parseFloat(currencyAmountMatch[1].replace(/,/g, ''));
          if (!isNaN(baseAmount) && baseAmount > 0) {
            amount = baseAmount;
          }
        }
      }
      
      // Pattern 3: Number with multiplier suffix (45K, 1 lakh)
      if (!amount) {
        const multiplierAmountMatch = messageText.match(/([0-9,]+(?:\.[0-9]+)?)\s*(k|thousand|lakh|lakhs|crore)(?:\s|,|$)/i);
        if (multiplierAmountMatch) {
          const baseAmount = parseFloat(multiplierAmountMatch[1].replace(/,/g, ''));
          const multiplier = multiplierAmountMatch[2].toLowerCase();
          if (!isNaN(baseAmount) && baseAmount > 0) {
            if (multiplier === 'lakh' || multiplier === 'lakhs') {
              amount = baseAmount * 100000;
            } else if (multiplier === 'crore') {
              amount = baseAmount * 10000000;
            } else if (multiplier === 'k' || multiplier === 'thousand') {
              amount = baseAmount * 1000;
            }
          }
        }
      }
      
      // Remove vehicle and amount patterns from text for address parsing
      // Be careful not to remove address parts that look like amounts (e.g., "103,Kottodimukku")
      let cleanText = messageText
        .replace(vehiclePattern, '')
        .replace(/(?:value|amount|total|price|cost)\s*[:\-]?\s*[0-9,]+(?:\.[0-9]+)?(?:\s*(?:k|thousand|lakh|lakhs|crore))?/i, '')
        .replace(/(?:rs\.?|₹|inr)\s*[0-9,]+(?:\.[0-9]+)?(?:\s*(?:k|thousand|lakh|lakhs|crore))?/i, '')
        .replace(/\b([0-9]+(?:,[0-9]+)*(?:\.[0-9]+)?)\s+(k|thousand|lakh|lakhs|crore)\b/i, '')
        .trim();
      
      // Parse message for recipient name and address
      const parts = cleanText.split(',').map(p => p.trim()).filter(p => p.length > 0);
      
      let deliverTo = '';
      let deliveryAddress = '';
      
      // Helper: extract name from segment that might contain "Name Address" 
      // Keeps multi-word names until first clear address token (digit, fraction, address keyword)
      const extractNameFromSegment = (segment: string): { name: string; address: string } => {
        const cleaned = segment.replace(/^(dc|challan|delivery)\s*(to|for)?\s*/i, '').trim();
        const words = cleaned.split(/\s+/);
        
        if (words.length <= 1) {
          return { name: cleaned, address: '' };
        }
        
        // Find the first word that looks like an address token:
        // - Contains digits (25/103, 682001)
        // - Is an address keyword (Road, Street, Stop, etc.)
        const addressKeywords = /^(road|street|lane|junction|stop|nagar|colony|flat|house|building|floor|main|cross|ward|sector|block|phase)$/i;
        
        let addressStartIdx = -1;
        for (let i = 0; i < words.length; i++) {
          const word = words[i];
          // Check if word contains digits (address numbers like 25/103, postal codes)
          if (/\d/.test(word)) {
            addressStartIdx = i;
            break;
          }
          // Check if word is an address keyword
          if (addressKeywords.test(word)) {
            addressStartIdx = i;
            break;
          }
        }
        
        if (addressStartIdx > 0) {
          // Found address start - split there
          const name = words.slice(0, addressStartIdx).join(' ');
          const address = words.slice(addressStartIdx).join(' ');
          return { name, address };
        } else if (addressStartIdx === 0) {
          // First word is already address-like (rare but possible)
          return { name: '', address: cleaned };
        }
        
        // No clear address token found - everything is name
        return { name: cleaned, address: '' };
      };
      
      if (parts.length >= 2) {
        // Comma-separated format: "Name Address..., More Address..."
        // Check if first segment contains both name and address
        const firstSegment = parts[0];
        const extracted = extractNameFromSegment(firstSegment);
        
        if (extracted.address) {
          // First segment had "Name Address", rest are more address parts
          deliverTo = extracted.name;
          deliveryAddress = [extracted.address, ...parts.slice(1)].join(', ').trim().replace(/[,\s]+$/, '');
        } else {
          // First segment is just the name
          deliverTo = extracted.name;
          deliveryAddress = parts.slice(1).join(', ').trim().replace(/[,\s]+$/, '');
        }
      } else {
        // Non-comma format: try "DC to Name Address" or "Name Address"
        const toMatch = cleanText.match(/^(?:dc\s+|challan\s+|delivery\s+)?(?:to|for)\s+(\S+)\s+(.+)$/i);
        if (toMatch) {
          deliverTo = toMatch[1].trim();
          deliveryAddress = toMatch[2].trim();
        } else {
          // No commas and no "to" keyword - try name/address split
          const extracted = extractNameFromSegment(cleanText);
          deliverTo = extracted.name;
          deliveryAddress = extracted.address;
        }
      }
      
      const dcContext = context as IntentContext;
      
      // Default amount to 0 if not provided - user must explicitly set it
      const finalAmount = amount || 0;
      
      if (deliverTo && deliveryAddress) {
        // Have name and address - go to confirmation
        const updatedContext: IntentContext = { 
          ...dcContext, 
          deliverTo, 
          deliveryAddress, 
          amount: finalAmount,
          vehicleNumber 
        };
        await storage.updateWhatsappConversation(conversation.id, {
          activeIntent: 'pending_delivery_challan',
          intentContext: updatedContext,
          currentState: 'awaiting_dc_confirmation',
          conversationHistory: history,
        });
        const vehicleInfo = vehicleNumber ? `\n🚗 Vehicle: ${vehicleNumber}` : '';
        return `📋 *Delivery Challan Summary*\n\n📍 Deliver To: ${deliverTo}\n📍 Address: ${deliveryAddress}${vehicleInfo}\n💰 Amount: ₹${finalAmount.toLocaleString('en-IN')}\n\n*Ready to create?* Reply "yes" to confirm or "no" to cancel.\n\n_To change amount, reply with "amount [value]" e.g., "amount 50000"_`;
      } else if (deliverTo) {
        // Have recipient only, need address
        const updatedContext: IntentContext = { ...dcContext, deliverTo, amount: finalAmount, vehicleNumber };
        await storage.updateWhatsappConversation(conversation.id, {
          activeIntent: 'pending_delivery_challan',
          intentContext: updatedContext,
          currentState: 'awaiting_dc_address',
          conversationHistory: history,
        });
        return `📋 *Delivery Challan* for *${deliverTo}*\n\nWhat's the delivery address? 📍`;
      }
      
      return `❌ I need at least a recipient name.\n\n_Example: "Aneesh, 25/103 Kottodimukku, Manjummel-683501, Vehicle number KL19C3786 Value 45000"_`;
    }
  }

  // Handle amount without image (text-only expense submission)
  const directAmount = extractAmount(messageText);
  if (directAmount && !context.amount && !mediaUrl && !conversation.activeIntent) {
    context.amount = directAmount;
    
    await storage.updateWhatsappConversation(conversation.id, {
      activeIntent: 'expense',
      intentContext: context,
      conversationHistory: history,
      currentState: 'awaiting_expense_purpose',
    });

    const response = `💰 Got it! ₹${directAmount.toLocaleString('en-IN')}.\n\nWhat was this expense for? 📝`;
    
    history.push({ role: 'assistant', content: response, timestamp: Date.now() });
    await storage.updateWhatsappConversation(conversation.id, { conversationHistory: history });
    
    return response;
  }

  if (conversation.currentState === 'awaiting_expense_purpose' && context.amount) {
    context.purpose = messageText;
    
    await storage.updateWhatsappConversation(conversation.id, {
      intentContext: context,
      currentState: 'awaiting_expense_confirmation',
      conversationHistory: history,
    });

    const response = `✨ Great! Here's what I have:\n\n💰 Amount: ₹${context.amount.toLocaleString('en-IN')}\n📝 Purpose: ${context.purpose}\n📸 Receipt: ${context.mediaUrl ? 'Attached' : 'None'}\n\n*Should I send this for approval?*\n_Reply "yes" or "no"_`;
    
    history.push({ role: 'assistant', content: response, timestamp: Date.now() });
    await storage.updateWhatsappConversation(conversation.id, { conversationHistory: history });
    
    return response;
  }

  if (conversation.currentState === 'awaiting_expense_confirmation') {
    if (lowerMessage === 'yes' || lowerMessage === 'y' || lowerMessage === 'ok' || lowerMessage === 'confirm') {
      const { approvalCode } = await createExpenseRequest(
        employee.id,
        employee.name,
        context.purpose || 'Expense',
        context.amount || 0,
        context.mediaUrl
      );

      await notifySuperadmin('expense', approvalCode, employee.name, context.purpose || '', context.amount, context.mediaUrl);

      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: null,
        intentContext: null,
        currentState: 'idle',
        conversationHistory: [],
      });

      return `✅ *Expense Submitted!*\n━━━━━━━━━━━━━━━━━━\n\n💰 Amount: ₹${context.amount?.toLocaleString('en-IN')}\n📝 Purpose: ${context.purpose}\n🔖 Reference: ${approvalCode}\n\n_I've sent this for approval. Sit back and relax! 🌳_\n\n_You'll be notified once it's processed._`;
    } else if (lowerMessage === 'no' || lowerMessage === 'n' || lowerMessage === 'cancel') {
      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: null,
        intentContext: null,
        currentState: 'idle',
        conversationHistory: [],
      });

      return `👍 No problem! I've cancelled that request.\n\nNeed anything else? Just let me know! 🌳`;
    }
  }

  if (lowerMessage.includes('sick') || lowerMessage.includes('leave') || 
      lowerMessage.includes('vacation') || lowerMessage.includes('off') ||
      lowerMessage.includes('holiday')) {
    
    let leaveType = 'casual';
    if (lowerMessage.includes('sick')) leaveType = 'sick';
    else if (lowerMessage.includes('vacation')) leaveType = 'vacation';
    
    context = { leaveType };
    
    await storage.updateWhatsappConversation(conversation.id, {
      activeIntent: 'leave',
      intentContext: context,
      currentState: 'awaiting_leave_dates',
      conversationHistory: history,
    });

    const response = `📅 *Applying for ${leaveType} leave*\n\nFor how many days do you need leave?\n\n_Tell me the dates, like:_\n"tomorrow" or "15/01 to 17/01"`;
    
    history.push({ role: 'assistant', content: response, timestamp: Date.now() });
    await storage.updateWhatsappConversation(conversation.id, { conversationHistory: history });
    
    return response;
  }

  if (conversation.currentState === 'awaiting_leave_dates') {
    const dates = messageText.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/g);
    
    if (dates && dates.length >= 1) {
      const today = new Date();
      const year = today.getFullYear();
      
      if (dates.length === 1) {
        context.startDate = dates[0];
        context.endDate = dates[0];
      } else {
        context.startDate = dates[0];
        context.endDate = dates[1];
      }
      
      await storage.updateWhatsappConversation(conversation.id, {
        intentContext: context,
        currentState: 'awaiting_leave_reason',
        conversationHistory: history,
      });

      const response = `📆 Got it! From ${context.startDate} to ${context.endDate}\n\nWhat's the reason for your leave? 📝`;
      
      history.push({ role: 'assistant', content: response, timestamp: Date.now() });
      await storage.updateWhatsappConversation(conversation.id, { conversationHistory: history });
      
      return response;
    }
    
    const daysMatch = messageText.match(/(\d+)\s*days?/i);
    if (daysMatch) {
      const days = parseInt(daysMatch[1]);
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + days - 1);
      
      context.startDate = startDate.toISOString().split('T')[0];
      context.endDate = endDate.toISOString().split('T')[0];
      
      await storage.updateWhatsappConversation(conversation.id, {
        intentContext: context,
        currentState: 'awaiting_leave_reason',
        conversationHistory: history,
      });

      const response = `📆 ${days} day${days > 1 ? 's' : ''} starting today.\n\nWhat's the reason for your leave? 📝`;
      
      history.push({ role: 'assistant', content: response, timestamp: Date.now() });
      await storage.updateWhatsappConversation(conversation.id, { conversationHistory: history });
      
      return response;
    }

    if (lowerMessage.includes('tomorrow')) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      context.startDate = tomorrow.toISOString().split('T')[0];
      context.endDate = context.startDate;
      
      await storage.updateWhatsappConversation(conversation.id, {
        intentContext: context,
        currentState: 'awaiting_leave_reason',
        conversationHistory: history,
      });

      return `📆 Leave for tomorrow noted.\n\nWhat's the reason? 📝`;
    }

    return `I couldn't understand the dates. Please tell me like:\n\n• "15/01 to 17/01"\n• "3 days"\n• "tomorrow"`;
  }

  if (conversation.currentState === 'awaiting_leave_reason') {
    context.reason = messageText;
    
    await storage.updateWhatsappConversation(conversation.id, {
      intentContext: context,
      currentState: 'awaiting_leave_confirmation',
      conversationHistory: history,
    });

    const response = `✨ Here's your leave request:\n\n📅 Type: ${context.leaveType || 'Casual'} Leave\n📆 From: ${context.startDate}\n📆 To: ${context.endDate}\n📝 Reason: ${context.reason}\n\n*Should I send this for approval?*\n_Reply "yes" or "no"_`;
    
    history.push({ role: 'assistant', content: response, timestamp: Date.now() });
    await storage.updateWhatsappConversation(conversation.id, { conversationHistory: history });
    
    return response;
  }

  if (conversation.currentState === 'awaiting_leave_confirmation') {
    if (lowerMessage === 'yes' || lowerMessage === 'y' || lowerMessage === 'ok' || lowerMessage === 'confirm') {
      const { approvalCode } = await createLeaveRequest(
        employee.id,
        employee.name,
        context.startDate || new Date().toISOString().split('T')[0],
        context.endDate || new Date().toISOString().split('T')[0],
        context.reason || 'Personal',
        context.leaveType || 'casual'
      );

      await notifySuperadmin('leave', approvalCode, employee.name, 
        `${context.leaveType || 'Leave'} from ${context.startDate} to ${context.endDate} - ${context.reason}`);

      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: null,
        intentContext: null,
        currentState: 'idle',
        conversationHistory: [],
      });

      return `✅ *Leave Request Submitted!*\n━━━━━━━━━━━━━━━━━━\n\n📅 Type: ${context.leaveType || 'Casual'} Leave\n📆 Dates: ${context.startDate} to ${context.endDate}\n📝 Reason: ${context.reason}\n🔖 Reference: ${approvalCode}\n\n_I've sent this for approval. Sit back and relax! 🌳_`;
    } else if (lowerMessage === 'no' || lowerMessage === 'n' || lowerMessage === 'cancel') {
      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: null,
        intentContext: null,
        currentState: 'idle',
        conversationHistory: [],
      });

      return `👍 No problem! I've cancelled that request.\n\nNeed anything else? Just let me know! 🌳`;
    }
  }

  if (conversation.currentState === 'awaiting_expense_details' && context.mediaUrl) {
    const amount = extractAmount(messageText);
    const purposeMatch = messageText.replace(/(?:Rs\.?|₹|INR)?\s*[0-9,]+(?:\.[0-9]+)?\s*(?:\/-)?/gi, '').trim();
    
    if (amount) {
      context.amount = amount;
      context.purpose = purposeMatch || undefined;
      
      if (context.purpose) {
        await storage.updateWhatsappConversation(conversation.id, {
          intentContext: context,
          currentState: 'awaiting_expense_confirmation',
          conversationHistory: history,
        });

        return `✨ Great! Here's what I have:\n\n💰 Amount: ₹${context.amount.toLocaleString('en-IN')}\n📝 Purpose: ${context.purpose}\n📸 Receipt: Attached\n\n*Should I send this for approval?*\n_Reply "yes" or "no"_`;
      } else {
        await storage.updateWhatsappConversation(conversation.id, {
          intentContext: context,
          currentState: 'awaiting_expense_purpose',
          conversationHistory: history,
        });

        return `💰 Got ₹${amount.toLocaleString('en-IN')}!\n\nWhat was this expense for? 📝`;
      }
    }
    
    return `Please tell me the amount and purpose.\n\n_Example: "500 for taxi to venue"_`;
  }

  if (lowerMessage === 'hi' || lowerMessage === 'hello' || lowerMessage === 'hey' || lowerMessage === 'menu') {
    await storage.updateWhatsappConversation(conversation.id, {
      activeIntent: null,
      intentContext: null,
      currentState: 'idle',
      conversationHistory: [],
    });

    // Role-aware greeting - check if authorized for DC creation
    const canCreateDc = isAuthorizedDcCreator(normalizedPhone) || employee.designation?.toLowerCase().includes('accountant');
    const isSuperadmin = isSuperadminPhone(normalizedPhone);
    
    if (isSuperadmin) {
      return `👋 Hi Kishor! I'm *Oaksy AI*, your business assistant 🌳\n\n*Quick commands:*\n\n📅 "events this week" - See upcoming events\n🏦 "bank balance" - Check all balances\n📊 "monthly summary" - Business overview\n💳 "pending payments" - Client dues\n👥 "who's on leave" - Team status\n🏪 "vendor history [name]" - Payment records\n📈 "profit on [event]" - Event profitability\n\n_What would you like to know?_`;
    }
    
    if (canCreateDc) {
      return `👋 Hi ${employee.name}! I'm *Oaksy AI*, your assistant at Oakstreet Events 🌳\n\n*I can help you with:*\n\n📅 *Events* - "events this week" or "countdown to [event]"\n🏪 *Vendor Payments* - "vendor payment [name] [amount]"\n📋 *Delivery Challan* - "DC to [venue] [amount]"\n💰 *Submit Expenses* - Send amount or receipt\n💳 *QR Payment* - Send QR code for payment\n📅 *Leave Requests* - Say "leave"\n💳 *Pending Payments* - "how much does [client] owe"\n\n_Tell me what you need!_`;
    }

    return `👋 Hi ${employee.name}! I'm *Oaksy AI*, your companion at Oakstreet Events 🌳\n\n*Here's what I can help with:*\n\n💰 *Submit Expenses* - Just send the amount or a receipt photo\n💳 *QR Payment* - Send QR code with "pay" for direct payment\n📅 *Apply for Leave* - Say "sick leave" or "vacation"\n📋 *Check Status* - Type "status" to see your requests\n📅 *Events* - Ask "events this week"\n👥 *Team* - Ask "who's on leave today"\n\n_Just tell me what you need!_`;
  }

  // Use AI to understand the message when no pattern matches
  // Determine employee role based on name or job title
  let employeeRole = 'employee';
  if (employee.name.toLowerCase().includes('fida') || employee.name.toLowerCase().includes('femina')) {
    employeeRole = 'wedding_planner';
  } else if (employee.designation?.toLowerCase().includes('accountant')) {
    employeeRole = 'accountant';
  } else if (employee.designation?.toLowerCase().includes('manager')) {
    employeeRole = 'manager';
  }
  
  let aiAnalysis = await analyzeWithAI(
    messageText,
    context,
    history,
    !!mediaUrl,
    employeeRole,
    employee.name
  );

  // FORCE REMINDER INTENT: If AI returned "general" but message clearly contains reminder keywords
  // This is a safety net because the AI sometimes fails to detect reminder intent
  const lowerMsgForReminder = messageText.toLowerCase();
  const hasReminderKeywords = 
    lowerMsgForReminder.includes('remind me') || 
    lowerMsgForReminder.includes('reminder') || 
    lowerMsgForReminder.includes('set a reminder') ||
    lowerMsgForReminder.includes('create a reminder') ||
    lowerMsgForReminder.includes('set reminder');
  
  if (hasReminderKeywords && aiAnalysis.intent !== 'reminder') {
    console.log('[Oaksy] Forcing reminder intent - AI returned:', aiAnalysis.intent, 'but message contains reminder keywords');
    aiAnalysis = {
      ...aiAnalysis,
      intent: 'reminder',
      extractedData: {
        ...aiAnalysis.extractedData,
        // Try to extract the message - everything after "to" or task description
        reminderMessage: aiAnalysis.extractedData.reminderMessage || 
          messageText.replace(/^.*(remind me|set a reminder|create a reminder|reminder)(\s+to)?/i, '').replace(/\s*(at|after|in|on|today|tomorrow).*$/i, '').trim() || null,
      }
    };
  }

  // FORCE INVENTORY INTENT: For Superadmin/Praveen when photo + quantity pattern detected
  // This is a safety net because AI sometimes fails to detect inventory intent
  const lowerMsgForInventory = messageText.toLowerCase();
  const isAuthorizedForInventory = isAuthorizedInventoryCreator(normalizedPhone);
  const hasInventoryKeywords = 
    lowerMsgForInventory.includes('inventory') || 
    lowerMsgForInventory.includes('warehouse') || 
    lowerMsgForInventory.includes('stock') ||
    lowerMsgForInventory.includes('add item') ||
    lowerMsgForInventory.includes('new item');
  
  // Pattern: number + item name (e.g., "50 chairs", "100 covers", "25 nos lights")
  const quantityItemPattern = /(\d+)\s*(nos?|pieces?|pcs?|units?)?\s*([a-z\s]+)/i;
  const itemQuantityPattern = /([a-z\s]+)\s*[-–:]?\s*(\d+)\s*(nos?|pieces?|pcs?|units?)?/i;
  const hasQuantityAndItem = quantityItemPattern.test(messageText) || itemQuantityPattern.test(messageText);
  
  // ALWAYS extract inventory data for authorized users - even when AI already detected inventory_item
  // This ensures structured formats like "Item: X, Quantity: Y" are properly parsed
  if (isAuthorizedForInventory) {
    // Force inventory intent if: has keywords OR (has photo AND has quantity+item pattern)
    const shouldForceIntent = aiAnalysis.intent !== 'inventory_item' && (hasInventoryKeywords || (mediaUrl && hasQuantityAndItem));
    const shouldEnhanceData = aiAnalysis.intent === 'inventory_item' || shouldForceIntent;
    
    if (shouldEnhanceData) {
      console.log('[Oaksy] Inventory data extraction - forcing:', shouldForceIntent, '| enhancing:', aiAnalysis.intent === 'inventory_item', '| hasKeywords:', hasInventoryKeywords);
      
      // Try to extract item name and quantity from the message
      let extractedName: string | null = null;
      let extractedQuantity: number | null = null;
      let extractedColour: string | null = null;
      
      // Try structured format: "Item: X, Quantity: Y, Colour: Z"
      const structuredItemMatch = messageText.match(/item\s*[:]\s*([^,\n]+)/i);
      const structuredQtyMatch = messageText.match(/quantity\s*[:]\s*(\d+)/i);
      const structuredColourMatch = messageText.match(/colou?r\s*[:]\s*([^,\n]+)/i);
      
      if (structuredItemMatch) {
        extractedName = structuredItemMatch[1].trim();
      }
      if (structuredQtyMatch) {
        extractedQuantity = parseInt(structuredQtyMatch[1]);
        console.log('[Oaksy] Extracted quantity from structured format:', extractedQuantity);
      }
      if (structuredColourMatch) {
        extractedColour = structuredColourMatch[1].trim();
      }
      
      // If structured format didn't work, try "50 chairs" pattern
      if (!extractedName || !extractedQuantity) {
        const qtyMatch = messageText.match(/(\d+)\s*(nos?|pieces?|pcs?|units?)?\s+([a-z\s]+)/i);
        if (qtyMatch) {
          if (!extractedQuantity) extractedQuantity = parseInt(qtyMatch[1]);
          if (!extractedName) extractedName = qtyMatch[3].trim();
        }
      }
      
      // Try "chairs - 50" pattern
      if (!extractedName || !extractedQuantity) {
        const itemMatch = messageText.match(/([a-z\s]+?)\s*[-–:]\s*(\d+)\s*(nos?|pieces?|pcs?|units?)?/i);
        if (itemMatch) {
          if (!extractedName) extractedName = itemMatch[1].trim();
          if (!extractedQuantity) extractedQuantity = parseInt(itemMatch[2]);
        }
      }
      
      // Clean up extracted name - remove common prefixes
      if (extractedName) {
        extractedName = extractedName.replace(/^(create|add|new|inventory)\s*/i, '').trim();
      }
      
      // Merge with AI's extracted data - prefer deterministic parsing over AI
      aiAnalysis = {
        ...aiAnalysis,
        intent: 'inventory_item',
        extractedData: {
          ...aiAnalysis.extractedData,
          inventoryItemName: extractedName || aiAnalysis.extractedData.inventoryItemName || null,
          inventoryItemQuantity: extractedQuantity || aiAnalysis.extractedData.inventoryItemQuantity || null,
          inventoryItemCategory: aiAnalysis.extractedData.inventoryItemCategory || 'General',
          inventoryItemLocation: aiAnalysis.extractedData.inventoryItemLocation || 'Warehouse',
          inventoryItemColour: extractedColour || aiAnalysis.extractedData.inventoryItemColour || null,
        }
      };
      
      console.log('[Oaksy] Final inventory extractedData:', aiAnalysis.extractedData);
    }
  }

  // Handle AI-detected vendor payment intent
  if (aiAnalysis.intent === 'vendor_payment') {
    const vendorName = aiAnalysis.extractedData.vendorName;
    const amount = aiAnalysis.extractedData.amount || extractAmount(messageText);
    const eventName = aiAnalysis.extractedData.eventName;
    
    if (vendorName && amount) {
      // Got vendor and amount - create the pending payment entry
      const requestCode = await storage.generateVendorPaymentCode();
      
      // Try to find the event if specified
      let eventId: string | undefined;
      let resolvedEventName = eventName;
      
      if (eventName) {
        const events = await storage.getAllEvents();
        const matchingEvent = events.find(e => 
          e.title.toLowerCase().includes(eventName.toLowerCase()) ||
          (e.customer && e.customer.toLowerCase().includes(eventName.toLowerCase()))
        );
        if (matchingEvent) {
          eventId = matchingEvent.id;
          resolvedEventName = matchingEvent.title;
        }
      }
      
      await storage.createPendingVendorPayment({
        requestCode,
        employeeId: employee.id,
        employeeName: employee.name,
        employeePhone: employee.phone || normalizedPhone,
        vendorName,
        amount: amount.toString(),
        eventId: eventId || null,
        eventName: resolvedEventName || null,
        description: messageText,
        status: 'pending',
      });

      await notifyKishorPendingVendorPayment(
        requestCode,
        employee.name,
        vendorName,
        amount,
        resolvedEventName || 'Not specified'
      );

      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: null,
        intentContext: { lastVendorPaymentCode: requestCode, lastVendorPaymentAmount: amount },
        currentState: 'vendor_payment_recorded',
        conversationHistory: [],
      });

      return `✅ *Vendor Payment Recorded!*\n\n📋 Code: *${requestCode}*\n🏪 Vendor: ${vendorName}\n💰 Amount: ₹${amount.toLocaleString('en-IN')}\n📅 Event: ${resolvedEventName || 'Not specified'}\n\n_Say "change to [amount]" to correct it, or type "ok" to confirm._`;
    } else if (vendorName) {
      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: 'pending_vendor_payment',
        intentContext: { 
          vendorPaymentVendor: vendorName,
          vendorPaymentEvent: eventName,
        },
        conversationHistory: history,
        currentState: 'awaiting_vendor_amount',
      });

      return `📋 Vendor payment for *${vendorName}*\n\nWhat's the amount? 💰`;
    } else {
      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: 'pending_vendor_payment',
        intentContext: {},
        conversationHistory: history,
        currentState: 'awaiting_vendor_details',
      });

      return aiAnalysis.message || `📋 *Vendor Payment*\n\nWhich vendor and how much?\n\n_Example: "Flower shop 5000"_`;
    }
  }

  // Handle AI-detected delivery challan intent (authorized DC creators only)
  if (aiAnalysis.intent === 'delivery_challan') {
    // Check if authorized by phone number or by role
    const isAuthorizedByPhone = isAuthorizedDcCreator(normalizedPhone);
    const isAccountant = employee.designation?.toLowerCase().includes('accountant');
    const isSuperadmin = employee.designation?.toLowerCase().includes('superadmin') || employee.name.toLowerCase().includes('kishor');
    const isTestEmployee = employee.name.toLowerCase().includes('test');
    
    if (!isAuthorizedByPhone && !isAccountant && !isSuperadmin && !isTestEmployee) {
      return `❌ Sorry ${employee.name}, delivery challans can only be created by authorized staff.\n\n_Need to create one? Please contact Fida, Femina, or Sabitha._`;
    }
    
    // Parse comprehensive DC message format ourselves (more reliable than AI for this format):
    // "Name,Address,Vehicle number XXX Value/Amount YYY"
    
    // Extract vehicle number first (pattern: "Vehicle number KL19C3786" or just "KL19C3786")
    const vehiclePattern = /(?:vehicle\s*(?:no|number)?\.?\s*)?([A-Z]{2}\s*\d{1,2}\s*[A-Z]{1,2}\s*\d{4})/i;
    const vehicleMatch = messageText.match(vehiclePattern);
    const parsedVehicleNumber = vehicleMatch ? vehicleMatch[1].replace(/\s/g, '').toUpperCase() : undefined;
    
    // Extract amount with explicit value/amount/total keyword or currency symbol
    // Use separate patterns to avoid ambiguity with address numbers
    let parsedAmount: number | undefined;
    
    // Pattern 1: Keyword followed by number (Value 450000, Amount 5000)
    const keywordAmountMatch = messageText.match(/(?:value|amount|total|price|cost)\s*[:\-]?\s*([0-9,]+(?:\.[0-9]+)?)\s*(k|thousand|lakh|lakhs|crore)?/i);
    if (keywordAmountMatch) {
      const baseAmount = parseFloat(keywordAmountMatch[1].replace(/,/g, ''));
      const multiplier = keywordAmountMatch[2]?.toLowerCase();
      if (!isNaN(baseAmount) && baseAmount > 0) {
        if (multiplier === 'lakh' || multiplier === 'lakhs') {
          parsedAmount = baseAmount * 100000;
        } else if (multiplier === 'crore') {
          parsedAmount = baseAmount * 10000000;
        } else if (multiplier === 'k' || multiplier === 'thousand') {
          parsedAmount = baseAmount * 1000;
        } else {
          parsedAmount = baseAmount;
        }
      }
    }
    
    // Pattern 2: Currency symbol (₹45000, Rs 5000)
    if (!parsedAmount) {
      const currencyAmountMatch = messageText.match(/(?:rs\.?|₹|inr)\s*([0-9,]+(?:\.[0-9]+)?)/i);
      if (currencyAmountMatch) {
        const baseAmount = parseFloat(currencyAmountMatch[1].replace(/,/g, ''));
        if (!isNaN(baseAmount) && baseAmount > 0) {
          parsedAmount = baseAmount;
        }
      }
    }
    
    // Pattern 3: Number with multiplier suffix (45K, 1 lakh)
    if (!parsedAmount) {
      const multiplierAmountMatch = messageText.match(/([0-9,]+(?:\.[0-9]+)?)\s*(k|thousand|lakh|lakhs|crore)(?:\s|,|$)/i);
      if (multiplierAmountMatch) {
        const baseAmount = parseFloat(multiplierAmountMatch[1].replace(/,/g, ''));
        const multiplier = multiplierAmountMatch[2].toLowerCase();
        if (!isNaN(baseAmount) && baseAmount > 0) {
          if (multiplier === 'lakh' || multiplier === 'lakhs') {
            parsedAmount = baseAmount * 100000;
          } else if (multiplier === 'crore') {
            parsedAmount = baseAmount * 10000000;
          } else if (multiplier === 'k' || multiplier === 'thousand') {
            parsedAmount = baseAmount * 1000;
          }
        }
      }
    }
    
    // Remove vehicle and amount patterns from text for address parsing
    // Be careful not to remove address parts that look like amounts (e.g., "103,Kottodimukku")
    let cleanText = messageText
      .replace(vehiclePattern, '')
      .replace(/(?:value|amount|total|price|cost)\s*[:\-]?\s*[0-9,]+(?:\.[0-9]+)?(?:\s*(?:k|thousand|lakh|lakhs|crore))?/i, '')
      .replace(/(?:rs\.?|₹|inr)\s*[0-9,]+(?:\.[0-9]+)?(?:\s*(?:k|thousand|lakh|lakhs|crore))?/i, '')
      .replace(/\b([0-9]+(?:,[0-9]+)*(?:\.[0-9]+)?)\s+(k|thousand|lakh|lakhs|crore)\b/i, '')
      .replace(/^(dc|create\s*dc|challan|delivery\s*challan)\s*/i, '')
      .trim();
    
    // Parse message for recipient name and address
    const parts = cleanText.split(',').map(p => p.trim()).filter(p => p.length > 0);
    
    let parsedDeliverTo = '';
    let parsedDeliveryAddress = '';
    
    // Helper: extract name from segment that might contain "Name Address"
    // Keeps multi-word names until first clear address token (digit, fraction, address keyword)
    const extractNameFromSegmentAI = (segment: string): { name: string; address: string } => {
      const cleaned = segment.replace(/^(dc|challan|delivery)\s*(to|for)?\s*/i, '').trim();
      const words = cleaned.split(/\s+/);
      
      if (words.length <= 1) {
        return { name: cleaned, address: '' };
      }
      
      // Find the first word that looks like an address token:
      // - Contains digits (25/103, 682001)
      // - Is an address keyword (Road, Street, Stop, etc.)
      const addressKeywords = /^(road|street|lane|junction|stop|nagar|colony|flat|house|building|floor|main|cross|ward|sector|block|phase)$/i;
      
      let addressStartIdx = -1;
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        // Check if word contains digits (address numbers like 25/103, postal codes)
        if (/\d/.test(word)) {
          addressStartIdx = i;
          break;
        }
        // Check if word is an address keyword
        if (addressKeywords.test(word)) {
          addressStartIdx = i;
          break;
        }
      }
      
      if (addressStartIdx > 0) {
        // Found address start - split there
        const name = words.slice(0, addressStartIdx).join(' ');
        const address = words.slice(addressStartIdx).join(' ');
        return { name, address };
      } else if (addressStartIdx === 0) {
        // First word is already address-like (rare but possible)
        return { name: '', address: cleaned };
      }
      
      // No clear address token found - everything is name
      return { name: cleaned, address: '' };
    };
    
    if (parts.length >= 2) {
      // Comma-separated format: "Name Address..., More Address..."
      const firstSegment = parts[0];
      const extracted = extractNameFromSegmentAI(firstSegment);
      
      if (extracted.address) {
        // First segment had "Name Address", rest are more address parts
        parsedDeliverTo = extracted.name;
        parsedDeliveryAddress = [extracted.address, ...parts.slice(1)].join(', ').trim().replace(/[,\s]+$/, '');
      } else {
        // First segment is just the name
        parsedDeliverTo = extracted.name;
        parsedDeliveryAddress = parts.slice(1).join(', ').trim().replace(/[,\s]+$/, '');
      }
    } else {
      // Non-comma format: try "DC to Name Address" or "Name Address"
      const toMatch = cleanText.match(/^(?:dc\s+|challan\s+|delivery\s+)?(?:to|for)\s+(\S+)\s+(.+)$/i);
      if (toMatch) {
        parsedDeliverTo = toMatch[1].trim();
        parsedDeliveryAddress = toMatch[2].trim();
      } else {
        // No commas and no "to" keyword - try name/address split
        const extracted = extractNameFromSegmentAI(cleanText);
        parsedDeliverTo = extracted.name;
        parsedDeliveryAddress = extracted.address;
      }
    }
    
    // Use our parsed values, falling back to AI extraction, then context
    const deliverTo = parsedDeliverTo || aiAnalysis.extractedData.deliverTo || context.deliverTo;
    const deliveryAddress = parsedDeliveryAddress || aiAnalysis.extractedData.deliveryAddress || context.deliveryAddress;
    const vehicleNumber = parsedVehicleNumber || aiAnalysis.extractedData.vehicleNumber || context.vehicleNumber;
    
    // For amount: use our parsed amount (most reliable), fall back to context (from previous interactions)
    // Default to 0 if not provided - user can change later
    const amount = parsedAmount ?? context.amount ?? 0;
    
    const itemDescription = aiAnalysis.extractedData.itemDescription || context.itemDescription || 'Stage Decor Items';
    
    if (deliverTo && deliveryAddress) {
      // Have name and address - go to confirmation (amount defaults to 0)
      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: 'pending_delivery_challan',
        intentContext: { deliverTo, deliveryAddress, amount, itemDescription, vehicleNumber },
        conversationHistory: history,
        currentState: 'awaiting_dc_confirmation',
      });
      const vehicleInfo = vehicleNumber ? `\n🚗 Vehicle: ${vehicleNumber}` : '';
      return `📋 *Delivery Challan Summary*\n\n📍 Deliver To: ${deliverTo}\n📍 Address: ${deliveryAddress}${vehicleInfo}\n💰 Amount: ₹${amount.toLocaleString('en-IN')}\n\n*Ready to create?* Reply "yes" to confirm or "no" to cancel.\n\n_To change amount, reply with "amount [value]" e.g., "amount 50000"_`;
    } else if (deliverTo) {
      // Have recipient, need address
      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: 'pending_delivery_challan',
        intentContext: { deliverTo, amount, vehicleNumber },
        conversationHistory: history,
        currentState: 'awaiting_dc_address',
      });
      return `📋 *Delivery Challan* for *${deliverTo}*\n\nWhat's the delivery address? 📍`;
    } else {
      // Need all details
      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: 'pending_delivery_challan',
        intentContext: {},
        conversationHistory: history,
        currentState: 'awaiting_dc_details',
      });
      return `📋 *Create Delivery Challan*\n\nPlease provide all details in one message:\n\n_Example: "Aneesh, 25/103 Kottodimukku, Manjummel-683501, Vehicle number KL19C3786 Value 45000"_`;
    }
  }

  // Handle AI-detected event query intent
  if (aiAnalysis.intent === 'event_query') {
    const queryType = aiAnalysis.extractedData.queryType || 'upcoming';
    const timeframe = aiAnalysis.extractedData.timeframe || 'this_week';
    const eventName = aiAnalysis.extractedData.eventName;
    
    if (queryType === 'countdown' && eventName) {
      const result = await getEventCountdown(eventName);
      return result;
    } else {
      // Get planner name for wedding planners
      const plannerName = (employeeRole === 'wedding_planner') ? employee.name.split(' ')[0] : undefined;
      const result = await getUpcomingEvents(timeframe, plannerName);
      return result;
    }
  }

  // Handle AI-detected bank query intent (superadmin only)
  if (aiAnalysis.intent === 'bank_query') {
    if (!isSuperadminPhone(normalizedPhone)) {
      return `🔒 Bank balances are only available to management.\n\n_Please contact Kishor for financial information._`;
    }
    const bankName = aiAnalysis.extractedData.bankName;
    const result = await getBankBalances(bankName);
    return result;
  }

  // Handle AI-detected team query intent
  if (aiAnalysis.intent === 'team_query') {
    const queryType = aiAnalysis.extractedData.queryType || 'availability';
    const result = await getTeamStatus(queryType);
    return result;
  }

  // Handle AI-detected vendor query intent
  if (aiAnalysis.intent === 'vendor_query') {
    const vendorName = aiAnalysis.extractedData.vendorName;
    if (!vendorName) {
      return `🏪 Which vendor would you like to know about?\n\n_Example: "vendor history Plan B Cinema"_`;
    }
    const result = await getVendorHistory(vendorName);
    return result;
  }

  // Handle AI-detected financial query intent
  if (aiAnalysis.intent === 'financial_query') {
    const queryType = aiAnalysis.extractedData.queryType || 'pending';
    const customerName = aiAnalysis.extractedData.customerName;
    
    if (queryType === 'daily_summary') {
      if (!isSuperadminPhone(normalizedPhone) && employeeRole !== 'accountant') {
        return `🔒 Daily summaries are only available to management and accounts.\n\n_Please contact Kishor or Sabitha._`;
      }
      const result = await getDailySummary();
      return result;
    } else if (queryType === 'pending' || queryType === 'client_dues') {
      if (!isSuperadminPhone(normalizedPhone) && employeeRole !== 'accountant' && employeeRole !== 'wedding_planner') {
        return `🔒 Payment information is only available to authorized staff.`;
      }
      const result = await getPendingPayments(customerName);
      return result;
    }
    
    return aiAnalysis.message || `💰 I can help with financial queries! Try:\n\n• "daily summary"\n• "pending payments"\n• "how much does [client] owe?"`;
  }

  // Handle AI-detected report query intent (superadmin only)
  if (aiAnalysis.intent === 'report_query') {
    if (!isSuperadminPhone(normalizedPhone)) {
      return `🔒 Reports are only available to management.\n\n_Please contact Kishor for business reports._`;
    }
    
    const queryType = aiAnalysis.extractedData.queryType || 'monthly';
    const eventName = aiAnalysis.extractedData.eventName;
    
    if (queryType === 'event_profit' && eventName) {
      const result = await getEventProfitability(eventName);
      return result;
    } else if (queryType === 'monthly') {
      const result = await getMonthlySummary();
      return result;
    }
    
    return aiAnalysis.message || `📊 Available reports:\n\n• "monthly summary"\n• "profit on [event name]"`;
  }

  // Handle AI-detected RSVP query intent
  if (aiAnalysis.intent === 'rsvp_query') {
    if (!isSuperadminPhone(normalizedPhone) && employeeRole !== 'wedding_planner') {
      return `🔒 RSVP tracking is only available to wedding planners and management.\n\n_Contact Fida or Femina for guest list details._`;
    }
    
    const queryType = aiAnalysis.extractedData.queryType || 'status';
    const eventName = aiAnalysis.extractedData.eventName;
    const result = await getRsvpStatus(eventName, queryType);
    return result;
  }

  // Handle AI-detected reminder intent
  if (aiAnalysis.intent === 'reminder') {
    const reminderDateTime = aiAnalysis.extractedData.reminderDateTime;
    const reminderMessage = aiAnalysis.extractedData.reminderMessage;
    
    console.log('[Oaksy] Reminder intent detected. DateTime:', reminderDateTime, 'Message:', reminderMessage);
    
    if (reminderDateTime && reminderMessage) {
      try {
        // Use our helper to properly parse the time as IST
        let dueAt = parseReminderDateTime(reminderDateTime);
        
        // Check if date is valid
        if (!dueAt) {
          console.log('[Oaksy] Invalid reminder date parsed:', reminderDateTime);
          return `⏰ I couldn't understand that time. Try saying:\n\n• "remind me tomorrow at 9am to pay vendor"\n• "remind me in 2 hours to call caterer"`;
        }
        
        // Check if time is in the past
        const timeIsInPast = !isReminderTimeInFuture(dueAt);
        const explicitToday = aiAnalysis.extractedData.reminderExplicitToday === true;
        
        if (timeIsInPast) {
          if (explicitToday) {
            // User explicitly said "today" but time has passed - ask for clarification
            console.log('[Oaksy] Reminder time in past with explicit today. dueAt:', dueAt.toISOString());
            const timeStr = dueAt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
            
            // Save context for follow-up
            const mergedContext = { ...context, reminderMessage, reminderDateTime, pendingTomorrowAdjust: true };
            await storage.updateWhatsappConversation(conversation.id, {
              activeIntent: 'reminder',
              intentContext: mergedContext,
              conversationHistory: history,
              currentState: 'awaiting_past_time_confirmation',
            });
            
            return `⏰ That time (${timeStr}) has already passed today.\n\nWould you like me to set it for *tomorrow at ${timeStr}* instead?\n\n_Reply "yes" or give me a different time._`;
          } else {
            // No explicit "today" - auto-adjust to tomorrow
            dueAt = autoAdjustPastTimeToTomorrow(dueAt);
          }
        }
        
        // Create the reminder
        await storage.createReminder({
          employeeId: employee.id,
          employeeName: employee.name,
          employeePhone: employee.phone || normalizedPhone,
          reminderMessage: reminderMessage,
          dueAt: dueAt,
          timezone: 'Asia/Kolkata',
          status: 'pending',
        });
        
        // Format the time for display in IST
        const timeStr = dueAt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
        const dateStr = dueAt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
        
        return `✅ *Reminder Set!*\n\n🔔 *What:* ${reminderMessage}\n📅 *When:* ${dateStr} at ${timeStr}\n\n_I'll send you a WhatsApp message at that time!_ ⏰`;
      } catch (err) {
        console.error('[Oaksy] Error creating reminder:', err);
        return `❌ Sorry, I couldn't set that reminder. Please try again with a clear time.\n\n_Example: "remind me tomorrow at 9am to pay vendor"_`;
      }
    } else if (!reminderDateTime) {
      // Need the time - preserve existing context and add reminderMessage
      const mergedContext = { ...context, reminderMessage };
      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: 'reminder',
        intentContext: mergedContext,
        conversationHistory: history,
        currentState: 'awaiting_reminder_time',
      });
      
      return `⏰ When should I remind you?\n\n_Example: "tomorrow at 9am" or "5pm today"_`;
    } else if (!reminderMessage) {
      // Need the message - preserve existing context and add reminderDateTime
      const mergedContext = { ...context, reminderDateTime };
      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: 'reminder',
        intentContext: mergedContext,
        conversationHistory: history,
        currentState: 'awaiting_reminder_message',
      });
      
      return `📝 What should I remind you about?\n\n_Example: "pay flower vendor" or "call caterer"_`;
    }
    
    return aiAnalysis.message || `🔔 *Set a Reminder*\n\nJust tell me when and what!\n\n_Example: "remind me tomorrow at 9am to pay vendor"_`;
  }

  // Return AI's response for other intents
  if (aiAnalysis.message && aiAnalysis.intent !== 'general') {
    history.push({ role: 'assistant', content: aiAnalysis.message, timestamp: Date.now() });
    await storage.updateWhatsappConversation(conversation.id, { conversationHistory: history });
    return aiAnalysis.message;
  }

  // Default greeting with role-aware tips
  const isWeddingPlanner = employee.name.toLowerCase().includes('fida') || employee.name.toLowerCase().includes('femina');
  
  if (isWeddingPlanner) {
    return `👋 Hi ${employee.name}! I'm Oaksy 🌳\n\n*Quick tips:*\n• "vendor payment [name] [amount]" for payments\n• Send receipt photo for expenses\n• Say "leave" to apply for time off\n\n_How can I help?_`;
  }

  return `👋 Hi ${employee.name}! I'm Oaksy 🌳\n\n*Quick tips:*\n• Send an amount like "500" for expenses\n• Send QR code for payment requests\n• Say "leave" to apply for time off\n\n_How can I help you today?_`;
}

async function handleSuperadminApproval(message: string, fromPhone: string): Promise<string> {
  const approveMatch = message.match(/^(a|approve)\s+([a-z]{2,3}\d+)/i);
  const rejectMatch = message.match(/^(r|reject)\s+([a-z]{2,3}\d+)\s*(.*)?/i);

  if (approveMatch) {
    const code = approveMatch[2].toUpperCase();
    const approval = await storage.getWhatsappPendingApprovalByCode(code);
    
    if (!approval) {
      return `❌ Request ${code} not found.`;
    }
    
    if (approval.status !== 'pending') {
      return `⚠️ Request ${code} was already ${approval.status}.`;
    }

    await storage.updateWhatsappPendingApproval(approval.id, {
      status: 'approved',
      respondedAt: new Date(),
    });

    if (approval.type === 'expense') {
      await storage.updateExpenseReimbursement(approval.requestId, { status: 'approved' });
    } else if (approval.type === 'vendor_payment') {
      // Create daybook entry for approved vendor payment
      const amount = approval.amount ? parseFloat(approval.amount) : 0;
      await storage.createDaybookEntry({
        date: new Date().toISOString().split('T')[0],
        type: 'expense',
        amount: String(amount),
        description: `Vendor Payment: ${approval.description} (by ${approval.employeeName})`,
        category: 'Vendor Payment',
        bankId: null,
        eventId: null,
      });
    } else {
      await storage.updateLeaveRequest(approval.requestId, { status: 'approved' });
    }

    const employee = await storage.getEmployee(approval.employeeId);
    if (employee?.phone) {
      const amount = approval.amount ? `₹${parseFloat(approval.amount).toLocaleString('en-IN')}` : '';
      let notifyMessage: string;
      if (approval.type === 'expense') {
        notifyMessage = `🎉 *Great news!*\n\nYour expense request for ${amount} has been *approved*! ✅\n\nYou'll receive your reimbursement shortly. 💰`;
      } else if (approval.type === 'vendor_payment') {
        notifyMessage = `🎉 *Great news!*\n\nYour vendor payment request for ${amount} has been *approved*! ✅\n\nThe payment has been recorded in the daybook. 💸`;
      } else {
        notifyMessage = `🎉 *Great news!*\n\nYour leave request has been *approved*! ✅\n\nEnjoy your time off! 🌴`;
      }
      
      await sendWhatsAppMessage(employee.phone, notifyMessage);
    }

    return `✅ *Approved* - ${code}\n\n_Employee has been notified._`;
  }

  if (rejectMatch) {
    const code = rejectMatch[2].toUpperCase();
    const reason = rejectMatch[3]?.trim() || 'No reason provided';
    
    const approval = await storage.getWhatsappPendingApprovalByCode(code);
    
    if (!approval) {
      return `❌ Request ${code} not found.`;
    }
    
    if (approval.status !== 'pending') {
      return `⚠️ Request ${code} was already ${approval.status}.`;
    }

    await storage.updateWhatsappPendingApproval(approval.id, {
      status: 'rejected',
      responseMessage: reason,
      respondedAt: new Date(),
    });

    if (approval.type === 'expense') {
      await storage.updateExpenseReimbursement(approval.requestId, { status: 'rejected' });
    } else if (approval.type === 'vendor_payment') {
      // Vendor payment rejection - no additional action needed, just update the pending approval
    } else {
      await storage.updateLeaveRequest(approval.requestId, { status: 'rejected' });
    }

    const employee = await storage.getEmployee(approval.employeeId);
    if (employee?.phone) {
      let notifyMessage: string;
      if (approval.type === 'expense') {
        notifyMessage = `ℹ️ *Update on your expense request*\n\nUnfortunately, your request was not approved.\n\n*Reason:* ${reason}\n\n_If you have questions, please reach out to HR._`;
      } else if (approval.type === 'vendor_payment') {
        notifyMessage = `ℹ️ *Update on your vendor payment request*\n\nUnfortunately, your request was not approved.\n\n*Reason:* ${reason}\n\n_If you have questions, please contact Kishor._`;
      } else {
        notifyMessage = `ℹ️ *Update on your leave request*\n\nUnfortunately, your request was not approved.\n\n*Reason:* ${reason}\n\n_If you have questions, please reach out to HR._`;
      }
      
      await sendWhatsAppMessage(employee.phone, notifyMessage);
    }

    return `❌ *Rejected* - ${code}\n*Reason:* ${reason}\n\n_Employee has been notified._`;
  }

  return `❓ Invalid command. Use:\n\n*A CODE* - Approve\n*R CODE reason* - Reject`;
}

// QR Payment Request Handlers
async function handleQrPaymentPaid(
  code: string,
  eventNameOrGeneral?: string,
  paymentScreenshotUrl?: string
): Promise<string> {
  const qrRequest = await storage.getQrPaymentRequestByCode(code.toUpperCase());
  
  if (!qrRequest) {
    return `❌ QR Payment Request ${code.toUpperCase()} not found.`;
  }
  
  if (qrRequest.status !== 'pending') {
    return `⚠️ QR Request ${code.toUpperCase()} was already ${qrRequest.status}.`;
  }
  
  // Update QR request as paid
  const eventName = eventNameOrGeneral?.trim() || 'General';
  const isGeneralExpense = eventName.toLowerCase() === 'general' || !eventNameOrGeneral;
  
  // Try to find event if specified
  let eventId: string | null = null;
  if (!isGeneralExpense) {
    const events = await storage.getAllEvents();
    const matchingEvent = events.find(e => 
      e.customer?.toLowerCase().includes(eventName.toLowerCase()) ||
      e.venue?.toLowerCase().includes(eventName.toLowerCase())
    );
    if (matchingEvent) {
      eventId = matchingEvent.id;
    }
  }
  
  await storage.updateQrPaymentRequest(qrRequest.id, {
    status: 'paid',
    paymentScreenshotUrl: paymentScreenshotUrl || null,
    eventId,
    eventName: isGeneralExpense ? 'General' : eventName,
    paidAt: new Date(),
  });
  
  // Create daybook entry
  const today = new Date().toISOString().split('T')[0];
  const daybookEntry = await storage.createDaybookEntry({
    date: today,
    type: 'expense',
    amount: qrRequest.amount,
    category: qrRequest.category,
    description: `QR Payment: ${qrRequest.description} (${qrRequest.employeeName})`,
    eventId,
    eventName: isGeneralExpense ? null : eventName,
  });
  
  // Update QR request with daybook entry link
  await storage.updateQrPaymentRequest(qrRequest.id, {
    status: 'recorded',
    daybookEntryId: daybookEntry.id,
    recordedAt: new Date(),
  });
  
  // Notify employee
  const notifyMessage = `🎉 *Payment Confirmed!*\n\n✅ Your payment request *${qrRequest.requestCode}* has been processed.\n\n💰 Amount: ₹${parseFloat(qrRequest.amount).toLocaleString('en-IN')}\n📝 For: ${qrRequest.description}\n📋 Recorded under: ${isGeneralExpense ? 'General Expenses' : eventName}\n\n_Thank you!_ 🌳`;
  
  await sendWhatsAppMessage(qrRequest.employeePhone, notifyMessage);
  
  return `✅ *Payment Recorded* - ${qrRequest.requestCode}\n\n💰 ₹${parseFloat(qrRequest.amount).toLocaleString('en-IN')}\n📝 ${qrRequest.description}\n📋 Added to: ${isGeneralExpense ? 'General Expenses' : eventName}\n\n_Employee notified & Daybook updated!_`;
}

async function handleQrPaymentReject(
  code: string,
  reason?: string
): Promise<string> {
  const qrRequest = await storage.getQrPaymentRequestByCode(code.toUpperCase());
  
  if (!qrRequest) {
    return `❌ QR Payment Request ${code.toUpperCase()} not found.`;
  }
  
  if (qrRequest.status !== 'pending') {
    return `⚠️ QR Request ${code.toUpperCase()} was already ${qrRequest.status}.`;
  }
  
  const rejectReason = reason?.trim() || 'Not approved';
  
  await storage.updateQrPaymentRequest(qrRequest.id, {
    status: 'rejected',
    rejectionReason: rejectReason,
  });
  
  // Notify employee
  const notifyMessage = `ℹ️ *Payment Request Update*\n\nYour payment request *${qrRequest.requestCode}* was not approved.\n\n*Reason:* ${rejectReason}\n\n_Please contact your manager if you have questions._`;
  
  await sendWhatsAppMessage(qrRequest.employeePhone, notifyMessage);
  
  return `❌ *Rejected* - ${qrRequest.requestCode}\n*Reason:* ${rejectReason}\n\n_Employee notified._`;
}

async function handleQrPaymentComplete(
  code: string,
  eventNameOrGeneral: string,
  paymentScreenshotUrl?: string
): Promise<string> {
  const qrRequest = await storage.getQrPaymentRequestByCode(code.toUpperCase());
  
  if (!qrRequest) {
    return `❌ QR Payment Request ${code.toUpperCase()} not found.`;
  }
  
  if (qrRequest.status !== 'paid') {
    return `⚠️ QR Request ${code.toUpperCase()} is in ${qrRequest.status} state.`;
  }
  
  // Determine event assignment - treat empty/blank as "General"
  const rawEventName = eventNameOrGeneral?.trim() || '';
  const isGeneralExpense = !rawEventName || rawEventName.toLowerCase() === 'general';
  const eventName = isGeneralExpense ? 'General' : rawEventName;
  
  // Try to find event if specified (only if not general and has meaningful search term)
  let eventId: string | null = null;
  if (!isGeneralExpense && eventName.length >= 2) {
    const events = await storage.getAllEvents();
    const matchingEvent = events.find(e => 
      e.customer?.toLowerCase().includes(eventName.toLowerCase()) ||
      e.venue?.toLowerCase().includes(eventName.toLowerCase())
    );
    if (matchingEvent) {
      eventId = matchingEvent.id;
    }
  }
  
  // Update QR request with screenshot and event
  await storage.updateQrPaymentRequest(qrRequest.id, {
    paymentScreenshotUrl: paymentScreenshotUrl || null,
    eventId,
    eventName: isGeneralExpense ? 'General' : eventName,
  });
  
  // Create daybook entry
  const today = new Date().toISOString().split('T')[0];
  const daybookEntry = await storage.createDaybookEntry({
    date: today,
    type: 'expense',
    amount: qrRequest.amount,
    category: qrRequest.category || 'Other',
    description: `QR Payment: ${qrRequest.description} (${qrRequest.employeeName})`,
    eventId,
    eventName: isGeneralExpense ? null : eventName,
  });
  
  // Update QR request with daybook entry link
  await storage.updateQrPaymentRequest(qrRequest.id, {
    status: 'recorded',
    daybookEntryId: daybookEntry.id,
    recordedAt: new Date(),
  });
  
  // Send screenshot to employee with confirmation
  if (paymentScreenshotUrl) {
    try {
      const { sendWhatsAppMediaMessage } = await import('./whatsapp-service');
      await sendWhatsAppMediaMessage(
        qrRequest.employeePhone,
        paymentScreenshotUrl,
        `🎉 *Payment Complete!*\n\n✅ Your request *${qrRequest.requestCode}* has been paid!\n\n💰 Amount: ₹${parseFloat(qrRequest.amount).toLocaleString('en-IN')}\n📝 For: ${qrRequest.description}\n📋 Recorded under: ${isGeneralExpense ? 'General Expenses' : eventName}\n\n_Thank you!_ 🌳`
      );
    } catch (error) {
      // Fallback to text message if media fails
      const notifyMessage = `🎉 *Payment Complete!*\n\n✅ Your request *${qrRequest.requestCode}* has been paid!\n\n💰 Amount: ₹${parseFloat(qrRequest.amount).toLocaleString('en-IN')}\n📝 For: ${qrRequest.description}\n📋 Recorded under: ${isGeneralExpense ? 'General Expenses' : eventName}\n\n_Thank you!_ 🌳`;
      await sendWhatsAppMessage(qrRequest.employeePhone, notifyMessage);
    }
  } else {
    const notifyMessage = `🎉 *Payment Complete!*\n\n✅ Your request *${qrRequest.requestCode}* has been paid!\n\n💰 Amount: ₹${parseFloat(qrRequest.amount).toLocaleString('en-IN')}\n📝 For: ${qrRequest.description}\n📋 Recorded under: ${isGeneralExpense ? 'General Expenses' : eventName}\n\n_Thank you!_ 🌳`;
    await sendWhatsAppMessage(qrRequest.employeePhone, notifyMessage);
  }
  
  return `✅ *Payment Recorded* - ${qrRequest.requestCode}\n\n💰 ₹${parseFloat(qrRequest.amount).toLocaleString('en-IN')}\n📝 ${qrRequest.description}\n📋 Added to: ${isGeneralExpense ? 'General Expenses' : eventName}\n\n_Employee notified with screenshot & Daybook updated!_`;
}

async function createQrPaymentRequest(
  employeeId: string,
  employeeName: string,
  employeePhone: string,
  category: string,
  description: string,
  amount: number,
  qrImageUrl: string,
  submissionCategory?: 'petty' | 'event'
): Promise<{ requestCode: string }> {
  const requestCode = await storage.generateQrPaymentCode();
  
  await storage.createQrPaymentRequest({
    requestCode,
    employeeId,
    employeeName,
    employeePhone,
    category: submissionCategory === 'petty' ? 'Petty' : category,
    description,
    amount: amount.toString(),
    qrImageUrl,
    status: 'pending',
  });
  
  return { requestCode };
}

async function notifyKishorQrPayment(
  requestCode: string,
  employeeName: string,
  description: string,
  amount: number,
  qrImageUrl: string
): Promise<void> {
  console.log(`[QR Payment] START notifyKishorQrPayment - requestCode: ${requestCode}, employee: ${employeeName}, amount: ${amount}, imageUrl: ${qrImageUrl ? 'present' : 'none'}`);
  console.log(`[QR Payment] SUPERADMIN_WHATSAPP: ${SUPERADMIN_WHATSAPP}`);
  
  // Extract first name for the command
  const firstName = employeeName.split(' ')[0];
  
  try {
    if (qrImageUrl) {
      try {
        // Convert Twilio authenticated URL to public URL
        const publicUrl = getPublicMediaUrl(qrImageUrl);
        console.log('[QR Payment] Using public URL:', publicUrl);
        
        const { sendWhatsAppMediaMessage } = await import('./whatsapp-service');
        console.log('[QR Payment] Calling sendWhatsAppMediaMessage...');
        const mediaResult = await sendWhatsAppMediaMessage(
          SUPERADMIN_WHATSAPP, 
          publicUrl,
          `💳 *${firstName}* needs *₹${amount.toLocaleString('en-IN')}*\n📝 ${description}\n\n_Reply "PAID ${firstName}" after payment_`
        );
        console.log(`[QR Payment] Media message result:`, mediaResult);
      } catch (mediaError: any) {
        // Fallback to text-only if media fails
        console.error('[QR Payment] Failed to send media, falling back to text:', mediaError.message);
        const message = `💳 *${firstName}* needs *₹${amount.toLocaleString('en-IN')}*\n📝 ${description}\n\n📷 QR: ${qrImageUrl}\n\n_Reply "PAID ${firstName}" after payment_`;
        console.log('[QR Payment] Sending fallback text message...');
        const textResult = await sendWhatsAppMessage(SUPERADMIN_WHATSAPP, message);
        console.log('[QR Payment] Text fallback result:', textResult);
      }
    } else {
      const message = `💳 *${firstName}* needs *₹${amount.toLocaleString('en-IN')}*\n📝 ${description}\n\n_Reply "PAID ${firstName}" after payment_`;
      console.log('[QR Payment] No image, sending text-only notification...');
      const textResult = await sendWhatsAppMessage(SUPERADMIN_WHATSAPP, message);
      console.log(`[QR Payment] Text notification result for ${requestCode}:`, textResult);
    }
    console.log(`[QR Payment] END notifyKishorQrPayment - SUCCESS for ${requestCode}`);
  } catch (error: any) {
    console.error(`[QR Payment] CRITICAL: Failed to notify Kishor about ${requestCode}:`, error.message);
    // Try one more time with just text
    try {
      const fallbackMessage = `💳 ${firstName} needs ₹${amount} for ${description}. Reply PAID ${firstName} after payment.`;
      console.log('[QR Payment] Attempting final fallback...');
      await sendWhatsAppMessage(SUPERADMIN_WHATSAPP, fallbackMessage);
      console.log('[QR Payment] Final fallback succeeded');
    } catch (fallbackError: any) {
      console.error('[QR Payment] Even fallback failed:', fallbackError.message);
    }
  }
}

// Income submission notification to Kishor
async function notifyKishorIncomeSubmission(
  requestCode: string,
  employeeName: string,
  type: 'client_payment' | 'bank_transfer',
  clientName: string,
  description: string,
  amount: number,
  screenshotUrl?: string,
  bankName?: string
): Promise<void> {
  const typeLabel = type === 'bank_transfer' ? 'Bank Transfer' : 'Client Payment';
  const bankLabel = bankName ? `\n🏦 *Bank:* ${bankName}` : '';
  
  if (screenshotUrl) {
    try {
      // Convert Twilio authenticated URL to public URL
      const publicUrl = await getPublicMediaUrl(screenshotUrl);
      console.log('[Income] Using public URL:', publicUrl);
      
      const { sendWhatsAppMediaMessage } = await import('./whatsapp-service');
      await sendWhatsAppMediaMessage(
        SUPERADMIN_WHATSAPP, 
        publicUrl,
        `📥 *Income Submission ${requestCode}*\n\n👤 From: ${employeeName}\n📁 Type: ${typeLabel}\n👥 Client: ${clientName}\n💰 Amount: *₹${amount.toLocaleString('en-IN')}*${bankLabel}\n\n_Reply "A ${requestCode}" to approve_`
      );
    } catch (mediaError) {
      console.error('[Income] Failed to send media, falling back to text:', mediaError);
      const message = `📥 *Income Submission ${requestCode}*\n━━━━━━━━━━━━━━━━━━\n\n👤 *From:* ${employeeName}\n📁 *Type:* ${typeLabel}\n👥 *Client:* ${clientName}\n💰 *Amount:* ₹${amount.toLocaleString('en-IN')}${bankLabel}\n\n📷 Screenshot: ${screenshotUrl}\n\n_Reply "A ${requestCode}" to approve_\n_Reply "R ${requestCode} reason" to reject_\n\n🌳 Oaksy`;
      await sendWhatsAppMessage(SUPERADMIN_WHATSAPP, message);
    }
  } else {
    const message = `📥 *Income Submission ${requestCode}*\n━━━━━━━━━━━━━━━━━━\n\n👤 *From:* ${employeeName}\n📁 *Type:* ${typeLabel}\n👥 *Client:* ${clientName}\n💰 *Amount:* ₹${amount.toLocaleString('en-IN')}${bankLabel}\n\n_Reply "A ${requestCode}" to approve_\n_Reply "R ${requestCode} reason" to reject_\n\n🌳 Oaksy`;
    await sendWhatsAppMessage(SUPERADMIN_WHATSAPP, message);
  }
}

// Notify Kishor about a new pending vendor payment
async function notifyKishorPendingVendorPayment(
  requestCode: string,
  employeeName: string,
  vendorName: string,
  amount: number,
  eventName: string
): Promise<void> {
  const message = `🏪 *Pending Vendor Payment ${requestCode}*\n━━━━━━━━━━━━━━━━━━\n\n👤 *Submitted by:* ${employeeName}\n🏢 *Vendor:* ${vendorName}\n💰 *Amount:* ₹${amount.toLocaleString('en-IN')}\n📅 *Event:* ${eventName}\n\n_Reply "PAID ${requestCode}" when payment is made_\n\n🌳 Oaksy`;
  await sendWhatsAppMessage(SUPERADMIN_WHATSAPP, message);
}

// Mark vendor payment as paid and record in daybook
async function handleVendorPaymentPaid(
  code: string,
  eventNameOrGeneral?: string
): Promise<string> {
  const payment = await storage.getPendingVendorPaymentByCode(code.toUpperCase());
  
  if (!payment) {
    return `❌ Vendor payment ${code.toUpperCase()} not found.`;
  }
  
  if (payment.status === 'paid') {
    return `⚠️ Vendor payment ${code.toUpperCase()} was already marked as paid.`;
  }
  
  // Determine event assignment
  const rawEventName = eventNameOrGeneral?.trim() || payment.eventName || '';
  const isGeneralExpense = !rawEventName || rawEventName.toLowerCase() === 'general';
  const eventName = isGeneralExpense ? 'General' : rawEventName;
  
  // Try to find event if specified
  let eventId: string | null = payment.eventId || null;
  if (!isGeneralExpense && eventName.length >= 2 && !eventId) {
    const events = await storage.getAllEvents();
    const matchingEvent = events.find(e => 
      e.customer?.toLowerCase().includes(eventName.toLowerCase()) ||
      e.venue?.toLowerCase().includes(eventName.toLowerCase()) ||
      e.title?.toLowerCase().includes(eventName.toLowerCase())
    );
    if (matchingEvent) {
      eventId = matchingEvent.id;
    }
  }
  
  // Create daybook entry as expense
  const today = new Date().toISOString().split('T')[0];
  const daybookEntry = await storage.createDaybookEntry({
    date: today,
    type: 'expense',
    amount: payment.amount,
    category: 'Vendor Payment',
    description: `Payment to ${payment.vendorName} (via ${payment.employeeName})`,
    eventId,
    eventName: isGeneralExpense ? null : eventName,
    vendorName: payment.vendorName,
  });
  
  // Update payment as paid
  await storage.updatePendingVendorPayment(payment.id, {
    status: 'paid',
    eventId,
    eventName: isGeneralExpense ? 'General' : eventName,
    daybookEntryId: daybookEntry.id,
    paidAt: new Date(),
  });

  // Notify employee
  await sendWhatsAppMessage(
    payment.employeePhone,
    `✅ *Payment Made!*\n\nYour pending vendor payment *${payment.requestCode}* to *${payment.vendorName}* for ₹${parseFloat(payment.amount).toLocaleString('en-IN')} has been paid.\n\n🌳 Oaksy`
  );
  
  return `✅ Vendor payment ${code.toUpperCase()} marked as PAID!\n\n🏪 Vendor: ${payment.vendorName}\n💰 Amount: ₹${parseFloat(payment.amount).toLocaleString('en-IN')}\n📅 Event: ${eventName}\n📒 Recorded in daybook\n\n_${payment.employeeName} has been notified._`;
}

// Complete income approval with event assignment
async function handleIncomeApprovalComplete(
  code: string,
  eventNameOrGeneral: string
): Promise<string> {
  const incomeSubmission = await storage.getIncomeSubmissionByCode(code.toUpperCase());
  
  if (!incomeSubmission) {
    return `❌ Income submission ${code.toUpperCase()} not found.`;
  }
  
  if (incomeSubmission.status !== 'pending') {
    return `⚠️ Income ${code.toUpperCase()} was already ${incomeSubmission.status}.`;
  }
  
  // Determine event assignment
  const rawEventName = eventNameOrGeneral?.trim() || '';
  const isGeneralIncome = !rawEventName || rawEventName.toLowerCase() === 'general';
  const eventName = isGeneralIncome ? 'General' : rawEventName;
  
  // Try to find event if specified
  let eventId: string | null = null;
  if (!isGeneralIncome && eventName.length >= 2) {
    const events = await storage.getAllEvents();
    const matchingEvent = events.find(e => 
      e.customer?.toLowerCase().includes(eventName.toLowerCase()) ||
      e.venue?.toLowerCase().includes(eventName.toLowerCase())
    );
    if (matchingEvent) {
      eventId = matchingEvent.id;
    }
  }
  
  // Create daybook entry as income
  const today = new Date().toISOString().split('T')[0];
  const category = incomeSubmission.type === 'bank_transfer' ? 'Bank Transfer' : 'Client Payment';
  const daybookEntry = await storage.createDaybookEntry({
    date: today,
    type: 'income',
    amount: incomeSubmission.amount,
    category,
    description: `${incomeSubmission.description} (via ${incomeSubmission.employeeName})`,
    eventId,
    eventName: isGeneralIncome ? null : eventName,
  });
  
  // Update income submission as approved
  await storage.updateIncomeSubmission(incomeSubmission.id, {
    status: 'approved',
    eventId,
    eventName: isGeneralIncome ? 'General' : eventName,
    daybookEntryId: daybookEntry.id,
    approvedAt: new Date(),
  });
  
  // Notify employee
  const notifyMessage = `🎉 *Income Approved!*\n\n✅ Your submission *${incomeSubmission.requestCode}* has been approved!\n\n💰 Amount: ₹${parseFloat(incomeSubmission.amount).toLocaleString('en-IN')}\n📋 Recorded under: ${isGeneralIncome ? 'General Income' : eventName}\n\n_Thank you!_ 🌳`;
  await sendWhatsAppMessage(incomeSubmission.employeePhone, notifyMessage);
  
  return `✅ *Income Recorded* - ${incomeSubmission.requestCode}\n\n💰 ₹${parseFloat(incomeSubmission.amount).toLocaleString('en-IN')}\n📝 ${incomeSubmission.description}\n📋 Added to: ${isGeneralIncome ? 'General Income' : eventName}\n\n_Employee notified & Daybook updated!_`;
}

// Reject income submission
async function handleIncomeReject(
  code: string,
  reason?: string
): Promise<string> {
  const incomeSubmission = await storage.getIncomeSubmissionByCode(code.toUpperCase());
  
  if (!incomeSubmission) {
    return `❌ Income submission ${code.toUpperCase()} not found.`;
  }
  
  if (incomeSubmission.status !== 'pending') {
    return `⚠️ Income ${code.toUpperCase()} was already ${incomeSubmission.status}.`;
  }
  
  const rejectReason = reason?.trim() || 'Not approved';
  
  await storage.updateIncomeSubmission(incomeSubmission.id, {
    status: 'rejected',
    rejectionReason: rejectReason,
  });
  
  // Notify employee
  const notifyMessage = `ℹ️ *Income Submission Update*\n\nYour submission *${incomeSubmission.requestCode}* was not approved.\n\n*Reason:* ${rejectReason}\n\n_Please contact management if you have questions._`;
  await sendWhatsAppMessage(incomeSubmission.employeePhone, notifyMessage);
  
  return `❌ *Rejected* - ${incomeSubmission.requestCode}\n*Reason:* ${rejectReason}\n\n_Employee notified._`;
}

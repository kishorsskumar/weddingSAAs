import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { parseTransactionScreenshot } from "./transaction-scanner";
import { sendWhatsAppMessage, sendWhatsAppMediaMessage, isWhatsAppConfigured } from "./whatsapp-service";
import { generateMonthlyPlanPDF } from "./monthlyPlanPdf";
import { 
  insertUserSchema,
  insertRoleSchema,
  insertEventSchema,
  insertMeetingSchema,
  insertEmployeeSchema,
  insertDaybookEntrySchema,
  insertBankSchema,
  insertLeaveRequestSchema,
  insertEventMilestoneSchema,
  insertCustomerSchema,
  insertVendorSchema,
  insertEstimateSchema,
  insertInvoiceSchema,
  insertCustomerPaymentSchema,
  insertExpenseSchema,
  insertVendorPaymentSchema,
  customerCreationLogs,
  type InsertEventMilestone,
} from "@shared/schema";
import { db } from "./db";
import { sql, eq, and, gte, like } from "drizzle-orm";
import { customers, events } from "@shared/schema";
import bcrypt from "bcryptjs";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const PgSession = connectPgSimple(session);

// Helper function to escape XML special characters for TwiML responses
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Helper function to get current Indian fiscal year (April to March)
function getCurrentFiscalYear(): string {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed (0 = Jan, 3 = Apr)
  const year = now.getFullYear();
  
  // If current month is Jan-Mar, fiscal year started previous calendar year
  // If current month is Apr-Dec, fiscal year started this calendar year
  if (month < 3) { // Jan, Feb, Mar
    return `${year - 1}-${String(year).slice(-2)}`;
  } else { // Apr onwards
    return `${year}-${String(year + 1).slice(-2)}`;
  }
}

function generateMilestonesForEvent(eventId: string, eventDate: string, eventTime?: string | null): InsertEventMilestone[] {
  const dateObj = new Date(eventDate);
  
  const addDays = (date: Date, days: number) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result.toISOString().split('T')[0];
  };

  const subtractDays = (date: Date, days: number) => {
    const result = new Date(date);
    result.setDate(result.getDate() - days);
    return result.toISOString().split('T')[0];
  };

  return [
    { eventId, phase: 1, phaseName: 'Event Kickoff', name: 'Create Client Folder & CRM Entry', date: subtractDays(dateObj, 90), status: 'pending' },
    { eventId, phase: 1, phaseName: 'Event Kickoff', name: 'Internal Kick off Meeting', date: subtractDays(dateObj, 87), status: 'pending' },
    { eventId, phase: 1, phaseName: 'Event Kickoff', name: 'Client Kick off Meeting', date: subtractDays(dateObj, 80), status: 'pending' },
    { eventId, phase: 1, phaseName: 'Event Kickoff', name: 'Venue Recce', date: subtractDays(dateObj, 80), status: 'pending' },

    { eventId, phase: 2, phaseName: 'Design', name: 'Theme & Mood board finalization', date: subtractDays(dateObj, 70), status: 'pending' },
    { eventId, phase: 2, phaseName: 'Design', name: '2D/3D approval', date: subtractDays(dateObj, 60), status: 'pending' },
    { eventId, phase: 2, phaseName: 'Design', name: 'Freeze Decor Design', date: subtractDays(dateObj, 60), status: 'pending' },

    { eventId, phase: 3, phaseName: 'Procurement & Production', name: '2nd Installment Payment', date: subtractDays(dateObj, 60), status: 'pending' },
    { eventId, phase: 3, phaseName: 'Procurement & Production', name: 'Budget approval from client', date: subtractDays(dateObj, 60), status: 'pending' },
    { eventId, phase: 3, phaseName: 'Procurement & Production', name: 'Production / high value purchase', date: subtractDays(dateObj, 60), status: 'pending' },
    { eventId, phase: 3, phaseName: 'Procurement & Production', name: 'Vendor booking', date: subtractDays(dateObj, 60), status: 'pending' },
    { eventId, phase: 3, phaseName: 'Procurement & Production', name: 'Any change request', date: subtractDays(dateObj, 45), status: 'pending' },
    { eventId, phase: 3, phaseName: 'Procurement & Production', name: 'Production File & Checklist', date: subtractDays(dateObj, 45), status: 'pending' },

    { eventId, phase: 4, phaseName: 'Logistics & Coordination', name: 'Printables Design Approval', date: subtractDays(dateObj, 30), status: 'pending' },
    { eventId, phase: 4, phaseName: 'Logistics & Coordination', name: '3rd Installment Payment', date: subtractDays(dateObj, 22), status: 'pending' },
    { eventId, phase: 4, phaseName: 'Logistics & Coordination', name: 'Production/Transportation plans', date: subtractDays(dateObj, 21), status: 'pending' },
    { eventId, phase: 4, phaseName: 'Logistics & Coordination', name: 'Venue coordination call', date: subtractDays(dateObj, 19), status: 'pending' },
    { eventId, phase: 4, phaseName: 'Logistics & Coordination', name: 'Internal Coordination meeting', date: subtractDays(dateObj, 16), status: 'pending' },
    { eventId, phase: 4, phaseName: 'Logistics & Coordination', name: 'Client coordination Meeting', date: subtractDays(dateObj, 15), status: 'pending' },
    { eventId, phase: 4, phaseName: 'Logistics & Coordination', name: 'Vendor coordination meeting', date: subtractDays(dateObj, 13), status: 'pending' },

    { eventId, phase: 5, phaseName: 'Event Week', name: 'Printables to Printer', date: subtractDays(dateObj, 7), status: 'pending' },
    { eventId, phase: 5, phaseName: 'Event Week', name: 'Execution team briefing', date: subtractDays(dateObj, 5), status: 'pending' },
    { eventId, phase: 5, phaseName: 'Event Week', name: 'Final vendor confirmation call', date: subtractDays(dateObj, 4), status: 'pending' },
    { eventId, phase: 5, phaseName: 'Event Week', name: 'Material arrangement warehouse', date: subtractDays(dateObj, 3), status: 'pending' },
    { eventId, phase: 5, phaseName: 'Event Week', name: 'Flower/Rental arrangements', date: subtractDays(dateObj, 2), status: 'pending' },
    { eventId, phase: 5, phaseName: 'Event Week', name: 'Material loading', date: subtractDays(dateObj, 2), status: 'pending' },
    { eventId, phase: 5, phaseName: 'Event Week', name: 'Truck departure', date: subtractDays(dateObj, 2), status: 'pending' },

    { eventId, phase: 6, phaseName: 'Event Day', name: 'Wedding planner Reporting', date: eventDate, time: '11:00 am', status: 'pending' },
    { eventId, phase: 6, phaseName: 'Event Day', name: 'Venue Fully Ready', date: eventDate, time: '1:00 pm', status: 'pending' },
    { eventId, phase: 6, phaseName: 'Event Day', name: 'Guest Management Team Reporting', date: eventDate, time: '2:00 pm', status: 'pending' },

    { eventId, phase: 7, phaseName: 'Packup & Closure', name: 'Demobilisation', date: addDays(dateObj, 1), time: '6:00 pm', status: 'pending' },
    { eventId, phase: 7, phaseName: 'Packup & Closure', name: 'Final payment collection', date: addDays(dateObj, 2), status: 'pending' },
    { eventId, phase: 7, phaseName: 'Packup & Closure', name: 'Vendor settlement', date: addDays(dateObj, 7), status: 'pending' },
    { eventId, phase: 7, phaseName: 'Packup & Closure', name: 'Feedback', date: addDays(dateObj, 8), status: 'pending' },
    { eventId, phase: 7, phaseName: 'Packup & Closure', name: 'Close the event', date: addDays(dateObj, 10), status: 'pending' },
  ];
}

// Generate unique customer code with transaction safety: OAKS-C-YY-XXXX
async function generateCustomerCode(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2); // Last 2 digits of year
  const prefix = `OAKS-C-${year}-`;
  
  // Use transaction with FOR UPDATE to prevent race conditions
  return await db.transaction(async (tx) => {
    // Get highest sequence number for this year with row-level lock
    const result = await tx
      .select({ customerCode: customers.customerCode })
      .from(customers)
      .where(like(customers.customerCode, `${prefix}%`))
      .for('update');
    
    // Find the highest sequence number
    let maxSeq = 0;
    for (const row of result) {
      if (row.customerCode) {
        const match = row.customerCode.match(/OAKS-C-\d{2}-(\d{4})$/);
        if (match) {
          const seq = parseInt(match[1], 10);
          if (seq > maxSeq) maxSeq = seq;
        }
      }
    }
    
    const nextSeq = (maxSeq + 1).toString().padStart(4, '0');
    return `${prefix}${nextSeq}`;
  });
}

// Generate unique event code with transaction safety: OAKS-E-YY-MM-XXX
async function generateEventCode(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2); // Last 2 digits of year
  const month = (now.getMonth() + 1).toString().padStart(2, '0'); // 01-12
  const prefix = `OAKS-E-${year}-${month}-`;
  
  // Use transaction with FOR UPDATE to prevent race conditions
  return await db.transaction(async (tx) => {
    // Get highest sequence number for this year-month with row-level lock
    const result = await tx
      .select({ eventCode: events.eventCode })
      .from(events)
      .where(like(events.eventCode, `${prefix}%`))
      .for('update');
    
    // Find the highest sequence number
    let maxSeq = 0;
    for (const row of result) {
      if (row.eventCode) {
        const match = row.eventCode.match(/OAKS-E-\d{2}-\d{2}-(\d{3})$/);
        if (match) {
          const seq = parseInt(match[1], 10);
          if (seq > maxSeq) maxSeq = seq;
        }
      }
    }
    
    const nextSeq = (maxSeq + 1).toString().padStart(3, '0');
    return `${prefix}${nextSeq}`;
  });
}

interface ParsedScheduleItem {
  slNo: number;
  description: string;
  startTime: string;
  endTime: string;
  responsible: string;
}

interface ParsedScheduleSection {
  heading: string;
  installationDate: string | null;
  eventName: string;
  items: ParsedScheduleItem[];
}

interface ParsedScheduleData {
  sections: ParsedScheduleSection[];
  rawLines: string[];
}

function parseScheduleFromRows(rows: string[][]): ParsedScheduleData {
  const section: ParsedScheduleSection = {
    heading: 'Imported Document',
    installationDate: null,
    eventName: 'Production Schedule',
    items: []
  };
  
  const months: { [key: string]: string } = {
    'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
    'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
  };
  
  const skipPatterns = [
    /^oakstreet/i, /^2nd floor/i, /devas studio/i, /deshabhimani/i, /press road/i,
    /kochi kerala/i, /kerala 682017/i, /^india$/i, /^7902373354$/i, /oakstreetevents.*@gmail/i,
    /www\.oakstreet/i, /^estimate no/i, /^quote date/i, /^bill to$/i, /^quote$/i,
    /^qt-\d/i, /^invoice no/i, /^invoice date/i, /^subject\s*:/i, /^subject$/i,
    /^sl\.?\s*no/i, /item.*description/i, /^particulars$/i,
    /sub\s*total/i, /grand\s*total/i, /^total\s*[₹rs]/i, /^total$/i,
    /authorized signature/i, /terms\s*[&and]*\s*conditions/i, /^terms & conditions$/i,
    /looking forward/i, /thank you for/i, /^notes$/i, /^notes:$/i,
    /service charge/i, /indian rupee/i, /rupees only/i, /lakh/i,
    /total in words/i, /amount in words/i, /charged at actual/i,
    /additional facilities/i, /additional services/i, /any other additional/i,
    /support the event/i, /^[csi]gst\s*@/i, /tax amount/i, /taxable amount/i,
    /payment terms/i, /bank details/i, /account no/i, /ifsc code/i,
    /% of the amount/i, /^\d+% of/i, /balance payment/i, /advance payment/i,
    /(six|five|four|three|two|one|seven|eight|nine|ten)\s+only/i,
    /(eighty|ninety|seventy|sixty|fifty|forty|thirty|twenty)\s*(thousand|lakh|hundred|crore)/i,
    /venue is to be made available/i, /loading.*unloading.*charges/i, /labour union/i,
    /damage.*occurred.*materials/i, /cancellation.*function/i, /cancellation fees/i,
    /covid.?19/i, /protocol.*government/i, /necessary approvals/i,
    /rental basis/i, /gst will be extra/i, /rates will vary/i,
    /genset fuel/i, /kseb.*electrical/i, /electrical charges/i,
    /public performance license/i, /entertainment license/i, /ppl/i,
    /m\/s\. oakstreet/i, /favor of/i, /sibl\d+/i,
    /paid in advance/i, /before the event/i, /on the event day/i,
    /participants.*abide/i, /client to obtain/i, /authorities/i,
    /all items mentioned above/i, /above mentioned rates/i,
    /will be at actual/i, /may come additional/i, /will be born by/i,
    /^malavika$/i, /steeles ave/i, /toronto/i, /m2r3w8/i,
    /welcome party on/i, /haldi on \d+/i, /at baymaas/i, /at baymass/i,
    /^\d+ december \d{4}$/i, /^\d+ january \d{4}$/i, /^\d+ february \d{4}$/i,
    /^\d+ march \d{4}$/i, /^\d+ april \d{4}$/i, /^\d+ may \d{4}$/i,
    /^\d+ june \d{4}$/i, /^\d+ july \d{4}$/i, /^\d+ august \d{4}$/i,
    /^\d+ september \d{4}$/i, /^\d+ october \d{4}$/i, /^\d+ november \d{4}$/i
  ];
  
  function shouldSkipRow(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length < 3) return true;
    if (trimmed.match(/^[\d,₹.\s-]+$/)) return true;
    return skipPatterns.some(pattern => pattern.test(trimmed));
  }
  
  let slNoCounter = 1;
  
  for (const row of rows) {
    const rowText = row.join(' ').trim();
    
    const dateMatch = rowText.match(/(\d{1,2})\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s*(\d{4})/i);
    if (dateMatch && !section.installationDate) {
      const day = dateMatch[1].padStart(2, '0');
      const monthNum = months[dateMatch[2].toLowerCase().substring(0, 3)];
      const year = dateMatch[3];
      section.installationDate = `${year}-${monthNum}-${day}`;
      if (rowText.length > 20) {
        section.heading = rowText;
      }
    }
    
    if (shouldSkipRow(rowText)) continue;
    
    let description = '';
    const firstCell = row[0]?.trim() || '';
    const hasSlNo = /^\d+\.?$/.test(firstCell);
    
    if (hasSlNo && row.length >= 2) {
      if (row.length >= 5) {
        description = row.slice(1, row.length - 3).join(' ').trim();
      } else if (row.length >= 3) {
        description = row.slice(1, -1).join(' ').trim();
      } else {
        description = row[1]?.trim() || '';
      }
    } else {
      if (row.length >= 4) {
        description = row.slice(0, row.length - 3).join(' ').trim();
      } else if (row.length >= 2) {
        description = row.slice(0, -1).join(' ').trim();
      } else {
        description = rowText;
      }
      description = description.replace(/^\d+\.?\s*/, '').trim();
    }
    
    if (description && description.length >= 3 && 
        !shouldSkipRow(description) &&
        description.length <= 500) {
      
      section.items.push({
        slNo: slNoCounter++,
        description: description,
        startTime: '',
        endTime: '',
        responsible: ''
      });
    }
  }
  
  return { sections: [section], rawLines: rows.map(r => r.join(' | ')) };
}

function cleanNumber(str: string): number {
  if (!str) return 0;
  const cleaned = str.replace(/[₹,\s]/g, '').replace(/[^\d.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

interface ParsedLineItem {
  slNo: number;
  description: string;
  quantity: number;
  notes?: string;
}

interface ParsedSection {
  originalHeading: string;
  eventName: string;
  category: string;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  items: ParsedLineItem[];
}

interface ParsedEstimateData {
  sections: ParsedSection[];
  rawLines: string[];
}

function parseEstimatePDF(text: string): ParsedEstimateData {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const sections: ParsedSection[] = [];
  let currentSection: ParsedSection | null = null;
  
  const dayHeaderRegex = /^(?:DAY\s*\d+\s*:\s*)?(\d{1,2})\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s*(\d{4})\s*[-–]\s*(.+?)(?:\s*\(([^)]+)\))?$/i;
  const categoryHeaderRegex = /^([A-Z][A-Z\s&]+(?:\s+FOR\s+[A-Z\s]+)?)$/;
  const lineItemRegex = /^(\d+)\s+(.+?)\s+([\d,.]+)\s+([\d,.₹]+)\s+([\d,.₹]+)$/;
  const altLineItemRegex = /^(\d+)\s+(.+?)$/;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    const dayMatch = line.match(dayHeaderRegex);
    if (dayMatch) {
      const day = dayMatch[1];
      const month = dayMatch[2];
      const year = dayMatch[3];
      const eventName = dayMatch[4]?.trim() || 'Event';
      const timeRange = dayMatch[5]?.trim() || '';
      
      const months: { [key: string]: string } = {
        'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
        'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
      };
      const monthNum = months[month.toLowerCase().substring(0, 3)];
      const dateStr = `${year}-${monthNum}-${day.padStart(2, '0')}`;
      
      let startTime: string | null = null;
      let endTime: string | null = null;
      if (timeRange) {
        const timeMatch = timeRange.match(/(\d{1,2}[.:]\d{2}\s*(?:AM|PM)?)\s*(?:to|-)\s*(\d{1,2}[.:]\d{2}\s*(?:AM|PM)?)/i);
        if (timeMatch) {
          startTime = normalizeTime(timeMatch[1]);
          endTime = normalizeTime(timeMatch[2]);
        }
      }
      
      currentSection = {
        originalHeading: line,
        eventName,
        category: eventName,
        date: dateStr,
        startTime,
        endTime,
        items: []
      };
      sections.push(currentSection);
      continue;
    }
    
    const catMatch = line.match(categoryHeaderRegex);
    if (catMatch && currentSection && !line.match(/^\d+\s/) && line.length >= 5) {
      const categoryName = catMatch[1].trim();
      const skipKeywords = ['SL', 'NO', 'ITEM', 'DESCRIPTION', 'QTY', 'RATE', 'AMOUNT', 'TOTAL', 'SUB'];
      if (!skipKeywords.some(k => categoryName.toUpperCase().startsWith(k))) {
        if (currentSection.items.length > 0) {
          currentSection = {
            originalHeading: line,
            eventName: currentSection.eventName,
            category: categoryName,
            date: currentSection.date,
            startTime: currentSection.startTime,
            endTime: currentSection.endTime,
            items: []
          };
          sections.push(currentSection);
        } else {
          currentSection.category = categoryName;
          currentSection.originalHeading = line;
        }
      }
      continue;
    }
    
    if (!currentSection) continue;
    
    const itemMatch = line.match(lineItemRegex);
    if (itemMatch) {
      const quantity = cleanNumber(itemMatch[3]);
      if (quantity > 0) {
        currentSection.items.push({
          slNo: parseInt(itemMatch[1]) || currentSection.items.length + 1,
          description: itemMatch[2].trim(),
          quantity
        });
        continue;
      }
    }
    
    const parts = line.split(/\s{2,}|\t+/);
    if (parts.length >= 4 && /^\d+$/.test(parts[0].trim())) {
      const slNo = parseInt(parts[0].trim());
      let desc = '';
      let qty = 0;
      
      for (let j = parts.length - 1; j >= 1; j--) {
        const val = cleanNumber(parts[j]);
        if (val > 0 && !qty) { 
          qty = val; 
          break; 
        }
      }
      
      const descParts = [];
      for (let j = 1; j < parts.length; j++) {
        if (cleanNumber(parts[j]) === 0 || descParts.length === 0) {
          const cleaned = parts[j].replace(/^[\d,.]+$/, '').trim();
          if (cleaned) descParts.push(cleaned);
        } else break;
      }
      desc = descParts.join(' ').trim();
      
      if (desc && qty > 0) {
        currentSection.items.push({
          slNo,
          description: desc,
          quantity: qty
        });
        continue;
      }
    }
    
    const altMatch = line.match(altLineItemRegex);
    if (altMatch) {
      const slNo = parseInt(altMatch[1]);
      const rest = altMatch[2];
      const numbers = rest.match(/[\d,.]+/g) || [];
      if (numbers.length >= 1) {
        const qty = cleanNumber(numbers[numbers.length - 1]);
        let desc = rest;
        for (const num of numbers) {
          desc = desc.replace(num, '').trim();
        }
        desc = desc.replace(/\s+/g, ' ').trim();
        
        if (desc && qty > 0) {
          currentSection.items.push({
            slNo,
            description: desc,
            quantity: qty
          });
        }
      }
    }
  }
  
  const result = sections.filter(s => s.items.length > 0);
  
  if (result.length === 0 && lines.length > 0) {
    const fallbackSection: ParsedSection = {
      originalHeading: 'Imported Items',
      eventName: 'Imported Event',
      category: 'General',
      date: null,
      startTime: null,
      endTime: null,
      items: []
    };
    
    for (const line of lines) {
      if (line.match(/^\d+\s+\w/)) {
        const numbers = line.match(/[\d,.]+/g) || [];
        if (numbers.length >= 1) {
          const qty = cleanNumber(numbers[numbers.length - 1]);
          let desc = line.replace(/^\d+\s*/, '');
          for (const num of numbers) {
            desc = desc.replace(num, '').trim();
          }
          desc = desc.replace(/\s+/g, ' ').trim();
          
          if (desc && qty > 0) {
            fallbackSection.items.push({
              slNo: fallbackSection.items.length + 1,
              description: desc,
              quantity: qty
            });
          }
        }
      }
    }
    
    if (fallbackSection.items.length > 0) {
      result.push(fallbackSection);
    }
  }
  
  return { sections: result, rawLines: lines };
}

function parseEstimateFromRows(rows: string[][]): ParsedEstimateData {
  const sections: ParsedSection[] = [];
  let currentSection: ParsedSection | null = null;
  
  const dayHeaderRegex = /DAY\s*\d+\s*:\s*(\d{1,2})\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s*(\d{4})\s*[-–]\s*(.+)/i;
  const altDayRegex = /^(\d{1,2})\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s*(\d{4})\s*[-–]\s*(.+)/i;
  
  const months: { [key: string]: string } = {
    'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
    'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
  };
  
  function extractTimeRange(text: string): { startTime: string | null; endTime: string | null } {
    const patterns = [
      /\(([^)]+)\)/,
      /(\d{1,2}[.:]\d{2}\s*(?:AM|PM)?)\s*(?:to|-)\s*(\d{1,2}[.:]\d{2}\s*(?:AM|PM)?)/i
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        if (match[2]) {
          return { startTime: normalizeTime(match[1]), endTime: normalizeTime(match[2]) };
        } else if (match[1]) {
          const timeMatch = match[1].match(/(\d{1,2}[.:]\d{2}\s*(?:AM|PM)?)\s*(?:to|-)\s*(\d{1,2}[.:]\d{2}\s*(?:AM|PM)?)/i);
          if (timeMatch) {
            return { startTime: normalizeTime(timeMatch[1]), endTime: normalizeTime(timeMatch[2]) };
          }
        }
      }
    }
    return { startTime: null, endTime: null };
  }
  
  for (const row of rows) {
    const rowText = row.join(' ').trim();
    
    if (rowText.toLowerCase().includes('sl') && rowText.toLowerCase().includes('item') && 
        (rowText.toLowerCase().includes('qty') || rowText.toLowerCase().includes('description'))) {
      continue;
    }
    
    if (rowText.toLowerCase().includes('sub total') || rowText.toLowerCase().includes('subtotal') ||
        rowText.toLowerCase().includes('service charge') || rowText.toLowerCase().includes('grand total') ||
        rowText.toLowerCase().includes('total ₹') || rowText.toLowerCase().includes('authorized signature') ||
        rowText.toLowerCase().includes('terms & conditions') || rowText.toLowerCase().includes('notes') ||
        rowText.toLowerCase().includes('looking forward') || rowText.toLowerCase().includes('indian rupee')) {
      continue;
    }
    
    let dayMatch = rowText.match(dayHeaderRegex) || rowText.match(altDayRegex);
    if (dayMatch) {
      const day = dayMatch[1];
      const month = dayMatch[2];
      const year = dayMatch[3];
      const eventPart = dayMatch[4]?.trim() || 'Event';
      
      const eventNameMatch = eventPart.match(/^([^(]+)/);
      const eventName = eventNameMatch ? eventNameMatch[1].trim() : eventPart;
      
      const monthNum = months[month.toLowerCase().substring(0, 3)];
      const dateStr = `${year}-${monthNum}-${day.padStart(2, '0')}`;
      
      const { startTime, endTime } = extractTimeRange(eventPart);
      
      currentSection = {
        originalHeading: rowText,
        eventName,
        category: eventName,
        date: dateStr,
        startTime,
        endTime,
        items: []
      };
      sections.push(currentSection);
      continue;
    }
    
    const isCategoryHeader = /^[A-Z][A-Z\s&]+$/.test(rowText) && 
      rowText.length >= 5 && 
      rowText.length <= 50 &&
      !rowText.match(/^\d/) &&
      !rowText.match(/[\d₹]/);
    
    if (isCategoryHeader && currentSection) {
      const skipKeywords = ['SL', 'NO', 'ITEM', 'DESCRIPTION', 'QTY', 'RATE', 'AMOUNT', 'TOTAL', 'SUB'];
      if (!skipKeywords.some(k => rowText.toUpperCase().startsWith(k))) {
        if (currentSection.items.length > 0) {
          currentSection = {
            originalHeading: rowText,
            eventName: currentSection.eventName,
            category: rowText,
            date: currentSection.date,
            startTime: currentSection.startTime,
            endTime: currentSection.endTime,
            items: []
          };
          sections.push(currentSection);
        } else {
          currentSection.category = rowText;
        }
        continue;
      }
    }
    
    if (!currentSection) {
      if (rowText.match(/\d{1,2}\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i)) {
        const simpleMatch = rowText.match(/(\d{1,2})\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s*(\d{4})?/i);
        if (simpleMatch) {
          const day = simpleMatch[1];
          const month = simpleMatch[2];
          const year = simpleMatch[3] || new Date().getFullYear().toString();
          const monthNum = months[month.toLowerCase().substring(0, 3)];
          const dateStr = `${year}-${monthNum}-${day.padStart(2, '0')}`;
          
          currentSection = {
            originalHeading: rowText,
            eventName: 'Imported Event',
            category: 'General',
            date: dateStr,
            startTime: null,
            endTime: null,
            items: []
          };
          sections.push(currentSection);
        }
      }
      continue;
    }
    
    if (row.length >= 2) {
      const firstCell = row[0]?.trim() || '';
      const slNoMatch = firstCell.match(/^(\d+)\.?$/);
      
      if (slNoMatch) {
        const slNo = parseInt(slNoMatch[1]);
        
        let description = '';
        let quantity: number = 1;
        
        const numericCells: { index: number; value: number; raw: string; hasUnit: boolean }[] = [];
        for (let i = 1; i < row.length; i++) {
          const cell = row[i]?.trim() || '';
          if (cell.startsWith('₹')) continue;
          
          const pureNumMatch = cell.replace(/,/g, '').match(/^(\d+(?:\.\d+)?)$/);
          if (pureNumMatch) {
            const val = parseFloat(pureNumMatch[1]);
            numericCells.push({ index: i, value: val, raw: cell, hasUnit: false });
            continue;
          }
          
          const numWithUnitMatch = cell.replace(/,/g, '').match(/^(\d+(?:\.\d+)?)\s*(nos?|no\.?|pcs?|set|sets|mtr|mtrs?|meters?|units?|bundles?|pairs?|bags?|boxes?)$/i);
          if (numWithUnitMatch) {
            const val = parseFloat(numWithUnitMatch[1]);
            numericCells.push({ index: i, value: val, raw: cell, hasUnit: true });
          }
        }
        
        const cellWithUnit = numericCells.find(nc => nc.hasUnit);
        if (cellWithUnit) {
          quantity = cellWithUnit.value;
        } else if (numericCells.length >= 3) {
          quantity = numericCells[0].value;
        } else if (numericCells.length >= 1) {
          quantity = numericCells[0].value;
        }
        
        const skipIndices = new Set<number>();
        for (const nc of numericCells) {
          skipIndices.add(nc.index);
        }
        
        for (let i = 1; i < row.length; i++) {
          if (skipIndices.has(i)) continue;
          const cell = row[i]?.trim() || '';
          if (cell.startsWith('₹')) continue;
          if (cell && cell.length > 0) {
            description += (description ? ' ' : '') + cell;
          }
        }
        
        if (description && quantity > 0) {
          currentSection.items.push({
            slNo,
            description: description.trim(),
            quantity: quantity
          });
        }
      }
    }
  }
  
  if (sections.length === 0) {
    sections.push({
      originalHeading: 'Imported Items',
      eventName: 'Imported Event',
      category: 'General',
      date: null,
      startTime: null,
      endTime: null,
      items: []
    });
  }
  
  return { sections, rawLines: rows.map(r => r.join(' | ')) };
}

function normalizeTime(time: string): string {
  time = time.replace('.', ':').trim();
  const match = time.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)?/i);
  if (!match) return time;
  
  let hours = parseInt(match[1]);
  const minutes = match[2] || '00';
  const period = match[3]?.toUpperCase();
  
  if (period === 'PM' && hours < 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  
  return `${hours.toString().padStart(2, '0')}:${minutes}`;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Trust proxy for production (Replit uses reverse proxy)
  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }
  
  // Session middleware
  app.use(
    session({
      store: new PgSession({
        pool,
        tableName: 'session',
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || 'oak-event-secret-key-change-in-production',
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax',
      },
    })
  );

  // Health check endpoint for debugging
  app.get('/api/health', async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const roles = await storage.getAllRoles();
      
      // Also check session
      const sessionUserId = (req.session as any)?.userId;
      let sessionUser = null;
      if (sessionUserId) {
        sessionUser = await storage.getUser(sessionUserId);
      }
      
      res.json({
        status: 'ok',
        database: 'connected',
        userCount: users.length,
        roleCount: roles.length,
        sessionUserId: sessionUserId || null,
        sessionUserEmail: sessionUser?.email || null,
        sessionUserRole: sessionUser?.role || null,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('[/api/health] Database error:', error?.message);
      res.status(500).json({
        status: 'error',
        database: 'error',
        error: error?.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // All available pages for admin/superadmin
  const ALL_PAGES = [
    'dashboard',
    'sales',
    'sales-leads',
    'sales-pipeline',
    'sales-estimates',
    'sales-reports',
    'sales-settings',
    'event-hub',
    'event-calendar',
    'event-milestones',
    'operations',
    'ops-items',
    'ops-purchase-orders',
    'ops-templates',
    'ops-event-inventory',
    'ops-rentals',
    'ops-production',
    'ops-execution',
    'ops-transportation',
    'ops-manpower',
    'finance',
    'finance-masters',
    'finance-customers',
    'finance-vendors',
    'finance-estimates',
    'finance-invoices',
    'finance-payments',
    'finance-reports',
    'finance-settings',
    'people',
    'hr',
    'employee-portal',
    'team-calendar',
    'tools',
    'whatsapp-inbox',
    'oak-rsvp',
    'oaksy',
    'oak-creative',
    'management-mis',
    'mis-overview',
    'event-database',
    'mis-financial',
    'mis-sales',
    'mis-operations',
    'daybook',
    'execution-plan',
    'admin',
  ];

  // Auth endpoints
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await storage.getUserByEmail(email);
      
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Admin and superadmin get all pages automatically
      let permissionsList: string[];
      if (user.role === 'admin' || user.role === 'superadmin') {
        permissionsList = ALL_PAGES;
      } else {
        const permissions = await storage.getUserPermissions(user.id);
        permissionsList = permissions.map(p => p.pageId);
      }
      
      (req.session as any).userId = user.id;
      
      res.json({ 
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          createdVia: user.createdVia,
        },
        permissions: permissionsList
      });
    } catch (error) {
      res.status(500).json({ error: 'Login failed' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
      // Clear the session cookie explicitly
      res.clearCookie('connect.sid', {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });
      res.json({ success: true });
    });
  });

  app.get('/api/auth/me', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Admin and superadmin get all pages automatically
    let permissionsList: string[];
    if (user.role === 'admin' || user.role === 'superadmin') {
      permissionsList = ALL_PAGES;
    } else {
      const permissions = await storage.getUserPermissions(user.id);
      permissionsList = permissions.map(p => p.pageId);
    }

    res.json({ 
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        createdVia: user.createdVia,
      },
      permissions: permissionsList
    });
  });

  // Password change endpoint
  app.post('/api/auth/change-password', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }
    
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await storage.updateUser(userId, { password: hashedNewPassword });
    
    res.json({ success: true, message: 'Password changed successfully' });
  });

  // Helper function to verify admin/superadmin access
  const verifyAdminAccess = async (req: any, res: any): Promise<{ user: any } | null> => {
    const userId = (req.session as any).userId;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return null;
    }
    const user = await storage.getUser(userId);
    if (!user) {
      res.status(401).json({ error: 'Session expired' });
      return null;
    }
    if (user.role !== 'admin' && user.role !== 'superadmin') {
      res.status(403).json({ error: 'Admin access required' });
      return null;
    }
    return { user };
  };

  // Users
  app.get('/api/users', async (req, res) => {
    try {
      console.log('[/api/users] Starting request...');
      const auth = await verifyAdminAccess(req, res);
      if (!auth) {
        console.log('[/api/users] Auth failed');
        return;
      }
      console.log('[/api/users] Auth successful for:', auth.user.email);

      console.log('[/api/users] Fetching all users...');
      let users;
      try {
        users = await storage.getAllUsers();
      } catch (dbError: any) {
        console.error('[/api/users] Database error in getAllUsers:', dbError?.message);
        return res.status(500).json({ error: 'Database error fetching users', details: dbError?.message });
      }
      console.log(`[/api/users] Found ${users.length} users`);
      
      const usersWithPermissions = await Promise.all(
        users.map(async (user) => {
          try {
            const permissions = await storage.getUserPermissions(user.id);
            return {
              ...user,
              password: undefined,
              allowedPages: permissions.map(p => p.pageId),
            };
          } catch (permError: any) {
            console.error(`[/api/users] Error fetching permissions for user ${user.id}:`, permError?.message);
            return {
              ...user,
              password: undefined,
              allowedPages: [],
            };
          }
        })
      );
      res.json(usersWithPermissions);
    } catch (error: any) {
      console.error('[/api/users] Unexpected error:', error?.message || error);
      console.error('[/api/users] Stack:', error?.stack);
      res.status(500).json({ error: 'Failed to fetch users', details: error?.message });
    }
  });

  app.post('/api/users', async (req, res) => {
    try {
      const auth = await verifyAdminAccess(req, res);
      if (!auth) return;

      const data = insertUserSchema.parse(req.body);
      
      // Prevent non-superadmin from creating superadmin users
      if (data.role === 'superadmin' && auth.user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Only Super Admin can create Super Admin users' });
      }

      const hashedPassword = await bcrypt.hash(data.password, 10);
      const user = await storage.createUser({ ...data, password: hashedPassword, createdVia: 'admin_panel' });
      
      await storage.setUserPermissions(user.id, ['dashboard']);
      
      res.json({ ...user, password: undefined });
    } catch (error) {
      res.status(400).json({ error: 'Invalid user data' });
    }
  });

  app.patch('/api/users/:id/permissions', async (req, res) => {
    try {
      const auth = await verifyAdminAccess(req, res);
      if (!auth) return;

      const { id } = req.params;
      const targetUser = await storage.getUser(id);
      
      // Prevent modifying superadmin permissions if not superadmin
      if (targetUser?.role === 'superadmin' && auth.user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Cannot modify Super Admin permissions' });
      }

      const { pageIds } = req.body;
      await storage.setUserPermissions(id, pageIds);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: 'Failed to update permissions' });
    }
  });

  app.patch('/api/users/:id', async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      const currentUser = await storage.getUser(userId);
      if (!currentUser || currentUser.role !== 'superadmin') {
        return res.status(403).json({ error: 'Only Super Admin can change user roles' });
      }

      const { id } = req.params;
      const targetUser = await storage.getUser(id);
      
      // Prevent modifying superadmin users
      if (targetUser?.role === 'superadmin') {
        return res.status(403).json({ error: 'Cannot modify Super Admin users' });
      }

      const { role } = req.body;
      // Prevent promoting to superadmin
      if (role === 'superadmin') {
        return res.status(403).json({ error: 'Cannot promote users to Super Admin' });
      }

      const updated = await storage.updateUser(id, { role });
      if (!updated) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update user' });
    }
  });

  app.delete('/api/users/:id', async (req, res) => {
    try {
      const auth = await verifyAdminAccess(req, res);
      if (!auth) return;

      const targetUser = await storage.getUser(req.params.id);
      
      // Prevent deleting superadmin users
      if (targetUser?.role === 'superadmin') {
        return res.status(403).json({ error: 'Cannot delete Super Admin users' });
      }
      // Prevent deleting admin users if not superadmin
      if (targetUser?.role === 'admin' && auth.user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Only Super Admin can delete Admin users' });
      }

      // Delete related user permissions first
      await storage.setUserPermissions(req.params.id, []);
      
      await storage.deleteUser(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error('[User Delete Error]', error);
      res.status(400).json({ error: 'Failed to delete user' });
    }
  });

  // Roles
  app.get('/api/roles', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const roles = await storage.getAllRoles();
    res.json(roles);
  });

  app.post('/api/roles', async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      const user = await storage.getUser(userId);
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Only Super Admin can create roles' });
      }
      const data = insertRoleSchema.parse(req.body);
      const role = await storage.createRole(data);
      res.json(role);
    } catch (error) {
      res.status(400).json({ error: 'Invalid role data' });
    }
  });

  app.patch('/api/roles/:id', async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      const user = await storage.getUser(userId);
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Only Super Admin can update roles' });
      }
      const { label, description } = req.body;
      const role = await storage.updateRole(req.params.id, { label, description });
      if (!role) {
        return res.status(404).json({ error: 'Role not found' });
      }
      res.json(role);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update role' });
    }
  });

  app.delete('/api/roles/:id', async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      const user = await storage.getUser(userId);
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Only Super Admin can delete roles' });
      }
      const role = await storage.getRole(req.params.id);
      if (!role) {
        return res.status(404).json({ error: 'Role not found' });
      }
      if (role.isSystem) {
        return res.status(400).json({ error: 'Cannot delete system roles' });
      }
      await storage.deleteRole(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: 'Failed to delete role' });
    }
  });

  // Events
  app.get('/api/events', async (req, res) => {
    const events = await storage.getAllEvents();
    res.json(events);
  });

  app.post('/api/events', async (req, res) => {
    try {
      const data = insertEventSchema.parse(req.body);
      
      // Auto-generate event code (OAKS-E-YY-MM-XXX format)
      const eventCode = await generateEventCode();
      
      // Insert event with generated code
      const [event] = await db.insert(events)
        .values({ ...data, eventCode })
        .returning();
      
      console.log(`Created event ${event.title} with code ${eventCode}`);
      
      // Auto-generate milestones for events from Jan 1, 2026 onwards
      const eventDate = new Date(event.date);
      const cutoffDate = new Date('2026-01-01');
      
      if (eventDate >= cutoffDate) {
        try {
          const milestones = generateMilestonesForEvent(event.id, event.date, event.time);
          await storage.createManyMilestones(milestones);
          console.log(`Auto-generated ${milestones.length} milestones for event ${event.title}`);
          
          // Mark timeline as created
          await storage.updateEvent(event.id, { timelineCreated: true } as any);
          
          // Log automation success
          await storage.createAutomationLog({
            eventId: event.id,
            actionType: 'timeline_init',
            status: 'success',
            metadata: { milestonesCount: milestones.length, eventTitle: event.title }
          });
          
          console.log(`[Automation] Timeline created for event ${event.title}`);
        } catch (milestoneError) {
          console.error('Failed to auto-generate milestones:', milestoneError);
          // Log automation failure
          await storage.createAutomationLog({
            eventId: event.id,
            actionType: 'timeline_init',
            status: 'failed',
            metadata: { error: (milestoneError as Error).message }
          });
          // Don't fail the event creation if milestones fail
        }
      }
      
      res.json(event);
    } catch (error) {
      console.error('Error creating event:', error);
      res.status(400).json({ error: 'Invalid event data' });
    }
  });

  app.patch('/api/events/:id', async (req, res) => {
    try {
      // Remove eventCode from update payload - codes are read-only
      const { eventCode, ...updateData } = req.body;
      const event = await storage.updateEvent(req.params.id, updateData);
      res.json(event);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update event' });
    }
  });

  app.delete('/api/events/:id', async (req, res) => {
    await storage.deleteEvent(req.params.id);
    res.json({ success: true });
  });

  // Meetings
  app.get('/api/meetings', async (req, res) => {
    const { date } = req.query;
    if (date) {
      const meetings = await storage.getMeetingsByDate(date as string);
      res.json(meetings);
    } else {
      const meetings = await storage.getAllMeetings();
      res.json(meetings);
    }
  });

  app.get('/api/meetings/all', async (req, res) => {
    const meetings = await storage.getAllMeetings();
    res.json(meetings);
  });

  app.post('/api/meetings', async (req, res) => {
    try {
      const data = insertMeetingSchema.parse(req.body);
      const meeting = await storage.createMeeting(data);
      res.json(meeting);
    } catch (error) {
      res.status(400).json({ error: 'Invalid meeting data' });
    }
  });

  app.patch('/api/meetings/:id', async (req, res) => {
    try {
      const meeting = await storage.updateMeeting(req.params.id, req.body);
      res.json(meeting);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update meeting' });
    }
  });

  app.delete('/api/meetings/:id', async (req, res) => {
    await storage.deleteMeeting(req.params.id);
    res.json({ success: true });
  });

  // Employees
  app.get('/api/employees', async (req, res) => {
    const employees = await storage.getAllEmployees();
    res.json(employees);
  });

  app.post('/api/employees', async (req, res) => {
    try {
      const data = insertEmployeeSchema.parse(req.body);
      const employee = await storage.createEmployee(data);
      res.json(employee);
    } catch (error) {
      res.status(400).json({ error: 'Invalid employee data' });
    }
  });

  app.patch('/api/employees/:id', async (req, res) => {
    try {
      const employee = await storage.updateEmployee(req.params.id, req.body);
      res.json(employee);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update employee' });
    }
  });

  app.delete('/api/employees/:id', async (req, res) => {
    await storage.deleteEmployee(req.params.id);
    res.json({ success: true });
  });

  // Get employees without user accounts (for backfill)
  app.get('/api/employees/without-user-account', async (req, res) => {
    try {
      const employees = await storage.getEmployeesWithoutUserAccount();
      res.json(employees);
    } catch (error) {
      console.error('Error fetching employees without user account:', error);
      res.status(500).json({ error: 'Failed to fetch employees' });
    }
  });

  // Create employee with auto-generated credentials
  app.post('/api/employees/with-credentials', async (req, res) => {
    const auth = await verifyAdminAccess(req, res);
    if (!auth) return;
    
    try {
      // Make employeeId optional since it will be auto-generated
      const createEmployeeSchema = insertEmployeeSchema.extend({
        employeeId: insertEmployeeSchema.shape.employeeId.optional(),
      });
      const data = createEmployeeSchema.parse(req.body);
      
      // Generate employee code if not provided
      const employeeId = data.employeeId || await storage.generateEmployeeCode();
      
      // Generate a temporary password
      const tempPassword = storage.generateTemporaryPassword();
      const hashedPassword = await bcrypt.hash(tempPassword, 10);
      
      // Ensure email is provided or generate one
      const email = data.email || `${employeeId.toLowerCase().replace(/[^a-z0-9]/g, '')}@oak.local`;
      
      const result = await storage.createEmployeeWithUser(
        { ...data, employeeId, email },
        hashedPassword
      );
      
      // Grant employee-portal permission to the new user
      await storage.grantUserPermission(result.user.id, 'employee-portal');
      
      // Return employee with credentials (only shown once to admin)
      res.json({
        employee: result.employee,
        user: result.user,
        credentials: {
          employeeId: result.employee.employeeId,
          email: email,
          temporaryPassword: tempPassword
        }
      });
    } catch (error: any) {
      console.error('Error creating employee with credentials:', error);
      // Provide more specific error messages
      if (error.code === '23505') {
        // Unique constraint violation
        if (error.constraint?.includes('email')) {
          res.status(400).json({ error: 'An account with this email already exists.' });
        } else if (error.constraint?.includes('employee_id')) {
          res.status(400).json({ error: 'This employee ID already exists. Please try again.' });
        } else {
          res.status(400).json({ error: 'A duplicate record exists. Please try different values.' });
        }
      } else if (error.message) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(400).json({ error: 'Failed to create employee. Please try again.' });
      }
    }
  });

  // Backfill single employee with user account
  app.post('/api/employees/:id/create-user-account', async (req, res) => {
    try {
      const employeeId = req.params.id;
      
      // Get the employee first
      const employee = await storage.getEmployee(employeeId);
      if (!employee) {
        return res.status(404).json({ error: 'Employee not found' });
      }
      
      if (employee.userId) {
        return res.status(400).json({ error: 'Employee already has a user account' });
      }
      
      // Generate temporary password
      const tempPassword = storage.generateTemporaryPassword();
      const hashedPassword = await bcrypt.hash(tempPassword, 10);
      
      // Create email if not exists
      const email = employee.email || `${employee.employeeId.toLowerCase().replace(/[^a-z0-9]/g, '')}@oak.local`;
      
      // Create user account
      const user = await storage.createUser({
        name: employee.name,
        email: email,
        password: hashedPassword,
        role: 'employee',
        createdVia: 'employee_onboarding'
      });
      
      // Grant employee-portal permission
      await storage.grantUserPermission(user.id, 'employee-portal');
      
      // Link employee to user
      const updatedEmployee = await storage.updateEmployee(employeeId, {
        userId: user.id,
        email: email
      });
      
      res.json({
        employee: updatedEmployee,
        user: user,
        credentials: {
          employeeId: employee.employeeId,
          email: email,
          temporaryPassword: tempPassword
        }
      });
    } catch (error) {
      console.error('Error creating user account for employee:', error);
      res.status(400).json({ error: 'Failed to create user account. Email may already be in use.' });
    }
  });

  // Bulk backfill all employees without user accounts
  app.post('/api/employees/backfill-user-accounts', async (req, res) => {
    try {
      const employeesWithoutUsers = await storage.getEmployeesWithoutUserAccount();
      const results: Array<{
        employee: any;
        credentials: { employeeId: string; email: string; temporaryPassword: string };
      }> = [];
      const errors: Array<{ employeeId: string; name: string; error: string }> = [];
      
      for (const emp of employeesWithoutUsers) {
        try {
          const tempPassword = storage.generateTemporaryPassword();
          const hashedPassword = await bcrypt.hash(tempPassword, 10);
          const email = emp.email || `${emp.employeeId.toLowerCase().replace(/[^a-z0-9]/g, '')}@oak.local`;
          
          // Create user
          const user = await storage.createUser({
            name: emp.name,
            email: email,
            password: hashedPassword,
            role: 'employee',
            createdVia: 'employee_onboarding'
          });
          
          // Grant employee-portal permission
          await storage.grantUserPermission(user.id, 'employee-portal');
          
          // Link to employee
          const updatedEmployee = await storage.updateEmployee(emp.id, {
            userId: user.id,
            email: email
          });
          
          results.push({
            employee: updatedEmployee,
            credentials: {
              employeeId: emp.employeeId,
              email: email,
              temporaryPassword: tempPassword
            }
          });
        } catch (err) {
          errors.push({
            employeeId: emp.employeeId,
            name: emp.name,
            error: err instanceof Error ? err.message : 'Unknown error'
          });
        }
      }
      
      res.json({
        success: true,
        created: results.length,
        failed: errors.length,
        results,
        errors
      });
    } catch (error) {
      console.error('Error backfilling user accounts:', error);
      res.status(500).json({ error: 'Failed to backfill user accounts' });
    }
  });

  // Daybook
  app.get('/api/daybook', async (req, res) => {
    const { startDate, endDate } = req.query;
    if (startDate && endDate) {
      const entries = await storage.getDaybookEntriesByDateRange(startDate as string, endDate as string);
      res.json(entries);
    } else {
      const entries = await storage.getAllDaybookEntries();
      res.json(entries);
    }
  });

  app.post('/api/daybook', async (req, res) => {
    try {
      const data = insertDaybookEntrySchema.parse(req.body);
      // Use event sync to automatically update event paymentReceived/cost
      const entry = await storage.createDaybookEntryWithEventSync(data);
      if (entry.bankId) {
        const bank = await storage.getBank(entry.bankId);
        if (bank) {
          const adjustment = entry.type === 'income' 
            ? parseFloat(bank.balance) + parseFloat(entry.amount)
            : parseFloat(bank.balance) - parseFloat(entry.amount);
          await storage.updateBank(bank.id, { balance: adjustment.toString() });
        }
      }
      res.json(entry);
    } catch (error) {
      res.status(400).json({ error: 'Invalid daybook entry' });
    }
  });

  app.patch('/api/daybook/:id', async (req, res) => {
    try {
      const oldEntry = await storage.getDaybookEntry(req.params.id);
      if (!oldEntry) {
        return res.status(404).json({ error: 'Entry not found' });
      }
      
      const updateData = req.body;
      const newAmount = updateData.amount ? parseFloat(updateData.amount) : parseFloat(oldEntry.amount);
      const oldAmount = parseFloat(oldEntry.amount);
      const newBankId = updateData.bankId !== undefined ? updateData.bankId : oldEntry.bankId;
      const newEventId = updateData.eventId !== undefined ? updateData.eventId : oldEntry.eventId;
      const newType = updateData.type || oldEntry.type;
      
      // Handle bank balance reconciliation
      // First, reverse the old bank adjustment
      if (oldEntry.bankId) {
        const oldBank = await storage.getBank(oldEntry.bankId);
        if (oldBank) {
          const reverseAdjustment = oldEntry.type === 'income'
            ? parseFloat(oldBank.balance) - oldAmount
            : parseFloat(oldBank.balance) + oldAmount;
          await storage.updateBank(oldBank.id, { balance: reverseAdjustment.toString() });
        }
      }
      
      // Then apply the new bank adjustment
      if (newBankId) {
        const newBank = await storage.getBank(newBankId);
        if (newBank) {
          const newAdjustment = newType === 'income'
            ? parseFloat(newBank.balance) + newAmount
            : parseFloat(newBank.balance) - newAmount;
          await storage.updateBank(newBank.id, { balance: newAdjustment.toString() });
        }
      }
      
      // Handle event sync reconciliation
      // First, reverse the old event adjustment
      if (oldEntry.eventId) {
        const oldEvent = await storage.getEvent(oldEntry.eventId);
        if (oldEvent) {
          if (oldEntry.type === 'income') {
            const newPaymentReceived = Math.max(0, parseFloat(oldEvent.paymentReceived) - oldAmount);
            await storage.updateEvent(oldEntry.eventId, { paymentReceived: newPaymentReceived.toFixed(2) });
          } else {
            const newCost = Math.max(0, parseFloat(oldEvent.cost) - oldAmount);
            await storage.updateEvent(oldEntry.eventId, { cost: newCost.toFixed(2) });
          }
        }
      }
      
      // Then apply the new event adjustment
      if (newEventId) {
        const newEvent = await storage.getEvent(newEventId);
        if (newEvent) {
          if (newType === 'income') {
            const newPaymentReceived = parseFloat(newEvent.paymentReceived) + newAmount;
            await storage.updateEvent(newEventId, { paymentReceived: newPaymentReceived.toFixed(2) });
          } else {
            const newCost = parseFloat(newEvent.cost) + newAmount;
            await storage.updateEvent(newEventId, { cost: newCost.toFixed(2) });
          }
        }
      }
      
      const entry = await storage.updateDaybookEntry(req.params.id, updateData);
      res.json(entry);
    } catch (error) {
      console.error('Failed to update daybook entry:', error);
      res.status(400).json({ error: 'Failed to update entry' });
    }
  });

  app.delete('/api/daybook/:id', async (req, res) => {
    const entry = await storage.getDaybookEntry(req.params.id);
    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    
    // Reverse bank balance adjustment
    if (entry.bankId) {
      const bank = await storage.getBank(entry.bankId);
      if (bank) {
        const adjustment = entry.type === 'income' 
          ? parseFloat(bank.balance) - parseFloat(entry.amount)
          : parseFloat(bank.balance) + parseFloat(entry.amount);
        await storage.updateBank(bank.id, { balance: adjustment.toString() });
      }
    }
    
    // Reverse event sync - subtract from event's paymentReceived or cost
    if (entry.eventId) {
      const event = await storage.getEvent(entry.eventId);
      if (event) {
        const amount = parseFloat(entry.amount);
        if (entry.type === 'income') {
          const newPaymentReceived = Math.max(0, parseFloat(event.paymentReceived) - amount);
          await storage.updateEvent(entry.eventId, { paymentReceived: newPaymentReceived.toFixed(2) });
        } else {
          const newCost = Math.max(0, parseFloat(event.cost) - amount);
          await storage.updateEvent(entry.eventId, { cost: newCost.toFixed(2) });
        }
      }
    }
    
    await storage.deleteDaybookEntry(req.params.id);
    res.json({ success: true });
  });

  // Transaction Scanner - AI-powered transaction screenshot parsing
  app.post('/api/daybook/scan-transaction', async (req, res) => {
    try {
      const { image } = req.body;
      
      if (!image) {
        return res.status(400).json({ error: 'Image data is required' });
      }
      
      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ error: 'OpenAI API key not configured' });
      }
      
      const parsed = await parseTransactionScreenshot(image);
      res.json(parsed);
    } catch (error) {
      console.error('Transaction scan error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to parse transaction' 
      });
    }
  });

  // Daybook Categories
  app.get('/api/daybook-categories', async (req, res) => {
    const { type } = req.query;
    if (type) {
      const categories = await storage.getDaybookCategoriesByType(type as string);
      res.json(categories);
    } else {
      const categories = await storage.getAllDaybookCategories();
      res.json(categories);
    }
  });

  app.post('/api/daybook-categories', async (req, res) => {
    try {
      const { name, type } = req.body;
      if (!name || !type) {
        return res.status(400).json({ error: 'Name and type are required' });
      }
      const category = await storage.createDaybookCategory({ name, type, isSystem: false });
      res.json(category);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create category' });
    }
  });

  app.patch('/api/daybook-categories/:id', async (req, res) => {
    try {
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }
      const category = await storage.updateDaybookCategory(req.params.id, { name });
      res.json(category);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update category' });
    }
  });

  app.delete('/api/daybook-categories/:id', async (req, res) => {
    await storage.deleteDaybookCategory(req.params.id);
    res.json({ success: true });
  });

  // Banks
  app.get('/api/banks', async (req, res) => {
    const banks = await storage.getAllBanks();
    res.json(banks);
  });

  app.post('/api/banks', async (req, res) => {
    try {
      const data = insertBankSchema.parse(req.body);
      const bank = await storage.createBank(data);
      res.json(bank);
    } catch (error) {
      res.status(400).json({ error: 'Invalid bank data' });
    }
  });

  app.patch('/api/banks/:id', async (req, res) => {
    try {
      const bank = await storage.updateBank(req.params.id, req.body);
      res.json(bank);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update bank' });
    }
  });

  app.delete('/api/banks/:id', async (req, res) => {
    await storage.deleteBank(req.params.id);
    res.json({ success: true });
  });

  // Bank Transfers
  app.get('/api/bank-transfers', async (req, res) => {
    const { startDate, endDate, date } = req.query;
    if (date) {
      const transfers = await storage.getBankTransfersByDate(date as string);
      res.json(transfers);
    } else if (startDate && endDate) {
      const transfers = await storage.getBankTransfersByDateRange(startDate as string, endDate as string);
      res.json(transfers);
    } else {
      const transfers = await storage.getAllBankTransfers();
      res.json(transfers);
    }
  });

  app.post('/api/bank-transfers', async (req, res) => {
    try {
      const transfer = await storage.createBankTransfer(req.body);
      const fromBank = await storage.getBank(transfer.fromBankId);
      const toBank = await storage.getBank(transfer.toBankId);
      if (fromBank) {
        const newFromBalance = (parseFloat(fromBank.balance) - parseFloat(transfer.amount)).toString();
        await storage.updateBank(fromBank.id, { balance: newFromBalance });
      }
      if (toBank) {
        const newToBalance = (parseFloat(toBank.balance) + parseFloat(transfer.amount)).toString();
        await storage.updateBank(toBank.id, { balance: newToBalance });
      }
      res.json(transfer);
    } catch (error) {
      res.status(400).json({ error: 'Invalid bank transfer data' });
    }
  });

  app.patch('/api/bank-transfers/:id', async (req, res) => {
    try {
      const transfer = await storage.getBankTransfer(req.params.id);
      if (!transfer) {
        return res.status(404).json({ error: 'Transfer not found' });
      }
      
      const { amount, description } = req.body;
      const amountDiff = parseFloat(amount) - parseFloat(transfer.amount);
      
      if (amountDiff !== 0) {
        const fromBank = await storage.getBank(transfer.fromBankId);
        const toBank = await storage.getBank(transfer.toBankId);
        if (fromBank) {
          const newFromBalance = (parseFloat(fromBank.balance) - amountDiff).toString();
          await storage.updateBank(fromBank.id, { balance: newFromBalance });
        }
        if (toBank) {
          const newToBalance = (parseFloat(toBank.balance) + amountDiff).toString();
          await storage.updateBank(toBank.id, { balance: newToBalance });
        }
      }
      
      const updated = await storage.updateBankTransfer(req.params.id, { amount, description });
      res.json(updated);
    } catch (error) {
      console.error('Error updating bank transfer:', error);
      res.status(500).json({ error: 'Failed to update transfer' });
    }
  });

  app.delete('/api/bank-transfers/:id', async (req, res) => {
    const transfer = await storage.getBankTransfer(req.params.id);
    if (transfer) {
      const fromBank = await storage.getBank(transfer.fromBankId);
      const toBank = await storage.getBank(transfer.toBankId);
      if (fromBank) {
        const newFromBalance = (parseFloat(fromBank.balance) + parseFloat(transfer.amount)).toString();
        await storage.updateBank(fromBank.id, { balance: newFromBalance });
      }
      if (toBank) {
        const newToBalance = (parseFloat(toBank.balance) - parseFloat(transfer.amount)).toString();
        await storage.updateBank(toBank.id, { balance: newToBalance });
      }
    }
    await storage.deleteBankTransfer(req.params.id);
    res.json({ success: true });
  });

  // Pending Vendor Payments
  app.get('/api/pending-vendor-payments', async (req, res) => {
    try {
      const { status } = req.query;
      if (status) {
        const payments = await storage.getPendingVendorPaymentsByStatus(status as string);
        res.json(payments);
      } else {
        const payments = await storage.getAllPendingVendorPayments();
        res.json(payments);
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch pending vendor payments' });
    }
  });

  app.patch('/api/pending-vendor-payments/:id', async (req, res) => {
    try {
      const payment = await storage.updatePendingVendorPayment(req.params.id, req.body);
      res.json(payment);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update pending vendor payment' });
    }
  });

  app.delete('/api/pending-vendor-payments/:id', async (req, res) => {
    try {
      // Only superadmin can delete
      const userRole = (req.session as any).userRole;
      if (userRole !== 'superadmin') {
        return res.status(403).json({ error: 'Only superadmin can delete pending vendor payments' });
      }
      await storage.deletePendingVendorPayment(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete pending vendor payment' });
    }
  });

  // Delivery Challans
  app.get('/api/delivery-challans', async (req, res) => {
    try {
      const challans = await storage.getAllDeliveryChallans();
      res.json(challans);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch delivery challans' });
    }
  });

  app.get('/api/delivery-challans/next-number', async (req, res) => {
    try {
      const nextNumber = await storage.generateDeliveryChallanNumber();
      res.json({ nextNumber });
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate next challan number' });
    }
  });

  app.get('/api/delivery-challans/:id', async (req, res) => {
    try {
      const challan = await storage.getDeliveryChallan(req.params.id);
      if (!challan) {
        return res.status(404).json({ error: 'Delivery challan not found' });
      }
      res.json(challan);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch delivery challan' });
    }
  });

  app.post('/api/delivery-challans', async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const challanNumber = await storage.generateDeliveryChallanNumber();
      const data = {
        ...req.body,
        challanNumber,
        createdBy: userId || null,
      };
      const challan = await storage.createDeliveryChallan(data);
      res.json(challan);
    } catch (error: any) {
      console.error('Error creating delivery challan:', error);
      res.status(400).json({ error: error.message || 'Failed to create delivery challan' });
    }
  });

  app.patch('/api/delivery-challans/:id', async (req, res) => {
    try {
      const challan = await storage.updateDeliveryChallan(req.params.id, req.body);
      if (!challan) {
        return res.status(404).json({ error: 'Delivery challan not found' });
      }
      res.json(challan);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update delivery challan' });
    }
  });

  app.delete('/api/delivery-challans/:id', async (req, res) => {
    try {
      await storage.deleteDeliveryChallan(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete delivery challan' });
    }
  });

  // Oak RSVP - Event Guests
  app.get('/api/event-guests', async (req, res) => {
    try {
      const { eventId } = req.query;
      if (eventId) {
        const guests = await storage.getEventGuestsByEvent(eventId as string);
        res.json(guests);
      } else {
        const guests = await storage.getAllEventGuests();
        res.json(guests);
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to get event guests' });
    }
  });

  app.get('/api/event-guests/:id', async (req, res) => {
    try {
      const guest = await storage.getEventGuest(req.params.id);
      if (!guest) {
        return res.status(404).json({ error: 'Guest not found' });
      }
      res.json(guest);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get guest' });
    }
  });

  app.post('/api/event-guests', async (req, res) => {
    try {
      const guest = await storage.createEventGuest(req.body);
      res.json(guest);
    } catch (error: any) {
      console.error('Error creating event guest:', error);
      res.status(400).json({ error: error.message || 'Failed to create guest' });
    }
  });

  app.post('/api/event-guests/bulk', async (req, res) => {
    try {
      const { guests } = req.body;
      if (!Array.isArray(guests)) {
        return res.status(400).json({ error: 'Guests must be an array' });
      }
      const created = await storage.bulkCreateEventGuests(guests);
      res.json(created);
    } catch (error: any) {
      console.error('Error bulk creating guests:', error);
      res.status(400).json({ error: error.message || 'Failed to create guests' });
    }
  });

  app.patch('/api/event-guests/:id', async (req, res) => {
    try {
      const guest = await storage.updateEventGuest(req.params.id, req.body);
      if (!guest) {
        return res.status(404).json({ error: 'Guest not found' });
      }
      res.json(guest);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update guest' });
    }
  });

  app.delete('/api/event-guests/:id', async (req, res) => {
    try {
      await storage.deleteEventGuest(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete guest' });
    }
  });

  // Oak RSVP - RSVP Responses
  app.get('/api/rsvp-responses', async (req, res) => {
    try {
      const { eventId, guestId } = req.query;
      if (eventId) {
        const responses = await storage.getRsvpResponsesByEvent(eventId as string);
        res.json(responses);
      } else if (guestId) {
        const response = await storage.getRsvpResponseByGuest(guestId as string);
        res.json(response ? [response] : []);
      } else {
        const responses = await storage.getAllRsvpResponses();
        res.json(responses);
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to get RSVP responses' });
    }
  });

  app.get('/api/rsvp-responses/:id', async (req, res) => {
    try {
      const response = await storage.getRsvpResponse(req.params.id);
      if (!response) {
        return res.status(404).json({ error: 'RSVP response not found' });
      }
      res.json(response);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get RSVP response' });
    }
  });

  app.get('/api/rsvp-stats/:eventId', async (req, res) => {
    try {
      const stats = await storage.getRsvpStatsByEvent(req.params.eventId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get RSVP stats' });
    }
  });

  app.post('/api/rsvp-responses', async (req, res) => {
    try {
      const response = await storage.createRsvpResponse(req.body);
      res.json(response);
    } catch (error: any) {
      console.error('Error creating RSVP response:', error);
      res.status(400).json({ error: error.message || 'Failed to create RSVP response' });
    }
  });

  app.patch('/api/rsvp-responses/:id', async (req, res) => {
    try {
      const response = await storage.updateRsvpResponse(req.params.id, req.body);
      if (!response) {
        return res.status(404).json({ error: 'RSVP response not found' });
      }
      res.json(response);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update RSVP response' });
    }
  });

  app.delete('/api/rsvp-responses/:id', async (req, res) => {
    try {
      await storage.deleteRsvpResponse(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete RSVP response' });
    }
  });

  // Seed demo RSVP event
  app.post('/api/seed-demo-rsvp', async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      const user = await storage.getUser(userId);
      if (user?.role !== 'superadmin') {
        return res.status(403).json({ error: 'Only superadmin can create demo data' });
      }

      // Check if demo event already exists
      const existingEvents = await storage.getEvents();
      const demoEvent = existingEvents.find(e => 
        e.title === 'Vandana Wedding' && e.venue === 'Kumarakom'
      );
      if (demoEvent) {
        return res.json({ message: 'Demo event already exists', eventId: demoEvent.id });
      }

      // Create the event
      const event = await storage.createEvent({
        title: 'Vandana Wedding',
        customer: 'Vandana & Arjun',
        date: '2026-03-15',
        time: '18:00',
        venue: 'Kumarakom',
        venueAddress: 'Kumarakom Lake Resort, Kumarakom, Kerala',
        description: 'Grand wedding celebration',
        status: 'confirmed',
        category: 'wedding',
      });

      // 49 realistic Indian guest names with varied details
      const guestData = [
        { name: 'Priya Nair', phone: '+919876543201', relationship: 'Bride Family', group: "Bride's Side" },
        { name: 'Rajesh Menon', phone: '+919876543202', relationship: 'Groom Family', group: "Groom's Side" },
        { name: 'Lakshmi Iyer', phone: '+919876543203', relationship: 'Aunt', group: "Bride's Side" },
        { name: 'Suresh Kumar', phone: '+919876543204', relationship: 'Uncle', group: "Groom's Side" },
        { name: 'Anjali Varma', phone: '+919876543205', relationship: 'Cousin', group: "Bride's Side" },
        { name: 'Vikram Pillai', phone: '+919876543206', relationship: 'Friend', group: 'Friends' },
        { name: 'Deepa Krishnan', phone: '+919876543207', relationship: 'Colleague', group: 'Colleagues' },
        { name: 'Arun Nambiar', phone: '+919876543208', relationship: 'Brother', group: "Groom's Side" },
        { name: 'Meera Shenoy', phone: '+919876543209', relationship: 'Sister', group: "Bride's Side" },
        { name: 'Karthik Rajan', phone: '+919876543210', relationship: 'Best Friend', group: 'Friends' },
        { name: 'Divya Panicker', phone: '+919876543211', relationship: 'College Friend', group: 'Friends' },
        { name: 'Ramesh Warrier', phone: '+919876543212', relationship: 'Father Friend', group: 'Family Friends' },
        { name: 'Sunita Balakrishnan', phone: '+919876543213', relationship: 'Mother Friend', group: 'Family Friends' },
        { name: 'Gopal Krishnan', phone: '+919876543214', relationship: 'Grandfather', group: "Bride's Side" },
        { name: 'Kamala Devi', phone: '+919876543215', relationship: 'Grandmother', group: "Groom's Side" },
        { name: 'Nikhil Thomas', phone: '+919876543216', relationship: 'Neighbor', group: 'Neighbors' },
        { name: 'Shalini Mathew', phone: '+919876543217', relationship: 'Colleague', group: 'Colleagues' },
        { name: 'Ajay Menon', phone: '+919876543218', relationship: 'Cousin', group: "Groom's Side" },
        { name: 'Rekha Nair', phone: '+919876543219', relationship: 'Aunt', group: "Bride's Side" },
        { name: 'Prasad Kurup', phone: '+919876543220', relationship: 'Uncle', group: "Groom's Side" },
        { name: 'Smitha Raj', phone: '+919876543221', relationship: 'School Friend', group: 'Friends' },
        { name: 'Biju Varghese', phone: '+919876543222', relationship: 'Family Friend', group: 'Family Friends' },
        { name: 'Leela Menon', phone: '+919876543223', relationship: 'Great Aunt', group: "Bride's Side" },
        { name: 'Mohan Das', phone: '+919876543224', relationship: 'Great Uncle', group: "Groom's Side" },
        { name: 'Anitha Pillai', phone: '+919876543225', relationship: 'Sister-in-law', group: "Groom's Side" },
        { name: 'Sanjay Namboodiri', phone: '+919876543226', relationship: 'Brother-in-law', group: "Bride's Side" },
        { name: 'Renu Kaimal', phone: '+919876543227', relationship: 'Cousin', group: "Bride's Side" },
        { name: 'Vinod Achari', phone: '+919876543228', relationship: 'Vendor Friend', group: 'Business' },
        { name: 'Geetha Raman', phone: '+919876543229', relationship: 'Family Doctor', group: 'Family Friends' },
        { name: 'Murali Krishnan', phone: '+919876543230', relationship: 'Childhood Friend', group: 'Friends' },
        { name: 'Padma Suresh', phone: '+919876543231', relationship: 'Mother Friend', group: 'Family Friends' },
        { name: 'Harish Nair', phone: '+919876543232', relationship: 'Cousin', group: "Groom's Side" },
        { name: 'Jyothi Warrier', phone: '+919876543233', relationship: 'Aunt', group: "Bride's Side" },
        { name: 'Satheesh Kumar', phone: '+919876543234', relationship: 'Uncle', group: "Groom's Side" },
        { name: 'Rani Menon', phone: '+919876543235', relationship: 'Neighbor', group: 'Neighbors' },
        { name: 'Praveen Nambiar', phone: '+919876543236', relationship: 'Work Colleague', group: 'Colleagues' },
        { name: 'Maya Pillai', phone: '+919876543237', relationship: 'College Friend', group: 'Friends' },
        { name: 'Sunil Varma', phone: '+919876543238', relationship: 'Family Friend', group: 'Family Friends' },
        { name: 'Radha Krishnan', phone: '+919876543239', relationship: 'Cousin', group: "Bride's Side" },
        { name: 'Shaji Thomas', phone: '+919876543240', relationship: 'Business Partner', group: 'Business' },
        { name: 'Usha Nair', phone: '+919876543241', relationship: 'Teacher', group: 'Family Friends' },
        { name: 'Jayakumar Menon', phone: '+919876543242', relationship: 'Father Colleague', group: 'Family Friends' },
        { name: 'Beena Rajan', phone: '+919876543243', relationship: 'Mother Colleague', group: 'Family Friends' },
        { name: 'Raghunath Pillai', phone: '+919876543244', relationship: 'Uncle', group: "Groom's Side" },
        { name: 'Saritha Das', phone: '+919876543245', relationship: 'Aunt', group: "Bride's Side" },
        { name: 'Manoj Kumar', phone: '+919876543246', relationship: 'Cousin', group: "Groom's Side" },
        { name: 'Latha Namboodiri', phone: '+919876543247', relationship: 'Family Priest', group: 'VIP' },
        { name: 'Venu Gopal', phone: '+919876543248', relationship: 'Photographer', group: 'Vendors' },
        { name: 'Bindu Menon', phone: '+919876543249', relationship: 'Event Planner', group: 'Vendors' },
      ];

      // Response configurations - varied statuses
      const statusDistribution = [
        { status: 'yes', count: 28 },   // 28 confirmed
        { status: 'pending', count: 12 }, // 12 pending
        { status: 'maybe', count: 5 },    // 5 maybe
        { status: 'no', count: 4 },       // 4 declined
      ];

      const mealOptions = ['vegetarian', 'non-vegetarian', 'vegan'];

      let guestIndex = 0;
      for (const guest of guestData) {
        const createdGuest = await storage.createEventGuest({
          eventId: event.id,
          name: guest.name,
          phone: guest.phone,
          email: guest.name.toLowerCase().replace(' ', '.') + '@example.com',
          relationship: guest.relationship,
          guestGroup: guest.group,
          maxAttendees: Math.floor(Math.random() * 3) + 1,
          reminderCount: 0,
        });

        // Determine status based on distribution
        let status = 'pending';
        if (guestIndex < 28) status = 'yes';
        else if (guestIndex < 40) status = 'pending';
        else if (guestIndex < 45) status = 'maybe';
        else status = 'no';

        if (status !== 'pending') {
          const numberOfAttendees = status === 'yes' ? Math.floor(Math.random() * 3) + 1 : 1;
          await storage.createRsvpResponse({
            guestId: createdGuest.id,
            eventId: event.id,
            attendanceStatus: status,
            numberOfAttendees,
            mealPreference: mealOptions[Math.floor(Math.random() * mealOptions.length)],
            needsAccommodation: status === 'yes' && Math.random() > 0.6,
            accommodationNights: status === 'yes' ? Math.floor(Math.random() * 3) + 1 : undefined,
            needsTransportation: status === 'yes' && Math.random() > 0.7,
            responseSource: 'web',
            needsHumanFollowUp: false,
          });
        }

        guestIndex++;
      }

      res.json({ 
        success: true, 
        message: 'Demo event created successfully', 
        eventId: event.id,
        guestCount: guestData.length 
      });
    } catch (error: any) {
      console.error('Error creating demo event:', error);
      res.status(500).json({ error: error.message || 'Failed to create demo event' });
    }
  });

  // RSVP Message Templates
  app.get('/api/rsvp-message-templates', async (req, res) => {
    try {
      const eventId = req.query.eventId as string;
      if (!eventId) {
        return res.status(400).json({ error: 'eventId is required' });
      }
      const templates = await storage.getRsvpMessageTemplatesByEvent(eventId);
      res.json(templates);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get message templates' });
    }
  });

  app.get('/api/rsvp-message-templates/:id', async (req, res) => {
    try {
      const template = await storage.getRsvpMessageTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get template' });
    }
  });

  app.post('/api/rsvp-message-templates', async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const template = await storage.createRsvpMessageTemplate({
        ...req.body,
        createdBy: userId,
      });
      res.json(template);
    } catch (error: any) {
      console.error('Error creating template:', error);
      res.status(400).json({ error: error.message || 'Failed to create template' });
    }
  });

  app.patch('/api/rsvp-message-templates/:id', async (req, res) => {
    try {
      const template = await storage.updateRsvpMessageTemplate(req.params.id, req.body);
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
      res.json(template);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update template' });
    }
  });

  app.delete('/api/rsvp-message-templates/:id', async (req, res) => {
    try {
      await storage.deleteRsvpMessageTemplate(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete template' });
    }
  });

  // RSVP Message Jobs (Scheduled reminders)
  app.get('/api/rsvp-message-jobs', async (req, res) => {
    try {
      const eventId = req.query.eventId as string;
      if (!eventId) {
        return res.status(400).json({ error: 'eventId is required' });
      }
      const jobs = await storage.getRsvpMessageJobsByEvent(eventId);
      res.json(jobs);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get message jobs' });
    }
  });

  app.post('/api/rsvp-message-jobs', async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const job = await storage.createRsvpMessageJob({
        ...req.body,
        createdBy: userId,
      });
      res.json(job);
    } catch (error: any) {
      console.error('Error creating job:', error);
      res.status(400).json({ error: error.message || 'Failed to create job' });
    }
  });

  app.patch('/api/rsvp-message-jobs/:id', async (req, res) => {
    try {
      const job = await storage.updateRsvpMessageJob(req.params.id, req.body);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      res.json(job);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update job' });
    }
  });

  app.delete('/api/rsvp-message-jobs/:id', async (req, res) => {
    try {
      await storage.deleteRsvpMessageJob(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete job' });
    }
  });

  // RSVP Message Logs (Sent messages)
  app.get('/api/rsvp-message-logs', async (req, res) => {
    try {
      const eventId = req.query.eventId as string;
      const guestId = req.query.guestId as string;
      
      if (guestId) {
        const logs = await storage.getRsvpMessageLogsByGuest(guestId);
        return res.json(logs);
      }
      if (eventId) {
        const logs = await storage.getRsvpMessageLogsByEvent(eventId);
        return res.json(logs);
      }
      res.status(400).json({ error: 'eventId or guestId is required' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get message logs' });
    }
  });

  // Outreach stats for dashboard
  app.get('/api/rsvp-outreach-stats/:eventId', async (req, res) => {
    try {
      const stats = await storage.getOutreachStatsByEvent(req.params.eventId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get outreach stats' });
    }
  });

  // Send greeting/reminder to guests via WhatsApp
  app.post('/api/rsvp-send-messages', async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const user = await storage.getUser(userId);
      
      if (!user || !['superadmin', 'wedding_planner'].includes(user.role)) {
        return res.status(403).json({ error: 'Only superadmin and wedding planners can send RSVP messages' });
      }

      const { eventId, templateId, guestIds, messageType, messageContent: directMessage } = req.body;
      
      // Support both template-based and direct message modes
      if (!guestIds || !Array.isArray(guestIds) || guestIds.length === 0) {
        return res.status(400).json({ error: 'guestIds is required' });
      }
      
      if (!templateId && !directMessage) {
        return res.status(400).json({ error: 'Either templateId or messageContent is required' });
      }

      let templateContent: string | null = null;
      if (templateId) {
        const template = await storage.getRsvpMessageTemplate(templateId);
        if (!template) {
          return res.status(404).json({ error: 'Template not found' });
        }
        templateContent = template.messageContent;
      }

      let event = null;
      if (eventId) {
        event = await storage.getEvent(eventId);
      }

      const results: { guestId: string; success: boolean; error?: string }[] = [];
      
      for (const guestId of guestIds) {
        const guest = await storage.getEventGuest(guestId);
        if (!guest || !guest.phone) {
          results.push({ guestId, success: false, error: 'Guest not found or no phone number' });
          continue;
        }

        // Use direct message or personalize template
        let finalMessage: string;
        if (directMessage) {
          finalMessage = directMessage;
        } else if (templateContent) {
          finalMessage = templateContent
            .replace(/\{\{guestName\}\}/g, guest.name)
            .replace(/\{\{eventName\}\}/g, event?.customer || event?.title || 'Event')
            .replace(/\{\{eventDate\}\}/g, event?.date || 'TBD')
            .replace(/\{\{venue\}\}/g, event?.venue || 'Venue TBD');
        } else {
          results.push({ guestId, success: false, error: 'No message content' });
          continue;
        }

        try {
          // Send via Twilio WhatsApp
          const twilioClient = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
          const twilioMessage = await twilioClient.messages.create({
            body: finalMessage,
            from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
            to: `whatsapp:${guest.phone.startsWith('+') ? guest.phone : '+91' + guest.phone}`,
          });

          // Log the message
          await storage.createRsvpMessageLog({
            eventId: eventId || guest.eventId,
            guestId,
            templateId: templateId || null,
            messageType: messageType || 'individual',
            messageContent: finalMessage,
            recipientPhone: guest.phone,
            deliveryStatus: 'sent',
            twilioMessageSid: twilioMessage.sid,
            sentAt: new Date(),
            sentBy: userId,
          });

          results.push({ guestId, success: true });
        } catch (sendError: any) {
          console.error(`Failed to send message to guest ${guestId}:`, sendError);
          
          await storage.createRsvpMessageLog({
            eventId: eventId || guest.eventId,
            guestId,
            templateId: templateId || null,
            messageType: messageType || 'individual',
            messageContent: finalMessage,
            recipientPhone: guest.phone,
            deliveryStatus: 'failed',
            errorMessage: sendError.message,
            sentBy: userId,
          });

          results.push({ guestId, success: false, error: sendError.message });
        }
      }

      const successCount = results.filter(r => r.success).length;
      res.json({ 
        success: true, 
        sent: successCount, 
        failed: results.length - successCount,
        results 
      });
    } catch (error: any) {
      console.error('Error sending RSVP messages:', error);
      res.status(500).json({ error: error.message || 'Failed to send messages' });
    }
  });

  // Leave Requests
  app.get('/api/leave-requests', async (req, res) => {
    const requests = await storage.getAllLeaveRequests();
    res.json(requests);
  });

  app.post('/api/leave-requests', async (req, res) => {
    try {
      const data = insertLeaveRequestSchema.parse(req.body);
      const request = await storage.createLeaveRequest(data);
      res.json(request);
    } catch (error) {
      res.status(400).json({ error: 'Invalid leave request data' });
    }
  });

  app.patch('/api/leave-requests/:id', async (req, res) => {
    try {
      const request = await storage.updateLeaveRequest(req.params.id, req.body);
      res.json(request);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update leave request' });
    }
  });

  app.delete('/api/leave-requests/:id', async (req, res) => {
    await storage.deleteLeaveRequest(req.params.id);
    res.json({ success: true });
  });

  // Employee Portal - Get current user's employee profile
  app.get('/api/employee-portal/profile', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const employee = await storage.getEmployeeByUserId(userId);
      if (!employee) {
        return res.status(404).json({ error: 'Employee profile not found' });
      }
      res.json(employee);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get employee profile' });
    }
  });

  // Employee Portal - Increments
  app.get('/api/employee-portal/increments', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const employee = await storage.getEmployeeByUserId(userId);
      if (!employee) {
        return res.status(404).json({ error: 'Employee profile not found' });
      }
      const increments = await storage.getEmployeeIncrements(employee.id);
      res.json(increments);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get increments' });
    }
  });

  // Employee Portal - Appraisals
  app.get('/api/employee-portal/appraisals', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const employee = await storage.getEmployeeByUserId(userId);
      if (!employee) {
        return res.status(404).json({ error: 'Employee profile not found' });
      }
      const appraisals = await storage.getEmployeeAppraisals(employee.id);
      res.json(appraisals);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get appraisals' });
    }
  });

  // Employee Portal - Leave Balance
  app.get('/api/employee-portal/leave-balance', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const employee = await storage.getEmployeeByUserId(userId);
      if (!employee) {
        return res.status(404).json({ error: 'Employee profile not found' });
      }
      const leaveBalance = await storage.getOrCreateCurrentFiscalYearLeaveBalance(employee.id);
      res.json(leaveBalance);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get leave balance' });
    }
  });

  // Employee Portal - Leave Requests (employee's own)
  app.get('/api/employee-portal/leave-requests', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const employee = await storage.getEmployeeByUserId(userId);
      if (!employee) {
        return res.status(404).json({ error: 'Employee profile not found' });
      }
      const allRequests = await storage.getAllLeaveRequests();
      const myRequests = allRequests.filter(r => r.employeeId === employee.id);
      res.json(myRequests);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get leave requests' });
    }
  });

  // Employee Portal - Submit Leave Request
  app.post('/api/employee-portal/leave-requests', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const employee = await storage.getEmployeeByUserId(userId);
      if (!employee) {
        return res.status(404).json({ error: 'Employee profile not found' });
      }
      const data = {
        ...req.body,
        employeeId: employee.id,
        status: 'pending'
      };
      const request = await storage.createLeaveRequest(data);
      res.json(request);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create leave request' });
    }
  });

  // Employee Portal - Update Leave Request (pending only)
  app.patch('/api/employee-portal/leave-requests/:id', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const user = await storage.getUser(userId);
      const employee = await storage.getEmployeeByUserId(userId);
      const isSuperadmin = user?.role === 'superadmin';
      
      const requests = await storage.getLeaveRequestsByEmployee(employee?.id || '');
      const leaveRequest = requests.find((r: any) => r.id === req.params.id);
      
      if (!leaveRequest) {
        return res.status(404).json({ error: 'Leave request not found' });
      }
      
      // Only owner or superadmin can edit, and only if pending
      if (!isSuperadmin && (!employee || leaveRequest.employeeId !== employee.id)) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      if (leaveRequest.status !== 'pending') {
        return res.status(400).json({ error: 'Can only edit pending requests' });
      }
      
      const updated = await storage.updateLeaveRequest(req.params.id, {
        startDate: req.body.startDate,
        endDate: req.body.endDate,
        leaveType: req.body.leaveType,
        categoryId: req.body.categoryId,
        reason: req.body.reason
      });
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update leave request' });
    }
  });

  // Employee Portal - Delete Leave Request (pending only)
  app.delete('/api/employee-portal/leave-requests/:id', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const user = await storage.getUser(userId);
      const employee = await storage.getEmployeeByUserId(userId);
      const isSuperadmin = user?.role === 'superadmin';
      
      const requests = await storage.getLeaveRequestsByEmployee(employee?.id || '');
      const leaveRequest = requests.find((r: any) => r.id === req.params.id);
      
      if (!leaveRequest) {
        return res.status(404).json({ error: 'Leave request not found' });
      }
      
      // Only owner or superadmin can delete, and only if pending
      if (!isSuperadmin && (!employee || leaveRequest.employeeId !== employee.id)) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      if (leaveRequest.status !== 'pending') {
        return res.status(400).json({ error: 'Can only delete pending requests' });
      }
      
      await storage.deleteLeaveRequest(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: 'Failed to delete leave request' });
    }
  });

  // Employee Portal - Salary Advance Requests (employee's own)
  app.get('/api/employee-portal/salary-advances', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const employee = await storage.getEmployeeByUserId(userId);
      if (!employee) {
        return res.status(404).json({ error: 'Employee profile not found' });
      }
      const advances = await storage.getSalaryAdvanceRequests(employee.id);
      res.json(advances);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get salary advances' });
    }
  });

  // Employee Portal - Submit Salary Advance Request
  app.post('/api/employee-portal/salary-advances', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const employee = await storage.getEmployeeByUserId(userId);
      if (!employee) {
        return res.status(404).json({ error: 'Employee profile not found' });
      }
      const data = {
        ...req.body,
        employeeId: employee.id,
        requestDate: new Date().toISOString().split('T')[0],
        status: 'pending'
      };
      const advance = await storage.createSalaryAdvanceRequest(data);
      res.json(advance);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create salary advance request' });
    }
  });

  // Employee Portal - Update Salary Advance Request (pending only)
  app.patch('/api/employee-portal/salary-advances/:id', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const user = await storage.getUser(userId);
      const employee = await storage.getEmployeeByUserId(userId);
      const isSuperadmin = user?.role === 'superadmin';
      
      const advances = await storage.getSalaryAdvanceRequests(employee?.id || '');
      const advance = advances.find(a => a.id === req.params.id);
      
      if (!advance) {
        return res.status(404).json({ error: 'Salary advance not found' });
      }
      
      // Only owner or superadmin can edit, and only if pending
      if (!isSuperadmin && (!employee || advance.employeeId !== employee.id)) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      if (advance.status !== 'pending') {
        return res.status(400).json({ error: 'Can only edit pending requests' });
      }
      
      const updated = await storage.updateSalaryAdvanceRequest(req.params.id, {
        amount: req.body.amount,
        reason: req.body.reason,
        repaymentMonths: req.body.repaymentMonths
      });
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update salary advance request' });
    }
  });

  // Employee Portal - Delete Salary Advance Request (pending only)
  app.delete('/api/employee-portal/salary-advances/:id', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const user = await storage.getUser(userId);
      const employee = await storage.getEmployeeByUserId(userId);
      const isSuperadmin = user?.role === 'superadmin';
      
      const advances = await storage.getSalaryAdvanceRequests(employee?.id || '');
      const advance = advances.find(a => a.id === req.params.id);
      
      if (!advance) {
        return res.status(404).json({ error: 'Salary advance not found' });
      }
      
      // Only owner or superadmin can delete, and only if pending
      if (!isSuperadmin && (!employee || advance.employeeId !== employee.id)) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      if (advance.status !== 'pending') {
        return res.status(400).json({ error: 'Can only delete pending requests' });
      }
      
      await storage.deleteSalaryAdvanceRequest(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: 'Failed to delete salary advance request' });
    }
  });

  // Employee Portal - Payroll History
  app.get('/api/employee-portal/payroll-history', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const employee = await storage.getEmployeeByUserId(userId);
      if (!employee) {
        return res.status(404).json({ error: 'Employee profile not found' });
      }
      const allRuns = await storage.getAllPayrollRuns();
      const paidRuns = allRuns.filter(r => r.status === 'paid');
      
      const payrollHistory = [];
      for (const run of paidRuns) {
        const items = await storage.getPayrollItemsByRunId(run.id);
        const myItem = items.find(i => i.employeeId === employee.id);
        if (myItem) {
          payrollHistory.push({
            runId: run.id,
            month: run.month,
            year: run.year,
            payDate: run.payDate,
            ...myItem
          });
        }
      }
      res.json(payrollHistory);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get payroll history' });
    }
  });

  // Admin Routes - Manage Employee Increments
  app.get('/api/admin/employee-increments/:employeeId', async (req, res) => {
    const auth = await verifyAdminAccess(req, res);
    if (!auth) return;
    const increments = await storage.getEmployeeIncrements(req.params.employeeId);
    res.json(increments);
  });

  app.post('/api/admin/employee-increments', async (req, res) => {
    const auth = await verifyAdminAccess(req, res);
    if (!auth) return;
    try {
      const increment = await storage.createEmployeeIncrement(req.body);
      res.json(increment);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create increment' });
    }
  });

  app.patch('/api/admin/employee-increments/:id', async (req, res) => {
    const auth = await verifyAdminAccess(req, res);
    if (!auth) return;
    try {
      const increment = await storage.updateEmployeeIncrement(req.params.id, req.body);
      res.json(increment);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update increment' });
    }
  });

  app.delete('/api/admin/employee-increments/:id', async (req, res) => {
    const auth = await verifyAdminAccess(req, res);
    if (!auth) return;
    await storage.deleteEmployeeIncrement(req.params.id);
    res.json({ success: true });
  });

  // Admin Routes - Manage Employee Appraisals
  app.get('/api/admin/employee-appraisals/:employeeId', async (req, res) => {
    const auth = await verifyAdminAccess(req, res);
    if (!auth) return;
    const appraisals = await storage.getEmployeeAppraisals(req.params.employeeId);
    res.json(appraisals);
  });

  app.post('/api/admin/employee-appraisals', async (req, res) => {
    const auth = await verifyAdminAccess(req, res);
    if (!auth) return;
    try {
      const appraisal = await storage.createEmployeeAppraisal(req.body);
      res.json(appraisal);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create appraisal' });
    }
  });

  app.patch('/api/admin/employee-appraisals/:id', async (req, res) => {
    const auth = await verifyAdminAccess(req, res);
    if (!auth) return;
    try {
      const appraisal = await storage.updateEmployeeAppraisal(req.params.id, req.body);
      res.json(appraisal);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update appraisal' });
    }
  });

  app.delete('/api/admin/employee-appraisals/:id', async (req, res) => {
    const auth = await verifyAdminAccess(req, res);
    if (!auth) return;
    await storage.deleteEmployeeAppraisal(req.params.id);
    res.json({ success: true });
  });

  // Admin Routes - Manage Salary Advance Requests
  app.get('/api/admin/salary-advances', async (req, res) => {
    const auth = await verifyAdminAccess(req, res);
    if (!auth) return;
    const advances = await storage.getAllSalaryAdvanceRequests();
    res.json(advances);
  });

  app.patch('/api/admin/salary-advances/:id', async (req, res) => {
    const auth = await verifyAdminAccess(req, res);
    if (!auth) return;
    try {
      const advance = await storage.updateSalaryAdvanceRequest(req.params.id, req.body);
      res.json(advance);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update salary advance' });
    }
  });

  // Manager/Superadmin - Get employees they can view
  app.get('/api/employee-portal/managed-employees', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }
      
      const allEmployees = await storage.getAllEmployees();
      
      if (user.role === 'superadmin') {
        // Superadmin can see all employees
        res.json(allEmployees);
      } else if (user.role === 'admin' || user.role === 'manager') {
        // Managers can only see their assigned employees
        const managedEmployees = allEmployees.filter(emp => emp.managerUserId === userId);
        res.json(managedEmployees);
      } else {
        // Regular users can't see other employees
        res.json([]);
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to get managed employees' });
    }
  });

  // Manager/Superadmin - View specific employee's portal data
  app.get('/api/employee-portal/view/:employeeId', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }
      
      const employee = await storage.getEmployee(req.params.employeeId);
      if (!employee) {
        return res.status(404).json({ error: 'Employee not found' });
      }
      
      // Check access rights
      const isSuperadmin = user.role === 'superadmin';
      const isManager = (user.role === 'admin' || user.role === 'manager') && employee.managerUserId === userId;
      
      if (!isSuperadmin && !isManager) {
        return res.status(403).json({ error: 'Not authorized to view this employee' });
      }
      
      // Get all employee data
      const increments = await storage.getEmployeeIncrements(employee.id);
      const appraisals = await storage.getEmployeeAppraisals(employee.id);
      const leaveBalance = await storage.getOrCreateCurrentFiscalYearLeaveBalance(employee.id);
      const leaveRequests = await storage.getLeaveRequestsByEmployee(employee.id);
      const salaryAdvances = await storage.getSalaryAdvanceRequests(employee.id);
      const allExpenses = await storage.getAllExpenseReimbursements();
      const expenses = allExpenses.filter(e => e.employeeId === employee.id);
      
      res.json({
        employee,
        increments,
        appraisals,
        leaveBalance,
        leaveRequests,
        salaryAdvances,
        expenses,
      });
    } catch (error) {
      console.error('[Employee Portal View Error]', error);
      res.status(500).json({ error: 'Failed to get employee data' });
    }
  });

  // HR Consolidated Employee Report - for admin/superadmin
  app.get('/api/hr/consolidated-report', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }
      
      // Only admin/superadmin can access
      if (!['superadmin', 'admin'].includes(user.role)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const fiscalYear = req.query.fiscalYear as string || getCurrentFiscalYear();
      const allEmployees = await storage.getAllEmployees();
      
      // Get consolidated data for each employee
      const consolidatedData = await Promise.all(
        allEmployees.map(async (employee) => {
          const leaveBalance = await storage.getOrCreateCurrentFiscalYearLeaveBalance(employee.id);
          const leaveRequests = await storage.getLeaveRequestsByEmployee(employee.id);
          const salaryAdvances = await storage.getSalaryAdvanceRequests(employee.id);
          const allExpenses = await storage.getAllExpenseReimbursements();
          const expenses = allExpenses.filter(e => e.employeeId === employee.id);
          const increments = await storage.getEmployeeIncrements(employee.id);
          const incentives = await storage.getEmployeeIncentivesByFiscalYear(employee.id, fiscalYear);
          
          // Calculate leave metrics
          const approvedLeaves = leaveRequests.filter(lr => lr.status === 'approved');
          const leaveDaysTaken = approvedLeaves.reduce((sum, lr) => {
            const start = new Date(lr.startDate);
            const end = new Date(lr.endDate);
            const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            return sum + days;
          }, 0);
          
          // Calculate loss of pay (leaves beyond balance)
          const totalLeaves = leaveBalance?.allocated || 24;
          const lossOfPayDays = Math.max(0, leaveDaysTaken - totalLeaves);
          const dailyRate = parseFloat(employee.salary) / 30; // Assuming 30 days/month
          const lossOfPayAmount = lossOfPayDays * dailyRate;
          
          // Calculate pending/approved advances
          const pendingAdvances = salaryAdvances.filter(a => a.status === 'pending').reduce((sum, a) => sum + parseFloat(a.amount), 0);
          const approvedAdvances = salaryAdvances.filter(a => a.status === 'approved').reduce((sum, a) => sum + parseFloat(a.amount), 0);
          
          // Calculate approved expenses
          const approvedExpenses = expenses.filter(e => e.status === 'approved' || e.status === 'paid')
            .reduce((sum, e) => sum + parseFloat(e.approvedAmount || e.amount), 0);
          
          // Calculate incentives
          const totalIncentives = incentives.filter(i => i.status === 'approved' || i.status === 'paid')
            .reduce((sum, i) => sum + parseFloat(i.amount), 0);
          
          // Calculate net payroll (simplified)
          const monthlySalary = parseFloat(employee.salary);
          const netPayroll = monthlySalary - lossOfPayAmount + totalIncentives - approvedAdvances;
          
          // Get manager info
          let managerName = null;
          if (employee.managerUserId) {
            const manager = await storage.getUser(employee.managerUserId);
            managerName = manager?.name || null;
          }
          
          return {
            employee: {
              id: employee.id,
              employeeId: employee.employeeId,
              name: employee.name,
              designation: employee.designation,
              department: employee.department,
              salary: employee.salary,
              joinDate: employee.joinDate,
              contractRenewalDate: employee.contractRenewalDate,
              email: employee.email,
              phone: employee.phone,
              managerName,
            },
            leaveMetrics: {
              totalLeaves,
              leavesUsed: leaveDaysTaken,
              leavesRemaining: Math.max(0, totalLeaves - leaveDaysTaken),
              lossOfPayDays,
              casualLeavesTaken: approvedLeaves.filter(l => l.leaveType === 'casual').length,
              sickLeavesTaken: approvedLeaves.filter(l => l.leaveType === 'sick').length,
              earnedLeavesTaken: approvedLeaves.filter(l => l.leaveType === 'earned').length,
            },
            financialMetrics: {
              monthlySalary,
              lossOfPayAmount,
              pendingAdvances,
              approvedAdvances,
              approvedExpenses,
              totalIncentives,
              netPayroll,
            },
            increments: increments.slice(0, 3), // Last 3 increments
            contractRenewalDate: employee.contractRenewalDate,
          };
        })
      );
      
      res.json({
        fiscalYear,
        employees: consolidatedData,
        summary: {
          totalEmployees: consolidatedData.length,
          totalPayroll: consolidatedData.reduce((sum, e) => sum + e.financialMetrics.netPayroll, 0),
          totalIncentives: consolidatedData.reduce((sum, e) => sum + e.financialMetrics.totalIncentives, 0),
          totalLossOfPay: consolidatedData.reduce((sum, e) => sum + e.financialMetrics.lossOfPayAmount, 0),
          totalAdvances: consolidatedData.reduce((sum, e) => sum + e.financialMetrics.approvedAdvances, 0),
          totalExpenses: consolidatedData.reduce((sum, e) => sum + e.financialMetrics.approvedExpenses, 0),
        }
      });
    } catch (error) {
      console.error('HR consolidated report error:', error);
      res.status(500).json({ error: 'Failed to generate consolidated report' });
    }
  });

  // HR Incentives Management
  app.get('/api/hr/incentives', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const user = await storage.getUser(userId);
      if (!user || !['superadmin', 'admin'].includes(user.role)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      const incentives = await storage.getAllEmployeeIncentives();
      res.json(incentives);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get incentives' });
    }
  });

  app.get('/api/hr/incentives/:employeeId', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const user = await storage.getUser(userId);
      if (!user || !['superadmin', 'admin'].includes(user.role)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      const incentives = await storage.getEmployeeIncentives(req.params.employeeId);
      res.json(incentives);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get employee incentives' });
    }
  });

  app.post('/api/hr/incentives', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const user = await storage.getUser(userId);
      if (!user || !['superadmin', 'admin'].includes(user.role)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      const incentive = await storage.createEmployeeIncentive(req.body);
      res.status(201).json(incentive);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create incentive' });
    }
  });

  app.patch('/api/hr/incentives/:id', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const user = await storage.getUser(userId);
      if (!user || !['superadmin', 'admin'].includes(user.role)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      const incentive = await storage.updateEmployeeIncentive(req.params.id, req.body);
      res.json(incentive);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update incentive' });
    }
  });

  app.delete('/api/hr/incentives/:id', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const user = await storage.getUser(userId);
      if (!user || !['superadmin', 'admin'].includes(user.role)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      await storage.deleteEmployeeIncentive(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: 'Failed to delete incentive' });
    }
  });

  // Employee Portal - Expense Reimbursements (employee's own)
  app.get('/api/employee-portal/expense-reimbursements', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const employee = await storage.getEmployeeByUserId(userId);
      if (!employee) {
        return res.status(404).json({ error: 'Employee profile not found' });
      }
      const reimbursements = await storage.getExpenseReimbursements(employee.id);
      res.json(reimbursements);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get expense reimbursements' });
    }
  });

  // Employee Portal - Submit Expense Reimbursement Request
  app.post('/api/employee-portal/expense-reimbursements', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const employee = await storage.getEmployeeByUserId(userId);
      if (!employee) {
        return res.status(404).json({ error: 'Employee profile not found' });
      }
      const data = {
        ...req.body,
        employeeId: employee.id,
        requestDate: new Date().toISOString().split('T')[0],
        status: 'pending'
      };
      const reimbursement = await storage.createExpenseReimbursement(data);
      res.json(reimbursement);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create expense reimbursement request' });
    }
  });

  // Employee Portal - Update Expense Reimbursement (pending only)
  app.patch('/api/employee-portal/expense-reimbursements/:id', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const user = await storage.getUser(userId);
      const employee = await storage.getEmployeeByUserId(userId);
      const isSuperadmin = user?.role === 'superadmin';
      
      const expenses = await storage.getExpenseReimbursements(employee?.id || '');
      const expense = expenses.find(e => e.id === req.params.id);
      
      if (!expense) {
        return res.status(404).json({ error: 'Expense reimbursement not found' });
      }
      
      // Only owner or superadmin can edit, and only if pending
      if (!isSuperadmin && (!employee || expense.employeeId !== employee.id)) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      if (expense.status !== 'pending') {
        return res.status(400).json({ error: 'Can only edit pending requests' });
      }
      
      const updated = await storage.updateExpenseReimbursement(req.params.id, {
        expenseDate: req.body.expenseDate,
        category: req.body.category,
        description: req.body.description,
        amount: req.body.amount
      });
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update expense reimbursement' });
    }
  });

  // Employee Portal - Delete Expense Reimbursement (pending only)
  app.delete('/api/employee-portal/expense-reimbursements/:id', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const user = await storage.getUser(userId);
      const employee = await storage.getEmployeeByUserId(userId);
      const isSuperadmin = user?.role === 'superadmin';
      
      const expenses = await storage.getExpenseReimbursements(employee?.id || '');
      const expense = expenses.find(e => e.id === req.params.id);
      
      if (!expense) {
        return res.status(404).json({ error: 'Expense reimbursement not found' });
      }
      
      // Only owner or superadmin can delete, and only if pending
      if (!isSuperadmin && (!employee || expense.employeeId !== employee.id)) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      if (expense.status !== 'pending') {
        return res.status(400).json({ error: 'Can only delete pending requests' });
      }
      
      await storage.deleteExpenseReimbursement(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: 'Failed to delete expense reimbursement' });
    }
  });

  // Employee Portal - Quick Entries (AI-processed payment screenshots)
  app.get('/api/employee-portal/quick-entries', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const employee = await storage.getEmployeeByUserId(userId);
      if (!employee) {
        return res.status(404).json({ error: 'Employee profile not found' });
      }
      const entries = await storage.getQuickEntriesByEmployee(employee.id);
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get quick entries' });
    }
  });

  app.post('/api/employee-portal/quick-entries', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const user = await storage.getUser(userId);
      const isSuperadmin = user?.role === 'superadmin';
      const employee = await storage.getEmployeeByUserId(userId);
      
      // Superadmin can create entries for any employee (or themselves if they have a profile)
      let targetEmployeeId = employee?.id;
      
      // If superadmin provides an employeeId, validate it exists and use that
      if (isSuperadmin && req.body.employeeId) {
        const targetEmployee = await storage.getEmployee(req.body.employeeId);
        if (!targetEmployee) {
          return res.status(400).json({ error: 'Invalid employee ID specified' });
        }
        targetEmployeeId = req.body.employeeId;
      }
      
      // If superadmin has no employee profile, create a placeholder entry that can be reassigned later
      // For regular users, require employee profile
      if (!targetEmployeeId) {
        if (isSuperadmin) {
          // Get first employee to use as placeholder - superadmin can reassign later
          const allEmployees = await storage.getAllEmployees();
          if (allEmployees.length > 0) {
            targetEmployeeId = allEmployees[0].id;
          } else {
            return res.status(400).json({ error: 'No employees found. Please create an employee first.' });
          }
        } else {
          return res.status(404).json({ error: 'Employee profile not found' });
        }
      }
      
      const entry = await storage.createQuickEntry({
        employeeId: targetEmployeeId,
        source: req.body.source || 'upload',
        filePath: req.body.filePath,
        status: 'uploaded'
      });
      res.json(entry);
    } catch (error) {
      console.error('Error creating quick entry:', error);
      res.status(400).json({ error: 'Failed to create quick entry' });
    }
  });

  app.patch('/api/employee-portal/quick-entries/:id', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const user = await storage.getUser(userId);
      const employee = await storage.getEmployeeByUserId(userId);
      const isSuperadmin = user?.role === 'superadmin';
      
      const entry = await storage.getQuickEntry(req.params.id);
      if (!entry) {
        return res.status(404).json({ error: 'Quick entry not found' });
      }
      
      // Only owner or superadmin can edit
      if (!isSuperadmin && (!employee || entry.employeeId !== employee.id)) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      
      const updated = await storage.updateQuickEntry(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update quick entry' });
    }
  });

  // PUT endpoint (alias for PATCH) for updating quick entries
  app.put('/api/employee-portal/quick-entries/:id', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const user = await storage.getUser(userId);
      const employee = await storage.getEmployeeByUserId(userId);
      const isSuperadmin = user?.role === 'superadmin';
      
      const entry = await storage.getQuickEntry(req.params.id);
      if (!entry) {
        return res.status(404).json({ error: 'Quick entry not found' });
      }
      
      // Only owner or superadmin can edit
      if (!isSuperadmin && (!employee || entry.employeeId !== employee.id)) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      
      const updated = await storage.updateQuickEntry(req.params.id, req.body);
      res.json(updated || entry);
    } catch (error: any) {
      console.error('Error updating quick entry:', error);
      res.status(400).json({ error: error.message || 'Failed to update quick entry' });
    }
  });

  app.delete('/api/employee-portal/quick-entries/:id', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const user = await storage.getUser(userId);
      const employee = await storage.getEmployeeByUserId(userId);
      const isSuperadmin = user?.role === 'superadmin';
      
      const entry = await storage.getQuickEntry(req.params.id);
      if (!entry) {
        return res.status(404).json({ error: 'Quick entry not found' });
      }
      
      // Only owner or superadmin can delete
      if (!isSuperadmin && (!employee || entry.employeeId !== employee.id)) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      // Only prevent non-superadmin from deleting approved entries
      if (!isSuperadmin && entry.status === 'approved') {
        return res.status(400).json({ error: 'Cannot delete approved entries' });
      }
      
      await storage.deleteQuickEntry(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: 'Failed to delete quick entry' });
    }
  });

  // Employee Portal - Process Quick Entry with AI
  app.post('/api/employee-portal/quick-entries/:id/process', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const entry = await storage.getQuickEntry(req.params.id);
      if (!entry) {
        return res.status(404).json({ error: 'Quick entry not found' });
      }
      
      const { image } = req.body;
      if (!image) {
        return res.status(400).json({ error: 'Image data is required' });
      }
      
      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ error: 'OpenAI API key not configured' });
      }
      
      // Update status to processing
      await storage.updateQuickEntry(req.params.id, { status: 'processing' });
      
      try {
        const parsed = await parseTransactionScreenshot(image);
        
        // Update entry with parsed data
        const updated = await storage.updateQuickEntry(req.params.id, {
          amount: parsed.amount.toString(),
          transactionDate: new Date(parsed.date),
          direction: parsed.type === 'income' ? 'received' : 'paid',
          counterpartyName: parsed.counterparty || undefined,
          transactionId: parsed.reference || undefined,
          confidence: (parsed.confidence * 100).toString(),
          rawExtraction: parsed as any,
          status: 'awaiting_review',
          notes: parsed.description
        });
        
        res.json(updated);
      } catch (parseError) {
        await storage.updateQuickEntry(req.params.id, { status: 'failed' });
        throw parseError;
      }
    } catch (error) {
      console.error('Quick entry processing error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to process quick entry' 
      });
    }
  });

  // HR/Admin - Get all pending quick entries for approval
  app.get('/api/hr/quick-entries/pending', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const user = await storage.getUser(userId);
      if (!user || !['superadmin', 'admin'].includes(user.role)) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      
      const entries = await storage.getPendingQuickEntries();
      
      // Get employee info for each entry
      const entriesWithEmployee = await Promise.all(
        entries.map(async (entry) => {
          const employee = await storage.getEmployee(entry.employeeId);
          return { ...entry, employeeName: employee?.name || 'Unknown' };
        })
      );
      
      res.json(entriesWithEmployee);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get pending quick entries' });
    }
  });

  // HR/Admin - Approve quick entry and push to daybook
  app.post('/api/hr/quick-entries/:id/approve', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const user = await storage.getUser(userId);
      if (!user || !['superadmin', 'admin'].includes(user.role)) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      
      const entry = await storage.getQuickEntry(req.params.id);
      if (!entry) {
        return res.status(404).json({ error: 'Quick entry not found' });
      }
      if (entry.status !== 'awaiting_review') {
        return res.status(400).json({ error: 'Entry is not awaiting review' });
      }
      
      const { eventId, categoryId, bankId, notes } = req.body;
      
      // Create daybook entry
      const daybookEntry = await storage.createDaybookEntry({
        date: entry.transactionDate ? entry.transactionDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        type: entry.direction === 'received' ? 'income' : 'expense',
        amount: entry.amount || '0',
        category: categoryId || 'General',
        description: notes || entry.notes || `Quick Entry - ${entry.counterpartyName || 'Transaction'}`,
        bankId: bankId || undefined,
        eventId: eventId || undefined
      });
      
      // Update bank balance if bank is selected
      if (bankId) {
        const bank = await storage.getBank(bankId);
        if (bank) {
          const amount = parseFloat(entry.amount || '0');
          const newBalance = entry.direction === 'received'
            ? parseFloat(bank.balance) + amount
            : parseFloat(bank.balance) - amount;
          await storage.updateBank(bankId, { balance: newBalance.toString() });
        }
      }
      
      // Update event P&L if event is selected
      if (eventId) {
        const event = await storage.getEvent(eventId);
        if (event) {
          const amount = parseFloat(entry.amount || '0');
          if (entry.direction === 'received') {
            const newPaymentReceived = parseFloat(event.paymentReceived) + amount;
            await storage.updateEvent(eventId, { paymentReceived: newPaymentReceived.toFixed(2) });
          } else {
            const newCost = parseFloat(event.cost) + amount;
            await storage.updateEvent(eventId, { cost: newCost.toFixed(2) });
          }
        }
      }
      
      // Update quick entry as approved
      const updated = await storage.updateQuickEntry(req.params.id, {
        status: 'approved',
        reviewerId: userId,
        eventId,
        categoryId,
        bankId,
        notes,
        daybookEntryId: daybookEntry.id
      });
      
      res.json({ entry: updated, daybookEntry });
    } catch (error) {
      console.error('Quick entry approval error:', error);
      res.status(400).json({ error: 'Failed to approve quick entry' });
    }
  });

  // HR/Admin - Reject quick entry
  app.post('/api/hr/quick-entries/:id/reject', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const user = await storage.getUser(userId);
      if (!user || !['superadmin', 'admin'].includes(user.role)) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      
      const entry = await storage.getQuickEntry(req.params.id);
      if (!entry) {
        return res.status(404).json({ error: 'Quick entry not found' });
      }
      
      const { reviewerNotes } = req.body;
      
      const updated = await storage.updateQuickEntry(req.params.id, {
        status: 'rejected',
        reviewerId: userId,
        reviewerNotes
      });
      
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: 'Failed to reject quick entry' });
    }
  });

  // Employee Portal - Duties and Responsibilities
  app.get('/api/employee-portal/duties', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const employee = await storage.getEmployeeByUserId(userId);
      if (!employee) {
        return res.status(404).json({ error: 'Employee profile not found' });
      }
      res.json({
        duties: employee.duties || '',
        responsibilities: employee.responsibilities || '',
        designation: employee.designation,
        department: employee.department
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get duties' });
    }
  });

  // Manager Approval - Get pending requests for manager
  app.get('/api/manager/pending-requests', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const leaveRequests = await storage.getPendingLeaveRequestsForManager(userId);
      const expenseReimbursements = await storage.getPendingExpenseReimbursementsForManager(userId);
      
      // Get employee info for each request
      const leaveRequestsWithEmployee = await Promise.all(
        leaveRequests.map(async (request) => {
          const employee = await storage.getEmployee(request.employeeId);
          return { ...request, employeeName: employee?.name || 'Unknown' };
        })
      );
      
      const expenseReimbursementsWithEmployee = await Promise.all(
        expenseReimbursements.map(async (request) => {
          const employee = await storage.getEmployee(request.employeeId);
          return { ...request, employeeName: employee?.name || 'Unknown' };
        })
      );
      
      res.json({
        leaveRequests: leaveRequestsWithEmployee,
        expenseReimbursements: expenseReimbursementsWithEmployee
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get pending requests' });
    }
  });

  // Manager Approval - Approve/Reject Leave Request
  app.patch('/api/manager/leave-requests/:id', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const { status, managerComments } = req.body;
      const leaveRequest = await storage.getLeaveRequest(req.params.id);
      if (!leaveRequest) {
        return res.status(404).json({ error: 'Leave request not found' });
      }
      
      // Verify manager is assigned to this employee
      const employee = await storage.getEmployee(leaveRequest.employeeId);
      if (!employee || employee.managerUserId !== userId) {
        return res.status(403).json({ error: 'Not authorized to approve this request' });
      }
      
      const updated = await storage.updateLeaveRequest(req.params.id, {
        status,
        managerId: userId,
        managerComments,
        approvedAt: status === 'approved' || status === 'rejected' ? new Date() : undefined
      });
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update leave request' });
    }
  });

  // Manager Approval - Approve/Reject Expense Reimbursement
  app.patch('/api/manager/expense-reimbursements/:id', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const { status, managerComments, approvedAmount } = req.body;
      const reimbursement = await storage.getExpenseReimbursement(req.params.id);
      if (!reimbursement) {
        return res.status(404).json({ error: 'Expense reimbursement not found' });
      }
      
      // Verify manager is assigned to this employee
      const employee = await storage.getEmployee(reimbursement.employeeId);
      if (!employee || employee.managerUserId !== userId) {
        return res.status(403).json({ error: 'Not authorized to approve this request' });
      }
      
      const updated = await storage.updateExpenseReimbursement(req.params.id, {
        status,
        approvedBy: userId,
        approvedAmount: approvedAmount || reimbursement.amount,
        managerComments,
        approvedAt: status === 'approved' || status === 'rejected' ? new Date() : undefined
      });
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update expense reimbursement' });
    }
  });

  // Manager - Get managed employees
  app.get('/api/manager/employees', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const employees = await storage.getEmployeesByManager(userId);
      res.json(employees);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get managed employees' });
    }
  });

  // Manager Approvals - Get pending leave requests
  app.get('/api/manager/pending-leaves', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      // For admin/superadmin, get all pending leave requests
      const user = await storage.getUser(userId);
      let leaveRequests = [];
      
      if (user?.role === 'admin' || user?.role === 'superadmin') {
        const allEmployees = await storage.getAllEmployees();
        const allLeaves = await Promise.all(
          allEmployees.map(emp => storage.getLeaveRequestsByEmployee(emp.id))
        );
        leaveRequests = allLeaves.flat().filter(l => l.status === 'pending');
      } else {
        leaveRequests = await storage.getPendingLeaveRequestsForManager(userId);
      }
      
      // Get employee info for each request
      const leaveRequestsWithEmployee = await Promise.all(
        leaveRequests.map(async (request) => {
          const employee = await storage.getEmployee(request.employeeId);
          return { ...request, employeeName: employee?.name || 'Unknown' };
        })
      );
      
      res.json(leaveRequestsWithEmployee);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get pending leave requests' });
    }
  });

  // Manager Approvals - Get pending advance requests
  app.get('/api/manager/pending-advances', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const user = await storage.getUser(userId);
      let advanceRequests = [];
      
      if (user?.role === 'admin' || user?.role === 'superadmin') {
        advanceRequests = (await storage.getAllSalaryAdvanceRequests()).filter(a => a.status === 'pending');
      } else {
        advanceRequests = await storage.getPendingSalaryAdvancesForManager(userId);
      }
      
      const advanceRequestsWithEmployee = await Promise.all(
        advanceRequests.map(async (request) => {
          const employee = await storage.getEmployee(request.employeeId);
          return { ...request, employeeName: employee?.name || 'Unknown' };
        })
      );
      
      res.json(advanceRequestsWithEmployee);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get pending advance requests' });
    }
  });

  // Manager Approvals - Get pending expense requests
  app.get('/api/manager/pending-expenses', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const user = await storage.getUser(userId);
      let expenseRequests = [];
      
      if (user?.role === 'admin' || user?.role === 'superadmin') {
        expenseRequests = (await storage.getAllExpenseReimbursements()).filter(e => e.status === 'pending');
      } else {
        expenseRequests = await storage.getPendingExpenseReimbursementsForManager(userId);
      }
      
      const expenseRequestsWithEmployee = await Promise.all(
        expenseRequests.map(async (request) => {
          const employee = await storage.getEmployee(request.employeeId);
          return { ...request, employeeName: employee?.name || 'Unknown' };
        })
      );
      
      res.json(expenseRequestsWithEmployee);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get pending expense requests' });
    }
  });

  // Manager Approvals - Approve leave request
  app.post('/api/manager/leaves/:id/approve', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const { comments } = req.body;
      const leaveRequest = await storage.getLeaveRequest(req.params.id);
      if (!leaveRequest) {
        return res.status(404).json({ error: 'Leave request not found' });
      }
      
      const user = await storage.getUser(userId);
      const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
      
      if (!isAdmin) {
        const employee = await storage.getEmployee(leaveRequest.employeeId);
        if (!employee || employee.managerUserId !== userId) {
          return res.status(403).json({ error: 'Not authorized to approve this request' });
        }
      }
      
      const updated = await storage.updateLeaveRequest(req.params.id, {
        status: 'approved',
        managerId: userId,
        managerComments: comments,
        approvedAt: new Date()
      });
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: 'Failed to approve leave request' });
    }
  });

  // Manager Approvals - Reject leave request
  app.post('/api/manager/leaves/:id/reject', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const { comments } = req.body;
      const leaveRequest = await storage.getLeaveRequest(req.params.id);
      if (!leaveRequest) {
        return res.status(404).json({ error: 'Leave request not found' });
      }
      
      const user = await storage.getUser(userId);
      const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
      
      if (!isAdmin) {
        const employee = await storage.getEmployee(leaveRequest.employeeId);
        if (!employee || employee.managerUserId !== userId) {
          return res.status(403).json({ error: 'Not authorized to reject this request' });
        }
      }
      
      const updated = await storage.updateLeaveRequest(req.params.id, {
        status: 'rejected',
        managerId: userId,
        managerComments: comments,
        approvedAt: new Date()
      });
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: 'Failed to reject leave request' });
    }
  });

  // Manager Approvals - Approve advance request
  app.post('/api/manager/advances/:id/approve', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const { comments } = req.body;
      const advanceRequest = await storage.getSalaryAdvanceRequest(req.params.id);
      if (!advanceRequest) {
        return res.status(404).json({ error: 'Advance request not found' });
      }
      
      const user = await storage.getUser(userId);
      const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
      
      if (!isAdmin) {
        const employee = await storage.getEmployee(advanceRequest.employeeId);
        if (!employee || employee.managerUserId !== userId) {
          return res.status(403).json({ error: 'Not authorized to approve this request' });
        }
      }
      
      const updated = await storage.updateSalaryAdvanceRequest(req.params.id, {
        status: 'approved',
        approvedAmount: advanceRequest.amount
      });
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: 'Failed to approve advance request' });
    }
  });

  // Manager Approvals - Reject advance request
  app.post('/api/manager/advances/:id/reject', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const { comments } = req.body;
      const advanceRequest = await storage.getSalaryAdvanceRequest(req.params.id);
      if (!advanceRequest) {
        return res.status(404).json({ error: 'Advance request not found' });
      }
      
      const user = await storage.getUser(userId);
      const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
      
      if (!isAdmin) {
        const employee = await storage.getEmployee(advanceRequest.employeeId);
        if (!employee || employee.managerUserId !== userId) {
          return res.status(403).json({ error: 'Not authorized to reject this request' });
        }
      }
      
      const updated = await storage.updateSalaryAdvanceRequest(req.params.id, {
        status: 'rejected'
      });
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: 'Failed to reject advance request' });
    }
  });

  // Manager Approvals - Approve expense request
  app.post('/api/manager/expenses/:id/approve', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const { comments } = req.body;
      const expenseRequest = await storage.getExpenseReimbursement(req.params.id);
      if (!expenseRequest) {
        return res.status(404).json({ error: 'Expense request not found' });
      }
      
      const user = await storage.getUser(userId);
      const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
      
      if (!isAdmin) {
        const employee = await storage.getEmployee(expenseRequest.employeeId);
        if (!employee || employee.managerUserId !== userId) {
          return res.status(403).json({ error: 'Not authorized to approve this request' });
        }
      }
      
      const updated = await storage.updateExpenseReimbursement(req.params.id, {
        status: 'approved',
        approvedBy: userId,
        approvedAmount: expenseRequest.amount,
        managerComments: comments,
        approvedAt: new Date()
      });
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: 'Failed to approve expense request' });
    }
  });

  // Manager Approvals - Reject expense request
  app.post('/api/manager/expenses/:id/reject', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const { comments } = req.body;
      const expenseRequest = await storage.getExpenseReimbursement(req.params.id);
      if (!expenseRequest) {
        return res.status(404).json({ error: 'Expense request not found' });
      }
      
      const user = await storage.getUser(userId);
      const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
      
      if (!isAdmin) {
        const employee = await storage.getEmployee(expenseRequest.employeeId);
        if (!employee || employee.managerUserId !== userId) {
          return res.status(403).json({ error: 'Not authorized to reject this request' });
        }
      }
      
      const updated = await storage.updateExpenseReimbursement(req.params.id, {
        status: 'rejected',
        approvedBy: userId,
        managerComments: comments,
        approvedAt: new Date()
      });
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: 'Failed to reject expense request' });
    }
  });

  // Admin Routes - Create Employee (Superadmin only)
  app.post('/api/admin/employees', async (req, res) => {
    const auth = await verifyAdminAccess(req, res);
    if (!auth) return;
    
    const userId = (req.session as any).userId;
    const user = await storage.getUser(userId);
    if (!user || user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmin can create employees' });
    }
    
    try {
      const { name, email, phone, joinDate, designation, department, salary, address, emergencyContact, managerUserId, bankAccountNumber, bankIfscCode, panNumber, duties, responsibilities, totalLeavesPerYear } = req.body;
      
      if (!name || !email || !joinDate || !designation || !salary || !address || !emergencyContact) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: 'User with this email already exists' });
      }
      
      if (managerUserId) {
        const manager = await storage.getUser(managerUserId);
        if (!manager) {
          return res.status(400).json({ error: 'Selected manager does not exist' });
        }
        const validManagerRoles = ['admin', 'superadmin', 'manager'];
        if (!validManagerRoles.includes(manager.role)) {
          return res.status(400).json({ error: 'Selected user is not a valid manager' });
        }
      }
      
      const employeeCode = await storage.generateEmployeeCode();
      
      const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$%';
      let generatedPassword = '';
      for (let i = 0; i < 12; i++) {
        generatedPassword += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      
      const hashedPassword = await bcrypt.hash(generatedPassword, 10);
      
      const result = await storage.createEmployeeWithUser({
        name,
        employeeId: employeeCode,
        email,
        phone,
        joinDate,
        designation,
        department,
        salary: salary.toString(),
        address,
        emergencyContact,
        managerUserId: managerUserId || null,
        bankAccountNumber,
        bankIfscCode,
        panNumber,
        duties,
        responsibilities,
        totalLeavesPerYear: totalLeavesPerYear || 24,
      }, hashedPassword);
      
      res.json({
        employee: result.employee,
        credentials: {
          employeeId: employeeCode,
          email: email,
          temporaryPassword: generatedPassword
        }
      });
    } catch (error: any) {
      console.error('Employee creation error:', error);
      res.status(400).json({ error: error.message || 'Failed to create employee' });
    }
  });

  // Get all managers (for manager assignment dropdown)
  app.get('/api/admin/managers', async (req, res) => {
    const auth = await verifyAdminAccess(req, res);
    if (!auth) return;
    
    try {
      const allUsers = await storage.getAllUsers();
      const managers = allUsers.filter(u => 
        u.role === 'admin' || u.role === 'superadmin' || u.role === 'manager'
      );
      res.json(managers.map(m => ({ id: m.id, name: m.name, email: m.email, role: m.role })));
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch managers' });
    }
  });

  // Get users without employee records (for linking feature)
  app.get('/api/admin/users-without-employee', async (req, res) => {
    const auth = await verifyAdminAccess(req, res);
    if (!auth) return;
    
    try {
      const usersWithoutEmployee = await storage.getUsersWithoutEmployeeRecord();
      res.json(usersWithoutEmployee.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role })));
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch users without employee records' });
    }
  });

  // Create employee for existing user (link user to employee record)
  app.post('/api/admin/link-user-to-employee', async (req, res) => {
    const auth = await verifyAdminAccess(req, res);
    if (!auth) return;
    
    try {
      const { 
        userId,
        phone,
        dateOfBirth,
        photoUrl,
        joinDate,
        designation,
        department,
        salary,
        address,
        emergencyContact,
        managerUserId,
        bankAccountNumber,
        bankIfscCode,
        panNumber,
        duties,
        responsibilities,
        totalLeavesPerYear
      } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }
      
      if (!phone || !designation || !salary || !address || !emergencyContact || !joinDate) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const existingEmployee = await storage.getEmployeeByUserId(userId);
      if (existingEmployee) {
        return res.status(400).json({ error: 'User already has an employee record' });
      }
      
      const employeeId = await storage.generateEmployeeCode();
      
      const employee = await storage.createEmployee({
        employeeId,
        name: user.name,
        email: user.email,
        phone,
        dateOfBirth: dateOfBirth || null,
        photoUrl: photoUrl || null,
        joinDate,
        designation,
        department: department || null,
        salary: salary.toString(),
        address,
        emergencyContact,
        userId: userId,
        managerUserId: managerUserId || null,
        bankAccountNumber: bankAccountNumber || null,
        bankIfscCode: bankIfscCode || null,
        panNumber: panNumber || null,
        duties: duties || null,
        responsibilities: responsibilities || null,
        totalLeavesPerYear: totalLeavesPerYear || 24,
      });
      
      await storage.grantUserPermission(userId, 'employee-portal');
      
      res.json({ employee, user });
    } catch (error) {
      console.error('Error linking user to employee:', error);
      res.status(400).json({ error: 'Failed to create employee record for user' });
    }
  });

  // Admin Routes - Manage Expense Reimbursements
  app.get('/api/admin/expense-reimbursements', async (req, res) => {
    const auth = await verifyAdminAccess(req, res);
    if (!auth) return;
    const reimbursements = await storage.getAllExpenseReimbursements();
    res.json(reimbursements);
  });

  app.patch('/api/admin/expense-reimbursements/:id', async (req, res) => {
    const auth = await verifyAdminAccess(req, res);
    if (!auth) return;
    try {
      const reimbursement = await storage.updateExpenseReimbursement(req.params.id, req.body);
      res.json(reimbursement);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update expense reimbursement' });
    }
  });

  app.get('/api/admin/expense-reimbursements/approved', async (req, res) => {
    const auth = await verifyAdminAccess(req, res);
    if (!auth) return;
    try {
      const allExpenses = await storage.getAllExpenseReimbursements();
      const approved = allExpenses.filter(e => e.status === 'approved');
      const employees = await storage.getAllEmployees();
      const withNames = approved.map(exp => ({
        ...exp,
        employeeName: employees.find(e => e.id === exp.employeeId)?.name || 'Unknown'
      }));
      res.json(withNames);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch approved expenses' });
    }
  });

  app.get('/api/admin/approved-payouts', async (req, res) => {
    const auth = await verifyAdminAccess(req, res);
    if (!auth) return;
    try {
      const allExpenses = await storage.getAllExpenseReimbursements();
      const approvedExpenses = allExpenses.filter(e => e.status === 'approved');
      
      const allAdvances = await storage.getAllSalaryAdvanceRequests();
      const approvedAdvances = allAdvances.filter((a: any) => a.status === 'approved');
      
      const employees = await storage.getAllEmployees();
      
      const payouts = [
        ...approvedExpenses.map(exp => ({
          id: exp.id,
          type: 'expense' as const,
          employeeId: exp.employeeId,
          employeeName: employees.find(e => e.id === exp.employeeId)?.name || 'Unknown',
          amount: exp.amount,
          description: exp.description,
          category: exp.category,
          date: exp.expenseDate,
          approvedAt: exp.approvedAt,
        })),
        ...approvedAdvances.map((adv: any) => ({
          id: adv.id,
          type: 'advance' as const,
          employeeId: adv.employeeId,
          employeeName: employees.find(e => e.id === adv.employeeId)?.name || 'Unknown',
          amount: adv.amount,
          description: adv.reason || 'Salary Advance',
          category: 'Salary Advance',
          date: adv.requestDate,
          approvedAt: adv.approvedAt,
        })),
      ].sort((a, b) => new Date(b.approvedAt || 0).getTime() - new Date(a.approvedAt || 0).getTime());
      
      res.json(payouts);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch approved payouts' });
    }
  });

  app.post('/api/admin/approved-payouts/:id/push-to-daybook', async (req, res) => {
    const auth = await verifyAdminAccess(req, res);
    if (!auth) return;
    try {
      const { type, eventId, category, bankId } = req.body;
      const recordId = req.params.id;
      
      // Server-side validation: verify the record exists and matches the claimed type
      const expense = await storage.getExpenseReimbursement(recordId);
      const advance = await storage.getSalaryAdvanceRequest(recordId);
      
      // Determine actual record type from server data
      let actualType: 'expense' | 'advance' | null = null;
      if (expense && expense.status === 'approved') actualType = 'expense';
      else if (advance && advance.status === 'approved') actualType = 'advance';
      
      if (!actualType) {
        return res.status(404).json({ error: 'No approved record found with this ID' });
      }
      
      // Verify client type matches server data for safety
      if (type !== actualType) {
        return res.status(400).json({ error: 'Record type mismatch' });
      }
      
      const paidDate = new Date().toISOString().split('T')[0];
      
      if (actualType === 'expense' && expense) {
        const employee = await storage.getEmployee(expense.employeeId);
        
        // Create daybook entry first
        const daybookEntry = await storage.createDaybookEntry({
          date: expense.expenseDate,
          description: `Employee Expense (${employee?.name || 'Unknown'}): ${expense.description}`,
          type: 'expense',
          amount: String(expense.amount),
          category: category || expense.category || 'Other Expenses',
          bankId: bankId || null,
          eventId: eventId || null
        });
        
        // Update bank balance if bank is selected
        if (bankId) {
          const bank = await storage.getBank(bankId);
          if (bank) {
            const amount = parseFloat(String(expense.amount));
            const newBalance = parseFloat(bank.balance) - amount;
            await storage.updateBank(bankId, { balance: newBalance.toString() });
          }
        }
        
        // Mark as paid after successful daybook entry
        await storage.updateExpenseReimbursement(recordId, {
          status: 'paid',
          paidDate
        });
        
        res.json({ daybookEntry, type: 'expense' });
      } else if (actualType === 'advance' && advance) {
        const employee = await storage.getEmployee(advance.employeeId);
        
        // Create daybook entry first
        const daybookEntry = await storage.createDaybookEntry({
          date: advance.requestDate,
          description: `Salary Advance (${employee?.name || 'Unknown'}): ${advance.reason || 'N/A'}`,
          type: 'expense',
          amount: String(advance.amount),
          category: category || 'Salary Advance',
          bankId: bankId || null,
          eventId: eventId || null
        });
        
        // Update bank balance if bank is selected
        if (bankId) {
          const bank = await storage.getBank(bankId);
          if (bank) {
            const amount = parseFloat(String(advance.amount));
            const newBalance = parseFloat(bank.balance) - amount;
            await storage.updateBank(bankId, { balance: newBalance.toString() });
          }
        }
        
        // Mark as paid after successful daybook entry
        await storage.updateSalaryAdvanceRequest(recordId, {
          status: 'paid',
          paidDate
        });
        
        res.json({ daybookEntry, type: 'advance' });
      }
    } catch (error) {
      console.error('Push to daybook error:', error);
      res.status(400).json({ error: 'Failed to push to daybook' });
    }
  });

  app.post('/api/admin/expense-reimbursements/:id/push-to-daybook', async (req, res) => {
    const auth = await verifyAdminAccess(req, res);
    if (!auth) return;
    try {
      const expense = await storage.getExpenseReimbursement(req.params.id);
      if (!expense) {
        return res.status(404).json({ error: 'Expense reimbursement not found' });
      }
      if (expense.status !== 'approved') {
        return res.status(400).json({ error: 'Only approved expenses can be pushed to daybook' });
      }

      const { eventId, category } = req.body;
      const employee = await storage.getEmployee(expense.employeeId);
      
      const daybookEntry = await storage.createDaybookEntry({
        date: expense.expenseDate,
        description: `Employee Expense (${employee?.name || 'Unknown'}): ${expense.description}`,
        type: 'expense',
        amount: String(expense.amount),
        category: category || expense.category || 'Other Expenses',
        bankId: null,
        eventId: eventId || null
      });

      await storage.updateExpenseReimbursement(req.params.id, {
        status: 'paid',
        paidDate: new Date().toISOString().split('T')[0]
      });

      res.json({ daybookEntry, expense: { ...expense, status: 'paid' } });
    } catch (error) {
      console.error('Push to daybook error:', error);
      res.status(400).json({ error: 'Failed to push expense to daybook' });
    }
  });

  // Public Holidays (Superadmin only for management, all users can view)
  app.get('/api/public-holidays', async (req, res) => {
    const { year } = req.query;
    if (year) {
      const holidays = await storage.getPublicHolidaysByYear(parseInt(year as string));
      res.json(holidays);
    } else {
      const holidays = await storage.getAllPublicHolidays();
      res.json(holidays);
    }
  });

  app.post('/api/public-holidays', async (req, res) => {
    const auth = await verifyAdminAccess(req, res);
    if (!auth) return;
    
    // Verify superadmin role
    const userId = (req.session as any).userId;
    const user = await storage.getUser(userId);
    if (!user || user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmin can manage public holidays' });
    }
    
    try {
      const data = {
        ...req.body,
        createdBy: userId
      };
      const holiday = await storage.createPublicHoliday(data);
      res.json(holiday);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create public holiday' });
    }
  });

  app.patch('/api/public-holidays/:id', async (req, res) => {
    const auth = await verifyAdminAccess(req, res);
    if (!auth) return;
    
    // Verify superadmin role
    const userId = (req.session as any).userId;
    const user = await storage.getUser(userId);
    if (!user || user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmin can manage public holidays' });
    }
    
    try {
      const holiday = await storage.updatePublicHoliday(req.params.id, req.body);
      res.json(holiday);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update public holiday' });
    }
  });

  app.delete('/api/public-holidays/:id', async (req, res) => {
    const auth = await verifyAdminAccess(req, res);
    if (!auth) return;
    
    // Verify superadmin role
    const userId = (req.session as any).userId;
    const user = await storage.getUser(userId);
    if (!user || user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmin can manage public holidays' });
    }
    
    await storage.deletePublicHoliday(req.params.id);
    res.json({ success: true });
  });

  // Leave Categories (Superadmin only for management, all users can view)
  app.get('/api/leave-categories', async (req, res) => {
    const categories = await storage.getAllLeaveCategories();
    res.json(categories);
  });

  app.post('/api/leave-categories', async (req, res) => {
    const auth = await verifyAdminAccess(req, res);
    if (!auth) return;
    
    // Verify superadmin role
    const userId = (req.session as any).userId;
    const user = await storage.getUser(userId);
    if (!user || user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmin can manage leave categories' });
    }
    
    try {
      const { name, description, defaultAnnualAllowance } = req.body;
      const category = await storage.createLeaveCategory({
        name,
        description,
        defaultAnnualAllowance: defaultAnnualAllowance || 12,
        isSystem: false,
        createdBy: userId
      });
      res.json(category);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create leave category' });
    }
  });

  app.patch('/api/leave-categories/:id', async (req, res) => {
    const auth = await verifyAdminAccess(req, res);
    if (!auth) return;
    
    // Verify superadmin role
    const userId = (req.session as any).userId;
    const user = await storage.getUser(userId);
    if (!user || user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmin can manage leave categories' });
    }
    
    try {
      const category = await storage.getLeaveCategory(req.params.id);
      if (category?.isSystem) {
        // Only allow updating allowance for system categories
        const { defaultAnnualAllowance } = req.body;
        const updated = await storage.updateLeaveCategory(req.params.id, { defaultAnnualAllowance });
        return res.json(updated);
      }
      
      const updated = await storage.updateLeaveCategory(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update leave category' });
    }
  });

  app.delete('/api/leave-categories/:id', async (req, res) => {
    const auth = await verifyAdminAccess(req, res);
    if (!auth) return;
    
    // Verify superadmin role
    const userId = (req.session as any).userId;
    const user = await storage.getUser(userId);
    if (!user || user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmin can manage leave categories' });
    }
    
    try {
      const category = await storage.getLeaveCategory(req.params.id);
      if (category?.isSystem) {
        return res.status(400).json({ error: 'Cannot delete system leave categories' });
      }
      
      await storage.deleteLeaveCategory(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: 'Failed to delete leave category' });
    }
  });

  // Employee Leave Balances (Superadmin can view/edit all, employees can view their own)
  app.get('/api/employee-leave-balances', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    
    const { employeeId, year } = req.query;
    const currentYear = year ? parseInt(year as string) : new Date().getFullYear();
    
    if (user.role === 'superadmin' || user.role === 'admin') {
      if (employeeId) {
        const balances = await storage.getEmployeeLeaveBalancesByYear(employeeId as string, currentYear);
        return res.json(balances);
      } else {
        const balances = await storage.getAllEmployeeLeaveBalancesForYear(currentYear);
        return res.json(balances);
      }
    } else {
      // Regular employee - only their own balances
      const employee = await storage.getEmployeeByUserId(userId);
      if (!employee) {
        return res.status(404).json({ error: 'Employee profile not found' });
      }
      const balances = await storage.getEmployeeLeaveBalancesByYear(employee.id, currentYear);
      return res.json(balances);
    }
  });

  app.post('/api/employee-leave-balances/initialize', async (req, res) => {
    const auth = await verifyAdminAccess(req, res);
    if (!auth) return;
    
    try {
      const { employeeId, year } = req.body;
      const currentYear = year || new Date().getFullYear();
      const balances = await storage.initializeEmployeeLeaveBalances(employeeId, currentYear);
      res.json(balances);
    } catch (error) {
      res.status(400).json({ error: 'Failed to initialize leave balances' });
    }
  });

  app.patch('/api/employee-leave-balances/adjust', async (req, res) => {
    const auth = await verifyAdminAccess(req, res);
    if (!auth) return;
    
    // Verify superadmin role
    const userId = (req.session as any).userId;
    const user = await storage.getUser(userId);
    if (!user || user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmin can adjust leave balances' });
    }
    
    try {
      const { employeeId, categoryId, year, allocated, reason } = req.body;
      
      if (!employeeId || !categoryId || !year || allocated === undefined) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      
      const balance = await storage.adjustEmployeeLeaveBalance(
        employeeId,
        categoryId,
        year,
        allocated,
        reason || 'Manual adjustment by superadmin',
        userId
      );
      res.json(balance);
    } catch (error) {
      console.error('Error adjusting leave balance:', error);
      res.status(400).json({ error: 'Failed to adjust leave balance' });
    }
  });

  // Get leave balance adjustments history for an employee
  app.get('/api/employee-leave-balances/:employeeId/adjustments', async (req, res) => {
    const auth = await verifyAdminAccess(req, res);
    if (!auth) return;
    
    try {
      const adjustments = await storage.getLeaveBalanceAdjustments(req.params.employeeId);
      res.json(adjustments);
    } catch (error) {
      res.status(400).json({ error: 'Failed to fetch adjustment history' });
    }
  });

  // Admin - Assign manager to employee
  app.patch('/api/admin/employees/:id/manager', async (req, res) => {
    const auth = await verifyAdminAccess(req, res);
    if (!auth) return;
    
    try {
      const { managerUserId } = req.body;
      const employee = await storage.updateEmployee(req.params.id, { managerUserId });
      res.json(employee);
    } catch (error) {
      res.status(400).json({ error: 'Failed to assign manager' });
    }
  });

  // Admin - Update employee duties and responsibilities
  app.patch('/api/admin/employees/:id/duties', async (req, res) => {
    const auth = await verifyAdminAccess(req, res);
    if (!auth) return;
    
    try {
      const { duties, responsibilities } = req.body;
      const employee = await storage.updateEmployee(req.params.id, { duties, responsibilities });
      res.json(employee);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update duties' });
    }
  });

  // Superadmin - Toggle employee active status
  app.patch('/api/admin/employees/:id/status', async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const user = await storage.getUser(userId);
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Only superadmin can change employee status' });
      }
      
      const { isActive, leaveDate } = req.body;
      const updateData: any = { isActive };
      if (leaveDate !== undefined) {
        updateData.leaveDate = leaveDate;
      }
      
      const employee = await storage.updateEmployee(req.params.id, updateData);
      res.json(employee);
    } catch (error) {
      console.error('Error updating employee status:', error);
      res.status(400).json({ error: 'Failed to update employee status' });
    }
  });

  // Event Milestones
  app.get('/api/milestones', async (req, res) => {
    const { eventId } = req.query;
    if (eventId) {
      const milestones = await storage.getMilestonesByEventId(eventId as string);
      res.json(milestones);
    } else {
      const milestones = await storage.getAllMilestones();
      res.json(milestones);
    }
  });

  app.post('/api/milestones', async (req, res) => {
    try {
      const data = insertEventMilestoneSchema.parse(req.body);
      const milestone = await storage.createMilestone(data);
      res.json(milestone);
    } catch (error) {
      res.status(400).json({ error: 'Invalid milestone data' });
    }
  });

  app.post('/api/milestones/generate/:eventId', async (req, res) => {
    try {
      const eventId = req.params.eventId;
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      await storage.deleteMilestonesByEventId(eventId);

      const eventDate = new Date(event.date);
      const eventTime = event.time || '18:00';

      const addDays = (date: Date, days: number) => {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result.toISOString().split('T')[0];
      };

      const subtractDays = (date: Date, days: number) => {
        const result = new Date(date);
        result.setDate(result.getDate() - days);
        return result.toISOString().split('T')[0];
      };

      const milestones: InsertEventMilestone[] = [
        { eventId, phase: 1, phaseName: 'Event Kickoff', name: 'Create Client Folder & CRM Entry', date: subtractDays(eventDate, 90), status: 'pending' },
        { eventId, phase: 1, phaseName: 'Event Kickoff', name: 'Internal Kick off Meeting', date: subtractDays(eventDate, 87), status: 'pending' },
        { eventId, phase: 1, phaseName: 'Event Kickoff', name: 'Client Kick off Meeting', date: subtractDays(eventDate, 80), status: 'pending' },
        { eventId, phase: 1, phaseName: 'Event Kickoff', name: 'Venue Recce', date: subtractDays(eventDate, 80), status: 'pending' },

        { eventId, phase: 2, phaseName: 'Design', name: 'Theme & Mood board finalization', date: subtractDays(eventDate, 70), status: 'pending' },
        { eventId, phase: 2, phaseName: 'Design', name: '2D/3D approval', date: subtractDays(eventDate, 60), status: 'pending' },
        { eventId, phase: 2, phaseName: 'Design', name: 'Freeze Decor Design', date: subtractDays(eventDate, 60), status: 'pending' },

        { eventId, phase: 3, phaseName: 'Procurement & Production', name: '2nd Installment Payment', date: subtractDays(eventDate, 60), status: 'pending' },
        { eventId, phase: 3, phaseName: 'Procurement & Production', name: 'Budget approval from client', date: subtractDays(eventDate, 60), status: 'pending' },
        { eventId, phase: 3, phaseName: 'Procurement & Production', name: 'Production / high value purchase', date: subtractDays(eventDate, 60), status: 'pending' },
        { eventId, phase: 3, phaseName: 'Procurement & Production', name: 'Vendor booking', date: subtractDays(eventDate, 60), status: 'pending' },
        { eventId, phase: 3, phaseName: 'Procurement & Production', name: 'Any change request', date: subtractDays(eventDate, 45), status: 'pending' },
        { eventId, phase: 3, phaseName: 'Procurement & Production', name: 'Production File & Checklist', date: subtractDays(eventDate, 45), status: 'pending' },

        { eventId, phase: 4, phaseName: 'Logistics & Coordination', name: 'Printables Design Approval', date: subtractDays(eventDate, 30), status: 'pending' },
        { eventId, phase: 4, phaseName: 'Logistics & Coordination', name: '3rd Installment Payment', date: subtractDays(eventDate, 22), status: 'pending' },
        { eventId, phase: 4, phaseName: 'Logistics & Coordination', name: 'Production/Transportation plans', date: subtractDays(eventDate, 21), status: 'pending' },
        { eventId, phase: 4, phaseName: 'Logistics & Coordination', name: 'Venue coordination call', date: subtractDays(eventDate, 19), status: 'pending' },
        { eventId, phase: 4, phaseName: 'Logistics & Coordination', name: 'Internal Coordination meeting', date: subtractDays(eventDate, 16), status: 'pending' },
        { eventId, phase: 4, phaseName: 'Logistics & Coordination', name: 'Client coordination Meeting', date: subtractDays(eventDate, 15), status: 'pending' },
        { eventId, phase: 4, phaseName: 'Logistics & Coordination', name: 'Vendor coordination meeting', date: subtractDays(eventDate, 13), status: 'pending' },

        { eventId, phase: 5, phaseName: 'Event Week', name: 'Printables to Printer', date: subtractDays(eventDate, 7), status: 'pending' },
        { eventId, phase: 5, phaseName: 'Event Week', name: 'Execution team briefing', date: subtractDays(eventDate, 5), status: 'pending' },
        { eventId, phase: 5, phaseName: 'Event Week', name: 'Final vendor confirmation call', date: subtractDays(eventDate, 4), status: 'pending' },
        { eventId, phase: 5, phaseName: 'Event Week', name: 'Material arrangement warehouse', date: subtractDays(eventDate, 3), status: 'pending' },
        { eventId, phase: 5, phaseName: 'Event Week', name: 'Flower/Rental arrangements', date: subtractDays(eventDate, 2), status: 'pending' },
        { eventId, phase: 5, phaseName: 'Event Week', name: 'Material loading', date: subtractDays(eventDate, 2), status: 'pending' },
        { eventId, phase: 5, phaseName: 'Event Week', name: 'Truck departure', date: subtractDays(eventDate, 2), status: 'pending' },

        { eventId, phase: 6, phaseName: 'Event Day', name: 'Wedding planner Reporting', date: event.date, time: '11:00 am', status: 'pending' },
        { eventId, phase: 6, phaseName: 'Event Day', name: 'Venue Fully Ready', date: event.date, time: '1:00 pm', status: 'pending' },
        { eventId, phase: 6, phaseName: 'Event Day', name: 'Guest Management Team Reporting', date: event.date, time: '2:00 pm', status: 'pending' },

        { eventId, phase: 7, phaseName: 'Packup & Closure', name: 'Demobilisation', date: addDays(eventDate, 1), time: '6:00 pm', status: 'pending' },
        { eventId, phase: 7, phaseName: 'Packup & Closure', name: 'Final payment collection', date: addDays(eventDate, 2), status: 'pending' },
        { eventId, phase: 7, phaseName: 'Packup & Closure', name: 'Vendor settlement', date: addDays(eventDate, 7), status: 'pending' },
        { eventId, phase: 7, phaseName: 'Packup & Closure', name: 'Feedback', date: addDays(eventDate, 8), status: 'pending' },
        { eventId, phase: 7, phaseName: 'Packup & Closure', name: 'Close the event', date: addDays(eventDate, 10), status: 'pending' },
      ];

      const created = await storage.createManyMilestones(milestones);
      res.json(created);
    } catch (error) {
      console.error('Error generating milestones:', error);
      res.status(500).json({ error: 'Failed to generate milestones' });
    }
  });

  app.patch('/api/milestones/:id', async (req, res) => {
    try {
      const milestone = await storage.updateMilestone(req.params.id, req.body);
      res.json(milestone);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update milestone' });
    }
  });

  app.delete('/api/milestones/:id', async (req, res) => {
    await storage.deleteMilestone(req.params.id);
    res.json({ success: true });
  });

  // Backfill milestones for all 2026+ events that don't have any
  app.post('/api/milestones/backfill-2026', async (req, res) => {
    try {
      const allEvents = await storage.getAllEvents();
      const cutoffDate = new Date('2026-01-01');
      
      // Get events from 2026+ that don't have milestones yet
      const eventsToBackfill = allEvents.filter(e => new Date(e.date) >= cutoffDate);
      
      let created = 0;
      let skipped = 0;
      
      for (const event of eventsToBackfill) {
        const existingMilestones = await storage.getMilestonesByEventId(event.id);
        
        if (existingMilestones.length === 0) {
          const milestones = generateMilestonesForEvent(event.id, event.date, event.time);
          await storage.createManyMilestones(milestones);
          created += milestones.length;
          console.log(`Generated ${milestones.length} milestones for event ${event.title}`);
        } else {
          skipped++;
        }
      }
      
      res.json({ 
        message: `Backfill complete`, 
        eventsProcessed: eventsToBackfill.length,
        milestonesCreated: created,
        eventsSkipped: skipped
      });
    } catch (error) {
      console.error('Error backfilling milestones:', error);
      res.status(500).json({ error: 'Failed to backfill milestones' });
    }
  });

  // Get pending milestones for a planner (with event info) - secured by role
  app.get('/api/milestones/pending-by-planner', async (req, res) => {
    try {
      // Get authenticated user
      const userId = (req.session as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(401).json({ error: 'User not found' });
      }
      
      const allMilestones = await storage.getAllMilestones();
      const allEvents = await storage.getAllEvents();
      
      // Filter for events from Jan 1, 2026 onwards
      const cutoffDate = new Date('2026-01-01');
      const eligibleEventIds = new Set(
        allEvents
          .filter(e => new Date(e.date) >= cutoffDate)
          .map(e => e.id)
      );
      
      // Create event lookup map
      const eventMap = new Map(allEvents.map(e => [e.id, e]));
      
      // Filter pending milestones for eligible events
      let pendingMilestones = allMilestones
        .filter(m => m.status === 'pending' && eligibleEventIds.has(m.eventId))
        .map(m => ({
          ...m,
          event: eventMap.get(m.eventId)
        }));
      
      // Role-based filtering: superadmin/admin can see all, others only see their own
      const isAdminOrSuperadmin = currentUser.role === 'superadmin' || currentUser.role === 'admin';
      
      if (!isAdminOrSuperadmin) {
        // Non-admin users only see milestones for events where they are the planner
        pendingMilestones = pendingMilestones.filter(m => 
          m.event?.planner?.toLowerCase() === currentUser.name?.toLowerCase()
        );
      }
      
      // Sort by milestone date (ascending - most urgent first)
      pendingMilestones.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      res.json(pendingMilestones);
    } catch (error) {
      console.error('Error fetching pending milestones by planner:', error);
      res.status(500).json({ error: 'Failed to fetch pending milestones' });
    }
  });

  // Oak Book - Customers
  app.get('/api/customers', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const user = await storage.getUser(req.session.userId);
    let customers = await storage.getAllCustomers();
    
    // Wedding planners only see their own customers
    if (user?.role === 'wedding_planner') {
      customers = customers.filter(c => c.weddingPlannerId === req.session.userId);
    }
    
    res.json(customers);
  });

  app.get('/api/customers/:id', async (req, res) => {
    const customer = await storage.getCustomer(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(customer);
  });

  app.post('/api/customers', async (req, res) => {
    try {
      const data = insertCustomerSchema.parse(req.body);
      
      // Auto-generate customer code (OAKS-C-YY-XXXX format)
      const customerCode = await generateCustomerCode();
      
      // Insert customer with generated code using transaction
      const [customer] = await db.insert(customers)
        .values({ ...data, customerCode })
        .returning();
      
      console.log(`Created customer ${customer.name} with code ${customerCode}`);
      res.json(customer);
    } catch (error) {
      console.error('Error creating customer:', error);
      res.status(400).json({ error: 'Invalid customer data' });
    }
  });

  app.patch('/api/customers/:id', async (req, res) => {
    try {
      // Remove customerCode from update payload - codes are read-only
      const { customerCode, ...updateData } = req.body;
      const customer = await storage.updateCustomer(req.params.id, updateData);
      res.json(customer);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update customer' });
    }
  });

  app.delete('/api/customers/:id', async (req, res) => {
    await storage.deleteCustomer(req.params.id);
    res.json({ success: true });
  });

  // Generate next customer code preview (OAKS-C-YY-XXXX format)
  // Note: Actual code is auto-generated on customer creation
  app.get('/api/customers/next-code', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const customerCode = await generateCustomerCode();
      res.json({ customerCode });
    } catch (error) {
      console.error('Error generating customer code:', error);
      res.status(500).json({ error: 'Failed to generate customer code' });
    }
  });

  // Get leads with advance payment received but not yet converted to customer
  app.get('/api/customers/pending-from-leads', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const deals = await storage.getSalesDeals();
      const pendingDeals = deals.filter(d => 
        d.advancePaymentReceived === true && 
        d.convertedToCustomer !== true
      );
      
      // Enrich with contact and owner info
      const enrichedDeals = await Promise.all(pendingDeals.map(async (deal) => {
        let contact = null;
        let owner = null;
        if (deal.contactId) {
          contact = await storage.getSalesContact(deal.contactId);
        }
        if (deal.ownerId) {
          owner = await storage.getUser(deal.ownerId);
        }
        return { ...deal, contact, owner };
      }));
      
      res.json(enrichedDeals);
    } catch (error) {
      console.error('Error fetching pending leads for customer creation:', error);
      res.status(500).json({ error: 'Failed to fetch pending leads' });
    }
  });

  // Create customer from lead (controlled workflow)
  app.post('/api/customers/from-lead', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
      const { leadId, name, phone, billingAddress, state, country, weddingPlannerId } = req.body;
      
      if (!leadId || !name || !phone || !billingAddress || !state) {
        return res.status(400).json({ error: 'Missing required fields: name, phone, billingAddress, state' });
      }
      
      // Check if lead exists
      const deal = await storage.getSalesDeal(leadId);
      if (!deal) {
        return res.status(404).json({ error: 'Lead not found' });
      }
      
      // Check if already converted to prevent duplicates
      if (deal.convertedToCustomer === true) {
        return res.status(400).json({ error: 'Lead already converted to customer' });
      }
      
      // Generate customer code
      const year = new Date().getFullYear().toString().slice(-2);
      const allCustomers = await storage.getAllCustomers();
      const yearPrefix = `OAK-${year}-`;
      const thisYearCustomers = allCustomers.filter(c => c.customerCode?.startsWith(yearPrefix));
      const nextNumber = (thisYearCustomers.length + 1).toString().padStart(4, '0');
      const customerCode = `${yearPrefix}${nextNumber}`;
      
      // Create customer
      const customer = await storage.createCustomer({
        name,
        phone,
        billingAddress,
        state,
        country: country || 'India',
        leadId,
        weddingPlannerId: weddingPlannerId || deal.ownerId,
      });
      
      // Update customer with customer code (since it's omitted from insert schema)
      await storage.updateCustomer(customer.id, { customerCode });
      
      // Mark lead as converted to customer
      await storage.updateSalesDeal(leadId, { 
        convertedToCustomer: true,
        customerId: customer.id
      });
      
      // Log the action
      await db.insert(customerCreationLogs).values({
        customerId: customer.id,
        leadId,
        accountantId: req.session.userId,
        status: 'created'
      });
      
      // Get the updated customer
      const updatedCustomer = await storage.getCustomer(customer.id);
      
      // Send WhatsApp notification to wedding planner
      const planner = weddingPlannerId ? await storage.getUser(weddingPlannerId) : 
                      deal.ownerId ? await storage.getUser(deal.ownerId) : null;
      
      if (planner) {
        const eventDate = deal.eventDate ? new Date(deal.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'TBD';
        const message = `Customer Created:\n${name}\nCustomer ID: ${customerCode}\nEvent Date: ${eventDate}\nYou may begin event kickoff.`;
        
        // Queue WhatsApp notification via Oaksy
        console.log(`[Customer Created] Notification to ${planner.name}: ${message}`);
      }
      
      res.json({ 
        success: true, 
        customer: updatedCustomer,
        customerCode 
      });
    } catch (error) {
      console.error('Error creating customer from lead:', error);
      
      // Log the failure
      if (req.body.leadId && req.session.userId) {
        await db.insert(customerCreationLogs).values({
          customerId: 'failed',
          leadId: req.body.leadId,
          accountantId: req.session.userId,
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }).catch(() => {});
      }
      
      res.status(500).json({ error: 'Failed to create customer from lead' });
    }
  });

  // Oak Book - Vendors
  app.get('/api/vendors', async (req, res) => {
    const vendors = await storage.getAllVendors();
    res.json(vendors);
  });

  app.get('/api/vendors/:id', async (req, res) => {
    const vendor = await storage.getVendor(req.params.id);
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }
    res.json(vendor);
  });

  app.post('/api/vendors', async (req, res) => {
    try {
      const data = insertVendorSchema.parse(req.body);
      const vendor = await storage.createVendor(data);
      res.json(vendor);
    } catch (error) {
      res.status(400).json({ error: 'Invalid vendor data' });
    }
  });

  app.patch('/api/vendors/:id', async (req, res) => {
    try {
      const vendor = await storage.updateVendor(req.params.id, req.body);
      res.json(vendor);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update vendor' });
    }
  });

  app.delete('/api/vendors/:id', async (req, res) => {
    await storage.deleteVendor(req.params.id);
    res.json({ success: true });
  });

  // Oak Book - Estimates
  app.get('/api/estimates', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const user = await storage.getUser(req.session.userId);
    let estimates = await storage.getAllEstimates();
    
    // Wedding planners only see estimates for their customers
    if (user?.role === 'wedding_planner') {
      const customers = await storage.getAllCustomers();
      const myCustomerIds = new Set(customers.filter(c => c.weddingPlannerId === req.session.userId).map(c => c.id));
      estimates = estimates.filter(e => e.customerId && myCustomerIds.has(e.customerId));
    }
    
    res.json(estimates);
  });

  app.get('/api/estimates/next-number', async (req, res) => {
    const number = await storage.getNextEstimateNumber();
    res.json({ number });
  });

  app.get('/api/estimates/:id', async (req, res) => {
    const estimate = await storage.getEstimate(req.params.id);
    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found' });
    }
    res.json(estimate);
  });

  app.post('/api/estimates', async (req, res) => {
    try {
      const data = insertEstimateSchema.parse(req.body);
      const estimate = await storage.createEstimate(data);
      res.json(estimate);
    } catch (error) {
      console.error('Estimate creation error:', error);
      res.status(400).json({ error: 'Invalid estimate data' });
    }
  });

  app.patch('/api/estimates/:id', async (req, res) => {
    try {
      const estimate = await storage.updateEstimate(req.params.id, req.body);
      res.json(estimate);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update estimate' });
    }
  });

  app.post('/api/estimates/:id/convert', async (req, res) => {
    try {
      const estimate = await storage.getEstimate(req.params.id);
      if (!estimate) {
        return res.status(404).json({ error: 'Estimate not found' });
      }

      const invoiceNumber = await storage.getNextInvoiceNumber();
      const invoice = await storage.createInvoice({
        number: invoiceNumber,
        customerId: estimate.customerId || null,
        eventId: estimate.eventId || null,
        estimateId: estimate.id,
        date: new Date().toISOString().split('T')[0],
        // Only include dueDate if it has a value
        ...(estimate.dueDate ? { dueDate: estimate.dueDate } : {}),
        status: 'sent',
        lineItems: estimate.lineItems,
        subtotal: estimate.subtotal,
        taxTotal: estimate.taxTotal,
        total: estimate.total,
        balanceDue: estimate.total,
        notes: estimate.notes,
        terms: estimate.terms,
      });

      await storage.updateEstimate(estimate.id, { status: 'converted' });
      res.json(invoice);
    } catch (error) {
      console.error('Convert estimate error:', error);
      res.status(400).json({ error: 'Failed to convert estimate to invoice' });
    }
  });

  app.delete('/api/estimates/:id', async (req, res) => {
    await storage.deleteEstimate(req.params.id);
    res.json({ success: true });
  });

  // Oak Book - Invoices
  app.get('/api/invoices', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const user = await storage.getUser(req.session.userId);
    let invoices = await storage.getAllInvoices();
    
    // Wedding planners only see invoices for their customers
    if (user?.role === 'wedding_planner') {
      const customers = await storage.getAllCustomers();
      const myCustomerIds = new Set(customers.filter(c => c.weddingPlannerId === req.session.userId).map(c => c.id));
      invoices = invoices.filter(i => i.customerId && myCustomerIds.has(i.customerId));
    }
    
    res.json(invoices);
  });

  app.get('/api/invoices/next-number', async (req, res) => {
    const number = await storage.getNextInvoiceNumber();
    res.json({ number });
  });

  app.get('/api/invoices/:id', async (req, res) => {
    const invoice = await storage.getInvoice(req.params.id);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    res.json(invoice);
  });

  app.post('/api/invoices', async (req, res) => {
    try {
      const data = insertInvoiceSchema.parse(req.body);
      const invoice = await storage.createInvoice({
        ...data,
        balanceDue: data.total,
      });
      res.json(invoice);
    } catch (error) {
      console.error('Invoice creation error:', error);
      res.status(400).json({ error: 'Invalid invoice data' });
    }
  });

  app.patch('/api/invoices/:id', async (req, res) => {
    try {
      const invoice = await storage.updateInvoice(req.params.id, req.body);
      res.json(invoice);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update invoice' });
    }
  });

  app.delete('/api/invoices/:id', async (req, res) => {
    await storage.deleteInvoice(req.params.id);
    res.json({ success: true });
  });

  // Oak Book - Customer Payments (Receipts)
  app.get('/api/customer-payments', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const user = await storage.getUser(req.session.userId);
    let payments = await storage.getAllCustomerPayments();
    
    // Wedding planners only see payments for their customers
    if (user?.role === 'wedding_planner') {
      const customers = await storage.getAllCustomers();
      const myCustomerIds = new Set(customers.filter(c => c.weddingPlannerId === req.session.userId).map(c => c.id));
      payments = payments.filter(p => p.customerId && myCustomerIds.has(p.customerId));
    }
    
    res.json(payments);
  });

  app.get('/api/customer-payments/next-number', async (req, res) => {
    const number = await storage.getNextReceiptNumber();
    res.json({ number });
  });

  app.get('/api/customer-payments/:id', async (req, res) => {
    const payment = await storage.getCustomerPayment(req.params.id);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    res.json(payment);
  });

  app.post('/api/customer-payments', async (req, res) => {
    try {
      // Clean up the data before validation
      const cleanedData = {
        ...req.body,
        // Convert empty strings to null for optional fields
        customerId: req.body.customerId || null,
        invoiceId: req.body.invoiceId || null,
        bankId: req.body.bankId || null,
        eventId: req.body.eventId || null,
        reference: req.body.reference || null,
        notes: req.body.notes || null,
      };
      
      const data = insertCustomerPaymentSchema.parse(cleanedData);
      let customerName = 'Customer';
      if (data.customerId) {
        const customer = await storage.getCustomer(data.customerId);
        if (customer) customerName = customer.name;
      }
      const payment = await storage.createCustomerPaymentWithDaybook(data, customerName);
      res.json(payment);
    } catch (error: any) {
      console.error('Customer payment error:', error);
      if (error.name === 'ZodError') {
        console.error('Validation errors:', JSON.stringify(error.errors, null, 2));
        res.status(400).json({ error: 'Invalid payment data', details: error.errors });
      } else {
        res.status(400).json({ error: 'Invalid payment data', details: String(error) });
      }
    }
  });

  app.delete('/api/customer-payments/:id', async (req, res) => {
    await storage.deleteCustomerPayment(req.params.id);
    res.json({ success: true });
  });

  // Oak Book - Expenses
  app.get('/api/expenses', async (req, res) => {
    const expenses = await storage.getAllExpenses();
    res.json(expenses);
  });

  app.get('/api/expenses/next-number', async (req, res) => {
    const number = await storage.getNextExpenseNumber();
    res.json({ number });
  });

  app.get('/api/expenses/:id', async (req, res) => {
    const expense = await storage.getExpense(req.params.id);
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    res.json(expense);
  });

  app.post('/api/expenses', async (req, res) => {
    try {
      const data = insertExpenseSchema.parse(req.body);
      let vendorName = 'Vendor';
      if (data.vendorId) {
        const vendor = await storage.getVendor(data.vendorId);
        if (vendor) vendorName = vendor.name;
      }
      const expense = await storage.createExpenseWithDaybook(data, vendorName);
      res.json(expense);
    } catch (error) {
      console.error('Expense creation error:', error);
      res.status(400).json({ error: 'Invalid expense data' });
    }
  });

  app.patch('/api/expenses/:id', async (req, res) => {
    try {
      const expense = await storage.updateExpense(req.params.id, req.body);
      res.json(expense);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update expense' });
    }
  });

  app.delete('/api/expenses/:id', async (req, res) => {
    await storage.deleteExpense(req.params.id);
    res.json({ success: true });
  });

  // Oak Book - Vendor Payments
  app.get('/api/vendor-payments', async (req, res) => {
    const payments = await storage.getAllVendorPayments();
    res.json(payments);
  });

  app.get('/api/vendor-payments/next-number', async (req, res) => {
    const number = await storage.getNextVendorPaymentNumber();
    res.json({ number });
  });

  app.get('/api/vendor-payments/:id', async (req, res) => {
    const payment = await storage.getVendorPayment(req.params.id);
    if (!payment) {
      return res.status(404).json({ error: 'Vendor payment not found' });
    }
    res.json(payment);
  });

  app.post('/api/vendor-payments', async (req, res) => {
    try {
      const data = insertVendorPaymentSchema.parse(req.body);
      let vendorName = 'Vendor';
      if (data.vendorId) {
        const vendor = await storage.getVendor(data.vendorId);
        if (vendor) vendorName = vendor.name;
      }
      const payment = await storage.createVendorPaymentWithDaybook(data, vendorName);
      res.json(payment);
    } catch (error) {
      console.error('Vendor payment error:', error);
      res.status(400).json({ error: 'Invalid vendor payment data' });
    }
  });

  app.delete('/api/vendor-payments/:id', async (req, res) => {
    await storage.deleteVendorPayment(req.params.id);
    res.json({ success: true });
  });

  // Oak Book - Items
  app.get('/api/items', async (req, res) => {
    const itemsList = await storage.getAllItems();
    res.json(itemsList);
  });

  app.get('/api/items/:id', async (req, res) => {
    const item = await storage.getItem(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(item);
  });

  app.post('/api/items', async (req, res) => {
    try {
      const item = await storage.createItem(req.body);
      res.json(item);
    } catch (error) {
      console.error('Item error:', error);
      res.status(400).json({ error: 'Invalid item data' });
    }
  });

  app.patch('/api/items/:id', async (req, res) => {
    const item = await storage.updateItem(req.params.id, req.body);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(item);
  });

  app.delete('/api/items/:id', async (req, res) => {
    await storage.deleteItem(req.params.id);
    res.json({ success: true });
  });

  // Oak Book - Bills
  app.get('/api/bills', async (req, res) => {
    const billsList = await storage.getAllBills();
    res.json(billsList);
  });

  app.get('/api/bills/next-number', async (req, res) => {
    const number = await storage.getNextBillNumber();
    res.json({ number });
  });

  app.get('/api/bills/:id', async (req, res) => {
    const bill = await storage.getBill(req.params.id);
    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }
    res.json(bill);
  });

  app.post('/api/bills', async (req, res) => {
    try {
      const bill = await storage.createBill(req.body);
      res.json(bill);
    } catch (error) {
      console.error('Bill error:', error);
      res.status(400).json({ error: 'Invalid bill data' });
    }
  });

  app.patch('/api/bills/:id', async (req, res) => {
    const bill = await storage.updateBill(req.params.id, req.body);
    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }
    res.json(bill);
  });

  app.delete('/api/bills/:id', async (req, res) => {
    await storage.deleteBill(req.params.id);
    res.json({ success: true });
  });

  // Oak Book - Company Settings
  app.get('/api/company-settings', async (req, res) => {
    const settings = await storage.getCompanySettings();
    res.json(settings);
  });

  app.patch('/api/company-settings', async (req, res) => {
    try {
      const settings = await storage.updateCompanySettings(req.body);
      res.json(settings);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update company settings' });
    }
  });

  // Oak Book - Document Sequences
  app.get('/api/document-sequences', async (req, res) => {
    const sequences = await storage.getAllDocumentSequences();
    res.json(sequences);
  });

  app.get('/api/document-sequences/:type/next', async (req, res) => {
    try {
      const number = await storage.getNextDocumentNumber(req.params.type);
      res.json({ number });
    } catch (error) {
      res.status(400).json({ error: 'Failed to get next document number' });
    }
  });

  app.patch('/api/document-sequences/:type', async (req, res) => {
    try {
      const sequence = await storage.updateDocumentSequence(req.params.type, req.body);
      res.json(sequence);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update document sequence' });
    }
  });

  // Oak Book - Estimate Templates
  app.get('/api/estimate-templates', async (req, res) => {
    const templates = await storage.getAllEstimateTemplates();
    res.json(templates);
  });

  app.get('/api/estimate-templates/:id', async (req, res) => {
    const template = await storage.getEstimateTemplate(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(template);
  });

  app.post('/api/estimate-templates', async (req, res) => {
    try {
      const template = await storage.createEstimateTemplate(req.body);
      res.json(template);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create template' });
    }
  });

  app.patch('/api/estimate-templates/:id', async (req, res) => {
    try {
      const template = await storage.updateEstimateTemplate(req.params.id, req.body);
      res.json(template);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update template' });
    }
  });

  app.delete('/api/estimate-templates/:id', async (req, res) => {
    await storage.deleteEstimateTemplate(req.params.id);
    res.json({ success: true });
  });

  // Oak Book - Clone Estimate
  app.post('/api/estimates/:id/clone', async (req, res) => {
    try {
      const cloned = await storage.cloneEstimate(req.params.id);
      res.json(cloned);
    } catch (error) {
      console.error('Clone estimate error:', error);
      res.status(400).json({ error: 'Failed to clone estimate' });
    }
  });

  // Oak Book - Convert Estimate to Invoice (improved version using storage method)
  app.post('/api/estimates/:id/convert-to-invoice', async (req, res) => {
    try {
      const invoice = await storage.convertEstimateToInvoice(req.params.id);
      res.json(invoice);
    } catch (error) {
      console.error('Convert estimate error:', error);
      res.status(400).json({ error: 'Failed to convert estimate to invoice' });
    }
  });

  // Push Estimate to Production - Extract line items and create production items
  app.post('/api/estimates/:id/push-to-production', async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      const estimate = await storage.getEstimate(req.params.id);
      
      if (!estimate) {
        return res.status(404).json({ error: 'Estimate not found' });
      }
      
      if (!estimate.eventId) {
        return res.status(400).json({ error: 'Estimate is not linked to an event. Please link the estimate to an event first.' });
      }
      
      // Check if already pushed
      const event = await storage.getEvent(estimate.eventId);
      if (event?.productionContainerCreated) {
        return res.status(400).json({ error: 'Production items have already been created for this event.' });
      }
      
      // Extract non-heading line items
      const lineItems = (estimate.lineItems || []) as Array<{
        name: string;
        description?: string;
        quantity: number;
        isHeading?: boolean;
      }>;
      
      const productionItems = lineItems
        .filter(item => !item.isHeading && item.name?.trim())
        .map(item => ({
          eventId: estimate.eventId!,
          estimateId: estimate.id,
          itemName: item.name,
          quantity: item.quantity || 1,
          specification: item.description || null,
          fulfillmentType: null,
          status: 'draft' as const,
        }));
      
      if (productionItems.length === 0) {
        return res.status(400).json({ error: 'No line items found in the estimate to push to production.' });
      }
      
      // Create production items
      const created = await storage.createEventProductionItems(productionItems);
      
      // Mark event as having production container
      await storage.updateEvent(estimate.eventId, { productionContainerCreated: true } as any);
      
      // Log automation
      await storage.createAutomationLog({
        eventId: estimate.eventId,
        actionType: 'push_production',
        status: 'success',
        metadata: { 
          estimateId: estimate.id, 
          estimateNumber: estimate.number,
          itemCount: created.length,
          eventTitle: event?.title 
        },
        userId: userId || null,
      });
      
      console.log(`[Automation] Pushed ${created.length} items from estimate ${estimate.number} to production for event ${event?.title}`);
      
      // Send WhatsApp notification to warehouse (Kishor) if configured
      if (isWhatsAppConfigured()) {
        const KISHOR_PHONE = '+917902373354';
        try {
          const eventDate = event?.date ? new Date(event.date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'TBD';
          const warehouseMessage = `📦 *Production Request*\n\n*${event?.title}* has ${created.length} items pushed to production.\n\nEvent Date: ${eventDate}\nEstimate: ${estimate.number}\n\nPlease review and assign fulfillment types (warehouse/purchase/rent) for each item.`;
          await sendWhatsAppMessage(KISHOR_PHONE, warehouseMessage);
          
          // Log notification
          await storage.createAutomationLog({
            eventId: estimate.eventId,
            actionType: 'notification_sent',
            status: 'success',
            metadata: { type: 'push_production', recipient: KISHOR_PHONE, eventTitle: event?.title }
          });
          
          console.log(`[Automation] Sent WhatsApp notification to warehouse for event ${event?.title}`);
        } catch (waError) {
          console.error('[Automation] Failed to send WhatsApp notification:', waError);
        }
      }
      
      res.json({ 
        success: true, 
        message: `Successfully pushed ${created.length} items to production`,
        itemCount: created.length,
        items: created 
      });
    } catch (error) {
      console.error('Push to production error:', error);
      res.status(400).json({ error: 'Failed to push to production' });
    }
  });

  // Event Production Items - Get by event
  app.get('/api/events/:eventId/production-items', async (req, res) => {
    try {
      const items = await storage.getEventProductionItemsByEventId(req.params.eventId);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch production items' });
    }
  });

  // Event Production Items - Update fulfillment type
  app.patch('/api/production-items/:id', async (req, res) => {
    try {
      const item = await storage.updateEventProductionItem(req.params.id, req.body);
      if (!item) {
        return res.status(404).json({ error: 'Production item not found' });
      }
      res.json(item);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update production item' });
    }
  });

  // Finalize Event Inventory - Lock all production items
  app.post('/api/events/:eventId/finalize-inventory', async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      const eventId = req.params.eventId;
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }
      
      if (event.inventoryFinalized) {
        return res.status(400).json({ error: 'Inventory has already been finalized for this event.' });
      }
      
      // Get production items
      const items = await storage.getEventProductionItemsByEventId(eventId);
      if (items.length === 0) {
        return res.status(400).json({ error: 'No production items found. Please push to production first.' });
      }
      
      // Check all items have fulfillment type assigned
      const unassigned = items.filter(item => !item.fulfillmentType);
      if (unassigned.length > 0) {
        return res.status(400).json({ 
          error: `${unassigned.length} items do not have a fulfillment type assigned. Please assign warehouse/purchase/rent to all items.`,
          unassignedCount: unassigned.length
        });
      }
      
      // Lock all items
      await storage.lockEventProductionItems(eventId);
      
      // Mark event as inventory finalized
      await storage.updateEvent(eventId, { inventoryFinalized: true } as any);
      
      // Log automation
      await storage.createAutomationLog({
        eventId: eventId,
        actionType: 'finalize_inventory',
        status: 'success',
        metadata: { 
          itemCount: items.length,
          eventTitle: event.title,
          breakdown: {
            warehouse: items.filter(i => i.fulfillmentType === 'warehouse').length,
            purchase: items.filter(i => i.fulfillmentType === 'purchase').length,
            rent: items.filter(i => i.fulfillmentType === 'rent').length,
          }
        },
        userId: userId || null,
      });
      
      console.log(`[Automation] Finalized inventory for event ${event.title} with ${items.length} items`);
      
      // Send WhatsApp notification to wedding planner if configured
      if (isWhatsAppConfigured()) {
        const PLANNER_PHONES: Record<string, string> = {
          'fida fathima': '+919895810975',
          'fida': '+919895810975',
          'femina km': '+917306687284',
          'femina': '+917306687284',
          'kishor': '+917902373354',
        };
        
        try {
          const plannerName = event.planner?.toLowerCase() || '';
          let plannerPhone = PLANNER_PHONES['kishor']; // Default to Kishor
          
          for (const [key, phone] of Object.entries(PLANNER_PHONES)) {
            if (plannerName.includes(key)) {
              plannerPhone = phone;
              break;
            }
          }
          
          const warehouseBreakdown = items.filter(i => i.fulfillmentType === 'warehouse').length;
          const purchaseBreakdown = items.filter(i => i.fulfillmentType === 'purchase').length;
          const rentBreakdown = items.filter(i => i.fulfillmentType === 'rent').length;
          
          const plannerMessage = `✅ *Inventory Finalized*\n\n*${event.title}* inventory has been locked.\n\nTotal Items: ${items.length}\n• Warehouse: ${warehouseBreakdown}\n• Purchase: ${purchaseBreakdown}\n• Rent: ${rentBreakdown}\n\nProduction planning can now proceed.`;
          await sendWhatsAppMessage(plannerPhone, plannerMessage);
          
          // Log notification
          await storage.createAutomationLog({
            eventId: eventId,
            actionType: 'notification_sent',
            status: 'success',
            metadata: { type: 'finalize_inventory', recipient: plannerPhone, eventTitle: event.title }
          });
          
          console.log(`[Automation] Sent inventory finalization notification to planner ${event.planner}`);
        } catch (waError) {
          console.error('[Automation] Failed to send WhatsApp notification:', waError);
        }
      }
      
      res.json({ 
        success: true, 
        message: `Successfully finalized ${items.length} inventory items`,
        itemCount: items.length
      });
    } catch (error) {
      console.error('Finalize inventory error:', error);
      res.status(400).json({ error: 'Failed to finalize inventory' });
    }
  });

  // Automation Logs - Get by event
  app.get('/api/events/:eventId/automation-logs', async (req, res) => {
    try {
      const logs = await storage.getAutomationLogsByEventId(req.params.eventId);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch automation logs' });
    }
  });

  // Oak Book - Register Event from Invoice/Payment
  app.post('/api/register-event-from-payment', async (req, res) => {
    try {
      const { customerId, invoiceId, eventTitle, eventDate, eventTime, eventType, venue, weddingPlannerName, salesValue, advancePayment } = req.body;
      
      const customer = customerId ? await storage.getCustomer(customerId) : null;
      
      const event = await storage.createEvent({
        title: eventTitle,
        date: eventDate,
        time: eventTime || null,
        type: eventType || 'wedding',
        planner: weddingPlannerName || '',
        customer: customer?.name || '',
        venue: venue || '',
        salesValue: salesValue || '0',
        paymentReceived: advancePayment || '0',
        cost: '0',
      });

      if (invoiceId) {
        await storage.updateInvoice(invoiceId, { eventId: event.id });
      }

      res.json(event);
    } catch (error) {
      console.error('Register event error:', error);
      res.status(400).json({ error: 'Failed to register event' });
    }
  });

  // Customer Portal - Portal Links (Admin endpoints)
  app.post('/api/portal-links', async (req, res) => {
    try {
      const { documentType, documentId, customerId, expiresAt } = req.body;
      const token = crypto.randomUUID().replace(/-/g, '');
      
      const link = await storage.createPortalLink({
        token,
        documentType,
        documentId,
        customerId: customerId || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: true,
        createdBy: (req.session as any)?.userId || null,
      });
      
      res.json(link);
    } catch (error) {
      console.error('Create portal link error:', error);
      res.status(400).json({ error: 'Failed to create portal link' });
    }
  });

  app.get('/api/portal-links', async (req, res) => {
    try {
      const links = await storage.getAllPortalLinks();
      res.json(links);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch portal links' });
    }
  });

  app.delete('/api/portal-links/:id', async (req, res) => {
    try {
      await storage.deactivatePortalLink(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: 'Failed to deactivate link' });
    }
  });

  // PDF Generation endpoint
  app.get('/api/pdf/:type/:id', async (req, res) => {
    try {
      const { type, id } = req.params;
      
      if (!['quote', 'invoice', 'receipt'].includes(type)) {
        return res.status(400).json({ error: 'Invalid document type' });
      }

      const puppeteer = await import('puppeteer');
      const browser = await puppeteer.default.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });

      try {
        const page = await browser.newPage();
        
        const baseUrl = `http://localhost:5000`;
        const printUrl = `${baseUrl}/print/${type}/${id}`;
        
        await page.goto(printUrl, { 
          waitUntil: 'networkidle0',
          timeout: 30000,
        });

        await page.waitForFunction(() => (window as any).printReady === true, { timeout: 15000 });
        await new Promise(resolve => setTimeout(resolve, 500));

        const pdf = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: {
            top: '10mm',
            bottom: '10mm',
            left: '10mm',
            right: '10mm',
          },
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${type}-${id}.pdf"`);
        res.send(pdf);
      } finally {
        await browser.close();
      }
    } catch (error) {
      console.error('PDF generation error:', error);
      res.status(500).json({ error: 'Failed to generate PDF' });
    }
  });

  // Customer Portal - Public endpoints (no auth required)
  app.get('/api/portal/:token', async (req, res) => {
    try {
      const link = await storage.getPortalLinkByToken(req.params.token);
      
      if (!link) {
        return res.status(404).json({ error: 'Link not found or expired' });
      }

      if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
        return res.status(410).json({ error: 'This link has expired' });
      }

      await storage.updatePortalLinkViewCount(link.id);

      let document = null;
      let customer = null;

      if (link.documentType === 'estimate') {
        document = await storage.getEstimate(link.documentId);
      } else if (link.documentType === 'invoice') {
        document = await storage.getInvoice(link.documentId);
      } else if (link.documentType === 'payment_receipt') {
        document = await storage.getCustomerPayment(link.documentId);
      }

      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      if (link.customerId) {
        customer = await storage.getCustomer(link.customerId);
      } else if ('customerId' in document && document.customerId) {
        customer = await storage.getCustomer(document.customerId);
      }

      const companySettings = await storage.getCompanySettings();

      res.json({
        link,
        document,
        customer,
        companySettings,
      });
    } catch (error) {
      console.error('Portal access error:', error);
      res.status(500).json({ error: 'Failed to access portal' });
    }
  });

  // Payroll Routes
  app.get('/api/payroll-runs', async (req, res) => {
    try {
      const runs = await storage.getAllPayrollRuns();
      res.json(runs);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch payroll runs' });
    }
  });

  app.get('/api/payroll-runs/:id', async (req, res) => {
    try {
      const run = await storage.getPayrollRun(req.params.id);
      if (!run) {
        return res.status(404).json({ error: 'Payroll run not found' });
      }
      res.json(run);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch payroll run' });
    }
  });

  app.get('/api/payroll-runs/:id/items', async (req, res) => {
    try {
      const items = await storage.getPayrollItemsByRunId(req.params.id);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch payroll items' });
    }
  });

  app.post('/api/payroll-runs', async (req, res) => {
    try {
      const { month, year, employees } = req.body;
      
      const existing = await storage.getPayrollRunByMonthYear(month, year);
      if (existing) {
        return res.status(400).json({ error: 'Payroll run already exists for this month' });
      }

      const run = await storage.createPayrollRun({
        month,
        year,
        status: 'draft',
        totalAmount: '0',
      });

      let totalAmount = 0;
      for (const emp of employees) {
        const dailyRate = parseFloat(emp.salary) / 30;
        const grossPay = dailyRate * emp.daysWorked;
        const deductions = parseFloat(emp.deductions || '0');
        const netPay = grossPay - deductions;
        totalAmount += netPay;

        await storage.createPayrollItem({
          payrollRunId: run.id,
          employeeId: emp.id,
          employeeName: emp.name,
          monthlySalary: emp.salary.toString(),
          daysWorked: emp.daysWorked,
          dailyRate: dailyRate.toFixed(2),
          grossPay: grossPay.toFixed(2),
          deductions: deductions.toFixed(2),
          netPay: netPay.toFixed(2),
        });
      }

      await storage.updatePayrollRun(run.id, { totalAmount: totalAmount.toFixed(2) });
      
      const updatedRun = await storage.getPayrollRun(run.id);
      res.json(updatedRun);
    } catch (error) {
      console.error('Create payroll run error:', error);
      res.status(400).json({ error: 'Failed to create payroll run' });
    }
  });

  // Sync missing employees to an existing draft payroll
  app.post('/api/payroll-runs/:id/sync-employees', async (req, res) => {
    try {
      const run = await storage.getPayrollRun(req.params.id);
      if (!run) {
        return res.status(404).json({ error: 'Payroll run not found' });
      }
      if (run.status === 'paid') {
        return res.status(400).json({ error: 'Cannot modify paid payroll' });
      }

      const existingItems = await storage.getPayrollItemsByRunId(req.params.id);
      const existingEmployeeIds = new Set(existingItems.map(item => item.employeeId));
      
      const allEmployees = await storage.getAllEmployees();
      const excludedNames = ['oaksy ai', 'test employee', 'test'];
      
      // Find active employees not already in payroll
      const missingEmployees = allEmployees.filter(emp => {
        if (existingEmployeeIds.has(emp.id)) return false;
        if (emp.isActive === false) return false;
        const nameLower = emp.name.toLowerCase();
        if (excludedNames.some(excluded => nameLower.includes(excluded))) return false;
        return true;
      });

      if (missingEmployees.length === 0) {
        return res.json({ message: 'All employees already in payroll', added: 0 });
      }

      let addedAmount = 0;
      for (const emp of missingEmployees) {
        const salary = parseFloat(emp.salary || '0');
        const dailyRate = salary / 30;
        const grossPay = dailyRate * 30;
        const netPay = grossPay;
        addedAmount += netPay;

        await storage.createPayrollItem({
          payrollRunId: req.params.id,
          employeeId: emp.id,
          employeeName: emp.name,
          monthlySalary: salary.toFixed(2),
          daysWorked: 30,
          dailyRate: dailyRate.toFixed(2),
          grossPay: grossPay.toFixed(2),
          deductions: '0.00',
          netPay: netPay.toFixed(2),
        });
      }

      const newTotal = parseFloat(run.totalAmount || '0') + addedAmount;
      await storage.updatePayrollRun(req.params.id, { totalAmount: newTotal.toFixed(2) });

      res.json({ 
        message: `Added ${missingEmployees.length} employee(s) to payroll`,
        added: missingEmployees.length,
        employees: missingEmployees.map(e => e.name)
      });
    } catch (error) {
      console.error('Sync employees error:', error);
      res.status(400).json({ error: 'Failed to sync employees' });
    }
  });

  app.patch('/api/payroll-runs/:id', async (req, res) => {
    try {
      const run = await storage.getPayrollRun(req.params.id);
      if (!run) {
        return res.status(404).json({ error: 'Payroll run not found' });
      }
      if (run.status === 'paid') {
        return res.status(400).json({ error: 'Cannot modify paid payroll' });
      }
      
      const { items, ...runUpdates } = req.body;
      
      if (items && Array.isArray(items)) {
        const existingItems = await storage.getPayrollItemsByRunId(req.params.id);
        let newTotal = 0;
        
        for (const itemUpdate of items) {
          const item = existingItems.find(i => i.id === itemUpdate.id);
          if (item) {
            const dailyRate = parseFloat(item.monthlySalary) / 30;
            const daysWorked = Number(itemUpdate.daysWorked ?? item.daysWorked);
            const lossOfPayDays = Number(itemUpdate.lossOfPayDays ?? (item as any).lossOfPayDays ?? 0);
            const salaryAdvance = Number(itemUpdate.salaryAdvance ?? (item as any).salaryAdvance ?? 0);
            const grossPay = dailyRate * daysWorked;
            const lopDeduction = dailyRate * lossOfPayDays;
            const totalDeductions = lopDeduction + salaryAdvance;
            const netPay = grossPay - totalDeductions;
            
            await storage.updatePayrollItem(itemUpdate.id, {
              daysWorked,
              lossOfPayDays,
              salaryAdvance: salaryAdvance.toFixed(2),
              dailyRate: dailyRate.toFixed(2),
              grossPay: grossPay.toFixed(2),
              deductions: totalDeductions.toFixed(2),
              netPay: netPay.toFixed(2),
            });
            newTotal += netPay;
          }
        }
        await storage.updatePayrollRun(req.params.id, { totalAmount: newTotal.toFixed(2) });
      } else if (Object.keys(runUpdates).length > 0) {
        await storage.updatePayrollRun(req.params.id, runUpdates);
      }
      
      const updated = await storage.getPayrollRun(req.params.id);
      res.json(updated);
    } catch (error) {
      console.error('Error updating payroll run:', error);
      res.status(400).json({ error: 'Failed to update payroll run' });
    }
  });

  app.patch('/api/payroll-items/:id', async (req, res) => {
    try {
      const { daysWorked, deductions } = req.body;
      const item = await storage.updatePayrollItem(req.params.id, {});
      
      if (!item) {
        return res.status(404).json({ error: 'Payroll item not found' });
      }

      const dailyRate = parseFloat(item.monthlySalary) / 30;
      const grossPay = dailyRate * (daysWorked ?? item.daysWorked);
      const deductionAmount = parseFloat(deductions ?? item.deductions ?? '0');
      const netPay = grossPay - deductionAmount;

      const updated = await storage.updatePayrollItem(req.params.id, {
        daysWorked: daysWorked ?? item.daysWorked,
        deductions: deductionAmount.toFixed(2),
        grossPay: grossPay.toFixed(2),
        netPay: netPay.toFixed(2),
      });

      const allItems = await storage.getPayrollItemsByRunId(item.payrollRunId);
      const totalAmount = allItems.reduce((sum, i) => sum + parseFloat(i.netPay), 0);
      await storage.updatePayrollRun(item.payrollRunId, { totalAmount: totalAmount.toFixed(2) });

      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update payroll item' });
    }
  });

  app.post('/api/payroll-runs/:id/pay', async (req, res) => {
    try {
      const { payDate, bankId } = req.body;
      if (!payDate) {
        return res.status(400).json({ error: 'Pay date is required' });
      }
      const run = await storage.markPayrollAsPaid(req.params.id, payDate, bankId);
      res.json(run);
    } catch (error: any) {
      console.error('Mark payroll paid error:', error);
      res.status(400).json({ error: error.message || 'Failed to mark payroll as paid' });
    }
  });

  app.delete('/api/payroll-runs/:id', async (req, res) => {
    try {
      const run = await storage.getPayrollRun(req.params.id);
      if (!run) {
        return res.status(404).json({ error: 'Payroll run not found' });
      }
      if (run.status === 'paid') {
        return res.status(400).json({ error: 'Cannot delete paid payroll' });
      }
      await storage.deletePayrollRun(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: 'Failed to delete payroll run' });
    }
  });

  // Delete individual payroll item (superadmin only)
  app.delete('/api/payroll-items/:id', async (req, res) => {
    try {
      // Check if user is superadmin
      const userId = (req.session as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      const user = await storage.getUser(userId);
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Only superadmin can delete payroll items' });
      }

      // Get the item directly by ID
      const item = await storage.getPayrollItem(req.params.id);
      if (!item) {
        return res.status(404).json({ error: 'Payroll item not found' });
      }

      // Check if payroll is already paid
      const run = await storage.getPayrollRun(item.payrollRunId);
      if (run?.status === 'paid') {
        return res.status(400).json({ error: 'Cannot delete items from paid payroll' });
      }

      // Delete the payroll item (cascades to salary slips due to FK constraint)
      await storage.deletePayrollItem(req.params.id);

      // Recalculate and update total amount
      const remainingItems = await storage.getPayrollItemsByRunId(item.payrollRunId);
      const totalAmount = remainingItems.reduce((sum, i) => sum + parseFloat(i.netPay), 0);
      await storage.updatePayrollRun(item.payrollRunId, { totalAmount: totalAmount.toFixed(2) });

      res.json({ success: true, newTotal: totalAmount.toFixed(2) });
    } catch (error) {
      console.error('Delete payroll item error:', error);
      res.status(400).json({ error: 'Failed to delete payroll item' });
    }
  });

  // Mark individual payroll item as paid and create daybook entry
  app.post('/api/payroll-items/:id/mark-paid', async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      const user = await storage.getUser(userId);
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Only superadmin can mark payroll items as paid' });
      }

      const { bankId } = req.body;
      const item = await storage.getPayrollItem(req.params.id);
      if (!item) {
        return res.status(404).json({ error: 'Payroll item not found' });
      }

      if ((item as any).isPaid) {
        return res.status(400).json({ error: 'This payroll item is already paid' });
      }

      // Get payroll run info for month/year
      const run = await storage.getPayrollRun(item.payrollRunId);
      if (!run) {
        return res.status(404).json({ error: 'Payroll run not found' });
      }

      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December'];
      const monthName = monthNames[run.month - 1];
      const today = new Date().toISOString().split('T')[0];

      // Create daybook entry for this employee's salary payment
      const daybookEntry = await storage.createDaybookEntry({
        date: today,
        description: `Salary - ${item.employeeName} (${monthName} ${run.year})`,
        type: 'expense',
        amount: item.netPay,
        category: 'Salaries',
        paymentMethod: bankId ? 'bank_transfer' : 'cash',
        bankId: bankId || undefined,
      });

      // Update payroll item with paid status
      await storage.updatePayrollItem(req.params.id, {
        isPaid: true,
        paidAt: new Date(),
        paidBankId: bankId,
        daybookEntryId: daybookEntry.id,
      } as any);

      res.json({ success: true, daybookEntryId: daybookEntry.id });
    } catch (error: any) {
      console.error('Mark payroll item paid error:', error);
      res.status(500).json({ error: error.message || 'Failed to mark as paid' });
    }
  });

  // Salary Slips
  app.get('/api/salary-slips/payroll/:runId', async (req, res) => {
    try {
      const slips = await storage.getSalarySlipsByPayrollRun(req.params.runId);
      res.json(slips);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch salary slips' });
    }
  });

  app.get('/api/salary-slips/employee/:employeeId', async (req, res) => {
    try {
      const slips = await storage.getSalarySlipsForEmployee(req.params.employeeId);
      res.json(slips);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch salary slips' });
    }
  });

  app.get('/api/salary-slips/:id', async (req, res) => {
    try {
      const slip = await storage.getSalarySlip(req.params.id);
      if (!slip) {
        return res.status(404).json({ error: 'Salary slip not found' });
      }
      res.json(slip);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch salary slip' });
    }
  });

  app.post('/api/salary-slips/generate/:runId', async (req, res) => {
    try {
      const run = await storage.getPayrollRun(req.params.runId);
      if (!run) {
        return res.status(404).json({ error: 'Payroll run not found' });
      }

      // Delete existing slips for this run
      await storage.deleteSalarySlipsByPayrollRun(req.params.runId);

      // Get payroll items
      const items = await storage.getPayrollItemsByRunId(req.params.runId);
      const employees = await storage.getAllEmployees();
      const employeeMap = new Map(employees.map(e => [e.id, e]));

      // Generate salary slips for each payroll item
      const slips = [];
      for (const item of items) {
        const employee = employeeMap.get(item.employeeId);
        if (!employee) continue;

        // Calculate salary breakdown based on payroll item
        const grossPay = parseFloat(item.grossPay);
        const basicPay = grossPay * 0.5; // 50% of gross as basic
        const basicDa = basicPay; // Basic + DA combined
        const hra = grossPay * 0.2; // 20% as HRA
        const otherAllowances = grossPay - basicDa - hra; // Rest as allowances
        
        // Get LOP and advance from payroll item
        const lossOfPayDays = (item as any).lossOfPayDays || 0;
        const salaryAdvance = parseFloat((item as any).salaryAdvance || '0');
        const dailyRate = parseFloat(item.monthlySalary) / 30;
        const lossOfPay = dailyRate * lossOfPayDays;
        const totalDeductions = lossOfPay + salaryAdvance; // No professional tax as per user preference
        const netPayment = parseFloat(item.netPay);

        // Convert net payment to words
        const numberToWords = (num: number): string => {
          const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
          const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
          if (num === 0) return 'Zero';
          if (num < 20) return ones[num];
          if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
          if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + numberToWords(num % 100) : '');
          if (num < 100000) return numberToWords(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 ? ' ' + numberToWords(num % 1000) : '');
          if (num < 10000000) return numberToWords(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 ? ' ' + numberToWords(num % 100000) : '');
          return numberToWords(Math.floor(num / 10000000)) + ' Crore' + (num % 10000000 ? ' ' + numberToWords(num % 10000000) : '');
        };
        const amountInWords = `Rupees ${numberToWords(Math.round(netPayment))} Only`;

        const slip = await storage.createSalarySlip({
          payrollRunId: req.params.runId,
          payrollItemId: item.id,
          employeeId: item.employeeId,
          employeeName: item.employeeName,
          designation: employee.designation || 'Staff',
          department: employee.department || 'General',
          joinDate: employee.joinDate,
          month: run.month,
          year: run.year,
          totalDays: 30,
          daysPresent: item.daysWorked - lossOfPayDays, // Actual days present (worked - LOP)
          daysPaid: item.daysWorked,
          basicPay: basicPay.toFixed(2),
          basicDa: basicDa.toFixed(2),
          hra: hra.toFixed(2),
          otherAllowances: otherAllowances.toFixed(2),
          totalEarnings: grossPay.toFixed(2),
          professionalTax: '0.00', // Professional tax shown as 0 per user preference
          lossOfPay: lossOfPay.toFixed(2),
          salaryAdvance: salaryAdvance.toFixed(2),
          totalDeductions: totalDeductions.toFixed(2),
          netPayment: netPayment.toFixed(2),
          amountInWords,
        });
        slips.push(slip);
      }

      res.json({ success: true, count: slips.length, slips });
    } catch (error: any) {
      console.error('Generate salary slips error:', error);
      res.status(500).json({ error: error.message || 'Failed to generate salary slips' });
    }
  });

  app.patch('/api/salary-slips/:id/whatsapp-sent', async (req, res) => {
    try {
      const slip = await storage.updateSalarySlip(req.params.id, {
        sentViaWhatsapp: true,
      });
      res.json(slip);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update salary slip' });
    }
  });

  // Send salary slip via WhatsApp (superadmin only)
  app.post('/api/salary-slips/:id/send-whatsapp', async (req, res) => {
    try {
      // Check if user is superadmin
      const userId = (req.session as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      const user = await storage.getUser(userId);
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Only superadmin can send salary slips via WhatsApp' });
      }

      const slip = await storage.getSalarySlip(req.params.id);
      if (!slip) {
        return res.status(404).json({ error: 'Salary slip not found' });
      }

      // Get employee to find their WhatsApp number
      const employee = await storage.getEmployee(slip.employeeId);
      if (!employee) {
        return res.status(404).json({ error: 'Employee not found' });
      }

      const phoneNumber = employee.whatsappNumber || employee.phone;
      if (!phoneNumber) {
        return res.status(400).json({ error: 'Employee does not have a phone number' });
      }

      // Import WhatsApp service
      const { sendWhatsAppMessage, isWhatsAppConfigured } = await import('./whatsapp-service');
      
      if (!isWhatsAppConfigured()) {
        return res.status(400).json({ error: 'WhatsApp is not configured. Please set up Twilio credentials.' });
      }

      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December'];
      const monthLabel = `${monthNames[slip.month - 1]} ${slip.year}`;

      // Create salary slip message
      const lossOfPay = parseFloat(slip.lossOfPay || '0');
      const salaryAdvance = parseFloat((slip as any).salaryAdvance || '0');
      const totalDeductions = lossOfPay + salaryAdvance;
      
      const message = `*SALARY SLIP - ${monthLabel}*\n\n` +
        `Dear ${slip.employeeName},\n\n` +
        `Your salary slip for ${monthLabel} is ready.\n\n` +
        `*EARNINGS*\n` +
        `Basic + DA: Rs. ${slip.basicDa}\n` +
        `HRA: Rs. ${slip.hra || '0.00'}\n` +
        `Other Allowances: Rs. ${slip.otherAllowances || '0.00'}\n` +
        `Total Earnings: Rs. ${slip.totalEarnings}\n\n` +
        `*DEDUCTIONS*\n` +
        `Loss of Pay: Rs. ${lossOfPay.toFixed(2)}\n` +
        `Salary Advance: Rs. ${salaryAdvance.toFixed(2)}\n` +
        `Total Deductions: Rs. ${totalDeductions.toFixed(2)}\n\n` +
        `*NET PAYMENT: Rs. ${slip.netPayment}*\n\n` +
        `Thank you for your service.\n` +
        `- Yepman International`;

      const result = await sendWhatsAppMessage(phoneNumber, message);

      if (result.success) {
        // Update salary slip as sent
        await storage.updateSalarySlip(req.params.id, {
          sentViaWhatsapp: true,
          sentAt: new Date(),
        });
        res.json({ success: true, message: 'Salary slip sent successfully' });
      } else {
        res.status(400).json({ error: result.error || 'Failed to send WhatsApp message' });
      }
    } catch (error: any) {
      console.error('Send salary slip WhatsApp error:', error);
      res.status(500).json({ error: error.message || 'Failed to send salary slip' });
    }
  });

  // Oak Sales - Pipelines
  app.get('/api/sales/pipelines', async (req, res) => {
    const pipelines = await storage.getAllSalesPipelines();
    res.json(pipelines);
  });

  app.get('/api/sales/pipelines/:id', async (req, res) => {
    const pipeline = await storage.getSalesPipeline(req.params.id);
    if (!pipeline) return res.status(404).json({ error: 'Pipeline not found' });
    res.json(pipeline);
  });

  app.post('/api/sales/pipelines', async (req, res) => {
    try {
      const pipeline = await storage.createSalesPipeline(req.body);
      
      // Create default stages for the new pipeline
      const defaultStages = [
        { name: 'Lead', color: '#6b7280', order: 1 },
        { name: 'Awaiting Response', color: '#f59e0b', order: 2 },
        { name: 'Contacted', color: '#3b82f6', order: 3 },
        { name: 'Prospective', color: '#8b5cf6', order: 4 },
        { name: 'Proposal', color: '#ec4899', order: 5 },
        { name: 'Negotiation', color: '#f97316', order: 6 },
        { name: 'Advance Received', color: '#14b8a6', order: 7 },
        { name: 'Closed Won', color: '#22c55e', order: 8 },
        { name: 'Closed Lost', color: '#ef4444', order: 9 },
      ];
      
      for (const stage of defaultStages) {
        await storage.createSalesStage({
          ...stage,
          pipelineId: pipeline.id,
        });
      }
      
      res.json(pipeline);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create pipeline' });
    }
  });

  app.patch('/api/sales/pipelines/:id', async (req, res) => {
    try {
      const pipeline = await storage.updateSalesPipeline(req.params.id, req.body);
      res.json(pipeline);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update pipeline' });
    }
  });

  app.delete('/api/sales/pipelines/:id', async (req, res) => {
    await storage.deleteSalesPipeline(req.params.id);
    res.json({ success: true });
  });

  // Oak Sales - Stages
  app.get('/api/sales/stages', async (req, res) => {
    const { pipelineId } = req.query;
    if (pipelineId) {
      const stages = await storage.getSalesStagesByPipelineId(pipelineId as string);
      res.json(stages);
    } else {
      const stages = await storage.getAllSalesStages();
      res.json(stages);
    }
  });

  app.get('/api/sales/stages/:id', async (req, res) => {
    const stage = await storage.getSalesStage(req.params.id);
    if (!stage) return res.status(404).json({ error: 'Stage not found' });
    res.json(stage);
  });

  app.post('/api/sales/stages', async (req, res) => {
    try {
      const stage = await storage.createSalesStage(req.body);
      res.json(stage);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create stage' });
    }
  });

  app.patch('/api/sales/stages/:id', async (req, res) => {
    try {
      const stage = await storage.updateSalesStage(req.params.id, req.body);
      res.json(stage);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update stage' });
    }
  });

  app.delete('/api/sales/stages/:id', async (req, res) => {
    await storage.deleteSalesStage(req.params.id);
    res.json({ success: true });
  });

  // Oak Sales - Contacts
  app.get('/api/sales/contacts', async (req, res) => {
    const user = req.user;
    let contacts = await storage.getAllSalesContacts();
    
    // Wedding planners only see their own contacts
    if (user && user.role === 'wedding_planner' && user.id) {
      contacts = contacts.filter(c => c.ownerId === user.id);
    }
    
    res.json(contacts);
  });

  app.get('/api/sales/contacts/:id', async (req, res) => {
    const contact = await storage.getSalesContact(req.params.id);
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    res.json(contact);
  });

  app.post('/api/sales/contacts', async (req, res) => {
    try {
      const contact = await storage.createSalesContact(req.body);
      res.json(contact);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create contact' });
    }
  });

  app.patch('/api/sales/contacts/:id', async (req, res) => {
    try {
      const contact = await storage.updateSalesContact(req.params.id, req.body);
      res.json(contact);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update contact' });
    }
  });

  app.delete('/api/sales/contacts/:id', async (req, res) => {
    await storage.deleteSalesContact(req.params.id);
    res.json({ success: true });
  });

  // Oak Sales - Companies
  app.get('/api/sales/companies', async (req, res) => {
    const companies = await storage.getAllSalesCompanies();
    res.json(companies);
  });

  app.get('/api/sales/companies/:id', async (req, res) => {
    const company = await storage.getSalesCompany(req.params.id);
    if (!company) return res.status(404).json({ error: 'Company not found' });
    res.json(company);
  });

  app.post('/api/sales/companies', async (req, res) => {
    try {
      const company = await storage.createSalesCompany(req.body);
      res.json(company);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create company' });
    }
  });

  app.patch('/api/sales/companies/:id', async (req, res) => {
    try {
      const company = await storage.updateSalesCompany(req.params.id, req.body);
      res.json(company);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update company' });
    }
  });

  app.delete('/api/sales/companies/:id', async (req, res) => {
    await storage.deleteSalesCompany(req.params.id);
    res.json({ success: true });
  });

  // Oak Sales - Deals
  app.get('/api/sales/deals', async (req, res) => {
    const { pipelineId, ownerId } = req.query;
    if (pipelineId) {
      const deals = await storage.getSalesDealsByPipelineId(pipelineId as string);
      res.json(deals);
    } else if (ownerId) {
      const deals = await storage.getSalesDealsByOwnerId(ownerId as string);
      res.json(deals);
    } else {
      const deals = await storage.getAllSalesDeals();
      res.json(deals);
    }
  });

  app.get('/api/sales/deals/:id', async (req, res) => {
    const deal = await storage.getSalesDeal(req.params.id);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    res.json(deal);
  });

  app.post('/api/sales/deals', async (req, res) => {
    try {
      const deal = await storage.createSalesDeal(req.body);
      
      // Send WhatsApp notification to the deal owner (wedding planner)
      if (deal.ownerId) {
        try {
          const owner = await storage.getUser(deal.ownerId);
          if (owner && (owner.role === 'wedding_planner' || owner.role === 'admin')) {
            // Map owner name to phone number
            const plannerPhones: Record<string, string> = {
              'fida fathima': '+919895810975',
              'fida': '+919895810975',
              'femina km': '+917306687284',
              'femina': '+917306687284',
            };
            
            const plannerPhone = plannerPhones[owner.name.toLowerCase()];
            if (plannerPhone) {
              const { sendWhatsAppMessage, isWhatsAppConfigured } = await import('./whatsapp-service');
              if (isWhatsAppConfigured()) {
                const contact = deal.contactId ? await storage.getSalesContact(deal.contactId) : null;
                const customerName = contact ? `${contact.firstName} ${contact.lastName}`.trim() : 'New Customer';
                const customerPhone = contact?.phone || contact?.mobile || 'Not provided';
                
                const message = `🌳 *New Lead Assigned*\n━━━━━━━━━━━━━━━━━━\n\n👤 *Customer:* ${customerName}\n📞 *Phone:* ${customerPhone}\n💰 *Value:* ₹${deal.value ? parseFloat(deal.value).toLocaleString('en-IN') : '0'}\n📝 *Notes:* ${deal.notes || 'None'}\n\n_Lead added to your pipeline. Check Oak Sales for details!_\n\n🌳 Oaksy`;
                
                await sendWhatsAppMessage(plannerPhone, message);
                console.log(`[Sales] WhatsApp notification sent to ${owner.name} for new deal`);
              }
            }
          }
        } catch (notifyError) {
          console.error('[Sales] Failed to send WhatsApp notification:', notifyError);
          // Don't fail the deal creation if notification fails
        }
      }
      
      res.json(deal);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create deal' });
    }
  });

  app.patch('/api/sales/deals/:id', async (req, res) => {
    try {
      const updateData = { ...req.body };
      const dealId = req.params.id;
      const existingDeal = await storage.getSalesDeal(dealId);
      
      // If stageId is being updated, check if it's a Closed Won or Closed Lost stage
      if (updateData.stageId) {
        const stage = await storage.getSalesStage(updateData.stageId);
        if (stage) {
          const stageName = stage.name.toLowerCase();
          if (stageName.includes('closed won') || stageName.includes('won')) {
            updateData.status = 'won';
            updateData.actualCloseDate = new Date().toISOString().split('T')[0];
          } else if (stageName.includes('closed lost') || stageName.includes('lost')) {
            updateData.status = 'lost';
            updateData.actualCloseDate = new Date().toISOString().split('T')[0];
          } else {
            updateData.status = 'open';
          }
          
          // Check if moving to "Advance Received" stage
          if ((stageName.includes('advance received') || stageName.includes('advance payment')) && 
              existingDeal && !existingDeal.advancePaymentReceived) {
            updateData.advancePaymentReceived = true;
            updateData.advancePaymentDate = new Date();
            
            // Notify accountant via WhatsApp
            const contact = existingDeal.contactId ? await storage.getSalesContact(existingDeal.contactId) : null;
            const owner = existingDeal.ownerId ? await storage.getUser(existingDeal.ownerId) : null;
            const customerName = contact ? `${contact.firstName} ${contact.lastName}`.trim() : existingDeal.title;
            const customerPhone = contact?.phone || contact?.mobile || 'Not provided';
            const eventDate = existingDeal.eventDate || 'TBD';
            const venue = existingDeal.venue || 'TBD';
            const value = existingDeal.value ? `₹${parseFloat(existingDeal.value).toLocaleString('en-IN')}` : 'Not specified';
            
            console.log(`[Advance Payment] Deal "${existingDeal.title}" marked as advance received. Customer: ${customerName}. Planner: ${owner?.name || 'N/A'}. Sending WhatsApp to accountant...`);
            
            // Send WhatsApp notification to accountant (Sabitha)
            try {
              const { sendWhatsAppMessage, isWhatsAppConfigured } = await import('./whatsapp-service');
              if (isWhatsAppConfigured()) {
                const accountantPhone = '+919895810975'; // Sabitha's number for accountant notifications
                const message = `🎉 *Advance Payment Received*\n\n` +
                  `A new customer has made an advance payment and needs to be created in the system.\n\n` +
                  `📋 *Lead Details:*\n` +
                  `• Customer: ${customerName}\n` +
                  `• Phone: ${customerPhone}\n` +
                  `• Event Date: ${eventDate}\n` +
                  `• Venue: ${venue}\n` +
                  `• Deal Value: ${value}\n` +
                  `• Wedding Planner: ${owner?.name || 'N/A'}\n\n` +
                  `Please create the customer record and invoice in Oak Book.`;
                
                await sendWhatsAppMessage(accountantPhone, message);
                console.log(`[Advance Payment] WhatsApp notification sent to accountant for ${customerName}`);
              }
            } catch (whatsappError) {
              console.error('[Advance Payment] Failed to send WhatsApp notification:', whatsappError);
            }
          }
        }
      }
      
      // Handle explicit advance payment received flag
      if (updateData.advancePaymentReceived === true && existingDeal && !existingDeal.advancePaymentReceived) {
        updateData.advancePaymentDate = new Date();
      }
      
      const deal = await storage.updateSalesDeal(dealId, updateData);
      res.json(deal);
    } catch (error) {
      console.error('[Update Deal] Error updating deal:', error);
      res.status(400).json({ error: 'Failed to update deal', details: String(error) });
    }
  });

  app.delete('/api/sales/deals/:id', async (req, res) => {
    await storage.deleteSalesDeal(req.params.id);
    res.json({ success: true });
  });

  // Oak Sales - Activities
  app.get('/api/sales/activities', async (req, res) => {
    const { dealId, ownerId } = req.query;
    if (dealId) {
      const activities = await storage.getSalesActivitiesByDealId(dealId as string);
      res.json(activities);
    } else if (ownerId) {
      const activities = await storage.getSalesActivitiesByOwnerId(ownerId as string);
      res.json(activities);
    } else {
      const activities = await storage.getAllSalesActivities();
      res.json(activities);
    }
  });

  app.get('/api/sales/activities/:id', async (req, res) => {
    const activity = await storage.getSalesActivity(req.params.id);
    if (!activity) return res.status(404).json({ error: 'Activity not found' });
    res.json(activity);
  });

  app.post('/api/sales/activities', async (req, res) => {
    try {
      const activity = await storage.createSalesActivity(req.body);
      res.json(activity);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create activity' });
    }
  });

  app.patch('/api/sales/activities/:id', async (req, res) => {
    try {
      const activity = await storage.updateSalesActivity(req.params.id, req.body);
      res.json(activity);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update activity' });
    }
  });

  app.delete('/api/sales/activities/:id', async (req, res) => {
    await storage.deleteSalesActivity(req.params.id);
    res.json({ success: true });
  });

  // Oak Sales - Targets
  app.get('/api/sales/targets', async (req, res) => {
    const { userId } = req.query;
    if (userId) {
      const targets = await storage.getSalesTargetsByUserId(userId as string);
      res.json(targets);
    } else {
      const targets = await storage.getAllSalesTargets();
      res.json(targets);
    }
  });

  app.get('/api/sales/targets/:id', async (req, res) => {
    const target = await storage.getSalesTarget(req.params.id);
    if (!target) return res.status(404).json({ error: 'Target not found' });
    res.json(target);
  });

  app.post('/api/sales/targets', async (req, res) => {
    try {
      const target = await storage.createSalesTarget(req.body);
      res.json(target);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create target' });
    }
  });

  app.patch('/api/sales/targets/:id', async (req, res) => {
    try {
      const target = await storage.updateSalesTarget(req.params.id, req.body);
      res.json(target);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update target' });
    }
  });

  app.delete('/api/sales/targets/:id', async (req, res) => {
    await storage.deleteSalesTarget(req.params.id);
    res.json({ success: true });
  });

  // Oak Sales - Automations
  app.get('/api/sales/automations', async (req, res) => {
    const automations = await storage.getAllSalesAutomations();
    res.json(automations);
  });

  app.get('/api/sales/automations/:id', async (req, res) => {
    const automation = await storage.getSalesAutomation(req.params.id);
    if (!automation) return res.status(404).json({ error: 'Automation not found' });
    res.json(automation);
  });

  app.post('/api/sales/automations', async (req, res) => {
    try {
      const automation = await storage.createSalesAutomation(req.body);
      res.json(automation);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create automation' });
    }
  });

  app.patch('/api/sales/automations/:id', async (req, res) => {
    try {
      const automation = await storage.updateSalesAutomation(req.params.id, req.body);
      res.json(automation);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update automation' });
    }
  });

  app.delete('/api/sales/automations/:id', async (req, res) => {
    await storage.deleteSalesAutomation(req.params.id);
    res.json({ success: true });
  });

  // =====================
  // OAK INVENTORY ROUTES
  // =====================

  // Inventory Items
  app.get('/api/inventory/items', async (req, res) => {
    try {
      const items = await storage.getAllInventoryItems();
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch inventory items' });
    }
  });

  app.get('/api/inventory/items/:id', async (req, res) => {
    const item = await storage.getInventoryItem(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
  });

  app.post('/api/inventory/items', async (req, res) => {
    try {
      const item = await storage.createInventoryItem(req.body);
      res.json(item);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create inventory item' });
    }
  });

  app.patch('/api/inventory/items/:id', async (req, res) => {
    try {
      const item = await storage.updateInventoryItem(req.params.id, req.body);
      res.json(item);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update inventory item' });
    }
  });

  app.delete('/api/inventory/items/:id', async (req, res) => {
    await storage.deleteInventoryItem(req.params.id);
    res.json({ success: true });
  });

  // Inventory Transactions
  app.get('/api/inventory/transactions', async (req, res) => {
    const { itemId } = req.query;
    if (itemId) {
      const transactions = await storage.getInventoryTransactionsByItemId(itemId as string);
      res.json(transactions);
    } else {
      res.status(400).json({ error: 'itemId is required' });
    }
  });

  app.post('/api/inventory/transactions', async (req, res) => {
    try {
      const transaction = await storage.createInventoryTransaction(req.body);
      res.json(transaction);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create transaction' });
    }
  });

  // Event Inventory Sessions
  app.get('/api/inventory/sessions', async (req, res) => {
    const { eventId } = req.query;
    if (eventId) {
      const sessions = await storage.getEventInventorySessionsByEventId(eventId as string);
      res.json(sessions);
    } else {
      const sessions = await storage.getAllEventInventorySessions();
      res.json(sessions);
    }
  });

  app.get('/api/inventory/sessions/:id', async (req, res) => {
    const session = await storage.getEventInventorySession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  });

  app.post('/api/inventory/sessions', async (req, res) => {
    try {
      const session = await storage.createEventInventorySession(req.body);
      res.json(session);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create session' });
    }
  });

  app.patch('/api/inventory/sessions/:id', async (req, res) => {
    try {
      const session = await storage.updateEventInventorySession(req.params.id, req.body);
      res.json(session);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update session' });
    }
  });

  app.delete('/api/inventory/sessions/:id', async (req, res) => {
    await storage.deleteEventInventorySession(req.params.id);
    res.json({ success: true });
  });

  // Event Inventory Items (items within a session)
  app.get('/api/inventory/session-items', async (req, res) => {
    const { sessionId } = req.query;
    if (sessionId) {
      const items = await storage.getEventInventoryItemsBySessionId(sessionId as string);
      res.json(items);
    } else {
      const items = await storage.getAllEventInventoryItems();
      res.json(items);
    }
  });

  app.post('/api/inventory/session-items', async (req, res) => {
    try {
      const item = await storage.createEventInventoryItem(req.body);
      res.json(item);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create session item' });
    }
  });

  app.patch('/api/inventory/session-items/:id', async (req, res) => {
    try {
      const item = await storage.updateEventInventoryItem(req.params.id, req.body);
      res.json(item);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update session item' });
    }
  });

  app.delete('/api/inventory/session-items/:id', async (req, res) => {
    await storage.deleteEventInventoryItem(req.params.id);
    res.json({ success: true });
  });

  // Rental Records
  app.get('/api/inventory/rentals', async (req, res) => {
    const { eventId } = req.query;
    if (eventId) {
      const rentals = await storage.getRentalRecordsByEventId(eventId as string);
      res.json(rentals);
    } else {
      const rentals = await storage.getAllRentalRecords();
      res.json(rentals);
    }
  });

  app.get('/api/inventory/rentals/:id', async (req, res) => {
    const rental = await storage.getRentalRecord(req.params.id);
    if (!rental) return res.status(404).json({ error: 'Rental not found' });
    res.json(rental);
  });

  app.post('/api/inventory/rentals', async (req, res) => {
    try {
      const data = {
        ...req.body,
        vendorId: req.body.vendorId || null,
        eventId: req.body.eventId || null,
      };
      const rental = await storage.createRentalRecord(data);
      res.json(rental);
    } catch (error: any) {
      console.error(`Failed to create rental: ${error.message}`);
      res.status(400).json({ error: error.message || 'Failed to create rental' });
    }
  });

  app.patch('/api/inventory/rentals/:id', async (req, res) => {
    try {
      const rental = await storage.updateRentalRecord(req.params.id, req.body);
      res.json(rental);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update rental' });
    }
  });

  app.delete('/api/inventory/rentals/:id', async (req, res) => {
    await storage.deleteRentalRecord(req.params.id);
    res.json({ success: true });
  });

  // Rental Items
  app.get('/api/inventory/rental-items', async (req, res) => {
    const { rentalId } = req.query;
    if (rentalId) {
      const items = await storage.getRentalItemsByRentalId(rentalId as string);
      res.json(items);
    } else {
      const items = await storage.getAllRentalItems();
      res.json(items);
    }
  });

  app.post('/api/inventory/rental-items', async (req, res) => {
    try {
      const item = await storage.createRentalItem(req.body);
      res.json(item);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create rental item' });
    }
  });

  app.patch('/api/inventory/rental-items/:id', async (req, res) => {
    try {
      const item = await storage.updateRentalItem(req.params.id, req.body);
      res.json(item);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update rental item' });
    }
  });

  app.delete('/api/inventory/rental-items/:id', async (req, res) => {
    await storage.deleteRentalItem(req.params.id);
    res.json({ success: true });
  });

  // Inventory Templates
  app.get('/api/inventory/templates', async (req, res) => {
    const templates = await storage.getAllInventoryTemplates();
    res.json(templates);
  });

  app.get('/api/inventory/templates/:id', async (req, res) => {
    const template = await storage.getInventoryTemplate(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.json(template);
  });

  app.post('/api/inventory/templates', async (req, res) => {
    try {
      const template = await storage.createInventoryTemplate(req.body);
      res.json(template);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create template' });
    }
  });

  app.patch('/api/inventory/templates/:id', async (req, res) => {
    try {
      const template = await storage.updateInventoryTemplate(req.params.id, req.body);
      res.json(template);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update template' });
    }
  });

  app.delete('/api/inventory/templates/:id', async (req, res) => {
    await storage.deleteInventoryTemplate(req.params.id);
    res.json({ success: true });
  });

  // Inventory Template Items
  app.get('/api/inventory/template-items', async (req, res) => {
    const { templateId } = req.query;
    if (templateId) {
      const items = await storage.getInventoryTemplateItemsByTemplateId(templateId as string);
      res.json(items);
    } else {
      res.json([]);
    }
  });

  app.post('/api/inventory/template-items', async (req, res) => {
    try {
      const item = await storage.createInventoryTemplateItem(req.body);
      res.json(item);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create template item' });
    }
  });

  app.delete('/api/inventory/template-items/:id', async (req, res) => {
    await storage.deleteInventoryTemplateItem(req.params.id);
    res.json({ success: true });
  });

  // Purchase Orders
  app.get('/api/inventory/purchase-orders', async (req, res) => {
    const orders = await storage.getAllPurchaseOrders();
    res.json(orders);
  });

  app.get('/api/inventory/purchase-orders/:id', async (req, res) => {
    const order = await storage.getPurchaseOrder(req.params.id);
    if (!order) return res.status(404).json({ error: 'Purchase order not found' });
    res.json(order);
  });

  app.post('/api/inventory/purchase-orders', async (req, res) => {
    try {
      const poNumber = await storage.getNextPurchaseOrderNumber();
      const order = await storage.createPurchaseOrder({ ...req.body, poNumber });
      res.json(order);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create purchase order' });
    }
  });

  app.patch('/api/inventory/purchase-orders/:id', async (req, res) => {
    try {
      const order = await storage.updatePurchaseOrder(req.params.id, req.body);
      res.json(order);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update purchase order' });
    }
  });

  app.delete('/api/inventory/purchase-orders/:id', async (req, res) => {
    await storage.deletePurchaseOrder(req.params.id);
    res.json({ success: true });
  });

  // Purchase Order Items
  app.get('/api/inventory/po-items', async (req, res) => {
    const { poId } = req.query;
    if (poId) {
      const items = await storage.getPurchaseOrderItemsByPOId(poId as string);
      res.json(items);
    } else {
      res.json([]);
    }
  });

  app.post('/api/inventory/po-items', async (req, res) => {
    try {
      const item = await storage.createPurchaseOrderItem(req.body);
      res.json(item);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create PO item' });
    }
  });

  app.delete('/api/inventory/po-items/:id', async (req, res) => {
    await storage.deletePurchaseOrderItem(req.params.id);
    res.json({ success: true });
  });

  // Production Plans
  app.get('/api/inventory/production-plans', async (req, res) => {
    const { eventId } = req.query;
    if (eventId) {
      const plans = await storage.getProductionPlansByEventId(eventId as string);
      res.json(plans);
    } else {
      const plans = await storage.getAllProductionPlans();
      res.json(plans);
    }
  });

  app.get('/api/inventory/production-plans/:id', async (req, res) => {
    const plan = await storage.getProductionPlan(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Production plan not found' });
    res.json(plan);
  });

  app.post('/api/inventory/production-plans', async (req, res) => {
    try {
      const plan = await storage.createProductionPlan(req.body);
      res.json(plan);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create production plan' });
    }
  });

  app.patch('/api/inventory/production-plans/:id', async (req, res) => {
    try {
      const plan = await storage.updateProductionPlan(req.params.id, req.body);
      res.json(plan);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update production plan' });
    }
  });

  app.delete('/api/inventory/production-plans/:id', async (req, res) => {
    await storage.deleteProductionPlan(req.params.id);
    res.json({ success: true });
  });

  // Production Tasks
  app.get('/api/inventory/production-tasks', async (req, res) => {
    const { planId } = req.query;
    if (planId) {
      const tasks = await storage.getProductionTasksByPlanId(planId as string);
      res.json(tasks);
    } else {
      const tasks = await storage.getAllProductionTasks();
      res.json(tasks);
    }
  });

  app.post('/api/inventory/production-tasks', async (req, res) => {
    try {
      const task = await storage.createProductionTask(req.body);
      res.json(task);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create production task' });
    }
  });

  app.patch('/api/inventory/production-tasks/:id', async (req, res) => {
    try {
      const task = await storage.updateProductionTask(req.params.id, req.body);
      res.json(task);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update production task' });
    }
  });

  app.delete('/api/inventory/production-tasks/:id', async (req, res) => {
    await storage.deleteProductionTask(req.params.id);
    res.json({ success: true });
  });

  // Production Décor Items
  app.get('/api/inventory/production-decor-items', async (req, res) => {
    try {
      const items = await storage.getAllProductionDecorItems();
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch production décor items' });
    }
  });

  app.post('/api/inventory/production-decor-items', async (req, res) => {
    try {
      const item = await storage.createProductionDecorItem(req.body);
      res.json(item);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create production décor item' });
    }
  });

  app.patch('/api/inventory/production-decor-items/:id', async (req, res) => {
    try {
      const item = await storage.updateProductionDecorItem(req.params.id, req.body);
      if (!item) return res.status(404).json({ error: 'Production décor item not found' });
      res.json(item);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update production décor item' });
    }
  });

  app.delete('/api/inventory/production-decor-items/:id', async (req, res) => {
    await storage.deleteProductionDecorItem(req.params.id);
    res.json({ success: true });
  });

  // Production Décor Elements
  app.get('/api/inventory/production-decor-elements', async (req, res) => {
    const { decorItemId } = req.query;
    try {
      if (decorItemId) {
        const elements = await storage.getProductionDecorElementsByDecorItem(decorItemId as string);
        res.json(elements);
      } else {
        const elements = await storage.getAllProductionDecorElements();
        res.json(elements);
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch production décor elements' });
    }
  });

  app.post('/api/inventory/production-decor-elements', async (req, res) => {
    try {
      const element = await storage.createProductionDecorElement(req.body);
      res.json(element);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create production décor element' });
    }
  });

  app.patch('/api/inventory/production-decor-elements/:id', async (req, res) => {
    try {
      const element = await storage.updateProductionDecorElement(req.params.id, req.body);
      if (!element) return res.status(404).json({ error: 'Production décor element not found' });
      res.json(element);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update production décor element' });
    }
  });

  app.delete('/api/inventory/production-decor-elements/:id', async (req, res) => {
    await storage.deleteProductionDecorElement(req.params.id);
    res.json({ success: true });
  });

  // Production Décor Imports
  app.get('/api/inventory/production-decor-imports', async (req, res) => {
    try {
      const imports = await storage.getAllProductionDecorImports();
      res.json(imports);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch production décor imports' });
    }
  });

  app.post('/api/inventory/production-decor-imports/parse', async (req, res) => {
    try {
      const { pdfBase64, filename, eventId, sourceType } = req.body;
      
      if (!pdfBase64) {
        return res.status(400).json({ error: 'PDF data is required' });
      }

      console.log(`[PDF Parse] Starting parse for file: ${filename}`);
      console.log(`[PDF Parse] Base64 data length: ${pdfBase64.length}`);
      
      let pdfBuffer: Buffer;
      try {
        const base64Data = pdfBase64.includes(',') ? pdfBase64.split(',')[1] : pdfBase64;
        pdfBuffer = Buffer.from(base64Data, 'base64');
        console.log(`[PDF Parse] Buffer created, size: ${pdfBuffer.length} bytes`);
      } catch (bufferError: any) {
        console.error('[PDF Parse] Buffer creation failed:', bufferError);
        return res.status(400).json({ error: 'Invalid PDF data format - could not decode base64' });
      }
      
      let tableRows: string[][] = [];
      try {
        console.log(`[PDF Parse] Using pdfjs-dist library with table extraction`);
        
        const pdfUint8Array = new Uint8Array(pdfBuffer);
        const loadingTask = pdfjsLib.getDocument({ data: pdfUint8Array });
        const pdfDoc = await loadingTask.promise;
        console.log(`[PDF Parse] PDF loaded, pages: ${pdfDoc.numPages}`);
        
        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
          const page = await pdfDoc.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          const rowMap: Map<number, { x: number; text: string }[]> = new Map();
          
          for (const item of textContent.items as any[]) {
            if (!item.str || item.str.trim() === '') continue;
            
            const y = Math.round(item.transform[5] / 3) * 3;
            const x = item.transform[4];
            
            if (!rowMap.has(y)) {
              rowMap.set(y, []);
            }
            rowMap.get(y)!.push({ x, text: item.str });
          }
          
          const sortedYs = Array.from(rowMap.keys()).sort((a, b) => b - a);
          
          for (const y of sortedYs) {
            const rowItems = rowMap.get(y)!;
            rowItems.sort((a, b) => a.x - b.x);
            
            const cells: string[] = [];
            let currentCell = '';
            let lastX = -1000;
            
            for (const item of rowItems) {
              if (lastX !== -1000 && item.x - lastX > 50) {
                if (currentCell.trim()) {
                  cells.push(currentCell.trim());
                }
                currentCell = item.text;
              } else {
                currentCell += (currentCell ? ' ' : '') + item.text;
              }
              lastX = item.x + (item.text.length * 5);
            }
            if (currentCell.trim()) {
              cells.push(currentCell.trim());
            }
            
            if (cells.length > 0) {
              tableRows.push(cells);
            }
          }
        }
        console.log(`[PDF Parse] Extracted ${tableRows.length} rows from PDF`);
      } catch (parseError: any) {
        console.error('[PDF Parse] pdfjs-dist library error:', parseError);
        return res.status(400).json({ 
          error: 'Could not read PDF file. The file may be corrupted, password-protected, or in an unsupported format.' 
        });
      }
      
      if (tableRows.length === 0) {
        return res.status(400).json({ 
          error: 'The PDF appears to be empty or contains only images. Please use a text-based PDF estimate.' 
        });
      }
      
      console.log(`[PDF Parse] First 10 raw rows:`);
      tableRows.slice(0, 10).forEach((row, i) => {
        console.log(`  Row ${i}: [${row.join(' | ')}]`);
      });
      
      const parsedData = parseScheduleFromRows(tableRows);
      console.log(`[PDF Parse] Parsing complete, found ${parsedData.sections.length} sections with ${parsedData.sections.reduce((sum, s) => sum + s.items.length, 0)} total items`);
      if (parsedData.sections[0]?.items.length > 0) {
        console.log(`[PDF Parse] First 3 items:`);
        parsedData.sections[0].items.slice(0, 3).forEach((item, i) => {
          console.log(`  Item ${i}: ${item.description}`);
        });
      }
      
      res.json({ 
        success: true, 
        parsedData,
        filename
      });
    } catch (error: any) {
      console.error('[PDF Parse] Unexpected error:', error);
      res.status(400).json({ error: error.message || 'Failed to parse PDF' });
    }
  });

  app.post('/api/inventory/production-decor-imports/confirm', async (req, res) => {
    try {
      const { parsedData, eventId, eventName, filename, sourceType } = req.body;
      const userId = (req as any).user?.id;

      if (!parsedData || !parsedData.sections || !Array.isArray(parsedData.sections)) {
        return res.status(400).json({ error: 'Invalid parsed data: sections array required' });
      }

      if (parsedData.sections.length === 0) {
        return res.status(400).json({ error: 'No sections found in parsed data' });
      }

      const validSections = parsedData.sections.filter((s: any) => 
        s && Array.isArray(s.items) && s.items.length > 0
      );

      if (validSections.length === 0) {
        return res.status(400).json({ error: 'No valid sections with items found' });
      }

      const importRecord = await storage.createProductionDecorImport({
        eventId: eventId || null,
        sourceType: sourceType || 'estimate',
        filename: filename || 'uploaded.pdf',
        status: 'processing',
        createdBy: userId
      });

      const items: any[] = [];
      const elements: { itemIndex: number; element: any }[] = [];
      const pastelColors = ['blue', 'green', 'yellow', 'pink', 'purple', 'orange'];

      for (let i = 0; i < validSections.length; i++) {
        const section = validSections[i];
        
        const isValidDate = section.installationDate && /^\d{4}-\d{2}-\d{2}$/.test(section.installationDate);
        
        items.push({
          eventId: eventId || null,
          eventName: eventName || section.eventName || 'Imported',
          eventDate: isValidDate ? section.installationDate : null,
          decorType: (section.heading || section.eventName || 'Imported Section').substring(0, 100),
          setupDate: isValidDate ? section.installationDate : null,
          setupTime: null,
          endTime: null,
          priority: 'medium',
          status: 'pending',
          pastelColor: pastelColors[i % pastelColors.length],
          sectionLabel: (section.heading || '').substring(0, 255)
        });

        for (const item of section.items) {
          if (!item || !item.description) continue;
          
          elements.push({
            itemIndex: i,
            element: {
              elementName: String(item.description).substring(0, 255),
              quantity: 1,
              unit: 'Nos',
              source: 'in_stock',
              startTime: item.startTime || '',
              endTime: item.endTime || '',
              responsible: item.responsible || '',
              notes: ''
            }
          });
        }
      }

      const result = await storage.createProductionDecorItemsFromImport(
        importRecord.id,
        items,
        elements
      );

      res.json({ 
        success: true, 
        importId: importRecord.id,
        itemsCreated: result.items.length,
        elementsCreated: result.elements.length
      });
    } catch (error: any) {
      console.error('Import confirm error:', error);
      res.status(400).json({ error: error.message || 'Failed to confirm import' });
    }
  });

  app.delete('/api/inventory/production-decor-imports/:id', async (req, res) => {
    try {
      await storage.deleteProductionDecorImport(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: 'Failed to delete import' });
    }
  });

  // Event Transportation Routes
  app.get('/api/event-transportation', async (req, res) => {
    try {
      const eventId = req.query.eventId as string | undefined;
      if (eventId) {
        const records = await storage.getEventTransportation(eventId);
        res.json(records);
      } else {
        const records = await storage.getAllEventTransportation();
        res.json(records);
      }
    } catch (error) {
      res.status(400).json({ error: 'Failed to fetch transportation records' });
    }
  });

  app.post('/api/event-transportation', async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const data = {
        ...req.body,
        submittedBy: userId || null,
        status: 'pending'
      };
      const record = await storage.createEventTransportation(data);
      res.json(record);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create transportation record' });
    }
  });

  app.patch('/api/event-transportation/:id', async (req, res) => {
    try {
      const record = await storage.updateEventTransportation(req.params.id, req.body);
      res.json(record);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update transportation record' });
    }
  });

  app.patch('/api/event-transportation/:id/approve', async (req, res) => {
    try {
      const auth = await verifyAdminAccess(req, res);
      if (!auth) return;
      
      const existingRecords = await storage.getAllEventTransportation();
      const existing = existingRecords.find(r => r.id === req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'Transportation record not found' });
      }
      if (existing.status !== 'pending') {
        return res.status(400).json({ error: 'Only pending records can be approved' });
      }
      const userId = (req as any).session?.userId;
      const record = await storage.updateEventTransportation(req.params.id, {
        status: 'approved',
        approvedBy: userId,
        approvedAt: new Date()
      });
      res.json(record);
    } catch (error) {
      res.status(400).json({ error: 'Failed to approve transportation record' });
    }
  });

  app.patch('/api/event-transportation/:id/reject', async (req, res) => {
    try {
      const auth = await verifyAdminAccess(req, res);
      if (!auth) return;
      
      const existingRecords = await storage.getAllEventTransportation();
      const existing = existingRecords.find(r => r.id === req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'Transportation record not found' });
      }
      if (existing.status !== 'pending') {
        return res.status(400).json({ error: 'Only pending records can be rejected' });
      }
      const record = await storage.updateEventTransportation(req.params.id, {
        status: 'rejected'
      });
      res.json(record);
    } catch (error) {
      res.status(400).json({ error: 'Failed to reject transportation record' });
    }
  });

  app.patch('/api/event-transportation/:id/pay', async (req, res) => {
    try {
      const auth = await verifyAdminAccess(req, res);
      if (!auth) return;
      
      const { bankId, date } = req.body;
      const existingRecords = await storage.getAllEventTransportation();
      const existing = existingRecords.find(r => r.id === req.params.id);
      
      if (!existing) {
        return res.status(404).json({ error: 'Transportation record not found' });
      }
      if (existing.status !== 'approved') {
        return res.status(400).json({ error: 'Only approved records can be paid' });
      }

      // Create daybook expense entry
      const event = await storage.getEvent(existing.eventId);
      const daybookEntry = await storage.createDaybookEntry({
        date: date || new Date().toISOString().split('T')[0],
        description: `Transportation for ${event?.title || 'Event'}: ${existing.description || 'N/A'}`,
        type: 'expense',
        amount: String(existing.amount),
        category: 'Event Transportation',
        bankId: bankId || null,
        eventId: existing.eventId
      });

      // Update transportation record
      const record = await storage.updateEventTransportation(req.params.id, {
        status: 'paid',
        paidDate: date || new Date().toISOString().split('T')[0],
        daybookEntryId: daybookEntry.id
      });

      res.json(record);
    } catch (error) {
      res.status(400).json({ error: 'Failed to mark transportation as paid' });
    }
  });

  app.delete('/api/event-transportation/:id', async (req, res) => {
    try {
      await storage.deleteEventTransportation(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: 'Failed to delete transportation record' });
    }
  });

  // Event Manpower Routes
  app.get('/api/event-manpower', async (req, res) => {
    try {
      const eventId = req.query.eventId as string | undefined;
      if (eventId) {
        const records = await storage.getEventManpower(eventId);
        res.json(records);
      } else {
        const records = await storage.getAllEventManpower();
        res.json(records);
      }
    } catch (error) {
      res.status(400).json({ error: 'Failed to fetch manpower records' });
    }
  });

  app.post('/api/event-manpower', async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const data = {
        ...req.body,
        submittedBy: userId || null,
        status: 'pending',
        ratePerHour: req.body.ratePerHour && req.body.ratePerHour !== '' ? req.body.ratePerHour : null,
      };
      const record = await storage.createEventManpower(data);
      res.json(record);
    } catch (error: any) {
      console.error('[event-manpower] Error creating record:', error.message || error);
      res.status(400).json({ error: 'Failed to create manpower record' });
    }
  });

  app.patch('/api/event-manpower/:id', async (req, res) => {
    try {
      const record = await storage.updateEventManpower(req.params.id, req.body);
      res.json(record);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update manpower record' });
    }
  });

  app.patch('/api/event-manpower/:id/approve', async (req, res) => {
    try {
      const auth = await verifyAdminAccess(req, res);
      if (!auth) return;
      
      const existingRecords = await storage.getAllEventManpower();
      const existing = existingRecords.find(r => r.id === req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'Manpower record not found' });
      }
      if (existing.status !== 'pending') {
        return res.status(400).json({ error: 'Only pending records can be approved' });
      }
      const userId = (req as any).session?.userId;
      const record = await storage.updateEventManpower(req.params.id, {
        status: 'approved',
        approvedBy: userId,
        approvedAt: new Date()
      });
      res.json(record);
    } catch (error) {
      res.status(400).json({ error: 'Failed to approve manpower record' });
    }
  });

  app.patch('/api/event-manpower/:id/reject', async (req, res) => {
    try {
      const auth = await verifyAdminAccess(req, res);
      if (!auth) return;
      
      const existingRecords = await storage.getAllEventManpower();
      const existing = existingRecords.find(r => r.id === req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'Manpower record not found' });
      }
      if (existing.status !== 'pending') {
        return res.status(400).json({ error: 'Only pending records can be rejected' });
      }
      const record = await storage.updateEventManpower(req.params.id, {
        status: 'rejected'
      });
      res.json(record);
    } catch (error) {
      res.status(400).json({ error: 'Failed to reject manpower record' });
    }
  });

  app.patch('/api/event-manpower/:id/pay', async (req, res) => {
    try {
      const auth = await verifyAdminAccess(req, res);
      if (!auth) return;
      
      const { bankId, date } = req.body;
      const existingRecords = await storage.getAllEventManpower();
      const existing = existingRecords.find(r => r.id === req.params.id);
      
      if (!existing) {
        return res.status(404).json({ error: 'Manpower record not found' });
      }
      if (existing.status !== 'approved') {
        return res.status(400).json({ error: 'Only approved records can be paid' });
      }

      // Create daybook expense entry
      const event = await storage.getEvent(existing.eventId);
      const daybookEntry = await storage.createDaybookEntry({
        date: date || new Date().toISOString().split('T')[0],
        description: `Manpower for ${event?.title || 'Event'}: ${existing.subcontractorName} (${existing.numberOfPersons} persons, ${existing.hoursWorked}h)`,
        type: 'expense',
        amount: String(existing.totalAmount),
        category: 'Event Manpower',
        bankId: bankId || null,
        eventId: existing.eventId
      });

      // Update manpower record
      const record = await storage.updateEventManpower(req.params.id, {
        status: 'paid',
        paidDate: date || new Date().toISOString().split('T')[0],
        daybookEntryId: daybookEntry.id
      });

      res.json(record);
    } catch (error) {
      res.status(400).json({ error: 'Failed to mark manpower as paid' });
    }
  });

  app.delete('/api/event-manpower/:id', async (req, res) => {
    try {
      await storage.deleteEventManpower(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: 'Failed to delete manpower record' });
    }
  });

  // Event Staff Assignments - Staff assigned to events via Event Hub
  app.get('/api/event-staff-assignments', async (req, res) => {
    try {
      const eventId = req.query.eventId as string;
      if (!eventId) {
        return res.status(400).json({ error: 'eventId is required' });
      }
      const assignments = await storage.getEventStaffAssignments(eventId);
      res.json(assignments);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch staff assignments' });
    }
  });

  app.post('/api/event-staff-assignments', async (req, res) => {
    try {
      const userId = (req as any).session?.userId;
      const { assignments } = req.body;
      
      if (!Array.isArray(assignments) || assignments.length === 0) {
        return res.status(400).json({ error: 'assignments array is required' });
      }
      
      // Get the event once
      const eventId = assignments[0].eventId;
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }
      
      // Create all assignments
      const assignmentsData = assignments.map((a: any) => ({
        ...a,
        assignedBy: userId || null
      }));
      const created = await storage.createEventStaffAssignments(assignmentsData);
      
      // Send WhatsApp notifications if configured
      if (isWhatsAppConfigured()) {
        const notificationResults: { staffId: string; status: string; error?: string }[] = [];
        
        for (const assignment of created) {
          try {
            // Get employee details
            const employee = await storage.getEmployee(assignment.employeeId);
            if (!employee || !employee.phone) {
              notificationResults.push({ staffId: assignment.employeeId, status: 'skipped', error: 'No phone number' });
              continue;
            }
            
            // Format the message
            const eventDate = event.date ? new Date(event.date).toLocaleDateString('en-IN', { 
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' 
            }) : 'TBD';
            
            const staffMessage = `*Event Assignment Confirmed:*\n${event.title}\n\nDate: ${eventDate}\nVenue: ${event.venue || 'TBD'}\nRole: ${assignment.role}\nReporting Time: ${assignment.reportingTime || 'TBD'}\n\nPlease confirm availability and be on time.`;
            
            await sendWhatsAppMessage(employee.phone, staffMessage);
            
            // Mark as notified
            await storage.markEventStaffAssignmentNotified(assignment.id);
            
            // Log notification
            await storage.createAutomationLog({
              eventId: eventId,
              actionType: 'staff_assignment_notification',
              status: 'success',
              metadata: { 
                staffId: assignment.employeeId,
                staffName: employee.name,
                staffPhone: employee.phone,
                role: assignment.role
              }
            });
            
            notificationResults.push({ staffId: assignment.employeeId, status: 'sent' });
            console.log(`[Automation] Sent staff assignment notification to ${employee.name} (${employee.phone})`);
          } catch (notifError) {
            console.error(`[Automation] Failed to send notification to staff ${assignment.employeeId}:`, notifError);
            notificationResults.push({ staffId: assignment.employeeId, status: 'failed', error: String(notifError) });
          }
        }
        
        // Send summary to planner/supervisor only if at least one notification was sent
        const successfulNotifications = notificationResults.filter(r => r.status === 'sent').length;
        const failedNotifications = notificationResults.filter(r => r.status === 'failed').length;
        const skippedNotifications = notificationResults.filter(r => r.status === 'skipped').length;
        
        if (successfulNotifications > 0) {
          try {
            const PLANNER_PHONES: Record<string, string> = {
              'fida fathima': '+919895810975',
              'fida': '+919895810975',
              'femina km': '+917306687284',
              'femina': '+917306687284',
              'kishor': '+917902373354',
            };
            
            const plannerName = event.planner?.toLowerCase() || '';
            let plannerPhone = PLANNER_PHONES['kishor']; // Default
            
            for (const [key, phone] of Object.entries(PLANNER_PHONES)) {
              if (plannerName.includes(key)) {
                plannerPhone = phone;
                break;
              }
            }
            
            let summaryStatus = `Notified: ${successfulNotifications}`;
            if (failedNotifications > 0) summaryStatus += `, Failed: ${failedNotifications}`;
            if (skippedNotifications > 0) summaryStatus += `, Skipped: ${skippedNotifications}`;
            
            const supervisorMessage = `*Team Assigned Successfully:*\n${event.title}\n\nTotal Staff Assigned: ${created.length}\n${summaryStatus}`;
            await sendWhatsAppMessage(plannerPhone, supervisorMessage);
            
            // Log supervisor notification
            await storage.createAutomationLog({
              eventId: eventId,
              actionType: 'staff_assignment_summary',
              status: 'success',
              metadata: { 
                supervisorPhone: plannerPhone,
                staffCount: created.length,
                eventTitle: event.title,
                notificationStats: { sent: successfulNotifications, failed: failedNotifications, skipped: skippedNotifications }
              }
            });
            
            console.log(`[Automation] Sent staff assignment summary to planner ${event.planner}`);
          } catch (summaryError) {
            console.error('[Automation] Failed to send summary to planner:', summaryError);
          }
        }
      }
      
      res.json({ 
        success: true, 
        assignments: created,
        message: `Successfully assigned ${created.length} staff members` 
      });
    } catch (error) {
      console.error('Staff assignment error:', error);
      res.status(400).json({ error: 'Failed to create staff assignments' });
    }
  });

  app.patch('/api/event-staff-assignments/:id', async (req, res) => {
    try {
      const assignment = await storage.updateEventStaffAssignment(req.params.id, req.body);
      res.json(assignment);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update staff assignment' });
    }
  });

  app.delete('/api/event-staff-assignments/:id', async (req, res) => {
    try {
      await storage.deleteEventStaffAssignment(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: 'Failed to delete staff assignment' });
    }
  });

  // Object Storage - Image Upload Routes
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error fetching object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.post("/api/objects/upload", async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error: any) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: error.message || "Failed to get upload URL" });
    }
  });

  app.put("/api/objects/finalize", async (req, res) => {
    if (!req.body.uploadURL) {
      return res.status(400).json({ error: "uploadURL is required" });
    }
    try {
      const objectStorageService = new ObjectStorageService();
      const objectPath = objectStorageService.normalizeObjectEntityPath(req.body.uploadURL);
      res.status(200).json({ objectPath });
    } catch (error: any) {
      console.error("Error finalizing upload:", error);
      res.status(500).json({ error: error.message || "Failed to finalize upload" });
    }
  });

  // PWA Share Target fallback - if service worker doesn't intercept, redirect to employee portal
  // The service worker should handle this, but this is a fallback
  app.post("/quick-entry-share", (req, res) => {
    console.log("[Share Target] Fallback route hit - service worker may not be active");
    res.redirect(303, '/employee-portal?share-error=true&msg=Service+worker+not+active');
  });

  // =============================================
  // Calendar Integration Routes
  // =============================================

  // Check Google Calendar connection status
  app.get('/api/calendar/google/status', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const { isGoogleCalendarConnected } = await import('./google-calendar');
      const connected = await isGoogleCalendarConnected();
      res.json({ connected });
    } catch (error) {
      res.json({ connected: false });
    }
  });

  // List Google Calendars
  app.get('/api/calendar/google/calendars', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const { listCalendars } = await import('./google-calendar');
      const calendars = await listCalendars();
      res.json(calendars);
    } catch (error: any) {
      console.error('[Calendar] Error listing calendars:', error);
      res.status(500).json({ error: error.message || 'Failed to list calendars' });
    }
  });

  // Sync a single event to Google Calendar
  app.post('/api/calendar/google/sync/:eventId', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const { syncEventToGoogleCalendar } = await import('./google-calendar');
      const event = await storage.getEvent(req.params.eventId);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const calendarId = req.body.calendarId || 'primary';
      const result = await syncEventToGoogleCalendar({
        id: event.id,
        title: event.title,
        date: event.date,
        time: event.time,
        venue: event.venue,
        customer: event.customer,
        type: event.type,
        planner: event.planner,
        googleCalendarEventId: event.googleCalendarEventId,
      }, calendarId);

      // Update the event with the Google Calendar event ID
      await storage.updateEvent(event.id, {
        googleCalendarEventId: result.googleEventId
      });

      res.json({ 
        success: true, 
        action: result.action,
        googleEventId: result.googleEventId 
      });
    } catch (error: any) {
      console.error('[Calendar] Sync error:', error);
      res.status(500).json({ error: error.message || 'Failed to sync event' });
    }
  });

  // Bulk sync all events to Google Calendar
  app.post('/api/calendar/google/sync-all', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const { syncEventToGoogleCalendar, isGoogleCalendarConnected } = await import('./google-calendar');
      
      const connected = await isGoogleCalendarConnected();
      if (!connected) {
        return res.status(400).json({ error: 'Google Calendar not connected' });
      }

      const events = await storage.getAllEvents();
      const calendarId = req.body.calendarId || 'primary';
      const results = { synced: 0, failed: 0, errors: [] as string[] };

      for (const event of events) {
        try {
          const result = await syncEventToGoogleCalendar({
            id: event.id,
            title: event.title,
            date: event.date,
            time: event.time,
            venue: event.venue,
            customer: event.customer,
            type: event.type,
            planner: event.planner,
            googleCalendarEventId: event.googleCalendarEventId,
          }, calendarId);

          await storage.updateEvent(event.id, {
            googleCalendarEventId: result.googleEventId
          });
          results.synced++;
        } catch (error: any) {
          results.failed++;
          results.errors.push(`${event.title}: ${error.message}`);
        }
      }

      res.json(results);
    } catch (error: any) {
      console.error('[Calendar] Bulk sync error:', error);
      res.status(500).json({ error: error.message || 'Failed to sync events' });
    }
  });

  // Delete event from Google Calendar
  app.delete('/api/calendar/google/event/:eventId', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const event = await storage.getEvent(req.params.eventId);
      if (!event || !event.googleCalendarEventId) {
        return res.status(404).json({ error: 'Event not synced to Google Calendar' });
      }

      const { deleteGoogleCalendarEvent } = await import('./google-calendar');
      const calendarId = req.body.calendarId || 'primary';
      await deleteGoogleCalendarEvent(event.googleCalendarEventId, calendarId);

      // Clear the Google Calendar event ID
      await storage.updateEvent(event.id, {
        googleCalendarEventId: null
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error('[Calendar] Delete error:', error);
      res.status(500).json({ error: error.message || 'Failed to delete event from calendar' });
    }
  });

  // Get Google Calendar events
  app.get('/api/calendar/google/events', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const { getGoogleCalendarEvents } = await import('./google-calendar');
      const calendarId = (req.query.calendarId as string) || 'primary';
      const events = await getGoogleCalendarEvents(calendarId);
      res.json(events);
    } catch (error: any) {
      console.error('[Calendar] Get events error:', error);
      res.status(500).json({ error: error.message || 'Failed to get calendar events' });
    }
  });

  // ==================== OAKSY AI ASSISTANT ====================
  
  // Helper to check Oaksy access
  async function checkOaksyAccess(userId: string): Promise<{ allowed: boolean; user?: any; allowedPages?: string[] }> {
    const user = await storage.getUser(userId);
    if (!user) return { allowed: false };
    
    // Only superadmin gets ALL_PAGES, everyone else (including admin) gets filtered by their permissions
    let allowedPages: string[];
    if (user.role === 'superadmin') {
      allowedPages = ALL_PAGES;
    } else {
      const permissions = await storage.getUserPermissions(user.id);
      allowedPages = permissions.map(p => p.pageId);
    }
    
    const { canAccessOaksy } = await import('./oaksy-ai');
    return { allowed: canAccessOaksy(user.role, allowedPages), user, allowedPages };
  }

  // Get user's conversations
  app.get('/api/oaksy/conversations', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const access = await checkOaksyAccess(req.session.userId);
      if (!access.allowed) {
        return res.status(403).json({ error: 'You do not have access to Oaksy AI' });
      }
      const conversations = await storage.getOaksyConversations(req.session.userId);
      res.json(conversations);
    } catch (error: any) {
      console.error('[Oaksy] Get conversations error:', error);
      res.status(500).json({ error: error.message || 'Failed to get conversations' });
    }
  });

  // Get single conversation with messages
  app.get('/api/oaksy/conversations/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const access = await checkOaksyAccess(req.session.userId);
      if (!access.allowed) {
        return res.status(403).json({ error: 'You do not have access to Oaksy AI' });
      }
      const conversation = await storage.getOaksyConversation(req.params.id);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }
      if (conversation.userId !== req.session.userId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      const messages = await storage.getOaksyMessages(req.params.id);
      res.json({ ...conversation, messages });
    } catch (error: any) {
      console.error('[Oaksy] Get conversation error:', error);
      res.status(500).json({ error: error.message || 'Failed to get conversation' });
    }
  });

  // Create new conversation
  app.post('/api/oaksy/conversations', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const access = await checkOaksyAccess(req.session.userId);
      if (!access.allowed) {
        return res.status(403).json({ error: 'You do not have access to Oaksy AI' });
      }
      const { department } = req.body;
      const conversation = await storage.createOaksyConversation({
        userId: req.session.userId,
        department: department || 'general',
      });
      res.json(conversation);
    } catch (error: any) {
      console.error('[Oaksy] Create conversation error:', error);
      res.status(500).json({ error: error.message || 'Failed to create conversation' });
    }
  });

  // Delete conversation (superadmin can delete any, others can only delete their own)
  app.delete('/api/oaksy/conversations/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const access = await checkOaksyAccess(req.session.userId);
      if (!access.allowed) {
        return res.status(403).json({ error: 'You do not have access to Oaksy AI' });
      }
      const conversation = await storage.getOaksyConversation(req.params.id);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }
      // Superadmin can delete any conversation, others can only delete their own
      const user = await storage.getUser(req.session.userId);
      if (conversation.userId !== req.session.userId && user?.role !== 'superadmin') {
        return res.status(403).json({ error: 'Access denied' });
      }
      await storage.deleteOaksyConversation(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Oaksy] Delete conversation error:', error);
      res.status(500).json({ error: error.message || 'Failed to delete conversation' });
    }
  });

  // Clear all Oaksy chat history (superadmin only)
  app.delete('/api/oaksy/conversations', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Only superadmin can clear all chat history' });
      }
      const deletedCount = await storage.deleteAllOaksyConversations();
      res.json({ success: true, deletedCount });
    } catch (error: any) {
      console.error('[Oaksy] Clear all history error:', error);
      res.status(500).json({ error: error.message || 'Failed to clear history' });
    }
  });

  // Download generated document (superadmin only)
  app.get('/api/oaksy/documents/:documentId', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Only superadmin can download documents' });
      }
      
      const { getDocument } = await import('./document-service');
      const doc = getDocument(req.params.documentId);
      
      if (!doc) {
        return res.status(404).json({ error: 'Document not found or expired. Please generate a new one.' });
      }
      
      res.setHeader('Content-Type', doc.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${doc.filename}"`);
      res.send(doc.data);
    } catch (error: any) {
      console.error('[Oaksy] Document download error:', error);
      res.status(500).json({ error: 'Failed to download document' });
    }
  });

  // Send message to Oaksy
  app.post('/api/oaksy/conversations/:id/messages', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const { content, inputType } = req.body;
      if (!content) {
        return res.status(400).json({ error: 'Message content is required' });
      }

      const conversation = await storage.getOaksyConversation(req.params.id);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }
      if (conversation.userId !== req.session.userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Save user message
      await storage.createOaksyMessage({
        conversationId: req.params.id,
        role: 'user',
        content,
        inputType: inputType || 'text',
      });

      // Get user info for context
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }
      
      // Get user's allowed pages for permission filtering (only superadmin gets ALL_PAGES)
      let allowedPages: string[];
      if (user.role === 'superadmin') {
        allowedPages = ALL_PAGES;
      } else {
        const permissions = await storage.getUserPermissions(user.id);
        allowedPages = permissions.map(p => p.pageId);
      }
      
      // Check if user can access Oaksy (exclude employee portal users)
      const { canAccessOaksy, generateOaksyResponse, generateConversationTitle } = await import('./oaksy-ai');
      if (!canAccessOaksy(user.role, allowedPages)) {
        return res.status(403).json({ error: 'You do not have access to Oaksy AI' });
      }
      
      // Build context for AI
      const events = await storage.getAllEvents();
      const employees = await storage.getAllEmployees();
      const banks = await storage.getAllBanks();
      const daybookCategories = await storage.getAllDaybookCategories();
      
      // Calculate daybook summary for current month
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      const daybookEntries = await storage.getDaybookEntriesByDateRange(monthStart, monthEnd);
      
      const totalIncome = daybookEntries
        .filter(e => e.type === 'income')
        .reduce((sum, e) => sum + Number(e.amount), 0);
      const totalExpense = daybookEntries
        .filter(e => e.type === 'expense')
        .reduce((sum, e) => sum + Number(e.amount), 0);

      const context = {
        userId: req.session.userId,
        userRole: user.role,
        allowedPages,
        department: conversation.department || undefined,
        events,
        employees,
        banks,
        daybookCategories,
        daybookSummary: {
          totalIncome,
          totalExpense,
          balance: totalIncome - totalExpense,
        },
      };
      const aiResult = await generateOaksyResponse(
        req.params.id,
        content,
        context,
        conversation.department || 'general'
      );

      // Save AI response with action metadata
      const assistantMessage = await storage.createOaksyMessage({
        conversationId: req.params.id,
        role: 'assistant',
        content: aiResult.response,
        metadata: aiResult.actions && aiResult.actions.length > 0 ? { actions: aiResult.actions } : null,
      });

      // Update conversation title if this is the first message
      const allMessages = await storage.getOaksyMessages(req.params.id);
      if (allMessages.length <= 2 && !conversation.title) {
        const title = await generateConversationTitle(content);
        await storage.updateOaksyConversation(req.params.id, { title });
      }

      res.json({ ...assistantMessage, actions: aiResult.actions });
    } catch (error: any) {
      console.error('[Oaksy] Send message error:', error);
      res.status(500).json({ error: error.message || 'Failed to send message' });
    }
  });

  // Oak Creative AI Presentation Generation
  app.post('/api/oaksy/generate-presentation', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const { prompt, presentationId, generateImages = true } = req.body;
      if (!prompt || !presentationId) {
        return res.status(400).json({ error: 'Prompt and presentationId are required' });
      }

      const presentation = await storage.getPresentation(presentationId);
      if (!presentation) {
        return res.status(404).json({ error: 'Presentation not found' });
      }

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const systemPrompt = `You are an expert wedding and event presentation designer for Oakstreet Events. 
Generate a structured JSON array of slides for a wedding/event presentation based on the user's request.

Each slide should have:
- slideType: "cover" | "category" | "content" | "contact"
- title: Main slide title
- subtitle: Optional subtitle
- category: Category name for category slides (e.g., "Welcome Board", "Entrance Arch", "Mandap", "Haldi Decor", "Mehendi Decor", "Stage Setup", "Ceiling Decor", "Table Setup", "Lighting", "Floral Arrangements")
- layout: "single" | "options-grid" | "full-image" | "text-only"
- content: Optional text content for the slide
- imagePrompt: A detailed prompt for generating an image for this slide (only for category/content slides that need visuals)

Common wedding presentation categories:
- Welcome Board
- Entrance Arch
- Mandap/Stage
- Haldi Decor
- Mehendi Decor
- Sangeet Setup
- Reception Stage
- Ceiling Decor
- Table Setup
- Floral Arrangements
- Lighting Design
- Photo Booth
- Seating Arrangement

For imagePrompt, write detailed visual descriptions like:
"Elegant Indian wedding mandap with intricate gold and red fabric drapes, marigold flowers, traditional wooden pillars, soft ambient lighting, luxurious and festive atmosphere"

Respond with a JSON array only, no markdown formatting.`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Create a presentation for: ${prompt}\n\nClient: ${presentation.clientName || 'Client'}\nEvent Type: ${presentation.eventType || 'wedding'}\nTheme: ${presentation.theme || 'traditional'}` }
        ],
        temperature: 0.7,
        max_tokens: 3000,
      });

      const responseText = completion.choices[0]?.message?.content || '[]';
      
      // Parse the JSON response
      let slides: any[] = [];
      try {
        const cleanedResponse = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        slides = JSON.parse(cleanedResponse);
      } catch (parseError) {
        console.error('[Oak Creative] Failed to parse AI response:', parseError);
        return res.status(500).json({ error: 'Failed to parse AI response' });
      }

      // Create slides in database
      const createdSlides = [];
      for (let i = 0; i < slides.length; i++) {
        const slideData = slides[i];
        const slide = await storage.createPresentationSlide({
          presentationId,
          slideType: slideData.slideType || 'category',
          title: slideData.title || `Slide ${i + 1}`,
          subtitle: slideData.subtitle || null,
          category: slideData.category || null,
          layout: slideData.layout || 'options-grid',
          sortOrder: i,
          content: slideData.content ? JSON.stringify({ text: slideData.content }) : null,
        });
        createdSlides.push({ ...slide, imagePrompt: slideData.imagePrompt });
      }

      // Generate images for slides that have imagePrompt (limit to 5 to save costs/time)
      if (generateImages) {
        const slidesWithPrompts = createdSlides.filter(s => s.imagePrompt).slice(0, 5);
        
        for (const slide of slidesWithPrompts) {
          try {
            console.log(`[Oak Creative] Generating image for slide: ${slide.title}`);
            const imageResponse = await openai.images.generate({
              model: 'dall-e-3',
              prompt: `Professional event decoration photograph: ${slide.imagePrompt}. High quality, realistic, elegant wedding/event decor.`,
              n: 1,
              size: '1024x1024',
              quality: 'standard',
            });

            const imageUrl = imageResponse.data[0]?.url;
            if (imageUrl) {
              await storage.createSlideImage({
                slideId: slide.id,
                imageUrl,
                optionLabel: slide.category || slide.title || 'Option',
                sortOrder: 0,
              });
              console.log(`[Oak Creative] Image created for slide: ${slide.title}`);
            }
          } catch (imgError: any) {
            console.error(`[Oak Creative] Failed to generate image for slide ${slide.title}:`, imgError.message);
            // Continue with other slides even if one fails
          }
        }
      }

      res.json({ 
        success: true, 
        message: `Generated ${createdSlides.length} slides${generateImages ? ' with images' : ''}`,
        slides: createdSlides 
      });
    } catch (error: any) {
      console.error('[Oak Creative] AI generation error:', error);
      res.status(500).json({ error: error.message || 'Failed to generate presentation' });
    }
  });

  // Media proxy endpoint - serves Twilio media with authentication
  // This creates a public URL that WhatsApp can use to access images
  app.get('/api/media-proxy/:messageId/:mediaId', async (req, res) => {
    try {
      const { messageId, mediaId } = req.params;
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      
      if (!accountSid || !authToken) {
        return res.status(500).json({ error: 'Twilio not configured' });
      }
      
      // Construct the Twilio media URL
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages/${messageId}/Media/${mediaId}`;
      
      // Download from Twilio with basic auth
      const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
      const response = await fetch(twilioUrl, {
        headers: { 'Authorization': authHeader }
      });
      
      if (!response.ok) {
        return res.status(response.status).json({ error: 'Failed to fetch media' });
      }
      
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      res.set('Content-Type', contentType);
      res.set('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
      
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (error: any) {
      console.error('[Media Proxy] Error:', error.message);
      res.status(500).json({ error: 'Failed to proxy media' });
    }
  });

  // WhatsApp Messaging Routes
  app.get('/api/whatsapp/status', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const { isWhatsAppConfigured, getWhatsAppFromNumber } = await import('./whatsapp-service');
    res.json({
      configured: isWhatsAppConfigured(),
      fromNumber: getWhatsAppFromNumber(),
    });
  });

  // Get WhatsApp opt-in link for employees
  app.get('/api/whatsapp/opt-in-link', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const { getWhatsAppFromNumber } = await import('./whatsapp-service');
    const fromNumber = getWhatsAppFromNumber();
    if (!fromNumber) {
      return res.status(400).json({ error: 'WhatsApp not configured' });
    }
    // Remove whatsapp: prefix and + if present
    const cleanNumber = fromNumber.replace(/^whatsapp:/i, '').replace(/^\+/, '');
    const optInMessage = encodeURIComponent('Hi, I would like to opt-in to receive WhatsApp messages from Oakstreet Events.');
    const clickToChatLink = `https://wa.me/${cleanNumber}?text=${optInMessage}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(clickToChatLink)}`;
    res.json({
      link: clickToChatLink,
      qrCodeUrl,
      phoneNumber: fromNumber,
    });
  });

  app.get('/api/whatsapp/templates', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const templates = await storage.getAllWhatsappTemplates();
    res.json(templates);
  });

  app.get('/api/whatsapp/templates/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const template = await storage.getWhatsappTemplate(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(template);
  });

  app.post('/api/whatsapp/templates', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || !['superadmin', 'admin'].includes(user.role)) {
      return res.status(403).json({ error: 'Only admins can create templates' });
    }
    const { name, body, category } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Template name is required' });
    }
    if (!body || typeof body !== 'string' || body.trim().length === 0) {
      return res.status(400).json({ error: 'Template body is required' });
    }
    const template = await storage.createWhatsappTemplate({
      name: name.trim(),
      body: body.trim(),
      category: category || 'custom',
      createdBy: req.session.userId,
    });
    res.json(template);
  });

  app.put('/api/whatsapp/templates/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || !['superadmin', 'admin'].includes(user.role)) {
      return res.status(403).json({ error: 'Only admins can update templates' });
    }
    const template = await storage.updateWhatsappTemplate(req.params.id, req.body);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(template);
  });

  app.delete('/api/whatsapp/templates/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || !['superadmin', 'admin'].includes(user.role)) {
      return res.status(403).json({ error: 'Only admins can delete templates' });
    }
    await storage.deleteWhatsappTemplate(req.params.id);
    res.json({ success: true });
  });

  app.get('/api/whatsapp/jobs', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const jobs = await storage.getAllWhatsappJobs();
    res.json(jobs);
  });

  app.get('/api/whatsapp/jobs/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const job = await storage.getWhatsappJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    const logs = await storage.getWhatsappLogsByJob(job.id);
    res.json({ ...job, logs });
  });

  app.post('/api/whatsapp/jobs', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || !['superadmin', 'admin'].includes(user.role)) {
      return res.status(403).json({ error: 'Only admins can send messages' });
    }
    
    const { templateId, customMessage, targetMode, targetEmployeeIds, targetDepartments } = req.body;
    
    if (!templateId && !customMessage) {
      return res.status(400).json({ error: 'Either templateId or customMessage is required' });
    }
    if (!targetMode || !['selected', 'department', 'all'].includes(targetMode)) {
      return res.status(400).json({ error: 'Invalid targetMode. Must be: selected, department, or all' });
    }
    if (targetMode === 'selected' && (!targetEmployeeIds || targetEmployeeIds.length === 0)) {
      return res.status(400).json({ error: 'At least one employee must be selected' });
    }
    if (targetMode === 'department' && (!targetDepartments || targetDepartments.length === 0)) {
      return res.status(400).json({ error: 'At least one department must be selected' });
    }
    
    try {
      const job = await storage.createWhatsappJob({
        templateId: templateId || null,
        customMessage: customMessage || null,
        targetMode,
        targetEmployeeIds: targetEmployeeIds || null,
        targetDepartments: targetDepartments || null,
        requestedBy: req.session.userId,
        status: 'pending',
      });
      
      if (!req.body.scheduledFor) {
        const { processWhatsAppJob } = await import('./whatsapp-service');
        await processWhatsAppJob(job.id);
        const updatedJob = await storage.getWhatsappJob(job.id);
        res.json(updatedJob);
      } else {
        res.json(job);
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/whatsapp/jobs/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || !['superadmin', 'admin'].includes(user.role)) {
      return res.status(403).json({ error: 'Only admins can delete jobs' });
    }
    await storage.deleteWhatsappJob(req.params.id);
    res.json({ success: true });
  });

  app.get('/api/whatsapp/employees', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const employees = await storage.getAllEmployees();
    // Show employees who have a WhatsApp number OR (phone + opted-in)
    const optedInEmployees = employees.filter(e => e.whatsappNumber || (e.phone && e.whatsappOptIn));
    res.json(optedInEmployees);
  });

  // WhatsApp Two-Way Communication Webhook (receives incoming messages from Twilio)
  app.post('/api/webhooks/twilio-whatsapp', async (req, res) => {
    try {
      const { From, Body, MediaUrl0, MediaContentType0, MessageSid } = req.body;
      
      if (!From) {
        return res.status(400).send('<Response></Response>');
      }

      console.log('[Oaksy WhatsApp] Incoming message:', { From, Body: Body?.substring(0, 50), hasMedia: !!MediaUrl0 });

      const { handleOaksyWhatsAppMessage } = await import('./oaksy-whatsapp-ai');
      
      // Oaksy AI handles all messages - including superadmin approvals
      const responseMessage = await handleOaksyWhatsAppMessage(From, Body || '', MediaUrl0, MediaContentType0, MessageSid);

      // Return TwiML response
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapeXml(responseMessage)}</Message>
</Response>`;

      res.type('text/xml').send(twiml);
    } catch (error: any) {
      console.error('[WhatsApp Webhook] Error:', error.message);
      res.type('text/xml').send('<Response><Message>Sorry, something went wrong. Please try again.</Message></Response>');
    }
  });

  // Get pending WhatsApp approvals (for dashboard)
  app.get('/api/whatsapp/pending-approvals', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || !['superadmin', 'admin', 'accountant'].includes(user.role)) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const approvals = await storage.getPendingWhatsappApprovals();
    res.json(approvals);
  });

  // Get all WhatsApp approvals history
  app.get('/api/whatsapp/approvals', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || !['superadmin', 'admin', 'accountant'].includes(user.role)) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const approvals = await storage.getAllWhatsappApprovals();
    res.json(approvals);
  });

  // Manually approve/reject from dashboard
  app.post('/api/whatsapp/approvals/:id/respond', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || !['superadmin', 'admin', 'accountant'].includes(user.role)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { action, responseMessage } = req.body;
    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Action must be approve or reject' });
    }

    const approval = await storage.getWhatsappPendingApprovalByCode(req.params.id) || 
                     await storage.getAllWhatsappApprovals().then(all => all.find(a => a.id === req.params.id));
    
    if (!approval) {
      return res.status(404).json({ error: 'Approval not found' });
    }

    if (approval.status !== 'pending') {
      return res.status(400).json({ error: 'Approval already processed' });
    }

    const status = action === 'approve' ? 'approved' : 'rejected';
    
    await storage.updateWhatsappPendingApproval(approval.id, {
      status,
      respondedAt: new Date(),
      responseMessage: responseMessage || null,
    });

    // Update the actual request
    if (approval.type === 'expense') {
      await storage.updateExpenseReimbursement(approval.requestId, {
        status,
        approvedAt: action === 'approve' ? new Date() : undefined,
        approvedBy: req.session.userId,
        managerComments: responseMessage || null,
      });
    } else if (approval.type === 'leave') {
      await storage.updateLeaveRequest(approval.requestId, {
        status,
        approvedAt: action === 'approve' ? new Date() : undefined,
        managerId: req.session.userId,
        managerComments: responseMessage || null,
      });
    }

    // Notify employee via WhatsApp
    const employee = await storage.getEmployee(approval.employeeId);
    if (employee?.whatsappNumber || employee?.phone) {
      const { sendWhatsAppMessage } = await import('./whatsapp-service');
      const employeePhone = employee.whatsappNumber || employee.phone!;
      const statusEmoji = action === 'approve' ? '✅' : '❌';
      const statusText = action === 'approve' ? 'APPROVED' : 'REJECTED';
      const requestType = approval.type === 'expense' ? 'Expense' : 'Leave';
      
      await sendWhatsAppMessage(
        employeePhone,
        `${statusEmoji} Your ${requestType} request (${approval.approvalCode}) has been *${statusText}*!\n\n${approval.description}${responseMessage ? `\n\nComment: ${responseMessage}` : ''}`
      );
    }

    res.json({ success: true, status });
  });

  // Get inbound messages history
  app.get('/api/whatsapp/inbound-messages', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || !['superadmin', 'admin'].includes(user.role)) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const messages = await storage.getWhatsappInboundMessages(100);
    res.json(messages);
  });

  // ===========================
  // EXECUTION PLAN ROUTES
  // ===========================

  // Main Execution Plans
  app.get('/api/execution-plans', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const { eventId } = req.query;
    if (eventId && typeof eventId === 'string') {
      const plans = await storage.getExecutionPlansByEvent(eventId);
      return res.json(plans);
    }
    const plans = await storage.getAllExecutionPlans();
    res.json(plans);
  });

  app.get('/api/execution-plans/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const plan = await storage.getExecutionPlan(req.params.id);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    res.json(plan);
  });

  app.get('/api/execution-plans/:id/full', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const fullPlan = await storage.getFullExecutionPlan(req.params.id);
    if (!fullPlan.plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    res.json(fullPlan);
  });

  app.post('/api/execution-plans', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const { eventId, title, description, status } = req.body;
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'Plan title is required' });
    }
    const plan = await storage.createExecutionPlan({
      eventId: eventId || null,
      title: title.trim(),
      description: description || null,
      status: status || 'draft',
      createdBy: req.session.userId,
    });
    res.json(plan);
  });

  app.put('/api/execution-plans/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const plan = await storage.updateExecutionPlan(req.params.id, req.body);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    res.json(plan);
  });

  app.delete('/api/execution-plans/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    await storage.deleteExecutionPlan(req.params.id);
    res.json({ success: true });
  });

  // Checklist Items
  app.get('/api/execution-plans/:planId/checklist', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const items = await storage.getExecutionPlanChecklist(req.params.planId);
    res.json(items);
  });

  app.post('/api/execution-plans/:planId/checklist', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const item = await storage.createExecutionPlanChecklistItem({
      planId: req.params.planId,
      ...req.body,
    });
    res.json(item);
  });

  // Bulk insert checklist items (for template loading)
  app.post('/api/execution-plans/:planId/checklist/bulk', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Items must be an array' });
    }
    const createdItems = [];
    for (const item of items) {
      const created = await storage.createExecutionPlanChecklistItem({
        planId: req.params.planId,
        ...item,
      });
      createdItems.push(created);
    }
    res.json({ items: createdItems, count: createdItems.length });
  });

  app.put('/api/execution-plan-checklist/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const item = await storage.updateExecutionPlanChecklistItem(req.params.id, req.body);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(item);
  });

  app.delete('/api/execution-plan-checklist/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    await storage.deleteExecutionPlanChecklistItem(req.params.id);
    res.json({ success: true });
  });

  // Item List
  app.get('/api/execution-plans/:planId/items', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const items = await storage.getExecutionPlanItems(req.params.planId);
    res.json(items);
  });

  app.post('/api/execution-plans/:planId/items', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const item = await storage.createExecutionPlanItem({
      planId: req.params.planId,
      ...req.body,
    });
    res.json(item);
  });

  app.put('/api/execution-plan-items/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const item = await storage.updateExecutionPlanItem(req.params.id, req.body);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(item);
  });

  app.delete('/api/execution-plan-items/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    await storage.deleteExecutionPlanItem(req.params.id);
    res.json({ success: true });
  });

  // Activities (Production Plan)
  app.get('/api/execution-plans/:planId/activities', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const activities = await storage.getExecutionPlanActivities(req.params.planId);
    res.json(activities);
  });

  app.post('/api/execution-plans/:planId/activities', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const activity = await storage.createExecutionPlanActivity({
      planId: req.params.planId,
      ...req.body,
    });
    res.json(activity);
  });

  app.put('/api/execution-plan-activities/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const activity = await storage.updateExecutionPlanActivity(req.params.id, req.body);
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }
    res.json(activity);
  });

  app.delete('/api/execution-plan-activities/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    await storage.deleteExecutionPlanActivity(req.params.id);
    res.json({ success: true });
  });

  // Manpower
  app.get('/api/execution-plans/:planId/manpower', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const items = await storage.getExecutionPlanManpower(req.params.planId);
    res.json(items);
  });

  app.post('/api/execution-plans/:planId/manpower', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const item = await storage.createExecutionPlanManpowerItem({
      planId: req.params.planId,
      ...req.body,
    });
    res.json(item);
  });

  app.put('/api/execution-plan-manpower/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const item = await storage.updateExecutionPlanManpowerItem(req.params.id, req.body);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(item);
  });

  app.delete('/api/execution-plan-manpower/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    await storage.deleteExecutionPlanManpowerItem(req.params.id);
    res.json({ success: true });
  });

  // Godown Items
  app.get('/api/execution-plans/:planId/godown-items', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const items = await storage.getExecutionPlanGodownItems(req.params.planId);
    res.json(items);
  });

  app.post('/api/execution-plans/:planId/godown-items', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const item = await storage.createExecutionPlanGodownItem({
      planId: req.params.planId,
      ...req.body,
    });
    res.json(item);
  });

  app.put('/api/execution-plan-godown-items/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const item = await storage.updateExecutionPlanGodownItem(req.params.id, req.body);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(item);
  });

  app.delete('/api/execution-plan-godown-items/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    await storage.deleteExecutionPlanGodownItem(req.params.id);
    res.json({ success: true });
  });

  // Rentals
  app.get('/api/execution-plans/:planId/rentals', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const rentals = await storage.getExecutionPlanRentals(req.params.planId);
    res.json(rentals);
  });

  app.post('/api/execution-plans/:planId/rentals', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const rental = await storage.createExecutionPlanRental({
      planId: req.params.planId,
      ...req.body,
    });
    res.json(rental);
  });

  app.put('/api/execution-plan-rentals/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const rental = await storage.updateExecutionPlanRental(req.params.id, req.body);
    if (!rental) {
      return res.status(404).json({ error: 'Rental not found' });
    }
    res.json(rental);
  });

  app.delete('/api/execution-plan-rentals/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    await storage.deleteExecutionPlanRental(req.params.id);
    res.json({ success: true });
  });

  // Purchases
  app.get('/api/execution-plans/:planId/purchases', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const purchases = await storage.getExecutionPlanPurchases(req.params.planId);
    res.json(purchases);
  });

  app.post('/api/execution-plans/:planId/purchases', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const purchase = await storage.createExecutionPlanPurchase({
      planId: req.params.planId,
      ...req.body,
    });
    res.json(purchase);
  });

  app.put('/api/execution-plan-purchases/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const purchase = await storage.updateExecutionPlanPurchase(req.params.id, req.body);
    if (!purchase) {
      return res.status(404).json({ error: 'Purchase not found' });
    }
    res.json(purchase);
  });

  app.delete('/api/execution-plan-purchases/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    await storage.deleteExecutionPlanPurchase(req.params.id);
    res.json({ success: true });
  });

  // Prints
  app.get('/api/execution-plans/:planId/prints', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const prints = await storage.getExecutionPlanPrints(req.params.planId);
    res.json(prints);
  });

  app.post('/api/execution-plans/:planId/prints', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const print = await storage.createExecutionPlanPrint({
      planId: req.params.planId,
      ...req.body,
    });
    res.json(print);
  });

  app.put('/api/execution-plan-prints/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const print = await storage.updateExecutionPlanPrint(req.params.id, req.body);
    if (!print) {
      return res.status(404).json({ error: 'Print not found' });
    }
    res.json(print);
  });

  app.delete('/api/execution-plan-prints/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    await storage.deleteExecutionPlanPrint(req.params.id);
    res.json({ success: true });
  });

  // Bulk insert checklist items
  app.post('/api/execution-plan-checklist/bulk', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const items = req.body.items;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Items must be an array' });
    }
    const created = await storage.bulkCreateChecklistItems(items);
    res.json(created);
  });

  // Checklist Templates - Read for all users
  app.get('/api/checklist-templates', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const templates = await storage.getChecklistTemplates();
    res.json(templates);
  });

  app.get('/api/checklist-templates/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const { template, items } = await storage.getChecklistTemplateWithItems(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json({ template, items });
  });

  // Checklist Templates - Superadmin only for write operations
  app.post('/api/checklist-templates', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Superadmin access required' });
    }
    const template = await storage.createChecklistTemplate({ ...req.body, createdBy: req.session.userId });
    res.json(template);
  });

  app.put('/api/checklist-templates/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Superadmin access required' });
    }
    const template = await storage.updateChecklistTemplate(req.params.id, req.body);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(template);
  });

  app.delete('/api/checklist-templates/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Superadmin access required' });
    }
    await storage.deleteChecklistTemplate(req.params.id);
    res.json({ success: true });
  });

  // Checklist Template Items - Superadmin only
  app.post('/api/checklist-template-items', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Superadmin access required' });
    }
    const item = await storage.createChecklistTemplateItem(req.body);
    res.json(item);
  });

  app.post('/api/checklist-template-items/bulk', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Superadmin access required' });
    }
    const items = req.body.items;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Items must be an array' });
    }
    const created = await storage.bulkCreateChecklistTemplateItems(items);
    res.json(created);
  });

  app.put('/api/checklist-template-items/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Superadmin access required' });
    }
    const item = await storage.updateChecklistTemplateItem(req.params.id, req.body);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(item);
  });

  app.delete('/api/checklist-template-items/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Superadmin access required' });
    }
    await storage.deleteChecklistTemplateItem(req.params.id);
    res.json({ success: true });
  });

  app.delete('/api/checklist-templates/:id/items', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Superadmin access required' });
    }
    await storage.deleteAllChecklistTemplateItems(req.params.id);
    res.json({ success: true });
  });

  // ============ Oak Creative - Presentations ============
  
  // Image proxy for PDF export (handles CORS for external images like DALL-E)
  app.get('/api/image-proxy', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const imageUrl = req.query.url as string;
    if (!imageUrl) {
      return res.status(400).json({ error: 'Image URL required' });
    }
    
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }
      
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const contentType = response.headers.get('content-type') || 'image/png';
      
      res.json({ 
        data: `data:${contentType};base64,${base64}`,
        contentType 
      });
    } catch (error: any) {
      console.error('Image proxy error:', error);
      res.status(500).json({ error: 'Failed to fetch image' });
    }
  });

  app.get('/api/presentations', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const presentations = await storage.getAllPresentations();
    res.json(presentations);
  });

  app.get('/api/presentations/my', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const presentations = await storage.getPresentationsByUser(req.session.userId);
    res.json(presentations);
  });

  app.get('/api/presentations/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const presentation = await storage.getPresentation(req.params.id);
    if (!presentation) {
      return res.status(404).json({ error: 'Presentation not found' });
    }
    res.json(presentation);
  });

  app.get('/api/presentations/:id/full', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const presentation = await storage.getPresentation(req.params.id);
    if (!presentation) {
      return res.status(404).json({ error: 'Presentation not found' });
    }
    const slides = await storage.getPresentationSlides(req.params.id);
    const slidesWithImages = await Promise.all(slides.map(async (slide) => {
      const images = await storage.getSlideImages(slide.id);
      return { ...slide, images };
    }));
    res.json({ ...presentation, slides: slidesWithImages });
  });

  app.post('/api/presentations', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const presentation = await storage.createPresentation({
      ...req.body,
      createdBy: req.session.userId
    });
    res.json(presentation);
  });

  app.put('/api/presentations/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const presentation = await storage.updatePresentation(req.params.id, req.body);
    if (!presentation) {
      return res.status(404).json({ error: 'Presentation not found' });
    }
    res.json(presentation);
  });

  app.delete('/api/presentations/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    await storage.deletePresentation(req.params.id);
    res.json({ success: true });
  });

  // Presentation Slides
  app.get('/api/presentations/:presentationId/slides', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const slides = await storage.getPresentationSlides(req.params.presentationId);
    res.json(slides);
  });

  app.post('/api/presentations/:presentationId/slides', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const slide = await storage.createPresentationSlide({
      ...req.body,
      presentationId: req.params.presentationId
    });
    res.json(slide);
  });

  app.put('/api/slides/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const slide = await storage.updatePresentationSlide(req.params.id, req.body);
    if (!slide) {
      return res.status(404).json({ error: 'Slide not found' });
    }
    res.json(slide);
  });

  app.delete('/api/slides/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    await storage.deletePresentationSlide(req.params.id);
    res.json({ success: true });
  });

  app.post('/api/presentations/:presentationId/slides/reorder', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const { slideIds } = req.body;
    if (!Array.isArray(slideIds)) {
      return res.status(400).json({ error: 'slideIds must be an array' });
    }
    await storage.reorderPresentationSlides(req.params.presentationId, slideIds);
    res.json({ success: true });
  });

  // Slide Images
  app.get('/api/slides/:slideId/images', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const images = await storage.getSlideImages(req.params.slideId);
    res.json(images);
  });

  app.post('/api/slides/:slideId/images', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const image = await storage.createSlideImage({
      ...req.body,
      slideId: req.params.slideId
    });
    res.json(image);
  });

  app.put('/api/slide-images/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const image = await storage.updateSlideImage(req.params.id, req.body);
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }
    res.json(image);
  });

  app.delete('/api/slide-images/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    await storage.deleteSlideImage(req.params.id);
    res.json({ success: true });
  });

  // Presentation Assets (Library)
  app.get('/api/presentation-assets', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const { category } = req.query;
    if (category && typeof category === 'string') {
      const assets = await storage.getPresentationAssetsByCategory(category);
      res.json(assets);
    } else {
      const assets = await storage.getAllPresentationAssets();
      res.json(assets);
    }
  });

  app.post('/api/presentation-assets', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const asset = await storage.createPresentationAsset({
      ...req.body,
      uploadedBy: req.session.userId
    });
    res.json(asset);
  });

  app.delete('/api/presentation-assets/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    await storage.deletePresentationAsset(req.params.id);
    res.json({ success: true });
  });

  // Notifications - User endpoints
  app.get('/api/notifications', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const notifications = await storage.getUserNotifications(req.session.userId);
    res.json(notifications);
  });

  app.get('/api/notifications/unread-count', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const count = await storage.getUnreadNotificationCount(req.session.userId);
    res.json({ count });
  });

  app.post('/api/notifications/:id/read', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    await storage.markNotificationAsRead(req.params.id, req.session.userId);
    res.json({ success: true });
  });

  // Notifications - Admin broadcast
  app.post('/api/notifications/broadcast', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== 'superadmin' && user.role !== 'admin')) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { title, message, type, actionUrl, audienceType, audienceRoles, audienceUserIds } = req.body;
    
    const notification = await storage.createNotification({
      title,
      message,
      type: type || 'info',
      actionUrl,
      audienceType: audienceType || 'all',
      audienceRoles,
      audienceUserIds,
      createdBy: req.session.userId,
    });
    
    let targetUserIds: string[] = [];
    
    if (audienceType === 'all') {
      const allUsers = await storage.getAllUsers();
      targetUserIds = allUsers.map(u => u.id);
    } else if (audienceType === 'roles' && audienceRoles?.length > 0) {
      const allUsers = await storage.getAllUsers();
      targetUserIds = allUsers.filter(u => audienceRoles.includes(u.role)).map(u => u.id);
    } else if (audienceType === 'specific' && audienceUserIds?.length > 0) {
      targetUserIds = audienceUserIds;
    }
    
    await storage.createNotificationRecipients(notification.id, targetUserIds);
    
    res.json({ success: true, notification, recipientCount: targetUserIds.length });
  });

  app.get('/api/notifications/all', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== 'superadmin' && user.role !== 'admin')) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const notifications = await storage.getAllNotifications();
    res.json(notifications);
  });

  app.delete('/api/notifications/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== 'superadmin' && user.role !== 'admin')) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    await storage.deleteNotification(req.params.id);
    res.json({ success: true });
  });

  // Push Subscriptions
  app.post('/api/push-subscriptions', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const { endpoint, keys, userAgent } = req.body;
    
    const existing = await storage.getPushSubscription(req.session.userId, endpoint);
    if (existing) {
      return res.json({ success: true, subscription: existing });
    }
    
    const subscription = await storage.createPushSubscription({
      userId: req.session.userId,
      endpoint,
      p256dhKey: keys.p256dh,
      authKey: keys.auth,
      userAgent,
    });
    res.json({ success: true, subscription });
  });

  app.delete('/api/push-subscriptions', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const { endpoint } = req.body;
    await storage.deletePushSubscriptionByEndpoint(endpoint);
    res.json({ success: true });
  });

  // Monthly Production Plan Routes
  app.get('/api/monthly-plan', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const { month, year } = req.query;
      if (!month || !year) {
        return res.status(400).json({ error: 'Month and year are required' });
      }
      const entries = await storage.getMonthlyProductionPlan(
        parseInt(month as string),
        parseInt(year as string)
      );
      res.json(entries);
    } catch (error: any) {
      console.error('[Monthly Plan] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/monthly-plan/generate', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
      const { month, year } = req.body;
      if (!month || !year) {
        return res.status(400).json({ error: 'Month and year are required' });
      }
      const entries = await storage.generateMonthlyPlanFromEvents(month, year);
      res.json(entries);
    } catch (error: any) {
      console.error('[Monthly Plan] Generate error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/monthly-plan', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Superadmin access required' });
    }
    try {
      const entry = await storage.createMonthlyProductionPlanEntry({
        ...req.body,
        createdBy: req.session.userId,
      });
      res.json(entry);
    } catch (error: any) {
      console.error('[Monthly Plan] Create error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/monthly-plan/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Superadmin access required' });
    }
    try {
      const entry = await storage.updateMonthlyProductionPlanEntry(req.params.id, req.body);
      if (!entry) {
        return res.status(404).json({ error: 'Entry not found' });
      }
      res.json(entry);
    } catch (error: any) {
      console.error('[Monthly Plan] Update error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/monthly-plan/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Superadmin access required' });
    }
    try {
      await storage.deleteMonthlyProductionPlanEntry(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Monthly Plan] Delete error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/monthly-plan/send-whatsapp', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== 'superadmin' && user.role !== 'admin')) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (!isWhatsAppConfigured()) {
      return res.status(400).json({ error: 'WhatsApp is not configured' });
    }

    try {
      const { month, year, employeeIds, caption } = req.body;

      if (!month || !year || !employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
        return res.status(400).json({ error: 'Month, year, and employeeIds are required' });
      }

      const entries = await storage.getMonthlyProductionPlan(month, year);
      if (entries.length === 0) {
        return res.status(400).json({ error: 'No entries found for the selected month' });
      }

      const pdfBuffer = generateMonthlyPlanPDF(entries, month, year);
      
      const objectStorage = new ObjectStorageService();
      const timestamp = Date.now();
      const filename = `monthly-plan/Oakstreet_Production_Plan_${year}_${month}_${timestamp}.pdf`;
      const pdfUrl = await objectStorage.uploadPublicBuffer(pdfBuffer, filename, 'application/pdf');

      const allEmployees = await storage.getAllEmployees();
      const selectedEmployees = allEmployees.filter(e => 
        employeeIds.includes(e.id) && e.phone
      );

      if (selectedEmployees.length === 0) {
        return res.status(400).json({ error: 'No valid employees with phone numbers found' });
      }

      const results: { employeeId: string; name: string; success: boolean; error?: string }[] = [];
      const monthName = new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      const messageCaption = caption || `Oakstreet Events - Monthly Production Plan for ${monthName}`;

      for (const employee of selectedEmployees) {
        const result = await sendWhatsAppMediaMessage(
          employee.phone!,
          pdfUrl,
          messageCaption
        );
        results.push({
          employeeId: employee.id,
          name: employee.name,
          success: result.success,
          error: result.error,
        });
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      res.json({
        success: true,
        message: `Sent to ${successCount} employee(s)${failureCount > 0 ? `, ${failureCount} failed` : ''}`,
        results,
        pdfUrl,
      });
    } catch (error: any) {
      console.error('[Monthly Plan] Send WhatsApp error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return httpServer;
}

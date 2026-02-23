import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import { createServer, type Server } from "http";
import crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import ExcelJS from "exceljs";
import { config } from "../shared/config";
import { storage } from "./storage";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import * as razorpayService from "./razorpay-service";
import { parseTransactionScreenshot } from "./transaction-scanner";
import { sendWhatsAppMessage, sendWhatsAppMediaMessage, isWhatsAppConfigured, sendPlannerAssignedNotification, sendOTPNotification, sendDocumentSharedNotification, sendGeneralNotification, sendRsvpReminderWhatsApp, getTemplateStatus } from "./whatsapp-service";
import { sendPasswordResetEmail, sendDemoConfirmationEmail, sendSignupWelcomeEmail, sendEnterpriseAcknowledgmentEmail, sendDemoAdminNotification, sendSignupAdminNotification, sendEnterpriseAdminNotification, sendPaymentSuccessAdminNotification, sendPaymentFailedAdminNotification } from "./email-service";
import { generateMonthlyPlanPDF } from "./monthlyPlanPdf";
import { sendPushToUser, sendPushToUsers, sendPushToAll, notifyNewLeadAssigned, notifyStaffAssigned, notifyNewLeadToSuperadmins } from "./push-notification-service";
import { createGitHubRepo, listUserRepos } from "./github-export";
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
  insertLeadSchema,
  insertCustomerSchema,
  insertVendorSchema,
  insertEstimateSchema,
  insertInvoiceSchema,
  insertCustomerPaymentSchema,
  insertExpenseSchema,
  insertVendorPaymentSchema,
  customerCreationLogs,
  insertCompanySchema,
  portalLeads,
  portalClientInputs,
  portalFeedback,
  portalTimelines,
  portalMilestonePhases,
  portalMilestoneTasks,
  portalEventFlows,
  portalEventFlowItems,
  portalFinancialMilestones,
  portalOaksyChats,
  eventVendorCosts,
  insertEventVendorCostSchema,
  insertCashFlowEntrySchema,
  cashFlowEntries,
  insertBudgetPlanEntrySchema,
  budgetPlanEntries,
  cashflowEntries,
  insertCashflowEntrySchema,
  liabilities,
  insertLiabilitySchema,
  cashflowVendorPayments,
  insertCashflowVendorPaymentSchema,
  type InsertEventMilestone,
  type InsertPortalLead,
} from "@shared/schema";
import OpenAI from "openai";
import { db } from "./db";
import { sql, eq, and, gte, like, inArray, or, desc } from "drizzle-orm";
import { z } from "zod";
import { customers, events, users, saasModules, companyModuleSubscriptions, aiAssistantSettings, aiUsage, inAppNotifications, billingEvents, rsvpFormTemplates, subscriptions, companies, oaksyConversations, oaksyMessages, salesDeals, salesStages, salesPipelines, salesContacts, portalLeadContacts, estimates as estimatesTable } from "@shared/schema";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import { getAllowedPagesByPlanAndRole, isPageAllowedByPlan, normalizePlanName, getRouteToPageMapping, getApiRouteToPageMapping, PLAN_TEAM_LIMITS } from "@shared/plan-features";
let pdfjsLib: any = null;
async function getPdfJs() {
  if (!pdfjsLib) {
    pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  }
  return pdfjsLib;
}
import multer from "multer";

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error('SECURITY WARNING: JWT_SECRET not set in production environment!');
}

interface JWTPayload {
  userId: string;
  companyId: string;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export async function verifyJWT(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
      req.user = decoded;
      return next();
    } catch (error) {
    }
  }
  const sessionUserId = (req.session as any)?.userId;
  if (sessionUserId) {
    try {
      const user = await storage.getUser(sessionUserId);
      if (user) {
        req.user = {
          userId: user.id,
          email: user.email,
          role: user.role,
          companyId: user.companyId,
        } as JWTPayload;
        return next();
      }
    } catch (error) {
    }
  }
  return res.status(401).json({ error: 'No token provided' });
}

const PgSession = connectPgSimple(session);

async function getCompanyIdFromRequest(req: Request): Promise<string | undefined> {
  if (req.user?.companyId) {
    return req.user.companyId;
  }
  if ((req.session as any)?.userId) {
    const user = await storage.getUser((req.session as any).userId);
    return user?.companyId;
  }
  return undefined;
}

async function requireCompanyId(req: Request, res: Response): Promise<string | null> {
  const companyId = await getCompanyIdFromRequest(req);
  if (!companyId) {
    res.status(403).json({ error: 'Company context required' });
    return null;
  }
  return companyId;
}

async function checkSubscriptionActive(req: Request, res: Response): Promise<boolean> {
  const companyId = await getCompanyIdFromRequest(req);
  if (!companyId) return true;
  if (req.user?.role === 'superadmin') return true;
  try {
    const subscription = await storage.getSubscriptionByCompanyId(companyId);
    if (!subscription) return true;
    if (subscription.status !== 'active') {
      res.status(403).json({ error: 'Subscription inactive. Please upgrade your plan.', code: 'SUBSCRIPTION_INACTIVE' });
      return false;
    }
    const isTrial = subscription.planName?.includes('trial');
    if (isTrial && subscription.endDate) {
      const now = new Date();
      const endDate = new Date(subscription.endDate);
      if (now > endDate) {
        res.status(403).json({ error: 'Your trial has expired. Please upgrade to continue.', code: 'TRIAL_EXPIRED' });
        return false;
      }
    }
    return true;
  } catch {
    return true;
  }
}

async function getPlanFilteredPermissions(userId: string, role: string, companyId: string | null): Promise<string[]> {
  let subscription = null;
  if (companyId) {
    try {
      subscription = await storage.getSubscriptionByCompanyId(companyId);
    } catch {}
  }
  const planName = subscription?.planName || null;
  if (role === 'superadmin') {
    return getAllowedPagesByPlanAndRole(planName, 'superadmin');
  }
  const planAllowed = getAllowedPagesByPlanAndRole(planName, role);
  if (role === 'admin' || role === 'tenant_admin') {
    return planAllowed;
  }
  const userPermissions = await storage.getUserPermissions(userId);
  const userPageIds = userPermissions.map(p => p.pageId);
  return userPageIds.filter(pageId => planAllowed.includes(pageId));
}

const PLAN_CATALOG: Record<string, { name: string; amount: number }> = {
  starter_monthly: { name: 'Starter Monthly', amount: 499 },
  starter_annual: { name: 'Starter Annual', amount: 4999 },
  growth_monthly: { name: 'Growth Monthly', amount: 1499 },
  growth_annual: { name: 'Growth Annual', amount: 14999 },
};

function generateGSTInvoiceHTML(invoice: any): string {
  const paidDate = invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Tax Invoice - ${invoice.invoiceNumber}</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:20px;color:#333;max-width:800px;margin:0 auto}
.header{background:linear-gradient(135deg,#2FA4BC,#268fa5);color:white;padding:30px;border-radius:12px 12px 0 0;display:flex;justify-content:space-between;align-items:center}
.header h1{margin:0;font-size:24px}
.header .inv-num{font-size:14px;opacity:0.9}
.content{border:1px solid #e5e5e5;border-top:none;padding:30px;border-radius:0 0 12px 12px}
.row{display:flex;justify-content:space-between;margin-bottom:20px}
.col{flex:1}
.col h3{font-size:12px;text-transform:uppercase;color:#999;margin:0 0 6px}
.col p{margin:2px 0;font-size:14px}
table{width:100%;border-collapse:collapse;margin:20px 0}
th{background:#f8fafb;text-align:left;padding:10px 12px;font-size:12px;text-transform:uppercase;color:#666;border-bottom:2px solid #e5e5e5}
td{padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:14px}
.total-row td{font-weight:bold;border-top:2px solid #2FA4BC;font-size:16px}
.badge{display:inline-block;background:#e0f4f8;color:#2FA4BC;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600}
.footer{text-align:center;margin-top:30px;padding-top:20px;border-top:1px solid #e5e5e5;color:#999;font-size:12px}
@media print{body{padding:0}.header{border-radius:0}.content{border-radius:0;border:none}}
</style></head><body>
<div class="header">
  <div><h1>KnotVite</h1><p style="margin:4px 0 0;font-size:13px;opacity:0.8">by AtBott Solutions</p></div>
  <div style="text-align:right"><div class="inv-num">TAX INVOICE</div><div style="font-size:20px;font-weight:bold;margin-top:4px">${invoice.invoiceNumber}</div></div>
</div>
<div class="content">
  <div class="row">
    <div class="col"><h3>Bill To</h3><p><strong>${invoice.customerName}</strong></p><p>${invoice.customerEmail}</p>${invoice.customerGstin ? `<p>GSTIN: ${invoice.customerGstin}</p>` : ''}${invoice.billingAddress ? `<p>${invoice.billingAddress}</p>` : ''}</div>
    <div class="col" style="text-align:right"><h3>Invoice Details</h3><p>Date: ${paidDate}</p><p>Status: <span class="badge">PAID</span></p>${invoice.razorpayPaymentId ? `<p style="font-size:12px;color:#999">Ref: ${invoice.razorpayPaymentId}</p>` : ''}</div>
  </div>
  <table><thead><tr><th>Description</th><th style="text-align:center">HSN/SAC</th><th style="text-align:right">Amount</th></tr></thead>
  <tbody>
    <tr><td>${invoice.planName}</td><td style="text-align:center">998314</td><td style="text-align:right">₹${invoice.baseAmount.toLocaleString('en-IN')}</td></tr>
    <tr><td style="color:#666">CGST @ 9%</td><td></td><td style="text-align:right">₹${invoice.cgst.toLocaleString('en-IN')}</td></tr>
    <tr><td style="color:#666">SGST @ 9%</td><td></td><td style="text-align:right">₹${invoice.sgst.toLocaleString('en-IN')}</td></tr>
    <tr class="total-row"><td>Total</td><td></td><td style="text-align:right;color:#2FA4BC">₹${invoice.totalAmount.toLocaleString('en-IN')}</td></tr>
  </tbody></table>
  <div style="background:#f8fafb;padding:16px;border-radius:8px;font-size:12px;color:#666">
    <p style="margin:0"><strong>Note:</strong> This is a computer-generated invoice. No signature required.</p>
    <p style="margin:4px 0 0">SAC Code 998314 - Online content (SaaS / Software services)</p>
  </div>
</div>
<div class="footer">
  <p>AtBott Solutions | atbottsaas@gmail.com</p>
  <p>Thank you for choosing KnotVite!</p>
</div>
</body></html>`;
}

// Helper function to escape XML special characters for TwiML responses
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Helper function to notify wedding planner when an event is booked
async function notifyWeddingPlannerEventBooked(plannerName: string, eventTitle: string, eventDate: string, venue?: string): Promise<void> {
  if (!plannerName || !plannerName.trim()) {
    console.log('[Event Notification] No planner name provided, skipping notification');
    return;
  }
  
  try {
    // Find the wedding planner user by name
    const allUsers = await storage.getAllUsers();
    const plannerUser = allUsers.find(u => 
      u.role === 'wedding_planner' && 
      u.name?.toLowerCase().trim() === plannerName.toLowerCase().trim()
    );
    
    if (!plannerUser) {
      console.log(`[Event Notification] Wedding planner "${plannerName}" not found in users`);
      return;
    }
    
    // Get planner's phone number (prefer whatsappNumber, fallback to phone)
    const plannerPhone = (plannerUser as any).whatsappNumber || plannerUser.phone;
    if (!plannerPhone) {
      console.log(`[Event Notification] Wedding planner ${plannerName} has no phone number`);
      return;
    }
    
    // Format the event date for display
    const formattedDate = new Date(eventDate).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long', 
      year: 'numeric'
    });
    
    // Send WhatsApp notification
    const message = `🎉 *New Event Booked!*\n\n📋 *Event:* ${eventTitle}\n📅 *Date:* ${formattedDate}${venue ? `\n📍 *Venue:* ${venue}` : ''}\n\nYou have been assigned as the wedding planner for this event. Please check the Oak system for details.\n\n🌳 Oakstreet Events`;
    
    await sendGeneralNotification(plannerPhone, plannerUser.name || plannerName, message, 'event_booked', eventTitle);
    console.log(`[Event Notification] Notified wedding planner ${plannerName} about event: ${eventTitle}`);
  } catch (error) {
    console.error('[Event Notification] Failed to notify wedding planner:', error);
    // Don't throw - notification failure shouldn't block event creation
  }
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

async function recalculateEmployeeLeaveBalance(employeeId: string, categoryId: string | null) {
  const currentYear = new Date().getFullYear();
  const allRequests = await storage.getLeaveRequestsByEmployee(employeeId);
  const approvedRequests = allRequests.filter(r => 
    r.status === 'approved' && 
    new Date(r.startDate).getFullYear() === currentYear
  );

  if (categoryId) {
    const categoryRequests = approvedRequests.filter(r => r.categoryId === categoryId);
    const usedDays = categoryRequests.reduce((sum, lr) => {
      const start = new Date(lr.startDate);
      const end = new Date(lr.endDate);
      return sum + Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }, 0);
    await storage.createOrUpdateLeaveBalance(employeeId, categoryId, currentYear, { used: usedDays });
  } else {
    const categories = await storage.getAllLeaveCategories();
    for (const cat of categories) {
      const categoryRequests = approvedRequests.filter(r => r.categoryId === cat.id);
      const usedDays = categoryRequests.reduce((sum, lr) => {
        const start = new Date(lr.startDate);
        const end = new Date(lr.endDate);
        return sum + Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      }, 0);
      await storage.createOrUpdateLeaveBalance(employeeId, cat.id, currentYear, { used: usedDays });
    }
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Trust proxy - Replit always uses reverse proxy
  app.set('trust proxy', 1);
  
  // Session middleware
  const pgSessionStore = new PgSession({
    pool,
    tableName: 'session',
    createTableIfMissing: true,
    pruneSessionInterval: 60 * 15,
    errorLog: (err: Error) => {
      console.error('[PgSession] Store error:', err.message);
    },
  });
  app.use(
    session({
      store: pgSessionStore,
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

  // JWT to Session middleware - populate session from JWT if no session exists
  app.use((req, res, next) => {
    if (!(req.session as any).userId) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
          const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
          (req.session as any).userId = decoded.userId;
          req.user = decoded;
        } catch (error) {
        }
      }
    }
    next();
  });

  async function checkTeamMemberLimit(companyId: string): Promise<{ allowed: boolean; limit: number; current: number; plan: string }> {
    const subscription = await storage.getSubscriptionByCompanyId(companyId);
    const plan = normalizePlanName(subscription?.planName);
    const limit = PLAN_TEAM_LIMITS[plan];
    const existingEmployees = await storage.getAllEmployees(companyId);
    const current = existingEmployees.length;
    return { allowed: current < limit, limit: limit === Infinity ? -1 : limit, current, plan };
  }

  const SUBSCRIPTION_EXEMPT_ROUTES = [
    '/api/auth/', '/api/billing/', '/api/health', '/api/system-notifications',
    '/api/admin', '/api/demo-bookings', '/api/enterprise-leads', '/api/contact',
    '/api/email-logs', '/api/admin-event-logs', '/api/modules',
    '/api/knotvite/signup', '/api/knotvite/billing/', '/api/knotvite/events', '/api/knotvite/events-limits',
  ];

  app.use('/api/', async (req, res, next) => {
    const isExempt = SUBSCRIPTION_EXEMPT_ROUTES.some(r => req.path.startsWith(r.replace('/api', '')));
    if (isExempt || req.method === 'OPTIONS') return next();
    const companyId = await getCompanyIdFromRequest(req);
    if (!companyId) return next();
    if (req.user?.role === 'superadmin') return next();
    try {
      const subscription = await storage.getSubscriptionByCompanyId(companyId);
      if (!subscription) return next();
      if (subscription.status === 'failed' || subscription.status === 'cancelled') {
        return res.status(403).json({ error: 'Subscription inactive. Please upgrade your plan.', code: 'SUBSCRIPTION_INACTIVE' });
      }
      if (subscription.endDate) {
        const now = new Date();
        const endDate = new Date(subscription.endDate);
        if (now > endDate) {
          const isTrial = subscription.planName?.includes('trial');
          return res.status(403).json({
            error: isTrial ? 'Your trial has expired. Please upgrade to continue.' : 'Your subscription has expired. Please renew.',
            code: isTrial ? 'TRIAL_EXPIRED' : 'SUBSCRIPTION_EXPIRED',
          });
        }
      }
      next();
    } catch {
      next();
    }
  });

  const API_ROUTE_TO_PAGE = getApiRouteToPageMapping();

  app.use('/api/', async (req, res, next) => {
    const isExempt = SUBSCRIPTION_EXEMPT_ROUTES.some(r => req.path.startsWith(r.replace('/api', '')));
    if (isExempt || req.method === 'OPTIONS') return next();
    if (req.user?.role === 'superadmin') return next();
    const companyId = await getCompanyIdFromRequest(req);
    if (!companyId) return next();
    let subscription = null;
    try {
      subscription = await storage.getSubscriptionByCompanyId(companyId);
    } catch {}
    const planName = subscription?.planName || null;
    const role = req.user?.role || 'team_member';
    const apiPath = req.path;
    let requiredPage: string | null = null;
    for (const [prefix, pageId] of Object.entries(API_ROUTE_TO_PAGE)) {
      if (apiPath.startsWith(prefix)) {
        requiredPage = pageId;
        break;
      }
    }
    if (requiredPage && !isPageAllowedByPlan(requiredPage, planName, role)) {
      const plan = normalizePlanName(planName);
      return res.status(403).json({
        error: 'This feature is not available on your current plan. Please upgrade.',
        code: 'PLAN_RESTRICTED',
        currentPlan: plan,
        requiredFeature: requiredPage,
      });
    }
    next();
  });

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
    'sales-portal-leads',
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
    'finance-cashflow',
    'finance-budget-plan',
    'finance-reports',
    'finance-settings',
    'people',
    'hr',
    'employee-portal',
    'team-calendar',
    'attendance',
    'attendance-admin',
    'tools',
    'whatsapp-inbox',
    'oak-rsvp',
    'oaksy',
    'oak-creative',
    'knotvite',
    'knotvite-forms',
    'knotvite-submissions',
    'client-portal',
    'portal-admin',
    'portfolio-admin',
    'oaksy-help',
    'management-mis',
    'mis-overview',
    'event-database',
    'mis-financial',
    'mis-sales',
    'mis-operations',
    'daybook',
    'execution-plan',
    'oak-incentives',
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

      const permissionsList = await getPlanFilteredPermissions(user.id, user.role, user.companyId);

      const token = jwt.sign(
        {
          userId: user.id,
          companyId: user.companyId || '',
          email: user.email,
          role: user.role,
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      
      (req.session as any).userId = user.id;
      
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('[Login] Session save error (non-fatal, JWT still valid):', saveErr);
        }
        res.json({ 
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
            createdVia: user.createdVia,
            companyId: user.companyId,
          },
          permissions: permissionsList
        });
      });
    } catch (error: any) {
      console.error('[Login] Error:', error?.message || error);
      res.status(500).json({ error: 'Server error during login. Please try again.' });
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
    let userId = (req.session as any).userId;
    if (!userId && req.user?.userId) {
      userId = req.user.userId;
    }
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let company = null;
    if (user.companyId) {
      company = await storage.getCompany(user.companyId);
    }

    const permissionsList = await getPlanFilteredPermissions(user.id, user.role, user.companyId);

    res.json({ 
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        createdVia: user.createdVia,
        companyId: user.companyId,
      },
      company: company ? { id: company.id, name: company.name } : null,
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

  app.get('/api/events/:id', async (req, res) => {
    const event = await storage.getEvent(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(event);
  });

  app.post('/api/events', async (req, res) => {
    // Only allow Superadmin or Accountant to create events
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser) {
      return res.status(401).json({ error: 'User not found' });
    }
    if (currentUser.role !== 'superadmin' && currentUser.role !== 'accountant') {
      return res.status(403).json({ error: 'Only Superadmin or Accountant can create events' });
    }
    
    try {
      const data = insertEventSchema.parse(req.body);
      
      // Auto-generate event code (OAKS-E-YY-MM-XXX format)
      const eventCode = await generateEventCode();
      
      // Insert event with generated code
      const [event] = await db.insert(events)
        .values({ ...data, eventCode })
        .returning();
      
      console.log(`Created event ${event.title} with code ${eventCode}`);
      
      // Notify wedding planner if one is assigned
      if (event.planner) {
        notifyWeddingPlannerEventBooked(event.planner, event.title, event.date, event.venue || undefined);
      }
      
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
      // Remove read-only fields from update payload
      const { eventCode, id, createdAt, payment60DayReminderSent, timelineCreated, productionContainerCreated, inventoryFinalized, ...updateData } = req.body;
      const event = await storage.updateEvent(req.params.id, updateData);
      res.json(event);
    } catch (error: any) {
      console.error('Error updating event:', error?.message || error);
      res.status(400).json({ error: error?.message || 'Failed to update event' });
    }
  });

  app.delete('/api/events/:id', async (req, res) => {
    try {
      const eventId = req.params.id;
      
      // Delete related records first to avoid foreign key constraints
      // (for tables without onDelete: 'cascade')
      await storage.deleteAutomationLogsByEventId(eventId);
      await storage.deleteEventProductionItemsByEventId(eventId);
      
      // Now delete the event (cascade will handle other related records)
      await storage.deleteEvent(eventId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting event:', error);
      res.status(500).json({ error: error.message || 'Failed to delete event' });
    }
  });

  // ============================================
  // Event Vendor Costs - P&L Management
  // ============================================

  // Get all vendor costs for an event
  app.get('/api/events/:eventId/vendor-costs', async (req, res) => {
    try {
      const { eventId } = req.params;
      const costs = await db.select().from(eventVendorCosts)
        .where(eq(eventVendorCosts.eventId, eventId))
        .orderBy(eventVendorCosts.createdAt);
      res.json(costs);
    } catch (error: any) {
      console.error('Error fetching vendor costs:', error);
      res.status(500).json({ error: 'Failed to fetch vendor costs' });
    }
  });

  // Create vendor cost entry
  app.post('/api/events/:eventId/vendor-costs', async (req, res) => {
    try {
      const { eventId } = req.params;
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ error: 'Not logged in' });
      const user = await storage.getUser(userId);
      
      // Only superadmin and accountant can add
      if (!user || !['superadmin', 'accountant'].includes(user.role)) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const body = { ...req.body };
      if (!body.actualAmount || body.actualAmount === '') body.actualAmount = null;
      if (!body.paymentDate || body.paymentDate === '') body.paymentDate = null;
      if (!body.paymentReference || body.paymentReference === '') body.paymentReference = null;
      if (!body.notes || body.notes === '') body.notes = null;
      if (!body.estimatedAmount || body.estimatedAmount === '') body.estimatedAmount = '0';

      const data = insertEventVendorCostSchema.parse({
        ...body,
        eventId,
        createdBy: user.id
      });
      
      const [cost] = await db.insert(eventVendorCosts).values(data).returning();
      
      res.json(cost);
    } catch (error: any) {
      console.error('Error creating vendor cost:', error);
      res.status(500).json({ error: error.message || 'Failed to create vendor cost' });
    }
  });

  // Update vendor cost entry
  app.patch('/api/events/:eventId/vendor-costs/:costId', async (req, res) => {
    try {
      const { eventId, costId } = req.params;
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ error: 'Not logged in' });
      const user = await storage.getUser(userId);
      
      // Only superadmin and accountant can edit
      if (!user || !['superadmin', 'accountant'].includes(user.role)) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const body = { ...req.body };
      if (body.actualAmount === '') body.actualAmount = null;
      if (body.paymentDate === '') body.paymentDate = null;
      if (body.paymentReference === '') body.paymentReference = null;
      if (body.notes === '') body.notes = null;
      if (body.estimatedAmount === '') body.estimatedAmount = '0';

      const [cost] = await db.update(eventVendorCosts)
        .set({ ...body, updatedAt: new Date() })
        .where(and(eq(eventVendorCosts.id, costId), eq(eventVendorCosts.eventId, eventId)))
        .returning();
      
      res.json(cost);
    } catch (error: any) {
      console.error('Error updating vendor cost:', error);
      res.status(500).json({ error: error.message || 'Failed to update vendor cost' });
    }
  });

  // Delete vendor cost entry
  app.delete('/api/events/:eventId/vendor-costs/:costId', async (req, res) => {
    try {
      const { eventId, costId } = req.params;
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ error: 'Not logged in' });
      const user = await storage.getUser(userId);
      
      // Only superadmin can delete
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Only superadmin can delete vendor costs' });
      }

      await db.delete(eventVendorCosts)
        .where(and(eq(eventVendorCosts.id, costId), eq(eventVendorCosts.eventId, eventId)));
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting vendor cost:', error);
      res.status(500).json({ error: error.message || 'Failed to delete vendor cost' });
    }
  });

  // Get vendor cost summary for an event
  app.get('/api/events/:eventId/vendor-costs/summary', async (req, res) => {
    try {
      const { eventId } = req.params;
      const costs = await db.select().from(eventVendorCosts)
        .where(eq(eventVendorCosts.eventId, eventId));
      
      const totalEstimated = costs.reduce((sum, c) => sum + parseFloat(c.estimatedAmount || '0'), 0);
      const totalActual = costs.reduce((sum, c) => sum + parseFloat(c.actualAmount || '0'), 0);
      const pendingCount = costs.filter(c => c.paymentStatus === 'pending').length;
      const paidCount = costs.filter(c => c.paymentStatus === 'paid').length;
      
      res.json({
        totalEstimated,
        totalActual,
        pendingCount,
        paidCount,
        totalVendors: costs.length,
        variance: totalEstimated - totalActual
      });
    } catch (error: any) {
      console.error('Error fetching vendor cost summary:', error);
      res.status(500).json({ error: 'Failed to fetch summary' });
    }
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
      const user = req.session?.user;
      const data = insertMeetingSchema.parse({
        ...req.body,
        createdBy: user?.name || 'Unknown',
      });
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
    const includeInactive = req.query.includeInactive === 'true';
    const employees = await storage.getAllEmployees(includeInactive);
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

  // Employee Attendance
  app.get('/api/attendance', async (req, res) => {
    try {
      const { date, employeeId, startDate, endDate } = req.query;
      
      if (date) {
        const records = await storage.getAttendanceByDate(date as string);
        const employees = await storage.getAllEmployees();
        const enriched = records.map(r => ({
          ...r,
          employee: employees.find(e => e.id === r.employeeId)
        }));
        res.json(enriched);
      } else if (employeeId) {
        const records = await storage.getAttendanceByEmployee(
          employeeId as string,
          startDate as string | undefined,
          endDate as string | undefined
        );
        res.json(records);
      } else {
        const today = new Date().toISOString().split('T')[0];
        const records = await storage.getAttendanceByDate(today);
        const employees = await storage.getAllEmployees();
        const enriched = records.map(r => ({
          ...r,
          employee: employees.find(e => e.id === r.employeeId)
        }));
        res.json(enriched);
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
      res.status(500).json({ error: 'Failed to fetch attendance records' });
    }
  });

  app.get('/api/attendance/my-status', async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const employee = await storage.getEmployeeByUserId(userId);
      if (!employee) {
        return res.status(404).json({ error: 'Employee profile not found' });
      }
      
      const todayRecord = await storage.getTodayAttendanceForEmployee(employee.id);
      res.json({
        employee,
        todayAttendance: todayRecord,
        status: todayRecord?.status || 'not_checked_in'
      });
    } catch (error) {
      console.error('Error fetching my attendance status:', error);
      res.status(500).json({ error: 'Failed to fetch attendance status' });
    }
  });

  app.post('/api/attendance/check-in', async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const employee = await storage.getEmployeeByUserId(userId);
      if (!employee) {
        return res.status(404).json({ error: 'Employee profile not found' });
      }
      
      const existingRecord = await storage.getTodayAttendanceForEmployee(employee.id);
      if (existingRecord) {
        return res.status(400).json({ error: 'Already checked in today', record: existingRecord });
      }
      
      const { latitude, longitude, address, selfieUrl } = req.body;
      
      if (!selfieUrl) {
        return res.status(400).json({ error: 'Selfie photo is required for check-in' });
      }
      
      const today = new Date().toISOString().split('T')[0];
      const record = await storage.createAttendanceCheckIn({
        employeeId: employee.id,
        date: today,
        checkInTime: new Date(),
        checkInLatitude: latitude?.toString(),
        checkInLongitude: longitude?.toString(),
        checkInAddress: address,
        checkInSelfieUrl: selfieUrl,
        status: 'checked_in'
      });
      
      res.json({ success: true, record });
    } catch (error) {
      console.error('Error checking in:', error);
      res.status(500).json({ error: 'Failed to check in' });
    }
  });

  app.post('/api/attendance/check-out', async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const employee = await storage.getEmployeeByUserId(userId);
      if (!employee) {
        return res.status(404).json({ error: 'Employee profile not found' });
      }
      
      const todayRecord = await storage.getTodayAttendanceForEmployee(employee.id);
      if (!todayRecord) {
        return res.status(400).json({ error: 'No check-in record found for today' });
      }
      
      if (todayRecord.status === 'checked_out') {
        return res.status(400).json({ error: 'Already checked out today', record: todayRecord });
      }
      
      const { latitude, longitude, address } = req.body;
      
      const checkOutTime = new Date();
      const checkInTime = new Date(todayRecord.checkInTime!);
      const totalHours = ((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)).toFixed(2);
      
      const updatedRecord = await storage.updateAttendanceCheckOut(todayRecord.id, {
        checkOutTime,
        checkOutLatitude: latitude?.toString(),
        checkOutLongitude: longitude?.toString(),
        checkOutAddress: address,
        totalHours: totalHours,
        status: 'checked_out'
      });
      
      res.json({ success: true, record: updatedRecord });
    } catch (error) {
      console.error('Error checking out:', error);
      res.status(500).json({ error: 'Failed to check out' });
    }
  });

  const attendanceSelfieUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'));
      }
    }
  });

  app.post('/api/attendance/upload-selfie', attendanceSelfieUpload.single('selfie'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      const objectStorageService = new ObjectStorageService();
      const publicPaths = objectStorageService.getPublicObjectSearchPaths();
      if (publicPaths.length === 0) {
        return res.status(500).json({ error: 'Object storage not configured' });
      }
      
      const timestamp = Date.now();
      const ext = req.file.originalname.split('.').pop() || 'jpg';
      const objectPath = `attendance/selfies/${timestamp}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      
      const selfieUrl = `/api/objects/public/${objectPath}`;
      
      // Upload to object storage
      const fullPath = `${publicPaths[0]}/${objectPath}`;
      const { parseObjectPath, signObjectURL } = await import('./objectStorage');
      const { objectStorageClient } = await import('./objectStorage');
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);
      
      await file.save(req.file.buffer, {
        contentType: req.file.mimetype,
        resumable: false,
      });
      
      res.json({ success: true, selfieUrl });
    } catch (error) {
      console.error('Error uploading selfie:', error);
      res.status(500).json({ error: 'Failed to upload selfie' });
    }
  });

  // Monthly Attendance Summary
  app.get('/api/attendance/monthly-summary', async (req, res) => {
    try {
      const { month, year } = req.query;
      if (!month || !year) {
        return res.status(400).json({ error: 'month and year are required' });
      }
      const summaries = await storage.getMonthlyAttendanceSummaries(
        parseInt(month as string),
        parseInt(year as string)
      );
      const employees = await storage.getAllEmployees();
      const enriched = summaries.map(s => {
        const emp = employees.find(e => e.id === s.employeeId);
        return { ...s, employeeName: emp?.name || 'Unknown', designation: emp?.designation || '' };
      });
      res.json(enriched);
    } catch (error) {
      console.error('Error fetching monthly attendance summary:', error);
      res.status(500).json({ error: 'Failed to fetch monthly summary' });
    }
  });

  app.post('/api/attendance/calculate-monthly-summary', async (req, res) => {
    try {
      const { month, year } = req.body;
      if (!month || !year) {
        return res.status(400).json({ error: 'month and year are required' });
      }
      const results = await calculateMonthlyAttendanceSummary(parseInt(month), parseInt(year));
      res.json({ success: true, count: results.length, summaries: results });
    } catch (error) {
      console.error('Error calculating monthly attendance summary:', error);
      res.status(500).json({ error: 'Failed to calculate monthly summary' });
    }
  });

  async function calculateMonthlyAttendanceSummary(month: number, year: number) {
    const { getDaysInMonth, getDay, format: fnsFormat } = await import('date-fns');

    const activeEmployees = await storage.getAllEmployees();
    const active = activeEmployees.filter(e => e.isActive);

    const daysInMonth = getDaysInMonth(new Date(year, month - 1));
    let sundaysCount = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dayOfWeek = getDay(new Date(year, month - 1, d));
      if (dayOfWeek === 0) sundaysCount++;
    }
    const totalWorkingDays = daysInMonth - sundaysCount;

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    const { db } = await import('./db');
    const { employeeAttendance, leaveRequests, leaveCategories } = await import('@shared/schema');
    const { eq, and, gte, lte, inArray } = await import('drizzle-orm');

    const allAttendance = await db.select().from(employeeAttendance)
      .where(and(
        gte(employeeAttendance.date, startDate),
        lte(employeeAttendance.date, endDate)
      ));

    const allLeaves = await db.select({
      id: leaveRequests.id,
      employeeId: leaveRequests.employeeId,
      startDate: leaveRequests.startDate,
      endDate: leaveRequests.endDate,
      leaveType: leaveRequests.leaveType,
      categoryId: leaveRequests.categoryId,
      status: leaveRequests.status,
    }).from(leaveRequests)
      .where(and(
        eq(leaveRequests.status, 'approved'),
        lte(leaveRequests.startDate, endDate),
        gte(leaveRequests.endDate, startDate)
      ));

    const categories = await db.select().from(leaveCategories);
    const categoryMap = new Map(categories.map(c => [c.id, c.name]));

    const results = [];
    for (const emp of active) {
      const empAttendance = allAttendance.filter(a => a.employeeId === emp.id);
      const daysPresent = empAttendance.length;

      const totalHoursWorked = empAttendance.reduce((sum, a) => sum + (parseFloat(a.totalHours || '0') || 0), 0);
      const avgHoursPerDay = daysPresent > 0 ? totalHoursWorked / daysPresent : 0;

      let lateCheckIns = 0;
      for (const a of empAttendance) {
        if (a.checkInTime) {
          const checkInDate = new Date(a.checkInTime);
          const hours = checkInDate.getHours();
          const minutes = checkInDate.getMinutes();
          const totalMins = hours * 60 + minutes;
          if (totalMins > 9 * 60 + 30 + 330) {
            lateCheckIns++;
          }
        }
      }

      let casualLeaves = 0;
      let sickLeaves = 0;
      let otherLeaves = 0;

      const empLeaves = allLeaves.filter(l => l.employeeId === emp.id);
      for (const leave of empLeaves) {
        const leaveStart = new Date(leave.startDate);
        const leaveEnd = new Date(leave.endDate);
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month - 1, daysInMonth);

        const effectiveStart = leaveStart < monthStart ? monthStart : leaveStart;
        const effectiveEnd = leaveEnd > monthEnd ? monthEnd : leaveEnd;
        let leaveDays = 0;
        for (let d = new Date(effectiveStart); d <= effectiveEnd; d.setDate(d.getDate() + 1)) {
          if (getDay(d) !== 0) leaveDays++;
        }

        const categoryName = leave.categoryId ? categoryMap.get(leave.categoryId) : null;
        const leaveTypeLower = (categoryName || leave.leaveType || '').toLowerCase();

        if (leaveTypeLower.includes('casual')) {
          casualLeaves += leaveDays;
        } else if (leaveTypeLower.includes('sick')) {
          sickLeaves += leaveDays;
        } else {
          otherLeaves += leaveDays;
        }
      }

      const totalLeaves = casualLeaves + sickLeaves + otherLeaves;
      const daysAbsent = Math.max(0, totalWorkingDays - daysPresent - totalLeaves);

      const summary = await storage.upsertMonthlyAttendanceSummary({
        employeeId: emp.id,
        month,
        year,
        totalWorkingDays,
        daysPresent,
        daysAbsent,
        casualLeaves,
        sickLeaves,
        otherLeaves,
        totalLeaves,
        totalHoursWorked: totalHoursWorked.toFixed(2),
        avgHoursPerDay: avgHoursPerDay.toFixed(2),
        lateCheckIns,
        sundaysInMonth: sundaysCount,
      });
      results.push(summary);
    }

    console.log(`[Monthly Attendance] Calculated summaries for ${results.length} employees for ${month}/${year}`);
    return results;
  }

  // Expose the function for the scheduler
  (app as any).calculateMonthlyAttendanceSummary = calculateMonthlyAttendanceSummary;

  // Cash Flow
  app.get('/api/cashflow', async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const entries = await storage.getCashFlowEntries(
        startDate as string | undefined,
        endDate as string | undefined
      );
      res.json(entries);
    } catch (error) {
      console.error('Error fetching cashflow entries:', error);
      res.status(500).json({ error: 'Failed to fetch cashflow entries' });
    }
  });

  app.post('/api/cashflow', async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const validated = insertCashFlowEntrySchema.parse({ ...req.body, createdBy: userId });
      const entry = await storage.createCashFlowEntry(validated);
      res.json(entry);
    } catch (error: any) {
      console.error('Error creating cashflow entry:', error);
      if (error?.name === 'ZodError') {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      res.status(400).json({ error: 'Invalid cashflow entry data' });
    }
  });

  app.post('/api/cashflow/generate-recurring', async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const schema = z.object({ month: z.number().min(1).max(12), year: z.number().min(2020).max(2100) });
      const { month, year } = schema.parse(req.body);

      const targetDate = new Date(year, month - 1, 1);
      const prevMonth = new Date(year, month - 2, 1);
      const prevStart = prevMonth.toISOString().split('T')[0];
      const prevEnd = new Date(year, month - 1, 0).toISOString().split('T')[0];
      
      const prevEntries = await storage.getCashFlowEntries(prevStart, prevEnd);
      const recurringEntries = prevEntries.filter((e: any) => e.recurring);
      
      const targetStart = targetDate.toISOString().split('T')[0];
      const targetEnd = new Date(year, month, 0).toISOString().split('T')[0];
      const existingEntries = await storage.getCashFlowEntries(targetStart, targetEnd);
      
      let created = 0;
      for (const entry of recurringEntries) {
        const alreadyExists = existingEntries.some((e: any) => 
          e.category === entry.category && 
          e.description === entry.description && 
          e.type === entry.type &&
          e.recurring === entry.recurring &&
          e.amount === entry.amount &&
          (e.vendorName || '') === (entry.vendorName || '') &&
          (e.eventName || '') === (entry.eventName || '')
        );
        
        if (!alreadyExists) {
          const originalDay = new Date(entry.date).getDate();
          const lastDay = new Date(year, month, 0).getDate();
          const newDate = new Date(year, month - 1, Math.min(originalDay, lastDay));
          
          await storage.createCashFlowEntry({
            date: newDate.toISOString().split('T')[0],
            type: entry.type,
            category: entry.category,
            description: entry.description,
            amount: entry.amount,
            status: 'expected',
            recurring: entry.recurring,
            bankId: entry.bankId,
            eventId: entry.eventId,
            eventName: entry.eventName,
            vendorName: entry.vendorName,
            notes: entry.notes,
            createdBy: userId,
          });
          created++;
        }
      }
      
      const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      res.json({ success: true, created, message: `Generated ${created} recurring entries for ${monthNames[month-1]} ${year}` });
    } catch (error: any) {
      console.error('Error generating recurring entries:', error);
      if (error?.name === 'ZodError') {
        return res.status(400).json({ error: 'Invalid month/year', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to generate recurring entries' });
    }
  });

  app.patch('/api/cashflow/:id', async (req, res) => {
    try {
      const entry = await storage.updateCashFlowEntry(req.params.id, req.body);
      if (!entry) return res.status(404).json({ error: 'Entry not found' });
      res.json(entry);
    } catch (error) {
      console.error('Error updating cashflow entry:', error);
      res.status(400).json({ error: 'Failed to update cashflow entry' });
    }
  });

  app.delete('/api/cashflow/:id', async (req, res) => {
    try {
      await storage.deleteCashFlowEntry(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting cashflow entry:', error);
      res.status(500).json({ error: 'Failed to delete cashflow entry' });
    }
  });

  // Budget Plan
  app.get('/api/budget-plan', async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const entries = await storage.getBudgetPlanEntries(
        startDate as string | undefined,
        endDate as string | undefined
      );
      res.json(entries);
    } catch (error) {
      console.error('Error fetching budget plan entries:', error);
      res.status(500).json({ error: 'Failed to fetch budget plan entries' });
    }
  });

  app.post('/api/budget-plan', async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const validated = insertBudgetPlanEntrySchema.parse({ ...req.body, createdBy: userId });
      const entry = await storage.createBudgetPlanEntry(validated);
      res.json(entry);
    } catch (error: any) {
      console.error('Error creating budget plan entry:', error);
      if (error?.name === 'ZodError') {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      res.status(400).json({ error: 'Invalid budget plan entry data' });
    }
  });

  app.patch('/api/budget-plan/:id', async (req, res) => {
    try {
      const validated = insertBudgetPlanEntrySchema.partial().parse(req.body);
      const entry = await storage.updateBudgetPlanEntry(req.params.id, validated);
      if (!entry) return res.status(404).json({ error: 'Entry not found' });
      res.json(entry);
    } catch (error: any) {
      console.error('Error updating budget plan entry:', error);
      if (error?.name === 'ZodError') {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      res.status(400).json({ error: 'Failed to update budget plan entry' });
    }
  });

  app.delete('/api/budget-plan/:id', async (req, res) => {
    try {
      await storage.deleteBudgetPlanEntry(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting budget plan entry:', error);
      res.status(500).json({ error: 'Failed to delete budget plan entry' });
    }
  });

  app.post('/api/budget-plan/:id/mark-paid', async (req, res) => {
    try {
      const entry = await storage.updateBudgetPlanEntry(req.params.id, { status: 'paid', reminderSent: true });
      if (!entry) return res.status(404).json({ error: 'Entry not found' });
      res.json(entry);
    } catch (error) {
      console.error('Error marking budget plan entry as paid:', error);
      res.status(400).json({ error: 'Failed to mark as paid' });
    }
  });

  // Item Cost Templates (restricted to superadmin and wedding_planner)
  const requireCostingAccess = async (req: any, res: any, next: any) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = await storage.getUser(userId);
    if (!user || (user.role !== 'superadmin' && user.role !== 'wedding_planner')) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  };

  app.get('/api/item-cost-templates', requireCostingAccess, async (req, res) => {
    try {
      const templates = await storage.getAllItemCostTemplates();
      res.json(templates);
    } catch (error) {
      console.error('Error fetching item cost templates:', error);
      res.status(500).json({ error: 'Failed to fetch item cost templates' });
    }
  });

  app.post('/api/item-cost-templates', requireCostingAccess, async (req, res) => {
    try {
      const { itemName, costPrice, defaultMarginPercent } = req.body;
      if (!itemName || typeof itemName !== 'string') return res.status(400).json({ error: 'itemName is required' });
      if (costPrice !== undefined && isNaN(Number(costPrice))) return res.status(400).json({ error: 'costPrice must be numeric' });
      const template = await storage.createItemCostTemplate({
        itemName: itemName.trim(),
        costPrice: String(costPrice || '0'),
        defaultMarginPercent: String(defaultMarginPercent || '40'),
      });
      res.json(template);
    } catch (error) {
      console.error('Error creating item cost template:', error);
      res.status(500).json({ error: 'Failed to create item cost template' });
    }
  });

  app.patch('/api/item-cost-templates/:id', requireCostingAccess, async (req, res) => {
    try {
      const { itemName, costPrice, defaultMarginPercent } = req.body;
      const updateData: any = {};
      if (itemName !== undefined) updateData.itemName = String(itemName).trim();
      if (costPrice !== undefined) {
        if (isNaN(Number(costPrice))) return res.status(400).json({ error: 'costPrice must be numeric' });
        updateData.costPrice = String(costPrice);
      }
      if (defaultMarginPercent !== undefined) {
        if (isNaN(Number(defaultMarginPercent))) return res.status(400).json({ error: 'defaultMarginPercent must be numeric' });
        updateData.defaultMarginPercent = String(defaultMarginPercent);
      }
      const template = await storage.updateItemCostTemplate(req.params.id, updateData);
      if (!template) return res.status(404).json({ error: 'Template not found' });
      res.json(template);
    } catch (error) {
      console.error('Error updating item cost template:', error);
      res.status(500).json({ error: 'Failed to update item cost template' });
    }
  });

  app.delete('/api/item-cost-templates/:id', requireCostingAccess, async (req, res) => {
    try {
      await storage.deleteItemCostTemplate(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting item cost template:', error);
      res.status(500).json({ error: 'Failed to delete item cost template' });
    }
  });

  app.post('/api/item-cost-templates/bulk-upsert', requireCostingAccess, async (req, res) => {
    try {
      const { items } = req.body;
      if (!Array.isArray(items)) return res.status(400).json({ error: 'Items array required' });
      const results = [];
      for (const item of items) {
        if (item.itemName && typeof item.itemName === 'string' && item.costPrice && !isNaN(Number(item.costPrice))) {
          const template = await storage.upsertItemCostTemplate(
            item.itemName.trim(),
            String(item.costPrice),
            String(!isNaN(Number(item.marginPercent)) ? item.marginPercent : '40')
          );
          results.push(template);
        }
      }
      res.json(results);
    } catch (error) {
      console.error('Error bulk upserting item cost templates:', error);
      res.status(500).json({ error: 'Failed to bulk upsert item cost templates' });
    }
  });

  // Portal Admins - CRUD (superadmin only)
  app.get('/api/portal-admins', async (req, res) => {
    try {
      const result = await verifyAdminAccess(req, res);
      if (!result) return;
      const admins = await storage.getAllPortalAdmins();
      res.json(admins);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/portal-admins', async (req, res) => {
    try {
      const result = await verifyAdminAccess(req, res);
      if (!result) return;
      if (result.user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Superadmin access required' });
      }
      const { name, role, whatsappNumber, email, photoUrl, isActive, displayOrder } = req.body;
      if (!name || !whatsappNumber) {
        return res.status(400).json({ error: 'Name and WhatsApp number are required' });
      }
      const admin = await storage.createPortalAdmin({
        name, role: role || 'Admin', whatsappNumber, email: email || null,
        photoUrl: photoUrl || null, isActive: isActive !== false, displayOrder: displayOrder || 0
      });
      res.json(admin);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch('/api/portal-admins/:id', async (req, res) => {
    try {
      const result = await verifyAdminAccess(req, res);
      if (!result) return;
      if (result.user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Superadmin access required' });
      }
      const updated = await storage.updatePortalAdmin(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: 'Portal admin not found' });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/portal-admins/:id', async (req, res) => {
    try {
      const result = await verifyAdminAccess(req, res);
      if (!result) return;
      if (result.user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Superadmin access required' });
      }
      await storage.deletePortalAdmin(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Portal Lead Contacts - manage multiple contacts per portal lead
  // Accessible by superadmin, admin, and wedding planners (planners only for their assigned leads)
  const verifyPortalContactAccess = async (req: any, res: any): Promise<{ user: any } | null> => {
    const userId = (req.session as any).userId;
    if (!userId) { res.status(401).json({ error: 'Not authenticated' }); return null; }
    const user = await storage.getUser(userId);
    if (!user) { res.status(401).json({ error: 'Session expired' }); return null; }
    if (user.role !== 'superadmin' && user.role !== 'admin' && user.role !== 'wedding_planner') {
      res.status(403).json({ error: 'Access denied' }); return null;
    }
    return { user };
  };

  const verifyLeadOwnership = async (user: any, leadId: string, res: any): Promise<boolean> => {
    if (user.role === 'superadmin' || user.role === 'admin') return true;
    const [lead] = await db.select().from(portalLeads).where(eq(portalLeads.id, leadId));
    if (!lead) { res.status(404).json({ error: 'Lead not found' }); return false; }
    if (lead.assignedPlannerId !== user.id) {
      res.status(403).json({ error: 'You can only manage contacts for leads assigned to you' });
      return false;
    }
    return true;
  };

  app.get('/api/portal-leads/:leadId/contacts', async (req, res) => {
    try {
      const result = await verifyPortalContactAccess(req, res);
      if (!result) return;
      if (!(await verifyLeadOwnership(result.user, req.params.leadId, res))) return;
      const contacts = await storage.getPortalLeadContacts(req.params.leadId);
      res.json(contacts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/portal-leads/:leadId/contacts', async (req, res) => {
    try {
      const result = await verifyPortalContactAccess(req, res);
      if (!result) return;
      if (!(await verifyLeadOwnership(result.user, req.params.leadId, res))) return;
      const { name, phone, email, relation } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Name is required' });
      }
      const contact = await storage.createPortalLeadContact({
        portalLeadId: req.params.leadId,
        name: name.trim(),
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        relation: relation?.trim() || null,
        isActive: true,
      });
      res.json(contact);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch('/api/portal-lead-contacts/:id', async (req, res) => {
    try {
      const result = await verifyPortalContactAccess(req, res);
      if (!result) return;
      const [contact] = await db.select().from(portalLeadContacts).where(eq(portalLeadContacts.id, req.params.id));
      if (!contact) return res.status(404).json({ error: 'Contact not found' });
      if (!(await verifyLeadOwnership(result.user, contact.portalLeadId, res))) return;
      const { name, phone, email, relation, isActive } = req.body;
      const updateData: any = {};
      if (name !== undefined) updateData.name = name?.trim() || undefined;
      if (phone !== undefined) updateData.phone = phone?.trim() || null;
      if (email !== undefined) updateData.email = email?.trim() || null;
      if (relation !== undefined) updateData.relation = relation?.trim() || null;
      if (isActive !== undefined) updateData.isActive = isActive;
      const updated = await storage.updatePortalLeadContact(req.params.id, updateData);
      if (!updated) return res.status(404).json({ error: 'Contact not found' });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/portal-lead-contacts/:id', async (req, res) => {
    try {
      const result = await verifyPortalContactAccess(req, res);
      if (!result) return;
      const [contact] = await db.select().from(portalLeadContacts).where(eq(portalLeadContacts.id, req.params.id));
      if (!contact) return res.status(404).json({ error: 'Contact not found' });
      if (!(await verifyLeadOwnership(result.user, contact.portalLeadId, res))) return;
      await storage.deletePortalLeadContact(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Public endpoint for portal - returns active admins only (no auth needed)
  app.get('/api/portal/admins', async (req, res) => {
    try {
      const admins = await storage.getActivePortalAdmins();
      res.json(admins.map(a => ({
        id: a.id, name: a.name, role: a.role,
        whatsappNumber: a.whatsappNumber, email: a.email, photoUrl: a.photoUrl
      })));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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

      let duplicateWarning: string | undefined;
      try {
        const today = new Date();
        const threeDaysAgo = new Date(today);
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        const todayStr = today.toISOString().split('T')[0];
        const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];
        const recentEntries = await storage.getDaybookEntriesByDateRange(threeDaysAgoStr, todayStr);
        const descPrefix = (data.description || '').substring(0, 10).toLowerCase();
        if (descPrefix.length > 0) {
          const duplicate = recentEntries.find(e => {
            const sameAmount = parseFloat(e.amount) === parseFloat(String(data.amount));
            const similarDesc = (e.description || '').substring(0, 10).toLowerCase() === descPrefix;
            return sameAmount && similarDesc;
          });
          if (duplicate) {
            duplicateWarning = `Possible duplicate: Similar entry of ₹${parseFloat(duplicate.amount).toLocaleString('en-IN')} found on ${duplicate.date} - ${duplicate.description || 'No description'}`;
          }
        }
      } catch (dupErr) {
        console.error('[Daybook] Duplicate detection error:', dupErr);
      }

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
      res.json(duplicateWarning ? { ...entry, warning: duplicateWarning } : entry);

      setTimeout(async () => {
        try {
          if (entry.eventId && entry.type === 'income') {
            const { generatePaymentReceipt } = await import('./document-service');
            const { db } = await import('./db');
            const { users } = await import('@shared/schema');

            const event = await storage.getEvent(entry.eventId);
            if (!event) return;

            const receipt = await generatePaymentReceipt({
              eventId: entry.eventId,
              amount: parseFloat(entry.amount),
              description: entry.description || '',
              date: entry.date,
            });

            console.log(`[Receipt] Auto-generated payment receipt ${receipt.filename} for event "${event.title}"`);

            const allUsers = await storage.getAllUsers();
            const superadmins = allUsers.filter(u => u.role === 'superadmin');
            for (const admin of superadmins) {
              await sendPushToUser(admin.id, {
                title: '💰 Payment Receipt Generated',
                body: `Receipt for ₹${parseFloat(entry.amount).toLocaleString('en-IN')} received for "${event.title}" from ${event.customer}`,
                actionUrl: `/api/documents/${receipt.documentId}`,
                type: 'success',
                sound: true,
              });
            }

            if (event.planner) {
              const plannerUser = allUsers.find(u =>
                u.name?.toLowerCase().trim() === event.planner?.toLowerCase().trim()
              );
              if (plannerUser) {
                await sendPushToUser(plannerUser.id, {
                  title: '💰 Payment Received',
                  body: `₹${parseFloat(entry.amount).toLocaleString('en-IN')} received for "${event.title}" from ${event.customer}. Receipt: ${receipt.filename}`,
                  actionUrl: `/api/documents/${receipt.documentId}`,
                  type: 'success',
                  sound: true,
                });
              }
            }
          }
        } catch (err) {
          console.error('[Receipt] Failed to auto-generate payment receipt:', err);
        }
      }, 0);
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

  // Rate limiting for public RSVP endpoints (simple in-memory)
  const rsvpRateLimits: Map<string, { count: number; resetAt: number }> = new Map();
  const RSVP_RATE_LIMIT = 20; // max requests per window
  const RSVP_RATE_WINDOW = 60 * 1000; // 1 minute

  function checkRsvpRateLimit(ip: string): boolean {
    const now = Date.now();
    const record = rsvpRateLimits.get(ip);
    if (!record || now > record.resetAt) {
      rsvpRateLimits.set(ip, { count: 1, resetAt: now + RSVP_RATE_WINDOW });
      return true;
    }
    if (record.count >= RSVP_RATE_LIMIT) {
      return false;
    }
    record.count++;
    return true;
  }

  // Generate or get RSVP code for an event
  app.post('/api/rsvp/events/:eventId/generate-code', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      const event = await storage.getEvent(req.params.eventId);
      if (!event) return res.status(404).json({ error: 'Event not found' });
      
      const rawTitle = req.body?.rsvpTitle;
      const validatedTitle = typeof rawTitle === 'string' ? rawTitle.trim().slice(0, 200) || null : undefined;

      if (validatedTitle !== undefined) {
        await storage.updateEvent(event.id, { rsvpTitle: validatedTitle } as any);
      }

      const storedTitle = validatedTitle !== undefined ? validatedTitle : event.rsvpTitle;

      if (event.rsvpCode) {
        return res.json({ rsvpCode: event.rsvpCode, rsvpTitle: storedTitle });
      }
      
      // Generate a short 6-char alphanumeric code with collision retry
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      let attempts = 0;
      const maxAttempts = 5;
      
      while (attempts < maxAttempts) {
        code = '';
        for (let i = 0; i < 6; i++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        try {
          await storage.updateEvent(event.id, { rsvpCode: code } as any);
          return res.json({ rsvpCode: code, rsvpTitle: storedTitle });
        } catch (err: any) {
          if (err?.code === '23505') { // unique constraint violation
            attempts++;
            continue;
          }
          throw err;
        }
      }
      
      res.status(500).json({ error: 'Failed to generate unique code. Please try again.' });
    } catch (error) {
      console.error('Error generating RSVP code:', error);
      res.status(500).json({ error: 'Failed to generate RSVP code' });
    }
  });

  // Update RSVP functions for an event
  app.patch('/api/rsvp/events/:eventId/functions', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      const { functions } = req.body;
      if (!Array.isArray(functions) || functions.length === 0) {
        return res.status(400).json({ error: 'Functions must be a non-empty array of strings' });
      }
      const sanitized = functions.map((f: any) => String(f).trim()).filter((f: string) => f.length > 0);
      if (sanitized.length === 0) {
        return res.status(400).json({ error: 'At least one function name is required' });
      }
      const event = await storage.getEvent(req.params.eventId);
      if (!event) return res.status(404).json({ error: 'Event not found' });
      await storage.updateEvent(event.id, { rsvpFunctions: sanitized } as any);
      res.json({ rsvpFunctions: sanitized });
    } catch (error) {
      console.error('Error updating RSVP functions:', error);
      res.status(500).json({ error: 'Failed to update RSVP functions' });
    }
  });

  // Update RSVP settings for an event (superadmin/admin only)
  app.put('/api/events/:id/rsvp-settings', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin', 'wedding_planner'].includes(user.role)) {
        return res.status(403).json({ error: 'Only superadmin, admin, or wedding planners can update RSVP settings' });
      }
      const { id } = req.params;
      const settings = req.body;
      await storage.updateEvent(id, { rsvpSettings: settings });
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating RSVP settings:', error);
      res.status(500).json({ error: 'Failed to update RSVP settings' });
    }
  });

  const landingImageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req: any, file: any, cb: any) => {
      if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Only JPG, PNG, and WebP images are allowed'));
      }
    },
  });

  app.post('/api/events/:id/rsvp-landing-image', landingImageUpload.single('image'), async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin', 'wedding_planner'].includes(user.role)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: 'No image uploaded' });
      }
      console.log('[RSVP Upload] Uploading file:', file.originalname, 'size:', file.size, 'type:', file.mimetype);
      const objectStorage = new ObjectStorageService();
      const imageUrl = await objectStorage.uploadPortfolioImage(
        file.buffer,
        `rsvp-landing-${Date.now()}.${file.originalname.split('.').pop() || 'jpg'}`,
        file.mimetype
      );
      console.log('[RSVP Upload] Success:', imageUrl);
      res.json({ imageUrl });
    } catch (error: any) {
      console.error('[RSVP Upload] Error:', error.message, error.stack);
      res.status(500).json({ error: error.message || 'Failed to upload image' });
    }
  });

  // Get RSVP settings for an event (superadmin/admin only)
  app.get('/api/events/:id/rsvp-settings', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      const allEvents = await storage.getAllEvents();
      const event = allEvents.find(e => e.id === req.params.id);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }
      res.json(event.rsvpSettings || {});
    } catch (error) {
      console.error('Error fetching RSVP settings:', error);
      res.status(500).json({ error: 'Failed to fetch RSVP settings' });
    }
  });

  // Public Event RSVP API - Code-based access (single link per event)
  app.get('/api/rsvp/event/:code', async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      if (!checkRsvpRateLimit(clientIp)) {
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
      }

      const { code } = req.params;
      const allEvents = await storage.getAllEvents();
      const event = allEvents.find(e => e.rsvpCode === code.toUpperCase());
      
      if (!event) {
        return res.status(404).json({ error: 'Invalid RSVP link' });
      }

      if (event.date) {
        const eventDate = new Date(event.date);
        const expiry = new Date(eventDate.getTime() + 24 * 60 * 60 * 1000);
        if (new Date() > expiry) {
          return res.status(410).json({ error: 'This RSVP link has expired. The event has already passed.' });
        }
      }

      const rsvpSettings = event.rsvpSettings || {};
      const publicSettings: any = {};
      if (rsvpSettings.hideTourSection) publicSettings.hideTourSection = true;
      if (rsvpSettings.showDepartureDetails) publicSettings.showDepartureDetails = true;
      if (rsvpSettings.showSecondaryContact) publicSettings.showSecondaryContact = true;
      if (rsvpSettings.showHotelAllocation) publicSettings.showHotelAllocation = true;
      if (rsvpSettings.hotelOptions) publicSettings.hotelOptions = rsvpSettings.hotelOptions;
      if (rsvpSettings.localTransportContactName) publicSettings.localTransportContactName = rsvpSettings.localTransportContactName;
      if (rsvpSettings.localTransportContactPhone) publicSettings.localTransportContactPhone = rsvpSettings.localTransportContactPhone;
      if (rsvpSettings.formPage) publicSettings.formPage = rsvpSettings.formPage;

      res.json({
        eventId: event.id,
        title: event.title,
        customer: event.customer,
        date: event.date,
        time: event.time,
        venue: event.venue,
        type: event.type,
        rsvpTitle: event.rsvpTitle,
        rsvpFunctions: event.rsvpFunctions || ['Wedding', 'Engagement / Reception'],
        rsvpSettings: publicSettings,
        landingPage: (rsvpSettings as any).landingPage || {},
      });
    } catch (error) {
      console.error('Error fetching event RSVP:', error);
      res.status(500).json({ error: 'Failed to load RSVP information' });
    }
  });

  // Search for guest by name within an event (public)
  app.get('/api/rsvp/event/:code/search', async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      if (!checkRsvpRateLimit(clientIp)) {
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
      }

      const { code } = req.params;
      const { name } = req.query;
      
      if (!name || typeof name !== 'string' || name.trim().length < 1) {
        return res.status(400).json({ error: 'Please enter at least 1 character' });
      }

      const allEvents = await storage.getAllEvents();
      const event = allEvents.find(e => e.rsvpCode === code.toUpperCase());
      if (!event) {
        return res.status(404).json({ error: 'Invalid RSVP link' });
      }

      const guests = await storage.getEventGuestsByEvent(event.id);
      const searchTerm = name.trim().toLowerCase();
      const digitSearch = searchTerm.replace(/\D/g, '');
      const matches = guests.filter(g => 
        g.name.toLowerCase().includes(searchTerm) ||
        (digitSearch.length >= 3 && g.phone && g.phone.replace(/\D/g, '').includes(digitSearch))
      ).map(g => ({
        id: g.id,
        name: g.name,
        maxAttendees: g.maxAttendees || 1,
      }));

      res.json({ guests: matches });
    } catch (error) {
      console.error('Error searching guests:', error);
      res.status(500).json({ error: 'Failed to search guests' });
    }
  });

  // Submit RSVP response for a specific guest via event code (public)
  app.post('/api/rsvp/event/:code/respond/:guestId', async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      if (!checkRsvpRateLimit(clientIp)) {
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
      }

      const { code, guestId } = req.params;
      const allEvents = await storage.getAllEvents();
      const event = allEvents.find(e => e.rsvpCode === code.toUpperCase());
      if (!event) {
        return res.status(404).json({ error: 'Invalid RSVP link' });
      }

      if (event.date) {
        const eventDate = new Date(event.date);
        const expiry = new Date(eventDate.getTime() + 24 * 60 * 60 * 1000);
        if (new Date() > expiry) {
          return res.status(410).json({ error: 'This RSVP has expired. The event has already passed.' });
        }
      }

      const guest = await storage.getEventGuest(guestId);
      if (!guest || guest.eventId !== event.id) {
        return res.status(404).json({ error: 'Guest not found for this event' });
      }

      const { 
        attendanceStatus, numberOfAttendees, numberOfAdults, numberOfChildren,
        mealPreference, specialNotes,
        attendingWedding, attendingEngagement, attendingFunctions,
        needsAirportPickup, pickupFlightTrainNo, pickupPoint, pickupDate, pickupTime, pickupContactPerson,
        needsAccommodation, accommodationCheckIn, accommodationCheckOut, accommodationRooms,
        needsTransport, transportPickupTime, transportDropTime,
        plansTourAfterEvent, tourPeopleCount, tourDaysCount, tourPlans,
        alternateContactName, alternateContactPhone,
        departureFlightTrainNo, departureDate, departureTime, departurePoint,
        hotelSelection,
        dietaryRestrictions, whatsAppNumber
      } = req.body;

      const existingResponse = await storage.getRsvpResponseByGuest(guest.id);
      
      const responseData: any = {
        guestId: guest.id,
        eventId: event.id,
        attendanceStatus,
        numberOfAttendees: numberOfAttendees || 1,
        numberOfAdults: numberOfAdults || 1,
        numberOfChildren: numberOfChildren || 0,
        mealPreference,
        specialNotes,
        attendingWedding: attendingWedding || false,
        attendingEngagement: attendingEngagement || false,
        attendingFunctions: Array.isArray(attendingFunctions) ? attendingFunctions : null,
        needsAirportPickup: needsAirportPickup || false,
        pickupFlightTrainNo: pickupFlightTrainNo || null,
        pickupPoint: pickupPoint || null,
        pickupDate: pickupDate || null,
        pickupTime: pickupTime || null,
        pickupContactPerson: pickupContactPerson || null,
        needsAccommodation: needsAccommodation || false,
        accommodationCheckIn: accommodationCheckIn || null,
        accommodationCheckOut: accommodationCheckOut || null,
        accommodationRooms: accommodationRooms || null,
        needsTransport: needsTransport || false,
        transportPickupTime: transportPickupTime || null,
        transportDropTime: transportDropTime || null,
        plansTourAfterEvent: plansTourAfterEvent || false,
        tourPeopleCount: tourPeopleCount || null,
        tourDaysCount: tourDaysCount || null,
        tourPlans: tourPlans || null,
        alternateContactName: alternateContactName || null,
        alternateContactPhone: alternateContactPhone || null,
        departureFlightTrainNo: departureFlightTrainNo || null,
        departureDate: departureDate || null,
        departureTime: departureTime || null,
        departurePoint: departurePoint || null,
        hotelSelection: hotelSelection || null,
        dietaryRestrictions: dietaryRestrictions || null,
        whatsappNumberGuest: whatsAppNumber || null,
        respondedAt: new Date(),
        source: 'event_link',
      };

      if (existingResponse) {
        await storage.updateRsvpResponse(existingResponse.id, responseData);
      } else {
        await storage.createRsvpResponse(responseData);
      }

      res.json({ success: true, message: 'RSVP recorded successfully' });
    } catch (error) {
      console.error('Error submitting event RSVP:', error);
      res.status(500).json({ error: 'Failed to submit RSVP' });
    }
  });

  // Self-register as a guest not in the list (public)
  app.post('/api/rsvp/event/:code/self-register', async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      if (!checkRsvpRateLimit(clientIp)) {
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
      }

      const { code } = req.params;
      const allEvents = await storage.getAllEvents();
      const event = allEvents.find(e => e.rsvpCode === code.toUpperCase());
      if (!event) {
        return res.status(404).json({ error: 'Invalid RSVP link' });
      }

      if (event.date) {
        const eventDate = new Date(event.date);
        const expiry = new Date(eventDate.getTime() + 24 * 60 * 60 * 1000);
        if (new Date() > expiry) {
          return res.status(410).json({ error: 'This RSVP has expired. The event has already passed.' });
        }
      }

      const { name, phone } = req.body;
      if (!name || typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({ error: 'Please provide your full name (at least 2 characters)' });
      }
      if (!phone || typeof phone !== 'string' || phone.trim().length < 5) {
        return res.status(400).json({ error: 'Please provide a valid phone number' });
      }

      const newGuest = await storage.createEventGuest({
        eventId: event.id,
        name: name.trim(),
        phone: phone.trim(),
        maxAttendees: 20,
        notes: 'Self-registered via RSVP link',
        guestGroup: 'Walk-in',
      } as any);

      res.json({
        id: newGuest.id,
        name: newGuest.name,
        maxAttendees: newGuest.maxAttendees || 20,
      });
    } catch (error) {
      console.error('Error self-registering guest:', error);
      res.status(500).json({ error: 'Failed to register. Please try again.' });
    }
  });

  // Get existing response for a guest via event code (public)
  app.get('/api/rsvp/event/:code/guest/:guestId', async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      if (!checkRsvpRateLimit(clientIp)) {
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
      }

      const { code, guestId } = req.params;
      const allEvents = await storage.getAllEvents();
      const event = allEvents.find(e => e.rsvpCode === code.toUpperCase());
      if (!event) {
        return res.status(404).json({ error: 'Invalid RSVP link' });
      }

      const guest = await storage.getEventGuest(guestId);
      if (!guest || guest.eventId !== event.id) {
        return res.status(404).json({ error: 'Guest not found' });
      }

      const existingResponse = await storage.getRsvpResponseByGuest(guest.id);

      res.json({
        guest: {
          id: guest.id,
          name: guest.name,
          maxAttendees: guest.maxAttendees || 1,
        },
        existingResponse: existingResponse ? {
          attendanceStatus: existingResponse.attendanceStatus,
          numberOfAttendees: existingResponse.numberOfAttendees,
          numberOfAdults: existingResponse.numberOfAdults,
          numberOfChildren: existingResponse.numberOfChildren,
          mealPreference: existingResponse.mealPreference,
          specialNotes: existingResponse.specialNotes,
          attendingWedding: existingResponse.attendingWedding,
          attendingEngagement: existingResponse.attendingEngagement,
          attendingFunctions: existingResponse.attendingFunctions,
          needsAirportPickup: existingResponse.needsAirportPickup,
          pickupFlightTrainNo: existingResponse.pickupFlightTrainNo,
          pickupPoint: existingResponse.pickupPoint,
          pickupDate: existingResponse.pickupDate,
          pickupTime: existingResponse.pickupTime,
          pickupContactPerson: existingResponse.pickupContactPerson,
          needsAccommodation: existingResponse.needsAccommodation,
          accommodationCheckIn: existingResponse.accommodationCheckIn,
          accommodationCheckOut: existingResponse.accommodationCheckOut,
          accommodationRooms: existingResponse.accommodationRooms,
          needsTransport: existingResponse.needsTransport,
          transportPickupDate: (existingResponse as any).transportPickupDate,
          transportPickupTime: existingResponse.transportPickupTime,
          transportDropDate: (existingResponse as any).transportDropDate,
          transportDropTime: existingResponse.transportDropTime,
          plansTourAfterEvent: existingResponse.plansTourAfterEvent,
          tourPeopleCount: existingResponse.tourPeopleCount,
          tourDaysCount: existingResponse.tourDaysCount,
          tourPlans: existingResponse.tourPlans,
          alternateContactName: existingResponse.alternateContactName,
          alternateContactPhone: existingResponse.alternateContactPhone,
          departureFlightTrainNo: (existingResponse as any).departureFlightTrainNo,
          departureDate: (existingResponse as any).departureDate,
          departureTime: (existingResponse as any).departureTime,
          departurePoint: (existingResponse as any).departurePoint,
          hotelSelection: existingResponse.hotelSelection,
          dietaryRestrictions: existingResponse.dietaryRestrictions,
          whatsAppNumber: (existingResponse as any).whatsappNumberGuest,
        } : null,
      });
    } catch (error) {
      console.error('Error fetching guest RSVP:', error);
      res.status(500).json({ error: 'Failed to load guest information' });
    }
  });

  // Public RSVP API - Token-based access (no login required) - Legacy per-guest links
  app.get('/api/rsvp/public/:token', async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      if (!checkRsvpRateLimit(clientIp)) {
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
      }

      const { token } = req.params;
      const guest = await storage.getEventGuestByToken(token);
      
      if (!guest) {
        return res.status(404).json({ error: 'Invalid or expired RSVP link' });
      }
      
      const event = await storage.getEvent(guest.eventId);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      // Check if event has already passed (token expired after event + 24 hours)
      if (event.date) {
        const eventDate = new Date(event.date);
        const expiry = new Date(eventDate.getTime() + 24 * 60 * 60 * 1000);
        if (new Date() > expiry) {
          return res.status(410).json({ error: 'This RSVP link has expired. The event has already passed.' });
        }
      }
      
      // Get existing response if any
      const existingResponse = await storage.getRsvpResponseByGuest(guest.id);
      
      res.json({
        id: guest.id,
        name: guest.name,
        eventId: guest.eventId,
        maxAttendees: guest.maxAttendees || 1,
        event: {
          id: event.id,
          title: event.title,
          date: event.date,
          venue: event.venue,
          customer: event.customer,
          rsvpTitle: event.rsvpTitle,
          rsvpFunctions: event.rsvpFunctions || ['Wedding', 'Engagement / Reception'],
        },
        existingResponse: existingResponse ? {
          attendanceStatus: existingResponse.attendanceStatus,
          numberOfAttendees: existingResponse.numberOfAttendees,
          mealPreference: existingResponse.mealPreference,
          specialNotes: existingResponse.specialNotes,
          attendingWedding: existingResponse.attendingWedding,
          attendingEngagement: existingResponse.attendingEngagement,
          attendingFunctions: existingResponse.attendingFunctions,
          needsAirportPickup: existingResponse.needsAirportPickup,
          pickupFlightTrainNo: existingResponse.pickupFlightTrainNo,
          pickupPoint: existingResponse.pickupPoint,
          pickupDate: existingResponse.pickupDate,
          pickupTime: existingResponse.pickupTime,
          pickupContactPerson: existingResponse.pickupContactPerson,
          needsAccommodation: existingResponse.needsAccommodation,
          accommodationHotelName: existingResponse.accommodationHotelName,
          accommodationCheckIn: existingResponse.accommodationCheckIn,
          accommodationCheckOut: existingResponse.accommodationCheckOut,
          accommodationRooms: existingResponse.accommodationRooms,
          needsTransport: existingResponse.needsTransport,
          transportVehicleNo: existingResponse.transportVehicleNo,
          transportDriverNo: existingResponse.transportDriverNo,
          transportPickupTime: existingResponse.transportPickupTime,
          transportDropTime: existingResponse.transportDropTime,
          plansTourAfterEvent: existingResponse.plansTourAfterEvent,
          tourPeopleCount: existingResponse.tourPeopleCount,
          tourDaysCount: existingResponse.tourDaysCount,
          tourPlans: existingResponse.tourPlans,
          alternateContactName: existingResponse.alternateContactName,
          alternateContactPhone: existingResponse.alternateContactPhone,
          departureFlightTrainNo: (existingResponse as any).departureFlightTrainNo,
          departureDate: (existingResponse as any).departureDate,
          departureTime: (existingResponse as any).departureTime,
          departurePoint: (existingResponse as any).departurePoint,
          hotelSelection: existingResponse.hotelSelection,
          dietaryRestrictions: existingResponse.dietaryRestrictions,
          whatsAppNumber: (existingResponse as any).whatsappNumberGuest,
        } : null,
      });
    } catch (error) {
      console.error('Error fetching public RSVP:', error);
      res.status(500).json({ error: 'Failed to load RSVP information' });
    }
  });

  app.post('/api/rsvp/public/:token/respond', async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      if (!checkRsvpRateLimit(clientIp)) {
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
      }

      const { token } = req.params;
      const { 
        attendanceStatus, numberOfAttendees, mealPreference, specialNotes,
        attendingWedding, attendingEngagement, attendingFunctions,
        needsAirportPickup, pickupFlightTrainNo, pickupPoint, pickupDate, pickupTime, pickupContactPerson,
        needsAccommodation, accommodationHotelName, accommodationCheckIn, accommodationCheckOut, accommodationRooms,
        needsTransport, transportVehicleNo, transportDriverNo, transportPickupTime, transportDropTime,
        plansTourAfterEvent, tourPeopleCount, tourDaysCount, tourPlans
      } = req.body;
      
      const guest = await storage.getEventGuestByToken(token);
      if (!guest) {
        return res.status(404).json({ error: 'Invalid or expired RSVP link' });
      }

      // Verify event hasn't passed
      const event = await storage.getEvent(guest.eventId);
      if (event?.date) {
        const eventDate = new Date(event.date);
        const expiry = new Date(eventDate.getTime() + 24 * 60 * 60 * 1000);
        if (new Date() > expiry) {
          return res.status(410).json({ error: 'This RSVP link has expired. The event has already passed.' });
        }
      }
      
      // Check for existing response
      const existingResponse = await storage.getRsvpResponseByGuest(guest.id);
      
      const responseData: any = {
        guestId: guest.id,
        eventId: guest.eventId,
        attendanceStatus,
        numberOfAttendees: numberOfAttendees || 1,
        mealPreference,
        specialNotes,
        attendingWedding: attendingWedding || false,
        attendingEngagement: attendingEngagement || false,
        attendingFunctions: Array.isArray(attendingFunctions) ? attendingFunctions : null,
        needsAirportPickup: needsAirportPickup || false,
        pickupFlightTrainNo: pickupFlightTrainNo || null,
        pickupPoint: pickupPoint || null,
        pickupDate: pickupDate || null,
        pickupTime: pickupTime || null,
        pickupContactPerson: pickupContactPerson || null,
        needsAccommodation: needsAccommodation || false,
        accommodationHotelName: accommodationHotelName || null,
        accommodationCheckIn: accommodationCheckIn || null,
        accommodationCheckOut: accommodationCheckOut || null,
        accommodationRooms: accommodationRooms || null,
        needsTransport: needsTransport || false,
        transportVehicleNo: transportVehicleNo || null,
        transportDriverNo: transportDriverNo || null,
        transportPickupTime: transportPickupTime || null,
        transportDropTime: transportDropTime || null,
        plansTourAfterEvent: plansTourAfterEvent || false,
        tourPeopleCount: tourPeopleCount || null,
        tourDaysCount: tourDaysCount || null,
        tourPlans: tourPlans || null,
        responseSource: 'website',
        respondedAt: new Date(),
      };
      
      let response;
      if (existingResponse) {
        response = await storage.updateRsvpResponse(existingResponse.id, responseData);
      } else {
        response = await storage.createRsvpResponse(responseData);
      }
      
      res.json({ success: true, response });
    } catch (error) {
      console.error('Error submitting public RSVP:', error);
      res.status(500).json({ error: 'Failed to submit RSVP' });
    }
  });

  // Generate RSVP token for a guest
  app.post('/api/event-guests/:id/generate-token', async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const { randomBytes } = await import('crypto');
      const token = randomBytes(32).toString('hex');
      
      const guest = await storage.updateEventGuest(req.params.id, {
        rsvpToken: token,
        tokenGeneratedAt: new Date(),
      });
      
      if (!guest) {
        return res.status(404).json({ error: 'Guest not found' });
      }
      
      res.json({ 
        token, 
        rsvpLink: `/rsvp/${token}`,
      });
    } catch (error) {
      console.error('Error generating RSVP token:', error);
      res.status(500).json({ error: 'Failed to generate RSVP token' });
    }
  });

  // Bulk generate RSVP tokens for all guests in an event
  app.post('/api/events/:eventId/generate-rsvp-tokens', async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const { randomBytes } = await import('crypto');
      const guests = await storage.getEventGuestsByEvent(req.params.eventId);
      
      const results = await Promise.all(
        guests.map(async (guest) => {
          // Only generate if no token exists
          if (!guest.rsvpToken) {
            const token = randomBytes(32).toString('hex');
            await storage.updateEventGuest(guest.id, {
              rsvpToken: token,
              tokenGeneratedAt: new Date(),
            });
            return { guestId: guest.id, name: guest.name, token };
          }
          return { guestId: guest.id, name: guest.name, token: guest.rsvpToken };
        })
      );
      
      res.json({ 
        success: true, 
        count: results.length,
        guests: results,
      });
    } catch (error) {
      console.error('Error generating bulk RSVP tokens:', error);
      res.status(500).json({ error: 'Failed to generate RSVP tokens' });
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
      const existingEvents = await storage.getAllEvents();
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

  // Send RSVP Invite (WhatsApp + Email) with personalized RSVP link
  app.post('/api/rsvp-send-invite', async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const user = await storage.getUser(userId);
      
      if (!user || !['superadmin', 'wedding_planner'].includes(user.role)) {
        return res.status(403).json({ error: 'Only superadmin and wedding planners can send RSVP invites' });
      }

      const { guestIds, eventId, channels } = req.body;
      const sendWhatsApp = channels?.whatsapp !== false;
      const sendEmailInvite = channels?.email !== false;
      
      if (!guestIds || !Array.isArray(guestIds) || guestIds.length === 0) {
        return res.status(400).json({ error: 'guestIds is required' });
      }
      if (!eventId) {
        return res.status(400).json({ error: 'eventId is required' });
      }

      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      // Ensure event has RSVP code
      let rsvpCode = event.rsvpCode;
      if (!rsvpCode) {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
        await storage.updateEvent(event.id, { rsvpCode: code } as any);
        rsvpCode = code;
      }

      const { randomBytes } = await import('crypto');
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const eventTitle = event.rsvpTitle || event.customer || event.title || 'Event';
      const eventDate = event.date ? new Date(event.date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '';
      const venue = event.venue || '';

      const results: { guestId: string; name: string; whatsapp?: { success: boolean; error?: string }; email?: { success: boolean; error?: string } }[] = [];

      for (const guestId of guestIds) {
        const guest = await storage.getEventGuest(guestId);
        if (!guest) {
          results.push({ guestId, name: 'Unknown', whatsapp: { success: false, error: 'Guest not found' } });
          continue;
        }

        // Generate RSVP token if not already present
        let rsvpToken = guest.rsvpToken;
        if (!rsvpToken) {
          rsvpToken = randomBytes(32).toString('hex');
          await storage.updateEventGuest(guest.id, {
            rsvpToken,
            tokenGeneratedAt: new Date(),
          });
        }

        const rsvpLink = `${baseUrl}/rsvp/${rsvpToken}`;
        const result: any = { guestId, name: guest.name };

        if (sendWhatsApp && guest.phone) {
          try {
            const rsvpPageLink = `${baseUrl}/rsvp/e/${rsvpCode}`;
            const coupleTitle = (() => {
              const raw = eventTitle;
              const ofMatch = raw.match(/(?:celebration|wedding|union|marriage|engagement)\s+of\s+(.+)/i);
              return ofMatch ? ofMatch[1].replace(/\.\s*$/, '').trim() : raw;
            })();
            
            const waResult = await sendRsvpReminderWhatsApp(guest.phone, guest.name, coupleTitle, rsvpPageLink, eventId);
            result.whatsapp = { success: waResult.success, error: waResult.error };

            await storage.createRsvpMessageLog({
              eventId,
              guestId,
              templateId: null,
              messageType: 'invite',
              messageContent: `Dear ${guest.name}, Kindly check your personalized RSVP link for ${coupleTitle}. ${rsvpPageLink} We look forward to your response.`,
              recipientPhone: guest.phone,
              deliveryStatus: waResult.success ? 'sent' : 'failed',
              twilioMessageSid: waResult.messageId || null,
              errorMessage: waResult.error || null,
              sentAt: new Date(),
              sentBy: userId,
            });
          } catch (waError: any) {
            result.whatsapp = { success: false, error: waError.message };
          }
        }

        // Send Email
        if (sendEmailInvite && guest.email) {
          try {
            const { sendRsvpInviteEmail, isEmailConfigured } = await import('./email-service');
            if (await isEmailConfigured()) {
              const emailResult = await sendRsvpInviteEmail(guest.email, guest.name, eventTitle, eventDate, venue, rsvpLink);
              result.email = { success: emailResult.success, error: emailResult.error };
            } else {
              result.email = { success: false, error: 'Email not configured' };
            }
          } catch (emailError: any) {
            result.email = { success: false, error: emailError.message };
          }
        }

        // Update inviteSentAt
        const anySuccess = result.whatsapp?.success || result.email?.success;
        if (anySuccess) {
          await storage.updateEventGuest(guest.id, { inviteSentAt: new Date() });
        }

        results.push(result);
      }

      const successCount = results.filter(r => r.whatsapp?.success || r.email?.success).length;
      res.json({
        success: true,
        sent: successCount,
        failed: results.length - successCount,
        results,
      });
    } catch (error: any) {
      console.error('Error sending RSVP invites:', error);
      res.status(500).json({ error: error.message || 'Failed to send invites' });
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
      
      // Send WhatsApp notification to superadmin about new leave request
      try {
        console.log('[Leave Request API] Processing new leave request notification');
        const employee = await storage.getEmployee(data.employeeId);
        const superadmins = await storage.getUsersByRole('superadmin');
        
        console.log(`[Leave Request API] Employee: ${employee?.name || 'Not found'}, Superadmins found: ${superadmins.length}`);
        
        if (employee && superadmins.length > 0 && isWhatsAppConfigured()) {
          const startDate = new Date(data.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
          const endDate = new Date(data.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
          const days = Math.ceil((new Date(data.endDate).getTime() - new Date(data.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
          
          const message = `New Leave Request from ${employee.name}. Dates: ${startDate} to ${endDate} (${days} days). Reason: ${data.reason}. Please review in Oak HR.`;
          
          for (const superadmin of superadmins) {
            // Check user's phone first, then employee record
            let superadminPhone = superadmin.phone;
            
            if (!superadminPhone) {
              const superadminEmployee = await storage.getEmployeeByUserId(superadmin.id);
              superadminPhone = superadminEmployee?.whatsappNumber || superadminEmployee?.phone || null;
            }
            
            console.log(`[Leave Request API] Superadmin ${superadmin.name}: phone=${superadminPhone}`);
            
            if (superadminPhone) {
              const formattedPhone = superadminPhone.startsWith('+') ? superadminPhone : `+91${superadminPhone.replace(/\D/g, '')}`;
              await sendGeneralNotification(formattedPhone, superadmin.name || 'Admin', message);
              console.log(`[Leave Request API] WhatsApp notification sent to ${superadmin.name} (${formattedPhone})`);
            } else {
              console.log(`[Leave Request API] No phone found for superadmin ${superadmin.name}`);
            }
          }
        } else {
        }
      } catch (notifyError) {
        console.error('[Leave Request API] Failed to send leave request notification:', notifyError);
        // Continue even if notification fails
      }
      
      res.json(request);
    } catch (error) {
      res.status(400).json({ error: 'Invalid leave request data' });
    }
  });

  app.patch('/api/leave-requests/:id', async (req, res) => {
    try {
      const existingRequest = await storage.getLeaveRequest(req.params.id);
      const request = await storage.updateLeaveRequest(req.params.id, req.body);

      if (request && existingRequest && req.body.status && req.body.status !== existingRequest.status) {
        try {
          await recalculateEmployeeLeaveBalance(request.employeeId, request.categoryId);
        } catch (e) {
          console.error('[Leave] Failed to update leave balance:', e);
        }
      }

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
      
      // Send WhatsApp notification to superadmin
      try {
        if (isWhatsAppConfigured()) {
          // Get all superadmins and notify them
          const superadmins = await storage.getUsersByRole('superadmin');
          console.log(`[Leave Request] Found ${superadmins.length} superadmins to notify`);
          
          for (const superadmin of superadmins) {
            // Check user's phone first, then employee record
            let superadminPhone = superadmin.phone;
            
            if (!superadminPhone) {
              const superadminEmployee = await storage.getEmployeeByUserId(superadmin.id);
              superadminPhone = superadminEmployee?.whatsappNumber || superadminEmployee?.phone || null;
            }
            
            console.log(`[Leave Request] Superadmin ${superadmin.name}: phone=${superadminPhone}`);
            
            if (superadminPhone) {
              // Format phone number for WhatsApp
              const formattedPhone = superadminPhone.startsWith('+') 
                ? superadminPhone 
                : `+91${superadminPhone.replace(/\D/g, '')}`;
              
              // Calculate number of days
              const startDate = new Date(data.startDate);
              const endDate = new Date(data.endDate);
              const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
              const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
              
              const formatDate = (dateStr: string) => {
                const d = new Date(dateStr);
                return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
              };
              
              const message = `New Leave Request from ${employee.name}. Dates: ${formatDate(data.startDate)} to ${formatDate(data.endDate)} (${days} days). Reason: ${data.reason || 'Not specified'}. Please review in Oak HR.`;
              
              await sendGeneralNotification(formattedPhone, superadmin.name || 'Admin', message);
              console.log(`[Leave Request] WhatsApp notification sent to superadmin ${superadmin.name} (${formattedPhone}) for leave request from ${employee.name}`);
            } else {
              console.log(`[Leave Request] No phone found for superadmin ${superadmin.name}`);
            }
          }
        } else {
          console.log('[Leave Request] WhatsApp not configured, skipping notification');
        }
      } catch (whatsappError) {
        console.error('[Leave Request] Failed to send WhatsApp notification:', whatsappError);
        // Don't fail the request if WhatsApp notification fails
      }
      
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
      const allEmployees = await storage.getAllEmployees(true);
      
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

      if (updated && leaveRequest) {
        try {
          await recalculateEmployeeLeaveBalance(leaveRequest.employeeId, leaveRequest.categoryId);
        } catch (e) {
          console.error('[Leave] Failed to update leave balance:', e);
        }
      }

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

  // Mark all milestones for an event as completed
  app.post('/api/milestones/complete-all/:eventId', async (req, res) => {
    try {
      const { eventId } = req.params;
      const allMilestones = await storage.getAllMilestones();
      const eventMilestones = allMilestones.filter(m => m.eventId === eventId);
      
      let updated = 0;
      for (const milestone of eventMilestones) {
        if (milestone.status !== 'completed') {
          await storage.updateMilestone(milestone.id, { status: 'completed' });
          updated++;
        }
      }
      
      // Also mark the event as completed
      await storage.updateEvent(eventId, { status: 'completed' });
      
      res.json({ success: true, updated, message: `Marked ${updated} milestones as completed` });
    } catch (error) {
      console.error('Error completing all milestones:', error);
      res.status(500).json({ error: 'Failed to complete all milestones' });
    }
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

  // Oak Book - Leads (for estimate phase)
  app.get('/api/leads', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const allLeads = await storage.getAllLeads();
    res.json(allLeads);
  });

  app.get('/api/leads/:id', async (req, res) => {
    const lead = await storage.getLead(req.params.id);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    res.json(lead);
  });

  app.post('/api/leads', async (req, res) => {
    try {
      // Parse partial data since leadCode is auto-generated
      const partialSchema = insertLeadSchema.partial().required({ name: true });
      const data = partialSchema.parse(req.body);
      
      // Auto-generate lead code (OAKS-L-YY-XXXX format)
      const year = new Date().getFullYear().toString().slice(-2);
      const allLeads = await storage.getAllLeads();
      const yearLeads = allLeads.filter(l => l.leadCode?.includes(`OAKS-L-${year}-`));
      const nextNum = yearLeads.length + 1;
      const leadCode = `OAKS-L-${year}-${String(nextNum).padStart(4, '0')}`;
      
      const lead = await storage.createLead({
        leadCode,
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        company: data.company || null,
        source: data.source || 'direct',
        notes: data.notes || null,
        ownerUserId: data.ownerUserId || req.session.userId,
        status: 'new',
      });
      
      console.log(`Created lead ${lead.name} with code ${leadCode}`);
      
      // Notify superadmins about the new lead
      try {
        await notifyNewLeadToSuperadmins(lead.name, lead.phone || 'N/A', '', 'crm');
      } catch (notifyError) {
        console.error('[Leads] Failed to send push notification for new lead:', notifyError);
      }
      
      res.json(lead);
    } catch (error) {
      console.error('Error creating lead:', error);
      res.status(400).json({ error: 'Failed to create lead' });
    }
  });

  app.patch('/api/leads/:id', async (req, res) => {
    try {
      // Validate update data with partial schema, excluding leadCode
      const updateSchema = insertLeadSchema.partial().omit({ leadCode: true });
      const updateData = updateSchema.parse(req.body);
      const lead = await storage.updateLead(req.params.id, updateData);
      res.json(lead);
    } catch (error) {
      console.error('Error updating lead:', error);
      res.status(400).json({ error: 'Failed to update lead' });
    }
  });

  app.delete('/api/leads/:id', async (req, res) => {
    await storage.deleteLead(req.params.id);
    res.json({ success: true });
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

  const stripInternalCostData = (estimate: any) => {
    if (!estimate || !estimate.lineItems) return estimate;
    return {
      ...estimate,
      lineItems: estimate.lineItems
        .filter((item: any) => !item.isInternalOnly)
        .map((item: any) => {
          const { costPrice, marginPercent, isInternalOnly, ...rest } = item;
          return rest;
        }),
    };
  };

  // Oak Book - Estimates
  app.get('/api/estimates', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const user = await storage.getUser(req.session.userId);
    const canSeeCosts = user?.role === 'superadmin' || user?.role === 'wedding_planner';
    let estimates = await storage.getAllEstimates();
    
    // Wedding planners see only their own estimates
    if (user?.role === 'wedding_planner') {
      const customers = await storage.getAllCustomers();
      const leads = await storage.getAllLeads();
      const events = await storage.getAllEvents();
      const myCustomerIds = new Set(customers.filter(c => c.weddingPlannerId === req.session.userId).map(c => c.id));
      const myLeadIds = new Set(leads.filter(l => l.ownerUserId === req.session.userId).map(l => l.id));
      // Events where this planner is assigned (planner field matches user name)
      const myEventIds = new Set(events.filter(ev => ev.planner === user.name).map(ev => ev.id));
      
      estimates = estimates.filter(e => {
        // Primary check: if estimate has weddingPlannerName, it must match current user
        // Use case-insensitive comparison and check if either name contains the other
        if (e.weddingPlannerName) {
          const plannerLower = e.weddingPlannerName.toLowerCase().trim();
          const userLower = user.name.toLowerCase().trim();
          return plannerLower === userLower || 
                 userLower.includes(plannerLower) || 
                 plannerLower.includes(userLower);
        }
        // Show estimates for customers assigned to this wedding planner
        if (e.customerId && myCustomerIds.has(e.customerId)) return true;
        // Show estimates for leads owned by this wedding planner
        if ((e as any).leadId && myLeadIds.has((e as any).leadId)) return true;
        // Show estimates for events where this wedding planner is assigned
        if (e.eventId && myEventIds.has(e.eventId)) return true;
        // Only show unassigned drafts (no customer, lead, event, or weddingPlannerName) to superadmins
        // Wedding planners should not see unassigned drafts from others
        return false;
      });
    }
    
    if (!canSeeCosts) {
      estimates = estimates.map(stripInternalCostData);
    }
    res.json(estimates);
  });

  app.get('/api/estimates/next-number', async (req, res) => {
    const companyBrand = req.query.companyBrand as string || 'oakstreet';
    const number = await storage.getNextEstimateNumber(companyBrand);
    res.json({ number });
  });

  app.get('/api/estimates/:id', async (req, res) => {
    const estimate = await storage.getEstimate(req.params.id);
    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found' });
    }
    const user = req.session.userId ? await storage.getUser(req.session.userId) : null;
    const canSeeCosts = user?.role === 'superadmin' || user?.role === 'wedding_planner';
    res.json(canSeeCosts ? estimate : stripInternalCostData(estimate));
  });

  app.post('/api/estimates', async (req, res) => {
    try {
      const data = insertEstimateSchema.parse(req.body);
      
      // Auto-set isTaxDocument based on customer's company
      let isTaxDocument = data.isTaxDocument;
      if (isTaxDocument === undefined && data.customerId) {
        const customer = await storage.getCustomer(data.customerId);
        if (customer?.company === 'yepman') {
          isTaxDocument = true;
        } else {
          isTaxDocument = false;
        }
      }
      
      // Handle duplicate number conflicts by auto-generating next available number
      let attempts = 0;
      let estimateData = { ...data, isTaxDocument: isTaxDocument ?? false };
      while (attempts < 5) {
        try {
          const estimate = await storage.createEstimate(estimateData);
          return res.json(estimate);
        } catch (createError: any) {
          if (createError?.code === '23505' && createError?.constraint?.includes('number')) {
            attempts++;
            const prefix = estimateData.number.replace(/-\d+$/, '');
            const companyBrand = prefix === 'MET' ? 'meta_events' : prefix === 'EST' ? 'yepman' : 'oakstreet';
            const nextNumber = await storage.getNextEstimateNumber(companyBrand);
            console.log(`[Estimate] Duplicate number ${estimateData.number}, retrying with ${nextNumber}`);
            estimateData = { ...estimateData, number: nextNumber };
          } else {
            throw createError;
          }
        }
      }
      res.status(400).json({ error: 'Could not generate a unique estimate number. Please try again.' });
    } catch (error: any) {
      console.error('Estimate creation error:', error);
      const errorMessage = error?.errors ? JSON.stringify(error.errors) : (error?.message || 'Invalid estimate data');
      res.status(400).json({ error: errorMessage });
    }
  });

  app.patch('/api/estimates/:id', async (req, res) => {
    try {
      // Only superadmin can change quote numbers
      if (req.body.number && req.session.userId) {
        const user = await storage.getUser(req.session.userId);
        if (user?.role !== 'superadmin') {
          // Get original estimate to check if number is being changed
          const original = await storage.getEstimate(req.params.id);
          if (original && req.body.number !== original.number) {
            return res.status(403).json({ error: 'Only Superadmin can change quote numbers' });
          }
        }
      }
      
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
        lineItems: (estimate.lineItems as any[] || []).filter((item: any) => !item.isInternalOnly).map((item: any) => {
          const { costPrice, marginPercent, isInternalOnly, ...rest } = item;
          return rest;
        }),
        subtotal: estimate.subtotal,
        taxTotal: estimate.taxTotal,
        total: estimate.total,
        balanceDue: estimate.total,
        notes: estimate.notes,
        terms: estimate.terms,
        isTaxDocument: estimate.isTaxDocument ?? false,
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
    const companyBrand = req.query.companyBrand as string || 'oakstreet';
    const number = await storage.getNextInvoiceNumber(companyBrand);
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
      
      // Auto-set isTaxDocument based on customer's company
      let isTaxDocument = data.isTaxDocument;
      if (isTaxDocument === undefined && data.customerId) {
        const customer = await storage.getCustomer(data.customerId);
        if (customer?.company === 'yepman') {
          isTaxDocument = true;
        } else {
          isTaxDocument = false;
        }
      }
      
      const invoice = await storage.createInvoice({
        ...data,
        balanceDue: data.total,
        isTaxDocument: isTaxDocument ?? false,
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

  // Share estimate to customer portal
  app.post('/api/estimates/:id/share-to-portal', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const estimate = await storage.getEstimate(req.params.id);
      if (!estimate) {
        return res.status(404).json({ error: 'Estimate not found' });
      }
      
      // Try to get customer phone from various sources
      let customerPhone = (estimate as any).customerWhatsapp || '';
      let customerEmail = (estimate as any).customerEmail || '';
      
      // If estimate has a customer, get phone from customer record
      if ((estimate as any).customerId) {
        const customer = await storage.getCustomer((estimate as any).customerId);
        if (customer) {
          customerPhone = customerPhone || customer.phone || '';
          customerEmail = customerEmail || customer.email || '';
        }
      }
      
      // If estimate has a lead, get phone from lead record
      if ((estimate as any).leadId) {
        const lead = await storage.getLead((estimate as any).leadId);
        if (lead) {
          customerPhone = customerPhone || lead.phone || '';
          customerEmail = customerEmail || lead.email || '';
        }
      }
      
      // Update estimate with shared to portal flag
      await storage.updateEstimate(req.params.id, {
        sharedToPortal: true,
        sharedToPortalAt: new Date(),
        customerPhone: customerPhone,
        customerEmail: customerEmail,
      });
      
      res.json({ success: true, message: 'Estimate shared to customer portal' });
    } catch (error) {
      console.error('Share to portal error:', error);
      res.status(400).json({ error: 'Failed to share estimate to portal' });
    }
  });

  // Helper function to generate PDF buffer using puppeteer
  async function generateDocumentPDF(type: 'quote' | 'invoice' | 'receipt', id: string): Promise<Buffer> {
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.default.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
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

      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  // Send Estimate via Email
  app.post('/api/estimates/:id/send-email', async (req, res) => {
    try {
      const estimate = await storage.getEstimate(req.params.id);
      if (!estimate) {
        return res.status(404).json({ error: 'Estimate not found' });
      }

      const customerEmail = estimate.customerEmail || req.body.email;
      if (!customerEmail) {
        return res.status(400).json({ error: 'Customer email is required' });
      }

      const { sendEstimateEmail, isEmailConfigured } = await import('./email-service');
      
      if (!await isEmailConfigured()) {
        return res.status(400).json({ error: 'Email service is not configured' });
      }

      // Generate PDF
      console.log('[Email] Generating PDF for estimate:', estimate.number);
      const pdfBuffer = await generateDocumentPDF('quote', req.params.id);
      console.log('[Email] PDF generated, size:', pdfBuffer.length);

      const companyName = estimate.company === 'meta' ? 'Meta Events' : 
                          estimate.company === 'yepman' ? 'Yepman' : 'Oakstreet Events';

      const result = await sendEstimateEmail(
        customerEmail,
        estimate.leadName || 'Valued Customer',
        estimate.number,
        companyName,
        pdfBuffer
      );

      if (result.success) {
        await storage.updateEstimate(req.params.id, { status: 'sent' });
        res.json({ success: true, message: 'Estimate sent via email with PDF attachment' });
      } else {
        res.status(400).json({ error: result.error || 'Failed to send email' });
      }
    } catch (error: any) {
      console.error('Send estimate email error:', error);
      res.status(500).json({ error: error.message || 'Failed to send estimate via email' });
    }
  });

  // Send Estimate via WhatsApp (with PDF attachment)
  app.post('/api/estimates/:id/send-whatsapp', async (req, res) => {
    try {
      const estimate = await storage.getEstimate(req.params.id);
      if (!estimate) {
        return res.status(404).json({ error: 'Estimate not found' });
      }

      const customerPhone = req.body.phone;
      if (!customerPhone) {
        return res.status(400).json({ error: 'Customer phone number is required' });
      }

      const { sendWhatsAppMessage, isWhatsAppConfigured } = await import('./whatsapp-service');
      
      if (!isWhatsAppConfigured()) {
        return res.status(400).json({ error: 'WhatsApp service is not configured' });
      }

      // Generate secure download token for public PDF access
      const crypto = await import('crypto');
      const downloadToken = crypto.createHmac('sha256', process.env.SESSION_SECRET || 'oakstreet-default-secret')
        .update(`quote-${req.params.id}`)
        .digest('hex')
        .substring(0, 16);

      // Use the published app URL for customer-friendly links
      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : (process.env.REPLIT_DOMAINS?.split(',')[0] 
          ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
          : 'https://oak-event-management.replit.app');
      
      const downloadUrl = `${baseUrl}/api/public/document/quote/${req.params.id}/${downloadToken}`;

      const companyName = estimate.company === 'meta' ? 'Meta Events' : 
                          estimate.company === 'yepman' ? 'Yepman' : 'Oakstreet Events';

      const message = `Hello ${estimate.leadName || 'there'},

Thank you for your interest in ${companyName}!

📄 *Estimate:* ${estimate.number}
💰 *Total:* ₹${Number(estimate.total || 0).toLocaleString('en-IN')}

📥 *Download your estimate:*
${downloadUrl}

If you have any questions, please feel free to reach out.

Best regards,
${companyName}`;

      console.log('[WhatsApp] Sending estimate link to:', customerPhone);
      const result = await sendGeneralNotification(customerPhone, estimate.leadName || 'Customer', message);

      if (result.success) {
        await storage.updateEstimate(req.params.id, { status: 'sent' });
        res.json({ success: true, message: 'Estimate sent via WhatsApp with download link' });
      } else {
        res.status(400).json({ error: result.error || 'Failed to send WhatsApp message' });
      }
    } catch (error: any) {
      console.error('Send estimate WhatsApp error:', error);
      res.status(500).json({ error: error.message || 'Failed to send estimate via WhatsApp' });
    }
  });

  // Send WhatsApp copy to current user (wedding planner self-copy)
  app.post('/api/estimates/:id/send-whatsapp-copy', async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const estimate = await storage.getEstimate(req.params.id);
      if (!estimate) {
        return res.status(404).json({ error: 'Estimate not found' });
      }

      // Get the user's phone number from their employee record
      const employees = await storage.getEmployees();
      const userEmployee = employees.find(e => e.email === user.email || e.name === user.username);
      
      if (!userEmployee?.phone) {
        return res.status(400).json({ error: 'Your employee profile does not have a phone number configured' });
      }

      const { sendWhatsAppMessage, isWhatsAppConfigured } = await import('./whatsapp-service');
      
      if (!isWhatsAppConfigured()) {
        return res.status(400).json({ error: 'WhatsApp service is not configured' });
      }

      // Generate secure download token for PDF access
      const crypto = await import('crypto');
      const downloadToken = crypto.createHmac('sha256', process.env.SESSION_SECRET || 'oakstreet-default-secret')
        .update(`quote-${req.params.id}`)
        .digest('hex')
        .substring(0, 16);

      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : (process.env.REPLIT_DOMAINS?.split(',')[0] 
          ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
          : 'https://oak-event-management.replit.app');
      
      const downloadUrl = `${baseUrl}/api/public/document/quote/${req.params.id}/${downloadToken}`;

      const companyName = estimate.company === 'meta' ? 'Meta Events' : 
                          estimate.company === 'yepman' ? 'Yepman' : 'Oakstreet Events';

      const message = `📋 *Your Copy - Estimate ${estimate.number}*

Hi ${user.username || 'there'},

Here's your copy of the estimate you just saved:

📄 *Estimate:* ${estimate.number}
👤 *Client:* ${estimate.leadName || 'N/A'}
💰 *Total:* ₹${Number(estimate.total || 0).toLocaleString('en-IN')}

📥 *Download PDF:*
${downloadUrl}

_This is an internal copy for your records._

${companyName}`;

      console.log('[WhatsApp] Sending estimate copy to user:', userEmployee.phone);
      const result = await sendGeneralNotification(userEmployee.phone, user.username || userEmployee.name, message);

      if (result.success) {
        res.json({ success: true, message: 'Estimate copy sent to your WhatsApp' });
      } else {
        res.status(400).json({ error: result.error || 'Failed to send WhatsApp message' });
      }
    } catch (error: any) {
      console.error('Send estimate WhatsApp copy error:', error);
      res.status(500).json({ error: error.message || 'Failed to send WhatsApp copy' });
    }
  });

  // Send Invoice via Email (with PDF attachment)
  app.post('/api/invoices/:id/send-email', async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      const customerEmail = (invoice as any).customerEmail || req.body.email;
      if (!customerEmail) {
        return res.status(400).json({ error: 'Customer email is required' });
      }

      const { sendInvoiceEmail, isEmailConfigured } = await import('./email-service');
      
      if (!await isEmailConfigured()) {
        return res.status(400).json({ error: 'Email service is not configured' });
      }

      // Generate PDF
      console.log('[Email] Generating PDF for invoice:', invoice.number);
      const pdfBuffer = await generateDocumentPDF('invoice', req.params.id);
      console.log('[Email] PDF generated, size:', pdfBuffer.length);

      const companyName = (invoice as any).company === 'meta' ? 'Meta Events' : 
                          (invoice as any).company === 'yepman' ? 'Yepman' : 'Oakstreet Events';

      const result = await sendInvoiceEmail(
        customerEmail,
        (invoice as any).customerName || 'Valued Customer',
        invoice.number,
        companyName,
        pdfBuffer
      );

      if (result.success) {
        await storage.updateInvoice(req.params.id, { status: 'sent' });
        res.json({ success: true, message: 'Invoice sent via email with PDF attachment' });
      } else {
        res.status(400).json({ error: result.error || 'Failed to send email' });
      }
    } catch (error: any) {
      console.error('Send invoice email error:', error);
      res.status(500).json({ error: error.message || 'Failed to send invoice via email' });
    }
  });

  // Send Invoice via WhatsApp (with PDF attachment)
  app.post('/api/invoices/:id/send-whatsapp', async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      const customerPhone = req.body.phone;
      if (!customerPhone) {
        return res.status(400).json({ error: 'Customer phone number is required' });
      }

      const { sendWhatsAppMessage, isWhatsAppConfigured } = await import('./whatsapp-service');
      
      if (!isWhatsAppConfigured()) {
        return res.status(400).json({ error: 'WhatsApp service is not configured' });
      }

      // Generate secure download token for public PDF access
      const crypto = await import('crypto');
      const downloadToken = crypto.createHmac('sha256', process.env.SESSION_SECRET || 'oakstreet-default-secret')
        .update(`invoice-${req.params.id}`)
        .digest('hex')
        .substring(0, 16);

      // Use the published app URL for customer-friendly links
      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : (process.env.REPLIT_DOMAINS?.split(',')[0] 
          ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
          : 'https://oak-event-management.replit.app');
      
      const downloadUrl = `${baseUrl}/api/public/document/invoice/${req.params.id}/${downloadToken}`;

      const companyName = (invoice as any).company === 'meta' ? 'Meta Events' : 
                          (invoice as any).company === 'yepman' ? 'Yepman' : 'Oakstreet Events';

      const message = `Hello ${(invoice as any).customerName || 'there'},

Please find your invoice from ${companyName}.

📄 *Invoice:* ${invoice.number}
💰 *Total:* ₹${Number(invoice.total || 0).toLocaleString('en-IN')}
📅 *Due Date:* ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-IN') : 'N/A'}

📥 *Download your invoice:*
${downloadUrl}

For any queries, please feel free to reach out.

Best regards,
${companyName}`;

      console.log('[WhatsApp] Sending invoice link to:', customerPhone);
      const result = await sendGeneralNotification(customerPhone, invoice.customer || 'Customer', message);

      if (result.success) {
        await storage.updateInvoice(req.params.id, { status: 'sent' });
        res.json({ success: true, message: 'Invoice sent via WhatsApp with download link' });
      } else {
        res.status(400).json({ error: result.error || 'Failed to send WhatsApp message' });
      }
    } catch (error: any) {
      console.error('Send invoice WhatsApp error:', error);
      res.status(500).json({ error: error.message || 'Failed to send invoice via WhatsApp' });
    }
  });

  // Send WhatsApp copy to current user for invoices (wedding planner self-copy)
  app.post('/api/invoices/:id/send-whatsapp-copy', async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      // Get the user's phone number from their employee record
      const employees = await storage.getEmployees();
      const userEmployee = employees.find(e => e.email === user.email || e.name === user.username);
      
      if (!userEmployee?.phone) {
        return res.status(400).json({ error: 'Your employee profile does not have a phone number configured' });
      }

      const { sendWhatsAppMessage, isWhatsAppConfigured } = await import('./whatsapp-service');
      
      if (!isWhatsAppConfigured()) {
        return res.status(400).json({ error: 'WhatsApp service is not configured' });
      }

      // Generate secure download token for PDF access
      const crypto = await import('crypto');
      const downloadToken = crypto.createHmac('sha256', process.env.SESSION_SECRET || 'oakstreet-default-secret')
        .update(`invoice-${req.params.id}`)
        .digest('hex')
        .substring(0, 16);

      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : (process.env.REPLIT_DOMAINS?.split(',')[0] 
          ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
          : 'https://oak-event-management.replit.app');
      
      const downloadUrl = `${baseUrl}/api/public/document/invoice/${req.params.id}/${downloadToken}`;

      const companyName = (invoice as any).company === 'meta' ? 'Meta Events' : 
                          (invoice as any).company === 'yepman' ? 'Yepman' : 'Oakstreet Events';

      const message = `📋 *Your Copy - Invoice ${invoice.number}*

Hi ${user.username || 'there'},

Here's your copy of the invoice you just saved:

📄 *Invoice:* ${invoice.number}
👤 *Client:* ${(invoice as any).customerName || 'N/A'}
💰 *Total:* ₹${Number(invoice.total || 0).toLocaleString('en-IN')}

📥 *Download PDF:*
${downloadUrl}

_This is an internal copy for your records._

${companyName}`;

      console.log('[WhatsApp] Sending invoice copy to user:', userEmployee.phone);
      const result = await sendGeneralNotification(userEmployee.phone, user.username || userEmployee.name, message);

      if (result.success) {
        res.json({ success: true, message: 'Invoice copy sent to your WhatsApp' });
      } else {
        res.status(400).json({ error: result.error || 'Failed to send WhatsApp message' });
      }
    } catch (error: any) {
      console.error('Send invoice WhatsApp copy error:', error);
      res.status(500).json({ error: error.message || 'Failed to send WhatsApp copy' });
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
          await sendGeneralNotification(KISHOR_PHONE, 'Kishor', warehouseMessage);
          
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
          await sendGeneralNotification(plannerPhone, event.planner || 'Planner', plannerMessage, 'inventory_finalization');
          
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
      
      // Notify wedding planner if one is assigned
      if (weddingPlannerName) {
        notifyWeddingPlannerEventBooked(weddingPlannerName, eventTitle, eventDate, venue || undefined);
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

  // Milestones PDF Download - must be before generic PDF route
  app.get('/api/pdf/milestones/:eventId', async (req, res) => {
    try {
      const { eventId } = req.params;
      
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const milestones = await storage.getMilestonesByEventId(eventId);
      const companySettings = await storage.getCompanySettings();

      const formatDate = (dateStr: string) => {
        try {
          const date = new Date(dateStr);
          return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch {
          return dateStr;
        }
      };

      const phaseNames: Record<number, string> = {
        1: 'Event Kickoff',
        2: 'Design',
        3: 'Procurement & Production',
        4: 'Logistics & Coordination',
        5: 'Event Week',
        6: 'Event Day',
        7: 'Packup & Closure',
      };

      const groupedMilestones: Record<number, { phaseName: string; milestones: any[] }> = {};
      for (let i = 1; i <= 7; i++) {
        groupedMilestones[i] = { phaseName: phaseNames[i], milestones: [] };
      }
      milestones.forEach((m: any) => {
        if (groupedMilestones[m.phase]) {
          groupedMilestones[m.phase].milestones.push(m);
        }
      });
      for (let i = 1; i <= 7; i++) {
        groupedMilestones[i].milestones.sort((a, b) => 
          new Date(a.date).getTime() - new Date(b.date).getTime()
        );
      }

      const completedCount = milestones.filter((m: any) => m.status === 'completed').length;
      const totalCount = milestones.length;
      const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

      let phasesHtml = '';
      for (let phaseNum = 1; phaseNum <= 7; phaseNum++) {
        const phase = groupedMilestones[phaseNum];
        const phaseCompleted = phase.milestones.filter((m: any) => m.status === 'completed').length;
        const phaseTotal = phase.milestones.length;
        const phaseProgress = phaseTotal > 0 ? Math.round((phaseCompleted / phaseTotal) * 100) : 0;

        let tasksHtml = '';
        if (phase.milestones.length === 0) {
          tasksHtml = '<div style="padding: 16px; text-align: center; color: #9ca3af; font-size: 14px; font-style: italic;">No tasks in this phase</div>';
        } else {
          phase.milestones.forEach((m: any) => {
            const isCompleted = m.status === 'completed';
            tasksHtml += `
              <div style="display: flex; align-items: center; padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">
                <div style="width: 16px; height: 16px; border: 2px solid ${isCompleted ? '#22c55e' : '#d1d5db'}; border-radius: 3px; margin-right: 12px; background-color: ${isCompleted ? '#22c55e' : 'transparent'}; display: flex; align-items: center; justify-content: center;">
                  ${isCompleted ? '<span style="color: white; font-size: 11px; font-weight: bold;">✓</span>' : ''}
                </div>
                <div style="flex: 1;">
                  <p style="font-size: 14px; font-weight: 500; margin: 0; color: ${isCompleted ? '#9ca3af' : '#1f2937'}; ${isCompleted ? 'text-decoration: line-through;' : ''}">${m.name}</p>
                </div>
                <div style="font-size: 14px; color: #6b7280; margin-right: 16px;">
                  ${formatDate(m.date)}${m.time ? ' at ' + m.time : ''}
                </div>
                <span style="padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; background-color: ${isCompleted ? '#dcfce7' : '#fef3c7'}; color: ${isCompleted ? '#166534' : '#92400e'};">
                  ${isCompleted ? 'Done' : 'Pending'}
                </span>
              </div>
            `;
          });
        }

        phasesHtml += `
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 16px;">
            <div style="background: linear-gradient(135deg, #4b7c29 0%, #6b9937 100%); color: white; padding: 8px 16px; display: flex; justify-content: space-between; align-items: center;">
              <div><span style="font-weight: bold;">Phase ${phaseNum}:</span> <span style="margin-left: 8px;">${phase.phaseName}</span></div>
              <div style="font-size: 14px; opacity: 0.9;">${phaseCompleted}/${phaseTotal} (${phaseProgress}%)</div>
            </div>
            <div style="background-color: white;">${tasksHtml}</div>
          </div>
        `;
      }

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300..700&display=swap');
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
              color: #1f2937;
              line-height: 1.5;
              margin: 0;
              padding: 32px;
            }
          </style>
        </head>
        <body>
          <div style="max-width: 800px; margin: 0 auto;">
            <div style="margin-bottom: 32px; border-bottom: 1px solid #e5e7eb; padding-bottom: 24px;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                  <h1 style="font-size: 24px; font-weight: bold; color: #1f2937; margin: 0 0 4px 0;">Event Timeline</h1>
                  <p style="color: #6b7280; font-size: 14px; margin: 0;">${companySettings?.companyName || 'Oakstreet Events'}</p>
                </div>
                <div style="text-align: right;">
                  <p style="font-size: 14px; color: #6b7280; margin: 0;">Generated on</p>
                  <p style="font-weight: 500; margin: 4px 0 0 0;">${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                </div>
              </div>
            </div>

            <div style="margin-bottom: 32px; background-color: #f9fafb; border-radius: 8px; padding: 24px;">
              <div style="display: flex; justify-content: space-between;">
                <div>
                  <h2 style="font-size: 20px; font-weight: bold; color: #1f2937; margin: 0 0 12px 0;">${event.title}</h2>
                  <div style="font-size: 14px;">
                    <p style="margin: 8px 0;"><span style="color: #6b7280;">Customer:</span> <span style="font-weight: 500;">${event.customer}</span></p>
                    <p style="margin: 8px 0;"><span style="color: #6b7280;">Event Date:</span> <span style="font-weight: 500;">${formatDate(event.date)}</span></p>
                    <p style="margin: 8px 0;"><span style="color: #6b7280;">Venue:</span> <span style="font-weight: 500;">${event.venue}</span></p>
                    <p style="margin: 8px 0;"><span style="color: #6b7280;">Event Type:</span> <span style="font-weight: 500;">${event.type}</span></p>
                    <p style="margin: 8px 0;"><span style="color: #6b7280;">Wedding Planner:</span> <span style="font-weight: 500;">${event.planner || '-'}</span></p>
                  </div>
                </div>
                <div style="text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                  <div style="font-size: 36px; font-weight: bold; color: #16a34a;">${progressPercent}%</div>
                  <p style="font-size: 14px; color: #6b7280; margin: 4px 0 0 0;">Overall Progress</p>
                  <p style="font-size: 12px; color: #9ca3af; margin: 4px 0 0 0;">${completedCount} of ${totalCount} tasks completed</p>
                </div>
              </div>
            </div>

            ${phasesHtml}

            <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #9ca3af;">
              <p style="margin: 0;">${companySettings?.companyName || 'Oakstreet Events'} | ${companySettings?.phone || ''} | ${companySettings?.email || ''}</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const puppeteer = await import('puppeteer');
      const browser = await puppeteer.default.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });

      try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        
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

        const filename = `Timeline-${event.title || event.customer}.pdf`.replace(/[^a-zA-Z0-9-_.]/g, '_');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.end(Buffer.from(pdf));
      } finally {
        await browser.close();
      }
    } catch (error) {
      console.error('Milestones PDF generation error:', error);
      res.status(500).json({ error: 'Failed to generate PDF' });
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
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
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

  // Public Document Download - No login required (for WhatsApp links)
  // Uses a simple time-limited token to prevent abuse
  app.get('/api/public/document/:type/:id/:token', async (req, res) => {
    try {
      const { type, id, token } = req.params;
      
      if (!['quote', 'invoice'].includes(type)) {
        return res.status(400).json({ error: 'Invalid document type' });
      }

      // Validate token - simple HMAC-based token with expiry
      const crypto = await import('crypto');
      const expectedToken = crypto.createHmac('sha256', process.env.SESSION_SECRET || 'oakstreet-default-secret')
        .update(`${type}-${id}`)
        .digest('hex')
        .substring(0, 16);
      
      if (token !== expectedToken) {
        return res.status(403).json({ error: 'Invalid or expired link' });
      }

      // Get document info for filename
      let documentNumber = id;
      if (type === 'quote') {
        const estimate = await storage.getEstimate(id);
        if (estimate) documentNumber = estimate.number;
      } else if (type === 'invoice') {
        const invoice = await storage.getInvoice(id);
        if (invoice) documentNumber = invoice.number;
      }

      // Generate PDF
      const pdfBuffer = await generateDocumentPDF(type, id);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${documentNumber}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Public document download error:', error);
      res.status(500).json({ error: 'Failed to download document' });
    }
  });

  // Customer Portal - Specific endpoints (must be before catch-all)
  // These routes use token in Authorization header, not URL param
  
  // Get financial milestones for portal client
  app.get('/api/portal/financial-milestones', async (req, res) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token as string;
      if (!token) {
        return res.status(401).json({ error: 'Portal token required' });
      }
      
      const [lead] = await db.select().from(portalLeads).where(eq(portalLeads.portalToken, token));
      if (!lead) {
        return res.status(404).json({ error: 'Invalid portal token' });
      }
      
      const milestones = await db.select().from(portalFinancialMilestones)
        .where(eq(portalFinancialMilestones.portalLeadId, lead.id))
        .orderBy(portalFinancialMilestones.sortOrder);
      
      const totalAmount = milestones.reduce((sum, m) => sum + parseFloat(m.amount || '0'), 0);
      const paidAmount = milestones.reduce((sum, m) => sum + parseFloat(m.paidAmount || '0'), 0);
      const pendingAmount = totalAmount - paidAmount;
      const completedCount = milestones.filter(m => m.isPaid).length;
      
      res.json({
        milestones,
        summary: {
          totalAmount,
          paidAmount,
          pendingAmount,
          totalMilestones: milestones.length,
          completedMilestones: completedCount
        }
      });
    } catch (error: any) {
      console.error('Error fetching financial milestones:', error);
      res.status(500).json({ error: 'Failed to fetch financial milestones' });
    }
  });

  // Get estimate details for portal viewing
  app.get('/api/portal/estimate/:estimateId', async (req, res) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token as string;
      if (!token) {
        return res.status(401).json({ error: 'Portal token required' });
      }
      
      const [lead] = await db.select().from(portalLeads).where(eq(portalLeads.portalToken, token));
      if (!lead) {
        return res.status(404).json({ error: 'Invalid portal token' });
      }
      
      const { estimateId } = req.params;
      const estimate = await storage.getEstimate(estimateId);
      
      if (!estimate) {
        return res.status(404).json({ error: 'Estimate not found' });
      }
      
      const normalizePhone = (p: string) => p.replace(/\D/g, '').slice(-10);
      const leadPhoneNorm = normalizePhone(lead.phone || '');
      const leadWhatsappNorm = normalizePhone(lead.whatsappNumber || '');
      const estPhoneNorm = normalizePhone(estimate.customerPhone || estimate.customerWhatsapp || '');
      
      const phoneMatch = estPhoneNorm && (estPhoneNorm === leadPhoneNorm || estPhoneNorm === leadWhatsappNorm);
      const emailMatch = estimate.customerEmail && lead.email && estimate.customerEmail.toLowerCase() === lead.email.toLowerCase();
      const sharedToPortal = estimate.sharedToPortal === true;
      
      // Also allow access if estimate is directly linked to this lead via sharedEstimateId
      const isLinkedToLead = lead.sharedEstimateId === estimateId;
      
      if (!isLinkedToLead && (!sharedToPortal || (!phoneMatch && !emailMatch))) {
        return res.status(403).json({ error: 'Estimate not accessible' });
      }
      
      const settingsRow = await storage.getCompanySettings();
      
      res.json({
        estimate: {
          id: estimate.id,
          number: estimate.number,
          subject: estimate.subject,
          leadName: estimate.leadName,
          customerName: estimate.customerName,
          customerEmail: estimate.customerEmail,
          customerPhone: estimate.customerPhone,
          customerAddress: estimate.customerAddress,
          eventDate: estimate.eventDate,
          eventVenue: estimate.eventVenue,
          lineItems: estimate.lineItems,
          subtotal: estimate.subtotal,
          discount: estimate.discount,
          discountType: estimate.discountType,
          discountValue: estimate.discountValue,
          cgst: estimate.cgst,
          sgst: estimate.sgst,
          totalTax: estimate.totalTax,
          total: estimate.total,
          notes: estimate.notes,
          terms: estimate.terms,
          status: estimate.status,
          validUntil: estimate.validUntil,
          date: estimate.date || estimate.createdAt,
          createdAt: estimate.createdAt,
        },
        companySettings: settingsRow
      });
    } catch (error: any) {
      console.error('Error fetching portal estimate:', error);
      res.status(500).json({ error: 'Failed to fetch estimate' });
    }
  });

  // Get milestones for portal client (MUST be before catch-all :token route)
  app.get('/api/portal/milestones', async (req, res) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
      if (!token) {
        return res.status(401).json({ error: 'Portal token required' });
      }
      
      const [lead] = await db.select().from(portalLeads).where(eq(portalLeads.portalToken, token as string));
      if (!lead) {
        return res.status(404).json({ error: 'Invalid portal token' });
      }
      
      // Get phases with tasks
      const phases = await db.select().from(portalMilestonePhases)
        .where(eq(portalMilestonePhases.portalLeadId, lead.id))
        .orderBy(portalMilestonePhases.sortOrder);
      
      const phasesWithTasks = await Promise.all(phases.map(async (phase) => {
        const tasks = await db.select().from(portalMilestoneTasks)
          .where(eq(portalMilestoneTasks.phaseId, phase.id))
          .orderBy(portalMilestoneTasks.sortOrder);
        return { ...phase, tasks };
      }));
      
      // Calculate progress
      const allTasks = phasesWithTasks.flatMap(p => p.tasks);
      const completedTasks = allTasks.filter(t => t.isCompleted).length;
      const totalTasks = allTasks.length;
      const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      
      // Calculate countdown
      let countdown = null;
      if (lead.eventDate) {
        const eventDate = new Date(lead.eventDate);
        const today = new Date();
        const diffTime = eventDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        countdown = { days: diffDays, eventDate: lead.eventDate };
      }
      
      // Pending approvals
      const pendingApprovals = allTasks.filter(t => t.isApprovalRequired && t.approvalStatus === 'pending').length;
      
      res.json({
        lead: { id: lead.id, name: lead.name, eventDate: lead.eventDate, eventType: lead.eventType, venue: lead.venue },
        phases: phasesWithTasks,
        progress: { completed: completedTasks, total: totalTasks, percentage: overallProgress },
        countdown,
        pendingApprovals
      });
    } catch (error: any) {
      console.error('Error fetching portal milestones:', error);
      res.status(500).json({ error: 'Failed to fetch milestones' });
    }
  });

  // Get event flows for client portal (MUST be before catch-all :token route)
  app.get('/api/portal/event-flows', async (req, res) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
      if (!token) {
        return res.status(401).json({ error: 'Portal token required' });
      }
      
      const [lead] = await db.select().from(portalLeads).where(eq(portalLeads.portalToken, token as string));
      if (!lead) {
        return res.status(404).json({ error: 'Invalid portal token' });
      }
      
      // Get published event flows with items
      const flows = await db.select().from(portalEventFlows)
        .where(and(
          eq(portalEventFlows.portalLeadId, lead.id),
          eq(portalEventFlows.isPublished, true)
        ))
        .orderBy(portalEventFlows.sortOrder);
      
      const flowsWithItems = await Promise.all(flows.map(async (flow) => {
        const items = await db.select().from(portalEventFlowItems)
          .where(eq(portalEventFlowItems.eventFlowId, flow.id))
          .orderBy(portalEventFlowItems.sortOrder);
        return { ...flow, items };
      }));
      
      res.json({ eventFlows: flowsWithItems });
    } catch (error: any) {
      console.error('Error fetching event flows:', error);
      res.status(500).json({ error: 'Failed to fetch event flows' });
    }
  });

  // Download event flow as Excel for client portal
  app.get('/api/portal/event-flows/:flowId/download-excel', async (req, res) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
      if (!token) {
        return res.status(401).json({ error: 'Portal token required' });
      }
      
      const [lead] = await db.select().from(portalLeads).where(eq(portalLeads.portalToken, token as string));
      if (!lead) {
        return res.status(404).json({ error: 'Invalid portal token' });
      }
      
      const { flowId } = req.params;
      
      // Get the event flow
      const [flow] = await db.select().from(portalEventFlows)
        .where(and(
          eq(portalEventFlows.id, flowId),
          eq(portalEventFlows.portalLeadId, lead.id),
          eq(portalEventFlows.isPublished, true)
        ));
      
      if (!flow) {
        return res.status(404).json({ error: 'Event flow not found' });
      }
      
      // Get flow items
      const items = await db.select().from(portalEventFlowItems)
        .where(eq(portalEventFlowItems.eventFlowId, flowId))
        .orderBy(portalEventFlowItems.sortOrder);
      
      // Create Excel workbook
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Oakstreet Events';
      workbook.created = new Date();
      
      const worksheet = workbook.addWorksheet('Event Flow');
      
      // Add logo at the top
      try {
        const logoPath = path.join(process.cwd(), 'client', 'public', 'oakstreet-logo.jpg');
        if (fs.existsSync(logoPath)) {
          const logoId = workbook.addImage({
            filename: logoPath,
            extension: 'jpeg',
          });
          worksheet.addImage(logoId, {
            tl: { col: 0, row: 0 },
            ext: { width: 180, height: 60 }
          });
          // Add blank rows for logo space
          worksheet.addRow([]);
          worksheet.addRow([]);
          worksheet.addRow([]);
        }
      } catch (logoError) {
        console.error('Error adding logo:', logoError);
        // Continue without logo if there's an error
      }
      
      // Add event title header
      const eventTitle = `Event: ${flow.eventName}${flow.venue ? ` (${flow.venue})` : ''}`;
      const eventDate = flow.eventDate ? `Date: ${new Date(flow.eventDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}` : '';
      
      const titleRow = worksheet.addRow([eventTitle, '', eventDate]);
      titleRow.font = { bold: true, size: 14 };
      titleRow.height = 25;
      worksheet.mergeCells(titleRow.number, 1, titleRow.number, 2);
      
      // Add blank row
      worksheet.addRow([]);
      
      // Add headers
      const headerRow = worksheet.addRow(['SL NO', 'ACTIVITY', 'TIME']);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4b7c29' } // Oak Green
      };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
      headerRow.height = 25;
      
      // Set column widths
      worksheet.getColumn(1).width = 10;
      worksheet.getColumn(2).width = 60;
      worksheet.getColumn(3).width = 20;
      
      // Add items
      items.forEach((item, index) => {
        const timeStr = item.startTime + (item.endTime ? ` to ${item.endTime}` : '');
        const row = worksheet.addRow([index + 1, item.title, timeStr]);
        row.alignment = { vertical: 'middle' };
        row.height = 22;
        
        // Alternate row colors
        if (index % 2 === 0) {
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFe8f5e9' } // Light green
          };
        }
        
        // Add borders
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFcccccc' } },
            left: { style: 'thin', color: { argb: 'FFcccccc' } },
            bottom: { style: 'thin', color: { argb: 'FFcccccc' } },
            right: { style: 'thin', color: { argb: 'FFcccccc' } }
          };
        });
      });
      
      // Add footer
      worksheet.addRow([]);
      const footerRow = worksheet.addRow(['', 'Oakstreet Events - Making Your Dreams Come True', '']);
      footerRow.font = { italic: true, color: { argb: 'FF666666' } };
      footerRow.alignment = { horizontal: 'center' };
      worksheet.mergeCells(footerRow.number, 1, footerRow.number, 3);
      
      // Generate filename
      const safeName = flow.eventName.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${safeName}_Event_Flow.xlsx`;
      
      // Set response headers
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      // Write to response
      await workbook.xlsx.write(res);
      res.end();
    } catch (error: any) {
      console.error('Error generating event flow Excel:', error);
      res.status(500).json({ error: 'Failed to generate Excel file' });
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

      const safeDocument = link.documentType === 'estimate' ? stripInternalCostData(document) : document;

      res.json({
        link,
        document: safeDocument,
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

      const result = await sendGeneralNotification(phoneNumber, slip.employeeName || 'Employee', message);

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

  app.get('/api/sales/deals/estimate-values', async (req, res) => {
    try {
      const allDeals = await storage.getAllSalesDeals();
      const allEstimates = await db.select({
        id: estimatesTable.id,
        number: estimatesTable.number,
        total: estimatesTable.total,
        leadName: estimatesTable.leadName,
        customerPhone: estimatesTable.customerPhone,
        createdAt: estimatesTable.createdAt,
      }).from(estimatesTable).orderBy(desc(estimatesTable.createdAt));

      const dealEstimateMap: Record<string, { total: string; estimateNumber: string; estimateId: string }> = {};

      for (const deal of allDeals) {
        const dealNamePart = deal.title?.split(' - ')[0]?.trim().toLowerCase();
        if (!dealNamePart) continue;

        const matchingEstimate = allEstimates.find(e => {
          if (!e.leadName) return false;
          const estNamePart = e.leadName.split(' - ')[0]?.trim().toLowerCase();
          return estNamePart === dealNamePart;
        });

        if (matchingEstimate) {
          dealEstimateMap[deal.id] = {
            total: matchingEstimate.total?.toString() || '0',
            estimateNumber: matchingEstimate.number,
            estimateId: matchingEstimate.id,
          };
        }
      }

      res.json(dealEstimateMap);
    } catch (error) {
      console.error('Error fetching deal estimate values:', error);
      res.status(500).json({ error: 'Failed to fetch estimate values' });
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
                
                await sendGeneralNotification(plannerPhone, owner.name, message, 'sales_deal_creation', deal.id);
                console.log(`[Sales] WhatsApp notification sent to ${owner.name} for new deal`);
              }
            }
          }
        } catch (notifyError) {
          console.error('[Sales] Failed to send WhatsApp notification:', notifyError);
          // Don't fail the deal creation if notification fails
        }
      }
      
      // Notify superadmins about the new CRM deal
      try {
        const contact = deal.contactId ? await storage.getSalesContact(deal.contactId) : null;
        const dealName = contact ? `${contact.firstName} ${contact.lastName}`.trim() : (deal.title || 'New Deal');
        const dealPhone = contact?.phone || contact?.mobile || 'N/A';
        await notifyNewLeadToSuperadmins(dealName, dealPhone, '', 'crm');
      } catch (notifyError) {
        console.error('[Sales] Failed to send push notification for new deal:', notifyError);
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
      
      // If stageId is being updated, record stage change timestamp and check stage type
      if (updateData.stageId && updateData.stageId !== existingDeal?.stageId) {
        updateData.stageChangedAt = new Date();
        updateData.lastStaleNotificationAt = null;
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
                
                await sendGeneralNotification(accountantPhone, 'Sabitha', message);
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

      if (deal && deal.status === 'won' && !deal.convertedToCustomer) {
        try {
          const ownerUser = deal.ownerId ? await storage.getUser(deal.ownerId) : null;
          const plannerName = ownerUser?.name || 'TBD';
          const todayStr = new Date().toISOString().split('T')[0];

          const newEvent = await storage.createEvent({
            title: deal.title,
            date: deal.eventDate || todayStr,
            type: deal.eventType || 'wedding',
            customer: deal.title,
            venue: deal.venue || 'TBD',
            planner: plannerName,
            salesValue: deal.value || '0',
            status: 'confirmed',
          });

          await storage.updateSalesDeal(dealId, { convertedToCustomer: true });

          const superadmins = await storage.getUsersByRole('superadmin');
          for (const admin of superadmins) {
            await sendPushToUser(admin.id, {
              title: '🎉 Deal Won - Event Created',
              body: `Deal "${deal.title}" won! Event auto-created.`,
              actionUrl: '/event-database',
              type: 'success',
              sound: true,
            });
          }

          console.log(`[Deal Won] Auto-created event "${newEvent.title}" from deal "${deal.title}"`);
        } catch (autoErr) {
          console.error('[Deal Won] Failed to auto-create event:', autoErr);
        }
      }

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

  // Generate unique SKU for inventory items
  app.get('/api/inventory/next-sku', async (req, res) => {
    try {
      const sku = await storage.generateInventorySku();
      res.json({ sku });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to generate SKU' });
    }
  });

  app.post('/api/inventory/items', async (req, res) => {
    const MAX_RETRIES = 3;
    let lastError: any = null;
    
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // Auto-generate unique SKU if not provided or if it starts with old auto-generated prefix
        let itemData = { ...req.body };
        if (!itemData.sku || itemData.sku.startsWith('SKU-')) {
          itemData.sku = await storage.generateInventorySku();
        }
        
        console.log('[/api/inventory/items POST] Creating item (attempt', attempt + 1, '):', JSON.stringify(itemData));
        const item = await storage.createInventoryItem(itemData);
        console.log('[/api/inventory/items POST] Created successfully:', item.id);
        return res.json(item);
      } catch (error: any) {
        lastError = error;
        console.error('[/api/inventory/items POST] Error (attempt', attempt + 1, '):', error?.message || error);
        
        // If it's a duplicate SKU error on auto-generated SKU, retry with new SKU
        const isDuplicateSku = error?.message?.includes('duplicate key') && error?.message?.includes('sku');
        const isAutoGeneratedSku = !req.body.sku || req.body.sku.startsWith('SKU-');
        
        if (isDuplicateSku && isAutoGeneratedSku && attempt < MAX_RETRIES - 1) {
          console.log('[/api/inventory/items POST] Retrying with new auto-generated SKU...');
          continue; // Retry with new auto-generated SKU
        }
        
        // If duplicate on user-provided SKU or max retries reached, fail
        if (isDuplicateSku) {
          return res.status(400).json({ 
            error: 'Failed to create inventory item', 
            details: 'An item with this SKU already exists. Please use a different SKU or leave it blank for auto-generation.' 
          });
        }
        
        return res.status(400).json({ error: 'Failed to create inventory item', details: error?.message });
      }
    }
    
    // Should not reach here, but just in case
    res.status(500).json({ error: 'Failed to create inventory item after multiple attempts', details: lastError?.message });
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

  // Inventory Purchases (Stock IN)
  app.get('/api/inventory/purchases', async (req, res) => {
    const { itemId } = req.query;
    if (itemId) {
      const purchases = await storage.getInventoryPurchasesByItemId(itemId as string);
      res.json(purchases);
    } else {
      const purchases = await storage.getAllInventoryPurchases();
      res.json(purchases);
    }
  });

  app.get('/api/inventory/purchases/:id', async (req, res) => {
    const purchase = await storage.getInventoryPurchase(req.params.id);
    if (!purchase) return res.status(404).json({ error: 'Purchase not found' });
    res.json(purchase);
  });

  app.post('/api/inventory/purchases', async (req, res) => {
    try {
      const purchase = await storage.createInventoryPurchase(req.body);
      res.json(purchase);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to create purchase' });
    }
  });

  app.delete('/api/inventory/purchases/:id', async (req, res) => {
    try {
      await storage.deleteInventoryPurchase(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to delete purchase' });
    }
  });

  // Average Cost Calculation
  app.get('/api/inventory/items/:id/average-cost', async (req, res) => {
    try {
      const cost = await storage.calculateAverageCost(req.params.id);
      res.json(cost);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to calculate average cost' });
    }
  });

  // Inventory Ledger (Audit Trail)
  app.get('/api/inventory/ledger', async (req, res) => {
    const { itemId, eventId, type, startDate, endDate } = req.query;
    const ledger = await storage.getInventoryLedger({
      itemId: itemId as string,
      eventId: eventId as string,
      type: type as string,
      startDate: startDate as string,
      endDate: endDate as string,
    });
    res.json(ledger);
  });

  // Issue Inventory to Event
  app.post('/api/inventory/issue', async (req, res) => {
    try {
      const { itemId, eventId, quantity, issuedBy, purpose } = req.body;
      if (!itemId || !eventId || !quantity || !issuedBy) {
        return res.status(400).json({ error: 'Missing required fields: itemId, eventId, quantity, issuedBy' });
      }
      await storage.issueInventoryToEvent(itemId, eventId, quantity, issuedBy, purpose);
      res.json({ success: true, message: 'Inventory issued successfully' });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to issue inventory' });
    }
  });

  // Return Inventory from Event
  app.post('/api/inventory/return', async (req, res) => {
    try {
      const { itemId, eventId, quantity, condition, returnedBy, notes } = req.body;
      if (!itemId || !eventId || !quantity || !condition || !returnedBy) {
        return res.status(400).json({ error: 'Missing required fields: itemId, eventId, quantity, condition, returnedBy' });
      }
      await storage.returnInventoryFromEvent(itemId, eventId, quantity, condition, returnedBy, notes);
      res.json({ success: true, message: 'Inventory returned successfully' });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to return inventory' });
    }
  });

  // Low Stock Alerts
  app.get('/api/inventory/low-stock', async (req, res) => {
    try {
      const items = await storage.getLowStockItems();
      res.json(items);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to get low stock items' });
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
        const pdfjs = await getPdfJs();
        const loadingTask = pdfjs.getDocument({ data: pdfUint8Array });
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
            
            await sendGeneralNotification(employee.phone, employee.name, staffMessage);

            // Send Oaksy push notification to staff (find user by matching name/phone)
            try {
              const allUsers = await storage.getAllUsers();
              const staffUser = allUsers.find(u => 
                u.phone === employee.phone || 
                (u.name && employee.name && u.name.toLowerCase() === employee.name.toLowerCase())
              );
              if (staffUser) {
                const eventDate = event.date ? new Date(event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'TBD';
                await notifyStaffAssigned(staffUser.id, employee.name, event.title, eventDate, assignment.role);
              }
            } catch (pushErr) {
              console.error(`[Automation] Push notification failed for staff ${employee.name}:`, pushErr);
            }
            
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
            await sendGeneralNotification(plannerPhone, event.planner || 'Supervisor', supervisorMessage, 'staff_assignment');
            
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
  // Serve public portfolio images
  app.get("/api/objects/public/:objectPath(*)", async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const filePath = req.params.objectPath;
      const objectFile = await objectStorageService.searchPublicObject(filePath);
      if (!objectFile) {
        return res.sendStatus(404);
      }
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error fetching public object:", error);
      return res.sendStatus(500);
    }
  });
  
  // Serve private objects (legacy route)
  app.get("/api/objects/:objectPath(*)", async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const internalPath = `/objects/${req.params.objectPath}`;
      const objectFile = await objectStorageService.getObjectEntityFile(internalPath);
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
    
    // Only allow Superadmin or accountant Sabitha to sync events to calendar
    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser) {
      return res.status(401).json({ error: 'User not found' });
    }
    const isSuperadmin = currentUser.role === 'superadmin';
    const isSabitha = currentUser.role === 'accountant' && currentUser.username.toLowerCase() === 'sabitha';
    if (!isSuperadmin && !isSabitha) {
      return res.status(403).json({ error: 'Only Superadmin or Sabitha can sync events to calendar' });
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
    
    // Only allow Superadmin or accountant Sabitha to sync events to calendar
    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser) {
      return res.status(401).json({ error: 'User not found' });
    }
    const isSuperadmin = currentUser.role === 'superadmin';
    const isSabitha = currentUser.role === 'accountant' && currentUser.username.toLowerCase() === 'sabitha';
    if (!isSuperadmin && !isSabitha) {
      return res.status(403).json({ error: 'Only Superadmin or Sabitha can sync events to calendar' });
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
    
    // Only allow Superadmin or accountant Sabitha to delete events from calendar
    const currentUser = await storage.getUser(req.session.userId);
    if (!currentUser) {
      return res.status(401).json({ error: 'User not found' });
    }
    const isSuperadmin = currentUser.role === 'superadmin';
    const isSabitha = currentUser.role === 'accountant' && currentUser.username.toLowerCase() === 'sabitha';
    if (!isSuperadmin && !isSabitha) {
      return res.status(403).json({ error: 'Only Superadmin or Sabitha can manage calendar events' });
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
      const { content, inputType, image } = req.body;
      if (!content && !image) {
        return res.status(400).json({ error: 'Message content or image is required' });
      }

      const conversation = await storage.getOaksyConversation(req.params.id);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }
      if (conversation.userId !== req.session.userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Save user message (store small image thumbnail in metadata for display)
      await storage.createOaksyMessage({
        conversationId: req.params.id,
        role: 'user',
        content: content || 'Sent an image',
        inputType: inputType || 'text',
        metadata: image ? { hasImage: true } : null,
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
      
      // Build context for AI — filtered by user role and permissions
      const isSuperadminOrAdmin = user.role === 'superadmin' || user.role === 'admin';
      const hasFinancialAccess = isSuperadminOrAdmin || allowedPages.some(p => ['daybook', 'oak-book'].includes(p));
      const hasHRAccess = isSuperadminOrAdmin || allowedPages.includes('hr');
      const hasEventAccess = isSuperadminOrAdmin || allowedPages.some(p => ['event-calendar', 'event-database', 'event-milestones', 'oak-sales'].includes(p));

      // Events: superadmin/admin see all, wedding planners see their events, others see events they're involved in
      let events: any[] = [];
      if (hasEventAccess) {
        const allEvents = await storage.getAllEvents();
        if (isSuperadminOrAdmin) {
          events = allEvents;
        } else if (user.role === 'wedding_planner') {
          events = allEvents.filter((e: any) => 
            e.planner?.toLowerCase().includes(user.name.toLowerCase()) ||
            user.name.toLowerCase().includes(e.planner?.toLowerCase()?.split(' ')[0] || '')
          );
        } else {
          events = allEvents.filter((e: any) => {
            const staffList = e.assignedStaff || [];
            return Array.isArray(staffList) && staffList.some((s: any) => s.employeeId === user.id || s.name?.toLowerCase() === user.name.toLowerCase());
          });
        }
      }

      // Employees: only superadmin/admin/HR see employee list
      let employees: any[] = [];
      if (hasHRAccess) {
        employees = await storage.getAllEmployees();
      }

      // Financial data: only users with financial access see banks, daybook
      let banks: any[] = [];
      let daybookCategories: any[] = [];
      let daybookSummary = undefined;
      if (hasFinancialAccess) {
        banks = await storage.getAllBanks();
        daybookCategories = await storage.getAllDaybookCategories();
        
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
        daybookSummary = {
          totalIncome,
          totalExpense,
          balance: totalIncome - totalExpense,
        };
      }

      const context = {
        userId: req.session.userId,
        userName: user.name || user.username,
        userRole: user.role,
        allowedPages,
        department: conversation.department || undefined,
        events,
        employees,
        banks,
        daybookCategories,
        daybookSummary,
      };
      const aiResult = await generateOaksyResponse(
        req.params.id,
        content || 'Please analyze this image',
        context,
        conversation.department || 'general',
        image || undefined
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
      
      await sendGeneralNotification(
        employeePhone,
        employee.name,
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

    try {
      await sendPushToUsers(targetUserIds, {
        title: title || 'Oakstreet Events',
        body: message,
        actionUrl,
        notificationId: notification.id,
        type: type || 'info',
        sound: true,
      });
    } catch (pushErr) {
      console.error('[Broadcast] Push notification error:', pushErr);
    }
    
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

  // VAPID Public Key endpoint
  app.get('/api/push/vapid-key', (req, res) => {
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || '' });
  });

  // Test push notification (superadmin only)
  app.post('/api/push/test', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Superadmin only' });
    }
    
    const { targetUserId } = req.body;
    const targetId = targetUserId || req.session.userId;
    const targetUser = await storage.getUser(targetId);
    
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    try {
      const { sendOaksyNotification } = await import('./push-notification-service');
      await sendOaksyNotification(
        targetId,
        targetUser.name || 'Team Member',
        'this is a test notification from Oaksy! 🎉 Your push notifications are working perfectly.',
        '/dashboard',
        'success'
      );
      res.json({ success: true, message: `Test notification sent to ${targetUser.name}` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
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
    
    await storage.deletePushSubscriptionByEndpoint(endpoint);
    
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

  // ===== Portal Lead API Endpoints =====
  
  // Submit a new portal lead (public endpoint, no auth required)
  app.post('/api/portal/leads', async (req, res) => {
    try {
      // Validate required fields
      const portalLeadSchema = z.object({
        name: z.string().min(1, "Name is required"),
        email: z.string().email("Valid email is required"),
        phone: z.string().min(1, "Phone is required"),
        whatsappNumber: z.string().min(1, "WhatsApp number is required"),
        address: z.string().optional().nullable(),
        city: z.string().optional().nullable(),
        eventDate: z.string().optional().nullable(),
        eventType: z.string().optional().nullable(),
        venue: z.string().optional().nullable(),
        venueCity: z.string().optional().nullable(),
        guestCount: z.number().optional().nullable(),
        budgetRange: z.string().optional().nullable(),
        servicesRequired: z.array(z.string()).optional().default([]),
        additionalNotes: z.string().optional().nullable(),
        termsAccepted: z.literal(true, { errorMap: () => ({ message: "You must accept the terms and conditions" }) }),
      });
      
      const parseResult = portalLeadSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: parseResult.error.errors[0]?.message || 'Validation failed' });
      }
      
      const { name, email, phone, whatsappNumber, address, city, eventDate, eventType, venue, venueCity, guestCount, budgetRange, servicesRequired, additionalNotes, termsAccepted } = parseResult.data;
      
      // Generate 6-digit OTP
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      
      // Insert portal lead
      const [lead] = await db.insert(portalLeads).values({
        name,
        email,
        phone,
        whatsappNumber,
        address: address || null,
        city: city || null,
        eventDate: eventDate || null,
        eventType: eventType || null,
        venue: venue || null,
        venueCity: venueCity || null,
        guestCount: guestCount || null,
        budgetRange: budgetRange || null,
        servicesRequired: servicesRequired || [],
        additionalNotes: additionalNotes || null,
        termsAccepted,
        otpCode,
        otpExpiresAt,
        phase: 'submitted',
      }).returning();
      
      // Send OTP via WhatsApp using approved template (works outside 24h window)
      if (isWhatsAppConfigured()) {
        const result = await sendOTPNotification(whatsappNumber, otpCode);
        if (!result.success) {
          console.error('Failed to send OTP:', result.error);
          console.log('[Submit Lead] Template status:', getTemplateStatus());
        }
        
        // Note: Superadmin notifications are sent only after OTP verification (not here)
        // to avoid duplicate notifications for unverified leads
      }
      
      res.json({ id: lead.id, message: 'OTP sent to your WhatsApp' });
    } catch (error: any) {
      console.error('Portal lead submission error:', error);
      res.status(500).json({ error: 'Failed to submit lead' });
    }
  });
  
  // Verify OTP
  app.post('/api/portal/verify-otp', async (req, res) => {
    try {
      const { leadId, otp } = req.body;
      
      if (!leadId || !otp) {
        return res.status(400).json({ error: 'Lead ID and OTP are required' });
      }
      
      const [lead] = await db.select().from(portalLeads).where(eq(portalLeads.id, leadId));
      
      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }
      
      if (lead.otpVerified) {
        return res.status(400).json({ error: 'OTP already verified' });
      }
      
      if (!lead.otpExpiresAt || new Date() > new Date(lead.otpExpiresAt)) {
        return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
      }
      
      if (lead.otpCode !== otp) {
        return res.status(400).json({ error: 'Invalid OTP' });
      }
      
      // Generate portal token for future access
      const portalToken = `pt_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      const portalTokenExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year
      
      // Update lead as verified
      await db.update(portalLeads)
        .set({ 
          otpVerified: true, 
          otpCode: null,
          portalToken,
          portalTokenExpiresAt,
          updatedAt: new Date(),
        })
        .where(eq(portalLeads.id, leadId));
      
      // Notify superadmins about verified lead (WhatsApp + Push)
      try {
        const superadmins = await storage.getUsersByRole('superadmin');
        const eventTypeLabelMap: Record<string, string> = {
          'hindu_wedding': 'Hindu Wedding',
          'christian_wedding': 'Christian Wedding',
          'muslim_wedding': 'Muslim Wedding',
          'engagement': 'Engagement',
          'reception': 'Reception',
          'sangeet': 'Sangeet/Mehendi',
          'haldi': 'Haldi',
          'corporate': 'Corporate Event',
          'birthday': 'Birthday Party',
          'house_warming': 'House Warming',
          'other': 'Other',
        };
        const eventTypeLabel = lead.eventType ? eventTypeLabelMap[lead.eventType] || lead.eventType : 'Not specified';
        
        if (isWhatsAppConfigured()) {
          const notificationMessage = `🌿 *New Client Portal Enquiry*\n\n` +
            `*Name:* ${lead.name}\n` +
            `*Phone:* ${lead.phone}\n` +
            `*WhatsApp:* ${lead.whatsappNumber}\n` +
            `*Email:* ${lead.email}\n` +
            `*Event Type:* ${eventTypeLabel}\n` +
            `*Event Date:* ${lead.eventDate || 'Not specified'}\n` +
            `*Venue:* ${lead.venue || 'Not specified'}\n` +
            `*Budget:* ${lead.budgetRange || 'Not specified'}\n\n` +
            `Please assign a planner from the CRM.`;
          
          for (const admin of superadmins) {
            if (admin.phone) {
              await sendGeneralNotification(admin.phone, admin.name || 'Admin', notificationMessage);
            }
          }
        }

        const eventDateStr = lead.eventDate ? new Date(lead.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'TBD';
        for (const admin of superadmins) {
          const { sendOaksyNotification } = await import('./push-notification-service');
          await sendOaksyNotification(
            admin.id,
            admin.name || 'Admin',
            `New verified enquiry from ${lead.name}! ${eventTypeLabel} on ${eventDateStr}. Check Oak Sales to assign a planner.`,
            '/oak-sales',
            'success'
          );
        }
      } catch (notifyError) {
        console.error('[Portal Lead] Failed to notify superadmins after OTP verification:', notifyError);
      }

      // Send confirmation email to the client
      try {
        const { sendEmail, isEmailConfigured } = await import('./email-service');
        if (await isEmailConfigured()) {
          const eventTypeLabelMap: Record<string, string> = {
            'hindu_wedding': 'Hindu Wedding',
            'christian_wedding': 'Christian Wedding',
            'muslim_wedding': 'Muslim Wedding',
            'engagement': 'Engagement',
            'reception': 'Reception',
            'sangeet': 'Sangeet/Mehendi',
            'haldi': 'Haldi',
            'corporate': 'Corporate Event',
            'birthday': 'Birthday Party',
            'house_warming': 'House Warming',
            'other': 'Other',
          };
          const eventTypeLabel = lead.eventType ? eventTypeLabelMap[lead.eventType] || lead.eventType : 'your event';
          const eventDateFormatted = lead.eventDate 
            ? new Date(lead.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
            : null;

          const confirmationHtml = `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
              <div style="background: #4b7c29; padding: 30px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Oakstreet Events</h1>
                <p style="color: #d4e8c4; margin: 8px 0 0 0; font-size: 14px;">Creating Memorable Experiences</p>
              </div>
              <div style="padding: 30px;">
                <h2 style="color: #2d5a3d; margin-top: 0;">Thank you for your enquiry, ${lead.name}!</h2>
                <p style="color: #333; line-height: 1.6;">We're delighted that you're considering Oakstreet Events for your ${eventTypeLabel}. Your enquiry has been received and verified successfully.</p>
                
                <div style="background: #f5f9f2; border-left: 4px solid #4b7c29; padding: 15px 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                  <h3 style="color: #4b7c29; margin: 0 0 10px 0; font-size: 16px;">Your Enquiry Details</h3>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr><td style="padding: 4px 0; color: #666; width: 120px;">Event Type:</td><td style="padding: 4px 0; color: #333; font-weight: 500;">${eventTypeLabel}</td></tr>
                    ${eventDateFormatted ? `<tr><td style="padding: 4px 0; color: #666;">Event Date:</td><td style="padding: 4px 0; color: #333; font-weight: 500;">${eventDateFormatted}</td></tr>` : ''}
                    ${lead.venue ? `<tr><td style="padding: 4px 0; color: #666;">Venue:</td><td style="padding: 4px 0; color: #333; font-weight: 500;">${lead.venue}</td></tr>` : ''}
                    ${lead.guestCount ? `<tr><td style="padding: 4px 0; color: #666;">Guest Count:</td><td style="padding: 4px 0; color: #333; font-weight: 500;">${lead.guestCount}</td></tr>` : ''}
                  </table>
                </div>

                <h3 style="color: #2d5a3d; font-size: 16px;">What happens next?</h3>
                <ol style="color: #333; line-height: 1.8; padding-left: 20px;">
                  <li>A dedicated wedding planner from our team will be assigned to you shortly.</li>
                  <li>They will reach out to you via WhatsApp or phone to schedule a consultation.</li>
                  <li>Together, we'll bring your vision to life!</li>
                </ol>

                <p style="color: #333; line-height: 1.6;">In the meantime, feel free to browse our portfolio and explore our services on the <a href="https://portal.oakstreetevent.com" style="color: #4b7c29; font-weight: 500;">client portal</a>.</p>

                <p style="color: #333; line-height: 1.6;">If you have any questions, don't hesitate to reach out to us.</p>
                
                <p style="color: #333;">Warm regards,<br/><strong style="color: #2d5a3d;">Team Oakstreet Events</strong></p>
              </div>
              <div style="background: #f8f8f8; padding: 20px 30px; text-align: center; border-top: 1px solid #eee;">
                <p style="color: #999; font-size: 12px; margin: 0;">Oakstreet Events | Creating Memorable Experiences</p>
                <p style="color: #999; font-size: 12px; margin: 5px 0 0 0;">This is an automated confirmation email. Please do not reply to this email.</p>
              </div>
            </div>
          `;

          const emailResult = await sendEmail({
            to: lead.email,
            subject: `Thank you for your enquiry - Oakstreet Events`,
            html: confirmationHtml,
          });

          if (emailResult.success) {
            console.log(`[Portal Lead] Confirmation email sent to ${lead.email}`);
          } else {
            console.error(`[Portal Lead] Failed to send confirmation email:`, emailResult.error);
          }
        }
      } catch (emailError) {
        console.error('[Portal Lead] Error sending confirmation email:', emailError);
      }
      
      res.json({ success: true, portalToken });
    } catch (error: any) {
      console.error('OTP verification error:', error);
      res.status(500).json({ error: 'Failed to verify OTP' });
    }
  });
  
  // Resend OTP
  app.post('/api/portal/resend-otp', async (req, res) => {
    try {
      const { leadId } = req.body;
      
      if (!leadId) {
        return res.status(400).json({ error: 'Lead ID is required' });
      }
      
      const [lead] = await db.select().from(portalLeads).where(eq(portalLeads.id, leadId));
      
      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }
      
      if (lead.otpVerified) {
        return res.status(400).json({ error: 'OTP already verified' });
      }
      
      // Generate new OTP
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      
      await db.update(portalLeads)
        .set({ otpCode, otpExpiresAt, updatedAt: new Date() })
        .where(eq(portalLeads.id, leadId));
      
      // Send OTP via WhatsApp using template (works outside 24h window)
      if (isWhatsAppConfigured()) {
        const result = await sendOTPNotification(lead.whatsappNumber, otpCode);
        if (!result.success) {
          console.log('[Resend OTP] WhatsApp send failed:', result.error);
          console.log('[Resend OTP] Template status:', getTemplateStatus());
        }
      }
      
      res.json({ success: true, message: 'OTP resent' });
    } catch (error: any) {
      console.error('Resend OTP error:', error);
      res.status(500).json({ error: 'Failed to resend OTP' });
    }
  });

  // ============================================
  // Portal Client Inputs Endpoints
  // ============================================

  // Get client inputs for a lead (client view)
  app.get('/api/portal/client-inputs/:portalToken', async (req, res) => {
    try {
      const { portalToken } = req.params;
      const [lead] = await db.select().from(portalLeads).where(eq(portalLeads.portalToken, portalToken));
      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }
      const inputs = await db.select().from(portalClientInputs)
        .where(eq(portalClientInputs.portalLeadId, lead.id))
        .orderBy(sql`created_at DESC`);
      res.json(inputs);
    } catch (error: any) {
      console.error('Error fetching client inputs:', error);
      res.status(500).json({ error: 'Failed to fetch client inputs' });
    }
  });

  // Create client input (client can submit)
  app.post('/api/portal/client-inputs/:portalToken', async (req, res) => {
    try {
      const { portalToken } = req.params;
      const { inputType, title, content, urls } = req.body;
      
      const [lead] = await db.select().from(portalLeads).where(eq(portalLeads.portalToken, portalToken));
      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }
      
      const [input] = await db.insert(portalClientInputs).values({
        portalLeadId: lead.id,
        inputType,
        title,
        content,
        urls: urls || [],
        status: 'pending'
      }).returning();
      
      // Notify assigned wedding planner and superadmin about new client input
      try {
        const inputTypeLabel = inputType === 'stage_decor' ? 'Stage Decor Reference' :
                               inputType === 'audio' ? 'Audio/Music Track' :
                               inputType === 'pinterest' ? 'Pinterest Board' :
                               inputType === 'photo' ? 'Photo Reference' : 'Creative Input';
        
        const notifyNumbers: string[] = [];
        
        // Get assigned wedding planner's phone
        if (lead.assignedWeddingPlannerId) {
          const [planner] = await db.select().from(users).where(eq(users.id, lead.assignedWeddingPlannerId));
          if (planner?.phone) {
            notifyNumbers.push(planner.phone);
          }
        }
        
        // Add superadmin notification
        const [superadmin] = await db.select().from(users).where(eq(users.role, 'superadmin'));
        if (superadmin?.phone && !notifyNumbers.includes(superadmin.phone)) {
          notifyNumbers.push(superadmin.phone);
        }
        
        // Send notifications using the mandated template SID
        const NOTIFICATION_TEMPLATE_SID = 'HX1b2900b9bd4549299a3defe00c2785ec';
        for (const phone of notifyNumbers) {
          await sendWhatsAppTemplate(
            phone,
            NOTIFICATION_TEMPLATE_SID,
            {
              '1': `New ${inputTypeLabel} from ${lead.name}`,
              '2': title || 'Client shared new creative content',
              '3': `Event: ${lead.eventType || 'Wedding'}`,
              '4': 'Check Oak Sales for details'
            }
          );
        }
      } catch (notifyError) {
        console.error('Failed to send creative input notification:', notifyError);
      }
      
      res.json(input);
    } catch (error: any) {
      console.error('Error creating client input:', error);
      res.status(500).json({ error: 'Failed to create client input' });
    }
  });

  // Delete client input
  app.delete('/api/portal/client-inputs/:portalToken/:inputId', async (req, res) => {
    try {
      const { portalToken, inputId } = req.params;
      const [lead] = await db.select().from(portalLeads).where(eq(portalLeads.portalToken, portalToken));
      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }
      await db.delete(portalClientInputs)
        .where(and(eq(portalClientInputs.id, inputId), eq(portalClientInputs.portalLeadId, lead.id)));
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting client input:', error);
      res.status(500).json({ error: 'Failed to delete client input' });
    }
  });

  // ============================================
  // Portal Feedback Endpoints
  // ============================================

  // Get feedback by event ID (for admin view in Event Database)
  app.get('/api/events/:eventId/feedback', async (req, res) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const { eventId } = req.params;
      
      // Find portal leads linked to this event
      const leads = await db.select().from(portalLeads)
        .where(eq(portalLeads.eventId, eventId));
      
      if (leads.length === 0) {
        return res.json(null);
      }
      
      // Get feedback for each lead
      const feedbackList = await Promise.all(
        leads.map(async (lead) => {
          const [feedback] = await db.select().from(portalFeedback)
            .where(eq(portalFeedback.portalLeadId, lead.id));
          return feedback ? { ...feedback, clientName: lead.name, clientEmail: lead.email } : null;
        })
      );
      
      // Return the first feedback found (typically one per event)
      const feedback = feedbackList.find(f => f !== null);
      res.json(feedback || null);
    } catch (error: any) {
      console.error('Error fetching event feedback:', error);
      res.status(500).json({ error: 'Failed to fetch feedback' });
    }
  });

  // Get feedback for a lead
  app.get('/api/portal/feedback/:portalToken', async (req, res) => {
    try {
      const { portalToken } = req.params;
      const [lead] = await db.select().from(portalLeads).where(eq(portalLeads.portalToken, portalToken));
      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }
      const [feedback] = await db.select().from(portalFeedback)
        .where(eq(portalFeedback.portalLeadId, lead.id));
      res.json(feedback || null);
    } catch (error: any) {
      console.error('Error fetching feedback:', error);
      res.status(500).json({ error: 'Failed to fetch feedback' });
    }
  });

  // Submit/update feedback
  app.post('/api/portal/feedback/:portalToken', async (req, res) => {
    try {
      const { portalToken } = req.params;
      const { overallRating, planningRating, executionRating, communicationRating, decorRating, comments, suggestions, wouldRecommend, testimonial } = req.body;
      
      const [lead] = await db.select().from(portalLeads).where(eq(portalLeads.portalToken, portalToken));
      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }
      
      // Check if feedback already exists
      const [existing] = await db.select().from(portalFeedback)
        .where(eq(portalFeedback.portalLeadId, lead.id));
      
      if (existing) {
        // Update existing feedback
        const [updated] = await db.update(portalFeedback)
          .set({
            overallRating,
            planningRating,
            executionRating,
            communicationRating,
            decorRating,
            comments,
            suggestions,
            wouldRecommend,
            testimonial,
            updatedAt: new Date()
          })
          .where(eq(portalFeedback.id, existing.id))
          .returning();
        res.json(updated);
      } else {
        // Create new feedback
        const [feedback] = await db.insert(portalFeedback).values({
          portalLeadId: lead.id,
          overallRating,
          planningRating,
          executionRating,
          communicationRating,
          decorRating,
          comments,
          suggestions,
          wouldRecommend,
          testimonial
        }).returning();
        res.json(feedback);
      }
    } catch (error: any) {
      console.error('Error submitting feedback:', error);
      res.status(500).json({ error: 'Failed to submit feedback' });
    }
  });

  // ============================================
  // Portal Timeline Endpoints
  // ============================================

  // Get timeline for a lead (client view)
  app.get('/api/portal/timeline/:portalToken', async (req, res) => {
    try {
      const { portalToken } = req.params;
      const [lead] = await db.select().from(portalLeads).where(eq(portalLeads.portalToken, portalToken));
      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }
      const timeline = await db.select().from(portalTimelines)
        .where(eq(portalTimelines.portalLeadId, lead.id))
        .orderBy(sql`phase ASC, sort_order ASC`);
      res.json(timeline);
    } catch (error: any) {
      console.error('Error fetching timeline:', error);
      res.status(500).json({ error: 'Failed to fetch timeline' });
    }
  });

  // Push timeline to client portal (admin/planner)
  app.post('/api/admin/portal-timeline/:leadId', async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin', 'wedding_planner'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      const { leadId } = req.params;
      const { timeline } = req.body;
      
      // Delete existing timeline items for this lead
      await db.delete(portalTimelines).where(eq(portalTimelines.portalLeadId, leadId));
      
      // Insert new timeline items
      if (timeline && timeline.length > 0) {
        for (const item of timeline) {
          await db.insert(portalTimelines).values({
            portalLeadId: leadId,
            phase: item.phase,
            phaseName: item.phaseName,
            title: item.title,
            description: item.description || null,
            date: item.date && item.date.trim() !== '' ? item.date : null,
            time: item.time && item.time.trim() !== '' ? item.time : null,
            status: item.status || 'upcoming',
            icon: item.icon || null,
            sortOrder: item.sortOrder || 0,
            pushedBy: user.id
          });
        }
      }
      
      res.json({ success: true, message: 'Timeline pushed to client portal' });
    } catch (error: any) {
      console.error('Error pushing timeline:', error);
      res.status(500).json({ error: 'Failed to push timeline' });
    }
  });

  // Get admin view of client inputs for a lead
  app.get('/api/admin/client-inputs/:leadId', async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin', 'wedding_planner'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      const { leadId } = req.params;
      const inputs = await db.select().from(portalClientInputs)
        .where(eq(portalClientInputs.portalLeadId, leadId))
        .orderBy(sql`created_at DESC`);
      res.json(inputs);
    } catch (error: any) {
      console.error('Error fetching client inputs:', error);
      res.status(500).json({ error: 'Failed to fetch client inputs' });
    }
  });

  // Update client input status (admin review)
  app.patch('/api/admin/client-inputs/:inputId', async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin', 'wedding_planner'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      const { inputId } = req.params;
      const { status, notes } = req.body;
      
      const [updated] = await db.update(portalClientInputs)
        .set({
          status,
          notes,
          reviewedBy: user.id,
          reviewedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(portalClientInputs.id, inputId))
        .returning();
      
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating client input:', error);
      res.status(500).json({ error: 'Failed to update client input' });
    }
  });

  // ============================================
  // Admin Portal Lead Management Endpoints
  // ============================================
  
  // Get all portal leads (admin only)
  app.get('/api/admin/portal-leads', async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin', 'wedding_planner'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      let leads;
      if (user.role === 'wedding_planner') {
        // Wedding planners only see leads assigned to them
        leads = await db.select().from(portalLeads)
          .where(eq(portalLeads.assignedPlannerId, user.id))
          .orderBy(sql`created_at DESC`);
      } else {
        // Superadmin and admin see all leads
        leads = await db.select().from(portalLeads).orderBy(sql`created_at DESC`);
      }
      
      res.json(leads);
    } catch (error: any) {
      console.error('Error fetching portal leads:', error);
      res.status(500).json({ error: 'Failed to fetch portal leads' });
    }
  });
  
  // Create a new portal lead manually (superadmin/admin only)
  app.post('/api/admin/portal-leads', async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin', 'wedding_planner'].includes(user.role)) {
        return res.status(403).json({ error: 'Only superadmin, admin, or wedding planner can create portal leads' });
      }
      
      const { name, email, phone, eventType, eventDate, venue, guestCount, notes, assignedPlannerId: requestedPlannerId } = req.body;
      const assignedPlannerId = user.role === 'wedding_planner' ? user.id : requestedPlannerId;
      
      if (!name || !email || !phone) {
        return res.status(400).json({ error: 'Name, email, and phone are required' });
      }
      
      // Generate a short but secure portal token for the client
      const { randomBytes } = await import('crypto');
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
      const bytes = randomBytes(16);
      let portalToken = 'oak_';
      for (let i = 0; i < 12; i++) {
        portalToken += chars[bytes[i] % chars.length];
      }
      const tokenExpiry = new Date();
      tokenExpiry.setMonth(tokenExpiry.getMonth() + 6); // Token valid for 6 months
      
      let assignedPlannerName: string | null = null;
      if (assignedPlannerId) {
        const planner = await storage.getUser(assignedPlannerId);
        assignedPlannerName = planner?.name || null;
      }
      
      const [newLead] = await db.insert(portalLeads).values({
        name,
        email,
        phone,
        whatsappNumber: phone,
        eventType: eventType || null,
        eventDate: eventDate || null,
        venue: venue || null,
        guestCount: guestCount ? parseInt(guestCount) : null,
        additionalNotes: notes || null,
        portalToken,
        portalTokenExpiresAt: tokenExpiry,
        otpVerified: true,
        termsAccepted: true,
        phase: assignedPlannerId ? 'assigned' : 'submitted',
        assignedPlannerId: assignedPlannerId || null,
        assignedPlannerName: assignedPlannerName,
      }).returning();
      
      // Generate portal URL for sharing
      const portalUrl = `/my-portal?token=${portalToken}`;
      
      // Notify superadmins about the new manually-created lead
      try {
        const eventTypeLabelMap: Record<string, string> = {
          'hindu_wedding': 'Hindu Wedding', 'christian_wedding': 'Christian Wedding',
          'muslim_wedding': 'Muslim Wedding', 'engagement': 'Engagement',
          'birthday': 'Birthday', 'corporate': 'Corporate Event', 'other': 'Other',
        };
        const eventLabel = eventType ? eventTypeLabelMap[eventType] || eventType : '';
        await notifyNewLeadToSuperadmins(name, phone, eventLabel, 'manual');
      } catch (notifyError) {
        console.error('[Portal Lead] Failed to send new lead notification:', notifyError);
      }
      
      // Auto-create a sales deal in the pipeline
      let dealId: string | null = null;
      try {
        const ownerId = assignedPlannerId || user.id;
        const allPipelines = await db.select().from(salesPipelines);
        
        let pipeline = null;
        if (assignedPlannerId) {
          const plannerUser = await storage.getUser(assignedPlannerId);
          if (plannerUser) {
            pipeline = allPipelines.find(p => 
              p.name.toLowerCase().includes(plannerUser.name.toLowerCase().split(' ')[0])
            );
          }
        }
        if (!pipeline) {
          pipeline = allPipelines.find(p => p.isDefault);
        }
        if (!pipeline && allPipelines.length > 0) {
          pipeline = allPipelines[0];
        }
        
        if (pipeline) {
          const [firstStage] = await db.select().from(salesStages)
            .where(eq(salesStages.pipelineId, pipeline.id))
            .orderBy(salesStages.order)
            .limit(1);
          
          if (firstStage) {
            const existingDeals = await db.select().from(salesDeals)
              .where(and(
                eq(salesDeals.source, 'portal'),
                eq(salesDeals.notes, `portal_lead_id:${newLead.id}`)
              ));
            
            if (existingDeals.length === 0) {
              const eventTypeLabelMap2: Record<string, string> = {
                'hindu_wedding': 'Hindu Wedding', 'christian_wedding': 'Christian Wedding',
                'muslim_wedding': 'Muslim Wedding', 'engagement': 'Engagement',
                'birthday': 'Birthday', 'corporate': 'Corporate Event', 'other': 'Other',
              };
              const eventLabel2 = eventType ? eventTypeLabelMap2[eventType] || eventType : 'Event';
              
              let contactId: string | null = null;
              try {
                const existingContacts = await db.select().from(salesContacts)
                  .where(eq(salesContacts.phone, phone));
                if (existingContacts.length > 0) {
                  contactId = existingContacts[0].id;
                } else {
                  const nameParts = name.split(' ');
                  const [newContact] = await db.insert(salesContacts).values({
                    firstName: nameParts[0] || name,
                    lastName: nameParts.slice(1).join(' ') || '',
                    email: email || null,
                    phone: phone,
                    source: 'Portal',
                  }).returning();
                  contactId = newContact.id;
                }
              } catch (contactErr) {
                console.error('[Portal Lead] Failed to create/find contact:', contactErr);
              }
              
              const [newDeal] = await db.insert(salesDeals).values({
                title: `${name} - ${eventLabel2}`,
                phone: phone,
                pipelineId: pipeline.id,
                stageId: firstStage.id,
                value: '0',
                currency: 'INR',
                ownerId: ownerId,
                contactId: contactId,
                expectedCloseDate: eventDate || null,
                status: 'open',
                source: 'portal',
                leadSource: 'Direct',
                eventType: eventType || null,
                eventDate: eventDate || null,
                venue: venue || null,
                notes: `portal_lead_id:${newLead.id}`,
              }).returning();
              dealId = newDeal.id;
              console.log(`[Portal Lead] Auto-created sales deal "${newDeal.title}" in pipeline "${pipeline.name}"`);
            } else {
              console.log(`[Portal Lead] Sales deal already exists for portal lead ${newLead.id}`);
            }
          }
        }
      } catch (dealError) {
        console.error('[Portal Lead] Failed to auto-create sales deal:', dealError);
      }
      
      res.json({ 
        success: true, 
        lead: newLead,
        portalUrl,
        dealId,
        message: 'Portal client created successfully'
      });
    } catch (error: any) {
      console.error('Error creating portal lead:', error.message, error.detail || '', error.code || '');
      res.status(500).json({ error: 'Failed to create portal lead', detail: error.message });
    }
  });
  
  // Get wedding planners for assignment dropdown
  app.get('/api/admin/wedding-planners', async (req, res) => {
    console.log('[Wedding Planners API] Request received, userId:', req.session?.userId);
    if (!req.session?.userId) {
      console.log('[Wedding Planners API] No session userId - returning 401');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const planners = await db.select({
        id: users.id,
        name: users.name,
        email: users.email
      }).from(users).where(eq(users.role, 'wedding_planner'));
      console.log('[Wedding Planners API] Found planners:', planners.length, planners.map(p => p.name));
      res.json(planners);
    } catch (error: any) {
      console.error('[Wedding Planners API] Error fetching:', error);
      res.status(500).json({ error: 'Failed to fetch wedding planners' });
    }
  });
  
  // Assign a wedding planner to a portal lead
  app.post('/api/admin/portal-leads/:id/assign', async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin'].includes(user.role)) {
        return res.status(403).json({ error: 'Only superadmin/admin can assign leads' });
      }
      
      const { plannerId } = req.body;
      const leadId = req.params.id;
      
      if (!plannerId) {
        return res.status(400).json({ error: 'Planner ID is required' });
      }
      
      // Get the planner details
      const [planner] = await db.select().from(users).where(eq(users.id, plannerId));
      if (!planner || planner.role !== 'wedding_planner') {
        return res.status(400).json({ error: 'Invalid wedding planner' });
      }
      
      // Get the lead details
      const [lead] = await db.select().from(portalLeads).where(eq(portalLeads.id, leadId));
      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }
      
      // Update the lead with planner assignment
      const now = new Date();
      await db.update(portalLeads)
        .set({
          assignedPlannerId: plannerId,
          assignedPlannerName: planner.name,
          phase: 'assigned',
          phaseUpdatedAt: now,
          assignedAt: now,
          updatedAt: now
        })
        .where(eq(portalLeads.id, leadId));
      
      // Send WhatsApp notification to customer about assigned planner
      const customerPhone = lead.whatsappNumber || lead.phone;
      if (isWhatsAppConfigured() && customerPhone) {
        try {
          // Use template-based notification for customer messages (works outside 24h window)
          const result = await sendPlannerAssignedNotification(
            customerPhone,
            lead.name,
            planner.name,
            lead.eventDate ? new Date(lead.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'To be confirmed',
            lead.venue || 'To be confirmed'
          );
          
          if (!result.success) {
            console.log(`[Portal Lead] WhatsApp notification failed: ${result.error}`);
            // Template status for debugging
            console.log('[Portal Lead] Template status:', getTemplateStatus());
          } else {
            console.log(`[Portal Lead] WhatsApp notification sent to ${lead.name}`);
          }
        } catch (whatsappError) {
          console.error('WhatsApp notification failed for lead assignment:', whatsappError);
        }
      } else {
        console.log(`[Portal Lead] No phone available for WhatsApp notification to ${lead.name}`);
      }
      
      // Send WhatsApp notification to PLANNER about new lead assignment
      const plannerPhone = (planner as any).whatsappNumber || planner.phone;
      if (isWhatsAppConfigured() && plannerPhone) {
        try {
          const eventDateStr = lead.eventDate ? new Date(lead.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'TBD';
          // Keep message concise to fit template variable limits (max ~500 chars)
          const services = (lead.servicesRequired || []).slice(0, 3).join(', ') || 'Not specified';
          const plannerMessage = `🎉 *New Lead Assigned!*\n\n` +
            `*${lead.name}* - ${lead.eventType || 'Event'}\n` +
            `📅 ${eventDateStr} | 📍 ${(lead.venue || 'TBD').substring(0, 30)}\n` +
            `👥 ${lead.guestCount || 'TBD'} guests | 💰 ${lead.budgetRange || 'TBD'}\n` +
            `📞 ${lead.phone || lead.whatsappNumber || 'No contact'}\n\n` +
            `Please contact within 24 hours.`;
          
          const plannerResult = await sendGeneralNotification(
            plannerPhone,
            planner.name,
            plannerMessage,
            'portal_lead_assignment',
            leadId
          );
          
          if (!plannerResult.success) {
            console.log(`[Portal Lead] Planner WhatsApp notification failed: ${plannerResult.error}`);
          } else {
            console.log(`[Portal Lead] WhatsApp notification sent to planner ${planner.name}`);
          }
        } catch (plannerWhatsappError) {
          console.error('WhatsApp notification to planner failed:', plannerWhatsappError);
        }
      } else {
        console.log(`[Portal Lead] No phone available for planner ${planner.name} - please add phone number to planner profile`);
      }
      
      // Send Oaksy push notification to planner about new lead
      try {
        await notifyNewLeadAssigned(
          plannerId,
          planner.name,
          lead.name,
          lead.phone || lead.whatsappNumber || 'No contact'
        );
        console.log(`[Portal Lead] Oaksy push notification sent to planner ${planner.name}`);
      } catch (pushError) {
        console.error('[Portal Lead] Push notification to planner failed:', pushError);
      }

      // Auto-create a sales deal in the planner's pipeline
      try {
        // Find planner's own pipeline by matching planner name, or fall back to default/first
        const allPipelines = await db.select().from(salesPipelines);
        let pipeline = allPipelines.find(p => 
          p.name.toLowerCase().includes(planner.name.toLowerCase().split(' ')[0])
        );
        if (!pipeline) {
          pipeline = allPipelines.find(p => p.isDefault);
        }
        if (!pipeline && allPipelines.length > 0) {
          pipeline = allPipelines[0];
        }
        
        if (pipeline) {
          // Get the first stage of the pipeline (lowest order = first stage / "Lead")
          const [firstStage] = await db.select().from(salesStages)
            .where(eq(salesStages.pipelineId, pipeline.id))
            .orderBy(salesStages.order)
            .limit(1);
          
          if (firstStage) {
            // Check if a deal already exists for this portal lead (avoid duplicates)
            const existingDeals = await db.select().from(salesDeals)
              .where(and(
                eq(salesDeals.source, 'portal'),
                eq(salesDeals.notes, `portal_lead_id:${leadId}`)
              ));
            
            if (existingDeals.length === 0) {
              const budgetValue = lead.budgetRange ? lead.budgetRange.replace(/[^0-9.]/g, '') : '0';
              await db.insert(salesDeals).values({
                title: `${lead.name} - ${lead.eventType || 'Event'}`,
                phone: lead.phone || lead.whatsappNumber || null,
                pipelineId: pipeline.id,
                stageId: firstStage.id,
                value: budgetValue || '0',
                currency: 'INR',
                ownerId: plannerId,
                expectedCloseDate: lead.eventDate || null,
                status: 'open',
                source: 'portal',
                leadSource: 'Direct',
                eventType: lead.eventType || null,
                eventDate: lead.eventDate || null,
                venue: lead.venue || null,
                notes: `portal_lead_id:${leadId}`,
              });
              console.log(`[Portal Lead] Auto-created sales deal for ${lead.name} in pipeline "${pipeline.name}"`);
            } else {
              console.log(`[Portal Lead] Sales deal already exists for portal lead ${leadId}`);
            }
          }
        }
      } catch (dealError) {
        console.error('[Portal Lead] Failed to auto-create sales deal:', dealError);
      }
      
      res.json({ success: true, message: 'Wedding planner assigned successfully' });
    } catch (error: any) {
      console.error('Error assigning wedding planner:', error);
      res.status(500).json({ error: 'Failed to assign wedding planner' });
    }
  });
  
  // Update portal lead stage (for wedding planners)
  app.put('/api/admin/portal-leads/:id/stage', async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      const { phase } = req.body;
      const leadId = req.params.id;
      
      if (!phase) {
        return res.status(400).json({ error: 'Phase is required' });
      }
      
      const now = new Date();
      await db.update(portalLeads)
        .set({
          phase,
          phaseUpdatedAt: now,
          updatedAt: now
        })
        .where(eq(portalLeads.id, leadId));
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error updating lead stage:', error);
      res.status(500).json({ error: 'Failed to update lead stage' });
    }
  });

  // Edit portal lead (superadmin only)
  app.put('/api/admin/portal-leads/:id', async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Only superadmin can edit portal leads' });
      }
      
      const leadId = req.params.id;
      const { name, email, phone, eventType, eventDate, venue, guestCount, notes, assignedPlannerId, assignedPlannerName } = req.body;
      
      const now = new Date();
      const updateData: any = {
        name: name || undefined,
        email: email || undefined,
        phone: phone || undefined,
        eventType: eventType || undefined,
        eventDate: eventDate ? new Date(eventDate) : undefined,
        venue: venue || undefined,
        guestCount: guestCount || undefined,
        notes: notes,
        updatedAt: now
      };
      
      if (assignedPlannerId !== undefined) {
        updateData.assignedPlannerId = assignedPlannerId || null;
        updateData.assignedPlannerName = assignedPlannerName || null;
      }
      
      await db.update(portalLeads)
        .set(updateData)
        .where(eq(portalLeads.id, leadId));
      
      res.json({ success: true, message: 'Portal lead updated successfully' });
    } catch (error: any) {
      console.error('Error updating portal lead:', error);
      res.status(500).json({ error: 'Failed to update portal lead' });
    }
  });

  // Delete portal lead (superadmin only)
  app.delete('/api/admin/portal-leads/:id', async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Only superadmin can delete portal leads' });
      }
      
      const leadId = req.params.id;
      
      // Delete related data first (all portal tables with portalLeadId foreign key)
      // Note: Most tables have onDelete: 'cascade' but we explicitly delete to ensure clean removal
      await db.delete(portalMilestoneTasks).where(eq(portalMilestoneTasks.portalLeadId, leadId));
      await db.delete(portalMilestonePhases).where(eq(portalMilestonePhases.portalLeadId, leadId));
      await db.delete(portalEventFlowItems).where(eq(portalEventFlowItems.portalLeadId, leadId));
      await db.delete(portalEventFlows).where(eq(portalEventFlows.portalLeadId, leadId));
      await db.delete(portalFinancialMilestones).where(eq(portalFinancialMilestones.portalLeadId, leadId));
      await db.delete(portalTimelines).where(eq(portalTimelines.portalLeadId, leadId));
      await db.delete(portalFeedback).where(eq(portalFeedback.portalLeadId, leadId));
      await db.delete(portalClientInputs).where(eq(portalClientInputs.portalLeadId, leadId));
      await db.delete(portalOaksyChats).where(eq(portalOaksyChats.portalLeadId, leadId));
      
      // Delete the lead itself
      await db.delete(portalLeads).where(eq(portalLeads.id, leadId));
      
      res.json({ success: true, message: 'Portal lead deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting portal lead:', error);
      res.status(500).json({ error: 'Failed to delete portal lead' });
    }
  });

  // Phase 3: Push documents to client portal
  app.post('/api/admin/portal-leads/:id/share-documents', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || !['superadmin', 'admin', 'wedding_planner'].includes(user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    try {
      const leadId = req.params.id;
      const { estimateId, estimateUrl, estimateObjectPath, presentationId, presentationUrl, presentationObjectPath, contractUrl } = req.body;
      
      // Validate at least one document is provided
      if (!estimateId && !estimateUrl && !presentationId && !presentationUrl && !contractUrl) {
        return res.status(400).json({ error: 'At least one document must be provided' });
      }
      
      // Validate URL formats if provided
      if (contractUrl && typeof contractUrl === 'string') {
        if (!contractUrl.startsWith('http://') && !contractUrl.startsWith('https://')) {
          return res.status(400).json({ error: 'Contract URL must be a valid HTTP(S) URL' });
        }
      }
      if (estimateUrl && typeof estimateUrl === 'string') {
        if (!estimateUrl.startsWith('http://') && !estimateUrl.startsWith('https://')) {
          return res.status(400).json({ error: 'Estimate URL must be a valid HTTP(S) URL' });
        }
      }
      if (presentationUrl && typeof presentationUrl === 'string') {
        if (!presentationUrl.startsWith('http://') && !presentationUrl.startsWith('https://')) {
          return res.status(400).json({ error: 'Presentation URL must be a valid HTTP(S) URL' });
        }
      }
      
      // Validate that estimate and presentation IDs exist if provided
      if (estimateId) {
        const estimate = await storage.getEstimate(estimateId);
        if (!estimate) {
          return res.status(400).json({ error: 'Estimate not found' });
        }
      }
      if (presentationId) {
        const presentation = await storage.getPresentation(presentationId);
        if (!presentation) {
          return res.status(400).json({ error: 'Presentation not found' });
        }
      }
      
      const [lead] = await db.select().from(portalLeads).where(eq(portalLeads.id, leadId));
      if (!lead) {
        return res.status(404).json({ error: 'Portal lead not found' });
      }
      
      // Wedding planners can only share documents for leads assigned to them
      if (user.role === 'wedding_planner' && lead.assignedPlannerId !== user.id) {
        return res.status(403).json({ error: 'You can only share documents for leads assigned to you' });
      }
      
      const now = new Date();
      const updateData: any = {
        documentsSharedAt: now,
        documentsSharedBy: req.session.userId,
        phase: 'documents_shared',
        phaseUpdatedAt: now,
        clientApprovalStatus: 'pending',
        updatedAt: now
      };
      
      if (estimateId) {
        updateData.sharedEstimateId = estimateId;
        updateData.sharedEstimateUrl = null;
        updateData.sharedEstimateObjectPath = null;
      } else if (estimateUrl) {
        updateData.sharedEstimateUrl = estimateUrl;
        updateData.sharedEstimateId = null;
        updateData.sharedEstimateObjectPath = estimateObjectPath || null;
      }
      if (presentationId) {
        updateData.sharedPresentationId = presentationId;
        updateData.sharedPresentationObjectPath = null;
      }
      if (presentationUrl) {
        updateData.sharedPresentationUrl = presentationUrl;
        updateData.sharedPresentationObjectPath = presentationObjectPath || null;
      }
      if (contractUrl) updateData.sharedContractUrl = contractUrl;
      
      await db.update(portalLeads)
        .set(updateData)
        .where(eq(portalLeads.id, leadId));
      
      // Generate portal access token if not exists
      if (!lead.portalToken) {
        const crypto = await import('crypto');
        const token = crypto.randomBytes(32).toString('hex');
        const tokenExpiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days
        
        await db.update(portalLeads)
          .set({ 
            portalToken: token, 
            portalTokenExpiresAt: tokenExpiry 
          })
          .where(eq(portalLeads.id, leadId));
      }
      
      // Get updated lead
      const [updatedLead] = await db.select().from(portalLeads).where(eq(portalLeads.id, leadId));
      
      res.json({ 
        success: true, 
        lead: updatedLead,
        portalUrl: `/client-portal/${updatedLead.portalToken}`
      });
    } catch (error: any) {
      console.error('Error sharing documents:', error);
      res.status(500).json({ error: 'Failed to share documents' });
    }
  });

  // Get portal lead with shared documents (for client portal view)
  app.get('/api/client-portal/:token', async (req, res) => {
    try {
      const { token } = req.params;
      
      const [lead] = await db.select().from(portalLeads).where(eq(portalLeads.portalToken, token));
      if (!lead) {
        return res.status(404).json({ error: 'Portal not found or expired' });
      }
      
      if (lead.portalTokenExpiresAt && new Date(lead.portalTokenExpiresAt) < new Date()) {
        return res.status(401).json({ error: 'Portal access has expired' });
      }
      
      // Build response with document details
      let estimate = null;
      let presentation = null;
      
      if (lead.sharedEstimateId) {
        estimate = await storage.getEstimate(lead.sharedEstimateId);
      }
      
      if (lead.sharedPresentationId) {
        presentation = await storage.getPresentation(lead.sharedPresentationId);
      }
      
      res.json({
        id: lead.id,
        name: lead.name,
        email: lead.email,
        eventDate: lead.eventDate,
        eventType: lead.eventType,
        venue: lead.venue,
        phase: lead.phase,
        clientApprovalStatus: lead.clientApprovalStatus,
        clientApprovalNotes: lead.clientApprovalNotes,
        documentsSharedAt: lead.documentsSharedAt,
        estimate: estimate ? {
          id: estimate.id,
          estimateNumber: estimate.estimateNumber,
          title: estimate.title,
          total: estimate.total,
          lineItems: (estimate.lineItems || [])
            .filter((item: any) => !item.isInternalOnly)
            .map((item: any) => {
              const { costPrice, marginPercent, isInternalOnly, ...rest } = item;
              return rest;
            }),
          terms: estimate.terms,
          status: estimate.status
        } : null,
        presentation: presentation ? {
          id: presentation.id,
          title: presentation.title,
          slides: presentation.slides
        } : null,
        contractUrl: lead.sharedContractUrl
      });
    } catch (error: any) {
      console.error('Error fetching client portal:', error);
      res.status(500).json({ error: 'Failed to load portal' });
    }
  });

  // Client approval endpoint
  app.post('/api/client-portal/:token/approve', async (req, res) => {
    try {
      const { token } = req.params;
      const { status, notes, signatureUrl } = req.body;
      
      // Validate status value
      const validStatuses = ['approved', 'rejected', 'revision_requested'];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Must be: approved, rejected, or revision_requested' });
      }
      
      const [lead] = await db.select().from(portalLeads).where(eq(portalLeads.portalToken, token));
      if (!lead) {
        return res.status(404).json({ error: 'Portal not found or expired' });
      }
      
      if (lead.portalTokenExpiresAt && new Date(lead.portalTokenExpiresAt) < new Date()) {
        return res.status(401).json({ error: 'Portal access has expired' });
      }
      
      const now = new Date();
      const updateData: any = {
        clientApprovalStatus: status,
        clientApprovalAt: now,
        updatedAt: now
      };
      
      // Sanitize notes (max 2000 chars)
      if (notes && typeof notes === 'string') {
        updateData.clientApprovalNotes = notes.substring(0, 2000);
      }
      if (signatureUrl && typeof signatureUrl === 'string') {
        updateData.clientSignatureUrl = signatureUrl.substring(0, 500);
      }
      
      // If approved, move to confirmed phase
      if (status === 'approved') {
        updateData.phase = 'confirmed';
        updateData.phaseUpdatedAt = now;
      }
      
      await db.update(portalLeads)
        .set(updateData)
        .where(eq(portalLeads.id, lead.id));
      
      // Notify assigned planner via WhatsApp if configured
      if (lead.assignedPlannerId) {
        try {
          const planner = await storage.getUser(lead.assignedPlannerId);
          // Could add WhatsApp notification here in the future
          console.log(`[ClientPortal] Approval status '${status}' for ${lead.name}, planner: ${planner?.name}`);
        } catch (e) {
          console.error('[ClientPortal] Error notifying planner:', e);
        }
      }
      
      res.json({ success: true, status });
    } catch (error: any) {
      console.error('Error processing approval:', error);
      res.status(500).json({ error: 'Failed to process approval' });
    }
  });

  // Get available estimates for sharing (for wedding planner UI)
  app.get('/api/admin/portal-leads/:id/available-documents', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Role-based access control
    const user = await storage.getUser(req.session.userId);
    if (!user || !['superadmin', 'admin', 'wedding_planner'].includes(user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    try {
      const leadId = req.params.id;
      const [lead] = await db.select().from(portalLeads).where(eq(portalLeads.id, leadId));
      
      if (!lead) {
        return res.status(404).json({ error: 'Portal lead not found' });
      }
      
      // Wedding planners can only access leads assigned to them
      if (user.role === 'wedding_planner' && lead.assignedPlannerId !== user.id) {
        return res.status(403).json({ error: 'You can only access leads assigned to you' });
      }
      
      // Get estimates - filter for wedding planners to show only their clients
      let allEstimates = await storage.getAllEstimates();
      if (user.role === 'wedding_planner') {
        allEstimates = allEstimates.filter((e: any) => 
          e.weddingPlannerName?.toLowerCase() === user.name?.toLowerCase()
        );
      }
      
      // Get all presentations
      const presentations = await storage.getAllPresentations();
      
      res.json({
        estimates: allEstimates.map((e: any) => ({
          id: e.id,
          estimateNumber: e.number,
          title: e.subject || e.number,
          customerName: e.leadName || 'Unknown Customer',
          total: e.total,
          status: e.status,
          date: e.date
        })),
        presentations: presentations.map(p => ({
          id: p.id,
          title: p.title,
          createdAt: p.createdAt
        })),
        currentSharedEstimateId: lead.sharedEstimateId,
        currentSharedPresentationId: lead.sharedPresentationId,
        currentContractUrl: lead.sharedContractUrl
      });
    } catch (error: any) {
      console.error('Error fetching available documents:', error);
      res.status(500).json({ error: 'Failed to fetch documents' });
    }
  });

  // Download files endpoints for client portal starter
  app.get('/api/download/client-portal-starter', (req, res) => {
    const filePath = '/home/runner/workspace/client-portal-starter.tar.gz';
    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Type', 'application/gzip');
      res.setHeader('Content-Disposition', 'attachment; filename=client-portal-starter.tar.gz');
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  });

  app.get('/api/download/client-portal-guide', (req, res) => {
    const filePath = '/home/runner/workspace/CLIENT_PORTAL_GUIDE.md';
    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', 'attachment; filename=CLIENT_PORTAL_GUIDE.md');
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  });

  // Portfolio Albums - Public endpoints
  app.get('/api/portfolio/albums', async (req, res) => {
    try {
      const albums = await storage.getAllPortfolioAlbums();
      res.json(albums);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/portfolio/albums/featured', async (req, res) => {
    try {
      const albums = await storage.getFeaturedPortfolioAlbums();
      res.json(albums);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/portfolio/albums/:id', async (req, res) => {
    try {
      const album = await storage.getPortfolioAlbum(req.params.id);
      if (!album) {
        return res.status(404).json({ error: 'Album not found' });
      }
      const photos = await storage.getPortfolioPhotosByAlbum(req.params.id);
      res.json({ album, photos });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Portfolio Items - Public endpoints (legacy)
  app.get('/api/portfolio', async (req, res) => {
    try {
      const items = await storage.getAllPortfolioItems();
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/portfolio/featured', async (req, res) => {
    try {
      const items = await storage.getFeaturedPortfolioItems();
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Portfolio Items - Admin endpoints (protected)
  app.get('/api/admin/portfolio', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const items = await storage.getAllPortfolioItems();
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/admin/portfolio', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== 'superadmin' && user.email !== 'anjanasaji1102@gmail.com')) {
      return res.status(403).json({ error: 'Access denied. Only Superadmin or Anjana can manage portfolio.' });
    }
    try {
      const item = await storage.createPortfolioItem({ ...req.body, createdBy: req.session.userId });
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/admin/portfolio/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== 'superadmin' && user.email !== 'anjanasaji1102@gmail.com')) {
      return res.status(403).json({ error: 'Access denied. Only Superadmin or Anjana can manage portfolio.' });
    }
    try {
      const item = await storage.updatePortfolioItem(req.params.id, req.body);
      if (!item) {
        return res.status(404).json({ error: 'Portfolio item not found' });
      }
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/admin/portfolio/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== 'superadmin' && user.email !== 'anjanasaji1102@gmail.com')) {
      return res.status(403).json({ error: 'Access denied. Only Superadmin or Anjana can manage portfolio.' });
    }
    try {
      await storage.deletePortfolioItem(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Portfolio Albums - Admin endpoints
  app.get('/api/admin/portfolio/albums', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const albums = await storage.getAllPortfolioAlbums();
      res.json(albums);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/admin/portfolio/albums', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== 'superadmin' && user.email !== 'anjanasaji1102@gmail.com')) {
      return res.status(403).json({ error: 'Access denied. Only Superadmin or Anjana can manage portfolio.' });
    }
    try {
      const album = await storage.createPortfolioAlbum({ ...req.body, createdBy: req.session.userId });
      res.json(album);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/admin/portfolio/albums/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== 'superadmin' && user.email !== 'anjanasaji1102@gmail.com')) {
      return res.status(403).json({ error: 'Access denied. Only Superadmin or Anjana can manage portfolio.' });
    }
    try {
      // Clean up data - remove fields that shouldn't be updated and handle date conversion
      const { id, createdAt, updatedAt, ...updateData } = req.body;
      
      // Only include editable fields
      const cleanData: any = {};
      if (updateData.title !== undefined) cleanData.title = updateData.title;
      if (updateData.tagline !== undefined) cleanData.tagline = updateData.tagline;
      if (updateData.venue !== undefined) cleanData.venue = updateData.venue;
      if (updateData.coverImageUrl !== undefined) cleanData.coverImageUrl = updateData.coverImageUrl;
      if (updateData.category !== undefined) cleanData.category = updateData.category;
      if (updateData.featured !== undefined) cleanData.featured = updateData.featured;
      if (updateData.sortOrder !== undefined) cleanData.sortOrder = updateData.sortOrder;
      if (updateData.eventDate !== undefined) cleanData.eventDate = updateData.eventDate;
      
      const album = await storage.updatePortfolioAlbum(req.params.id, cleanData);
      if (!album) {
        return res.status(404).json({ error: 'Album not found' });
      }
      res.json(album);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/admin/portfolio/albums/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== 'superadmin' && user.email !== 'anjanasaji1102@gmail.com')) {
      return res.status(403).json({ error: 'Access denied. Only Superadmin or Anjana can manage portfolio.' });
    }
    try {
      await storage.deletePortfolioAlbum(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Portfolio Photos - Admin endpoints
  app.get('/api/admin/portfolio/albums/:albumId/photos', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const photos = await storage.getPortfolioPhotosByAlbum(req.params.albumId);
      res.json(photos);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/admin/portfolio/photos', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== 'superadmin' && user.email !== 'anjanasaji1102@gmail.com')) {
      return res.status(403).json({ error: 'Access denied. Only Superadmin or Anjana can manage portfolio.' });
    }
    try {
      const photo = await storage.createPortfolioPhoto(req.body);
      res.json(photo);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/admin/portfolio/photos/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== 'superadmin' && user.email !== 'anjanasaji1102@gmail.com')) {
      return res.status(403).json({ error: 'Access denied. Only Superadmin or Anjana can manage portfolio.' });
    }
    try {
      await storage.deletePortfolioPhoto(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Bulk photo upload
  app.post('/api/admin/portfolio/photos/bulk', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== 'superadmin' && user.email !== 'anjanasaji1102@gmail.com')) {
      return res.status(403).json({ error: 'Access denied. Only Superadmin or Anjana can manage portfolio.' });
    }
    try {
      const { photos } = req.body; // Array of { albumId, setId, imageUrl, caption }
      const newPhotos = await storage.createPortfolioPhotos(photos);
      res.json(newPhotos);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Client document upload - for sharing PDFs, PPTs, DOCs, and images with clients
  const clientDocUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max for documents
    fileFilter: (req, file, cb) => {
      const allowedTypes = [
        'application/pdf',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp'
      ];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Only PDF, PPT, DOC, and image files are allowed'));
      }
    }
  });

  app.post('/api/portal/documents/upload', (req, res) => {
    clientDocUpload.single('document')(req, res, async (multerError: any) => {
      if (multerError) {
        return res.status(400).json({ error: multerError.message });
      }
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin', 'manager', 'wedding_planner'].includes(user.role)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      try {
        const file = req.file;
        if (!file) {
          return res.status(400).json({ error: 'No file uploaded' });
        }

        const objectStorage = new ObjectStorageService();
        const timestamp = Date.now();
        const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filename = `client-docs/${timestamp}_${sanitizedName}`;
        
        const documentUrl = await objectStorage.uploadPublicBuffer(
          file.buffer,
          filename,
          file.mimetype
        );

        const objectPath = await objectStorage.getPublicObjectPath(filename);

        res.json({ 
          success: true, 
          url: documentUrl,
          objectPath,
          filename: file.originalname,
          type: file.mimetype
        });
      } catch (error: any) {
        console.error('Client document upload error:', error);
        res.status(500).json({ error: error.message || 'Failed to upload document' });
      }
    });
  });

  // Portfolio photo file upload - direct file upload to object storage
  const portfolioUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max - increased for large photos
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'));
      }
    }
  });

  app.post('/api/admin/portfolio/photos/upload', portfolioUpload.array('photos', 50), async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== 'superadmin' && user.email !== 'anjanasaji1102@gmail.com')) {
      return res.status(403).json({ error: 'Access denied. Only Superadmin or Anjana can manage portfolio.' });
    }
    try {
      const { albumId, setId } = req.body;
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const objectStorage = new ObjectStorageService();
      const uploadedPhotos = [];

      for (const file of files) {
        const imageUrl = await objectStorage.uploadPortfolioImage(
          file.buffer,
          file.originalname,
          file.mimetype
        );
        
        const [photo] = await storage.createPortfolioPhotos([{
          albumId: albumId || null,
          setId: setId || null,
          imageUrl,
          caption: null
        }]);
        
        uploadedPhotos.push(photo);
      }

      res.json({ success: true, photos: uploadedPhotos, count: uploadedPhotos.length });
    } catch (error: any) {
      console.error('Portfolio upload error:', error);
      res.status(500).json({ error: error.message || 'Failed to upload photos' });
    }
  });

  // Cover image upload endpoint with stricter validation (5MB, JPG/PNG only)
  const coverUploadConfig = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max for cover images
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Only JPG and PNG files are allowed for cover images'));
      }
    }
  });

  app.post('/api/admin/portfolio/cover-upload', (req, res) => {
    coverUploadConfig.single('cover')(req, res, async (multerError: any) => {
      // Handle multer errors (file size, file type)
      if (multerError) {
        if (multerError.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
        }
        return res.status(400).json({ error: multerError.message || 'Invalid file' });
      }

      try {
        if (!req.session.userId) {
          return res.status(401).json({ error: 'Unauthorized - Please log in again' });
        }
        
        let user;
        try {
          user = await storage.getUser(req.session.userId);
        } catch (dbError: any) {
          console.error('Cover upload database error:', dbError.message);
          return res.status(500).json({ error: 'Database connection error. Please try again.' });
        }
        
        if (!user || (user.role !== 'superadmin' && user.email !== 'anjanasaji1102@gmail.com')) {
          return res.status(403).json({ error: 'Access denied. Only Superadmin or Anjana can manage portfolio.' });
        }
        
        const file = req.file as Express.Multer.File;
        if (!file) {
          return res.status(400).json({ error: 'No file uploaded. Please select an image.' });
        }

        const objectStorage = new ObjectStorageService();
        const imageUrl = await objectStorage.uploadPortfolioImage(
          file.buffer,
          `cover_${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`,
          file.mimetype
        );
        
        res.json({ success: true, imageUrl, message: 'Cover image uploaded successfully' });
      } catch (error: any) {
        console.error('Cover upload error:', error.message);
        res.status(500).json({ error: error.message || 'Failed to upload cover image. Please try again.' });
      }
    });
  });

  // Portfolio Sets - Admin endpoints
  app.get('/api/admin/portfolio/albums/:albumId/sets', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const sets = await storage.getPortfolioSetsByAlbum(req.params.albumId);
      res.json(sets);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/admin/portfolio/sets', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== 'superadmin' && user.email !== 'anjanasaji1102@gmail.com')) {
      return res.status(403).json({ error: 'Access denied. Only Superadmin or Anjana can manage portfolio.' });
    }
    try {
      const set = await storage.createPortfolioSet(req.body);
      res.json(set);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/admin/portfolio/sets/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== 'superadmin' && user.email !== 'anjanasaji1102@gmail.com')) {
      return res.status(403).json({ error: 'Access denied. Only Superadmin or Anjana can manage portfolio.' });
    }
    try {
      const set = await storage.updatePortfolioSet(req.params.id, req.body);
      if (!set) {
        return res.status(404).json({ error: 'Set not found' });
      }
      res.json(set);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/admin/portfolio/sets/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== 'superadmin' && user.email !== 'anjanasaji1102@gmail.com')) {
      return res.status(403).json({ error: 'Access denied. Only Superadmin or Anjana can manage portfolio.' });
    }
    try {
      await storage.deletePortfolioSet(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get photos by set
  app.get('/api/admin/portfolio/sets/:setId/photos', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const photos = await storage.getPortfolioPhotosBySet(req.params.setId);
      res.json(photos);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Public endpoint for sets
  app.get('/api/portfolio/albums/:albumId/sets', async (req, res) => {
    try {
      const sets = await storage.getPortfolioSetsByAlbum(req.params.albumId);
      res.json(sets);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/portfolio/sets/:setId/photos', async (req, res) => {
    try {
      const photos = await storage.getPortfolioPhotosBySet(req.params.setId);
      res.json(photos);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // =====================================================
  // My Portal - Customer Portal with WhatsApp OTP Login
  // =====================================================

  // Check portal session
  app.get('/api/my-portal/session', async (req, res) => {
    try {
      const portalLeadId = (req.session as any).portalLeadId;
      if (!portalLeadId) {
        return res.status(401).json({ error: 'Not logged in' });
      }
      
      const lead = await storage.getPortalLead(portalLeadId);
      if (!lead) {
        return res.status(401).json({ error: 'Session invalid' });
      }
      
      // Get planner's phone number if assigned
      let assignedPlannerPhone: string | null = null;
      if (lead.assignedPlannerId) {
        const planner = await storage.getUser(lead.assignedPlannerId);
        if (planner) {
          assignedPlannerPhone = planner.phone || null;
        }
      }
      
      res.json({
        id: lead.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        eventDate: lead.eventDate,
        eventType: lead.eventType,
        venue: lead.venue,
        phase: lead.phase,
        assignedPlannerName: lead.assignedPlannerName,
        assignedPlannerPhone,
        portalToken: lead.portalToken,
        rsvpEnabled: lead.rsvpEnabled || false,
        eventId: lead.eventId || null,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Rate limiting for OTP requests - track by phone number
  const otpRateLimits: Map<string, { count: number; resetAt: number }> = new Map();
  const OTP_RATE_LIMIT = 5; // Max 5 OTP requests per phone
  const OTP_RATE_WINDOW = 15 * 60 * 1000; // 15 minute window

  // Send OTP to phone
  app.post('/api/my-portal/send-otp', async (req, res) => {
    try {
      const { phone } = req.body;
      if (!phone) {
        return res.status(400).json({ error: 'Phone number is required' });
      }
      
      // Format phone number
      let formattedPhone = phone.trim();
      
      // If phone already starts with +, keep it; otherwise try to format
      if (!formattedPhone.startsWith('+')) {
        const digits = formattedPhone.replace(/\D/g, '');
        if (digits.length === 10) {
          formattedPhone = '+91' + digits;
        } else if (digits.length > 10) {
          formattedPhone = '+' + digits;
        } else {
          return res.status(400).json({ error: 'Please enter a valid phone number' });
        }
      }
      
      // Validate: must have country code + at least 7 digits
      const digitsOnly = formattedPhone.replace(/\D/g, '');
      if (digitsOnly.length < 7 || digitsOnly.length > 15) {
        return res.status(400).json({ error: 'Please enter a valid phone number' });
      }
      
      // Rate limiting check
      const now = Date.now();
      const rateKey = formattedPhone;
      const rateData = otpRateLimits.get(rateKey);
      
      if (rateData) {
        if (now < rateData.resetAt) {
          if (rateData.count >= OTP_RATE_LIMIT) {
            const waitMinutes = Math.ceil((rateData.resetAt - now) / 60000);
            return res.status(429).json({ error: `Too many OTP requests. Please wait ${waitMinutes} minutes before trying again.` });
          }
          rateData.count++;
        } else {
          otpRateLimits.set(rateKey, { count: 1, resetAt: now + OTP_RATE_WINDOW });
        }
      } else {
        otpRateLimits.set(rateKey, { count: 1, resetAt: now + OTP_RATE_WINDOW });
      }
      
      // Find portal lead by phone (check primary lead phone + all contacts' phones)
      const leads = await storage.getPortalLeads();
      const phoneDigits = phone.replace(/\D/g, '');
      const formattedDigits = formattedPhone.replace(/\D/g, '');
      
      let lead = leads.find((l: any) => 
        l.phone === formattedPhone || 
        l.phone === phone ||
        l.phone.replace(/\D/g, '') === phoneDigits ||
        l.whatsappNumber === formattedPhone ||
        l.whatsappNumber === phone ||
        l.whatsappNumber.replace(/\D/g, '') === phoneDigits
      );
      
      // If not found by primary phone, check portal lead contacts
      if (!lead) {
        for (const l of leads) {
          const contacts = await storage.getPortalLeadContacts(l.id);
          const matchingContact = contacts.find((c: any) => {
            if (!c.phone || !c.isActive) return false;
            const contactDigits = c.phone.replace(/\D/g, '');
            return c.phone === formattedPhone || 
                   c.phone === phone || 
                   contactDigits === phoneDigits ||
                   contactDigits === formattedDigits;
          });
          if (matchingContact) {
            lead = l;
            break;
          }
        }
      }
      
      let isNewClient = false;
      
      // If no lead exists, create a new one for this phone number
      if (!lead) {
        isNewClient = true;
        // Use crypto-secure random IDs
        const crypto = await import('crypto');
        const newLeadId = `PL${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;
        const portalToken = `PT${crypto.randomBytes(24).toString('hex')}`;
        
        lead = await storage.createPortalLead({
          id: newLeadId,
          name: '',
          email: '',
          phone: formattedPhone,
          whatsappNumber: formattedPhone,
          address: '',
          city: '',
          eventDate: null,
          eventType: '',
          venue: '',
          venueCity: '',
          guestCount: null,
          budgetRange: '',
          servicesRequired: [],
          additionalNotes: '',
          referenceUrls: [],
          termsAccepted: false,
          otpVerified: false,
          otpCode: null,
          otpExpiresAt: null,
          portalToken,
          portalTokenExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
          phase: 'new',
        });
        console.log('[Portal OTP] Created new lead for phone:', formattedPhone);
      }
      
      // Generate 6-digit OTP using crypto for security
      const crypto = await import('crypto');
      const otpCode = (crypto.randomInt(100000, 999999)).toString();
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      
      // Update lead with OTP
      await storage.updatePortalLead(lead.id, {
        otpCode,
        otpExpiresAt,
      });
      
      // Send OTP via WhatsApp to the phone number that requested it
      const whatsappService = await import('./whatsapp-service');
      const result = await whatsappService.sendOTPNotification(formattedPhone, otpCode);
      
      if (!result.success) {
        console.error('[Portal OTP] Failed to send OTP:', result.error);
        return res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
      }
      
      res.json({ success: true, leadId: lead.id, message: 'OTP sent to your WhatsApp', isNewClient });
    } catch (error: any) {
      console.error('[Portal OTP] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Verify OTP
  app.post('/api/my-portal/verify-otp', async (req, res) => {
    try {
      const { leadId, otp } = req.body;
      if (!leadId || !otp) {
        return res.status(400).json({ error: 'Lead ID and OTP are required' });
      }
      
      const lead = await storage.getPortalLead(leadId);
      if (!lead) {
        return res.status(404).json({ error: 'Invalid session' });
      }
      
      // Check OTP
      if (!lead.otpCode || lead.otpCode !== otp) {
        return res.status(400).json({ error: 'Invalid OTP' });
      }
      
      // Check expiry
      if (lead.otpExpiresAt && new Date(lead.otpExpiresAt) < new Date()) {
        return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
      }
      
      // Clear OTP and mark verified
      await storage.updatePortalLead(leadId, {
        otpCode: null,
        otpExpiresAt: null,
        otpVerified: true,
      });
      
      // Store in session
      (req.session as any).portalLeadId = leadId;
      
      res.json({ success: true, message: 'Login successful' });
    } catch (error: any) {
      console.error('[Portal Verify] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Token lookup - returns masked phone for the portal link (no login)
  app.get('/api/my-portal/token-lookup/:token', async (req, res) => {
    try {
      const { token } = req.params;
      if (!token) {
        return res.status(400).json({ error: 'Token is required' });
      }

      const [lead] = await db.select().from(portalLeads).where(eq(portalLeads.portalToken, token));
      if (!lead) {
        return res.status(404).json({ error: 'Invalid portal link' });
      }

      // Check token expiry
      if (lead.portalTokenExpiresAt && new Date(lead.portalTokenExpiresAt) < new Date()) {
        return res.status(401).json({ error: 'Portal link has expired' });
      }

      // Return masked phone and name so the login page can pre-fill
      const phone = lead.phone || '';
      // Known country codes sorted longest first to match correctly
      const knownCodes = [
        '+880', '+234', '+254', '+977', '+974', '+973', '+971', '+968', '+966', '+965',
        '+91', '+92', '+94', '+86', '+82', '+81', '+66', '+65', '+63', '+62', '+61',
        '+55', '+52', '+49', '+44', '+39', '+33', '+27',
        '+7', '+1'
      ];
      let detectedCountryCode = '+91';
      let localNumber = phone;
      if (phone.startsWith('+')) {
        const matched = knownCodes.find(cc => phone.startsWith(cc));
        if (matched) {
          detectedCountryCode = matched;
          localNumber = phone.slice(matched.length);
        } else {
          // Fallback: try 1-4 digit codes
          const ccMatch = phone.match(/^(\+\d{1,3})/);
          if (ccMatch) {
            detectedCountryCode = ccMatch[1];
            localNumber = phone.slice(detectedCountryCode.length);
          }
        }
      }
      const cleanLocal = localNumber.replace(/\D/g, '');
      const maskedPhone = cleanLocal.length >= 4
        ? '●'.repeat(cleanLocal.length - 4) + cleanLocal.slice(-4)
        : '●●●●●●';

      res.json({
        name: lead.name,
        maskedPhone,
        countryCode: detectedCountryCode,
      });
    } catch (error: any) {
      console.error('[Portal Token Lookup] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Logout
  app.post('/api/my-portal/logout', async (req, res) => {
    try {
      delete (req.session as any).portalLeadId;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get portal dashboard data
  app.get('/api/my-portal/dashboard', async (req, res) => {
    try {
      const portalLeadId = (req.session as any).portalLeadId;
      if (!portalLeadId) {
        return res.status(401).json({ error: 'Not logged in' });
      }
      
      const lead = await storage.getPortalLead(portalLeadId);
      if (!lead) {
        return res.status(401).json({ error: 'Session invalid' });
      }
      
      // Get shared estimates for this lead
      const estimates: any[] = [];
      
      // Normalize phone number for matching
      const normalizePhone = (phone: string) => phone?.replace(/\D/g, '').slice(-10) || '';
      const leadPhoneNorm = normalizePhone(lead.phone);
      const leadWhatsappNorm = normalizePhone(lead.whatsappNumber);
      
      if (lead.sharedEstimateId) {
        const estimate = await storage.getEstimate(lead.sharedEstimateId);
        if (estimate) {
          estimates.push({
            id: estimate.id,
            estimateNumber: (estimate as any).number, // Use 'number' field from schema
            title: (estimate as any).subject || (estimate as any).leadName || 'Estimate', // Use 'subject' field
            total: estimate.total,
            status: estimate.status,
            sharedAt: lead.documentsSharedAt,
            customerName: lead.name,
          });
        }
      }
      
      // Get all estimates shared with this customer by phone/email
      const allEstimates = await storage.getAllEstimates();
      const customerEstimates = allEstimates.filter((est: any) => {
        if (est.sharedToPortal !== true) return false;
        
        // Match by normalized phone
        const estPhoneNorm = normalizePhone(est.customerPhone || est.customerWhatsapp || '');
        const phoneMatch = estPhoneNorm && (estPhoneNorm === leadPhoneNorm || estPhoneNorm === leadWhatsappNorm);
        
        // Match by email
        const emailMatch = est.customerEmail && est.customerEmail.toLowerCase() === lead.email?.toLowerCase();
        
        return phoneMatch || emailMatch;
      });
      
      for (const est of customerEstimates) {
        if (!estimates.find(e => e.id === est.id)) {
          estimates.push({
            id: est.id,
            estimateNumber: est.number, // Use 'number' field from schema
            title: est.subject || est.leadName || 'Estimate', // Use 'subject' field
            total: est.total,
            status: est.status,
            sharedAt: est.sharedToPortalAt || est.createdAt,
            customerName: est.leadName || lead.name,
          });
        }
      }
      
      // Get shared presentations
      const presentations: any[] = [];
      if (lead.sharedPresentationId) {
        const presentation = await storage.getPresentation(lead.sharedPresentationId);
        if (presentation) {
          presentations.push({
            id: presentation.id,
            title: presentation.title,
            sharedAt: lead.documentsSharedAt,
          });
        }
      }
      if (lead.sharedEstimateUrl) {
        let estUrl = lead.sharedEstimateUrl;
        try {
          const objectStorage = new ObjectStorageService();
          if (lead.sharedEstimateObjectPath) {
            estUrl = await objectStorage.refreshSignedUrl(lead.sharedEstimateObjectPath);
          } else if (estUrl.includes('storage.googleapis.com/replit-objstore')) {
            const urlObj = new URL(estUrl);
            const pathParts = urlObj.pathname.split('/');
            const bucketName = pathParts[1];
            const objectName = pathParts.slice(2).join('/');
            estUrl = await objectStorage.refreshSignedUrl(`${bucketName}/${objectName}`);
          }
        } catch (e) {
          console.error('[Portal] Failed to refresh estimate URL:', e);
        }
        estimates.push({
          id: `url-est-${lead.id}`,
          estimateNumber: 'Uploaded Estimate',
          title: 'Estimate',
          total: '',
          status: 'shared',
          sharedAt: lead.documentsSharedAt,
          customerName: lead.name,
          url: estUrl,
        });
      }
      
      if (lead.sharedPresentationUrl) {
        let presUrl = lead.sharedPresentationUrl;
        try {
          const objectStorage = new ObjectStorageService();
          if (lead.sharedPresentationObjectPath) {
            presUrl = await objectStorage.refreshSignedUrl(lead.sharedPresentationObjectPath);
          } else if (presUrl.includes('storage.googleapis.com/replit-objstore')) {
            const urlObj = new URL(presUrl);
            const pathParts = urlObj.pathname.split('/');
            const bucketName = pathParts[1];
            const objectName = pathParts.slice(2).join('/');
            presUrl = await objectStorage.refreshSignedUrl(`${bucketName}/${objectName}`);
          }
        } catch (e) {
          console.error('[Portal] Failed to refresh presentation URL:', e);
        }
        presentations.push({
          id: `url-pres-${lead.id}`,
          title: 'Presentation',
          url: presUrl,
          sharedAt: lead.documentsSharedAt,
        });
      }
      
      // Get timeline (milestones for linked event if any)
      const timeline: any[] = [];
      if (lead.dealId) {
        const deal = await storage.getSalesDeal(lead.dealId);
        if (deal && deal.eventId) {
          const milestones = await storage.getMilestonesByEventId(deal.eventId);
          for (const m of milestones) {
            timeline.push({
              id: m.id,
              title: m.title,
              date: m.dueDate,
              status: m.status,
            });
          }
        }
      }
      
      res.json({
        lead: {
          id: lead.id,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          eventDate: lead.eventDate,
          eventType: lead.eventType,
          venue: lead.venue,
          phase: lead.phase,
          assignedPlannerName: lead.assignedPlannerName,
          rsvpEnabled: lead.rsvpEnabled || false,
          eventId: lead.eventId || null,
        },
        estimates,
        presentations,
        timeline,
      });
    } catch (error: any) {
      console.error('[Portal Dashboard] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Toggle RSVP service for a portal lead (superadmin only)
  app.put('/api/admin/portal-leads/:id/rsvp-toggle', async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Only superadmin can manage RSVP services' });
      }
      const { enabled } = req.body;
      const leadId = req.params.id;
      await db.update(portalLeads)
        .set({ rsvpEnabled: !!enabled, updatedAt: new Date() })
        .where(eq(portalLeads.id, leadId));
      res.json({ success: true, rsvpEnabled: !!enabled });
    } catch (error: any) {
      console.error('Error toggling RSVP:', error);
      res.status(500).json({ error: 'Failed to toggle RSVP service' });
    }
  });

  // Convert portal lead to customer (and optionally create event)
  app.post('/api/admin/portal-leads/:id/convert-to-customer', async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || (user.role !== 'superadmin' && user.role !== 'admin' && user.role !== 'accountant')) {
        return res.status(403).json({ error: 'Only superadmin, admin, or accountant can convert leads to customers' });
      }

      const leadId = req.params.id;
      const lead = await storage.getPortalLead(leadId);
      if (!lead) {
        return res.status(404).json({ error: 'Portal lead not found' });
      }
      if (lead.convertedCustomerId) {
        return res.status(400).json({ error: 'This lead has already been converted to a customer' });
      }

      const { name, phone, email, billingAddress, state, country, gstNumber, weddingPlannerId, createEvent: shouldCreateEvent, eventTitle, eventVenue } = req.body;

      const customerCode = await generateCustomerCode();

      const result = await db.transaction(async (tx) => {
        const [customer] = await tx.insert(customers)
          .values({
            name: name || lead.name,
            phone: phone || lead.phone,
            email: email || lead.email,
            gstNumber: gstNumber || null,
            billingAddress: billingAddress || lead.address || '',
            state: state || '',
            country: country || 'India',
            company: 'oakstreet',
            weddingPlannerId: weddingPlannerId || lead.assignedPlannerId || null,
            customerCode,
          })
          .returning();

        await tx.insert(customerCreationLogs).values({
          customerId: customer.id,
          leadId: leadId,
          accountantId: req.session.userId!,
          status: 'created'
        });

        let createdEvent = null;
        if (shouldCreateEvent && lead.eventDate) {
          const eventCode = await generateEventCode();
          const plannerName = lead.assignedPlannerName || user.name || 'TBD';
          const eventType = lead.eventType || 'wedding';
          const typeMap: Record<string, string> = {
            'hindu_wedding': 'wedding', 'christian_wedding': 'wedding', 'muslim_wedding': 'wedding',
            'engagement': 'wedding', 'birthday': 'birthday', 'corporate': 'corporate'
          };

          const [newEvent] = await tx.insert(events)
            .values({
              title: eventTitle || `${lead.name} - ${lead.eventType || 'Event'}`,
              date: lead.eventDate,
              time: null,
              type: typeMap[eventType] || 'other',
              planner: plannerName,
              customer: name || lead.name,
              venue: eventVenue || lead.venue || 'TBD',
              salesValue: '0',
              paymentReceived: '0',
              cost: '0',
              status: 'active',
              eventCode,
            })
            .returning();
          createdEvent = newEvent;

          await tx.update(portalLeads)
            .set({ eventId: createdEvent.id, updatedAt: new Date() })
            .where(eq(portalLeads.id, leadId));
        }

        await tx.update(portalLeads)
          .set({
            convertedCustomerId: customer.id,
            convertedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(portalLeads.id, leadId));

        return { customer, customerCode, createdEvent };
      });

      console.log(`[Portal Lead Conversion] Lead "${lead.name}" converted to customer ${result.customerCode}${result.createdEvent ? ` with event ${result.createdEvent.id}` : ''}`);

      res.json({
        success: true,
        customer: result.customer,
        customerCode: result.customerCode,
        event: result.createdEvent,
      });
    } catch (error: any) {
      console.error('Error converting portal lead to customer:', error);
      res.status(500).json({ error: 'Failed to convert lead to customer' });
    }
  });

  async function buildRsvpData(lead: any) {
    let eventId = lead.eventId;
    if (!eventId && lead.dealId) {
      const deal = await storage.getSalesDeal(lead.dealId);
      if (deal?.eventId) eventId = deal.eventId;
    }
    if (!eventId) {
      return { guests: [], stats: { total: 0, attending: 0, declined: 0, pending: 0, totalAdults: 0, totalChildren: 0 }, event: null };
    }

    const event = await storage.getEvent(eventId);
    const guests = await storage.getEventGuestsByEvent(eventId);
    const responses = await storage.getRsvpResponsesByEvent(eventId);

    const responseMap = new Map(responses.map((r: any) => [r.guestId, r]));
    const guestsWithRsvp = guests.map((g: any) => {
      const resp = responseMap.get(g.id);
      return {
        id: g.id,
        name: g.name,
        phone: g.phone,
        email: g.email,
        relationship: g.relationship,
        guestGroup: g.guestGroup,
        maxAttendees: g.maxAttendees,
        isVip: g.isVip,
        rsvpStatus: resp?.attendanceStatus || 'pending',
        numberOfAdults: resp?.numberOfAdults || 0,
        numberOfChildren: resp?.numberOfChildren || 0,
        mealPreference: resp?.mealPreference || null,
        attendingWedding: resp?.attendingWedding || false,
        attendingEngagement: resp?.attendingEngagement || false,
        needsPickup: resp?.needsPickup || false,
        needsAccommodation: resp?.needsAccommodation || false,
        numberOfAttendees: resp?.numberOfAttendees || 0,
        paxCount: resp?.numberOfAttendees || resp?.numberOfAdults || 0,
      };
    });

    const stats = {
      total: guests.length,
      attending: guestsWithRsvp.filter((g: any) => g.rsvpStatus === 'yes').length,
      declined: guestsWithRsvp.filter((g: any) => g.rsvpStatus === 'no').length,
      pending: guestsWithRsvp.filter((g: any) => g.rsvpStatus === 'pending').length,
      totalAdults: guestsWithRsvp.reduce((sum: number, g: any) => sum + (g.rsvpStatus === 'yes' ? g.numberOfAdults : 0), 0),
      totalChildren: guestsWithRsvp.reduce((sum: number, g: any) => sum + (g.rsvpStatus === 'yes' ? g.numberOfChildren : 0), 0),
    };

    return {
      guests: guestsWithRsvp,
      stats,
      event: event ? { id: event.id, title: event.title, date: event.date, venue: event.venue, rsvpCode: event.rsvpCode, rsvpTitle: event.rsvpTitle } : null,
    };
  }

  // Portal client: Get RSVP data (guests + stats) for their linked event
  app.get('/api/my-portal/rsvp', async (req, res) => {
    try {
      const portalLeadId = (req.session as any).portalLeadId;
      if (!portalLeadId) {
        return res.status(401).json({ error: 'Not logged in' });
      }
      const lead = await storage.getPortalLead(portalLeadId);
      if (!lead || !lead.rsvpEnabled) {
        return res.status(403).json({ error: 'RSVP service not enabled' });
      }

      const data = await buildRsvpData(lead);
      res.json(data);
    } catch (error: any) {
      console.error('[Portal RSVP] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Preview mode: Get RSVP data for a portal lead (wedding planners / admins)
  app.get('/api/admin/portal-leads/:id/preview-rsvp', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin', 'wedding_planner'].includes(user.role)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const lead = await storage.getPortalLead(req.params.id);
      if (!lead) {
        return res.status(404).json({ error: 'Portal lead not found' });
      }

      const data = await buildRsvpData(lead);
      res.json(data);
    } catch (error: any) {
      console.error('[Portal Preview RSVP] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Download RSVP guest list as CSV (portal client or admin preview)
  app.get('/api/my-portal/rsvp/download', async (req, res) => {
    try {
      let lead: any = null;
      const previewLeadId = req.query.previewLeadId as string;

      if (previewLeadId && req.session.userId) {
        const user = await storage.getUser(req.session.userId);
        if (user && ['superadmin', 'admin', 'wedding_planner'].includes(user.role)) {
          lead = await storage.getPortalLead(previewLeadId);
        }
      }

      if (!lead) {
        const portalLeadId = (req.session as any).portalLeadId;
        if (portalLeadId) {
          lead = await storage.getPortalLead(portalLeadId);
        }
      }

      if (!lead || !lead.rsvpEnabled) {
        return res.status(403).json({ error: 'RSVP not available' });
      }

      const data = await buildRsvpData(lead);
      const guests = data.guests || [];

      const csvHeaders = ['Name', 'Phone', 'Email', 'Group', 'Status', 'Attending Wedding', 'Attending Engagement', 'Adults', 'Children', 'Total Pax', 'Needs Pickup', 'Needs Accommodation', 'Meal Preference'];
      const csvRows = guests.map((g: any) => [
        g.name || '',
        g.phone || '',
        g.email || '',
        g.guestGroup || '',
        g.rsvpStatus === 'yes' ? 'Confirmed' : g.rsvpStatus === 'no' ? 'Declined' : g.rsvpStatus === 'maybe' ? 'Maybe' : 'Pending',
        g.attendingWedding ? 'Yes' : 'No',
        g.attendingEngagement ? 'Yes' : 'No',
        g.numberOfAdults || 0,
        g.numberOfChildren || 0,
        (g.numberOfAdults || 0) + (g.numberOfChildren || 0),
        g.needsPickup ? 'Yes' : 'No',
        g.needsAccommodation ? 'Yes' : 'No',
        g.mealPreference || '',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

      const csv = [csvHeaders.join(','), ...csvRows].join('\n');
      const eventTitle = data.event?.title || 'RSVP';

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${eventTitle}_Guest_List.csv"`);
      res.send(csv);
    } catch (error: any) {
      console.error('[Portal RSVP Download] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Portal client: Add individual guest
  app.post('/api/my-portal/rsvp/add-guest', async (req, res) => {
    try {
      const portalLeadId = (req.session as any).portalLeadId;
      if (!portalLeadId) {
        return res.status(401).json({ error: 'Not logged in' });
      }
      const lead = await storage.getPortalLead(portalLeadId);
      if (!lead || !lead.rsvpEnabled) {
        return res.status(403).json({ error: 'RSVP service not enabled' });
      }

      let eventId = lead.eventId;
      if (!eventId && lead.dealId) {
        const deal = await storage.getSalesDeal(lead.dealId);
        if (deal?.eventId) eventId = deal.eventId;
      }
      if (!eventId) {
        return res.status(400).json({ error: 'No event linked to your account. Please contact your wedding planner.' });
      }

      const { name, phone, email, relationship, guestGroup, maxAttendees } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Guest name is required' });
      }

      const guest = await storage.createEventGuest({
        eventId,
        name: name.trim(),
        phone: phone?.trim() || 'N/A',
        email: email?.trim() || undefined,
        relationship: relationship?.trim() || undefined,
        guestGroup: guestGroup?.trim() || undefined,
        maxAttendees: parseInt(maxAttendees) || 1,
      });

      res.json({ success: true, guest });
    } catch (error: any) {
      console.error('[Portal RSVP Add Guest] Error:', error);
      res.status(500).json({ error: error.message || 'Failed to add guest' });
    }
  });

  // Portal client: Upload guest list via Excel
  const portalGuestUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req: any, file: any, cb: any) => {
      if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          file.mimetype === 'application/vnd.ms-excel' ||
          file.originalname.endsWith('.xlsx') || file.originalname.endsWith('.xls')) {
        cb(null, true);
      } else {
        cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
      }
    },
  });

  app.post('/api/my-portal/rsvp/upload-guests', portalGuestUpload.single('file'), async (req: any, res) => {
    try {
      const portalLeadId = (req.session as any).portalLeadId;
      if (!portalLeadId) {
        return res.status(401).json({ error: 'Not logged in' });
      }
      const lead = await storage.getPortalLead(portalLeadId);
      if (!lead || !lead.rsvpEnabled) {
        return res.status(403).json({ error: 'RSVP service not enabled' });
      }

      let eventId = lead.eventId;
      if (!eventId && lead.dealId) {
        const deal = await storage.getSalesDeal(lead.dealId);
        if (deal?.eventId) eventId = deal.eventId;
      }
      if (!eventId) {
        return res.status(400).json({ error: 'No event linked to your account. Please contact your wedding planner.' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer);
      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        return res.status(400).json({ error: 'Excel file is empty' });
      }

      const headerRow = worksheet.getRow(1);
      const headers: string[] = [];
      headerRow.eachCell((cell: any) => {
        headers.push(String(cell.value || '').toLowerCase().trim());
      });

      const nameCol = headers.findIndex(h => h.includes('name'));
      const phoneCol = headers.findIndex(h => h.includes('phone') || h.includes('mobile') || h.includes('contact'));
      const emailCol = headers.findIndex(h => h.includes('email') || h.includes('mail'));
      const relationCol = headers.findIndex(h => h.includes('relation') || h.includes('side') || h.includes('family'));
      const groupCol = headers.findIndex(h => h.includes('group') || h.includes('category'));
      const maxAttendeesCol = headers.findIndex(h => h.includes('attendee') || h.includes('pax') || h.includes('count') || h.includes('guests'));

      if (nameCol === -1) {
        return res.status(400).json({ error: 'Excel must have a "Name" column. Please include at least Name and Phone columns.' });
      }

      const guests: any[] = [];
      let skipped = 0;
      worksheet.eachRow((row: any, rowNumber: number) => {
        if (rowNumber === 1) return;
        const name = String(row.getCell(nameCol + 1).value || '').trim();
        if (!name) { skipped++; return; }

        const phone = phoneCol >= 0 ? String(row.getCell(phoneCol + 1).value || '').trim() : '';
        const email = emailCol >= 0 ? String(row.getCell(emailCol + 1).value || '').trim() : '';
        const relationship = relationCol >= 0 ? String(row.getCell(relationCol + 1).value || '').trim() : '';
        const guestGroup = groupCol >= 0 ? String(row.getCell(groupCol + 1).value || '').trim() : '';
        const maxAttendees = maxAttendeesCol >= 0 ? parseInt(String(row.getCell(maxAttendeesCol + 1).value || '1')) || 1 : 1;

        guests.push({
          eventId,
          name,
          phone: phone || 'N/A',
          email: email || undefined,
          relationship: relationship || undefined,
          guestGroup: guestGroup || undefined,
          maxAttendees,
        });
      });

      if (guests.length === 0) {
        return res.status(400).json({ error: 'No valid guests found in the Excel file. Make sure rows have names.' });
      }

      const created = await storage.bulkCreateEventGuests(guests);
      res.json({ success: true, imported: created.length, skipped, total: guests.length });
    } catch (error: any) {
      console.error('[Portal RSVP Upload] Error:', error);
      res.status(500).json({ error: error.message || 'Failed to process Excel file' });
    }
  });

  // Portal client: Download guest list template Excel
  app.get('/api/my-portal/rsvp/template', async (req, res) => {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Guest List');

      sheet.columns = [
        { header: 'Name', key: 'name', width: 25 },
        { header: 'Phone', key: 'phone', width: 18 },
        { header: 'Email', key: 'email', width: 25 },
        { header: 'Relationship', key: 'relationship', width: 20 },
        { header: 'Group', key: 'group', width: 20 },
        { header: 'Max Attendees', key: 'maxAttendees', width: 15 },
      ];

      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4B7C29' } };

      sheet.addRow({ name: 'John Doe', phone: '9876543210', email: 'john@example.com', relationship: "Groom's Family", group: 'VIP', maxAttendees: 3 });
      sheet.addRow({ name: 'Jane Smith', phone: '9876543211', email: 'jane@example.com', relationship: "Bride's Family", group: 'Close Family', maxAttendees: 2 });

      res.setHeader('Content-Disposition', 'attachment; filename=Guest_List_Template.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      await workbook.xlsx.write(res);
      res.end();
    } catch (error: any) {
      console.error('Error generating template:', error);
      res.status(500).json({ error: 'Failed to generate template' });
    }
  });

  app.get('/api/admin/portal-leads/:id/preview', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || !['superadmin', 'admin', 'wedding_planner'].includes(user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    try {
      const lead = await storage.getPortalLead(req.params.id);
      if (!lead) {
        return res.status(404).json({ error: 'Portal lead not found' });
      }
      
      const estimates: any[] = [];
      const normalizePhone = (phone: string) => phone?.replace(/\D/g, '').slice(-10) || '';
      const leadPhoneNorm = normalizePhone(lead.phone);
      const leadWhatsappNorm = normalizePhone(lead.whatsappNumber);
      
      if (lead.sharedEstimateId) {
        const estimate = await storage.getEstimate(lead.sharedEstimateId);
        if (estimate) {
          estimates.push({
            id: estimate.id,
            estimateNumber: (estimate as any).number,
            title: (estimate as any).subject || (estimate as any).leadName || 'Estimate',
            total: estimate.total,
            status: estimate.status,
            sharedAt: lead.documentsSharedAt,
            customerName: lead.name,
          });
        }
      }
      
      const allEstimates = await storage.getAllEstimates();
      const customerEstimates = allEstimates.filter((est: any) => {
        if (est.sharedToPortal !== true) return false;
        const estPhoneNorm = normalizePhone(est.customerPhone || est.customerWhatsapp || '');
        const phoneMatch = estPhoneNorm && (estPhoneNorm === leadPhoneNorm || estPhoneNorm === leadWhatsappNorm);
        const emailMatch = est.customerEmail && est.customerEmail.toLowerCase() === lead.email?.toLowerCase();
        return phoneMatch || emailMatch;
      });
      
      for (const est of customerEstimates) {
        if (!estimates.find(e => e.id === est.id)) {
          estimates.push({
            id: est.id,
            estimateNumber: est.number,
            title: est.subject || est.leadName || 'Estimate',
            total: est.total,
            status: est.status,
            sharedAt: est.sharedToPortalAt || est.createdAt,
            customerName: est.leadName || lead.name,
          });
        }
      }
      
      const presentations: any[] = [];
      if (lead.sharedPresentationId) {
        const presentation = await storage.getPresentation(lead.sharedPresentationId);
        if (presentation) {
          presentations.push({
            id: presentation.id,
            title: presentation.title,
            sharedAt: lead.documentsSharedAt,
          });
        }
      }
      if (lead.sharedEstimateUrl) {
        let estUrl = lead.sharedEstimateUrl;
        try {
          const objectStorage = new ObjectStorageService();
          if (lead.sharedEstimateObjectPath) {
            estUrl = await objectStorage.refreshSignedUrl(lead.sharedEstimateObjectPath);
          } else if (estUrl.includes('storage.googleapis.com/replit-objstore')) {
            const urlObj = new URL(estUrl);
            const pathParts = urlObj.pathname.split('/');
            const bucketName = pathParts[1];
            const objectName = pathParts.slice(2).join('/');
            estUrl = await objectStorage.refreshSignedUrl(`${bucketName}/${objectName}`);
          }
        } catch (e) {
          console.error('[Portal Preview] Failed to refresh estimate URL:', e);
        }
        estimates.push({
          id: `url-est-${lead.id}`,
          estimateNumber: 'Uploaded Estimate',
          title: 'Estimate',
          total: '',
          status: 'shared',
          sharedAt: lead.documentsSharedAt,
          customerName: lead.name,
          url: estUrl,
        });
      }
      
      if (lead.sharedPresentationUrl) {
        let presUrl = lead.sharedPresentationUrl;
        try {
          const objectStorage = new ObjectStorageService();
          if (lead.sharedPresentationObjectPath) {
            presUrl = await objectStorage.refreshSignedUrl(lead.sharedPresentationObjectPath);
          } else if (presUrl.includes('storage.googleapis.com/replit-objstore')) {
            const urlObj = new URL(presUrl);
            const pathParts = urlObj.pathname.split('/');
            const bucketName = pathParts[1];
            const objectName = pathParts.slice(2).join('/');
            presUrl = await objectStorage.refreshSignedUrl(`${bucketName}/${objectName}`);
          }
        } catch (e) {
          console.error('[Portal Preview] Failed to refresh presentation URL:', e);
        }
        presentations.push({
          id: `url-pres-${lead.id}`,
          title: 'Presentation',
          url: presUrl,
          sharedAt: lead.documentsSharedAt,
        });
      }
      
      const timeline: any[] = [];
      if (lead.dealId) {
        const deal = await storage.getSalesDeal(lead.dealId);
        if (deal && deal.eventId) {
          const milestones = await storage.getMilestonesByEventId(deal.eventId);
          for (const m of milestones) {
            timeline.push({
              id: m.id,
              title: m.title,
              date: m.dueDate,
              status: m.status,
            });
          }
        }
      }
      
      res.json({
        lead: {
          id: lead.id,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          eventDate: lead.eventDate,
          eventType: lead.eventType,
          venue: lead.venue,
          phase: lead.phase,
          assignedPlannerName: lead.assignedPlannerName,
          portalToken: lead.portalToken,
          rsvpEnabled: lead.rsvpEnabled || false,
          eventId: lead.eventId || null,
        },
        estimates,
        presentations,
        timeline,
        isPreview: true,
      });
    } catch (error: any) {
      console.error('[Portal Preview] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // MILESTONE SYSTEM ENDPOINTS
  // ============================================

  // Default milestone template for new projects
  const DEFAULT_MILESTONE_PHASES = [
    { phaseNumber: 1, phaseName: 'Project Kickoff', daysBeforeStart: -90, daysBeforeEnd: -75, tasks: [
      'Client onboarding', 'Agreement approval', 'Advance payment confirmation', 'Event basic details submission', 'Budget lock', 'Theme preference selection', 'Primary contact setup'
    ]},
    { phaseNumber: 2, phaseName: 'Creative Planning', daysBeforeStart: -75, daysBeforeEnd: -60, tasks: [
      'Theme finalization', 'Mood board approval', 'Stage design approval', 'Lighting style selection', 'Decor style lock', 'Entertainment requirement confirmation'
    ]},
    { phaseNumber: 3, phaseName: 'Vendor Booking', daysBeforeStart: -60, daysBeforeEnd: -45, tasks: [
      'Photographer booking', 'Makeup artist booking', 'Decor team confirmation', 'Sound & light vendor lock', 'Catering planning', 'Vendor contract uploads', 'Payment milestone tracking'
    ]},
    { phaseNumber: 4, phaseName: 'Event Architecture', daysBeforeStart: -45, daysBeforeEnd: -30, tasks: [
      'Event flow timeline creation', 'Seating layout draft', 'Stage layout approval', 'Entry & ceremony sequence planning', 'Guest hospitality planning', 'Transportation planning', 'Accommodation coordination'
    ]},
    { phaseNumber: 5, phaseName: 'Production Setup', daysBeforeStart: -30, daysBeforeEnd: -15, tasks: [
      'Final design render approval', 'Print material finalization', 'Artist performance confirmation', 'Technical requirement lock', 'Dry run scheduling', 'Partial final payment tracking'
    ]},
    { phaseNumber: 6, phaseName: 'Final Coordination', daysBeforeStart: -15, daysBeforeEnd: -3, tasks: [
      'Final guest count confirmation', 'Vendor call sheet generation', 'Staff allocation', 'Equipment checklist verification', 'Emergency backup planning', 'Final event timeline approval'
    ]},
    { phaseNumber: 7, phaseName: 'Event Execution', daysBeforeStart: -2, daysBeforeEnd: 0, tasks: [
      'Venue setup tracking', 'Stage installation monitoring', 'Lighting and sound testing', 'Vendor arrival tracking', 'Live coordination status updates', 'Client live notifications'
    ]},
    { phaseNumber: 8, phaseName: 'Post Event', daysBeforeStart: 1, daysBeforeEnd: 30, tasks: [
      'Final settlement tracking', 'Album selection upload', 'Video delivery timeline tracking', 'Feedback collection', 'Memory gallery upload', 'Project closure status'
    ]}
  ];

  // Initialize milestones for a lead
  app.post('/api/admin/milestones/:leadId/initialize', async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin', 'wedding_planner'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      const { leadId } = req.params;
      const { eventDate } = req.body;
      
      // Update lead with event date
      if (eventDate) {
        await db.update(portalLeads)
          .set({ eventDate, updatedAt: new Date() })
          .where(eq(portalLeads.id, leadId));
      }
      
      // Delete existing milestones for this lead
      await db.delete(portalMilestonePhases).where(eq(portalMilestonePhases.portalLeadId, leadId));
      
      // Create phases and tasks
      for (let i = 0; i < DEFAULT_MILESTONE_PHASES.length; i++) {
        const phase = DEFAULT_MILESTONE_PHASES[i];
        const [createdPhase] = await db.insert(portalMilestonePhases).values({
          portalLeadId: leadId,
          phaseNumber: phase.phaseNumber,
          phaseName: phase.phaseName,
          daysBeforeStart: phase.daysBeforeStart,
          daysBeforeEnd: phase.daysBeforeEnd,
          status: 'upcoming',
          sortOrder: i
        }).returning();
        
        // Create tasks for this phase
        for (let j = 0; j < phase.tasks.length; j++) {
          await db.insert(portalMilestoneTasks).values({
            phaseId: createdPhase.id,
            portalLeadId: leadId,
            taskName: phase.tasks[j],
            status: 'pending',
            isCompleted: false,
            sortOrder: j
          });
        }
      }
      
      res.json({ success: true, message: 'Milestones initialized successfully' });
    } catch (error: any) {
      console.error('Error initializing milestones:', error);
      res.status(500).json({ error: 'Failed to initialize milestones' });
    }
  });

  // Get milestones for a lead (admin)
  app.get('/api/admin/milestones/:leadId', async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin', 'wedding_planner'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      const { leadId } = req.params;
      
      // Get lead with event date
      const [lead] = await db.select().from(portalLeads).where(eq(portalLeads.id, leadId));
      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }
      
      // Get phases with tasks
      const phases = await db.select().from(portalMilestonePhases)
        .where(eq(portalMilestonePhases.portalLeadId, leadId))
        .orderBy(portalMilestonePhases.sortOrder);
      
      const phasesWithTasks = await Promise.all(phases.map(async (phase) => {
        const tasks = await db.select().from(portalMilestoneTasks)
          .where(eq(portalMilestoneTasks.phaseId, phase.id))
          .orderBy(portalMilestoneTasks.sortOrder);
        return { ...phase, tasks };
      }));
      
      // Calculate progress
      const allTasks = phasesWithTasks.flatMap(p => p.tasks);
      const completedTasks = allTasks.filter(t => t.isCompleted).length;
      const totalTasks = allTasks.length;
      const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      
      res.json({
        lead: { id: lead.id, name: lead.name, eventDate: lead.eventDate },
        phases: phasesWithTasks,
        progress: { completed: completedTasks, total: totalTasks, percentage: overallProgress }
      });
    } catch (error: any) {
      console.error('Error fetching milestones:', error);
      res.status(500).json({ error: 'Failed to fetch milestones' });
    }
  });

  // Update event date and recalculate dates
  app.patch('/api/admin/milestones/:leadId/event-date', async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin', 'wedding_planner'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      const { leadId } = req.params;
      const { eventDate } = req.body;
      
      await db.update(portalLeads)
        .set({ eventDate, updatedAt: new Date() })
        .where(eq(portalLeads.id, leadId));
      
      res.json({ success: true, message: 'Event date updated' });
    } catch (error: any) {
      console.error('Error updating event date:', error);
      res.status(500).json({ error: 'Failed to update event date' });
    }
  });

  // Update phase (admin)
  app.patch('/api/admin/milestones/phases/:phaseId', async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin', 'wedding_planner'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      const { phaseId } = req.params;
      const { phaseName, daysBeforeStart, daysBeforeEnd, status, isLocked } = req.body;
      
      const updateData: any = { updatedAt: new Date() };
      if (phaseName !== undefined) updateData.phaseName = phaseName;
      if (daysBeforeStart !== undefined) updateData.daysBeforeStart = daysBeforeStart;
      if (daysBeforeEnd !== undefined) updateData.daysBeforeEnd = daysBeforeEnd;
      if (status !== undefined) updateData.status = status;
      if (isLocked !== undefined) {
        updateData.isLocked = isLocked;
        if (isLocked) {
          updateData.lockedAt = new Date();
          updateData.lockedBy = user.id;
        }
      }
      
      const [updated] = await db.update(portalMilestonePhases)
        .set(updateData)
        .where(eq(portalMilestonePhases.id, phaseId))
        .returning();
      
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating phase:', error);
      res.status(500).json({ error: 'Failed to update phase' });
    }
  });

  // Update task (admin)
  app.patch('/api/admin/milestones/tasks/:taskId', async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin', 'wedding_planner'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      const { taskId } = req.params;
      const { taskName, description, status, isCompleted, dueDate, requiresUpload, isClientTask, isApprovalRequired, notes } = req.body;
      
      const updateData: any = { updatedAt: new Date() };
      if (taskName !== undefined) updateData.taskName = taskName;
      if (description !== undefined) updateData.description = description;
      if (status !== undefined) updateData.status = status;
      if (dueDate !== undefined) updateData.dueDate = dueDate;
      if (requiresUpload !== undefined) updateData.requiresUpload = requiresUpload;
      if (isClientTask !== undefined) updateData.isClientTask = isClientTask;
      if (isApprovalRequired !== undefined) updateData.isApprovalRequired = isApprovalRequired;
      if (notes !== undefined) updateData.notes = notes;
      if (isCompleted !== undefined) {
        updateData.isCompleted = isCompleted;
        updateData.status = isCompleted ? 'completed' : 'pending';
        if (isCompleted) {
          updateData.completedAt = new Date();
          updateData.completedBy = user.id;
        } else {
          updateData.completedAt = null;
          updateData.completedBy = null;
        }
      }
      
      const [updated] = await db.update(portalMilestoneTasks)
        .set(updateData)
        .where(eq(portalMilestoneTasks.id, taskId))
        .returning();
      
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating task:', error);
      res.status(500).json({ error: 'Failed to update task' });
    }
  });

  // Add new task to phase (admin)
  app.post('/api/admin/milestones/phases/:phaseId/tasks', async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin', 'wedding_planner'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      const { phaseId } = req.params;
      const { taskName, description, requiresUpload, isClientTask, isApprovalRequired } = req.body;
      
      // Get phase to get leadId
      const [phase] = await db.select().from(portalMilestonePhases).where(eq(portalMilestonePhases.id, phaseId));
      if (!phase) {
        return res.status(404).json({ error: 'Phase not found' });
      }
      
      // Get max sort order
      const tasks = await db.select().from(portalMilestoneTasks).where(eq(portalMilestoneTasks.phaseId, phaseId));
      const maxOrder = tasks.length > 0 ? Math.max(...tasks.map(t => t.sortOrder || 0)) : -1;
      
      const [task] = await db.insert(portalMilestoneTasks).values({
        phaseId,
        portalLeadId: phase.portalLeadId,
        taskName,
        description,
        requiresUpload: requiresUpload || false,
        isClientTask: isClientTask || false,
        isApprovalRequired: isApprovalRequired || false,
        sortOrder: maxOrder + 1
      }).returning();
      
      res.json(task);
    } catch (error: any) {
      console.error('Error adding task:', error);
      res.status(500).json({ error: 'Failed to add task' });
    }
  });

  // Delete task (admin)
  app.delete('/api/admin/milestones/tasks/:taskId', async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin', 'wedding_planner'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      const { taskId } = req.params;
      await db.delete(portalMilestoneTasks).where(eq(portalMilestoneTasks.id, taskId));
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting task:', error);
      res.status(500).json({ error: 'Failed to delete task' });
    }
  });

  // NOTE: /api/portal/milestones route moved before catch-all :token route (see above)

  // Client complete task (for client-accessible tasks)
  app.patch('/api/portal/milestones/tasks/:taskId/complete', async (req, res) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
      if (!token) {
        return res.status(401).json({ error: 'Portal token required' });
      }
      
      const [lead] = await db.select().from(portalLeads).where(eq(portalLeads.portalToken, token as string));
      if (!lead) {
        return res.status(404).json({ error: 'Invalid portal token' });
      }
      
      const { taskId } = req.params;
      
      // Verify task belongs to this lead and is client-accessible
      const [task] = await db.select().from(portalMilestoneTasks)
        .where(and(eq(portalMilestoneTasks.id, taskId), eq(portalMilestoneTasks.portalLeadId, lead.id)));
      
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      if (!task.isClientTask) {
        return res.status(403).json({ error: 'This task cannot be completed by client' });
      }
      
      const [updated] = await db.update(portalMilestoneTasks)
        .set({
          isCompleted: true,
          status: 'completed',
          completedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(portalMilestoneTasks.id, taskId))
        .returning();
      
      res.json(updated);
    } catch (error: any) {
      console.error('Error completing task:', error);
      res.status(500).json({ error: 'Failed to complete task' });
    }
  });

  // Client upload document for task
  app.patch('/api/portal/milestones/tasks/:taskId/upload', async (req, res) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
      if (!token) {
        return res.status(401).json({ error: 'Portal token required' });
      }
      
      const [lead] = await db.select().from(portalLeads).where(eq(portalLeads.portalToken, token as string));
      if (!lead) {
        return res.status(404).json({ error: 'Invalid portal token' });
      }
      
      const { taskId } = req.params;
      const { uploadUrl, uploadName } = req.body;
      
      // Verify task belongs to this lead
      const [task] = await db.select().from(portalMilestoneTasks)
        .where(and(eq(portalMilestoneTasks.id, taskId), eq(portalMilestoneTasks.portalLeadId, lead.id)));
      
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      const [updated] = await db.update(portalMilestoneTasks)
        .set({
          uploadUrl,
          uploadName,
          uploadedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(portalMilestoneTasks.id, taskId))
        .returning();
      
      res.json(updated);
    } catch (error: any) {
      console.error('Error uploading to task:', error);
      res.status(500).json({ error: 'Failed to upload' });
    }
  });

  // NOTE: /api/portal/event-flows route moved before catch-all :token route (see above)

  // ========== ADMIN EVENT FLOWS MANAGEMENT ==========

  // Get all event flows for a lead (admin)
  app.get('/api/admin/event-flows/:leadId', async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin', 'wedding_planner'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      const { leadId } = req.params;
      
      const flows = await db.select().from(portalEventFlows)
        .where(eq(portalEventFlows.portalLeadId, leadId))
        .orderBy(portalEventFlows.sortOrder);
      
      const flowsWithItems = await Promise.all(flows.map(async (flow) => {
        const items = await db.select().from(portalEventFlowItems)
          .where(eq(portalEventFlowItems.eventFlowId, flow.id))
          .orderBy(portalEventFlowItems.sortOrder);
        return { ...flow, items };
      }));
      
      res.json({ eventFlows: flowsWithItems });
    } catch (error: any) {
      console.error('Error fetching event flows:', error);
      res.status(500).json({ error: 'Failed to fetch event flows' });
    }
  });

  // Default event flow template items (wedding activities)
  const DEFAULT_EVENT_FLOW_TEMPLATE = [
    { title: 'Bridal Make up', startTime: '04:00 AM', category: 'other', sortOrder: 0 },
    { title: 'Guest Makeup (Both mothers and groom - sister Make up)', startTime: '04:00 AM', category: 'other', sortOrder: 1 },
    { title: 'Bridal & guest Make up done by', startTime: '06:30 AM', category: 'other', sortOrder: 2 },
    { title: 'Groom Make up', startTime: '06:30 AM', category: 'other', sortOrder: 3 },
    { title: 'Groom Make up done by', startTime: '07:00 AM', category: 'other', sortOrder: 4 },
    { title: 'Couple shoot', startTime: '07:30 AM', endTime: '09:30 AM', category: 'photo', sortOrder: 5 },
    { title: 'Guest arrival to venue', startTime: '10:00 AM', category: 'ceremony', sortOrder: 6 },
    { title: 'Refreshment counter starts', startTime: '10:00 AM', category: 'food', sortOrder: 7 },
    { title: 'Para niraykkal', startTime: '10:05 AM', category: 'ceremony', sortOrder: 8 },
    { title: 'Groom entry with thalam', startTime: '10:10 AM', category: 'ceremony', sortOrder: 9 },
    { title: 'Bride entry with thalam', startTime: '10:20 AM', category: 'ceremony', sortOrder: 10 },
    { title: 'Garland exchange', startTime: '10:30 AM', category: 'ceremony', sortOrder: 11 },
    { title: 'Lunch', startTime: '11:30 AM', category: 'food', sortOrder: 12 },
    { title: 'Winding up', startTime: '01:00 PM', category: 'other', sortOrder: 13 },
  ];

  // Create event flow (admin)
  app.post('/api/admin/event-flows/:leadId', async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin', 'wedding_planner'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      const { leadId } = req.params;
      const { eventName, eventDate, eventTime, venue, venueAddress, description, useTemplate } = req.body;
      
      const existingFlows = await db.select().from(portalEventFlows)
        .where(eq(portalEventFlows.portalLeadId, leadId));
      
      const [flow] = await db.insert(portalEventFlows).values({
        portalLeadId: leadId,
        eventName,
        eventDate,
        eventTime,
        venue,
        venueAddress,
        description,
        sortOrder: existingFlows.length,
        createdBy: user.id
      }).returning();
      
      // If useTemplate is true (or if this is a wedding-type event), add default template items
      if (useTemplate || eventName?.toLowerCase().includes('wedding')) {
        const templateItems = DEFAULT_EVENT_FLOW_TEMPLATE.map(item => ({
          eventFlowId: flow.id,
          portalLeadId: leadId,
          title: item.title,
          startTime: item.startTime,
          endTime: item.endTime || null,
          category: item.category,
          sortOrder: item.sortOrder
        }));
        
        await db.insert(portalEventFlowItems).values(templateItems);
      }
      
      res.json(flow);
    } catch (error: any) {
      console.error('Error creating event flow:', error);
      res.status(500).json({ error: 'Failed to create event flow' });
    }
  });

  // Update event flow (admin)
  app.patch('/api/admin/event-flows/:flowId', async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin', 'wedding_planner'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      const { flowId } = req.params;
      const updates = req.body;
      
      const [updated] = await db.update(portalEventFlows)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(portalEventFlows.id, flowId))
        .returning();
      
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating event flow:', error);
      res.status(500).json({ error: 'Failed to update event flow' });
    }
  });

  // Publish/unpublish event flow (admin)
  app.patch('/api/admin/event-flows/:flowId/publish', async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin', 'wedding_planner'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      const { flowId } = req.params;
      const { isPublished } = req.body;
      
      const [updated] = await db.update(portalEventFlows)
        .set({
          isPublished,
          publishedAt: isPublished ? new Date() : null,
          publishedBy: isPublished ? user.id : null,
          updatedAt: new Date()
        })
        .where(eq(portalEventFlows.id, flowId))
        .returning();
      
      res.json(updated);
    } catch (error: any) {
      console.error('Error publishing event flow:', error);
      res.status(500).json({ error: 'Failed to publish event flow' });
    }
  });

  // Delete event flow (admin)
  app.delete('/api/admin/event-flows/:flowId', async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin', 'wedding_planner'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      const { flowId } = req.params;
      await db.delete(portalEventFlows).where(eq(portalEventFlows.id, flowId));
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting event flow:', error);
      res.status(500).json({ error: 'Failed to delete event flow' });
    }
  });

  // Add event flow item (admin)
  app.post('/api/admin/event-flows/:flowId/items', async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin', 'wedding_planner'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      const { flowId } = req.params;
      const { title, description, startTime, endTime, duration, category, notes } = req.body;
      
      // Get flow to get leadId
      const [flow] = await db.select().from(portalEventFlows).where(eq(portalEventFlows.id, flowId));
      if (!flow) {
        return res.status(404).json({ error: 'Event flow not found' });
      }
      
      const existingItems = await db.select().from(portalEventFlowItems)
        .where(eq(portalEventFlowItems.eventFlowId, flowId));
      
      const [item] = await db.insert(portalEventFlowItems).values({
        eventFlowId: flowId,
        portalLeadId: flow.portalLeadId,
        title,
        description,
        startTime,
        endTime,
        duration,
        category,
        notes,
        sortOrder: existingItems.length
      }).returning();
      
      res.json(item);
    } catch (error: any) {
      console.error('Error adding flow item:', error);
      res.status(500).json({ error: 'Failed to add item' });
    }
  });

  // Load default template into event flow (admin)
  app.post('/api/admin/event-flows/:flowId/load-template', async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin', 'wedding_planner'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      const { flowId } = req.params;
      
      // Get flow to get leadId
      const [flow] = await db.select().from(portalEventFlows).where(eq(portalEventFlows.id, flowId));
      if (!flow) {
        return res.status(404).json({ error: 'Event flow not found' });
      }
      
      // Check if flow already has items
      const existingItems = await db.select().from(portalEventFlowItems)
        .where(eq(portalEventFlowItems.eventFlowId, flowId));
      
      if (existingItems.length > 0) {
        return res.status(400).json({ error: 'Event flow already has items. Please delete existing items first.' });
      }
      
      // Insert default template items
      const templateItems = DEFAULT_EVENT_FLOW_TEMPLATE.map(item => ({
        eventFlowId: flowId,
        portalLeadId: flow.portalLeadId,
        title: item.title,
        startTime: item.startTime,
        endTime: item.endTime || null,
        category: item.category,
        sortOrder: item.sortOrder
      }));
      
      await db.insert(portalEventFlowItems).values(templateItems);
      
      res.json({ success: true, message: 'Default template loaded successfully', itemsAdded: templateItems.length });
    } catch (error: any) {
      console.error('Error loading template:', error);
      res.status(500).json({ error: 'Failed to load template' });
    }
  });

  // Update event flow item (admin)
  app.patch('/api/admin/event-flow-items/:itemId', async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin', 'wedding_planner'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      const { itemId } = req.params;
      const updates = req.body;
      
      const [updated] = await db.update(portalEventFlowItems)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(portalEventFlowItems.id, itemId))
        .returning();
      
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating flow item:', error);
      res.status(500).json({ error: 'Failed to update item' });
    }
  });

  // Delete event flow item (admin)
  app.delete('/api/admin/event-flow-items/:itemId', async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin', 'wedding_planner'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      const { itemId } = req.params;
      await db.delete(portalEventFlowItems).where(eq(portalEventFlowItems.id, itemId));
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting flow item:', error);
      res.status(500).json({ error: 'Failed to delete item' });
    }
  });

  // ========== ADMIN FINANCIAL MILESTONES MANAGEMENT ==========

  // Default payment milestones template
  const DEFAULT_PAYMENT_MILESTONES = [
    { milestoneName: 'Advance Payment', percentage: 15, dueDescription: 'On booking confirmation', daysBefore: null, sortOrder: 0 },
    { milestoneName: '2 Months Before Event', percentage: 40, dueDescription: '2 months before event date', daysBefore: -60, sortOrder: 1 },
    { milestoneName: '2 Weeks Before Event', percentage: 40, dueDescription: '2 weeks before event date', daysBefore: -14, sortOrder: 2 },
    { milestoneName: 'Event Day', percentage: 5, dueDescription: 'On the event date', daysBefore: 0, sortOrder: 3 }
  ];

  // Initialize financial milestones for a lead
  app.post('/api/admin/financial-milestones/:leadId/initialize', async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin', 'wedding_planner'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      const { leadId } = req.params;
      const { totalAmount, eventDate } = req.body;
      
      // Delete existing milestones
      await db.delete(portalFinancialMilestones).where(eq(portalFinancialMilestones.portalLeadId, leadId));
      
      // Calculate due dates based on event date
      const eventDateObj = eventDate ? new Date(eventDate) : null;
      
      // Create milestones
      for (const template of DEFAULT_PAYMENT_MILESTONES) {
        let dueDate = null;
        if (eventDateObj && template.daysBefore !== null) {
          const dueDateObj = new Date(eventDateObj);
          dueDateObj.setDate(dueDateObj.getDate() + template.daysBefore);
          dueDate = dueDateObj.toISOString().split('T')[0];
        }
        
        const amount = totalAmount ? (parseFloat(totalAmount) * template.percentage / 100).toFixed(2) : null;
        
        await db.insert(portalFinancialMilestones).values({
          portalLeadId: leadId,
          milestoneName: template.milestoneName,
          percentage: template.percentage.toString(),
          amount,
          dueDescription: template.dueDescription,
          dueDate,
          daysBefore: template.daysBefore,
          sortOrder: template.sortOrder
        });
      }
      
      res.json({ success: true, message: 'Financial milestones initialized' });
    } catch (error: any) {
      console.error('Error initializing financial milestones:', error);
      res.status(500).json({ error: 'Failed to initialize financial milestones' });
    }
  });

  // Get financial milestones for a lead (admin)
  app.get('/api/admin/financial-milestones/:leadId', async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin', 'wedding_planner'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      const { leadId } = req.params;
      
      const milestones = await db.select().from(portalFinancialMilestones)
        .where(eq(portalFinancialMilestones.portalLeadId, leadId))
        .orderBy(portalFinancialMilestones.sortOrder);
      
      // Calculate totals (include partial payments in received amount)
      const totalAmount = milestones.reduce((sum, m) => sum + parseFloat(m.amount || '0'), 0);
      const paidAmount = milestones.reduce((sum, m) => sum + parseFloat(m.paidAmount || '0'), 0);
      
      res.json({
        milestones,
        summary: {
          totalAmount,
          paidAmount,
          pendingAmount: totalAmount - paidAmount,
          totalMilestones: milestones.length,
          completedMilestones: milestones.filter(m => m.isPaid).length
        }
      });
    } catch (error: any) {
      console.error('Error fetching financial milestones:', error);
      res.status(500).json({ error: 'Failed to fetch financial milestones' });
    }
  });

  // Update financial milestone (admin)
  app.patch('/api/admin/financial-milestones/:milestoneId', async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin', 'wedding_planner'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      const { milestoneId } = req.params;
      const { adjustRemaining, ...updates } = req.body;
      
      // Get the original total BEFORE updating (sum of all milestone amounts = deal value)
      let originalTotal = 0;
      let originalLeadId = '';
      if (adjustRemaining) {
        const currentMilestone = await db.select().from(portalFinancialMilestones)
          .where(eq(portalFinancialMilestones.id, milestoneId));
        if (currentMilestone.length > 0) {
          originalLeadId = currentMilestone[0].portalLeadId;
          const allBefore = await db.select().from(portalFinancialMilestones)
            .where(eq(portalFinancialMilestones.portalLeadId, originalLeadId))
            .orderBy(portalFinancialMilestones.sortOrder);
          originalTotal = allBefore.reduce((sum, m) => sum + parseFloat(m.amount || '0'), 0);
        }
      }

      // If user changed amount but not percentage, recalculate percentage from amount
      if (adjustRemaining && updates.amount && originalTotal > 0) {
        const newAmount = parseFloat(updates.amount);
        updates.percentage = ((newAmount / originalTotal) * 100).toFixed(2);
      }
      
      const [updated] = await db.update(portalFinancialMilestones)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(portalFinancialMilestones.id, milestoneId))
        .returning();
      
      if (adjustRemaining && updated && originalTotal > 0) {
        const allMilestones = await db.select().from(portalFinancialMilestones)
          .where(eq(portalFinancialMilestones.portalLeadId, updated.portalLeadId))
          .orderBy(portalFinancialMilestones.sortOrder);
        
        const editedSortOrder = updated.sortOrder ?? 0;
        const lastMilestone = allMilestones[allMilestones.length - 1];
        const lastPct = 5;
        
        // Sum percentages of milestones at or before the edited one (these are locked/already set)
        const lockedPct = allMilestones
          .filter(m => (m.sortOrder ?? 0) <= editedSortOrder && m.id !== lastMilestone?.id)
          .reduce((sum, m) => sum + parseFloat(m.percentage || '0'), 0);
        
        // Only adjust milestones AFTER the edited one (excluding the last which stays at 5%)
        const adjustableMilestones = allMilestones.filter(m => 
          (m.sortOrder ?? 0) > editedSortOrder && 
          m.id !== lastMilestone?.id && 
          !m.isPaid
        );
        
        const usedPct = lockedPct + lastPct;
        const remainingPct = Math.max(0, 100 - usedPct);
        
        if (adjustableMilestones.length > 0) {
          const perMilestonePct = parseFloat((remainingPct / adjustableMilestones.length).toFixed(2));
          
          for (const m of adjustableMilestones) {
            const newAmount = ((perMilestonePct / 100) * originalTotal).toFixed(2);
            await db.update(portalFinancialMilestones)
              .set({ percentage: perMilestonePct.toString(), amount: newAmount, updatedAt: new Date() })
              .where(eq(portalFinancialMilestones.id, m.id));
          }
        }
          
        if (lastMilestone && lastMilestone.id !== updated.id && !lastMilestone.isPaid) {
          const lastAmount = ((lastPct / 100) * originalTotal).toFixed(2);
          await db.update(portalFinancialMilestones)
            .set({ percentage: lastPct.toString(), amount: lastAmount, updatedAt: new Date() })
            .where(eq(portalFinancialMilestones.id, lastMilestone.id));
        }
      }
      
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating financial milestone:', error);
      res.status(500).json({ error: 'Failed to update milestone' });
    }
  });

  // Confirm payment for milestone (admin)
  app.patch('/api/admin/financial-milestones/:milestoneId/confirm-payment', async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin', 'wedding_planner'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      const { milestoneId } = req.params;
      const { paidAmount, paymentMethod, paymentReference, notes, paidDate, isEditMode } = req.body;
      
      const [existing] = await db.select().from(portalFinancialMilestones)
        .where(eq(portalFinancialMilestones.id, milestoneId));
      
      if (!existing) {
        return res.status(404).json({ error: 'Milestone not found' });
      }

      const previousPaid = parseFloat(existing.paidAmount || '0');
      const newPayment = parseFloat(paidAmount || '0');
      const milestoneAmount = parseFloat(existing.amount || '0');
      const totalPaid = isEditMode ? newPayment : (previousPaid + newPayment);
      const isFullyPaid = totalPaid >= milestoneAmount;

      const [updated] = await db.update(portalFinancialMilestones)
        .set({
          isPaid: isFullyPaid,
          paidAmount: totalPaid.toFixed(2),
          paidAt: paidDate ? new Date(paidDate) : new Date(),
          paymentMethod,
          paymentReference,
          confirmedBy: user.id,
          confirmedAt: new Date(),
          notes: existing.notes ? `${existing.notes}\n${notes || ''}`.trim() : (notes || ''),
          updatedAt: new Date()
        })
        .where(eq(portalFinancialMilestones.id, milestoneId))
        .returning();
      
      res.json(updated);
    } catch (error: any) {
      console.error('Error confirming payment:', error);
      res.status(500).json({ error: 'Failed to confirm payment' });
    }
  });

  // Delete financial milestone (admin)
  app.delete('/api/admin/financial-milestones/:milestoneId', async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin', 'wedding_planner'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      const { milestoneId } = req.params;
      await db.delete(portalFinancialMilestones).where(eq(portalFinancialMilestones.id, milestoneId));
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting financial milestone:', error);
      res.status(500).json({ error: 'Failed to delete milestone' });
    }
  });

  // Add custom financial milestone (admin)
  app.post('/api/admin/financial-milestones/:leadId', async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin', 'wedding_planner'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      const { leadId } = req.params;
      const { milestoneName, percentage, amount, dueDescription, dueDate, daysBefore } = req.body;
      
      const existingMilestones = await db.select().from(portalFinancialMilestones)
        .where(eq(portalFinancialMilestones.portalLeadId, leadId));
      
      const [milestone] = await db.insert(portalFinancialMilestones).values({
        portalLeadId: leadId,
        milestoneName,
        percentage,
        amount,
        dueDescription,
        dueDate,
        daysBefore,
        sortOrder: existingMilestones.length
      }).returning();
      
      res.json(milestone);
    } catch (error: any) {
      console.error('Error adding financial milestone:', error);
      res.status(500).json({ error: 'Failed to add milestone' });
    }
  });

  // ============================================
  // UPCOMING PAYMENT MILESTONES (Dashboard / MIS)
  // ============================================
  app.get('/api/admin/upcoming-payments', async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin', 'wedding_planner', 'accountant'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const allMilestones = await db.select().from(portalFinancialMilestones)
        .where(eq(portalFinancialMilestones.isPaid, false))
        .orderBy(portalFinancialMilestones.dueDate);

      const leadIds = [...new Set(allMilestones.map(m => m.portalLeadId))];
      const leads = leadIds.length > 0
        ? await db.select().from(portalLeads).where(inArray(portalLeads.id, leadIds))
        : [];
      const leadMap = Object.fromEntries(leads.map(l => [l.id, l]));

      const enriched = allMilestones.map(m => {
        const lead = leadMap[m.portalLeadId] || {} as any;
        return {
          ...m,
          clientName: lead.name || 'Unknown',
          eventDate: lead.eventDate || null,
          eventType: lead.eventType || null,
          venue: lead.venue || null,
          assignedPlannerId: lead.assignedPlannerId || null,
          assignedPlannerName: lead.assignedPlannerName || null,
          totalDealValue: lead.budgetRange || null,
        };
      });

      let filtered = enriched;
      if (user.role === 'wedding_planner') {
        filtered = enriched.filter(m => m.assignedPlannerId === user.id);
      }

      const plannerSummary: Record<string, { plannerName: string, totalPending: number, milestoneCount: number }> = {};
      enriched.forEach(m => {
        const pName = m.assignedPlannerName || 'Unassigned';
        const pId = m.assignedPlannerId || 'unassigned';
        if (!plannerSummary[pId]) {
          plannerSummary[pId] = { plannerName: pName, totalPending: 0, milestoneCount: 0 };
        }
        plannerSummary[pId].totalPending += parseFloat(m.amount || '0');
        plannerSummary[pId].milestoneCount += 1;
      });

      const overdue = filtered.filter(m => m.dueDate && new Date(m.dueDate) < new Date());
      const upcoming7Days = filtered.filter(m => {
        if (!m.dueDate) return false;
        const due = new Date(m.dueDate);
        const now = new Date();
        const in7 = new Date();
        in7.setDate(in7.getDate() + 7);
        return due >= now && due <= in7;
      });
      const upcoming30Days = filtered.filter(m => {
        if (!m.dueDate) return false;
        const due = new Date(m.dueDate);
        const now = new Date();
        const in30 = new Date();
        in30.setDate(in30.getDate() + 30);
        return due >= now && due <= in30;
      });

      const totalPending = filtered.reduce((s, m) => s + parseFloat(m.amount || '0'), 0);
      const overdueAmount = overdue.reduce((s, m) => s + parseFloat(m.amount || '0'), 0);

      res.json({
        milestones: filtered,
        summary: {
          totalPending,
          overdueAmount,
          overdueCount: overdue.length,
          next7DaysAmount: upcoming7Days.reduce((s, m) => s + parseFloat(m.amount || '0'), 0),
          next7DaysCount: upcoming7Days.length,
          next30DaysAmount: upcoming30Days.reduce((s, m) => s + parseFloat(m.amount || '0'), 0),
          next30DaysCount: upcoming30Days.length,
          totalMilestones: filtered.length,
        },
        plannerSummary: Object.values(plannerSummary),
      });
    } catch (error: any) {
      console.error('Error fetching upcoming payments:', error);
      res.status(500).json({ error: 'Failed to fetch upcoming payments' });
    }
  });

  // ============================================
  // PORTAL OAKSY AI CHAT ENDPOINTS
  // ============================================
  
  const portalOpenai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  const PORTAL_OAKSY_SYSTEM_PROMPT = `You are Oaksy, the dedicated AI wedding planner at Oakstreet Events. You are warm, knowledgeable, and passionate about creating dream celebrations. You speak naturally and conversationally, like a friend who happens to be an expert wedding planner.

ABOUT OAKSTREET EVENTS:
- Premium event management company based in Kerala, specializing in luxury weddings and celebrations
- Services: End-to-end wedding planning, venue selection, theme design, luxury decor & floral styling, lighting design, sound & entertainment, photography & videography, catering, guest hospitality & RSVP management, accommodation & transportation, bridal & groom styling, invitation design, on-ground logistics, legal permissions, rehearsal & execution, post-wedding services, luxury add-ons
- 500+ events decorated, 8+ years experience, 50+ premium venues, 4.9★ client rating

YOUR PRIMARY MISSION ON THE LANDING PAGE:
You are the first point of contact for new visitors. Your goal is to warmly greet them, understand their event needs, and naturally guide them to register on the portal by collecting their details through friendly conversation.

CONVERSATIONAL REGISTRATION FLOW:
1. Start by warmly greeting and asking about their upcoming celebration
2. As they share details, naturally ask follow-up questions to collect:
   - Full name
   - Phone number  
   - WhatsApp number (ask if same as phone)
   - Email address
   - Event type (wedding, engagement, reception, sangeet, haldi, corporate, birthday, house warming, etc.)
   - Approximate event date
   - Venue name and city (if decided)
   - Expected guest count
   - Budget range (Under ₹2L, ₹2-5L, ₹5-10L, ₹10-20L, ₹20-50L, Above ₹50L)
   - Services they're interested in
   - Any special notes or vision they have
3. Don't ask all questions at once - be conversational, ask 1-2 things at a time
4. When you have at least the name, phone/WhatsApp, and email, briefly confirm: "Shall I register you with our team so a dedicated planner can reach out?" - this serves as their consent
5. Only after they agree (say yes, sure, okay, etc.), use the register_portal_lead function to submit their details
6. After registration, let them know a verification code has been sent to their WhatsApp and they should enter it to complete the process. A dedicated wedding planner will reach out within 24 hours

YOUR PERSONALITY:
- Warm, enthusiastic, and genuinely excited about their celebration
- Professional but approachable - like a trusted friend who's also a wedding expert
- Patient and encouraging - never pushy or salesy
- Use natural conversational language, not formal or robotic
- Sprinkle in appropriate emojis to be friendly (but not overdo it)
- Share small wedding tips or insights when relevant to build rapport

IMPORTANT RULES:
- Never share specific pricing - say "our planner will discuss packages tailored to your needs"
- Always be encouraging about their choices and ideas
- If they seem hesitant about sharing details, explain the benefits (dedicated planner, personalized experience)
- Keep responses SHORT - 1-2 sentences max, like a WhatsApp chat. Never write long paragraphs
- Avoid repeating what the user just said back to them
- If they ask questions you can't answer, offer to connect them with a planner
- NEVER fabricate information about specific venues, vendors, or pricing
- When collecting phone numbers, expect Indian format (+91 or 10-digit)

ESCALATION:
If they need immediate human help: WhatsApp: +91 98765 43210 | Email: info@oakstreetevents.com`;

  const PORTAL_REGISTER_LEAD_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
    type: "function",
    function: {
      name: "register_portal_lead",
      description: "Register a new client lead on the portal after collecting their details through conversation. Call this when you have at least their name, phone number, and email. Include as many other details as you've collected.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Client's full name" },
          phone: { type: "string", description: "Client's phone number" },
          whatsappNumber: { type: "string", description: "Client's WhatsApp number (may be same as phone)" },
          email: { type: "string", description: "Client's email address" },
          eventType: { type: "string", description: "Type of event: hindu_wedding, christian_wedding, muslim_wedding, engagement, reception, sangeet, haldi, corporate, birthday, house_warming, other" },
          eventDate: { type: "string", description: "Event date in YYYY-MM-DD format if known" },
          venue: { type: "string", description: "Venue name if decided" },
          venueCity: { type: "string", description: "Venue city" },
          guestCount: { type: "number", description: "Expected number of guests" },
          budgetRange: { type: "string", description: "Budget range: under_2L, 2L_5L, 5L_10L, 10L_20L, 20L_50L, above_50L" },
          servicesRequired: { type: "array", items: { type: "string" }, description: "Services needed: wedding_planning, venue_selection, theme_design, decor_floral, lighting, sound_music, photo_video, catering, guest_rsvp, accommodation, styling, invitations, logistics, legal, rehearsal, post_wedding, luxury_addons" },
          additionalNotes: { type: "string", description: "Any special notes, vision, or requirements mentioned by the client" },
          city: { type: "string", description: "Client's city" },
          address: { type: "string", description: "Client's address" }
        },
        required: ["name", "phone", "email"]
      }
    }
  };

  // Initialize or get existing chat session
  app.post('/api/portal-chat/init', async (req, res) => {
    try {
      const { sessionId, chatType, portalToken } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID required' });
      }
      
      // Find or create chat session
      const [existingChat] = await db.select().from(portalOaksyChats)
        .where(and(
          eq(portalOaksyChats.sessionId, sessionId),
          eq(portalOaksyChats.chatType, chatType || 'landing')
        ));
      
      if (existingChat) {
        return res.json(existingChat);
      }
      
      // If portal token provided, try to get lead info
      let portalLeadId = null;
      let visitorName = null;
      let visitorPhone = null;
      let visitorEmail = null;
      
      if (portalToken) {
        const [lead] = await db.select().from(portalLeads)
          .where(eq(portalLeads.portalToken, portalToken));
        if (lead) {
          portalLeadId = lead.id;
          visitorName = lead.name;
          visitorPhone = lead.phone;
          visitorEmail = lead.email;
        }
      }
      
      // Create new chat session
      const [newChat] = await db.insert(portalOaksyChats).values({
        sessionId,
        chatType: chatType || 'landing',
        portalLeadId,
        visitorName,
        visitorPhone,
        visitorEmail,
        messages: []
      }).returning();
      
      res.json(newChat);
    } catch (error: any) {
      console.error('Error initializing chat:', error);
      res.status(500).json({ error: 'Failed to initialize chat' });
    }
  });

  // Send message to Oaksy
  app.post('/api/portal-chat/message', async (req, res) => {
    try {
      const { sessionId, message, chatType, portalToken } = req.body;
      
      if (!sessionId || !message) {
        return res.status(400).json({ error: 'Session ID and message required' });
      }
      
      // Get or create chat session
      let [chat] = await db.select().from(portalOaksyChats)
        .where(and(
          eq(portalOaksyChats.sessionId, sessionId),
          eq(portalOaksyChats.chatType, chatType || 'landing')
        ));
      
      if (!chat) {
        // Create new chat
        let portalLeadId = null;
        let visitorName = null;
        
        if (portalToken) {
          const [lead] = await db.select().from(portalLeads)
            .where(eq(portalLeads.portalToken, portalToken));
          if (lead) {
            portalLeadId = lead.id;
            visitorName = lead.name;
          }
        }
        
        [chat] = await db.insert(portalOaksyChats).values({
          sessionId,
          chatType: chatType || 'landing',
          portalLeadId,
          visitorName,
          messages: []
        }).returning();
      }
      
      // Add user message to history
      const messages = (chat.messages as any[]) || [];
      messages.push({
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      });
      
      // Build context for AI
      let systemMessage = PORTAL_OAKSY_SYSTEM_PROMPT;
      
      // Add context based on chat type
      if (chatType === 'portal' && chat.portalLeadId) {
        const [lead] = await db.select().from(portalLeads)
          .where(eq(portalLeads.id, chat.portalLeadId));
        if (lead) {
          systemMessage += `\n\nCURRENT CLIENT CONTEXT:
- Client Name: ${lead.name}
- Event Type: ${lead.eventType || 'Wedding'}
- Event Date: ${lead.eventDate || 'TBD'}
- Stage: ${lead.stage || 'Inquiry'}
You are assisting them with their ${lead.eventType || 'wedding'} planning journey.`;
        }
      } else if (chatType === 'landing') {
        systemMessage += `\n\nCONTEXT: This visitor is on the client portal landing page. They are likely exploring Oakstreet Events for the first time or considering us for their event. Your goal is to have a natural conversation, understand their needs, and guide them to register. Be warm and inviting - make them feel special from the very first message.

COLLECTED DETAILS TRACKING:
As you collect information through conversation, keep track of what you've gathered. Once you have at least the name, phone number, and email, you can call register_portal_lead. Don't ask for permission to register - just naturally say something like "Let me get you set up with our team!" and call the function. Include ALL details they've shared so far.`;
      }
      
      // Build tools array for landing page chat
      const tools = chatType === 'landing' ? [PORTAL_REGISTER_LEAD_TOOL] : [];
      
      // Call OpenAI with function calling support
      const completion = await portalOpenai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemMessage },
          ...messages.slice(-20).map((m: any) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content
          }))
        ],
        tools: tools.length > 0 ? tools : undefined,
        max_tokens: 150,
        temperature: 0.7
      });
      
      const choice = completion.choices[0];
      let assistantMessage = choice?.message?.content || "";
      let registrationResult = null;
      
      // Handle function calling - Oaksy wants to register a lead
      if (choice?.message?.tool_calls && choice.message.tool_calls.length > 0) {
        const toolCall = choice.message.tool_calls[0];
        if (toolCall.function.name === 'register_portal_lead') {
          try {
            const leadData = JSON.parse(toolCall.function.arguments);
            
            // Validate required fields from tool call arguments
            const toolArgSchema = z.object({
              name: z.string().min(1, "Name is required"),
              phone: z.string().min(1, "Phone is required"),
              email: z.string().email("Valid email required"),
              whatsappNumber: z.string().optional().nullable(),
              eventType: z.string().optional().nullable(),
              eventDate: z.string().optional().nullable(),
              venue: z.string().optional().nullable(),
              venueCity: z.string().optional().nullable(),
              guestCount: z.number().optional().nullable(),
              budgetRange: z.string().optional().nullable(),
              servicesRequired: z.array(z.string()).optional().default([]),
              additionalNotes: z.string().optional().nullable(),
              city: z.string().optional().nullable(),
              address: z.string().optional().nullable(),
            });
            
            const parseResult = toolArgSchema.safeParse(leadData);
            if (!parseResult.success) {
              throw new Error(`Validation failed: ${parseResult.error.errors.map(e => e.message).join(', ')}`);
            }
            
            const validatedData = parseResult.data;
            const whatsappNumber = validatedData.whatsappNumber || validatedData.phone;
            
            // Generate OTP
            const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
            const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
            
            // Insert the lead into the database with validated data
            const [newLead] = await db.insert(portalLeads).values({
              name: validatedData.name,
              email: validatedData.email,
              phone: validatedData.phone,
              whatsappNumber: whatsappNumber,
              address: validatedData.address || null,
              city: validatedData.city || null,
              eventDate: validatedData.eventDate || null,
              eventType: validatedData.eventType || null,
              venue: validatedData.venue || null,
              venueCity: validatedData.venueCity || null,
              guestCount: validatedData.guestCount || null,
              budgetRange: validatedData.budgetRange || null,
              servicesRequired: validatedData.servicesRequired || [],
              additionalNotes: validatedData.additionalNotes || null,
              termsAccepted: true,
              otpCode,
              otpExpiresAt,
              phase: 'submitted',
            }).returning();
            
            registrationResult = { success: true, leadId: newLead.id, name: validatedData.name };
            
            // Send OTP via WhatsApp if configured
            if (isWhatsAppConfigured()) {
              try {
                await sendOTPNotification(whatsappNumber, otpCode);
              } catch (otpErr) {
                console.error('Failed to send OTP via WhatsApp:', otpErr);
              }
            }
            
            // Make a follow-up call to get Oaksy's natural response after registration
            const followUpCompletion = await portalOpenai.chat.completions.create({
              model: 'gpt-4o',
              messages: [
                { role: 'system', content: systemMessage },
                ...messages.slice(-20).map((m: any) => ({
                  role: m.role as 'user' | 'assistant',
                  content: m.content
                })),
                choice.message as any,
                { 
                  role: 'tool', 
                  tool_call_id: toolCall.id,
                  content: JSON.stringify({ success: true, message: `Successfully registered ${validatedData.name}. An OTP has been sent to their WhatsApp (${whatsappNumber}) for verification. Please tell them to check their WhatsApp for the OTP code and verify it on the portal. A dedicated wedding planner will be assigned within 24 hours.` })
                }
              ],
              max_tokens: 150,
              temperature: 0.7
            });
            
            assistantMessage = followUpCompletion.choices[0]?.message?.content || 
              `Wonderful! I've registered you in our system, ${validatedData.name}! 🎉 We've sent a verification code to your WhatsApp. Please check your WhatsApp and enter the OTP to complete verification. A dedicated wedding planner will reach out to you within 24 hours!`;
          } catch (regError: any) {
            console.error('Error registering lead via Oaksy:', regError);
            assistantMessage = "I'd love to get you registered, but I ran into a small hiccup. Could you try using the registration form on this page instead? Scroll down to the 'Get Started' section! 😊";
          }
        }
      }
      
      // Fallback if no content from AI
      if (!assistantMessage) {
        assistantMessage = "I'm sorry, I couldn't process that. Could you please try again? 😊";
      }
      
      // Add assistant message to history
      messages.push({
        role: 'assistant',
        content: assistantMessage,
        timestamp: new Date().toISOString()
      });
      
      // Update chat in database
      await db.update(portalOaksyChats)
        .set({ 
          messages,
          updatedAt: new Date()
        })
        .where(eq(portalOaksyChats.id, chat.id));
      
      res.json({
        message: assistantMessage,
        chatId: chat.id,
        registration: registrationResult
      });
    } catch (error: any) {
      console.error('Error in portal chat:', error);
      res.status(500).json({ error: 'Failed to process message' });
    }
  });

  // Get chat history
  app.get('/api/portal-chat/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const chatType = req.query.chatType as string || 'landing';
      
      const [chat] = await db.select().from(portalOaksyChats)
        .where(and(
          eq(portalOaksyChats.sessionId, sessionId),
          eq(portalOaksyChats.chatType, chatType)
        ));
      
      if (!chat) {
        return res.json({ messages: [] });
      }
      
      res.json({ messages: chat.messages || [] });
    } catch (error: any) {
      console.error('Error fetching chat history:', error);
      res.status(500).json({ error: 'Failed to fetch chat history' });
    }
  });

  // ============================================================
  // INCENTIVES & BONUS MODULE (Superadmin only for management)
  // ============================================================

  // Get all incentives with optional filters
  app.get('/api/incentives', async (req, res) => {
    try {
      const auth = req.session as any;
      if (!auth?.user || auth.user.role !== 'superadmin') return res.status(403).json({ error: 'Forbidden' });
      
      const { type, eventId, fiscalYear, status } = req.query;
      const filters: any = {};
      if (type) filters.type = type;
      if (eventId) filters.eventId = eventId;
      if (fiscalYear) filters.fiscalYear = fiscalYear;
      if (status) filters.status = status;
      
      const result = await storage.getIncentives(filters);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get incentives' });
    }
  });

  // Get single incentive with assignments
  app.get('/api/incentives/:id', async (req, res) => {
    try {
      const auth = req.session as any;
      if (!auth?.user || auth.user.role !== 'superadmin') return res.status(403).json({ error: 'Forbidden' });
      
      const incentive = await storage.getIncentive(req.params.id);
      if (!incentive) return res.status(404).json({ error: 'Incentive not found' });
      
      const assignments = await storage.getIncentiveAssignments({ incentiveId: req.params.id });
      const assignmentsWithTasks = await Promise.all(
        assignments.map(async (a: any) => {
          const tasks = await storage.getIncentiveTasks(a.id);
          const employee = await storage.getUser(a.employeeId);
          return { ...a, tasks, employeeName: employee?.name || 'Unknown' };
        })
      );
      
      res.json({ ...incentive, assignments: assignmentsWithTasks });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get incentive' });
    }
  });

  // Create incentive (superadmin only)
  app.post('/api/incentives', async (req, res) => {
    try {
      const auth = req.session as any;
      if (!auth?.user || auth.user.role !== 'superadmin') return res.status(403).json({ error: 'Forbidden' });
      
      const incentive = await storage.createIncentive({
        ...req.body,
        createdBy: auth.user.id,
      });
      res.json(incentive);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create incentive' });
    }
  });

  app.post('/api/event-incentives', async (req, res) => {
    try {
      const auth = req.session as any;
      if (!auth?.user || auth.user.role !== 'superadmin') return res.status(403).json({ error: 'Forbidden' });

      const { title, eventId, employeeId, amount, criteria, fiscalYear } = req.body;
      if (!eventId || !employeeId || !amount) {
        return res.status(400).json({ error: 'Event, employee, and amount are required' });
      }

      const result = await storage.createEventIncentive({
        title: title || 'Event Incentive',
        eventId,
        employeeId,
        amount: parseFloat(amount),
        criteria: Array.isArray(criteria) ? criteria : [],
        fiscalYear,
        createdBy: auth.user.id,
      });

      res.json(result);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create event incentive' });
    }
  });

  // Update incentive (superadmin only)
  app.patch('/api/incentives/:id', async (req, res) => {
    try {
      const auth = req.session as any;
      if (!auth?.user || auth.user.role !== 'superadmin') return res.status(403).json({ error: 'Forbidden' });
      
      const incentive = await storage.updateIncentive(req.params.id, req.body);
      if (!incentive) return res.status(404).json({ error: 'Incentive not found' });
      res.json(incentive);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update incentive' });
    }
  });

  // Delete incentive (superadmin only)
  app.delete('/api/incentives/:id', async (req, res) => {
    try {
      const auth = req.session as any;
      if (!auth?.user || auth.user.role !== 'superadmin') return res.status(403).json({ error: 'Forbidden' });
      
      await storage.deleteIncentive(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete incentive' });
    }
  });

  // Assign incentive to employees (superadmin only)
  app.post('/api/incentive-assignments', async (req, res) => {
    try {
      const auth = req.session as any;
      if (!auth?.user || auth.user.role !== 'superadmin') return res.status(403).json({ error: 'Forbidden' });
      
      const { incentiveId, employeeId, amount, tasks, notes } = req.body;
      
      const assignment = await storage.createIncentiveAssignment({
        incentiveId,
        employeeId,
        amount: amount || '0',
        notes,
      });
      
      if (tasks && Array.isArray(tasks)) {
        for (const task of tasks) {
          await storage.createIncentiveTask({
            assignmentId: assignment.id,
            title: task.title,
            description: task.description || null,
            isRequired: task.isRequired !== false,
            isCompleted: false,
          });
        }
      }
      
      const createdTasks = await storage.getIncentiveTasks(assignment.id);
      res.json({ ...assignment, tasks: createdTasks });
    } catch (error) {
      res.status(400).json({ error: 'Failed to create assignment' });
    }
  });

  // Update assignment status (superadmin only)
  app.patch('/api/incentive-assignments/:id', async (req, res) => {
    try {
      const auth = req.session as any;
      if (!auth?.user || auth.user.role !== 'superadmin') return res.status(403).json({ error: 'Forbidden' });
      
      const updateData: any = { ...req.body };
      if (req.body.status === 'verified' || req.body.status === 'paid') {
        updateData.verifiedBy = auth.user.id;
        updateData.verifiedAt = new Date();
      }
      
      const assignment = await storage.updateIncentiveAssignment(req.params.id, updateData);
      if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
      res.json(assignment);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update assignment' });
    }
  });

  // Delete assignment (superadmin only)
  app.delete('/api/incentive-assignments/:id', async (req, res) => {
    try {
      const auth = req.session as any;
      if (!auth?.user || auth.user.role !== 'superadmin') return res.status(403).json({ error: 'Forbidden' });
      
      await storage.deleteIncentiveAssignment(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete assignment' });
    }
  });

  // Add task to assignment (superadmin only)
  app.post('/api/incentive-assignments/:id/tasks', async (req, res) => {
    try {
      const auth = req.session as any;
      if (!auth?.user || auth.user.role !== 'superadmin') return res.status(403).json({ error: 'Forbidden' });
      
      const task = await storage.createIncentiveTask({
        assignmentId: req.params.id,
        title: req.body.title,
        description: req.body.description || null,
        isRequired: req.body.isRequired !== false,
        isCompleted: false,
      });
      res.json(task);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create task' });
    }
  });

  app.patch('/api/incentive-tasks/:id', async (req, res) => {
    try {
      const auth = req.session as any;
      if (!auth?.user || auth.user.role !== 'superadmin') return res.status(403).json({ error: 'Forbidden' });
      
      const updateData: any = { ...req.body };
      if (req.body.isCompleted) {
        updateData.completedAt = new Date();
      }
      if (req.body.verified) {
        updateData.verifiedBy = auth.user.id;
        updateData.verifiedAt = new Date();
      }
      
      const task = await storage.updateIncentiveTask(req.params.id, updateData);
      if (!task) return res.status(404).json({ error: 'Task not found' });
      res.json(task);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update task' });
    }
  });

  // Delete task (superadmin only)
  app.delete('/api/incentive-tasks/:id', async (req, res) => {
    try {
      const auth = req.session as any;
      if (!auth?.user || auth.user.role !== 'superadmin') return res.status(403).json({ error: 'Forbidden' });
      
      await storage.deleteIncentiveTask(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete task' });
    }
  });

  // ---- Yearly KPI Targets ----

  // Get KPI targets (superadmin sees all, employees see own)
  app.get('/api/kpi-targets', async (req, res) => {
    try {
      const auth = req.session as any;
      if (!auth?.user) return res.status(401).json({ error: 'Unauthorized' });
      
      const { employeeId, fiscalYear } = req.query;
      const filters: any = {};
      if (fiscalYear) filters.fiscalYear = fiscalYear;
      
      if (auth.user.role === 'superadmin') {
        if (employeeId) filters.employeeId = employeeId;
      } else {
        filters.employeeId = auth.user.id;
      }
      
      const targets = await storage.getYearlyKpiTargets(filters);
      res.json(targets);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get KPI targets' });
    }
  });

  // Create KPI target (superadmin only)
  app.post('/api/kpi-targets', async (req, res) => {
    try {
      const auth = req.session as any;
      if (!auth?.user || auth.user.role !== 'superadmin') return res.status(403).json({ error: 'Forbidden' });
      
      const target = await storage.createYearlyKpiTarget({
        ...req.body,
        createdBy: auth.user.id,
      });
      res.json(target);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create KPI target' });
    }
  });

  // Update KPI target (superadmin only)
  app.patch('/api/kpi-targets/:id', async (req, res) => {
    try {
      const auth = req.session as any;
      if (!auth?.user || auth.user.role !== 'superadmin') return res.status(403).json({ error: 'Forbidden' });
      
      const target = await storage.updateYearlyKpiTarget(req.params.id, {
        ...req.body,
        updatedAt: new Date(),
      });
      if (!target) return res.status(404).json({ error: 'KPI target not found' });
      res.json(target);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update KPI target' });
    }
  });

  // Delete KPI target (superadmin only)
  app.delete('/api/kpi-targets/:id', async (req, res) => {
    try {
      const auth = req.session as any;
      if (!auth?.user || auth.user.role !== 'superadmin') return res.status(403).json({ error: 'Forbidden' });
      
      await storage.deleteYearlyKpiTarget(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete KPI target' });
    }
  });

  // ---- Employee "My" Endpoints ----

  // Get my incentives (employee view)
  app.get('/api/my/incentives', async (req, res) => {
    try {
      const auth = req.session as any;
      if (!auth?.user) return res.status(401).json({ error: 'Unauthorized' });
      
      const assignments = await storage.getIncentiveAssignments({ employeeId: auth.user.id });
      
      const enriched = await Promise.all(
        assignments.map(async (a: any) => {
          const incentive = await storage.getIncentive(a.incentiveId);
          const tasks = await storage.getIncentiveTasks(a.id);
          let eventTitle = null;
          if (incentive?.eventId) {
            const event = await storage.getEvent(incentive.eventId);
            eventTitle = event?.title || null;
          }
          return {
            ...a,
            incentiveTitle: incentive?.title || '',
            incentiveType: incentive?.type || '',
            incentiveDescription: incentive?.description || '',
            eventTitle,
            eventId: incentive?.eventId || null,
            tasks,
          };
        })
      );
      
      res.json(enriched);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get my incentives' });
    }
  });

  app.patch('/api/my/incentive-tasks/:taskId', async (req, res) => {
    try {
      const auth = req.session as any;
      if (!auth?.user) return res.status(401).json({ error: 'Unauthorized' });
      
      const taskRecord = await storage.getIncentiveTask(req.params.taskId);
      if (!taskRecord) return res.status(404).json({ error: 'Task not found' });
      
      const assignment = await storage.getIncentiveAssignment(taskRecord.assignmentId);
      if (!assignment || assignment.employeeId !== auth.user.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      const task = await storage.updateIncentiveTask(req.params.taskId, {
        isCompleted: true,
        completedAt: new Date(),
      });
      if (!task) return res.status(404).json({ error: 'Task not found' });
      res.json(task);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update task' });
    }
  });

  // Get my KPI targets (employee view)
  app.get('/api/my/kpi-targets', async (req, res) => {
    try {
      const auth = req.session as any;
      if (!auth?.user) return res.status(401).json({ error: 'Unauthorized' });
      
      const { fiscalYear } = req.query;
      const filters: any = { employeeId: auth.user.id };
      if (fiscalYear) filters.fiscalYear = fiscalYear;
      
      const targets = await storage.getYearlyKpiTargets(filters);
      res.json(targets);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get my KPI targets' });
    }
  });

  app.get('/rsvp/e/:code', async (req, res, next) => {
    const ua = (req.headers['user-agent'] || '').toLowerCase();
    const isCrawler = /whatsapp|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|telegrambot|discordbot|googlebot|bingbot|bot|crawler|spider|preview/i.test(ua);
    
    if (!isCrawler) {
      return next();
    }

    try {
      const { code } = req.params;
      const allEvents = await storage.getAllEvents();
      const event = allEvents.find(e => e.rsvpCode === code.toUpperCase());
      
      if (!event) {
        return next();
      }

      const settings = (event.rsvpSettings as any) || {};
      const lp = settings.landingPage || {};
      let coupleNames = '';
      if (lp.groomName && lp.brideName) {
        coupleNames = `${lp.groomName} & ${lp.brideName}`;
      } else {
        const rawTitle = event.rsvpTitle || event.customer || event.title;
        const ofMatch = rawTitle.match(/(?:celebration|wedding|union|marriage|engagement)\s+of\s+(.+)/i);
        coupleNames = ofMatch ? ofMatch[1].replace(/\.\s*$/, '').trim() : rawTitle;
      }
      const eventDate = event.date ? new Date(event.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
      const venue = event.venue || '';
      
      const title = `You're Invited! ${coupleNames}`;
      const description = [
        eventDate,
        venue,
        'RSVP to confirm your attendance'
      ].filter(Boolean).join(' · ');
      
      const imageUrl = lp.heroImageUrl || '';
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const fullImageUrl = imageUrl.startsWith('http') ? imageUrl : (imageUrl ? `${baseUrl}${imageUrl}` : '');

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:type" content="website" />
  ${fullImageUrl ? `<meta property="og:image" content="${fullImageUrl}" />` : ''}
  <meta property="og:url" content="${baseUrl}/rsvp/e/${code}" />
  <meta name="twitter:card" content="${fullImageUrl ? 'summary_large_image' : 'summary'}" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  ${fullImageUrl ? `<meta name="twitter:image" content="${fullImageUrl}" />` : ''}
  <meta http-equiv="refresh" content="0;url=/rsvp/e/${code}">
</head>
<body>
  <h1>${title}</h1>
  <p>${description}</p>
</body>
</html>`;

      res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
    } catch (error) {
      console.error('Error generating OG meta for RSVP:', error);
      next();
    }
  });

  // ==========================================
  // CASHFLOW PLANNING & LIABILITIES
  // ==========================================

  app.get('/api/cashflow-entries', async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin', 'accountant'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const { month } = req.query;
      let entries;
      if (month) {
        entries = await db.select().from(cashflowEntries).where(eq(cashflowEntries.month, month as string)).orderBy(cashflowEntries.dueDate);
      } else {
        entries = await db.select().from(cashflowEntries).orderBy(cashflowEntries.dueDate);
      }
      res.json(entries);
    } catch (error) {
      console.error('Error fetching cashflow entries:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/cashflow-entries', async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin', 'accountant'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const data = { ...req.body, createdBy: user.id };
      const [entry] = await db.insert(cashflowEntries).values(data).returning();
      res.json(entry);
    } catch (error) {
      console.error('Error creating cashflow entry:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.patch('/api/cashflow-entries/:id', async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin', 'accountant'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const updates = { ...req.body, updatedAt: new Date() };
      if (req.body.isPaid === true) {
        updates.paidAt = new Date();
      }
      const [entry] = await db.update(cashflowEntries).set(updates).where(eq(cashflowEntries.id, req.params.id)).returning();
      res.json(entry);
    } catch (error) {
      console.error('Error updating cashflow entry:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.delete('/api/cashflow-entries/:id', async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin', 'accountant'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      await db.delete(cashflowEntries).where(eq(cashflowEntries.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting cashflow entry:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/cashflow-entries/generate-recurring', async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const { targetMonth } = req.body; // 'YYYY-MM' format
      if (!targetMonth) return res.status(400).json({ error: 'targetMonth required' });

      const [year, mon] = targetMonth.split('-').map(Number);
      const prevMonth = mon === 1
        ? `${year - 1}-12`
        : `${year}-${String(mon - 1).padStart(2, '0')}`;

      const recurringEntries = await db.select().from(cashflowEntries)
        .where(and(
          eq(cashflowEntries.isRecurring, true),
          eq(cashflowEntries.recurringActive, true),
          eq(cashflowEntries.month, prevMonth)
        ));

      const existingInTarget = await db.select().from(cashflowEntries)
        .where(eq(cashflowEntries.month, targetMonth));
      const existingParentIds = new Set(existingInTarget.map(e => e.parentId).filter(Boolean));

      let created = 0;
      for (const entry of recurringEntries) {
        const parentRef = entry.parentId || entry.id;
        if (existingParentIds.has(parentRef)) continue;

        const newDueDate = entry.dueDate
          ? (() => {
              const d = new Date(entry.dueDate);
              d.setMonth(d.getMonth() + 1);
              return d.toISOString().split('T')[0];
            })()
          : null;

        await db.insert(cashflowEntries).values({
          type: entry.type,
          name: entry.name,
          description: entry.description,
          amount: entry.amount,
          dueDate: newDueDate,
          month: targetMonth,
          isRecurring: true,
          recurringActive: true,
          parentId: parentRef,
          isPaid: false,
          category: entry.category,
          createdBy: user.id,
        });
        created++;
      }
      res.json({ created, message: `${created} recurring entries generated for ${targetMonth}` });
    } catch (error) {
      console.error('Error generating recurring entries:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // LIABILITIES
  app.get('/api/liabilities', async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin', 'accountant'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const all = await db.select().from(liabilities).orderBy(liabilities.dueDate);
      res.json(all);
    } catch (error) {
      console.error('Error fetching liabilities:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/liabilities', async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin', 'accountant'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const data = { ...req.body, createdBy: user.id };
      const [entry] = await db.insert(liabilities).values(data).returning();
      res.json(entry);
    } catch (error) {
      console.error('Error creating liability:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.patch('/api/liabilities/:id', async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin', 'accountant'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const updates = { ...req.body, updatedAt: new Date() };
      if (req.body.isPaid === true) {
        updates.paidAt = new Date();
      }
      const [entry] = await db.update(liabilities).set(updates).where(eq(liabilities.id, req.params.id)).returning();
      res.json(entry);
    } catch (error) {
      console.error('Error updating liability:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.delete('/api/liabilities/:id', async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      await db.delete(liabilities).where(eq(liabilities.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting liability:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Cashflow Vendor Payments CRUD
  app.get('/api/cashflow-vendor-payments', async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const entries = await db.select().from(cashflowVendorPayments).orderBy(cashflowVendorPayments.dueDate);
      res.json(entries);
    } catch (error) {
      console.error('Error fetching cashflow vendor payments:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/cashflow-vendor-payments', async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const data = { ...req.body, createdBy: req.session.userId };
      const [entry] = await db.insert(cashflowVendorPayments).values(data).returning();
      res.json(entry);
    } catch (error) {
      console.error('Error creating cashflow vendor payment:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.patch('/api/cashflow-vendor-payments/:id', async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const updateData = { ...req.body, updatedAt: new Date() };
      const [entry] = await db.update(cashflowVendorPayments)
        .set(updateData)
        .where(eq(cashflowVendorPayments.id, req.params.id))
        .returning();
      res.json(entry);
    } catch (error) {
      console.error('Error updating cashflow vendor payment:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.delete('/api/cashflow-vendor-payments/:id', async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || !['superadmin', 'admin'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      await db.delete(cashflowVendorPayments).where(eq(cashflowVendorPayments.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting cashflow vendor payment:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });


  // ============================================
  // SAAS-SPECIFIC ROUTES
  // ============================================

  // JWT-based signup for new companies
  app.post('/api/auth/signup', async (req, res) => {
    try {
      const { name, email, password, companyName, plan, phone } = req.body;
      if (!name || !email || !password || !companyName) {
        return res.status(400).json({ error: 'All fields are required' });
      }
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: 'Email already registered' });
      }
      const company = await storage.createCompany({ name: companyName });
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({
        name,
        email,
        password: hashedPassword,
        role: 'admin',
        companyId: company.id,
        createdVia: 'signup',
      });
      const selectedPlan = plan || 'growth';
      const isTrialPlan = selectedPlan === 'growth' || selectedPlan === 'trial_growth';
      const planName = isTrialPlan ? 'trial_growth' : selectedPlan;
      const now = new Date();
      const trialEnd = new Date(now);
      trialEnd.setDate(trialEnd.getDate() + 14);
      try {
        await storage.createSubscription({
          companyId: company.id,
          planName,
          status: 'active',
          startDate: now,
          endDate: isTrialPlan ? trialEnd : null,
        });
      } catch (subErr) {
        console.error('[Signup] Subscription creation error (non-fatal):', subErr);
      }
      try {
        await storage.createCrmLead({
          name,
          email,
          companyName,
          source: 'Free Trial',
          status: 'new',
          planInterest: planName,
        });
      } catch (crmErr) {
        console.error('[Signup] CRM lead creation error (non-fatal):', crmErr);
      }
      (async () => {
        try {
          const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
          await storage.createSystemNotification({
            eventType: 'trial_signup',
            title: '🎉 New Trial Signup',
            message: `New trial signup by ${name} (${companyName}). Plan: ${isTrialPlan ? '14-Day Growth Trial' : planName}. Time: ${timestamp}.`,
            payload: { name, email, companyName, plan: planName, userId: user.id, companyId: company.id },
            isRead: false,
            createdBy: 'system',
          });
        } catch (err) {
          console.error('[Signup] System notification error (non-fatal):', err);
        }
        try {
          await storage.createAdminEventLog({
            eventType: 'trial_signup',
            title: 'New Trial Signup',
            message: `New trial signup by ${name} (${companyName}). Plan: ${isTrialPlan ? '14-Day Growth Trial' : planName}.`,
            userName: name,
            userEmail: email,
            companyName,
            planName: isTrialPlan ? '14-Day Growth Trial' : planName,
          });
        } catch (err) {
          console.error('[Signup] Admin event log error (non-fatal):', err);
        }
        try {
          await sendSignupWelcomeEmail(email, name, companyName, isTrialPlan ? '14-Day Growth Trial' : planName);
        } catch (emailErr) {
          console.error('[Signup] Email error (non-fatal):', emailErr);
        }
        try {
          await sendSignupAdminNotification(name, companyName, email, phone || '', isTrialPlan ? '14-Day Growth Trial' : planName);
        } catch (adminErr) {
          console.error('[Signup] Admin notification error (non-fatal):', adminErr);
        }
      })();
      const token = jwt.sign(
        { userId: user.id, companyId: company.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      (req.session as any).userId = user.id;
      res.status(201).json({
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role, companyId: company.id },
        company: { id: company.id, name: company.name },
      });
    } catch (error) {
      console.error('[Signup] Error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  // Demo bookings
  app.post('/api/demo-bookings', async (req, res) => {
    try {
      const { name, email, phone, companyName, eventDate, notes, source } = req.body;
      if (!name || !email || !phone) {
        return res.status(400).json({ error: 'Name, email and phone are required' });
      }
      const booking = await storage.createDemoBooking({ name, email, phone, companyName, eventDate, notes, source: source || 'website' });
      (async () => {
        try {
          await storage.createSystemNotification({
            eventType: 'demo_booking',
            title: '📅 New Demo Booking',
            message: `Demo requested by ${name} (${companyName || 'N/A'}). Phone: ${phone}. Email: ${email}.`,
            payload: { name, email, phone, companyName, eventDate, bookingId: booking.id },
            isRead: false,
            createdBy: 'system',
          });
        } catch {}
        try {
          await storage.createAdminEventLog({
            eventType: 'demo_booking',
            title: 'New Demo Booking',
            message: `Demo requested by ${name} (${companyName || 'N/A'}).`,
            userName: name,
            userEmail: email,
          });
        } catch {}
        try {
          await sendDemoConfirmationEmail(email, name);
          await sendDemoAdminNotification(name, companyName || 'N/A', email, phone, eventDate || 'Not specified', notes || '');
        } catch {}
      })();
      res.status(201).json({ success: true, booking });
    } catch (error) {
      console.error('[Demo Booking] Error:', error);
      res.status(500).json({ error: 'Failed to create demo booking' });
    }
  });

  // Enterprise leads
  app.post('/api/enterprise-leads', async (req, res) => {
    try {
      const { name, email, phone, companyName, teamSize, requirements, currentTools } = req.body;
      if (!name || !email || !companyName) {
        return res.status(400).json({ error: 'Name, email and company name are required' });
      }
      const lead = await storage.createEnterpriseLead({ name, email, phone, companyName, teamSize, requirements, currentTools });
      (async () => {
        try {
          await storage.createSystemNotification({
            eventType: 'enterprise_lead',
            title: '🏢 New Enterprise Lead',
            message: `Enterprise inquiry from ${name} (${companyName}). Team size: ${teamSize || 'N/A'}.`,
            payload: { name, email, companyName, teamSize, leadId: lead.id },
            isRead: false,
            createdBy: 'system',
          });
        } catch {}
        try {
          await sendEnterpriseAcknowledgmentEmail(email, name, companyName);
          await sendEnterpriseAdminNotification(name, companyName, email, phone || '', teamSize || 'N/A', requirements || '', currentTools || '');
        } catch {}
      })();
      res.status(201).json({ success: true, lead });
    } catch (error) {
      console.error('[Enterprise Lead] Error:', error);
      res.status(500).json({ error: 'Failed to create enterprise lead' });
    }
  });

  // System notifications (admin)
  app.get('/api/system-notifications', verifyJWT, async (req, res) => {
    try {
      if (req.user?.role !== 'superadmin' && req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }
      const notifications = await storage.getSystemNotifications(50);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch system notifications' });
    }
  });

  app.get('/api/system-notifications/unread-count', verifyJWT, async (req, res) => {
    try {
      if (req.user?.role !== 'superadmin' && req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }
      const count = await storage.getUnreadSystemNotificationCount();
      res.json({ count });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get unread count' });
    }
  });

  app.patch('/api/system-notifications/:id/read', verifyJWT, async (req, res) => {
    try {
      await storage.markSystemNotificationAsRead(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to mark as read' });
    }
  });

  app.patch('/api/system-notifications/mark-all-read', verifyJWT, async (req, res) => {
    try {
      await storage.markAllSystemNotificationsAsRead();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to mark all as read' });
    }
  });

  // Admin event logs
  app.get('/api/admin-event-logs', verifyJWT, async (req, res) => {
    try {
      if (req.user?.role !== 'superadmin' && req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }
      const limit = parseInt(req.query.limit as string) || 50;
      const logs = await storage.getAdminEventLogs(limit);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch admin event logs' });
    }
  });

  // Admin stats
  app.get('/api/admin/stats', verifyJWT, async (req, res) => {
    try {
      if (req.user?.role !== 'superadmin') {
        return res.status(403).json({ error: 'Superadmin access required' });
      }
      const allSubs = await db.select().from(subscriptions);
      const allCompanies = await db.select().from(companies);
      const allUsers = await db.select().from(users).where(sql`role != 'superadmin'`);
      const activeSubs = allSubs.filter(s => s.status === 'active');
      const trialSubs = activeSubs.filter(s => s.planName?.includes('trial'));
      const paidSubs = activeSubs.filter(s => !s.planName?.includes('trial'));
      const totalRevenue = allSubs
        .filter(s => s.status === 'active' && s.amountPaid)
        .reduce((sum, s) => sum + (s.amountPaid || 0), 0);
      res.json({
        totalUsers: allUsers.length,
        totalCompanies: allCompanies.length,
        activeSubscriptions: activeSubs.length,
        trialUsers: trialSubs.length,
        paidUsers: paidSubs.length,
        totalRevenue,
        recentSignups: allUsers
          .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
          .slice(0, 10)
          .map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt })),
        subscriptions: allSubs
          .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
          .map(s => ({
            id: s.id, companyId: s.companyId, planName: s.planName, status: s.status,
            startDate: s.startDate, endDate: s.endDate, amountPaid: s.amountPaid, createdAt: s.createdAt,
          })),
      });
    } catch (error) {
      console.error('[Admin Stats] Error:', error);
      res.status(500).json({ error: 'Failed to fetch admin stats' });
    }
  });

  // Email logs
  app.get('/api/email-logs', verifyJWT, async (req, res) => {
    try {
      if (req.user?.role !== 'superadmin' && req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }
      const limit = parseInt(req.query.limit as string) || 50;
      const logs = await storage.getEmailLogs(limit);
      res.json(logs);
    } catch (error) {
      console.error('[Email Logs] Get error:', error);
      res.status(500).json({ error: 'Failed to fetch email logs' });
    }
  });

  // Forgot password
  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }
      const user = await storage.getUserByEmail(email);
      if (user) {
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpiry = new Date(Date.now() + 3600000);
        await db.update(users)
          .set({ passwordResetToken: resetToken, passwordResetExpiry: resetExpiry })
          .where(eq(users.id, user.id));
        try {
          await sendPasswordResetEmail(email, resetToken, user.name);
        } catch (emailError) {
          console.error('[Password Reset] Failed to send email:', emailError);
        }
      }
      res.json({ message: 'If an account exists with this email, a reset link will be sent.' });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ error: 'Failed to process request' });
    }
  });

  // Verify reset token
  app.get('/api/auth/verify-reset-token', async (req, res) => {
    try {
      const { token } = req.query;
      if (!token || typeof token !== 'string') {
        return res.json({ valid: false });
      }
      const result = await db.select().from(users).where(eq(users.passwordResetToken, token)).limit(1);
      if (result.length === 0) {
        return res.json({ valid: false });
      }
      const user = result[0];
      if (!user.passwordResetExpiry || new Date() > new Date(user.passwordResetExpiry)) {
        return res.json({ valid: false });
      }
      res.json({ valid: true });
    } catch (error) {
      res.json({ valid: false });
    }
  });

  // Reset password
  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        return res.status(400).json({ error: 'Token and new password are required' });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }
      const result = await db.select().from(users).where(eq(users.passwordResetToken, token)).limit(1);
      if (result.length === 0) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }
      const user = result[0];
      if (!user.passwordResetExpiry || new Date() > new Date(user.passwordResetExpiry)) {
        return res.status(400).json({ error: 'Reset token has expired' });
      }
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await db.update(users)
        .set({ password: hashedPassword, passwordResetToken: null, passwordResetExpiry: null })
        .where(eq(users.id, user.id));
      res.json({ message: 'Password has been reset successfully' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  });

  // ============ Billing Routes ============
  app.get('/api/billing/status', async (req, res) => {
    try {
      const companyId = await getCompanyIdFromRequest(req);
      if (!companyId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      const subscription = await storage.getSubscriptionByCompanyId(companyId);
      const isConfigured = razorpayService.isRazorpayConfigured();
      const isTrial = subscription?.planName?.includes('trial') || false;
      const isActive = subscription?.status === 'active';
      let trialDaysRemaining: number | null = null;
      let isTrialExpired = false;
      if (isTrial && subscription?.endDate) {
        const now = new Date();
        const endDate = new Date(subscription.endDate);
        const diffMs = endDate.getTime() - now.getTime();
        trialDaysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        isTrialExpired = trialDaysRemaining <= 0;
      }
      const plan = normalizePlanName(subscription?.planName);
      const teamLimit = PLAN_TEAM_LIMITS[plan];
      const existingEmployees = await storage.getAllEmployees(companyId);
      res.json({
        subscription: subscription || null,
        isActive: isActive && !isTrialExpired,
        isTrial,
        trialDaysRemaining,
        isTrialExpired,
        currentPlan: plan,
        teamLimit: teamLimit === Infinity ? -1 : teamLimit,
        teamCount: existingEmployees.length,
        razorpayConfigured: isConfigured,
        razorpayKeyId: razorpayService.getRazorpayKeyId(),
        planCatalog: PLAN_CATALOG,
      });
    } catch (error) {
      console.error('Error getting billing status:', error);
      res.status(500).json({ error: 'Failed to get billing status' });
    }
  });

  app.post('/api/billing/create-order', async (req, res) => {
    try {
      const companyId = await requireCompanyId(req, res);
      if (!companyId) return;
      const { planName } = req.body;
      if (!razorpayService.isRazorpayConfigured()) {
        return res.status(503).json({ error: 'Payment system not configured' });
      }
      const validPlanName = planName && PLAN_CATALOG[planName] ? planName : 'basic';
      const plan = PLAN_CATALOG[validPlanName];
      const order = await razorpayService.createOrder({
        amount: plan.amount,
        currency: 'INR',
        companyId,
        planName: validPlanName,
      });
      await storage.createSubscription({
        companyId,
        planName: validPlanName,
        razorpayOrderId: order.id,
        amountPaid: plan.amount,
        status: 'pending',
      });
      res.json({
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: razorpayService.getRazorpayKeyId(),
      });
    } catch (error) {
      console.error('Error creating order:', error);
      res.status(500).json({ error: 'Failed to create order' });
    }
  });

  app.post('/api/billing/verify-payment', async (req, res) => {
    try {
      const companyId = await requireCompanyId(req, res);
      if (!companyId) return;
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
      const isValid = razorpayService.verifyPaymentSignature({
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
      });
      if (!isValid) {
        return res.status(400).json({ error: 'Invalid payment signature' });
      }
      const subscription = await storage.getSubscriptionByOrderId(razorpay_order_id);
      if (subscription) {
        const planDuration = subscription.planName?.includes('annual') ? 365 : 30;
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + planDuration);
        await storage.updateSubscription(subscription.id, {
          status: 'active',
          razorpayPaymentId: razorpay_payment_id,
          startDate: new Date(),
          endDate,
        });
        try {
          await sendPaymentSuccessAdminNotification(companyId, subscription.planName || 'Unknown', subscription.amountPaid || 0);
        } catch {}
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Error verifying payment:', error);
      res.status(500).json({ error: 'Failed to verify payment' });
    }
  });

  app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
      const webhookBody = req.body.toString();
      const webhookSignature = req.headers['x-razorpay-signature'] as string;
      if (!razorpayService.verifyWebhookSignature(webhookBody, webhookSignature)) {
        return res.status(400).json({ error: 'Invalid webhook signature' });
      }
      const event = JSON.parse(webhookBody);
      let billingEvent = null;
      try {
        billingEvent = await db.insert(billingEvents).values({
          eventType: event.event,
          payload: event,
          status: 'received',
        }).returning().then(rows => rows[0]);
      } catch {}
      switch (event.event) {
        case 'payment.captured': {
          const paymentId = event.payload?.payment?.entity?.id;
          const orderId = event.payload?.payment?.entity?.order_id;
          if (orderId) {
            const subscription = await storage.getSubscriptionByOrderId(orderId);
            if (subscription && subscription.status === 'pending') {
              const planDuration = subscription.planName?.includes('annual') ? 365 : 30;
              const endDate = new Date();
              endDate.setDate(endDate.getDate() + planDuration);
              await storage.updateSubscription(subscription.id, {
                status: 'active',
                razorpayPaymentId: paymentId,
                startDate: new Date(),
                endDate,
              });
            }
          }
          break;
        }
        case 'payment.failed': {
          const orderId = event.payload?.payment?.entity?.order_id;
          if (orderId) {
            const subscription = await storage.getSubscriptionByOrderId(orderId);
            if (subscription) {
              await storage.updateSubscription(subscription.id, { status: 'failed' });
              try {
                await sendPaymentFailedAdminNotification(subscription.companyId || '', subscription.planName || 'Unknown');
              } catch {}
            }
          }
          break;
        }
      }
      if (billingEvent) {
        await db.update(billingEvents)
          .set({ status: 'processed', processedAt: new Date() })
          .where(eq(billingEvents.id, billingEvent.id));
      }
      res.json({ received: true });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  // ============ Module Routes ============
  app.get('/api/modules', async (req, res) => {
    try {
      const modules = await db.select().from(saasModules).where(eq(saasModules.isActive, true)).orderBy(saasModules.sortOrder);
      res.json(modules);
    } catch (error) {
      console.error('Error fetching modules:', error);
      res.status(500).json({ error: 'Failed to fetch modules' });
    }
  });

  app.get('/api/modules/subscriptions', async (req, res) => {
    try {
      const companyId = await getCompanyIdFromRequest(req);
      if (!companyId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      const isDemoMode = process.env.DEMO_MODE === 'true';
      const subs = await db.select({
        subscription: companyModuleSubscriptions,
        module: saasModules,
      })
        .from(companyModuleSubscriptions)
        .innerJoin(saasModules, eq(companyModuleSubscriptions.moduleId, saasModules.id))
        .where(eq(companyModuleSubscriptions.companyId, companyId));
      const coreSubscription = subs.find(s => s.module.code === 'core' && s.subscription.status === 'active');
      const hasActiveCore = isDemoMode || !!coreSubscription;
      const allModuleCodes = ['core', 'rsvp', 'crm', 'vendor', 'payments', 'automation', 'ai_assistant'];
      res.json({
        subscriptions: subs.map(s => ({ ...s.subscription, module: s.module })),
        hasActiveCore,
        activatedModules: isDemoMode
          ? allModuleCodes
          : subs.filter(s => s.subscription.status === 'active').map(s => s.module.code),
      });
    } catch (error) {
      console.error('Error fetching module subscriptions:', error);
      res.status(500).json({ error: 'Failed to fetch subscriptions' });
    }
  });

  app.post('/api/modules/subscribe', async (req, res) => {
    try {
      const companyId = await requireCompanyId(req, res);
      if (!companyId) return;
      const { moduleCode, billingCycle } = req.body;
      if (!moduleCode || !['monthly', 'yearly'].includes(billingCycle)) {
        return res.status(400).json({ error: 'Invalid module code or billing cycle' });
      }
      if (!razorpayService.isRazorpayConfigured()) {
        return res.status(503).json({ error: 'Payment system not configured' });
      }
      const [module] = await db.select().from(saasModules).where(eq(saasModules.code, moduleCode));
      if (!module) {
        return res.status(404).json({ error: 'Module not found' });
      }
      const [existingSub] = await db.select().from(companyModuleSubscriptions)
        .where(and(
          eq(companyModuleSubscriptions.companyId, companyId),
          eq(companyModuleSubscriptions.moduleCode, moduleCode),
          eq(companyModuleSubscriptions.status, 'active')
        ));
      if (existingSub) {
        return res.status(400).json({ error: 'Already subscribed to this module' });
      }
      if (!module.isCore) {
        const [coreSub] = await db.select().from(companyModuleSubscriptions)
          .where(and(
            eq(companyModuleSubscriptions.companyId, companyId),
            eq(companyModuleSubscriptions.moduleCode, 'core'),
            eq(companyModuleSubscriptions.status, 'active')
          ));
        if (!coreSub) {
          return res.status(400).json({ error: 'Core Platform subscription required', requiresCore: true });
        }
      }
      const amount = billingCycle === 'yearly' ? module.yearlyPrice : module.monthlyPrice;
      const razorpayPlanId = billingCycle === 'yearly' ? module.razorpayYearlyPlanId : module.razorpayMonthlyPlanId;
      if (!razorpayPlanId) {
        return res.status(400).json({ error: 'Payment plan not configured for this module' });
      }
      const user = await storage.getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }
      const razorpaySub = await razorpayService.createSubscription({
        planId: razorpayPlanId,
        customerEmail: user.email,
        customerName: user.name,
        totalCount: billingCycle === 'yearly' ? 12 : 120,
      });
      const [newSub] = await db.insert(companyModuleSubscriptions).values({
        companyId,
        moduleId: module.id,
        moduleCode,
        billingCycle,
        amount,
        status: 'pending',
        razorpaySubscriptionId: razorpaySub.id,
      }).returning();
      res.json({
        subscription: newSub,
        razorpaySubscriptionId: razorpaySub.id,
        keyId: razorpayService.getRazorpayKeyId(),
      });
    } catch (error) {
      console.error('Error subscribing to module:', error);
      res.status(500).json({ error: 'Failed to subscribe' });
    }
  });

  app.post('/api/modules/verify-payment', async (req, res) => {
    try {
      const companyId = await requireCompanyId(req, res);
      if (!companyId) return;
      const { razorpay_subscription_id, razorpay_payment_id, razorpay_signature, subscriptionId } = req.body;
      const isValid = razorpayService.verifySubscriptionPayment({
        razorpaySubscriptionId: razorpay_subscription_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
      });
      if (!isValid) {
        return res.status(400).json({ error: 'Invalid payment signature' });
      }
      await db.update(companyModuleSubscriptions)
        .set({
          status: 'active',
          razorpayPaymentId: razorpay_payment_id,
          startDate: new Date(),
        })
        .where(and(
          eq(companyModuleSubscriptions.id, subscriptionId),
          eq(companyModuleSubscriptions.companyId, companyId)
        ));
      res.json({ success: true });
    } catch (error) {
      console.error('Error verifying module payment:', error);
      res.status(500).json({ error: 'Failed to verify payment' });
    }
  });

  app.post('/api/modules/cancel', async (req, res) => {
    try {
      const companyId = await requireCompanyId(req, res);
      if (!companyId) return;
      const { moduleCode } = req.body;
      if (!moduleCode) {
        return res.status(400).json({ error: 'Module code is required' });
      }
      const [sub] = await db.select().from(companyModuleSubscriptions)
        .where(and(
          eq(companyModuleSubscriptions.companyId, companyId),
          eq(companyModuleSubscriptions.moduleCode, moduleCode),
          eq(companyModuleSubscriptions.status, 'active')
        ));
      if (!sub) {
        return res.status(404).json({ error: 'No active subscription found' });
      }
      if (sub.razorpaySubscriptionId) {
        try {
          await razorpayService.cancelSubscription(sub.razorpaySubscriptionId);
        } catch (cancelErr) {
          console.error('Error cancelling Razorpay subscription:', cancelErr);
        }
      }
      await db.update(companyModuleSubscriptions)
        .set({ status: 'cancelled', endDate: new Date() })
        .where(eq(companyModuleSubscriptions.id, sub.id));
      res.json({ success: true });
    } catch (error) {
      console.error('Error cancelling module:', error);
      res.status(500).json({ error: 'Failed to cancel subscription' });
    }
  });

  app.get('/api/modules/check-access/:moduleCode', async (req, res) => {
    try {
      const companyId = await getCompanyIdFromRequest(req);
      if (!companyId) {
        return res.json({ hasAccess: false, reason: 'not_authenticated' });
      }
      const { moduleCode } = req.params;
      const isDemoMode = process.env.DEMO_MODE === 'true';
      if (isDemoMode) {
        return res.json({ hasAccess: true, reason: 'demo_mode' });
      }
      const [sub] = await db.select().from(companyModuleSubscriptions)
        .where(and(
          eq(companyModuleSubscriptions.companyId, companyId),
          eq(companyModuleSubscriptions.moduleCode, moduleCode),
          eq(companyModuleSubscriptions.status, 'active')
        ));
      res.json({ hasAccess: !!sub, reason: sub ? 'subscribed' : 'not_subscribed' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to check access' });
    }
  });

  // ============ In-App Notifications ============
  app.get('/api/in-app-notifications', async (req, res) => {
    try {
      const companyId = await getCompanyIdFromRequest(req);
      if (!companyId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      const notifications = await db.select().from(inAppNotifications)
        .where(eq(inAppNotifications.companyId, companyId))
        .orderBy(desc(inAppNotifications.createdAt))
        .limit(50);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  });

  app.post('/api/in-app-notifications/:id/read', async (req, res) => {
    try {
      await db.update(inAppNotifications)
        .set({ isRead: true })
        .where(eq(inAppNotifications.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to mark as read' });
    }
  });

  app.post('/api/in-app-notifications/read-all', async (req, res) => {
    try {
      const companyId = await getCompanyIdFromRequest(req);
      if (!companyId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      await db.update(inAppNotifications)
        .set({ isRead: true })
        .where(eq(inAppNotifications.companyId, companyId));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to mark all as read' });
    }
  });

  // ============ AI Settings & Usage ============
  app.get('/api/ai/usage', async (req, res) => {
    try {
      const companyId = await getCompanyIdFromRequest(req);
      if (!companyId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const usage = await db.select().from(aiUsage)
        .where(and(
          eq(aiUsage.companyId, companyId),
          gte(aiUsage.createdAt, startOfMonth)
        ));
      const totalTokens = usage.reduce((sum, u) => sum + (u.tokensUsed || 0), 0);
      const totalCost = usage.reduce((sum, u) => sum + (u.estimatedCost ? parseFloat(u.estimatedCost) : 0), 0);
      res.json({
        totalRequests: usage.length,
        totalTokens,
        totalCost: totalCost.toFixed(4),
        usage: usage.slice(0, 20),
      });
    } catch (error) {
      console.error('Error fetching AI usage:', error);
      res.status(500).json({ error: 'Failed to fetch usage' });
    }
  });

  app.get('/api/ai/settings', async (req, res) => {
    try {
      const companyId = await getCompanyIdFromRequest(req);
      if (!companyId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      const [settings] = await db.select().from(aiAssistantSettings)
        .where(eq(aiAssistantSettings.companyId, companyId));
      res.json(settings || {
        assistantName: 'Wedding AI',
        welcomeMessage: null,
        systemPromptAddition: null,
        avatarUrl: null,
        primaryColor: '#4F46E5',
        isEnabled: true,
      });
    } catch (error) {
      console.error('Error fetching AI settings:', error);
      res.status(500).json({ error: 'Failed to fetch settings' });
    }
  });

  app.put('/api/ai/settings', async (req, res) => {
    try {
      const companyId = await requireCompanyId(req, res);
      if (!companyId) return;
      const { assistantName, welcomeMessage, systemPromptAddition, avatarUrl, primaryColor, isEnabled } = req.body;
      const [existing] = await db.select().from(aiAssistantSettings)
        .where(eq(aiAssistantSettings.companyId, companyId));
      if (existing) {
        await db.update(aiAssistantSettings)
          .set({
            assistantName: assistantName || existing.assistantName,
            welcomeMessage: welcomeMessage !== undefined ? welcomeMessage : existing.welcomeMessage,
            systemPromptAddition: systemPromptAddition !== undefined ? systemPromptAddition : existing.systemPromptAddition,
            avatarUrl: avatarUrl !== undefined ? avatarUrl : existing.avatarUrl,
            primaryColor: primaryColor !== undefined ? primaryColor : existing.primaryColor,
            isEnabled: isEnabled !== undefined ? isEnabled : existing.isEnabled,
            updatedAt: new Date(),
          })
          .where(eq(aiAssistantSettings.companyId, companyId));
      } else {
        await db.insert(aiAssistantSettings).values({
          companyId,
          assistantName: assistantName || 'Wedding AI',
          welcomeMessage,
          systemPromptAddition,
          avatarUrl,
          primaryColor,
          isEnabled: isEnabled ?? true,
        });
      }
      const [settings] = await db.select().from(aiAssistantSettings)
        .where(eq(aiAssistantSettings.companyId, companyId));
      res.json(settings);
    } catch (error) {
      console.error('Error updating AI settings:', error);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  });

  // ============ SaaS Revenue ============
  app.get('/api/admin/saas-revenue', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      const user = await storage.getUser(req.session.userId);
      if (!user || (user.role !== 'superadmin' && user.role !== 'admin')) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      const activeSubs = await db.select().from(companyModuleSubscriptions)
        .where(eq(companyModuleSubscriptions.status, 'active'));
      const moduleBreakdown: Record<string, { count: number; mrr: number }> = {};
      let totalMrr = 0;
      let activeCore = 0;
      for (const sub of activeSubs) {
        const module = await db.select().from(saasModules)
          .where(eq(saasModules.id, sub.moduleId))
          .then(rows => rows[0]);
        if (module) {
          const monthlyAmount = sub.billingCycle === 'yearly'
            ? Math.round(module.yearlyPrice / 12)
            : module.monthlyPrice;
          if (!moduleBreakdown[sub.moduleCode]) {
            moduleBreakdown[sub.moduleCode] = { count: 0, mrr: 0 };
          }
          moduleBreakdown[sub.moduleCode].count++;
          moduleBreakdown[sub.moduleCode].mrr += monthlyAmount;
          totalMrr += monthlyAmount;
          if (sub.moduleCode === 'core') activeCore++;
        }
      }
      const recentEvents = await db.select().from(billingEvents)
        .orderBy(desc(billingEvents.createdAt))
        .limit(20);
      res.json({
        totalMrr,
        totalSubscriptions: activeSubs.length,
        activeCore,
        moduleBreakdown,
        recentEvents: recentEvents.map(e => ({
          id: e.id,
          type: e.eventType,
          amount: e.amount || 0,
          moduleCode: e.moduleCode || 'unknown',
          createdAt: e.createdAt?.toISOString() || new Date().toISOString(),
        })),
      });
    } catch (error) {
      console.error('Error fetching SaaS revenue:', error);
      res.status(500).json({ error: 'Failed to fetch revenue data' });
    }
  });

  // ============ GitHub Integration ============
  app.post("/api/github/create-repo", verifyJWT, async (req, res) => {
    try {
      const { repoName, isPrivate = true } = req.body;
      if (!repoName) {
        return res.status(400).json({ error: 'Repository name is required' });
      }
      const result = await createGitHubRepo(repoName, isPrivate);
      res.json(result);
    } catch (error: any) {
      console.error('[GitHub] Create repo error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/github/repos", verifyJWT, async (req, res) => {
    try {
      const repos = await listUserRepos();
      res.json({ repos });
    } catch (error: any) {
      console.error('[GitHub] List repos error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ Public Chat API ============
  const chatRateLimit = new Map<string, { count: number; resetTime: number }>();
  const CHAT_RATE_LIMIT = 10;
  const CHAT_RATE_WINDOW = 60000;

  app.post("/api/chat", async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      const now = Date.now();
      const rateData = chatRateLimit.get(clientIp);
      if (rateData) {
        if (now > rateData.resetTime) {
          chatRateLimit.set(clientIp, { count: 1, resetTime: now + CHAT_RATE_WINDOW });
        } else if (rateData.count >= CHAT_RATE_LIMIT) {
          return res.status(429).json({ error: 'Too many requests. Please try again later.' });
        } else {
          rateData.count++;
        }
      } else {
        chatRateLimit.set(clientIp, { count: 1, resetTime: now + CHAT_RATE_WINDOW });
      }
      if (chatRateLimit.size > 1000) {
        for (const [ip, data] of chatRateLimit) {
          if (now > data.resetTime) chatRateLimit.delete(ip);
        }
      }
      const { message } = req.body;
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message is required' });
      }
      if (message.length > 1000) {
        return res.status(400).json({ error: 'Message too long' });
      }
      const { getChatResponse } = await import("./public-chatbot");
      const response = await getChatResponse(message);
      res.json({ response });
    } catch (error: any) {
      console.error('[Chat] Error:', error);
      res.status(500).json({ error: 'Failed to process chat request' });
    }
  });

  // ============ KnotVite Client Signup & Billing ============
  app.post('/api/knotvite/signup', async (req, res) => {
    try {
      const { name, email, password, phone, plan } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email, and password are required' });
      }
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: 'Email already registered. Please sign in.' });
      }
      const company = await storage.createCompany({ name: `KnotVite - ${name}` });
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({
        name,
        email,
        password: hashedPassword,
        role: 'admin',
        companyId: company.id,
        createdVia: 'knotvite_signup',
      });
      const selectedPlan = plan || 'basic';
      const isTrial = selectedPlan === 'basic';
      const now = new Date();
      const trialEnd = new Date(now);
      trialEnd.setDate(trialEnd.getDate() + 14);
      await storage.createKnotviteSubscription({
        companyId: company.id,
        plan: selectedPlan,
        status: isTrial ? 'trial' : 'pending_payment',
        trialStartDate: isTrial ? now : null,
        trialEndDate: isTrial ? trialEnd : null,
      });
      try {
        await storage.createSubscription({
          companyId: company.id,
          planName: 'knotvite_' + selectedPlan,
          status: 'active',
          startDate: now,
          endDate: isTrial ? trialEnd : null,
        });
      } catch (subErr) {
        console.error('[KnotVite Signup] Platform subscription creation error (non-fatal):', subErr);
      }
      (async () => {
        try {
          await storage.createAdminEventLog({
            eventType: 'knotvite_signup',
            title: 'New KnotVite Signup',
            message: `New KnotVite signup: ${name} (${email}). Plan: ${selectedPlan}.`,
            userName: name,
            userEmail: email,
            companyName: company.name,
            planName: selectedPlan,
          });
        } catch (err) { console.error('[KnotVite Signup] Admin log error:', err); }
        try {
          await sendSignupAdminNotification(name, company.name, email, phone || '', `KnotVite ${selectedPlan}`);
        } catch (err) { console.error('[KnotVite Signup] Admin notification error:', err); }
        try {
          await sendSignupWelcomeEmail(email, name, company.name, `KnotVite ${selectedPlan}`);
        } catch (err) { console.error('[KnotVite Signup] Welcome email error:', err); }
      })();
      const token = jwt.sign(
        { userId: user.id, companyId: company.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      (req.session as any).userId = user.id;
      res.status(201).json({
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role, companyId: company.id },
      });
    } catch (error) {
      console.error('[KnotVite Signup] Error:', error);
      res.status(500).json({ error: 'Signup failed. Please try again.' });
    }
  });

  app.get('/api/knotvite/billing/status', verifyJWT, async (req, res) => {
    try {
      const companyId = req.user!.companyId;
      const sub = await storage.getKnotviteSubscription(companyId);
      if (!sub) {
        return res.json({
          plan: 'basic', status: 'none', isTrial: false, trialDaysRemaining: 0,
          isTrialExpired: true, isActive: false, razorpayConfigured: razorpayService.isRazorpayConfigured(),
          razorpayKeyId: razorpayService.getRazorpayKeyId(),
        });
      }
      let trialDaysRemaining: number | null = null;
      let isTrialExpired = false;
      if (sub.status === 'trial' && sub.trialEndDate) {
        const diffMs = new Date(sub.trialEndDate).getTime() - Date.now();
        trialDaysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        isTrialExpired = trialDaysRemaining <= 0;
      }
      const isActive = sub.status === 'active' || (sub.status === 'trial' && !isTrialExpired);
      const invoices = await storage.getKnotviteInvoices(companyId);
      res.json({
        subscription: sub,
        plan: sub.plan,
        status: sub.status,
        isTrial: sub.status === 'trial',
        trialDaysRemaining,
        isTrialExpired,
        isActive,
        razorpayConfigured: razorpayService.isRazorpayConfigured(),
        razorpayKeyId: razorpayService.getRazorpayKeyId(),
        invoices,
      });
    } catch (error) {
      console.error('[KnotVite Billing] Status error:', error);
      res.status(500).json({ error: 'Failed to fetch billing status' });
    }
  });

  app.post('/api/knotvite/billing/create-order', verifyJWT, async (req, res) => {
    try {
      const companyId = req.user!.companyId;
      const { plan } = req.body;
      if (!razorpayService.isRazorpayConfigured()) {
        return res.status(503).json({ error: 'Payment system not configured' });
      }
      const { KNOTVITE_PLAN_CATALOG, calculateGSTBreakdown } = await import('../shared/knotvite-limits');
      const catalogKey = `knotvite_${plan}`;
      const catalogItem = KNOTVITE_PLAN_CATALOG[catalogKey];
      if (!catalogItem) {
        return res.status(400).json({ error: 'Invalid plan' });
      }
      const { totalAmount } = calculateGSTBreakdown(catalogItem.amount);
      const order = await razorpayService.createOrder({
        amount: totalAmount,
        currency: 'INR',
        companyId,
        planName: catalogKey,
      });
      const sub = await storage.getKnotviteSubscription(companyId);
      if (sub) {
        await storage.updateKnotviteSubscription(sub.id, {
          plan,
          razorpayOrderId: order.id,
          status: sub.status === 'trial' ? 'trial' : 'pending_payment',
        });
      } else {
        await storage.createKnotviteSubscription({
          companyId,
          plan,
          status: 'pending_payment',
          razorpayOrderId: order.id,
        });
      }
      res.json({
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: razorpayService.getRazorpayKeyId(),
        planName: catalogItem.name,
        baseAmount: catalogItem.amount,
        gstBreakdown: calculateGSTBreakdown(catalogItem.amount),
      });
    } catch (error) {
      console.error('[KnotVite Billing] Create order error:', error);
      res.status(500).json({ error: 'Failed to create payment order' });
    }
  });

  app.post('/api/knotvite/billing/verify-payment', verifyJWT, async (req, res) => {
    try {
      const companyId = req.user!.companyId;
      const userId = req.user!.userId;
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
      const isValid = razorpayService.verifyPaymentSignature({
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
      });
      if (!isValid) {
        return res.status(400).json({ error: 'Invalid payment signature' });
      }
      const sub = await storage.getKnotviteSubscriptionByOrderId(razorpay_order_id);
      if (!sub) {
        return res.status(404).json({ error: 'Subscription not found' });
      }
      const { KNOTVITE_PLAN_CATALOG, calculateGSTBreakdown } = await import('../shared/knotvite-limits');
      const catalogKey = `knotvite_${sub.plan}`;
      const catalogItem = KNOTVITE_PLAN_CATALOG[catalogKey];
      const gst = calculateGSTBreakdown(catalogItem?.amount || 0);
      const now = new Date();
      await storage.updateKnotviteSubscription(sub.id, {
        status: 'active',
        razorpayPaymentId: razorpay_payment_id,
        amountPaid: gst.totalAmount,
        paidAt: now,
      });
      const user = await storage.getUser(userId);
      const invoiceNumber = await storage.getNextKnotviteInvoiceNumber();
      const invoice = await storage.createKnotviteInvoice({
        companyId,
        subscriptionId: sub.id,
        invoiceNumber,
        planName: catalogItem?.name || sub.plan,
        baseAmount: gst.baseAmount,
        gstAmount: gst.gstAmount,
        cgst: gst.cgst,
        sgst: gst.sgst,
        totalAmount: gst.totalAmount,
        gstRate: '18',
        customerName: user?.name || 'Customer',
        customerEmail: user?.email || '',
        razorpayPaymentId: razorpay_payment_id,
        status: 'paid',
        paidAt: now,
      });
      (async () => {
        try {
          const { sendKnotviteInvoiceEmail } = await import('./email-service');
          await sendKnotviteInvoiceEmail(
            user?.email || '',
            user?.name || 'Customer',
            invoice
          );
          await storage.updateKnotviteInvoice(invoice.id, { emailSent: true });
        } catch (err) {
          console.error('[KnotVite] Invoice email error:', err);
        }
        try {
          await sendPaymentSuccessAdminNotification(
            user?.name || '',
            user?.email || '',
            `KnotVite - ${user?.name || ''}`,
            catalogItem?.name || sub.plan,
            gst.totalAmount
          );
        } catch (err) {
          console.error('[KnotVite] Admin notification error:', err);
        }
      })();
      res.json({ success: true, invoice });
    } catch (error) {
      console.error('[KnotVite Billing] Verify payment error:', error);
      res.status(500).json({ error: 'Failed to verify payment' });
    }
  });

  app.get('/api/knotvite/invoices', verifyJWT, async (req, res) => {
    try {
      const companyId = req.user!.companyId;
      const invoices = await storage.getKnotviteInvoices(companyId);
      res.json(invoices);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch invoices' });
    }
  });

  app.get('/api/knotvite/invoices/:id/download', verifyJWT, async (req, res) => {
    try {
      const invoice = await storage.getKnotviteInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }
      if (invoice.companyId !== req.user!.companyId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      const html = generateGSTInvoiceHTML(invoice);
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `inline; filename="${invoice.invoiceNumber}.html"`);
      res.send(html);
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate invoice' });
    }
  });

  // ============ KnotVite RSVP Module ============
  app.get("/api/knotvite/plan-status", verifyJWT, async (req, res) => {
    try {
      const companyId = req.user!.companyId;
      const moduleSubs = await storage.getCompanyModuleSubscriptions(companyId);
      const rsvpSub = moduleSubs.find(s => s.moduleCode === 'rsvp' && s.status === 'active');
      const plan = rsvpSub ? 'pro' : 'free';
      const templates = await storage.getRsvpFormTemplates(companyId);
      let totalGuests = 0;
      for (const template of templates) {
        if (template.eventId) {
          const submissions = await storage.getRsvpSubmissions(template.eventId);
          totalGuests += submissions.length;
        }
      }
      const limits = plan === 'pro' ? {
        maxForms: 999999, maxGuestsPerForm: 999999, maxCustomFields: 999999,
        canExportExcel: true, canBulkImport: true, canRemoveBranding: true, canUseWhatsApp: true,
      } : {
        maxForms: 1, maxGuestsPerForm: 100, maxCustomFields: 5,
        canExportExcel: false, canBulkImport: false, canRemoveBranding: false, canUseWhatsApp: false,
      };
      res.json({
        plan,
        currentUsage: { forms: templates.length, totalGuests },
        limits,
        subscription: rsvpSub || null,
      });
    } catch (error) {
      console.error('[KnotVite] Plan status error:', error);
      res.status(500).json({ error: 'Failed to fetch plan status' });
    }
  });

  // KnotVite Events CRUD
  app.get("/api/knotvite/events", verifyJWT, async (req, res) => {
    try {
      const userId = String(req.user!.userId);
      const events = await storage.getKnotviteEvents(userId);
      res.json(events);
    } catch (error) {
      console.error('[KnotVite] Events fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch events' });
    }
  });

  app.get("/api/knotvite/events/:id", verifyJWT, async (req, res) => {
    try {
      const event = await storage.getKnotviteEvent(req.params.id);
      if (!event) return res.status(404).json({ error: 'Event not found' });
      if (String(event.userId) !== String(req.user!.userId)) return res.status(403).json({ error: 'Unauthorized' });
      res.json(event);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch event' });
    }
  });

  app.post("/api/knotvite/events", verifyJWT, async (req, res) => {
    try {
      const userId = String(req.user!.userId);
      const companyId = req.user!.companyId;

      const kvSub = await storage.getKnotviteSubscription(companyId);
      const plan = (kvSub?.plan || 'basic') as any;

      const { getKnotViteLimits } = await import('../shared/knotvite-limits');
      const limits = getKnotViteLimits(plan);
      const currentCount = await storage.countKnotviteEvents(userId);

      if (currentCount >= limits.maxEvents) {
        return res.status(403).json({
          error: `You've reached the limit of ${limits.maxEvents} event(s) on your ${plan} plan. Upgrade to create more events.`,
          code: 'EVENT_LIMIT_REACHED',
          limit: limits.maxEvents,
          current: currentCount,
        });
      }

      const event = await storage.createKnotviteEvent({
        userId,
        companyId,
        title: req.body.title,
        eventType: req.body.eventType || 'wedding',
        date: req.body.date,
        endDate: req.body.endDate,
        venue: req.body.venue,
        city: req.body.city,
        description: req.body.description,
        groomName: req.body.groomName,
        brideName: req.body.brideName,
        contactPhone: req.body.contactPhone,
        contactEmail: req.body.contactEmail,
        status: 'active',
      });
      res.json(event);
    } catch (error) {
      console.error('[KnotVite] Event create error:', error);
      res.status(500).json({ error: 'Failed to create event' });
    }
  });

  app.patch("/api/knotvite/events/:id", verifyJWT, async (req, res) => {
    try {
      const event = await storage.getKnotviteEvent(req.params.id);
      if (!event) return res.status(404).json({ error: 'Event not found' });
      if (String(event.userId) !== String(req.user!.userId)) return res.status(403).json({ error: 'Unauthorized' });

      const updated = await storage.updateKnotviteEvent(req.params.id, {
        title: req.body.title,
        eventType: req.body.eventType,
        date: req.body.date,
        endDate: req.body.endDate,
        venue: req.body.venue,
        city: req.body.city,
        description: req.body.description,
        groomName: req.body.groomName,
        brideName: req.body.brideName,
        contactPhone: req.body.contactPhone,
        contactEmail: req.body.contactEmail,
        status: req.body.status,
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update event' });
    }
  });

  app.delete("/api/knotvite/events/:id", verifyJWT, async (req, res) => {
    try {
      const event = await storage.getKnotviteEvent(req.params.id);
      if (!event) return res.status(404).json({ error: 'Event not found' });
      if (String(event.userId) !== String(req.user!.userId)) return res.status(403).json({ error: 'Unauthorized' });
      await storage.deleteKnotviteEvent(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete event' });
    }
  });

  app.get("/api/knotvite/events-limits", verifyJWT, async (req, res) => {
    try {
      const userId = String(req.user!.userId);
      const companyId = req.user!.companyId;
      const kvSub = await storage.getKnotviteSubscription(companyId);
      const plan = (kvSub?.plan || 'basic') as any;
      const { getKnotViteLimits } = await import('../shared/knotvite-limits');
      const limits = getKnotViteLimits(plan);
      const eventCount = await storage.countKnotviteEvents(userId);
      res.json({ plan, limits, usage: { events: eventCount } });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch limits' });
    }
  });

  // RSVP Form Templates CRUD
  app.get("/api/rsvp/templates", verifyJWT, async (req, res) => {
    try {
      const companyId = req.user!.companyId;
      const templates = await storage.getRsvpFormTemplates(companyId);
      res.json(templates);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch templates' });
    }
  });

  app.get("/api/rsvp/templates/:id", verifyJWT, async (req, res) => {
    try {
      const template = await storage.getRsvpFormTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch template' });
    }
  });

  app.post("/api/rsvp/templates", verifyJWT, async (req, res) => {
    try {
      const companyId = req.user!.companyId;
      const { name, eventId, description, headerImage, thankYouMessage, isActive, customCss, languages, defaultLanguage, showPlusOne, showDietaryRestrictions, showMealPreference, showTablePreference } = req.body;
      const template = await storage.createRsvpFormTemplate({
        companyId,
        name,
        eventId: eventId || null,
        description: description || null,
        headerImage: headerImage || null,
        thankYouMessage: thankYouMessage || 'Thank you for your RSVP!',
        isActive: isActive ?? true,
        customCss: customCss || null,
        languages: languages || ['en'],
        defaultLanguage: defaultLanguage || 'en',
        showPlusOne: showPlusOne ?? true,
        showDietaryRestrictions: showDietaryRestrictions ?? false,
        showMealPreference: showMealPreference ?? false,
        showTablePreference: showTablePreference ?? false,
      });
      res.json(template);
    } catch (error) {
      console.error('[RSVP] Create template error:', error);
      res.status(500).json({ error: 'Failed to create template' });
    }
  });

  app.patch("/api/rsvp/templates/:id", verifyJWT, async (req, res) => {
    try {
      const template = await storage.updateRsvpFormTemplate(req.params.id, req.body);
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update template' });
    }
  });

  app.delete("/api/rsvp/templates/:id", verifyJWT, async (req, res) => {
    try {
      await storage.deleteRsvpFormTemplate(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete template' });
    }
  });

  // RSVP Form Fields
  app.get("/api/rsvp/templates/:templateId/fields", verifyJWT, async (req, res) => {
    try {
      const fields = await storage.getRsvpFormFields(req.params.templateId);
      res.json(fields);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch fields' });
    }
  });

  app.post("/api/rsvp/templates/:templateId/fields", verifyJWT, async (req, res) => {
    try {
      const { fieldName, fieldType, fieldLabel, isRequired, options, sortOrder, placeholder, helpText } = req.body;
      const field = await storage.createRsvpFormField({
        templateId: req.params.templateId,
        fieldName,
        fieldType,
        fieldLabel,
        isRequired: isRequired ?? false,
        options: options || null,
        sortOrder: sortOrder || 0,
        placeholder: placeholder || null,
        helpText: helpText || null,
      });
      res.json(field);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create field' });
    }
  });

  app.post("/api/rsvp/templates/:templateId/fields/bulk", verifyJWT, async (req, res) => {
    try {
      const { fields } = req.body;
      if (!Array.isArray(fields)) {
        return res.status(400).json({ error: 'Fields must be an array' });
      }
      const created = [];
      for (const field of fields) {
        const result = await storage.createRsvpFormField({
          templateId: req.params.templateId,
          fieldName: field.fieldName,
          fieldType: field.fieldType,
          fieldLabel: field.fieldLabel,
          isRequired: field.isRequired ?? false,
          options: field.options || null,
          sortOrder: field.sortOrder || 0,
          placeholder: field.placeholder || null,
          helpText: field.helpText || null,
        });
        created.push(result);
      }
      res.json(created);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create fields' });
    }
  });

  app.patch("/api/rsvp/fields/:id", verifyJWT, async (req, res) => {
    try {
      const field = await storage.updateRsvpFormField(req.params.id, req.body);
      res.json(field);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update field' });
    }
  });

  app.delete("/api/rsvp/fields/:id", verifyJWT, async (req, res) => {
    try {
      await storage.deleteRsvpFormField(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete field' });
    }
  });

  app.post("/api/rsvp/templates/:templateId/fields/reorder", verifyJWT, async (req, res) => {
    try {
      const { fieldIds } = req.body;
      if (!Array.isArray(fieldIds)) {
        return res.status(400).json({ error: 'fieldIds must be an array' });
      }
      for (let i = 0; i < fieldIds.length; i++) {
        await storage.updateRsvpFormField(fieldIds[i], { sortOrder: i });
      }
      const fields = await storage.getRsvpFormFields(req.params.templateId);
      res.json(fields);
    } catch (error) {
      res.status(500).json({ error: 'Failed to reorder fields' });
    }
  });

  // RSVP Bulk Import
  app.post("/api/rsvp/bulk-import", verifyJWT, async (req, res) => {
    try {
      const { eventId, guests } = req.body;
      if (!eventId || !Array.isArray(guests)) {
        return res.status(400).json({ error: 'eventId and guests array required' });
      }
      const imported = [];
      for (const guest of guests) {
        try {
          const result = await storage.createEventGuest({
            eventId,
            name: guest.name,
            phone: guest.phone || null,
            email: guest.email || null,
            tableNumber: guest.tableNumber || null,
            category: guest.category || 'general',
            plusOnes: guest.plusOnes || 0,
            dietaryRestrictions: guest.dietaryRestrictions || null,
            notes: guest.notes || null,
            status: 'pending',
          });
          imported.push(result);
        } catch (err) {
          console.error('[RSVP Import] Error importing guest:', err);
        }
      }
      res.json({ imported: imported.length, total: guests.length });
    } catch (error) {
      console.error('[RSVP Import] Error:', error);
      res.status(500).json({ error: 'Failed to import guests' });
    }
  });

  // KnotVite WhatsApp
  app.post("/api/knotvite/send-whatsapp", verifyJWT, async (req, res) => {
    try {
      const { guestId, templateName, eventId, guestName, guestPhone, eventName, eventDate, eventVenue, rsvpLink, message: customMessage } = req.body;
      if (!guestPhone) {
        return res.status(400).json({ error: 'Guest phone number required' });
      }
      const phone = guestPhone.replace(/[^\d+]/g, '');
      if (phone.length < 10) {
        return res.status(400).json({ error: 'Invalid phone number' });
      }
      let result;
      if (templateName === 'rsvp_invitation' || templateName === 'rsvp_reminder') {
        result = await sendRsvpReminderWhatsApp(phone, guestName || 'Guest', eventName || 'Event', eventDate || '', eventVenue || '', rsvpLink || '');
      } else {
        result = await sendWhatsAppMessage(phone, customMessage || `Dear ${guestName}, you are invited to ${eventName}. Please RSVP here: ${rsvpLink}`);
      }
      if (guestId) {
        try {
          await storage.updateEventGuest(guestId, { whatsappStatus: 'sent', whatsappSentAt: new Date() });
        } catch {}
      }
      res.json({ success: true, result });
    } catch (error: any) {
      console.error('[KnotVite WhatsApp] Error:', error);
      res.status(500).json({ error: error.message || 'Failed to send WhatsApp' });
    }
  });

  // Public RSVP Routes (no auth required)
  app.get("/api/public/rsvp/:id", async (req, res) => {
    try {
      const template = await storage.getRsvpFormTemplate(req.params.id);
      if (!template || !template.isActive) {
        return res.status(404).json({ error: 'RSVP form not found or inactive' });
      }
      const fields = await storage.getRsvpFormFields(template.id);
      let event = null;
      if (template.eventId) {
        event = await storage.getEvent(template.eventId);
      }
      res.json({
        template: {
          id: template.id,
          name: template.name,
          description: template.description,
          headerImage: template.headerImage,
          thankYouMessage: template.thankYouMessage,
          customCss: template.customCss,
          languages: template.languages,
          defaultLanguage: template.defaultLanguage,
          showPlusOne: template.showPlusOne,
          showDietaryRestrictions: template.showDietaryRestrictions,
          showMealPreference: template.showMealPreference,
          showTablePreference: template.showTablePreference,
        },
        fields,
        event: event ? {
          name: event.eventName || event.name,
          date: event.eventDate || event.date,
          venue: event.venue,
        } : null,
      });
    } catch (error) {
      console.error('[Public RSVP] Get form error:', error);
      res.status(500).json({ error: 'Failed to load RSVP form' });
    }
  });

  app.post("/api/public/rsvp/:id/submit", async (req, res) => {
    try {
      const template = await storage.getRsvpFormTemplate(req.params.id);
      if (!template || !template.isActive) {
        return res.status(404).json({ error: 'RSVP form not found or inactive' });
      }
      const { name, email, phone, status, plusOnes, dietaryRestrictions, mealPreference, tablePreference, customFields, message } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }
      const eventId = template.eventId;
      if (!eventId) {
        return res.status(400).json({ error: 'No event linked to this form' });
      }
      const guest = await storage.createEventGuest({
        eventId,
        name,
        email: email || null,
        phone: phone || null,
        status: status || 'confirmed',
        plusOnes: plusOnes || 0,
        dietaryRestrictions: dietaryRestrictions || null,
        notes: message || null,
        category: 'rsvp',
        submittedVia: 'rsvp_form',
        rsvpTemplateId: template.id,
        customFieldData: customFields || null,
      });
      const rsvpResponse = await storage.createRsvpResponse({
        eventId,
        guestId: guest.id,
        name,
        email: email || null,
        phone: phone || null,
        status: status || 'confirmed',
        plusOnes: plusOnes || 0,
        dietaryRestrictions: dietaryRestrictions || null,
        message: message || null,
        submittedVia: 'rsvp_form',
      });
      res.json({ success: true, response: rsvpResponse });
    } catch (error) {
      console.error('[Public RSVP] Submit error:', error);
      res.status(500).json({ error: 'Failed to submit RSVP' });
    }
  });

  // Portal leads routes
  app.get('/api/portal-leads', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const leads = await storage.getAllPortalLeads();
      res.json(leads);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/portal-leads/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const lead = await storage.getPortalLead(req.params.id);
      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }
      res.json(lead);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/portal-leads/:id', async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const lead = await storage.updatePortalLead(req.params.id, req.body);
      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }
      res.json(lead);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Print data route
  app.get('/api/print-data/:type/:id', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      const { type, id } = req.params;
      const user = await storage.getUser(req.session.userId);
      const companyId = user?.companyId;
      const companySettings = await storage.getCompanySettings();
      const result: any = { companySettings };
      if (type === 'quote') {
        const estimate = await storage.getEstimate(id);
        result.estimate = estimate;
        if (estimate?.customerId) {
          result.customer = await storage.getCustomer(estimate.customerId);
        }
      } else if (type === 'invoice') {
        const invoice = await storage.getInvoice(id);
        result.invoice = invoice;
        if (invoice?.customerId) {
          result.customer = await storage.getCustomer(invoice.customerId);
        }
      } else if (type === 'delivery-challan') {
        const challan = await storage.getDeliveryChallan(id);
        result.challan = challan;
        if (challan?.customerId) {
          result.customer = await storage.getCustomer(challan.customerId);
        }
      } else {
        return res.status(400).json({ error: 'Invalid print data type' });
      }
      res.json(result);
    } catch (error) {
      console.error('Error getting print data:', error);
      res.status(500).json({ error: 'Failed to get print data' });
    }
  });


  return httpServer;
}

import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
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
  type InsertEventMilestone,
} from "@shared/schema";
import bcrypt from "bcryptjs";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import * as pdfParseModule from "pdf-parse";

const PgSession = connectPgSimple(session);

interface ParsedLineItem {
  slNo: number;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
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

function cleanNumber(str: string): number {
  if (!str) return 0;
  const cleaned = str.replace(/[₹,\s]/g, '').replace(/[^\d.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
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
          quantity,
          rate: cleanNumber(itemMatch[4]),
          amount: cleanNumber(itemMatch[5]),
        });
        continue;
      }
    }
    
    const parts = line.split(/\s{2,}|\t+/);
    if (parts.length >= 4 && /^\d+$/.test(parts[0].trim())) {
      const slNo = parseInt(parts[0].trim());
      let desc = '';
      let qty = 0;
      let rate = 0;
      let amount = 0;
      
      for (let j = parts.length - 1; j >= 1; j--) {
        const val = cleanNumber(parts[j]);
        if (val > 0) {
          if (!amount) amount = val;
          else if (!rate) rate = val;
          else if (!qty) { qty = val; break; }
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
          quantity: qty,
          rate,
          amount,
        });
        continue;
      }
    }
    
    const altMatch = line.match(altLineItemRegex);
    if (altMatch) {
      const slNo = parseInt(altMatch[1]);
      const rest = altMatch[2];
      const numbers = rest.match(/[\d,.]+/g) || [];
      if (numbers.length >= 3) {
        const qty = cleanNumber(numbers[numbers.length - 3]);
        const rate = cleanNumber(numbers[numbers.length - 2]);
        const amount = cleanNumber(numbers[numbers.length - 1]);
        let desc = rest;
        for (const num of numbers.slice(-3)) {
          desc = desc.replace(num, '').trim();
        }
        desc = desc.replace(/\s+/g, ' ').trim();
        
        if (desc && qty > 0) {
          currentSection.items.push({
            slNo,
            description: desc,
            quantity: qty,
            rate,
            amount,
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
        if (numbers.length >= 3) {
          const qty = cleanNumber(numbers[numbers.length - 3]);
          const rate = cleanNumber(numbers[numbers.length - 2]);
          const amount = cleanNumber(numbers[numbers.length - 1]);
          let desc = line.replace(/^\d+\s*/, '');
          for (const num of numbers.slice(-3)) {
            desc = desc.replace(num, '').trim();
          }
          desc = desc.replace(/\s+/g, ' ').trim();
          
          if (desc && qty > 0) {
            fallbackSection.items.push({
              slNo: fallbackSection.items.length + 1,
              description: desc,
              quantity: qty,
              rate,
              amount,
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
    'event-calendar',
    'team-calendar',
    'event-database',
    'event-milestones',
    'daybook',
    'oak-book',
    'oak-sales',
    'oak-inventory',
    'hr',
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
        },
        permissions: permissionsList
      });
    } catch (error) {
      res.status(500).json({ error: 'Login failed' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => {
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
      },
      permissions: permissionsList
    });
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
      const user = await storage.createUser({ ...data, password: hashedPassword });
      
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

      await storage.deleteUser(req.params.id);
      res.json({ success: true });
    } catch (error) {
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
      const event = await storage.createEvent(data);
      res.json(event);
    } catch (error) {
      res.status(400).json({ error: 'Invalid event data' });
    }
  });

  app.patch('/api/events/:id', async (req, res) => {
    try {
      const event = await storage.updateEvent(req.params.id, req.body);
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

  // Oak Book - Customers
  app.get('/api/customers', async (req, res) => {
    const customers = await storage.getAllCustomers();
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
      const customer = await storage.createCustomer(data);
      res.json(customer);
    } catch (error) {
      res.status(400).json({ error: 'Invalid customer data' });
    }
  });

  app.patch('/api/customers/:id', async (req, res) => {
    try {
      const customer = await storage.updateCustomer(req.params.id, req.body);
      res.json(customer);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update customer' });
    }
  });

  app.delete('/api/customers/:id', async (req, res) => {
    await storage.deleteCustomer(req.params.id);
    res.json({ success: true });
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
    const estimates = await storage.getAllEstimates();
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
        customerId: estimate.customerId,
        eventId: estimate.eventId,
        estimateId: estimate.id,
        date: new Date().toISOString().split('T')[0],
        dueDate: estimate.dueDate,
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
    const invoices = await storage.getAllInvoices();
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
    const payments = await storage.getAllCustomerPayments();
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
      const data = insertCustomerPaymentSchema.parse(req.body);
      let customerName = 'Customer';
      if (data.customerId) {
        const customer = await storage.getCustomer(data.customerId);
        if (customer) customerName = customer.name;
      }
      const payment = await storage.createCustomerPaymentWithDaybook(data, customerName);
      res.json(payment);
    } catch (error) {
      console.error('Customer payment error:', error);
      res.status(400).json({ error: 'Invalid payment data' });
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
            const daysWorked = itemUpdate.daysWorked ?? item.daysWorked;
            const grossPay = dailyRate * daysWorked;
            const deductions = parseFloat(item.deductions || '0');
            const netPay = grossPay - deductions;
            
            await storage.updatePayrollItem(itemUpdate.id, {
              daysWorked,
              dailyRate: dailyRate.toFixed(2),
              grossPay: grossPay.toFixed(2),
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
    const contacts = await storage.getAllSalesContacts();
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
      res.json(deal);
    } catch (error) {
      res.status(400).json({ error: 'Failed to create deal' });
    }
  });

  app.patch('/api/sales/deals/:id', async (req, res) => {
    try {
      const deal = await storage.updateSalesDeal(req.params.id, req.body);
      res.json(deal);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update deal' });
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

      const pdfBuffer = Buffer.from(pdfBase64, 'base64');
      const pdfParseFn = (pdfParseModule as any).default || pdfParseModule;
      const pdfData = await pdfParseFn(pdfBuffer);
      
      const parsedData = parseEstimatePDF(pdfData.text);
      
      res.json({ 
        success: true, 
        parsedData,
        filename,
        rawText: pdfData.text 
      });
    } catch (error: any) {
      console.error('PDF parse error:', error);
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
        
        const isValidDate = section.date && /^\d{4}-\d{2}-\d{2}$/.test(section.date);
        
        items.push({
          eventId: eventId || null,
          eventName: eventName || section.eventName || 'Imported',
          eventDate: isValidDate ? section.date : null,
          decorType: (section.category || section.eventName || 'Imported Section').substring(0, 100),
          setupDate: isValidDate ? section.date : null,
          setupTime: section.startTime || null,
          endTime: section.endTime || null,
          priority: 'medium',
          status: 'pending',
          pastelColor: pastelColors[i % pastelColors.length],
          sectionLabel: (section.originalHeading || '').substring(0, 255)
        });

        for (const item of section.items) {
          if (!item || !item.description) continue;
          
          const qty = typeof item.quantity === 'number' ? item.quantity : parseInt(item.quantity) || 1;
          
          elements.push({
            itemIndex: i,
            element: {
              elementName: String(item.description).substring(0, 255),
              quantity: Math.max(1, qty),
              unit: 'Nos',
              source: 'to_buy',
              notes: item.notes ? String(item.notes).substring(0, 500) : ''
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

  // Notifications API
  app.get('/api/notifications', async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const unreadOnly = req.query.unreadOnly === 'true';
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const notifications = await storage.getUserNotifications(userId, { unreadOnly, limit });
      res.json(notifications);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch notifications' });
    }
  });

  app.get('/api/notifications/unread-count', async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const count = await storage.getUnreadNotificationCount(userId);
      res.json({ count });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to get unread count' });
    }
  });

  app.patch('/api/notifications/:id/read', async (req, res) => {
    try {
      const notification = await storage.markNotificationAsRead(req.params.id);
      if (!notification) {
        return res.status(404).json({ error: 'Notification not found' });
      }
      res.json(notification);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to mark notification as read' });
    }
  });

  app.post('/api/notifications/mark-all-read', async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      await storage.markAllNotificationsAsRead(userId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to mark all as read' });
    }
  });

  app.delete('/api/notifications/:id', async (req, res) => {
    try {
      await storage.dismissNotification(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to dismiss notification' });
    }
  });

  app.post('/api/notifications/dismiss-all', async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      await storage.dismissAllNotifications(userId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to dismiss all' });
    }
  });

  // Notification Preferences API
  app.get('/api/notification-preferences', async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      let preferences = await storage.getNotificationPreferences(userId);
      if (!preferences) {
        preferences = await storage.createNotificationPreferences({ userId });
      }
      res.json(preferences);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to get preferences' });
    }
  });

  app.put('/api/notification-preferences', async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      let preferences = await storage.getNotificationPreferences(userId);
      if (!preferences) {
        preferences = await storage.createNotificationPreferences({ userId, ...req.body });
      } else {
        preferences = await storage.updateNotificationPreferences(userId, req.body);
      }
      res.json(preferences);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update preferences' });
    }
  });

  // Notification Generation - Generate notifications based on upcoming deadlines
  app.post('/api/notifications/generate', async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const preferences = await storage.getNotificationPreferences(userId) || 
        await storage.createNotificationPreferences({ userId });
      
      const today = new Date();
      const notifications: any[] = [];

      // Generate event reminders
      if (preferences.eventRemindersEnabled) {
        const futureDate = new Date(today);
        futureDate.setDate(futureDate.getDate() + preferences.eventReminderDays);
        const allEvents = await storage.getAllEvents();
        
        for (const event of allEvents) {
          const eventDate = new Date(event.date);
          const daysUntil = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysUntil > 0 && daysUntil <= preferences.eventReminderDays) {
            notifications.push({
              userId,
              type: 'event_reminder',
              title: `Upcoming Event: ${event.title}`,
              message: `${event.title} is scheduled in ${daysUntil} day${daysUntil > 1 ? 's' : ''} at ${event.venue}`,
              priority: daysUntil <= 1 ? 'high' : 'normal',
              relatedEntityType: 'event',
              relatedEntityId: event.id,
              actionUrl: '/events',
              sentAt: new Date()
            });
          }
        }
      }

      // Generate invoice due reminders
      if (preferences.invoiceDueRemindersEnabled) {
        const allInvoices = await storage.getAllInvoices();
        
        for (const invoice of allInvoices) {
          if (invoice.dueDate && invoice.status !== 'paid') {
            const dueDate = new Date(invoice.dueDate);
            const daysUntil = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            
            if (daysUntil >= 0 && daysUntil <= preferences.invoiceReminderDays) {
              notifications.push({
                userId,
                type: 'invoice_due',
                title: `Invoice Due: ${invoice.number}`,
                message: daysUntil === 0 
                  ? `Invoice ${invoice.number} is due today` 
                  : `Invoice ${invoice.number} is due in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`,
                priority: daysUntil <= 1 ? 'high' : 'normal',
                relatedEntityType: 'invoice',
                relatedEntityId: invoice.id,
                actionUrl: '/oak-book',
                sentAt: new Date()
              });
            }
          }
        }
      }

      // Generate estimate due reminders
      if (preferences.estimateDueRemindersEnabled) {
        const allEstimates = await storage.getAllEstimates();
        
        for (const estimate of allEstimates) {
          if (estimate.dueDate && estimate.status === 'sent') {
            const dueDate = new Date(estimate.dueDate);
            const daysUntil = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            
            if (daysUntil >= 0 && daysUntil <= preferences.estimateReminderDays) {
              notifications.push({
                userId,
                type: 'estimate_due',
                title: `Estimate Expires: ${estimate.number}`,
                message: daysUntil === 0 
                  ? `Estimate ${estimate.number} expires today` 
                  : `Estimate ${estimate.number} expires in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`,
                priority: daysUntil <= 1 ? 'high' : 'normal',
                relatedEntityType: 'estimate',
                relatedEntityId: estimate.id,
                actionUrl: '/oak-book',
                sentAt: new Date()
              });
            }
          }
        }
      }

      // Generate production deadline reminders
      if (preferences.productionDeadlineRemindersEnabled) {
        const allDecorItems = await storage.getAllProductionDecorItems();
        
        for (const item of allDecorItems) {
          if (item.setupDate && item.status === 'pending') {
            const setupDate = new Date(item.setupDate);
            const daysUntil = Math.ceil((setupDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            
            if (daysUntil >= 0 && daysUntil <= preferences.productionReminderDays) {
              notifications.push({
                userId,
                type: 'production_deadline',
                title: `Production Setup: ${item.decorType}`,
                message: daysUntil === 0 
                  ? `${item.decorType} setup is scheduled for today` 
                  : `${item.decorType} setup in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`,
                priority: item.priority === 'urgent' || daysUntil <= 1 ? 'high' : 'normal',
                relatedEntityType: 'production_task',
                relatedEntityId: item.id,
                actionUrl: '/oak-inventory',
                sentAt: new Date()
              });
            }
          }
        }
      }

      // Create notifications if any were generated
      if (notifications.length > 0) {
        await storage.createManyNotifications(notifications);
      }

      res.json({ 
        success: true, 
        notificationsGenerated: notifications.length 
      });
    } catch (error: any) {
      console.error('Notification generation error:', error);
      res.status(500).json({ error: error.message || 'Failed to generate notifications' });
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

  return httpServer;
}

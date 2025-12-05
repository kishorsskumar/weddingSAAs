import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertUserSchema,
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

const PgSession = connectPgSimple(session);

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
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
      },
    })
  );

  // All available pages for admin/superadmin
  const ALL_PAGES = [
    'dashboard',
    'event-calendar',
    'team-calendar',
    'event-database',
    'event-milestones',
    'daybook',
    'oak-book',
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

  // Users
  app.get('/api/users', async (req, res) => {
    const users = await storage.getAllUsers();
    const usersWithPermissions = await Promise.all(
      users.map(async (user) => {
        const permissions = await storage.getUserPermissions(user.id);
        return {
          ...user,
          password: undefined, // Don't send passwords
          allowedPages: permissions.map(p => p.pageId),
        };
      })
    );
    res.json(usersWithPermissions);
  });

  app.post('/api/users', async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);
      const hashedPassword = await bcrypt.hash(data.password, 10);
      const user = await storage.createUser({ ...data, password: hashedPassword });
      
      // Set default permissions
      await storage.setUserPermissions(user.id, ['dashboard']);
      
      res.json({ ...user, password: undefined });
    } catch (error) {
      res.status(400).json({ error: 'Invalid user data' });
    }
  });

  app.patch('/api/users/:id/permissions', async (req, res) => {
    try {
      const { id } = req.params;
      const { pageIds } = req.body;
      await storage.setUserPermissions(id, pageIds);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: 'Failed to update permissions' });
    }
  });

  app.patch('/api/users/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body;
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
    await storage.deleteUser(req.params.id);
    res.json({ success: true });
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
      const entry = await storage.createDaybookEntry(data);
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
      const entry = await storage.updateDaybookEntry(req.params.id, req.body);
      res.json(entry);
    } catch (error) {
      res.status(400).json({ error: 'Failed to update entry' });
    }
  });

  app.delete('/api/daybook/:id', async (req, res) => {
    const entry = await storage.getDaybookEntry(req.params.id);
    if (entry && entry.bankId) {
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

  return httpServer;
}

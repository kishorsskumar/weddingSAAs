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

  // Auth endpoints
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await storage.getUserByEmail(email);
      
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const permissions = await storage.getUserPermissions(user.id);
      (req.session as any).userId = user.id;
      
      res.json({ 
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
        },
        permissions: permissions.map(p => p.pageId)
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

    const permissions = await storage.getUserPermissions(user.id);
    res.json({ 
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
      permissions: permissions.map(p => p.pageId)
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

  return httpServer;
}

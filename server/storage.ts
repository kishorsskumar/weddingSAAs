import { 
  users, 
  userPermissions,
  events, 
  meetings, 
  employees, 
  daybookEntries, 
  banks,
  bankTransfers,
  leaveRequests,
  eventMilestones,
  customers,
  vendors,
  estimates,
  invoices,
  customerPayments,
  expenses,
  vendorPayments,
  type User, 
  type InsertUser,
  type UserPermission,
  type InsertUserPermission,
  type Event,
  type InsertEvent,
  type Meeting,
  type InsertMeeting,
  type Employee,
  type InsertEmployee,
  type DaybookEntry,
  type InsertDaybookEntry,
  type Bank,
  type InsertBank,
  type BankTransfer,
  type InsertBankTransfer,
  type LeaveRequest,
  type InsertLeaveRequest,
  type EventMilestone,
  type InsertEventMilestone,
  type Customer,
  type InsertCustomer,
  type Vendor,
  type InsertVendor,
  type Estimate,
  type InsertEstimate,
  type Invoice,
  type InsertInvoice,
  type CustomerPayment,
  type InsertCustomerPayment,
  type Expense,
  type InsertExpense,
  type VendorPayment,
  type InsertVendorPayment,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
  getAllUsers(): Promise<User[]>;
  
  // User Permissions
  getUserPermissions(userId: string): Promise<UserPermission[]>;
  setUserPermissions(userId: string, pageIds: string[]): Promise<void>;
  
  // Events
  getAllEvents(): Promise<Event[]>;
  getEvent(id: string): Promise<Event | undefined>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: string, event: Partial<InsertEvent>): Promise<Event | undefined>;
  deleteEvent(id: string): Promise<void>;
  
  // Meetings
  getAllMeetings(): Promise<Meeting[]>;
  getMeetingsByDate(date: string): Promise<Meeting[]>;
  createMeeting(meeting: InsertMeeting): Promise<Meeting>;
  updateMeeting(id: string, meeting: Partial<InsertMeeting>): Promise<Meeting | undefined>;
  deleteMeeting(id: string): Promise<void>;
  
  // Employees
  getAllEmployees(): Promise<Employee[]>;
  getEmployee(id: string): Promise<Employee | undefined>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: string, employee: Partial<InsertEmployee>): Promise<Employee | undefined>;
  deleteEmployee(id: string): Promise<void>;
  
  // Daybook
  getAllDaybookEntries(): Promise<DaybookEntry[]>;
  getDaybookEntry(id: string): Promise<DaybookEntry | undefined>;
  getDaybookEntriesByDateRange(startDate: string, endDate: string): Promise<DaybookEntry[]>;
  createDaybookEntry(entry: InsertDaybookEntry): Promise<DaybookEntry>;
  updateDaybookEntry(id: string, entry: Partial<InsertDaybookEntry>): Promise<DaybookEntry | undefined>;
  deleteDaybookEntry(id: string): Promise<void>;
  
  // Banks
  getAllBanks(): Promise<Bank[]>;
  getBank(id: string): Promise<Bank | undefined>;
  createBank(bank: InsertBank): Promise<Bank>;
  updateBank(id: string, bank: Partial<InsertBank>): Promise<Bank | undefined>;
  deleteBank(id: string): Promise<void>;

  // Bank Transfers
  getAllBankTransfers(): Promise<BankTransfer[]>;
  getBankTransfer(id: string): Promise<BankTransfer | undefined>;
  getBankTransfersByDate(date: string): Promise<BankTransfer[]>;
  getBankTransfersByDateRange(startDate: string, endDate: string): Promise<BankTransfer[]>;
  createBankTransfer(transfer: InsertBankTransfer): Promise<BankTransfer>;
  deleteBankTransfer(id: string): Promise<void>;
  
  // Leave Requests
  getAllLeaveRequests(): Promise<LeaveRequest[]>;
  getLeaveRequest(id: string): Promise<LeaveRequest | undefined>;
  createLeaveRequest(request: InsertLeaveRequest): Promise<LeaveRequest>;
  updateLeaveRequest(id: string, request: Partial<InsertLeaveRequest>): Promise<LeaveRequest | undefined>;
  deleteLeaveRequest(id: string): Promise<void>;

  // Event Milestones
  getAllMilestones(): Promise<EventMilestone[]>;
  getMilestonesByEventId(eventId: string): Promise<EventMilestone[]>;
  createMilestone(milestone: InsertEventMilestone): Promise<EventMilestone>;
  createManyMilestones(milestones: InsertEventMilestone[]): Promise<EventMilestone[]>;
  updateMilestone(id: string, milestone: Partial<InsertEventMilestone>): Promise<EventMilestone | undefined>;
  deleteMilestone(id: string): Promise<void>;
  deleteMilestonesByEventId(eventId: string): Promise<void>;

  // Oak Book - Customers
  getAllCustomers(): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, customer: Partial<InsertCustomer>): Promise<Customer | undefined>;
  deleteCustomer(id: string): Promise<void>;

  // Oak Book - Vendors
  getAllVendors(): Promise<Vendor[]>;
  getVendor(id: string): Promise<Vendor | undefined>;
  createVendor(vendor: InsertVendor): Promise<Vendor>;
  updateVendor(id: string, vendor: Partial<InsertVendor>): Promise<Vendor | undefined>;
  deleteVendor(id: string): Promise<void>;

  // Oak Book - Estimates
  getAllEstimates(): Promise<Estimate[]>;
  getEstimate(id: string): Promise<Estimate | undefined>;
  createEstimate(estimate: InsertEstimate): Promise<Estimate>;
  updateEstimate(id: string, estimate: Partial<InsertEstimate>): Promise<Estimate | undefined>;
  deleteEstimate(id: string): Promise<void>;
  getNextEstimateNumber(): Promise<string>;

  // Oak Book - Invoices
  getAllInvoices(): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, invoice: Partial<InsertInvoice>): Promise<Invoice | undefined>;
  deleteInvoice(id: string): Promise<void>;
  getNextInvoiceNumber(): Promise<string>;

  // Oak Book - Customer Payments
  getAllCustomerPayments(): Promise<CustomerPayment[]>;
  getCustomerPayment(id: string): Promise<CustomerPayment | undefined>;
  createCustomerPaymentWithDaybook(payment: InsertCustomerPayment, customerName: string): Promise<CustomerPayment>;
  deleteCustomerPayment(id: string): Promise<void>;
  getNextReceiptNumber(): Promise<string>;

  // Oak Book - Expenses
  getAllExpenses(): Promise<Expense[]>;
  getExpense(id: string): Promise<Expense | undefined>;
  createExpenseWithDaybook(expense: InsertExpense, vendorName: string): Promise<Expense>;
  updateExpense(id: string, expense: Partial<InsertExpense>): Promise<Expense | undefined>;
  deleteExpense(id: string): Promise<void>;
  getNextExpenseNumber(): Promise<string>;

  // Oak Book - Vendor Payments
  getAllVendorPayments(): Promise<VendorPayment[]>;
  getVendorPayment(id: string): Promise<VendorPayment | undefined>;
  createVendorPaymentWithDaybook(payment: InsertVendorPayment, vendorName: string): Promise<VendorPayment>;
  deleteVendorPayment(id: string): Promise<void>;
  getNextVendorPaymentNumber(): Promise<string>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, updateData: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set(updateData).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  // User Permissions
  async getUserPermissions(userId: string): Promise<UserPermission[]> {
    return await db.select().from(userPermissions).where(eq(userPermissions.userId, userId));
  }

  async setUserPermissions(userId: string, pageIds: string[]): Promise<void> {
    await db.delete(userPermissions).where(eq(userPermissions.userId, userId));
    if (pageIds.length > 0) {
      await db.insert(userPermissions).values(
        pageIds.map(pageId => ({ userId, pageId }))
      );
    }
  }

  // Events
  async getAllEvents(): Promise<Event[]> {
    return await db.select().from(events).orderBy(desc(events.date));
  }

  async getEvent(id: string): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event || undefined;
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const [event] = await db.insert(events).values(insertEvent).returning();
    return event;
  }

  async updateEvent(id: string, updateData: Partial<InsertEvent>): Promise<Event | undefined> {
    const [event] = await db.update(events).set(updateData).where(eq(events.id, id)).returning();
    return event || undefined;
  }

  async deleteEvent(id: string): Promise<void> {
    await db.delete(events).where(eq(events.id, id));
  }

  // Meetings
  async getAllMeetings(): Promise<Meeting[]> {
    return await db.select().from(meetings).orderBy(desc(meetings.date));
  }

  async getMeetingsByDate(date: string): Promise<Meeting[]> {
    return await db.select().from(meetings).where(eq(meetings.date, date));
  }

  async createMeeting(insertMeeting: InsertMeeting): Promise<Meeting> {
    const [meeting] = await db.insert(meetings).values(insertMeeting).returning();
    return meeting;
  }

  async updateMeeting(id: string, updateData: Partial<InsertMeeting>): Promise<Meeting | undefined> {
    const [meeting] = await db.update(meetings).set(updateData).where(eq(meetings.id, id)).returning();
    return meeting || undefined;
  }

  async deleteMeeting(id: string): Promise<void> {
    await db.delete(meetings).where(eq(meetings.id, id));
  }

  // Employees
  async getAllEmployees(): Promise<Employee[]> {
    return await db.select().from(employees);
  }

  async getEmployee(id: string): Promise<Employee | undefined> {
    const [employee] = await db.select().from(employees).where(eq(employees.id, id));
    return employee || undefined;
  }

  async createEmployee(insertEmployee: InsertEmployee): Promise<Employee> {
    const [employee] = await db.insert(employees).values(insertEmployee).returning();
    return employee;
  }

  async updateEmployee(id: string, updateData: Partial<InsertEmployee>): Promise<Employee | undefined> {
    const [employee] = await db.update(employees).set(updateData).where(eq(employees.id, id)).returning();
    return employee || undefined;
  }

  async deleteEmployee(id: string): Promise<void> {
    await db.delete(employees).where(eq(employees.id, id));
  }

  // Daybook
  async getAllDaybookEntries(): Promise<DaybookEntry[]> {
    return await db.select().from(daybookEntries).orderBy(desc(daybookEntries.date));
  }

  async getDaybookEntry(id: string): Promise<DaybookEntry | undefined> {
    const [entry] = await db.select().from(daybookEntries).where(eq(daybookEntries.id, id));
    return entry || undefined;
  }

  async getDaybookEntriesByDateRange(startDate: string, endDate: string): Promise<DaybookEntry[]> {
    return await db.select().from(daybookEntries)
      .where(and(
        gte(daybookEntries.date, startDate),
        lte(daybookEntries.date, endDate)
      ))
      .orderBy(desc(daybookEntries.date));
  }

  async createDaybookEntry(insertEntry: InsertDaybookEntry): Promise<DaybookEntry> {
    const [entry] = await db.insert(daybookEntries).values(insertEntry).returning();
    return entry;
  }

  async updateDaybookEntry(id: string, updateData: Partial<InsertDaybookEntry>): Promise<DaybookEntry | undefined> {
    const [entry] = await db.update(daybookEntries).set(updateData).where(eq(daybookEntries.id, id)).returning();
    return entry || undefined;
  }

  async deleteDaybookEntry(id: string): Promise<void> {
    await db.delete(daybookEntries).where(eq(daybookEntries.id, id));
  }

  // Banks
  async getAllBanks(): Promise<Bank[]> {
    return await db.select().from(banks);
  }

  async getBank(id: string): Promise<Bank | undefined> {
    const [bank] = await db.select().from(banks).where(eq(banks.id, id));
    return bank || undefined;
  }

  async createBank(insertBank: InsertBank): Promise<Bank> {
    const [bank] = await db.insert(banks).values(insertBank).returning();
    return bank;
  }

  async updateBank(id: string, updateData: Partial<InsertBank>): Promise<Bank | undefined> {
    const [bank] = await db.update(banks).set(updateData).where(eq(banks.id, id)).returning();
    return bank || undefined;
  }

  async deleteBank(id: string): Promise<void> {
    await db.delete(banks).where(eq(banks.id, id));
  }

  // Bank Transfers
  async getAllBankTransfers(): Promise<BankTransfer[]> {
    return await db.select().from(bankTransfers).orderBy(desc(bankTransfers.date));
  }

  async getBankTransfer(id: string): Promise<BankTransfer | undefined> {
    const [transfer] = await db.select().from(bankTransfers).where(eq(bankTransfers.id, id));
    return transfer || undefined;
  }

  async getBankTransfersByDate(date: string): Promise<BankTransfer[]> {
    return await db.select().from(bankTransfers).where(eq(bankTransfers.date, date));
  }

  async getBankTransfersByDateRange(startDate: string, endDate: string): Promise<BankTransfer[]> {
    return await db.select().from(bankTransfers)
      .where(
        and(
          gte(bankTransfers.date, startDate),
          lte(bankTransfers.date, endDate)
        )
      )
      .orderBy(desc(bankTransfers.date));
  }

  async createBankTransfer(insertTransfer: InsertBankTransfer): Promise<BankTransfer> {
    const [transfer] = await db.insert(bankTransfers).values(insertTransfer).returning();
    return transfer;
  }

  async deleteBankTransfer(id: string): Promise<void> {
    await db.delete(bankTransfers).where(eq(bankTransfers.id, id));
  }

  // Leave Requests
  async getAllLeaveRequests(): Promise<LeaveRequest[]> {
    return await db.select().from(leaveRequests).orderBy(desc(leaveRequests.createdAt));
  }

  async getLeaveRequest(id: string): Promise<LeaveRequest | undefined> {
    const [request] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id));
    return request || undefined;
  }

  async createLeaveRequest(insertRequest: InsertLeaveRequest): Promise<LeaveRequest> {
    const [request] = await db.insert(leaveRequests).values(insertRequest).returning();
    return request;
  }

  async updateLeaveRequest(id: string, updateData: Partial<InsertLeaveRequest>): Promise<LeaveRequest | undefined> {
    const [request] = await db.update(leaveRequests).set(updateData).where(eq(leaveRequests.id, id)).returning();
    return request || undefined;
  }

  async deleteLeaveRequest(id: string): Promise<void> {
    await db.delete(leaveRequests).where(eq(leaveRequests.id, id));
  }

  // Event Milestones
  async getAllMilestones(): Promise<EventMilestone[]> {
    return await db.select().from(eventMilestones).orderBy(eventMilestones.phase, eventMilestones.date);
  }

  async getMilestonesByEventId(eventId: string): Promise<EventMilestone[]> {
    return await db.select().from(eventMilestones)
      .where(eq(eventMilestones.eventId, eventId))
      .orderBy(eventMilestones.phase, eventMilestones.date);
  }

  async createMilestone(insertMilestone: InsertEventMilestone): Promise<EventMilestone> {
    const [milestone] = await db.insert(eventMilestones).values(insertMilestone).returning();
    return milestone;
  }

  async createManyMilestones(milestones: InsertEventMilestone[]): Promise<EventMilestone[]> {
    if (milestones.length === 0) return [];
    const created = await db.insert(eventMilestones).values(milestones).returning();
    return created;
  }

  async updateMilestone(id: string, updateData: Partial<InsertEventMilestone>): Promise<EventMilestone | undefined> {
    const [milestone] = await db.update(eventMilestones).set(updateData).where(eq(eventMilestones.id, id)).returning();
    return milestone || undefined;
  }

  async deleteMilestone(id: string): Promise<void> {
    await db.delete(eventMilestones).where(eq(eventMilestones.id, id));
  }

  async deleteMilestonesByEventId(eventId: string): Promise<void> {
    await db.delete(eventMilestones).where(eq(eventMilestones.eventId, eventId));
  }

  // Oak Book - Customers
  async getAllCustomers(): Promise<Customer[]> {
    return await db.select().from(customers).orderBy(desc(customers.createdAt));
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer || undefined;
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const [customer] = await db.insert(customers).values(insertCustomer).returning();
    return customer;
  }

  async updateCustomer(id: string, updateData: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const [customer] = await db.update(customers).set(updateData).where(eq(customers.id, id)).returning();
    return customer || undefined;
  }

  async deleteCustomer(id: string): Promise<void> {
    await db.delete(customers).where(eq(customers.id, id));
  }

  // Oak Book - Vendors
  async getAllVendors(): Promise<Vendor[]> {
    return await db.select().from(vendors).orderBy(desc(vendors.createdAt));
  }

  async getVendor(id: string): Promise<Vendor | undefined> {
    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, id));
    return vendor || undefined;
  }

  async createVendor(insertVendor: InsertVendor): Promise<Vendor> {
    const [vendor] = await db.insert(vendors).values(insertVendor).returning();
    return vendor;
  }

  async updateVendor(id: string, updateData: Partial<InsertVendor>): Promise<Vendor | undefined> {
    const [vendor] = await db.update(vendors).set(updateData).where(eq(vendors.id, id)).returning();
    return vendor || undefined;
  }

  async deleteVendor(id: string): Promise<void> {
    await db.delete(vendors).where(eq(vendors.id, id));
  }

  // Oak Book - Estimates
  async getAllEstimates(): Promise<Estimate[]> {
    return await db.select().from(estimates).orderBy(desc(estimates.createdAt));
  }

  async getEstimate(id: string): Promise<Estimate | undefined> {
    const [estimate] = await db.select().from(estimates).where(eq(estimates.id, id));
    return estimate || undefined;
  }

  async createEstimate(insertEstimate: InsertEstimate): Promise<Estimate> {
    const [estimate] = await db.insert(estimates).values(insertEstimate).returning();
    return estimate;
  }

  async updateEstimate(id: string, updateData: Partial<InsertEstimate>): Promise<Estimate | undefined> {
    const [estimate] = await db.update(estimates).set(updateData).where(eq(estimates.id, id)).returning();
    return estimate || undefined;
  }

  async deleteEstimate(id: string): Promise<void> {
    await db.delete(estimates).where(eq(estimates.id, id));
  }

  async getNextEstimateNumber(): Promise<string> {
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(estimates);
    const count = Number(result?.count || 0) + 1;
    return `EST-${String(count).padStart(4, '0')}`;
  }

  // Oak Book - Invoices
  async getAllInvoices(): Promise<Invoice[]> {
    return await db.select().from(invoices).orderBy(desc(invoices.createdAt));
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice || undefined;
  }

  async createInvoice(insertInvoice: InsertInvoice): Promise<Invoice> {
    const [invoice] = await db.insert(invoices).values(insertInvoice).returning();
    return invoice;
  }

  async updateInvoice(id: string, updateData: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const [invoice] = await db.update(invoices).set(updateData).where(eq(invoices.id, id)).returning();
    return invoice || undefined;
  }

  async deleteInvoice(id: string): Promise<void> {
    await db.delete(invoices).where(eq(invoices.id, id));
  }

  async getNextInvoiceNumber(): Promise<string> {
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(invoices);
    const count = Number(result?.count || 0) + 1;
    return `INV-${String(count).padStart(4, '0')}`;
  }

  // Oak Book - Customer Payments
  async getAllCustomerPayments(): Promise<CustomerPayment[]> {
    return await db.select().from(customerPayments).orderBy(desc(customerPayments.createdAt));
  }

  async getCustomerPayment(id: string): Promise<CustomerPayment | undefined> {
    const [payment] = await db.select().from(customerPayments).where(eq(customerPayments.id, id));
    return payment || undefined;
  }

  async createCustomerPaymentWithDaybook(insertPayment: InsertCustomerPayment, customerName: string): Promise<CustomerPayment> {
    const daybookEntry = await db.insert(daybookEntries).values({
      date: insertPayment.date,
      description: `Payment from ${customerName} - ${insertPayment.reference || insertPayment.number}`,
      type: 'income',
      amount: insertPayment.amount,
      category: 'Sales Receipt',
      bankId: insertPayment.bankId || null,
    }).returning();

    if (insertPayment.bankId) {
      await db.update(banks)
        .set({ balance: sql`${banks.balance} + ${insertPayment.amount}` })
        .where(eq(banks.id, insertPayment.bankId));
    }

    if (insertPayment.invoiceId) {
      const invoice = await this.getInvoice(insertPayment.invoiceId);
      if (invoice) {
        const newBalanceDue = Number(invoice.balanceDue) - Number(insertPayment.amount);
        const newStatus = newBalanceDue <= 0 ? 'paid' : 'partial';
        await db.update(invoices)
          .set({ balanceDue: String(Math.max(0, newBalanceDue)), status: newStatus })
          .where(eq(invoices.id, insertPayment.invoiceId));
      }
    }

    const [payment] = await db.insert(customerPayments).values({
      ...insertPayment,
      daybookEntryId: daybookEntry[0].id,
    }).returning();
    return payment;
  }

  async deleteCustomerPayment(id: string): Promise<void> {
    const payment = await this.getCustomerPayment(id);
    if (payment) {
      if (payment.daybookEntryId) {
        await db.delete(daybookEntries).where(eq(daybookEntries.id, payment.daybookEntryId));
      }
      if (payment.bankId) {
        await db.update(banks)
          .set({ balance: sql`${banks.balance} - ${payment.amount}` })
          .where(eq(banks.id, payment.bankId));
      }
      if (payment.invoiceId) {
        const invoice = await this.getInvoice(payment.invoiceId);
        if (invoice) {
          const newBalanceDue = Number(invoice.balanceDue) + Number(payment.amount);
          const newStatus = newBalanceDue >= Number(invoice.total) ? 'sent' : 'partial';
          await db.update(invoices)
            .set({ balanceDue: String(newBalanceDue), status: newStatus })
            .where(eq(invoices.id, payment.invoiceId));
        }
      }
    }
    await db.delete(customerPayments).where(eq(customerPayments.id, id));
  }

  async getNextReceiptNumber(): Promise<string> {
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(customerPayments);
    const count = Number(result?.count || 0) + 1;
    return `REC-${String(count).padStart(4, '0')}`;
  }

  // Oak Book - Expenses
  async getAllExpenses(): Promise<Expense[]> {
    return await db.select().from(expenses).orderBy(desc(expenses.createdAt));
  }

  async getExpense(id: string): Promise<Expense | undefined> {
    const [expense] = await db.select().from(expenses).where(eq(expenses.id, id));
    return expense || undefined;
  }

  async createExpenseWithDaybook(insertExpense: InsertExpense, vendorName: string): Promise<Expense> {
    const daybookEntry = await db.insert(daybookEntries).values({
      date: insertExpense.date,
      description: `${insertExpense.category}: ${insertExpense.description} - ${vendorName}`,
      type: 'expense',
      amount: insertExpense.total,
      category: insertExpense.category,
      bankId: insertExpense.bankId || null,
    }).returning();

    if (insertExpense.bankId) {
      await db.update(banks)
        .set({ balance: sql`${banks.balance} - ${insertExpense.total}` })
        .where(eq(banks.id, insertExpense.bankId));
    }

    const [expense] = await db.insert(expenses).values({
      ...insertExpense,
      daybookEntryId: daybookEntry[0].id,
      status: insertExpense.bankId ? 'paid' : 'recorded',
    }).returning();
    return expense;
  }

  async updateExpense(id: string, updateData: Partial<InsertExpense>): Promise<Expense | undefined> {
    const [expense] = await db.update(expenses).set(updateData).where(eq(expenses.id, id)).returning();
    return expense || undefined;
  }

  async deleteExpense(id: string): Promise<void> {
    const expense = await this.getExpense(id);
    if (expense) {
      if (expense.daybookEntryId) {
        await db.delete(daybookEntries).where(eq(daybookEntries.id, expense.daybookEntryId));
      }
      if (expense.bankId && expense.status === 'paid') {
        await db.update(banks)
          .set({ balance: sql`${banks.balance} + ${expense.total}` })
          .where(eq(banks.id, expense.bankId));
      }
    }
    await db.delete(expenses).where(eq(expenses.id, id));
  }

  async getNextExpenseNumber(): Promise<string> {
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(expenses);
    const count = Number(result?.count || 0) + 1;
    return `EXP-${String(count).padStart(4, '0')}`;
  }

  // Oak Book - Vendor Payments
  async getAllVendorPayments(): Promise<VendorPayment[]> {
    return await db.select().from(vendorPayments).orderBy(desc(vendorPayments.createdAt));
  }

  async getVendorPayment(id: string): Promise<VendorPayment | undefined> {
    const [payment] = await db.select().from(vendorPayments).where(eq(vendorPayments.id, id));
    return payment || undefined;
  }

  async createVendorPaymentWithDaybook(insertPayment: InsertVendorPayment, vendorName: string): Promise<VendorPayment> {
    const daybookEntry = await db.insert(daybookEntries).values({
      date: insertPayment.date,
      description: `Payment to ${vendorName} - ${insertPayment.reference || insertPayment.number}`,
      type: 'expense',
      amount: insertPayment.amount,
      category: 'Vendor Payment',
      bankId: insertPayment.bankId || null,
    }).returning();

    if (insertPayment.bankId) {
      await db.update(banks)
        .set({ balance: sql`${banks.balance} - ${insertPayment.amount}` })
        .where(eq(banks.id, insertPayment.bankId));
    }

    if (insertPayment.expenseId) {
      await db.update(expenses)
        .set({ status: 'paid' })
        .where(eq(expenses.id, insertPayment.expenseId));
    }

    const [payment] = await db.insert(vendorPayments).values({
      ...insertPayment,
      daybookEntryId: daybookEntry[0].id,
    }).returning();
    return payment;
  }

  async deleteVendorPayment(id: string): Promise<void> {
    const payment = await this.getVendorPayment(id);
    if (payment) {
      if (payment.daybookEntryId) {
        await db.delete(daybookEntries).where(eq(daybookEntries.id, payment.daybookEntryId));
      }
      if (payment.bankId) {
        await db.update(banks)
          .set({ balance: sql`${banks.balance} + ${payment.amount}` })
          .where(eq(banks.id, payment.bankId));
      }
      if (payment.expenseId) {
        await db.update(expenses)
          .set({ status: 'recorded' })
          .where(eq(expenses.id, payment.expenseId));
      }
    }
    await db.delete(vendorPayments).where(eq(vendorPayments.id, id));
  }

  async getNextVendorPaymentNumber(): Promise<string> {
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(vendorPayments);
    const count = Number(result?.count || 0) + 1;
    return `VPY-${String(count).padStart(4, '0')}`;
  }
}

export const storage = new DatabaseStorage();

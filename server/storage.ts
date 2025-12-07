import { 
  users, 
  userPermissions,
  roles,
  events, 
  meetings, 
  employees, 
  daybookEntries,
  daybookCategories,
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
  items,
  bills,
  companySettings,
  documentSequences,
  estimateTemplates,
  portalLinks,
  payrollRuns,
  payrollItems,
  salesPipelines,
  salesStages,
  salesContacts,
  salesCompanies,
  salesDeals,
  salesActivities,
  salesTargets,
  salesAutomations,
  inventoryItems,
  inventoryTransactions,
  eventInventorySessions,
  eventInventoryItems,
  rentalRecords,
  rentalItems,
  inventoryTemplates,
  inventoryTemplateItems,
  purchaseOrders,
  purchaseOrderItems,
  productionPlans,
  productionTasks,
  type User, 
  type InsertUser,
  type UserPermission,
  type InsertUserPermission,
  type Role,
  type InsertRole,
  type Event,
  type InsertEvent,
  type Meeting,
  type InsertMeeting,
  type Employee,
  type InsertEmployee,
  type DaybookEntry,
  type InsertDaybookEntry,
  type DaybookCategory,
  type InsertDaybookCategory,
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
  type Item,
  type InsertItem,
  type Bill,
  type InsertBill,
  type CompanySettings,
  type InsertCompanySettings,
  type DocumentSequence,
  type InsertDocumentSequence,
  type EstimateTemplate,
  type InsertEstimateTemplate,
  type PortalLink,
  type InsertPortalLink,
  type PayrollRun,
  type InsertPayrollRun,
  type PayrollItem,
  type InsertPayrollItem,
  type SalesPipeline,
  type InsertSalesPipeline,
  type SalesStage,
  type InsertSalesStage,
  type SalesContact,
  type InsertSalesContact,
  type SalesCompany,
  type InsertSalesCompany,
  type SalesDeal,
  type InsertSalesDeal,
  type SalesActivity,
  type InsertSalesActivity,
  type SalesTarget,
  type InsertSalesTarget,
  type SalesAutomation,
  type InsertSalesAutomation,
  type InventoryItem,
  type InsertInventoryItem,
  type InventoryTransaction,
  type InsertInventoryTransaction,
  type EventInventorySession,
  type InsertEventInventorySession,
  type EventInventoryItem,
  type InsertEventInventoryItem,
  type RentalRecord,
  type InsertRentalRecord,
  type RentalItem,
  type InsertRentalItem,
  type InventoryTemplate,
  type InsertInventoryTemplate,
  type InventoryTemplateItem,
  type InsertInventoryTemplateItem,
  type PurchaseOrder,
  type InsertPurchaseOrder,
  type PurchaseOrderItem,
  type InsertPurchaseOrderItem,
  type ProductionPlan,
  type InsertProductionPlan,
  type ProductionTask,
  type InsertProductionTask,
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
  
  // Roles
  getAllRoles(): Promise<Role[]>;
  getRole(id: string): Promise<Role | undefined>;
  getRoleByName(name: string): Promise<Role | undefined>;
  createRole(role: InsertRole): Promise<Role>;
  updateRole(id: string, role: Partial<InsertRole>): Promise<Role | undefined>;
  deleteRole(id: string): Promise<void>;
  
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
  createDaybookEntryWithEventSync(entry: InsertDaybookEntry): Promise<DaybookEntry>;
  updateDaybookEntry(id: string, entry: Partial<InsertDaybookEntry>): Promise<DaybookEntry | undefined>;
  deleteDaybookEntry(id: string): Promise<void>;
  
  // Daybook Categories
  getDaybookCategoriesByType(type: string): Promise<DaybookCategory[]>;
  getAllDaybookCategories(): Promise<DaybookCategory[]>;
  createDaybookCategory(category: InsertDaybookCategory): Promise<DaybookCategory>;
  updateDaybookCategory(id: string, category: Partial<InsertDaybookCategory>): Promise<DaybookCategory | undefined>;
  deleteDaybookCategory(id: string): Promise<void>;
  
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

  // Oak Book - Items
  getAllItems(): Promise<Item[]>;
  getItem(id: string): Promise<Item | undefined>;
  createItem(item: InsertItem): Promise<Item>;
  updateItem(id: string, item: Partial<InsertItem>): Promise<Item | undefined>;
  deleteItem(id: string): Promise<void>;

  // Oak Book - Bills
  getAllBills(): Promise<Bill[]>;
  getBill(id: string): Promise<Bill | undefined>;
  createBill(bill: InsertBill): Promise<Bill>;
  updateBill(id: string, bill: Partial<InsertBill>): Promise<Bill | undefined>;
  deleteBill(id: string): Promise<void>;
  getNextBillNumber(): Promise<string>;

  // Oak Book - Company Settings
  getCompanySettings(): Promise<CompanySettings | undefined>;
  updateCompanySettings(settings: Partial<InsertCompanySettings>): Promise<CompanySettings>;

  // Oak Book - Document Sequences
  getNextDocumentNumber(documentType: string): Promise<string>;
  getAllDocumentSequences(): Promise<DocumentSequence[]>;
  updateDocumentSequence(documentType: string, updates: Partial<InsertDocumentSequence>): Promise<DocumentSequence | undefined>;

  // Oak Book - Estimate Templates
  getAllEstimateTemplates(): Promise<EstimateTemplate[]>;
  getEstimateTemplate(id: string): Promise<EstimateTemplate | undefined>;
  createEstimateTemplate(template: InsertEstimateTemplate): Promise<EstimateTemplate>;
  updateEstimateTemplate(id: string, template: Partial<InsertEstimateTemplate>): Promise<EstimateTemplate | undefined>;
  deleteEstimateTemplate(id: string): Promise<void>;

  // Customer Portal - Portal Links
  createPortalLink(link: InsertPortalLink): Promise<PortalLink>;
  getPortalLinkByToken(token: string): Promise<PortalLink | undefined>;
  getPortalLinksForDocument(documentType: string, documentId: string): Promise<PortalLink[]>;
  updatePortalLinkViewCount(id: string): Promise<void>;
  deactivatePortalLink(id: string): Promise<void>;
  getAllPortalLinks(): Promise<PortalLink[]>;

  // Oak Book - Clone/Convert Operations
  cloneEstimate(id: string): Promise<Estimate>;
  convertEstimateToInvoice(estimateId: string): Promise<Invoice>;

  // Payroll
  getAllPayrollRuns(): Promise<PayrollRun[]>;
  getPayrollRun(id: string): Promise<PayrollRun | undefined>;
  getPayrollRunByMonthYear(month: number, year: number): Promise<PayrollRun | undefined>;
  createPayrollRun(run: InsertPayrollRun): Promise<PayrollRun>;
  updatePayrollRun(id: string, run: Partial<InsertPayrollRun>): Promise<PayrollRun | undefined>;
  deletePayrollRun(id: string): Promise<void>;
  getPayrollItemsByRunId(runId: string): Promise<PayrollItem[]>;
  createPayrollItem(item: InsertPayrollItem): Promise<PayrollItem>;
  updatePayrollItem(id: string, item: Partial<InsertPayrollItem>): Promise<PayrollItem | undefined>;
  deletePayrollItem(id: string): Promise<void>;
  markPayrollAsPaid(runId: string, payDate: string, bankId?: string): Promise<PayrollRun>;

  // Oak Sales - Pipelines
  getAllSalesPipelines(): Promise<SalesPipeline[]>;
  getSalesPipeline(id: string): Promise<SalesPipeline | undefined>;
  createSalesPipeline(pipeline: InsertSalesPipeline): Promise<SalesPipeline>;
  updateSalesPipeline(id: string, pipeline: Partial<InsertSalesPipeline>): Promise<SalesPipeline | undefined>;
  deleteSalesPipeline(id: string): Promise<void>;

  // Oak Sales - Stages
  getAllSalesStages(): Promise<SalesStage[]>;
  getSalesStagesByPipelineId(pipelineId: string): Promise<SalesStage[]>;
  getSalesStage(id: string): Promise<SalesStage | undefined>;
  createSalesStage(stage: InsertSalesStage): Promise<SalesStage>;
  updateSalesStage(id: string, stage: Partial<InsertSalesStage>): Promise<SalesStage | undefined>;
  deleteSalesStage(id: string): Promise<void>;

  // Oak Sales - Contacts
  getAllSalesContacts(): Promise<SalesContact[]>;
  getSalesContact(id: string): Promise<SalesContact | undefined>;
  createSalesContact(contact: InsertSalesContact): Promise<SalesContact>;
  updateSalesContact(id: string, contact: Partial<InsertSalesContact>): Promise<SalesContact | undefined>;
  deleteSalesContact(id: string): Promise<void>;

  // Oak Sales - Companies
  getAllSalesCompanies(): Promise<SalesCompany[]>;
  getSalesCompany(id: string): Promise<SalesCompany | undefined>;
  createSalesCompany(company: InsertSalesCompany): Promise<SalesCompany>;
  updateSalesCompany(id: string, company: Partial<InsertSalesCompany>): Promise<SalesCompany | undefined>;
  deleteSalesCompany(id: string): Promise<void>;

  // Oak Sales - Deals
  getAllSalesDeals(): Promise<SalesDeal[]>;
  getSalesDealsByPipelineId(pipelineId: string): Promise<SalesDeal[]>;
  getSalesDealsByOwnerId(ownerId: string): Promise<SalesDeal[]>;
  getSalesDeal(id: string): Promise<SalesDeal | undefined>;
  createSalesDeal(deal: InsertSalesDeal): Promise<SalesDeal>;
  updateSalesDeal(id: string, deal: Partial<InsertSalesDeal>): Promise<SalesDeal | undefined>;
  deleteSalesDeal(id: string): Promise<void>;

  // Oak Sales - Activities
  getAllSalesActivities(): Promise<SalesActivity[]>;
  getSalesActivitiesByDealId(dealId: string): Promise<SalesActivity[]>;
  getSalesActivitiesByOwnerId(ownerId: string): Promise<SalesActivity[]>;
  getSalesActivity(id: string): Promise<SalesActivity | undefined>;
  createSalesActivity(activity: InsertSalesActivity): Promise<SalesActivity>;
  updateSalesActivity(id: string, activity: Partial<InsertSalesActivity>): Promise<SalesActivity | undefined>;
  deleteSalesActivity(id: string): Promise<void>;

  // Oak Sales - Targets
  getAllSalesTargets(): Promise<SalesTarget[]>;
  getSalesTargetsByUserId(userId: string): Promise<SalesTarget[]>;
  getSalesTarget(id: string): Promise<SalesTarget | undefined>;
  createSalesTarget(target: InsertSalesTarget): Promise<SalesTarget>;
  updateSalesTarget(id: string, target: Partial<InsertSalesTarget>): Promise<SalesTarget | undefined>;
  deleteSalesTarget(id: string): Promise<void>;

  // Oak Sales - Automations
  getAllSalesAutomations(): Promise<SalesAutomation[]>;
  getSalesAutomation(id: string): Promise<SalesAutomation | undefined>;
  createSalesAutomation(automation: InsertSalesAutomation): Promise<SalesAutomation>;
  updateSalesAutomation(id: string, automation: Partial<InsertSalesAutomation>): Promise<SalesAutomation | undefined>;
  deleteSalesAutomation(id: string): Promise<void>;

  // Oak Inventory - Inventory Items
  getAllInventoryItems(): Promise<InventoryItem[]>;
  getInventoryItem(id: string): Promise<InventoryItem | undefined>;
  createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem>;
  updateInventoryItem(id: string, item: Partial<InsertInventoryItem>): Promise<InventoryItem | undefined>;
  deleteInventoryItem(id: string): Promise<void>;

  // Oak Inventory - Inventory Transactions
  getInventoryTransactionsByItemId(itemId: string): Promise<InventoryTransaction[]>;
  createInventoryTransaction(tx: InsertInventoryTransaction): Promise<InventoryTransaction>;

  // Oak Inventory - Event Inventory Sessions
  getAllEventInventorySessions(): Promise<EventInventorySession[]>;
  getEventInventorySessionsByEventId(eventId: string): Promise<EventInventorySession[]>;
  getEventInventorySession(id: string): Promise<EventInventorySession | undefined>;
  createEventInventorySession(session: InsertEventInventorySession): Promise<EventInventorySession>;
  updateEventInventorySession(id: string, session: Partial<InsertEventInventorySession>): Promise<EventInventorySession | undefined>;
  deleteEventInventorySession(id: string): Promise<void>;

  // Oak Inventory - Event Inventory Items
  getAllEventInventoryItems(): Promise<EventInventoryItem[]>;
  getEventInventoryItemsBySessionId(sessionId: string): Promise<EventInventoryItem[]>;
  createEventInventoryItem(item: InsertEventInventoryItem): Promise<EventInventoryItem>;
  updateEventInventoryItem(id: string, item: Partial<InsertEventInventoryItem>): Promise<EventInventoryItem | undefined>;
  deleteEventInventoryItem(id: string): Promise<void>;

  // Oak Inventory - Rental Records
  getAllRentalRecords(): Promise<RentalRecord[]>;
  getRentalRecord(id: string): Promise<RentalRecord | undefined>;
  getRentalRecordsByEventId(eventId: string): Promise<RentalRecord[]>;
  createRentalRecord(record: InsertRentalRecord): Promise<RentalRecord>;
  updateRentalRecord(id: string, record: Partial<InsertRentalRecord>): Promise<RentalRecord | undefined>;
  deleteRentalRecord(id: string): Promise<void>;

  // Oak Inventory - Rental Items
  getAllRentalItems(): Promise<RentalItem[]>;
  getRentalItemsByRentalId(rentalId: string): Promise<RentalItem[]>;
  createRentalItem(item: InsertRentalItem): Promise<RentalItem>;
  updateRentalItem(id: string, item: Partial<InsertRentalItem>): Promise<RentalItem | undefined>;
  deleteRentalItem(id: string): Promise<void>;

  // Oak Inventory - Inventory Templates
  getAllInventoryTemplates(): Promise<InventoryTemplate[]>;
  getInventoryTemplate(id: string): Promise<InventoryTemplate | undefined>;
  createInventoryTemplate(template: InsertInventoryTemplate): Promise<InventoryTemplate>;
  updateInventoryTemplate(id: string, template: Partial<InsertInventoryTemplate>): Promise<InventoryTemplate | undefined>;
  deleteInventoryTemplate(id: string): Promise<void>;

  // Oak Inventory - Inventory Template Items
  getInventoryTemplateItemsByTemplateId(templateId: string): Promise<InventoryTemplateItem[]>;
  createInventoryTemplateItem(item: InsertInventoryTemplateItem): Promise<InventoryTemplateItem>;
  deleteInventoryTemplateItem(id: string): Promise<void>;

  // Oak Inventory - Purchase Orders
  getAllPurchaseOrders(): Promise<PurchaseOrder[]>;
  getPurchaseOrder(id: string): Promise<PurchaseOrder | undefined>;
  createPurchaseOrder(po: InsertPurchaseOrder): Promise<PurchaseOrder>;
  updatePurchaseOrder(id: string, po: Partial<InsertPurchaseOrder>): Promise<PurchaseOrder | undefined>;
  deletePurchaseOrder(id: string): Promise<void>;
  getNextPurchaseOrderNumber(): Promise<string>;

  // Oak Inventory - Purchase Order Items
  getPurchaseOrderItemsByPOId(poId: string): Promise<PurchaseOrderItem[]>;
  createPurchaseOrderItem(item: InsertPurchaseOrderItem): Promise<PurchaseOrderItem>;
  deletePurchaseOrderItem(id: string): Promise<void>;

  // Oak Inventory - Production Plans
  getAllProductionPlans(): Promise<ProductionPlan[]>;
  getProductionPlan(id: string): Promise<ProductionPlan | undefined>;
  getProductionPlansByEventId(eventId: string): Promise<ProductionPlan[]>;
  createProductionPlan(plan: InsertProductionPlan): Promise<ProductionPlan>;
  updateProductionPlan(id: string, plan: Partial<InsertProductionPlan>): Promise<ProductionPlan | undefined>;
  deleteProductionPlan(id: string): Promise<void>;

  // Oak Inventory - Production Tasks
  getAllProductionTasks(): Promise<ProductionTask[]>;
  getProductionTasksByPlanId(planId: string): Promise<ProductionTask[]>;
  createProductionTask(task: InsertProductionTask): Promise<ProductionTask>;
  updateProductionTask(id: string, task: Partial<InsertProductionTask>): Promise<ProductionTask | undefined>;
  deleteProductionTask(id: string): Promise<void>;
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

  // Roles
  async getAllRoles(): Promise<Role[]> {
    return await db.select().from(roles).orderBy(roles.name);
  }

  async getRole(id: string): Promise<Role | undefined> {
    const [role] = await db.select().from(roles).where(eq(roles.id, id));
    return role || undefined;
  }

  async getRoleByName(name: string): Promise<Role | undefined> {
    const [role] = await db.select().from(roles).where(eq(roles.name, name));
    return role || undefined;
  }

  async createRole(insertRole: InsertRole): Promise<Role> {
    const [role] = await db.insert(roles).values(insertRole).returning();
    return role;
  }

  async updateRole(id: string, updateData: Partial<InsertRole>): Promise<Role | undefined> {
    const [role] = await db.update(roles).set(updateData).where(eq(roles.id, id)).returning();
    return role || undefined;
  }

  async deleteRole(id: string): Promise<void> {
    await db.delete(roles).where(eq(roles.id, id));
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

  async createDaybookEntryWithEventSync(insertEntry: InsertDaybookEntry): Promise<DaybookEntry> {
    const [entry] = await db.insert(daybookEntries).values(insertEntry).returning();
    
    // If linked to an event, update the event's paymentReceived or cost
    if (entry.eventId) {
      const [event] = await db.select().from(events).where(eq(events.id, entry.eventId));
      if (event) {
        const amount = parseFloat(entry.amount);
        if (entry.type === 'income') {
          // Add to paymentReceived
          const newPaymentReceived = parseFloat(event.paymentReceived) + amount;
          await db.update(events).set({ 
            paymentReceived: newPaymentReceived.toFixed(2) 
          }).where(eq(events.id, entry.eventId));
        } else {
          // Add to cost
          const newCost = parseFloat(event.cost) + amount;
          await db.update(events).set({ 
            cost: newCost.toFixed(2) 
          }).where(eq(events.id, entry.eventId));
        }
      }
    }
    
    return entry;
  }

  // Daybook Categories
  async getDaybookCategoriesByType(type: string): Promise<DaybookCategory[]> {
    return await db.select().from(daybookCategories).where(eq(daybookCategories.type, type));
  }

  async getAllDaybookCategories(): Promise<DaybookCategory[]> {
    return await db.select().from(daybookCategories);
  }

  async createDaybookCategory(insertCategory: InsertDaybookCategory): Promise<DaybookCategory> {
    const [category] = await db.insert(daybookCategories).values(insertCategory).returning();
    return category;
  }

  async updateDaybookCategory(id: string, updateData: Partial<InsertDaybookCategory>): Promise<DaybookCategory | undefined> {
    const [category] = await db.update(daybookCategories).set(updateData).where(eq(daybookCategories.id, id)).returning();
    return category || undefined;
  }

  async deleteDaybookCategory(id: string): Promise<void> {
    // Only delete non-system categories
    await db.delete(daybookCategories).where(and(
      eq(daybookCategories.id, id),
      eq(daybookCategories.isSystem, false)
    ));
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

  // Oak Book - Items
  async getAllItems(): Promise<Item[]> {
    return db.select().from(items).orderBy(desc(items.createdAt));
  }

  async getItem(id: string): Promise<Item | undefined> {
    const [item] = await db.select().from(items).where(eq(items.id, id));
    return item;
  }

  async createItem(item: InsertItem): Promise<Item> {
    const [created] = await db.insert(items).values(item).returning();
    return created;
  }

  async updateItem(id: string, itemData: Partial<InsertItem>): Promise<Item | undefined> {
    const [updated] = await db.update(items).set(itemData).where(eq(items.id, id)).returning();
    return updated;
  }

  async deleteItem(id: string): Promise<void> {
    await db.delete(items).where(eq(items.id, id));
  }

  // Oak Book - Bills
  async getAllBills(): Promise<Bill[]> {
    return db.select().from(bills).orderBy(desc(bills.createdAt));
  }

  async getBill(id: string): Promise<Bill | undefined> {
    const [bill] = await db.select().from(bills).where(eq(bills.id, id));
    return bill;
  }

  async createBill(bill: InsertBill): Promise<Bill> {
    const number = await this.getNextBillNumber();
    const [created] = await db.insert(bills).values({ ...bill, number }).returning();
    return created;
  }

  async updateBill(id: string, billData: Partial<InsertBill>): Promise<Bill | undefined> {
    const [updated] = await db.update(bills).set(billData).where(eq(bills.id, id)).returning();
    return updated;
  }

  async deleteBill(id: string): Promise<void> {
    await db.delete(bills).where(eq(bills.id, id));
  }

  async getNextBillNumber(): Promise<string> {
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(bills);
    const count = Number(result?.count || 0) + 1;
    return `BILL-${String(count).padStart(4, '0')}`;
  }

  // Oak Book - Company Settings
  async getCompanySettings(): Promise<CompanySettings | undefined> {
    const [settings] = await db.select().from(companySettings).limit(1);
    if (!settings) {
      const [newSettings] = await db.insert(companySettings).values({}).returning();
      return newSettings;
    }
    return settings;
  }

  async updateCompanySettings(updateData: Partial<InsertCompanySettings>): Promise<CompanySettings> {
    const existing = await this.getCompanySettings();
    if (existing) {
      const [updated] = await db.update(companySettings)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(companySettings.id, existing.id))
        .returning();
      return updated;
    }
    const [newSettings] = await db.insert(companySettings).values(updateData).returning();
    return newSettings;
  }

  // Oak Book - Document Sequences
  async getNextDocumentNumber(documentType: string): Promise<string> {
    const [sequence] = await db.select().from(documentSequences)
      .where(eq(documentSequences.documentType, documentType));
    
    if (!sequence) {
      throw new Error(`Document sequence not found for type: ${documentType}`);
    }

    const number = `${sequence.prefix}${String(sequence.nextNumber).padStart(sequence.paddingLength, '0')}`;
    
    await db.update(documentSequences)
      .set({ nextNumber: sequence.nextNumber + 1 })
      .where(eq(documentSequences.documentType, documentType));
    
    return number;
  }

  async getAllDocumentSequences(): Promise<DocumentSequence[]> {
    return await db.select().from(documentSequences);
  }

  async updateDocumentSequence(documentType: string, updateData: Partial<InsertDocumentSequence>): Promise<DocumentSequence | undefined> {
    const [updated] = await db.update(documentSequences)
      .set(updateData)
      .where(eq(documentSequences.documentType, documentType))
      .returning();
    return updated || undefined;
  }

  // Oak Book - Estimate Templates
  async getAllEstimateTemplates(): Promise<EstimateTemplate[]> {
    return await db.select().from(estimateTemplates).orderBy(desc(estimateTemplates.createdAt));
  }

  async getEstimateTemplate(id: string): Promise<EstimateTemplate | undefined> {
    const [template] = await db.select().from(estimateTemplates).where(eq(estimateTemplates.id, id));
    return template || undefined;
  }

  async createEstimateTemplate(insertTemplate: InsertEstimateTemplate): Promise<EstimateTemplate> {
    const [template] = await db.insert(estimateTemplates).values(insertTemplate).returning();
    return template;
  }

  async updateEstimateTemplate(id: string, updateData: Partial<InsertEstimateTemplate>): Promise<EstimateTemplate | undefined> {
    const [template] = await db.update(estimateTemplates)
      .set(updateData)
      .where(eq(estimateTemplates.id, id))
      .returning();
    return template || undefined;
  }

  async deleteEstimateTemplate(id: string): Promise<void> {
    await db.delete(estimateTemplates).where(eq(estimateTemplates.id, id));
  }

  // Oak Book - Clone/Convert Operations
  async cloneEstimate(id: string): Promise<Estimate> {
    const original = await this.getEstimate(id);
    if (!original) {
      throw new Error('Estimate not found');
    }

    const newNumber = await this.getNextDocumentNumber('estimate');
    const today = new Date().toISOString().split('T')[0];

    const [cloned] = await db.insert(estimates).values({
      number: newNumber,
      customerId: original.customerId,
      eventId: original.eventId,
      date: today,
      dueDate: original.dueDate,
      status: 'draft',
      subject: original.subject,
      weddingPlannerName: original.weddingPlannerName,
      customerAddress: original.customerAddress,
      lineItems: original.lineItems,
      subtotal: original.subtotal,
      discountPercent: original.discountPercent,
      discountAmount: original.discountAmount,
      serviceChargePercent: original.serviceChargePercent,
      serviceChargeAmount: original.serviceChargeAmount,
      taxTotal: original.taxTotal,
      total: original.total,
      totalInWords: original.totalInWords,
      notes: original.notes,
      terms: original.terms,
      thankYouMessage: original.thankYouMessage,
      signature: original.signature,
    }).returning();

    return cloned;
  }

  async convertEstimateToInvoice(estimateId: string): Promise<Invoice> {
    const estimate = await this.getEstimate(estimateId);
    if (!estimate) {
      throw new Error('Estimate not found');
    }

    const invoiceNumber = await this.getNextDocumentNumber('invoice');
    const today = new Date().toISOString().split('T')[0];

    const [invoice] = await db.insert(invoices).values({
      number: invoiceNumber,
      customerId: estimate.customerId,
      eventId: estimate.eventId,
      estimateId: estimate.id,
      date: today,
      dueDate: estimate.dueDate,
      status: 'draft',
      subject: estimate.subject,
      weddingPlannerName: estimate.weddingPlannerName,
      customerAddress: estimate.customerAddress,
      lineItems: estimate.lineItems,
      subtotal: estimate.subtotal,
      discountPercent: estimate.discountPercent,
      discountAmount: estimate.discountAmount,
      serviceChargePercent: estimate.serviceChargePercent,
      serviceChargeAmount: estimate.serviceChargeAmount,
      taxTotal: estimate.taxTotal,
      total: estimate.total,
      totalInWords: estimate.totalInWords,
      balanceDue: estimate.total,
      notes: estimate.notes,
      terms: estimate.terms,
      thankYouMessage: estimate.thankYouMessage,
      signature: estimate.signature,
    }).returning();

    await db.update(estimates)
      .set({ status: 'converted' })
      .where(eq(estimates.id, estimateId));

    return invoice;
  }

  // Customer Portal - Portal Links
  async createPortalLink(insertLink: InsertPortalLink): Promise<PortalLink> {
    const [link] = await db.insert(portalLinks).values(insertLink).returning();
    return link;
  }

  async getPortalLinkByToken(token: string): Promise<PortalLink | undefined> {
    const [link] = await db.select().from(portalLinks).where(
      and(
        eq(portalLinks.token, token),
        eq(portalLinks.isActive, true)
      )
    );
    return link || undefined;
  }

  async getPortalLinksForDocument(documentType: string, documentId: string): Promise<PortalLink[]> {
    return await db.select().from(portalLinks).where(
      and(
        eq(portalLinks.documentType, documentType),
        eq(portalLinks.documentId, documentId)
      )
    );
  }

  async updatePortalLinkViewCount(id: string): Promise<void> {
    await db.update(portalLinks)
      .set({ 
        viewCount: sql`${portalLinks.viewCount} + 1`,
        lastViewedAt: new Date()
      })
      .where(eq(portalLinks.id, id));
  }

  async deactivatePortalLink(id: string): Promise<void> {
    await db.update(portalLinks)
      .set({ isActive: false })
      .where(eq(portalLinks.id, id));
  }

  async getAllPortalLinks(): Promise<PortalLink[]> {
    return await db.select().from(portalLinks).orderBy(desc(portalLinks.createdAt));
  }

  // Payroll
  async getAllPayrollRuns(): Promise<PayrollRun[]> {
    return await db.select().from(payrollRuns).orderBy(desc(payrollRuns.createdAt));
  }

  async getPayrollRun(id: string): Promise<PayrollRun | undefined> {
    const [run] = await db.select().from(payrollRuns).where(eq(payrollRuns.id, id));
    return run || undefined;
  }

  async getPayrollRunByMonthYear(month: number, year: number): Promise<PayrollRun | undefined> {
    const [run] = await db.select().from(payrollRuns).where(
      and(
        eq(payrollRuns.month, month),
        eq(payrollRuns.year, year)
      )
    );
    return run || undefined;
  }

  async createPayrollRun(run: InsertPayrollRun): Promise<PayrollRun> {
    const [created] = await db.insert(payrollRuns).values(run).returning();
    return created;
  }

  async updatePayrollRun(id: string, run: Partial<InsertPayrollRun>): Promise<PayrollRun | undefined> {
    const [updated] = await db.update(payrollRuns).set(run).where(eq(payrollRuns.id, id)).returning();
    return updated || undefined;
  }

  async deletePayrollRun(id: string): Promise<void> {
    await db.delete(payrollRuns).where(eq(payrollRuns.id, id));
  }

  async getPayrollItemsByRunId(runId: string): Promise<PayrollItem[]> {
    return await db.select().from(payrollItems).where(eq(payrollItems.payrollRunId, runId));
  }

  async createPayrollItem(item: InsertPayrollItem): Promise<PayrollItem> {
    const [created] = await db.insert(payrollItems).values(item).returning();
    return created;
  }

  async updatePayrollItem(id: string, item: Partial<InsertPayrollItem>): Promise<PayrollItem | undefined> {
    const [updated] = await db.update(payrollItems).set(item).where(eq(payrollItems.id, id)).returning();
    return updated || undefined;
  }

  async deletePayrollItem(id: string): Promise<void> {
    await db.delete(payrollItems).where(eq(payrollItems.id, id));
  }

  async markPayrollAsPaid(runId: string, payDate: string, bankId?: string): Promise<PayrollRun> {
    const run = await this.getPayrollRun(runId);
    if (!run) {
      throw new Error('Payroll run not found');
    }
    if (run.status === 'paid') {
      throw new Error('Payroll already marked as paid');
    }

    const items = await this.getPayrollItemsByRunId(runId);
    const totalAmount = items.reduce((sum, item) => sum + parseFloat(item.netPay), 0);

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = monthNames[run.month - 1];

    const [daybookEntry] = await db.insert(daybookEntries).values({
      date: payDate,
      description: `Payroll for ${monthName} ${run.year}`,
      type: 'expense',
      amount: totalAmount.toFixed(2),
      category: 'Salary',
      bankId: bankId || null,
    }).returning();

    if (bankId) {
      await db.update(banks)
        .set({ balance: sql`${banks.balance} - ${totalAmount}` })
        .where(eq(banks.id, bankId));
    }

    const [updated] = await db.update(payrollRuns)
      .set({
        status: 'paid',
        payDate: payDate,
        bankId: bankId || null,
        totalAmount: totalAmount.toFixed(2),
        daybookEntryId: daybookEntry.id,
      })
      .where(eq(payrollRuns.id, runId))
      .returning();

    return updated;
  }

  // Oak Sales - Pipelines
  async getAllSalesPipelines(): Promise<SalesPipeline[]> {
    return await db.select().from(salesPipelines);
  }

  async getSalesPipeline(id: string): Promise<SalesPipeline | undefined> {
    const [pipeline] = await db.select().from(salesPipelines).where(eq(salesPipelines.id, id));
    return pipeline || undefined;
  }

  async createSalesPipeline(pipeline: InsertSalesPipeline): Promise<SalesPipeline> {
    const [created] = await db.insert(salesPipelines).values(pipeline).returning();
    return created;
  }

  async updateSalesPipeline(id: string, pipeline: Partial<InsertSalesPipeline>): Promise<SalesPipeline | undefined> {
    const [updated] = await db.update(salesPipelines).set(pipeline).where(eq(salesPipelines.id, id)).returning();
    return updated || undefined;
  }

  async deleteSalesPipeline(id: string): Promise<void> {
    await db.delete(salesPipelines).where(eq(salesPipelines.id, id));
  }

  // Oak Sales - Stages
  async getAllSalesStages(): Promise<SalesStage[]> {
    return await db.select().from(salesStages);
  }

  async getSalesStagesByPipelineId(pipelineId: string): Promise<SalesStage[]> {
    return await db.select().from(salesStages).where(eq(salesStages.pipelineId, pipelineId));
  }

  async getSalesStage(id: string): Promise<SalesStage | undefined> {
    const [stage] = await db.select().from(salesStages).where(eq(salesStages.id, id));
    return stage || undefined;
  }

  async createSalesStage(stage: InsertSalesStage): Promise<SalesStage> {
    const [created] = await db.insert(salesStages).values(stage).returning();
    return created;
  }

  async updateSalesStage(id: string, stage: Partial<InsertSalesStage>): Promise<SalesStage | undefined> {
    const [updated] = await db.update(salesStages).set(stage).where(eq(salesStages.id, id)).returning();
    return updated || undefined;
  }

  async deleteSalesStage(id: string): Promise<void> {
    await db.delete(salesStages).where(eq(salesStages.id, id));
  }

  // Oak Sales - Contacts
  async getAllSalesContacts(): Promise<SalesContact[]> {
    return await db.select().from(salesContacts);
  }

  async getSalesContact(id: string): Promise<SalesContact | undefined> {
    const [contact] = await db.select().from(salesContacts).where(eq(salesContacts.id, id));
    return contact || undefined;
  }

  async createSalesContact(contact: InsertSalesContact): Promise<SalesContact> {
    const [created] = await db.insert(salesContacts).values(contact).returning();
    return created;
  }

  async updateSalesContact(id: string, contact: Partial<InsertSalesContact>): Promise<SalesContact | undefined> {
    const [updated] = await db.update(salesContacts).set(contact).where(eq(salesContacts.id, id)).returning();
    return updated || undefined;
  }

  async deleteSalesContact(id: string): Promise<void> {
    await db.delete(salesContacts).where(eq(salesContacts.id, id));
  }

  // Oak Sales - Companies
  async getAllSalesCompanies(): Promise<SalesCompany[]> {
    return await db.select().from(salesCompanies);
  }

  async getSalesCompany(id: string): Promise<SalesCompany | undefined> {
    const [company] = await db.select().from(salesCompanies).where(eq(salesCompanies.id, id));
    return company || undefined;
  }

  async createSalesCompany(company: InsertSalesCompany): Promise<SalesCompany> {
    const [created] = await db.insert(salesCompanies).values(company).returning();
    return created;
  }

  async updateSalesCompany(id: string, company: Partial<InsertSalesCompany>): Promise<SalesCompany | undefined> {
    const [updated] = await db.update(salesCompanies).set(company).where(eq(salesCompanies.id, id)).returning();
    return updated || undefined;
  }

  async deleteSalesCompany(id: string): Promise<void> {
    await db.delete(salesCompanies).where(eq(salesCompanies.id, id));
  }

  // Oak Sales - Deals
  async getAllSalesDeals(): Promise<SalesDeal[]> {
    return await db.select().from(salesDeals);
  }

  async getSalesDealsByPipelineId(pipelineId: string): Promise<SalesDeal[]> {
    return await db.select().from(salesDeals).where(eq(salesDeals.pipelineId, pipelineId));
  }

  async getSalesDealsByOwnerId(ownerId: string): Promise<SalesDeal[]> {
    return await db.select().from(salesDeals).where(eq(salesDeals.ownerId, ownerId));
  }

  async getSalesDeal(id: string): Promise<SalesDeal | undefined> {
    const [deal] = await db.select().from(salesDeals).where(eq(salesDeals.id, id));
    return deal || undefined;
  }

  async createSalesDeal(deal: InsertSalesDeal): Promise<SalesDeal> {
    const [created] = await db.insert(salesDeals).values(deal).returning();
    return created;
  }

  async updateSalesDeal(id: string, deal: Partial<InsertSalesDeal>): Promise<SalesDeal | undefined> {
    const [updated] = await db.update(salesDeals).set(deal).where(eq(salesDeals.id, id)).returning();
    return updated || undefined;
  }

  async deleteSalesDeal(id: string): Promise<void> {
    await db.delete(salesDeals).where(eq(salesDeals.id, id));
  }

  // Oak Sales - Activities
  async getAllSalesActivities(): Promise<SalesActivity[]> {
    return await db.select().from(salesActivities);
  }

  async getSalesActivitiesByDealId(dealId: string): Promise<SalesActivity[]> {
    return await db.select().from(salesActivities).where(eq(salesActivities.dealId, dealId));
  }

  async getSalesActivitiesByOwnerId(ownerId: string): Promise<SalesActivity[]> {
    return await db.select().from(salesActivities).where(eq(salesActivities.ownerId, ownerId));
  }

  async getSalesActivity(id: string): Promise<SalesActivity | undefined> {
    const [activity] = await db.select().from(salesActivities).where(eq(salesActivities.id, id));
    return activity || undefined;
  }

  async createSalesActivity(activity: InsertSalesActivity): Promise<SalesActivity> {
    const [created] = await db.insert(salesActivities).values(activity).returning();
    return created;
  }

  async updateSalesActivity(id: string, activity: Partial<InsertSalesActivity>): Promise<SalesActivity | undefined> {
    const [updated] = await db.update(salesActivities).set(activity).where(eq(salesActivities.id, id)).returning();
    return updated || undefined;
  }

  async deleteSalesActivity(id: string): Promise<void> {
    await db.delete(salesActivities).where(eq(salesActivities.id, id));
  }

  // Oak Sales - Targets
  async getAllSalesTargets(): Promise<SalesTarget[]> {
    return await db.select().from(salesTargets);
  }

  async getSalesTargetsByUserId(userId: string): Promise<SalesTarget[]> {
    return await db.select().from(salesTargets).where(eq(salesTargets.userId, userId));
  }

  async getSalesTarget(id: string): Promise<SalesTarget | undefined> {
    const [target] = await db.select().from(salesTargets).where(eq(salesTargets.id, id));
    return target || undefined;
  }

  async createSalesTarget(target: InsertSalesTarget): Promise<SalesTarget> {
    const [created] = await db.insert(salesTargets).values(target).returning();
    return created;
  }

  async updateSalesTarget(id: string, target: Partial<InsertSalesTarget>): Promise<SalesTarget | undefined> {
    const [updated] = await db.update(salesTargets).set(target).where(eq(salesTargets.id, id)).returning();
    return updated || undefined;
  }

  async deleteSalesTarget(id: string): Promise<void> {
    await db.delete(salesTargets).where(eq(salesTargets.id, id));
  }

  // Oak Sales - Automations
  async getAllSalesAutomations(): Promise<SalesAutomation[]> {
    return await db.select().from(salesAutomations);
  }

  async getSalesAutomation(id: string): Promise<SalesAutomation | undefined> {
    const [automation] = await db.select().from(salesAutomations).where(eq(salesAutomations.id, id));
    return automation || undefined;
  }

  async createSalesAutomation(automation: InsertSalesAutomation): Promise<SalesAutomation> {
    const [created] = await db.insert(salesAutomations).values(automation).returning();
    return created;
  }

  async updateSalesAutomation(id: string, automation: Partial<InsertSalesAutomation>): Promise<SalesAutomation | undefined> {
    const [updated] = await db.update(salesAutomations).set(automation).where(eq(salesAutomations.id, id)).returning();
    return updated || undefined;
  }

  async deleteSalesAutomation(id: string): Promise<void> {
    await db.delete(salesAutomations).where(eq(salesAutomations.id, id));
  }

  // Oak Inventory - Inventory Items
  async getAllInventoryItems(): Promise<InventoryItem[]> {
    return await db.select().from(inventoryItems).orderBy(desc(inventoryItems.createdAt));
  }

  async getInventoryItem(id: string): Promise<InventoryItem | undefined> {
    const [item] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, id));
    return item || undefined;
  }

  async createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem> {
    const [created] = await db.insert(inventoryItems).values(item).returning();
    return created;
  }

  async updateInventoryItem(id: string, item: Partial<InsertInventoryItem>): Promise<InventoryItem | undefined> {
    const [updated] = await db.update(inventoryItems)
      .set({ ...item, updatedAt: new Date() })
      .where(eq(inventoryItems.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteInventoryItem(id: string): Promise<void> {
    await db.delete(inventoryItems).where(eq(inventoryItems.id, id));
  }

  // Oak Inventory - Inventory Transactions
  async getInventoryTransactionsByItemId(itemId: string): Promise<InventoryTransaction[]> {
    return await db.select().from(inventoryTransactions)
      .where(eq(inventoryTransactions.itemId, itemId))
      .orderBy(desc(inventoryTransactions.createdAt));
  }

  async createInventoryTransaction(tx: InsertInventoryTransaction): Promise<InventoryTransaction> {
    const [created] = await db.insert(inventoryTransactions).values(tx).returning();
    return created;
  }

  // Oak Inventory - Event Inventory Sessions
  async getAllEventInventorySessions(): Promise<EventInventorySession[]> {
    return await db.select().from(eventInventorySessions).orderBy(desc(eventInventorySessions.createdAt));
  }

  async getEventInventorySessionsByEventId(eventId: string): Promise<EventInventorySession[]> {
    return await db.select().from(eventInventorySessions)
      .where(eq(eventInventorySessions.eventId, eventId))
      .orderBy(desc(eventInventorySessions.createdAt));
  }

  async getEventInventorySession(id: string): Promise<EventInventorySession | undefined> {
    const [session] = await db.select().from(eventInventorySessions).where(eq(eventInventorySessions.id, id));
    return session || undefined;
  }

  async createEventInventorySession(session: InsertEventInventorySession): Promise<EventInventorySession> {
    const [created] = await db.insert(eventInventorySessions).values(session).returning();
    return created;
  }

  async updateEventInventorySession(id: string, session: Partial<InsertEventInventorySession>): Promise<EventInventorySession | undefined> {
    const [updated] = await db.update(eventInventorySessions)
      .set(session)
      .where(eq(eventInventorySessions.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteEventInventorySession(id: string): Promise<void> {
    await db.delete(eventInventorySessions).where(eq(eventInventorySessions.id, id));
  }

  // Oak Inventory - Event Inventory Items
  async getAllEventInventoryItems(): Promise<EventInventoryItem[]> {
    return await db.select().from(eventInventoryItems);
  }

  async getEventInventoryItemsBySessionId(sessionId: string): Promise<EventInventoryItem[]> {
    return await db.select().from(eventInventoryItems)
      .where(eq(eventInventoryItems.sessionId, sessionId));
  }

  async createEventInventoryItem(item: InsertEventInventoryItem): Promise<EventInventoryItem> {
    const [created] = await db.insert(eventInventoryItems).values(item).returning();
    return created;
  }

  async updateEventInventoryItem(id: string, item: Partial<InsertEventInventoryItem>): Promise<EventInventoryItem | undefined> {
    const [updated] = await db.update(eventInventoryItems)
      .set(item)
      .where(eq(eventInventoryItems.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteEventInventoryItem(id: string): Promise<void> {
    await db.delete(eventInventoryItems).where(eq(eventInventoryItems.id, id));
  }

  // Oak Inventory - Rental Records
  async getAllRentalRecords(): Promise<RentalRecord[]> {
    return await db.select().from(rentalRecords).orderBy(desc(rentalRecords.createdAt));
  }

  async getRentalRecord(id: string): Promise<RentalRecord | undefined> {
    const [record] = await db.select().from(rentalRecords).where(eq(rentalRecords.id, id));
    return record || undefined;
  }

  async getRentalRecordsByEventId(eventId: string): Promise<RentalRecord[]> {
    return await db.select().from(rentalRecords)
      .where(eq(rentalRecords.eventId, eventId))
      .orderBy(desc(rentalRecords.createdAt));
  }

  async createRentalRecord(record: InsertRentalRecord): Promise<RentalRecord> {
    const [created] = await db.insert(rentalRecords).values(record).returning();
    return created;
  }

  async updateRentalRecord(id: string, record: Partial<InsertRentalRecord>): Promise<RentalRecord | undefined> {
    const [updated] = await db.update(rentalRecords)
      .set(record)
      .where(eq(rentalRecords.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteRentalRecord(id: string): Promise<void> {
    await db.delete(rentalRecords).where(eq(rentalRecords.id, id));
  }

  // Oak Inventory - Rental Items
  async getAllRentalItems(): Promise<RentalItem[]> {
    return await db.select().from(rentalItems);
  }

  async getRentalItemsByRentalId(rentalId: string): Promise<RentalItem[]> {
    return await db.select().from(rentalItems)
      .where(eq(rentalItems.rentalId, rentalId));
  }

  async createRentalItem(item: InsertRentalItem): Promise<RentalItem> {
    const [created] = await db.insert(rentalItems).values(item).returning();
    return created;
  }

  async updateRentalItem(id: string, item: Partial<InsertRentalItem>): Promise<RentalItem | undefined> {
    const [updated] = await db.update(rentalItems)
      .set(item)
      .where(eq(rentalItems.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteRentalItem(id: string): Promise<void> {
    await db.delete(rentalItems).where(eq(rentalItems.id, id));
  }

  // Oak Inventory - Inventory Templates
  async getAllInventoryTemplates(): Promise<InventoryTemplate[]> {
    return await db.select().from(inventoryTemplates).orderBy(desc(inventoryTemplates.createdAt));
  }

  async getInventoryTemplate(id: string): Promise<InventoryTemplate | undefined> {
    const [template] = await db.select().from(inventoryTemplates).where(eq(inventoryTemplates.id, id));
    return template || undefined;
  }

  async createInventoryTemplate(template: InsertInventoryTemplate): Promise<InventoryTemplate> {
    const [created] = await db.insert(inventoryTemplates).values(template).returning();
    return created;
  }

  async updateInventoryTemplate(id: string, template: Partial<InsertInventoryTemplate>): Promise<InventoryTemplate | undefined> {
    const [updated] = await db.update(inventoryTemplates)
      .set(template)
      .where(eq(inventoryTemplates.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteInventoryTemplate(id: string): Promise<void> {
    await db.delete(inventoryTemplates).where(eq(inventoryTemplates.id, id));
  }

  // Oak Inventory - Inventory Template Items
  async getInventoryTemplateItemsByTemplateId(templateId: string): Promise<InventoryTemplateItem[]> {
    return await db.select().from(inventoryTemplateItems)
      .where(eq(inventoryTemplateItems.templateId, templateId));
  }

  async createInventoryTemplateItem(item: InsertInventoryTemplateItem): Promise<InventoryTemplateItem> {
    const [created] = await db.insert(inventoryTemplateItems).values(item).returning();
    return created;
  }

  async deleteInventoryTemplateItem(id: string): Promise<void> {
    await db.delete(inventoryTemplateItems).where(eq(inventoryTemplateItems.id, id));
  }

  // Oak Inventory - Purchase Orders
  async getAllPurchaseOrders(): Promise<PurchaseOrder[]> {
    return await db.select().from(purchaseOrders).orderBy(desc(purchaseOrders.createdAt));
  }

  async getPurchaseOrder(id: string): Promise<PurchaseOrder | undefined> {
    const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id));
    return po || undefined;
  }

  async createPurchaseOrder(po: InsertPurchaseOrder): Promise<PurchaseOrder> {
    const [created] = await db.insert(purchaseOrders).values(po).returning();
    return created;
  }

  async updatePurchaseOrder(id: string, po: Partial<InsertPurchaseOrder>): Promise<PurchaseOrder | undefined> {
    const [updated] = await db.update(purchaseOrders)
      .set(po)
      .where(eq(purchaseOrders.id, id))
      .returning();
    return updated || undefined;
  }

  async deletePurchaseOrder(id: string): Promise<void> {
    await db.delete(purchaseOrders).where(eq(purchaseOrders.id, id));
  }

  async getNextPurchaseOrderNumber(): Promise<string> {
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(purchaseOrders);
    const count = Number(result?.count || 0) + 1;
    return `PO-${String(count).padStart(6, '0')}`;
  }

  // Oak Inventory - Purchase Order Items
  async getPurchaseOrderItemsByPOId(poId: string): Promise<PurchaseOrderItem[]> {
    return await db.select().from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.poId, poId));
  }

  async createPurchaseOrderItem(item: InsertPurchaseOrderItem): Promise<PurchaseOrderItem> {
    const [created] = await db.insert(purchaseOrderItems).values(item).returning();
    return created;
  }

  async deletePurchaseOrderItem(id: string): Promise<void> {
    await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.id, id));
  }

  // Oak Inventory - Production Plans
  async getAllProductionPlans(): Promise<ProductionPlan[]> {
    return await db.select().from(productionPlans).orderBy(desc(productionPlans.createdAt));
  }

  async getProductionPlan(id: string): Promise<ProductionPlan | undefined> {
    const [plan] = await db.select().from(productionPlans).where(eq(productionPlans.id, id));
    return plan || undefined;
  }

  async getProductionPlansByEventId(eventId: string): Promise<ProductionPlan[]> {
    return await db.select().from(productionPlans)
      .where(eq(productionPlans.eventId, eventId))
      .orderBy(desc(productionPlans.createdAt));
  }

  async createProductionPlan(plan: InsertProductionPlan): Promise<ProductionPlan> {
    const [created] = await db.insert(productionPlans).values(plan).returning();
    return created;
  }

  async updateProductionPlan(id: string, plan: Partial<InsertProductionPlan>): Promise<ProductionPlan | undefined> {
    const [updated] = await db.update(productionPlans)
      .set(plan)
      .where(eq(productionPlans.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteProductionPlan(id: string): Promise<void> {
    await db.delete(productionPlans).where(eq(productionPlans.id, id));
  }

  // Oak Inventory - Production Tasks
  async getAllProductionTasks(): Promise<ProductionTask[]> {
    return await db.select().from(productionTasks).orderBy(productionTasks.sortOrder);
  }

  async getProductionTasksByPlanId(planId: string): Promise<ProductionTask[]> {
    return await db.select().from(productionTasks)
      .where(eq(productionTasks.planId, planId))
      .orderBy(productionTasks.sortOrder);
  }

  async createProductionTask(task: InsertProductionTask): Promise<ProductionTask> {
    const [created] = await db.insert(productionTasks).values(task).returning();
    return created;
  }

  async updateProductionTask(id: string, task: Partial<InsertProductionTask>): Promise<ProductionTask | undefined> {
    const [updated] = await db.update(productionTasks)
      .set(task)
      .where(eq(productionTasks.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteProductionTask(id: string): Promise<void> {
    await db.delete(productionTasks).where(eq(productionTasks.id, id));
  }
}

export const storage = new DatabaseStorage();

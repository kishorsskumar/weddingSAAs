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
  productionDecorItems,
  productionDecorElements,
  employeeIncrements,
  employeeAppraisals,
  salaryAdvanceRequests,
  employeeLeaveBalances,
  expenseReimbursements,
  publicHolidays,
  employeeIncentives,
  leaveCategories,
  leaveBalanceAdjustments,
  whatsappMessageTemplates,
  whatsappMessageJobs,
  whatsappMessageLogs,
  executionPlans,
  executionPlanChecklist,
  executionPlanItems,
  executionPlanActivities,
  executionPlanManpower,
  executionPlanGodownItems,
  executionPlanRentals,
  executionPlanPurchases,
  executionPlanPrints,
  checklistTemplates,
  checklistTemplateItems,
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
  type ProductionDecorItem,
  type InsertProductionDecorItem,
  type ProductionDecorElement,
  type InsertProductionDecorElement,
  type ProductionDecorImport,
  type InsertProductionDecorImport,
  productionDecorImports,
  type EmployeeIncrement,
  type InsertEmployeeIncrement,
  type EmployeeAppraisal,
  type InsertEmployeeAppraisal,
  type SalaryAdvanceRequest,
  type InsertSalaryAdvanceRequest,
  type EmployeeLeaveBalance,
  type InsertEmployeeLeaveBalance,
  type ExpenseReimbursement,
  type InsertExpenseReimbursement,
  type PublicHoliday,
  type InsertPublicHoliday,
  type EmployeeIncentive,
  type InsertEmployeeIncentive,
  type LeaveCategory,
  type InsertLeaveCategory,
  type LeaveBalanceAdjustment,
  type InsertLeaveBalanceAdjustment,
  eventTransportation,
  eventManpower,
  quickEntries,
  oaksyConversations,
  oaksyMessages,
  type EventTransportation,
  type InsertEventTransportation,
  type EventManpower,
  type InsertEventManpower,
  type QuickEntry,
  type InsertQuickEntry,
  type OaksyConversation,
  type InsertOaksyConversation,
  type OaksyMessage,
  type InsertOaksyMessage,
  type WhatsappMessageTemplate,
  type InsertWhatsappMessageTemplate,
  type WhatsappMessageJob,
  type InsertWhatsappMessageJob,
  type WhatsappMessageLog,
  type InsertWhatsappMessageLog,
  type ExecutionPlan,
  type InsertExecutionPlan,
  type ExecutionPlanChecklist,
  type InsertExecutionPlanChecklist,
  type ExecutionPlanItem,
  type InsertExecutionPlanItem,
  type ExecutionPlanActivity,
  type InsertExecutionPlanActivity,
  type ExecutionPlanManpower,
  type InsertExecutionPlanManpower,
  type ExecutionPlanGodownItem,
  type InsertExecutionPlanGodownItem,
  type ExecutionPlanRental,
  type InsertExecutionPlanRental,
  type ExecutionPlanPurchase,
  type InsertExecutionPlanPurchase,
  type ExecutionPlanPrint,
  type InsertExecutionPlanPrint,
  type ChecklistTemplate,
  type InsertChecklistTemplate,
  type ChecklistTemplateItem,
  type InsertChecklistTemplateItem,
  presentations,
  presentationSlides,
  slideImages,
  presentationAssets,
  notifications,
  notificationRecipients,
  pushSubscriptions,
  type Presentation,
  type InsertPresentation,
  type PresentationSlide,
  type InsertPresentationSlide,
  type SlideImage,
  type InsertSlideImage,
  type PresentationAsset,
  type InsertPresentationAsset,
  type Notification,
  type InsertNotification,
  type NotificationRecipient,
  type InsertNotificationRecipient,
  type PushSubscription,
  type InsertPushSubscription,
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
  grantUserPermission(userId: string, pageId: string): Promise<void>;
  
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
  getEmployeeByUserId(userId: string): Promise<Employee | undefined>;
  getEmployeesWithoutUserAccount(): Promise<Employee[]>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: string, employee: Partial<InsertEmployee>): Promise<Employee | undefined>;
  deleteEmployee(id: string): Promise<void>;
  generateEmployeeCode(): Promise<string>;
  generateTemporaryPassword(): string;
  createEmployeeWithUser(employeeData: InsertEmployee, password: string): Promise<{ employee: Employee; user: User }>;
  linkEmployeeToUser(employeeId: string, userId: string): Promise<Employee | undefined>;
  backfillEmployeeUserAccount(employeeId: string, hashedPassword: string): Promise<{ employee: Employee; user: User; tempPassword: string } | null>;
  
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

  // Oak Inventory - Production Décor Items
  getAllProductionDecorItems(): Promise<ProductionDecorItem[]>;
  getProductionDecorItem(id: string): Promise<ProductionDecorItem | undefined>;
  createProductionDecorItem(item: InsertProductionDecorItem): Promise<ProductionDecorItem>;
  updateProductionDecorItem(id: string, item: Partial<InsertProductionDecorItem>): Promise<ProductionDecorItem | undefined>;
  deleteProductionDecorItem(id: string): Promise<void>;

  // Oak Inventory - Production Décor Elements
  getAllProductionDecorElements(): Promise<ProductionDecorElement[]>;
  getProductionDecorElementsByDecorItem(decorItemId: string): Promise<ProductionDecorElement[]>;
  createProductionDecorElement(element: InsertProductionDecorElement): Promise<ProductionDecorElement>;
  updateProductionDecorElement(id: string, element: Partial<InsertProductionDecorElement>): Promise<ProductionDecorElement | undefined>;
  deleteProductionDecorElement(id: string): Promise<void>;
  
  // Oak Inventory - Production Décor Imports
  getAllProductionDecorImports(): Promise<ProductionDecorImport[]>;
  getProductionDecorImport(id: string): Promise<ProductionDecorImport | undefined>;
  createProductionDecorImport(importData: InsertProductionDecorImport): Promise<ProductionDecorImport>;
  updateProductionDecorImport(id: string, importData: Partial<InsertProductionDecorImport>): Promise<ProductionDecorImport | undefined>;
  deleteProductionDecorImport(id: string): Promise<void>;
  createProductionDecorItemsFromImport(importBatchId: string, items: InsertProductionDecorItem[], elements: { itemIndex: number; element: InsertProductionDecorElement }[]): Promise<{ items: ProductionDecorItem[]; elements: ProductionDecorElement[] }>;

  // Employee Portal - Get employee by user ID
  getEmployeeByUserId(userId: string): Promise<Employee | undefined>;

  // Employee Portal - Increments
  getEmployeeIncrements(employeeId: string): Promise<EmployeeIncrement[]>;
  getEmployeeIncrement(id: string): Promise<EmployeeIncrement | undefined>;
  createEmployeeIncrement(increment: InsertEmployeeIncrement): Promise<EmployeeIncrement>;
  updateEmployeeIncrement(id: string, increment: Partial<InsertEmployeeIncrement>): Promise<EmployeeIncrement | undefined>;
  deleteEmployeeIncrement(id: string): Promise<void>;

  // Employee Portal - Appraisals
  getEmployeeAppraisals(employeeId: string): Promise<EmployeeAppraisal[]>;
  getEmployeeAppraisal(id: string): Promise<EmployeeAppraisal | undefined>;
  createEmployeeAppraisal(appraisal: InsertEmployeeAppraisal): Promise<EmployeeAppraisal>;
  updateEmployeeAppraisal(id: string, appraisal: Partial<InsertEmployeeAppraisal>): Promise<EmployeeAppraisal | undefined>;
  deleteEmployeeAppraisal(id: string): Promise<void>;

  // Employee Portal - Salary Advance Requests
  getSalaryAdvanceRequests(employeeId: string): Promise<SalaryAdvanceRequest[]>;
  getAllSalaryAdvanceRequests(): Promise<SalaryAdvanceRequest[]>;
  getSalaryAdvanceRequest(id: string): Promise<SalaryAdvanceRequest | undefined>;
  createSalaryAdvanceRequest(request: InsertSalaryAdvanceRequest): Promise<SalaryAdvanceRequest>;
  updateSalaryAdvanceRequest(id: string, request: Partial<InsertSalaryAdvanceRequest>): Promise<SalaryAdvanceRequest | undefined>;
  deleteSalaryAdvanceRequest(id: string): Promise<void>;

  // Employee Portal - Leave Balances
  getEmployeeLeaveBalance(employeeId: string, fiscalYear: string): Promise<EmployeeLeaveBalance | undefined>;
  getEmployeeLeaveBalances(employeeId: string): Promise<EmployeeLeaveBalance[]>;
  createEmployeeLeaveBalance(balance: InsertEmployeeLeaveBalance): Promise<EmployeeLeaveBalance>;
  updateEmployeeLeaveBalance(id: string, balance: Partial<InsertEmployeeLeaveBalance>): Promise<EmployeeLeaveBalance | undefined>;
  getOrCreateCurrentFiscalYearLeaveBalance(employeeId: string): Promise<EmployeeLeaveBalance>;

  // Employee Portal - Leave Requests (employee-scoped)
  getLeaveRequestsByEmployee(employeeId: string): Promise<LeaveRequest[]>;
  getPendingLeaveRequestsForManager(managerUserId: string): Promise<LeaveRequest[]>;
  getPendingSalaryAdvancesForManager(managerUserId: string): Promise<SalaryAdvanceRequest[]>;

  // Employee Portal - Expense Reimbursements
  getExpenseReimbursements(employeeId: string): Promise<ExpenseReimbursement[]>;
  getAllExpenseReimbursements(): Promise<ExpenseReimbursement[]>;
  getExpenseReimbursement(id: string): Promise<ExpenseReimbursement | undefined>;
  createExpenseReimbursement(reimbursement: InsertExpenseReimbursement): Promise<ExpenseReimbursement>;
  updateExpenseReimbursement(id: string, reimbursement: Partial<InsertExpenseReimbursement>): Promise<ExpenseReimbursement | undefined>;
  deleteExpenseReimbursement(id: string): Promise<void>;
  getPendingExpenseReimbursementsForManager(managerUserId: string): Promise<ExpenseReimbursement[]>;

  // Public Holidays
  getAllPublicHolidays(): Promise<PublicHoliday[]>;
  getPublicHolidaysByYear(year: number): Promise<PublicHoliday[]>;
  getPublicHoliday(id: string): Promise<PublicHoliday | undefined>;
  createPublicHoliday(holiday: InsertPublicHoliday): Promise<PublicHoliday>;
  updatePublicHoliday(id: string, holiday: Partial<InsertPublicHoliday>): Promise<PublicHoliday | undefined>;
  deletePublicHoliday(id: string): Promise<void>;

  // Manager-managed employees
  getEmployeesByManager(managerUserId: string): Promise<Employee[]>;

  // Employee Incentives
  getEmployeeIncentives(employeeId: string): Promise<EmployeeIncentive[]>;
  getAllEmployeeIncentives(): Promise<EmployeeIncentive[]>;
  getEmployeeIncentive(id: string): Promise<EmployeeIncentive | undefined>;
  createEmployeeIncentive(incentive: InsertEmployeeIncentive): Promise<EmployeeIncentive>;
  updateEmployeeIncentive(id: string, incentive: Partial<InsertEmployeeIncentive>): Promise<EmployeeIncentive | undefined>;
  deleteEmployeeIncentive(id: string): Promise<void>;
  getEmployeeIncentivesByFiscalYear(employeeId: string, fiscalYear: string): Promise<EmployeeIncentive[]>;

  // Leave Categories
  getAllLeaveCategories(): Promise<LeaveCategory[]>;
  getLeaveCategory(id: string): Promise<LeaveCategory | undefined>;
  getLeaveCategoryByName(name: string): Promise<LeaveCategory | undefined>;
  createLeaveCategory(category: InsertLeaveCategory): Promise<LeaveCategory>;
  updateLeaveCategory(id: string, category: Partial<InsertLeaveCategory>): Promise<LeaveCategory | undefined>;
  deleteLeaveCategory(id: string): Promise<void>;

  // Leave Balances (Per Category)
  getEmployeeLeaveBalanceByCategory(employeeId: string, categoryId: string, year: number): Promise<EmployeeLeaveBalance | undefined>;
  getEmployeeLeaveBalancesByYear(employeeId: string, year: number): Promise<EmployeeLeaveBalance[]>;
  getAllEmployeeLeaveBalancesForYear(year: number): Promise<EmployeeLeaveBalance[]>;
  createOrUpdateLeaveBalance(employeeId: string, categoryId: string, year: number, data: { allocated?: number; used?: number; manuallyAdjusted?: number }): Promise<EmployeeLeaveBalance>;
  initializeEmployeeLeaveBalances(employeeId: string, year: number): Promise<EmployeeLeaveBalance[]>;
  adjustEmployeeLeaveBalance(employeeId: string, categoryId: string, year: number, newAllocated: number, reason: string, adjustedBy: string): Promise<EmployeeLeaveBalance>;

  // Leave Balance Adjustments (Audit)
  getLeaveBalanceAdjustments(employeeId: string): Promise<LeaveBalanceAdjustment[]>;
  createLeaveBalanceAdjustment(adjustment: InsertLeaveBalanceAdjustment): Promise<LeaveBalanceAdjustment>;
  
  // Event Transportation
  getEventTransportation(eventId: string): Promise<EventTransportation[]>;
  getAllEventTransportation(): Promise<EventTransportation[]>;
  createEventTransportation(data: InsertEventTransportation): Promise<EventTransportation>;
  updateEventTransportation(id: string, data: Partial<InsertEventTransportation>): Promise<EventTransportation | undefined>;
  deleteEventTransportation(id: string): Promise<void>;
  
  // Event Manpower
  getEventManpower(eventId: string): Promise<EventManpower[]>;
  getAllEventManpower(): Promise<EventManpower[]>;
  createEventManpower(data: InsertEventManpower): Promise<EventManpower>;
  updateEventManpower(id: string, data: Partial<InsertEventManpower>): Promise<EventManpower | undefined>;
  deleteEventManpower(id: string): Promise<void>;
  
  // Quick Entries (AI-processed payment screenshots)
  getQuickEntriesByEmployee(employeeId: string): Promise<QuickEntry[]>;
  getAllQuickEntries(): Promise<QuickEntry[]>;
  getPendingQuickEntries(): Promise<QuickEntry[]>;
  getQuickEntry(id: string): Promise<QuickEntry | undefined>;
  createQuickEntry(entry: InsertQuickEntry): Promise<QuickEntry>;
  updateQuickEntry(id: string, entry: Partial<InsertQuickEntry>): Promise<QuickEntry | undefined>;
  deleteQuickEntry(id: string): Promise<void>;

  // WhatsApp Message Templates
  getAllWhatsappTemplates(): Promise<WhatsappMessageTemplate[]>;
  getWhatsappTemplate(id: string): Promise<WhatsappMessageTemplate | undefined>;
  createWhatsappTemplate(template: InsertWhatsappMessageTemplate): Promise<WhatsappMessageTemplate>;
  updateWhatsappTemplate(id: string, template: Partial<InsertWhatsappMessageTemplate>): Promise<WhatsappMessageTemplate | undefined>;
  deleteWhatsappTemplate(id: string): Promise<void>;

  // WhatsApp Message Jobs
  getAllWhatsappJobs(): Promise<WhatsappMessageJob[]>;
  getWhatsappJob(id: string): Promise<WhatsappMessageJob | undefined>;
  getPendingWhatsappJobs(): Promise<WhatsappMessageJob[]>;
  createWhatsappJob(job: InsertWhatsappMessageJob): Promise<WhatsappMessageJob>;
  updateWhatsappJob(id: string, job: Partial<InsertWhatsappMessageJob>): Promise<WhatsappMessageJob | undefined>;
  deleteWhatsappJob(id: string): Promise<void>;

  // WhatsApp Message Logs
  getWhatsappLogsByJob(jobId: string): Promise<WhatsappMessageLog[]>;
  getWhatsappLog(id: string): Promise<WhatsappMessageLog | undefined>;
  createWhatsappLog(log: InsertWhatsappMessageLog): Promise<WhatsappMessageLog>;
  updateWhatsappLog(id: string, log: Partial<InsertWhatsappMessageLog>): Promise<WhatsappMessageLog | undefined>;
  getEmployeesWithWhatsappOptIn(): Promise<Employee[]>;

  // Oak Creative - Presentations
  getAllPresentations(): Promise<Presentation[]>;
  getPresentationsByUser(userId: string): Promise<Presentation[]>;
  getPresentation(id: string): Promise<Presentation | undefined>;
  createPresentation(presentation: InsertPresentation): Promise<Presentation>;
  updatePresentation(id: string, presentation: Partial<InsertPresentation>): Promise<Presentation | undefined>;
  deletePresentation(id: string): Promise<void>;

  // Oak Creative - Presentation Slides
  getPresentationSlides(presentationId: string): Promise<PresentationSlide[]>;
  getPresentationSlide(id: string): Promise<PresentationSlide | undefined>;
  createPresentationSlide(slide: InsertPresentationSlide): Promise<PresentationSlide>;
  updatePresentationSlide(id: string, slide: Partial<InsertPresentationSlide>): Promise<PresentationSlide | undefined>;
  deletePresentationSlide(id: string): Promise<void>;
  reorderPresentationSlides(presentationId: string, slideIds: string[]): Promise<void>;

  // Oak Creative - Slide Images
  getSlideImages(slideId: string): Promise<SlideImage[]>;
  createSlideImage(image: InsertSlideImage): Promise<SlideImage>;
  updateSlideImage(id: string, image: Partial<InsertSlideImage>): Promise<SlideImage | undefined>;
  deleteSlideImage(id: string): Promise<void>;

  // Oak Creative - Presentation Assets
  getAllPresentationAssets(): Promise<PresentationAsset[]>;
  getPresentationAssetsByCategory(category: string): Promise<PresentationAsset[]>;
  createPresentationAsset(asset: InsertPresentationAsset): Promise<PresentationAsset>;
  deletePresentationAsset(id: string): Promise<void>;

  // Notifications
  getAllNotifications(): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  deleteNotification(id: string): Promise<void>;
  getUserNotifications(userId: string): Promise<(Notification & { readAt: Date | null })[]>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  markNotificationAsRead(notificationId: string, userId: string): Promise<void>;
  createNotificationRecipients(notificationId: string, userIds: string[]): Promise<void>;

  // Push Subscriptions
  getPushSubscription(userId: string, endpoint: string): Promise<PushSubscription | undefined>;
  getPushSubscriptionsByUser(userId: string): Promise<PushSubscription[]>;
  getAllPushSubscriptions(): Promise<PushSubscription[]>;
  createPushSubscription(subscription: InsertPushSubscription): Promise<PushSubscription>;
  deletePushSubscription(id: string): Promise<void>;
  deletePushSubscriptionByEndpoint(endpoint: string): Promise<void>;
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
    // Clean up foreign key references before deleting user
    // Wrap in transaction to ensure consistency
    await db.transaction(async (tx) => {
      // Event manpower submissions
      await tx.update(eventManpower).set({ submittedBy: null }).where(eq(eventManpower.submittedBy, id));
      await tx.update(eventManpower).set({ approvedBy: null }).where(eq(eventManpower.approvedBy, id));
      
      // Event transportation
      await tx.update(eventTransportation).set({ submittedBy: null }).where(eq(eventTransportation.submittedBy, id));
      await tx.update(eventTransportation).set({ approvedBy: null }).where(eq(eventTransportation.approvedBy, id));
      
      // Employees
      await tx.update(employees).set({ userId: null }).where(eq(employees.userId, id));
      await tx.update(employees).set({ managerUserId: null }).where(eq(employees.managerUserId, id));
      
      // Employee increments
      await tx.update(employeeIncrements).set({ approvedBy: null }).where(eq(employeeIncrements.approvedBy, id));
      
      // Employee appraisals
      await tx.update(employeeAppraisals).set({ reviewedBy: null }).where(eq(employeeAppraisals.reviewedBy, id));
      
      // Salary advance requests
      await tx.update(salaryAdvanceRequests).set({ approvedBy: null }).where(eq(salaryAdvanceRequests.approvedBy, id));
      
      // Expense reimbursements
      await tx.update(expenseReimbursements).set({ approvedBy: null }).where(eq(expenseReimbursements.approvedBy, id));
      
      // Employee incentives
      await tx.update(employeeIncentives).set({ approvedBy: null }).where(eq(employeeIncentives.approvedBy, id));
      
      // Public holidays
      await tx.update(publicHolidays).set({ createdBy: null }).where(eq(publicHolidays.createdBy, id));
      
      // Leave balance adjustments - adjustedBy is NOT NULL, so delete records
      await tx.delete(leaveBalanceAdjustments).where(eq(leaveBalanceAdjustments.adjustedBy, id));
      
      // Inventory transactions
      await tx.update(inventoryTransactions).set({ performedBy: null }).where(eq(inventoryTransactions.performedBy, id));
      
      // Sales contacts
      await tx.update(salesContacts).set({ ownerId: null }).where(eq(salesContacts.ownerId, id));
      
      // Sales companies
      await tx.update(salesCompanies).set({ ownerId: null }).where(eq(salesCompanies.ownerId, id));
      
      // Sales deals
      await tx.update(salesDeals).set({ ownerId: null }).where(eq(salesDeals.ownerId, id));
      
      // Sales activities
      await tx.update(salesActivities).set({ ownerId: null }).where(eq(salesActivities.ownerId, id));
      
      // Now delete the user
      await tx.delete(users).where(eq(users.id, id));
    });
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

  async grantUserPermission(userId: string, pageId: string): Promise<void> {
    const existing = await db.select().from(userPermissions)
      .where(and(eq(userPermissions.userId, userId), eq(userPermissions.pageId, pageId)));
    if (existing.length === 0) {
      await db.insert(userPermissions).values({ userId, pageId });
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

  async getEmployeeByUserId(userId: string): Promise<Employee | undefined> {
    const [employee] = await db.select().from(employees).where(eq(employees.userId, userId));
    return employee || undefined;
  }

  async getEmployeesWithoutUserAccount(): Promise<Employee[]> {
    return await db.select().from(employees).where(sql`${employees.userId} IS NULL`);
  }

  async getUsersWithoutEmployeeRecord(): Promise<User[]> {
    const allUsers = await db.select().from(users);
    const employeesWithUsers = await db.select({ userId: employees.userId }).from(employees).where(sql`${employees.userId} IS NOT NULL`);
    const linkedUserIds = new Set(employeesWithUsers.map(e => e.userId));
    return allUsers.filter(u => !linkedUserIds.has(u.id) && u.role !== 'superadmin');
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

  async generateEmployeeCode(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const documentType = 'employee_code';
    
    const [sequence] = await db.select().from(documentSequences)
      .where(eq(documentSequences.documentType, documentType));
    
    if (!sequence) {
      await db.insert(documentSequences).values({
        documentType,
        prefix: `OAK-${year}-`,
        nextNumber: 2,
        paddingLength: 4
      });
      return `OAK-${year}-0001`;
    }
    
    const prefix = sequence.prefix.includes(year.toString()) 
      ? sequence.prefix 
      : `OAK-${year}-`;
    
    const currentNumber = sequence.nextNumber;
    const code = `${prefix}${String(currentNumber).padStart(sequence.paddingLength, '0')}`;
    
    const existingEmployee = await db.select().from(employees)
      .where(eq(employees.employeeId, code))
      .limit(1);
    
    if (existingEmployee.length > 0) {
      const maxEmployee = await db.select({ employeeId: employees.employeeId })
        .from(employees)
        .where(sql`${employees.employeeId} LIKE ${`OAK-${year}-%`}`)
        .orderBy(sql`${employees.employeeId} DESC`)
        .limit(1);
      
      let nextNum = currentNumber + 1;
      if (maxEmployee.length > 0) {
        const match = maxEmployee[0].employeeId.match(/OAK-\d{4}-(\d+)/);
        if (match) {
          nextNum = Math.max(nextNum, parseInt(match[1], 10) + 1);
        }
      }
      
      await db.update(documentSequences)
        .set({ nextNumber: nextNum + 1, prefix })
        .where(eq(documentSequences.documentType, documentType));
      
      return `${prefix}${String(nextNum).padStart(sequence.paddingLength, '0')}`;
    }
    
    await db.update(documentSequences)
      .set({ 
        nextNumber: currentNumber + 1,
        prefix: prefix
      })
      .where(eq(documentSequences.documentType, documentType));
    
    return code;
  }

  async createEmployeeWithUser(employeeData: InsertEmployee, hashedPassword: string): Promise<{ employee: Employee; user: User }> {
    const newUser = await db.insert(users).values({
      name: employeeData.name,
      email: employeeData.email!,
      password: hashedPassword,
      role: 'employee',
      createdVia: 'employee_onboarding'
    }).returning();
    
    const user = newUser[0];
    
    const newEmployee = await db.insert(employees).values({
      ...employeeData,
      userId: user.id
    }).returning();
    
    const employee = newEmployee[0];
    
    return { employee, user };
  }

  generateTemporaryPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  async linkEmployeeToUser(employeeId: string, userId: string): Promise<Employee | undefined> {
    const [employee] = await db.update(employees)
      .set({ userId })
      .where(eq(employees.id, employeeId))
      .returning();
    return employee || undefined;
  }

  async backfillEmployeeUserAccount(employeeId: string, hashedPassword: string): Promise<{ employee: Employee; user: User; tempPassword: string } | null> {
    const [existingEmployee] = await db.select().from(employees).where(eq(employees.id, employeeId));
    
    if (!existingEmployee) {
      return null;
    }
    
    if (existingEmployee.userId) {
      return null;
    }
    
    const email = existingEmployee.email || `${existingEmployee.employeeId.toLowerCase().replace(/[^a-z0-9]/g, '')}@oak.local`;
    
    const [newUser] = await db.insert(users).values({
      name: existingEmployee.name,
      email: email,
      password: hashedPassword,
      role: 'employee',
      createdVia: 'employee_onboarding'
    }).returning();
    
    const [updatedEmployee] = await db.update(employees)
      .set({ 
        userId: newUser.id,
        email: email
      })
      .where(eq(employees.id, employeeId))
      .returning();
    
    const tempPassword = this.generateTemporaryPassword();
    
    return { employee: updatedEmployee, user: newUser, tempPassword };
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

  // Oak Inventory - Production Décor Items
  async getAllProductionDecorItems(): Promise<ProductionDecorItem[]> {
    return await db.select().from(productionDecorItems).orderBy(desc(productionDecorItems.createdAt));
  }

  async getProductionDecorItem(id: string): Promise<ProductionDecorItem | undefined> {
    const [item] = await db.select().from(productionDecorItems).where(eq(productionDecorItems.id, id));
    return item || undefined;
  }

  async createProductionDecorItem(item: InsertProductionDecorItem): Promise<ProductionDecorItem> {
    const [created] = await db.insert(productionDecorItems).values(item).returning();
    return created;
  }

  async updateProductionDecorItem(id: string, item: Partial<InsertProductionDecorItem>): Promise<ProductionDecorItem | undefined> {
    const [updated] = await db.update(productionDecorItems)
      .set({ ...item, updatedAt: new Date() })
      .where(eq(productionDecorItems.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteProductionDecorItem(id: string): Promise<void> {
    await db.delete(productionDecorItems).where(eq(productionDecorItems.id, id));
  }

  // Oak Inventory - Production Décor Elements
  async getAllProductionDecorElements(): Promise<ProductionDecorElement[]> {
    return await db.select().from(productionDecorElements).orderBy(desc(productionDecorElements.createdAt));
  }

  async getProductionDecorElementsByDecorItem(decorItemId: string): Promise<ProductionDecorElement[]> {
    return await db.select().from(productionDecorElements)
      .where(eq(productionDecorElements.decorItemId, decorItemId));
  }

  async createProductionDecorElement(element: InsertProductionDecorElement): Promise<ProductionDecorElement> {
    const [created] = await db.insert(productionDecorElements).values(element).returning();
    return created;
  }

  async updateProductionDecorElement(id: string, element: Partial<InsertProductionDecorElement>): Promise<ProductionDecorElement | undefined> {
    const [updated] = await db.update(productionDecorElements)
      .set(element)
      .where(eq(productionDecorElements.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteProductionDecorElement(id: string): Promise<void> {
    await db.delete(productionDecorElements).where(eq(productionDecorElements.id, id));
  }

  // Oak Inventory - Production Décor Imports
  async getAllProductionDecorImports(): Promise<ProductionDecorImport[]> {
    return await db.select().from(productionDecorImports).orderBy(desc(productionDecorImports.createdAt));
  }

  async getProductionDecorImport(id: string): Promise<ProductionDecorImport | undefined> {
    const [importRecord] = await db.select().from(productionDecorImports).where(eq(productionDecorImports.id, id));
    return importRecord || undefined;
  }

  async createProductionDecorImport(importData: InsertProductionDecorImport): Promise<ProductionDecorImport> {
    const [created] = await db.insert(productionDecorImports).values(importData).returning();
    return created;
  }

  async updateProductionDecorImport(id: string, importData: Partial<InsertProductionDecorImport>): Promise<ProductionDecorImport | undefined> {
    const [updated] = await db.update(productionDecorImports)
      .set(importData)
      .where(eq(productionDecorImports.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteProductionDecorImport(id: string): Promise<void> {
    await db.delete(productionDecorImports).where(eq(productionDecorImports.id, id));
  }

  async createProductionDecorItemsFromImport(
    importBatchId: string, 
    items: InsertProductionDecorItem[], 
    elements: { itemIndex: number; element: InsertProductionDecorElement }[]
  ): Promise<{ items: ProductionDecorItem[]; elements: ProductionDecorElement[] }> {
    const createdItems: ProductionDecorItem[] = [];
    const createdElements: ProductionDecorElement[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const [createdItem] = await db.insert(productionDecorItems)
        .values({ ...item, importBatchId, sequence: i })
        .returning();
      createdItems.push(createdItem);

      const itemElements = elements.filter(e => e.itemIndex === i);
      for (const { element } of itemElements) {
        const [createdElement] = await db.insert(productionDecorElements)
          .values({ ...element, decorItemId: createdItem.id })
          .returning();
        createdElements.push(createdElement);
      }
    }

    await db.update(productionDecorImports)
      .set({ 
        status: 'completed', 
        itemsCreated: createdItems.length, 
        elementsCreated: createdElements.length 
      })
      .where(eq(productionDecorImports.id, importBatchId));

    return { items: createdItems, elements: createdElements };
  }

  // Employee Portal - Increments
  async getEmployeeIncrements(employeeId: string): Promise<EmployeeIncrement[]> {
    return await db.select().from(employeeIncrements)
      .where(eq(employeeIncrements.employeeId, employeeId))
      .orderBy(desc(employeeIncrements.effectiveDate));
  }

  async getEmployeeIncrement(id: string): Promise<EmployeeIncrement | undefined> {
    const [increment] = await db.select().from(employeeIncrements).where(eq(employeeIncrements.id, id));
    return increment || undefined;
  }

  async createEmployeeIncrement(increment: InsertEmployeeIncrement): Promise<EmployeeIncrement> {
    const [created] = await db.insert(employeeIncrements).values(increment).returning();
    return created;
  }

  async updateEmployeeIncrement(id: string, increment: Partial<InsertEmployeeIncrement>): Promise<EmployeeIncrement | undefined> {
    const [updated] = await db.update(employeeIncrements)
      .set(increment)
      .where(eq(employeeIncrements.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteEmployeeIncrement(id: string): Promise<void> {
    await db.delete(employeeIncrements).where(eq(employeeIncrements.id, id));
  }

  // Employee Portal - Appraisals
  async getEmployeeAppraisals(employeeId: string): Promise<EmployeeAppraisal[]> {
    return await db.select().from(employeeAppraisals)
      .where(eq(employeeAppraisals.employeeId, employeeId))
      .orderBy(desc(employeeAppraisals.reviewDate));
  }

  async getEmployeeAppraisal(id: string): Promise<EmployeeAppraisal | undefined> {
    const [appraisal] = await db.select().from(employeeAppraisals).where(eq(employeeAppraisals.id, id));
    return appraisal || undefined;
  }

  async createEmployeeAppraisal(appraisal: InsertEmployeeAppraisal): Promise<EmployeeAppraisal> {
    const [created] = await db.insert(employeeAppraisals).values(appraisal).returning();
    return created;
  }

  async updateEmployeeAppraisal(id: string, appraisal: Partial<InsertEmployeeAppraisal>): Promise<EmployeeAppraisal | undefined> {
    const [updated] = await db.update(employeeAppraisals)
      .set(appraisal)
      .where(eq(employeeAppraisals.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteEmployeeAppraisal(id: string): Promise<void> {
    await db.delete(employeeAppraisals).where(eq(employeeAppraisals.id, id));
  }

  // Employee Portal - Salary Advance Requests
  async getSalaryAdvanceRequests(employeeId: string): Promise<SalaryAdvanceRequest[]> {
    return await db.select().from(salaryAdvanceRequests)
      .where(eq(salaryAdvanceRequests.employeeId, employeeId))
      .orderBy(desc(salaryAdvanceRequests.requestDate));
  }

  async getAllSalaryAdvanceRequests(): Promise<SalaryAdvanceRequest[]> {
    return await db.select().from(salaryAdvanceRequests).orderBy(desc(salaryAdvanceRequests.requestDate));
  }

  async getSalaryAdvanceRequest(id: string): Promise<SalaryAdvanceRequest | undefined> {
    const [request] = await db.select().from(salaryAdvanceRequests).where(eq(salaryAdvanceRequests.id, id));
    return request || undefined;
  }

  async createSalaryAdvanceRequest(request: InsertSalaryAdvanceRequest): Promise<SalaryAdvanceRequest> {
    const [created] = await db.insert(salaryAdvanceRequests).values(request).returning();
    return created;
  }

  async updateSalaryAdvanceRequest(id: string, request: Partial<InsertSalaryAdvanceRequest>): Promise<SalaryAdvanceRequest | undefined> {
    const [updated] = await db.update(salaryAdvanceRequests)
      .set(request)
      .where(eq(salaryAdvanceRequests.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteSalaryAdvanceRequest(id: string): Promise<void> {
    await db.delete(salaryAdvanceRequests).where(eq(salaryAdvanceRequests.id, id));
  }

  // Employee Portal - Leave Balances (Legacy methods - kept for backward compatibility)
  async getEmployeeLeaveBalance(employeeId: string, fiscalYear: string): Promise<EmployeeLeaveBalance | undefined> {
    // Parse fiscal year to get calendar year (e.g., "FY2024-25" -> 2024)
    const match = fiscalYear.match(/FY(\d{4})/);
    const year = match ? parseInt(match[1]) : new Date().getFullYear();
    
    const [balance] = await db.select().from(employeeLeaveBalances)
      .where(and(
        eq(employeeLeaveBalances.employeeId, employeeId),
        eq(employeeLeaveBalances.year, year)
      ));
    return balance || undefined;
  }

  async getEmployeeLeaveBalances(employeeId: string): Promise<EmployeeLeaveBalance[]> {
    return await db.select().from(employeeLeaveBalances)
      .where(eq(employeeLeaveBalances.employeeId, employeeId))
      .orderBy(desc(employeeLeaveBalances.year));
  }

  async createEmployeeLeaveBalance(balance: InsertEmployeeLeaveBalance): Promise<EmployeeLeaveBalance> {
    const [created] = await db.insert(employeeLeaveBalances).values(balance).returning();
    return created;
  }

  async updateEmployeeLeaveBalance(id: string, balance: Partial<InsertEmployeeLeaveBalance>): Promise<EmployeeLeaveBalance | undefined> {
    const [updated] = await db.update(employeeLeaveBalances)
      .set(balance)
      .where(eq(employeeLeaveBalances.id, id))
      .returning();
    return updated || undefined;
  }

  async getOrCreateCurrentFiscalYearLeaveBalance(employeeId: string): Promise<EmployeeLeaveBalance> {
    const now = new Date();
    const currentYear = now.getFullYear();

    // Check for any balance for current year
    const existingBalances = await this.getEmployeeLeaveBalancesByYear(employeeId, currentYear);
    if (existingBalances.length > 0) return existingBalances[0];

    // Initialize balances for all categories
    const balances = await this.initializeEmployeeLeaveBalances(employeeId, currentYear);
    return balances[0];
  }

  // Employee Portal - Leave Requests (employee-scoped)
  async getLeaveRequestsByEmployee(employeeId: string): Promise<LeaveRequest[]> {
    return await db.select().from(leaveRequests)
      .where(eq(leaveRequests.employeeId, employeeId))
      .orderBy(desc(leaveRequests.createdAt));
  }

  async getPendingLeaveRequestsForManager(managerUserId: string): Promise<LeaveRequest[]> {
    const managedEmployees = await this.getEmployeesByManager(managerUserId);
    const employeeIds = managedEmployees.map(e => e.id);
    
    if (employeeIds.length === 0) return [];
    
    const allRequests = await db.select().from(leaveRequests)
      .where(eq(leaveRequests.status, 'pending'))
      .orderBy(desc(leaveRequests.createdAt));
    
    return allRequests.filter(r => employeeIds.includes(r.employeeId));
  }

  async getPendingSalaryAdvancesForManager(managerUserId: string): Promise<SalaryAdvanceRequest[]> {
    const managedEmployees = await this.getEmployeesByManager(managerUserId);
    const employeeIds = managedEmployees.map(e => e.id);
    
    if (employeeIds.length === 0) return [];
    
    const allRequests = await db.select().from(salaryAdvanceRequests)
      .where(eq(salaryAdvanceRequests.status, 'pending'))
      .orderBy(desc(salaryAdvanceRequests.requestDate));
    
    return allRequests.filter(r => employeeIds.includes(r.employeeId));
  }

  // Employee Portal - Expense Reimbursements
  async getExpenseReimbursements(employeeId: string): Promise<ExpenseReimbursement[]> {
    return await db.select().from(expenseReimbursements)
      .where(eq(expenseReimbursements.employeeId, employeeId))
      .orderBy(desc(expenseReimbursements.requestDate));
  }

  async getAllExpenseReimbursements(): Promise<ExpenseReimbursement[]> {
    return await db.select().from(expenseReimbursements).orderBy(desc(expenseReimbursements.requestDate));
  }

  async getExpenseReimbursement(id: string): Promise<ExpenseReimbursement | undefined> {
    const [reimbursement] = await db.select().from(expenseReimbursements).where(eq(expenseReimbursements.id, id));
    return reimbursement || undefined;
  }

  async createExpenseReimbursement(reimbursement: InsertExpenseReimbursement): Promise<ExpenseReimbursement> {
    const [created] = await db.insert(expenseReimbursements).values(reimbursement).returning();
    return created;
  }

  async updateExpenseReimbursement(id: string, reimbursement: Partial<InsertExpenseReimbursement>): Promise<ExpenseReimbursement | undefined> {
    const [updated] = await db.update(expenseReimbursements)
      .set(reimbursement)
      .where(eq(expenseReimbursements.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteExpenseReimbursement(id: string): Promise<void> {
    await db.delete(expenseReimbursements).where(eq(expenseReimbursements.id, id));
  }

  async getPendingExpenseReimbursementsForManager(managerUserId: string): Promise<ExpenseReimbursement[]> {
    const managedEmployees = await this.getEmployeesByManager(managerUserId);
    const employeeIds = managedEmployees.map(e => e.id);
    
    if (employeeIds.length === 0) return [];
    
    const allRequests = await db.select().from(expenseReimbursements)
      .where(eq(expenseReimbursements.status, 'pending'))
      .orderBy(desc(expenseReimbursements.requestDate));
    
    return allRequests.filter(r => employeeIds.includes(r.employeeId));
  }

  // Public Holidays
  async getAllPublicHolidays(): Promise<PublicHoliday[]> {
    return await db.select().from(publicHolidays).orderBy(publicHolidays.date);
  }

  async getPublicHolidaysByYear(year: number): Promise<PublicHoliday[]> {
    return await db.select().from(publicHolidays)
      .where(eq(publicHolidays.year, year))
      .orderBy(publicHolidays.date);
  }

  async getPublicHoliday(id: string): Promise<PublicHoliday | undefined> {
    const [holiday] = await db.select().from(publicHolidays).where(eq(publicHolidays.id, id));
    return holiday || undefined;
  }

  async createPublicHoliday(holiday: InsertPublicHoliday): Promise<PublicHoliday> {
    const [created] = await db.insert(publicHolidays).values(holiday).returning();
    return created;
  }

  async updatePublicHoliday(id: string, holiday: Partial<InsertPublicHoliday>): Promise<PublicHoliday | undefined> {
    const [updated] = await db.update(publicHolidays)
      .set(holiday)
      .where(eq(publicHolidays.id, id))
      .returning();
    return updated || undefined;
  }

  async deletePublicHoliday(id: string): Promise<void> {
    await db.delete(publicHolidays).where(eq(publicHolidays.id, id));
  }

  // Manager-managed employees
  async getEmployeesByManager(managerUserId: string): Promise<Employee[]> {
    return await db.select().from(employees)
      .where(eq(employees.managerUserId, managerUserId));
  }

  // Employee Incentives
  async getEmployeeIncentives(employeeId: string): Promise<EmployeeIncentive[]> {
    return await db.select().from(employeeIncentives)
      .where(eq(employeeIncentives.employeeId, employeeId))
      .orderBy(desc(employeeIncentives.date));
  }

  async getAllEmployeeIncentives(): Promise<EmployeeIncentive[]> {
    return await db.select().from(employeeIncentives)
      .orderBy(desc(employeeIncentives.date));
  }

  async getEmployeeIncentive(id: string): Promise<EmployeeIncentive | undefined> {
    const [incentive] = await db.select().from(employeeIncentives)
      .where(eq(employeeIncentives.id, id));
    return incentive || undefined;
  }

  async createEmployeeIncentive(incentive: InsertEmployeeIncentive): Promise<EmployeeIncentive> {
    const [created] = await db.insert(employeeIncentives).values(incentive).returning();
    return created;
  }

  async updateEmployeeIncentive(id: string, incentive: Partial<InsertEmployeeIncentive>): Promise<EmployeeIncentive | undefined> {
    const [updated] = await db.update(employeeIncentives)
      .set(incentive)
      .where(eq(employeeIncentives.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteEmployeeIncentive(id: string): Promise<void> {
    await db.delete(employeeIncentives).where(eq(employeeIncentives.id, id));
  }

  async getEmployeeIncentivesByFiscalYear(employeeId: string, fiscalYear: string): Promise<EmployeeIncentive[]> {
    return await db.select().from(employeeIncentives)
      .where(and(
        eq(employeeIncentives.employeeId, employeeId),
        eq(employeeIncentives.fiscalYear, fiscalYear)
      ))
      .orderBy(desc(employeeIncentives.date));
  }

  // Leave Categories
  async getAllLeaveCategories(): Promise<LeaveCategory[]> {
    return await db.select().from(leaveCategories).orderBy(leaveCategories.name);
  }

  async getLeaveCategory(id: string): Promise<LeaveCategory | undefined> {
    const [category] = await db.select().from(leaveCategories).where(eq(leaveCategories.id, id));
    return category || undefined;
  }

  async getLeaveCategoryByName(name: string): Promise<LeaveCategory | undefined> {
    const [category] = await db.select().from(leaveCategories).where(eq(leaveCategories.name, name));
    return category || undefined;
  }

  async createLeaveCategory(category: InsertLeaveCategory): Promise<LeaveCategory> {
    const [created] = await db.insert(leaveCategories).values(category).returning();
    return created;
  }

  async updateLeaveCategory(id: string, category: Partial<InsertLeaveCategory>): Promise<LeaveCategory | undefined> {
    const [updated] = await db.update(leaveCategories)
      .set(category)
      .where(eq(leaveCategories.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteLeaveCategory(id: string): Promise<void> {
    await db.delete(leaveCategories).where(eq(leaveCategories.id, id));
  }

  // Leave Balances (Per Category)
  async getEmployeeLeaveBalanceByCategory(employeeId: string, categoryId: string, year: number): Promise<EmployeeLeaveBalance | undefined> {
    const [balance] = await db.select().from(employeeLeaveBalances)
      .where(and(
        eq(employeeLeaveBalances.employeeId, employeeId),
        eq(employeeLeaveBalances.categoryId, categoryId),
        eq(employeeLeaveBalances.year, year)
      ));
    return balance || undefined;
  }

  async getEmployeeLeaveBalancesByYear(employeeId: string, year: number): Promise<EmployeeLeaveBalance[]> {
    return await db.select().from(employeeLeaveBalances)
      .where(and(
        eq(employeeLeaveBalances.employeeId, employeeId),
        eq(employeeLeaveBalances.year, year)
      ));
  }

  async getAllEmployeeLeaveBalancesForYear(year: number): Promise<EmployeeLeaveBalance[]> {
    return await db.select().from(employeeLeaveBalances)
      .where(eq(employeeLeaveBalances.year, year));
  }

  async createOrUpdateLeaveBalance(employeeId: string, categoryId: string, year: number, data: { allocated?: number; used?: number; manuallyAdjusted?: number }): Promise<EmployeeLeaveBalance> {
    const existing = await this.getEmployeeLeaveBalanceByCategory(employeeId, categoryId, year);
    
    if (existing) {
      const [updated] = await db.update(employeeLeaveBalances)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(eq(employeeLeaveBalances.id, existing.id))
        .returning();
      return updated;
    } else {
      const category = await this.getLeaveCategory(categoryId);
      // Generate fiscal year string in format "FY2025-26" to match existing data
      const nextYearShort = (year + 1).toString().slice(-2);
      const fiscalYear = `FY${year}-${nextYearShort}`;
      const [created] = await db.insert(employeeLeaveBalances).values({
        employeeId,
        categoryId,
        year,
        fiscalYear,
        allocated: data.allocated ?? category?.defaultAnnualAllowance ?? 12,
        used: data.used ?? 0,
        manuallyAdjusted: data.manuallyAdjusted ?? 0,
      }).returning();
      return created;
    }
  }

  async initializeEmployeeLeaveBalances(employeeId: string, year: number): Promise<EmployeeLeaveBalance[]> {
    const categories = await this.getAllLeaveCategories();
    const balances: EmployeeLeaveBalance[] = [];
    
    for (const category of categories) {
      const existing = await this.getEmployeeLeaveBalanceByCategory(employeeId, category.id, year);
      if (!existing) {
        const balance = await this.createOrUpdateLeaveBalance(employeeId, category.id, year, {
          allocated: category.defaultAnnualAllowance
        });
        balances.push(balance);
      } else {
        balances.push(existing);
      }
    }
    
    return balances;
  }

  async adjustEmployeeLeaveBalance(employeeId: string, categoryId: string, year: number, newAllocated: number, reason: string, adjustedBy: string): Promise<EmployeeLeaveBalance> {
    const existing = await this.getEmployeeLeaveBalanceByCategory(employeeId, categoryId, year);
    const previousValue = existing?.allocated ?? 0;
    
    // Create adjustment audit log
    await this.createLeaveBalanceAdjustment({
      employeeId,
      categoryId,
      year,
      previousValue,
      newValue: newAllocated,
      reason,
      adjustedBy
    });
    
    // Update the balance
    return await this.createOrUpdateLeaveBalance(employeeId, categoryId, year, {
      allocated: newAllocated
    });
  }

  // Leave Balance Adjustments (Audit)
  async getLeaveBalanceAdjustments(employeeId: string): Promise<LeaveBalanceAdjustment[]> {
    return await db.select().from(leaveBalanceAdjustments)
      .where(eq(leaveBalanceAdjustments.employeeId, employeeId))
      .orderBy(desc(leaveBalanceAdjustments.createdAt));
  }

  async createLeaveBalanceAdjustment(adjustment: InsertLeaveBalanceAdjustment): Promise<LeaveBalanceAdjustment> {
    const [created] = await db.insert(leaveBalanceAdjustments).values(adjustment).returning();
    return created;
  }

  // Event Transportation
  async getEventTransportation(eventId: string): Promise<EventTransportation[]> {
    return await db.select().from(eventTransportation)
      .where(eq(eventTransportation.eventId, eventId))
      .orderBy(desc(eventTransportation.date));
  }

  async getAllEventTransportation(): Promise<EventTransportation[]> {
    return await db.select().from(eventTransportation).orderBy(desc(eventTransportation.date));
  }

  async createEventTransportation(data: InsertEventTransportation): Promise<EventTransportation> {
    const [created] = await db.insert(eventTransportation).values(data).returning();
    return created;
  }

  async updateEventTransportation(id: string, data: Partial<InsertEventTransportation>): Promise<EventTransportation | undefined> {
    const [updated] = await db.update(eventTransportation)
      .set(data)
      .where(eq(eventTransportation.id, id))
      .returning();
    return updated;
  }

  async deleteEventTransportation(id: string): Promise<void> {
    await db.delete(eventTransportation).where(eq(eventTransportation.id, id));
  }

  // Event Manpower
  async getEventManpower(eventId: string): Promise<EventManpower[]> {
    return await db.select().from(eventManpower)
      .where(eq(eventManpower.eventId, eventId))
      .orderBy(desc(eventManpower.date));
  }

  async getAllEventManpower(): Promise<EventManpower[]> {
    return await db.select().from(eventManpower).orderBy(desc(eventManpower.date));
  }

  async createEventManpower(data: InsertEventManpower): Promise<EventManpower> {
    const [created] = await db.insert(eventManpower).values(data).returning();
    return created;
  }

  async updateEventManpower(id: string, data: Partial<InsertEventManpower>): Promise<EventManpower | undefined> {
    const [updated] = await db.update(eventManpower)
      .set(data)
      .where(eq(eventManpower.id, id))
      .returning();
    return updated;
  }

  async deleteEventManpower(id: string): Promise<void> {
    await db.delete(eventManpower).where(eq(eventManpower.id, id));
  }

  // Quick Entries (AI-processed payment screenshots)
  async getQuickEntriesByEmployee(employeeId: string): Promise<QuickEntry[]> {
    return await db.select().from(quickEntries)
      .where(eq(quickEntries.employeeId, employeeId))
      .orderBy(desc(quickEntries.createdAt));
  }

  async getAllQuickEntries(): Promise<QuickEntry[]> {
    return await db.select().from(quickEntries).orderBy(desc(quickEntries.createdAt));
  }

  async getPendingQuickEntries(): Promise<QuickEntry[]> {
    return await db.select().from(quickEntries)
      .where(eq(quickEntries.status, 'awaiting_review'))
      .orderBy(desc(quickEntries.createdAt));
  }

  async getQuickEntry(id: string): Promise<QuickEntry | undefined> {
    const [entry] = await db.select().from(quickEntries).where(eq(quickEntries.id, id));
    return entry || undefined;
  }

  async createQuickEntry(entry: InsertQuickEntry): Promise<QuickEntry> {
    const [created] = await db.insert(quickEntries).values(entry).returning();
    return created;
  }

  async updateQuickEntry(id: string, entry: Partial<InsertQuickEntry>): Promise<QuickEntry | undefined> {
    const [updated] = await db.update(quickEntries)
      .set({ ...entry, updatedAt: new Date() })
      .where(eq(quickEntries.id, id))
      .returning();
    return updated;
  }

  async deleteQuickEntry(id: string): Promise<void> {
    await db.delete(quickEntries).where(eq(quickEntries.id, id));
  }

  // Oaksy AI Conversations
  async getOaksyConversations(userId: string): Promise<OaksyConversation[]> {
    return await db.select().from(oaksyConversations)
      .where(eq(oaksyConversations.userId, userId))
      .orderBy(desc(oaksyConversations.updatedAt));
  }

  async getOaksyConversation(id: string): Promise<OaksyConversation | undefined> {
    const [conversation] = await db.select().from(oaksyConversations).where(eq(oaksyConversations.id, id));
    return conversation || undefined;
  }

  async createOaksyConversation(conversation: InsertOaksyConversation): Promise<OaksyConversation> {
    const [created] = await db.insert(oaksyConversations).values(conversation).returning();
    return created;
  }

  async updateOaksyConversation(id: string, data: Partial<InsertOaksyConversation>): Promise<OaksyConversation | undefined> {
    const [updated] = await db.update(oaksyConversations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(oaksyConversations.id, id))
      .returning();
    return updated;
  }

  async deleteOaksyConversation(id: string): Promise<void> {
    await db.delete(oaksyConversations).where(eq(oaksyConversations.id, id));
  }

  async getAllOaksyConversations(): Promise<OaksyConversation[]> {
    return await db.select().from(oaksyConversations)
      .orderBy(desc(oaksyConversations.updatedAt));
  }

  async deleteAllOaksyConversations(): Promise<number> {
    const result = await db.delete(oaksyConversations);
    return result.rowCount || 0;
  }

  // Oaksy AI Messages
  async getOaksyMessages(conversationId: string): Promise<OaksyMessage[]> {
    return await db.select().from(oaksyMessages)
      .where(eq(oaksyMessages.conversationId, conversationId))
      .orderBy(oaksyMessages.createdAt);
  }

  async createOaksyMessage(message: InsertOaksyMessage): Promise<OaksyMessage> {
    const [created] = await db.insert(oaksyMessages).values(message).returning();
    return created;
  }

  async deleteOaksyMessages(conversationId: string): Promise<void> {
    await db.delete(oaksyMessages).where(eq(oaksyMessages.conversationId, conversationId));
  }

  // WhatsApp Message Templates
  async getAllWhatsappTemplates(): Promise<WhatsappMessageTemplate[]> {
    return await db.select().from(whatsappMessageTemplates).orderBy(desc(whatsappMessageTemplates.createdAt));
  }

  async getWhatsappTemplate(id: string): Promise<WhatsappMessageTemplate | undefined> {
    const [template] = await db.select().from(whatsappMessageTemplates).where(eq(whatsappMessageTemplates.id, id));
    return template || undefined;
  }

  async createWhatsappTemplate(template: InsertWhatsappMessageTemplate): Promise<WhatsappMessageTemplate> {
    const [created] = await db.insert(whatsappMessageTemplates).values(template).returning();
    return created;
  }

  async updateWhatsappTemplate(id: string, template: Partial<InsertWhatsappMessageTemplate>): Promise<WhatsappMessageTemplate | undefined> {
    const [updated] = await db.update(whatsappMessageTemplates)
      .set({ ...template, updatedAt: new Date() })
      .where(eq(whatsappMessageTemplates.id, id))
      .returning();
    return updated;
  }

  async deleteWhatsappTemplate(id: string): Promise<void> {
    await db.delete(whatsappMessageTemplates).where(eq(whatsappMessageTemplates.id, id));
  }

  // WhatsApp Message Jobs
  async getAllWhatsappJobs(): Promise<WhatsappMessageJob[]> {
    return await db.select().from(whatsappMessageJobs).orderBy(desc(whatsappMessageJobs.createdAt));
  }

  async getWhatsappJob(id: string): Promise<WhatsappMessageJob | undefined> {
    const [job] = await db.select().from(whatsappMessageJobs).where(eq(whatsappMessageJobs.id, id));
    return job || undefined;
  }

  async getPendingWhatsappJobs(): Promise<WhatsappMessageJob[]> {
    return await db.select().from(whatsappMessageJobs)
      .where(eq(whatsappMessageJobs.status, 'pending'))
      .orderBy(whatsappMessageJobs.scheduledFor);
  }

  async createWhatsappJob(job: InsertWhatsappMessageJob): Promise<WhatsappMessageJob> {
    const [created] = await db.insert(whatsappMessageJobs).values(job).returning();
    return created;
  }

  async updateWhatsappJob(id: string, job: Partial<InsertWhatsappMessageJob>): Promise<WhatsappMessageJob | undefined> {
    const [updated] = await db.update(whatsappMessageJobs)
      .set(job)
      .where(eq(whatsappMessageJobs.id, id))
      .returning();
    return updated;
  }

  async deleteWhatsappJob(id: string): Promise<void> {
    await db.delete(whatsappMessageJobs).where(eq(whatsappMessageJobs.id, id));
  }

  // WhatsApp Message Logs
  async getWhatsappLogsByJob(jobId: string): Promise<WhatsappMessageLog[]> {
    return await db.select().from(whatsappMessageLogs)
      .where(eq(whatsappMessageLogs.jobId, jobId))
      .orderBy(desc(whatsappMessageLogs.createdAt));
  }

  async getWhatsappLog(id: string): Promise<WhatsappMessageLog | undefined> {
    const [log] = await db.select().from(whatsappMessageLogs).where(eq(whatsappMessageLogs.id, id));
    return log || undefined;
  }

  async createWhatsappLog(log: InsertWhatsappMessageLog): Promise<WhatsappMessageLog> {
    const [created] = await db.insert(whatsappMessageLogs).values(log).returning();
    return created;
  }

  async updateWhatsappLog(id: string, log: Partial<InsertWhatsappMessageLog>): Promise<WhatsappMessageLog | undefined> {
    const [updated] = await db.update(whatsappMessageLogs)
      .set(log)
      .where(eq(whatsappMessageLogs.id, id))
      .returning();
    return updated;
  }

  async getEmployeesWithWhatsappOptIn(): Promise<Employee[]> {
    return await db.select().from(employees)
      .where(eq(employees.whatsappOptIn, true));
  }

  // ===========================
  // EXECUTION PLAN METHODS
  // ===========================

  // Main Execution Plans
  async getAllExecutionPlans(): Promise<ExecutionPlan[]> {
    return await db.select().from(executionPlans).orderBy(desc(executionPlans.createdAt));
  }

  async getExecutionPlansByEvent(eventId: string): Promise<ExecutionPlan[]> {
    return await db.select().from(executionPlans)
      .where(eq(executionPlans.eventId, eventId))
      .orderBy(desc(executionPlans.createdAt));
  }

  async getExecutionPlan(id: string): Promise<ExecutionPlan | undefined> {
    const [plan] = await db.select().from(executionPlans).where(eq(executionPlans.id, id));
    return plan || undefined;
  }

  async createExecutionPlan(plan: InsertExecutionPlan): Promise<ExecutionPlan> {
    const [created] = await db.insert(executionPlans).values(plan).returning();
    return created;
  }

  async updateExecutionPlan(id: string, plan: Partial<InsertExecutionPlan>): Promise<ExecutionPlan | undefined> {
    const [updated] = await db.update(executionPlans)
      .set({ ...plan, updatedAt: new Date() })
      .where(eq(executionPlans.id, id))
      .returning();
    return updated;
  }

  async deleteExecutionPlan(id: string): Promise<void> {
    // Delete all related items first to avoid foreign key constraint errors
    await Promise.all([
      db.delete(executionPlanChecklist).where(eq(executionPlanChecklist.planId, id)),
      db.delete(executionPlanItems).where(eq(executionPlanItems.planId, id)),
      db.delete(executionPlanActivities).where(eq(executionPlanActivities.planId, id)),
      db.delete(executionPlanManpower).where(eq(executionPlanManpower.planId, id)),
      db.delete(executionPlanGodownItems).where(eq(executionPlanGodownItems.planId, id)),
      db.delete(executionPlanRentals).where(eq(executionPlanRentals.planId, id)),
      db.delete(executionPlanPurchases).where(eq(executionPlanPurchases.planId, id)),
      db.delete(executionPlanPrints).where(eq(executionPlanPrints.planId, id)),
    ]);
    // Now delete the plan itself
    await db.delete(executionPlans).where(eq(executionPlans.id, id));
  }

  // Checklist Items
  async getExecutionPlanChecklist(planId: string): Promise<ExecutionPlanChecklist[]> {
    return await db.select().from(executionPlanChecklist)
      .where(eq(executionPlanChecklist.planId, planId))
      .orderBy(executionPlanChecklist.sortOrder);
  }

  async createExecutionPlanChecklistItem(item: InsertExecutionPlanChecklist): Promise<ExecutionPlanChecklist> {
    const [created] = await db.insert(executionPlanChecklist).values(item).returning();
    return created;
  }

  async updateExecutionPlanChecklistItem(id: string, item: Partial<InsertExecutionPlanChecklist>): Promise<ExecutionPlanChecklist | undefined> {
    const [updated] = await db.update(executionPlanChecklist)
      .set(item)
      .where(eq(executionPlanChecklist.id, id))
      .returning();
    return updated;
  }

  async deleteExecutionPlanChecklistItem(id: string): Promise<void> {
    await db.delete(executionPlanChecklist).where(eq(executionPlanChecklist.id, id));
  }

  async bulkCreateChecklistItems(items: InsertExecutionPlanChecklist[]): Promise<ExecutionPlanChecklist[]> {
    if (items.length === 0) return [];
    return await db.insert(executionPlanChecklist).values(items).returning();
  }

  // Item List
  async getExecutionPlanItems(planId: string): Promise<ExecutionPlanItem[]> {
    return await db.select().from(executionPlanItems)
      .where(eq(executionPlanItems.planId, planId))
      .orderBy(executionPlanItems.sortOrder);
  }

  async createExecutionPlanItem(item: InsertExecutionPlanItem): Promise<ExecutionPlanItem> {
    const [created] = await db.insert(executionPlanItems).values(item).returning();
    return created;
  }

  async updateExecutionPlanItem(id: string, item: Partial<InsertExecutionPlanItem>): Promise<ExecutionPlanItem | undefined> {
    const [updated] = await db.update(executionPlanItems)
      .set(item)
      .where(eq(executionPlanItems.id, id))
      .returning();
    return updated;
  }

  async deleteExecutionPlanItem(id: string): Promise<void> {
    await db.delete(executionPlanItems).where(eq(executionPlanItems.id, id));
  }

  // Activities (Production Plan)
  async getExecutionPlanActivities(planId: string): Promise<ExecutionPlanActivity[]> {
    return await db.select().from(executionPlanActivities)
      .where(eq(executionPlanActivities.planId, planId))
      .orderBy(executionPlanActivities.sortOrder);
  }

  async createExecutionPlanActivity(activity: InsertExecutionPlanActivity): Promise<ExecutionPlanActivity> {
    const [created] = await db.insert(executionPlanActivities).values(activity).returning();
    return created;
  }

  async updateExecutionPlanActivity(id: string, activity: Partial<InsertExecutionPlanActivity>): Promise<ExecutionPlanActivity | undefined> {
    const [updated] = await db.update(executionPlanActivities)
      .set(activity)
      .where(eq(executionPlanActivities.id, id))
      .returning();
    return updated;
  }

  async deleteExecutionPlanActivity(id: string): Promise<void> {
    await db.delete(executionPlanActivities).where(eq(executionPlanActivities.id, id));
  }

  // Manpower
  async getExecutionPlanManpower(planId: string): Promise<ExecutionPlanManpower[]> {
    return await db.select().from(executionPlanManpower)
      .where(eq(executionPlanManpower.planId, planId))
      .orderBy(executionPlanManpower.sortOrder);
  }

  async createExecutionPlanManpowerItem(item: InsertExecutionPlanManpower): Promise<ExecutionPlanManpower> {
    const [created] = await db.insert(executionPlanManpower).values(item).returning();
    return created;
  }

  async updateExecutionPlanManpowerItem(id: string, item: Partial<InsertExecutionPlanManpower>): Promise<ExecutionPlanManpower | undefined> {
    const [updated] = await db.update(executionPlanManpower)
      .set(item)
      .where(eq(executionPlanManpower.id, id))
      .returning();
    return updated;
  }

  async deleteExecutionPlanManpowerItem(id: string): Promise<void> {
    await db.delete(executionPlanManpower).where(eq(executionPlanManpower.id, id));
  }

  // Godown Items
  async getExecutionPlanGodownItems(planId: string): Promise<ExecutionPlanGodownItem[]> {
    return await db.select().from(executionPlanGodownItems)
      .where(eq(executionPlanGodownItems.planId, planId))
      .orderBy(executionPlanGodownItems.sortOrder);
  }

  async createExecutionPlanGodownItem(item: InsertExecutionPlanGodownItem): Promise<ExecutionPlanGodownItem> {
    const [created] = await db.insert(executionPlanGodownItems).values(item).returning();
    return created;
  }

  async updateExecutionPlanGodownItem(id: string, item: Partial<InsertExecutionPlanGodownItem>): Promise<ExecutionPlanGodownItem | undefined> {
    const [updated] = await db.update(executionPlanGodownItems)
      .set(item)
      .where(eq(executionPlanGodownItems.id, id))
      .returning();
    return updated;
  }

  async deleteExecutionPlanGodownItem(id: string): Promise<void> {
    await db.delete(executionPlanGodownItems).where(eq(executionPlanGodownItems.id, id));
  }

  // Rentals
  async getExecutionPlanRentals(planId: string): Promise<ExecutionPlanRental[]> {
    return await db.select().from(executionPlanRentals)
      .where(eq(executionPlanRentals.planId, planId))
      .orderBy(executionPlanRentals.sortOrder);
  }

  async createExecutionPlanRental(rental: InsertExecutionPlanRental): Promise<ExecutionPlanRental> {
    const [created] = await db.insert(executionPlanRentals).values(rental).returning();
    return created;
  }

  async updateExecutionPlanRental(id: string, rental: Partial<InsertExecutionPlanRental>): Promise<ExecutionPlanRental | undefined> {
    const [updated] = await db.update(executionPlanRentals)
      .set(rental)
      .where(eq(executionPlanRentals.id, id))
      .returning();
    return updated;
  }

  async deleteExecutionPlanRental(id: string): Promise<void> {
    await db.delete(executionPlanRentals).where(eq(executionPlanRentals.id, id));
  }

  // Purchases
  async getExecutionPlanPurchases(planId: string): Promise<ExecutionPlanPurchase[]> {
    return await db.select().from(executionPlanPurchases)
      .where(eq(executionPlanPurchases.planId, planId))
      .orderBy(executionPlanPurchases.sortOrder);
  }

  async createExecutionPlanPurchase(purchase: InsertExecutionPlanPurchase): Promise<ExecutionPlanPurchase> {
    const [created] = await db.insert(executionPlanPurchases).values(purchase).returning();
    return created;
  }

  async updateExecutionPlanPurchase(id: string, purchase: Partial<InsertExecutionPlanPurchase>): Promise<ExecutionPlanPurchase | undefined> {
    const [updated] = await db.update(executionPlanPurchases)
      .set(purchase)
      .where(eq(executionPlanPurchases.id, id))
      .returning();
    return updated;
  }

  async deleteExecutionPlanPurchase(id: string): Promise<void> {
    await db.delete(executionPlanPurchases).where(eq(executionPlanPurchases.id, id));
  }

  // Prints
  async getExecutionPlanPrints(planId: string): Promise<ExecutionPlanPrint[]> {
    return await db.select().from(executionPlanPrints)
      .where(eq(executionPlanPrints.planId, planId))
      .orderBy(executionPlanPrints.sortOrder);
  }

  async createExecutionPlanPrint(print: InsertExecutionPlanPrint): Promise<ExecutionPlanPrint> {
    const [created] = await db.insert(executionPlanPrints).values(print).returning();
    return created;
  }

  async updateExecutionPlanPrint(id: string, print: Partial<InsertExecutionPlanPrint>): Promise<ExecutionPlanPrint | undefined> {
    const [updated] = await db.update(executionPlanPrints)
      .set(print)
      .where(eq(executionPlanPrints.id, id))
      .returning();
    return updated;
  }

  async deleteExecutionPlanPrint(id: string): Promise<void> {
    await db.delete(executionPlanPrints).where(eq(executionPlanPrints.id, id));
  }

  // Get full execution plan with all sections
  async getFullExecutionPlan(planId: string): Promise<{
    plan: ExecutionPlan | undefined;
    checklist: ExecutionPlanChecklist[];
    items: ExecutionPlanItem[];
    activities: ExecutionPlanActivity[];
    manpower: ExecutionPlanManpower[];
    godownItems: ExecutionPlanGodownItem[];
    rentals: ExecutionPlanRental[];
    purchases: ExecutionPlanPurchase[];
    prints: ExecutionPlanPrint[];
  }> {
    const [plan, checklist, items, activities, manpower, godownItems, rentals, purchases, prints] = await Promise.all([
      this.getExecutionPlan(planId),
      this.getExecutionPlanChecklist(planId),
      this.getExecutionPlanItems(planId),
      this.getExecutionPlanActivities(planId),
      this.getExecutionPlanManpower(planId),
      this.getExecutionPlanGodownItems(planId),
      this.getExecutionPlanRentals(planId),
      this.getExecutionPlanPurchases(planId),
      this.getExecutionPlanPrints(planId),
    ]);
    return { plan, checklist, items, activities, manpower, godownItems, rentals, purchases, prints };
  }

  // Checklist Templates
  async getChecklistTemplates(): Promise<ChecklistTemplate[]> {
    return await db.select().from(checklistTemplates).orderBy(desc(checklistTemplates.createdAt));
  }

  async getChecklistTemplate(id: string): Promise<ChecklistTemplate | undefined> {
    const [template] = await db.select().from(checklistTemplates).where(eq(checklistTemplates.id, id));
    return template;
  }

  async createChecklistTemplate(template: InsertChecklistTemplate): Promise<ChecklistTemplate> {
    const [created] = await db.insert(checklistTemplates).values(template).returning();
    return created;
  }

  async updateChecklistTemplate(id: string, template: Partial<InsertChecklistTemplate>): Promise<ChecklistTemplate | undefined> {
    const [updated] = await db.update(checklistTemplates)
      .set({ ...template, updatedAt: new Date() })
      .where(eq(checklistTemplates.id, id))
      .returning();
    return updated;
  }

  async deleteChecklistTemplate(id: string): Promise<void> {
    await db.delete(checklistTemplates).where(eq(checklistTemplates.id, id));
  }

  // Checklist Template Items
  async getChecklistTemplateItems(templateId: string): Promise<ChecklistTemplateItem[]> {
    return await db.select().from(checklistTemplateItems)
      .where(eq(checklistTemplateItems.templateId, templateId))
      .orderBy(checklistTemplateItems.sortOrder);
  }

  async createChecklistTemplateItem(item: InsertChecklistTemplateItem): Promise<ChecklistTemplateItem> {
    const [created] = await db.insert(checklistTemplateItems).values(item).returning();
    return created;
  }

  async updateChecklistTemplateItem(id: string, item: Partial<InsertChecklistTemplateItem>): Promise<ChecklistTemplateItem | undefined> {
    const [updated] = await db.update(checklistTemplateItems)
      .set(item)
      .where(eq(checklistTemplateItems.id, id))
      .returning();
    return updated;
  }

  async deleteChecklistTemplateItem(id: string): Promise<void> {
    await db.delete(checklistTemplateItems).where(eq(checklistTemplateItems.id, id));
  }

  async deleteAllChecklistTemplateItems(templateId: string): Promise<void> {
    await db.delete(checklistTemplateItems).where(eq(checklistTemplateItems.templateId, templateId));
  }

  async bulkCreateChecklistTemplateItems(items: InsertChecklistTemplateItem[]): Promise<ChecklistTemplateItem[]> {
    if (items.length === 0) return [];
    return await db.insert(checklistTemplateItems).values(items).returning();
  }

  async getChecklistTemplateWithItems(id: string): Promise<{ template: ChecklistTemplate | undefined; items: ChecklistTemplateItem[] }> {
    const [template, items] = await Promise.all([
      this.getChecklistTemplate(id),
      this.getChecklistTemplateItems(id)
    ]);
    return { template, items };
  }

  // Oak Creative - Presentations
  async getAllPresentations(): Promise<Presentation[]> {
    return await db.select().from(presentations).orderBy(desc(presentations.createdAt));
  }

  async getPresentationsByUser(userId: string): Promise<Presentation[]> {
    return await db.select().from(presentations)
      .where(eq(presentations.createdBy, userId))
      .orderBy(desc(presentations.createdAt));
  }

  async getPresentation(id: string): Promise<Presentation | undefined> {
    const [presentation] = await db.select().from(presentations).where(eq(presentations.id, id));
    return presentation;
  }

  async createPresentation(presentation: InsertPresentation): Promise<Presentation> {
    const [created] = await db.insert(presentations).values(presentation).returning();
    return created;
  }

  async updatePresentation(id: string, presentation: Partial<InsertPresentation>): Promise<Presentation | undefined> {
    const [updated] = await db.update(presentations)
      .set({ ...presentation, updatedAt: new Date() })
      .where(eq(presentations.id, id))
      .returning();
    return updated;
  }

  async deletePresentation(id: string): Promise<void> {
    await db.delete(presentations).where(eq(presentations.id, id));
  }

  // Oak Creative - Presentation Slides
  async getPresentationSlides(presentationId: string): Promise<PresentationSlide[]> {
    return await db.select().from(presentationSlides)
      .where(eq(presentationSlides.presentationId, presentationId))
      .orderBy(presentationSlides.sortOrder);
  }

  async getPresentationSlide(id: string): Promise<PresentationSlide | undefined> {
    const [slide] = await db.select().from(presentationSlides).where(eq(presentationSlides.id, id));
    return slide;
  }

  async createPresentationSlide(slide: InsertPresentationSlide): Promise<PresentationSlide> {
    const [created] = await db.insert(presentationSlides).values(slide).returning();
    return created;
  }

  async updatePresentationSlide(id: string, slide: Partial<InsertPresentationSlide>): Promise<PresentationSlide | undefined> {
    const [updated] = await db.update(presentationSlides)
      .set(slide)
      .where(eq(presentationSlides.id, id))
      .returning();
    return updated;
  }

  async deletePresentationSlide(id: string): Promise<void> {
    await db.delete(presentationSlides).where(eq(presentationSlides.id, id));
  }

  async reorderPresentationSlides(presentationId: string, slideIds: string[]): Promise<void> {
    await db.transaction(async (tx) => {
      for (let i = 0; i < slideIds.length; i++) {
        await tx.update(presentationSlides)
          .set({ sortOrder: i })
          .where(and(eq(presentationSlides.id, slideIds[i]), eq(presentationSlides.presentationId, presentationId)));
      }
    });
  }

  // Oak Creative - Slide Images
  async getSlideImages(slideId: string): Promise<SlideImage[]> {
    return await db.select().from(slideImages)
      .where(eq(slideImages.slideId, slideId))
      .orderBy(slideImages.sortOrder);
  }

  async createSlideImage(image: InsertSlideImage): Promise<SlideImage> {
    const [created] = await db.insert(slideImages).values(image).returning();
    return created;
  }

  async updateSlideImage(id: string, image: Partial<InsertSlideImage>): Promise<SlideImage | undefined> {
    const [updated] = await db.update(slideImages)
      .set(image)
      .where(eq(slideImages.id, id))
      .returning();
    return updated;
  }

  async deleteSlideImage(id: string): Promise<void> {
    await db.delete(slideImages).where(eq(slideImages.id, id));
  }

  // Oak Creative - Presentation Assets
  async getAllPresentationAssets(): Promise<PresentationAsset[]> {
    return await db.select().from(presentationAssets).orderBy(presentationAssets.category);
  }

  async getPresentationAssetsByCategory(category: string): Promise<PresentationAsset[]> {
    return await db.select().from(presentationAssets)
      .where(eq(presentationAssets.category, category))
      .orderBy(presentationAssets.name);
  }

  async createPresentationAsset(asset: InsertPresentationAsset): Promise<PresentationAsset> {
    const [created] = await db.insert(presentationAssets).values(asset).returning();
    return created;
  }

  async deletePresentationAsset(id: string): Promise<void> {
    await db.delete(presentationAssets).where(eq(presentationAssets.id, id));
  }

  // Notifications
  async getAllNotifications(): Promise<Notification[]> {
    return await db.select().from(notifications).orderBy(desc(notifications.createdAt));
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [created] = await db.insert(notifications).values(notification).returning();
    return created;
  }

  async deleteNotification(id: string): Promise<void> {
    await db.delete(notifications).where(eq(notifications.id, id));
  }

  async getUserNotifications(userId: string): Promise<(Notification & { readAt: Date | null })[]> {
    const results = await db
      .select({
        id: notifications.id,
        title: notifications.title,
        message: notifications.message,
        type: notifications.type,
        actionUrl: notifications.actionUrl,
        audienceType: notifications.audienceType,
        audienceRoles: notifications.audienceRoles,
        audienceUserIds: notifications.audienceUserIds,
        createdBy: notifications.createdBy,
        createdAt: notifications.createdAt,
        readAt: notificationRecipients.readAt,
      })
      .from(notificationRecipients)
      .innerJoin(notifications, eq(notificationRecipients.notificationId, notifications.id))
      .where(eq(notificationRecipients.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
    return results;
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notificationRecipients)
      .where(and(
        eq(notificationRecipients.userId, userId),
        sql`${notificationRecipients.readAt} IS NULL`
      ));
    return result[0]?.count || 0;
  }

  async markNotificationAsRead(notificationId: string, userId: string): Promise<void> {
    await db
      .update(notificationRecipients)
      .set({ readAt: new Date() })
      .where(and(
        eq(notificationRecipients.notificationId, notificationId),
        eq(notificationRecipients.userId, userId)
      ));
  }

  async createNotificationRecipients(notificationId: string, userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;
    const recipients = userIds.map(userId => ({
      notificationId,
      userId,
    }));
    await db.insert(notificationRecipients).values(recipients);
  }

  // Push Subscriptions
  async getPushSubscription(userId: string, endpoint: string): Promise<PushSubscription | undefined> {
    const [sub] = await db.select().from(pushSubscriptions)
      .where(and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.endpoint, endpoint)
      ));
    return sub;
  }

  async getPushSubscriptionsByUser(userId: string): Promise<PushSubscription[]> {
    return await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  }

  async getAllPushSubscriptions(): Promise<PushSubscription[]> {
    return await db.select().from(pushSubscriptions);
  }

  async createPushSubscription(subscription: InsertPushSubscription): Promise<PushSubscription> {
    const [created] = await db.insert(pushSubscriptions).values(subscription).returning();
    return created;
  }

  async deletePushSubscription(id: string): Promise<void> {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, id));
  }

  async deletePushSubscriptionByEndpoint(endpoint: string): Promise<void> {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  }
}

export const storage = new DatabaseStorage();

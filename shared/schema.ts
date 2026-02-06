import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, date, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCompanySchema = createInsertSchema(companies).omit({ id: true, createdAt: true });
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;

// Subscriptions for SaaS billing
export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  razorpaySubscriptionId: text("razorpay_subscription_id"),
  razorpayOrderId: text("razorpay_order_id"),
  razorpayPaymentId: text("razorpay_payment_id"),
  razorpayCustomerId: text("razorpay_customer_id"),
  planName: text("plan_name").notNull().default('basic'), // 'basic' | 'pro' | 'enterprise'
  amountPaid: integer("amount_paid"),
  status: text("status").notNull().default('pending'), // 'pending' | 'active' | 'cancelled' | 'failed' | 'expired'
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  lastPaymentDate: timestamp("last_payment_date"),
  nextPaymentDate: timestamp("next_payment_date"),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptions.$inferSelect;

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull(), // 'superadmin' | 'admin' | 'manager' | 'employee' | 'staff'
  companyId: varchar("company_id").references(() => companies.id),
  avatar: text("avatar"),
  createdVia: text("created_via").default('admin_panel'), // 'admin_panel' | 'employee_onboarding' | 'signup'
  passwordResetToken: text("password_reset_token"),
  passwordResetExpiry: timestamp("password_reset_expiry"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userPermissions = pgTable("user_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  pageId: text("page_id").notNull(), // e.g., 'dashboard', 'event-calendar', etc.
});

export const roles = pgTable("roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id),
  name: text("name").notNull(),
  label: text("label").notNull(),
  description: text("description"),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRoleSchema = createInsertSchema(roles).omit({ id: true, createdAt: true });
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type Role = typeof roles.$inferSelect;

// Leave Categories (Casual, Sick, etc.)
export const leaveCategories = pgTable("leave_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id),
  name: text("name").notNull(),
  description: text("description"),
  defaultAnnualAllowance: integer("default_annual_allowance").notNull().default(12),
  isSystem: boolean("is_system").notNull().default(false),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertLeaveCategorySchema = createInsertSchema(leaveCategories).omit({ id: true, createdAt: true });
export type InsertLeaveCategory = z.infer<typeof insertLeaveCategorySchema>;
export type LeaveCategory = typeof leaveCategories.$inferSelect;

export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id),
  eventCode: text("event_code").unique(), // EVT-E-YY-MM-XXX format, read-only after creation
  title: text("title").notNull(),
  date: date("date").notNull(),
  time: text("time"), // Event time e.g. "18:00"
  type: text("type").notNull(), // 'wedding' | 'corporate' | 'birthday' | 'other'
  planner: text("planner").notNull(),
  customer: text("customer").notNull(),
  venue: text("venue").notNull(),
  salesValue: decimal("sales_value", { precision: 12, scale: 2 }).notNull().default('0'),
  paymentReceived: decimal("payment_received", { precision: 12, scale: 2 }).notNull().default('0'),
  cost: decimal("cost", { precision: 12, scale: 2 }).notNull().default('0'),
  status: text("status").notNull().default('active'), // 'active' | 'completed' | 'confirmed' | 'cancelled'
  googleCalendarEventId: text("google_calendar_event_id"), // Google Calendar sync
  outlookCalendarEventId: text("outlook_calendar_event_id"), // Outlook Calendar sync
  payment60DayReminderSent: boolean("payment_60day_reminder_sent").default(false), // 60-day payment milestone reminder
  timelineCreated: boolean("timeline_created").default(false), // Auto-created event timeline
  productionContainerCreated: boolean("production_container_created").default(false), // Production container exists
  inventoryFinalized: boolean("inventory_finalized").default(false), // Warehouse has finalized sourcing
  createdAt: timestamp("created_at").defaultNow(),
});

export const eventProductionItems = pgTable("event_production_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: 'cascade' }),
  estimateId: varchar("estimate_id"), // Source estimate if pushed from quotation
  itemName: text("item_name").notNull(),
  quantity: integer("quantity").notNull().default(1),
  category: text("category"), // e.g., "Decor", "Furniture", "Lighting"
  specification: text("specification"), // Item details/notes
  fulfillmentType: text("fulfillment_type"), // 'warehouse' | 'purchase' | 'rent'
  status: text("status").notNull().default('draft'), // 'draft' | 'locked'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertEventProductionItemSchema = createInsertSchema(eventProductionItems).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEventProductionItem = z.infer<typeof insertEventProductionItemSchema>;
export type EventProductionItem = typeof eventProductionItems.$inferSelect;

export const automationLogs = pgTable("automation_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").references(() => events.id),
  actionType: text("action_type").notNull(), // 'timeline_init' | 'push_production' | 'finalize_inventory' | 'notification_sent'
  status: text("status").notNull().default('success'), // 'success' | 'failed'
  metadata: jsonb("metadata").$type<Record<string, any>>(), // Flexible payload for audit details
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAutomationLogSchema = createInsertSchema(automationLogs).omit({ id: true, createdAt: true });
export type InsertAutomationLog = z.infer<typeof insertAutomationLogSchema>;
export type AutomationLog = typeof automationLogs.$inferSelect;

export const notificationLogs = pgTable("notification_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").references(() => events.id),
  type: text("type").notNull(), // 'payment_60day' | 'payment_30day' | etc.
  recipientPhone: text("recipient_phone").notNull(),
  recipientName: text("recipient_name"),
  message: text("message").notNull(),
  status: text("status").notNull().default('sent'), // 'sent' | 'delivered' | 'failed'
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNotificationLogSchema = createInsertSchema(notificationLogs).omit({ id: true, createdAt: true });
export type InsertNotificationLog = z.infer<typeof insertNotificationLogSchema>;
export type NotificationLog = typeof notificationLogs.$inferSelect;

export const meetings = pgTable("meetings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id),
  title: text("title").notNull(),
  date: date("date").notNull(),
  time: text("time").notNull(),
  attendees: text("attendees"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const employees = pgTable("employees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id),
  name: text("name").notNull(),
  employeeId: text("employee_id").notNull().unique(),
  userId: varchar("user_id").references(() => users.id),
  managerUserId: varchar("manager_user_id").references(() => users.id),
  photoUrl: text("photo_url"),
  dateOfBirth: date("date_of_birth"),
  joinDate: date("join_date").notNull(),
  contractRenewalDate: date("contract_renewal_date"),
  designation: text("designation").notNull(),
  department: text("department"),
  salary: decimal("salary", { precision: 10, scale: 2 }).notNull(),
  address: text("address").notNull(),
  emergencyContact: text("emergency_contact").notNull(),
  phone: text("phone"),
  whatsappNumber: text("whatsapp_number"),
  email: text("email"),
  bankAccountNumber: text("bank_account_number"),
  bankIfscCode: text("bank_ifsc_code"),
  panNumber: text("pan_number"),
  totalLeavesPerYear: integer("total_leaves_per_year").default(24),
  leaveDate: date("leave_date"),
  isActive: boolean("is_active").default(true).notNull(),
  duties: text("duties"),
  responsibilities: text("responsibilities"),
  whatsappOptIn: boolean("whatsapp_opt_in").default(false),
  whatsappLastOptInAt: timestamp("whatsapp_last_opt_in_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const daybookEntries = pgTable("daybook_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id),
  date: date("date").notNull(),
  description: text("description"),
  type: text("type").notNull(), // 'income' | 'expense'
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  category: text("category").notNull(),
  bankId: varchar("bank_id"),
  eventId: varchar("event_id").references(() => events.id), // Links to event for P&L tracking
  eventName: text("event_name"), // Legacy/display field
  vendorId: varchar("vendor_id").references(() => vendors.id), // Links to vendor
  vendorName: text("vendor_name"), // Legacy/display field
  createdAt: timestamp("created_at").defaultNow(),
});

// Daybook Categories - Custom categories for income/expense
export const daybookCategories = pgTable("daybook_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'income' | 'expense'
  isSystem: boolean("is_system").notNull().default(false), // System categories can't be deleted
  createdAt: timestamp("created_at").defaultNow(),
});

export const banks = pgTable("banks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id),
  name: text("name").notNull(),
  openingBalance: decimal("opening_balance", { precision: 12, scale: 2 }).notNull().default('0'),
  balance: decimal("balance", { precision: 12, scale: 2 }).notNull().default('0'),
  createdAt: timestamp("created_at").defaultNow(),
});

export const bankTransfers = pgTable("bank_transfers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id),
  date: date("date").notNull(),
  fromBankId: varchar("from_bank_id").notNull(),
  toBankId: varchar("to_bank_id").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const leaveRequests = pgTable("leave_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: 'cascade' }),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  leaveType: text("leave_type").default('casual'), // Legacy field for backwards compatibility
  categoryId: varchar("category_id").references(() => leaveCategories.id), // New category reference
  reason: text("reason"),
  status: text("status").notNull().default('pending'),
  managerId: varchar("manager_id").references(() => users.id),
  managerComments: text("manager_comments"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const eventMilestones = pgTable("event_milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: 'cascade' }),
  phase: integer("phase").notNull(), // 1-7
  phaseName: text("phase_name").notNull(),
  name: text("name").notNull(),
  date: date("date").notNull(),
  time: text("time"),
  status: text("status").notNull().default('pending'), // 'pending' | 'completed'
  createdAt: timestamp("created_at").defaultNow(),
});

// Customers
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id),
  customerCode: text("customer_code").unique(), // CUST-YY-XXXX format, read-only after creation
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  gstNumber: text("gst_number"),
  billingAddress: text("billing_address"),
  state: text("state"),
  country: text("country").default('India'),
  company: text("company").default('default'), // Company/brand for multi-brand support
  leadId: varchar("lead_id"), // Reference to sales deal (lead)
  weddingPlannerId: varchar("wedding_planner_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Vendors
export const vendors = pgTable("vendors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  gstNumber: text("gst_number"),
  category: text("category"), // 'catering' | 'decoration' | 'photography' | 'venue' | 'other'
  billingAddress: text("billing_address"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Customer Creation Logs - tracks when accountant creates customer from lead
export const customerCreationLogs = pgTable("customer_creation_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  leadId: varchar("lead_id").notNull(), // Reference to sales deal
  accountantId: varchar("accountant_id").notNull().references(() => users.id),
  status: text("status").notNull().default('created'), // 'created' | 'failed'
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Enhanced line item type for estimates and invoices (supports section headings)
export const lineItemSchema = z.object({
  slNo: z.number().optional(),
  name: z.string(),
  description: z.string().optional(),
  hsnSac: z.string().optional(), // HSN/SAC code for tax documents
  quantity: z.number(),
  rate: z.number(),
  taxRate: z.number().optional().default(0),
  cgstPercent: z.number().optional().default(0), // CGST percentage for tax documents
  cgstAmount: z.number().optional().default(0), // CGST amount
  sgstPercent: z.number().optional().default(0), // SGST percentage for tax documents  
  sgstAmount: z.number().optional().default(0), // SGST amount
  total: z.number(),
  isHeading: z.boolean().optional().default(false), // For section headers like "DAY 1: MEHANDI"
});

export type LineItem = z.infer<typeof lineItemSchema>;

// Estimates
export const estimates = pgTable("estimates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id),
  number: text("number").notNull().unique(), // QT-000968 or EST-001
  customerId: varchar("customer_id").references(() => customers.id),
  eventId: varchar("event_id").references(() => events.id),
  date: date("date").notNull(),
  dueDate: date("due_date"),
  status: text("status").notNull().default('draft'), // 'draft' | 'sent' | 'accepted' | 'declined' | 'converted'
  // Tax document fields
  isTaxDocument: boolean("is_tax_document").notNull().default(false), // Tax or Non-Tax estimate
  placeOfSupply: text("place_of_supply"), // State for GST (e.g., "Kerala (32)")
  cgstTotal: decimal("cgst_total", { precision: 12, scale: 2 }).default('0'), // Total CGST amount
  sgstTotal: decimal("sgst_total", { precision: 12, scale: 2 }).default('0'), // Total SGST amount
  // Enhanced fields
  subject: text("subject"), // Event description like "Welcome party, Sangeet & Wedding on 14&15th Dec 2025"
  weddingPlannerName: text("wedding_planner_name"), // Wedding planner name on top
  customerAddress: text("customer_address"), // Full billing address block
  // Line items with section headings support
  lineItems: jsonb("line_items").$type<LineItem[]>().notNull().default([]),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull().default('0'),
  // Discount
  discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }).default('0'),
  discountAmount: decimal("discount_amount", { precision: 12, scale: 2 }).default('0'),
  // Service charge with percentage
  serviceChargePercent: decimal("service_charge_percent", { precision: 5, scale: 2 }).default('0'),
  serviceChargeAmount: decimal("service_charge_amount", { precision: 12, scale: 2 }).default('0'),
  taxTotal: decimal("tax_total", { precision: 12, scale: 2 }).notNull().default('0'),
  total: decimal("total", { precision: 12, scale: 2 }).notNull().default('0'),
  totalInWords: text("total_in_words"), // "Indian Rupee Nine Lakh Four Thousand..."
  notes: text("notes"),
  terms: text("terms"),
  thankYouMessage: text("thank_you_message"), // Thank you message
  signature: text("signature"), // Signature image URL or base64
  createdAt: timestamp("created_at").defaultNow(),
});

// Invoices
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id),
  number: text("number").notNull().unique(), // INV-001
  customerId: varchar("customer_id").references(() => customers.id),
  eventId: varchar("event_id").references(() => events.id),
  estimateId: varchar("estimate_id").references(() => estimates.id),
  date: date("date").notNull(),
  dueDate: date("due_date"),
  status: text("status").notNull().default('draft'), // 'draft' | 'sent' | 'partial' | 'paid' | 'overdue'
  // Tax document fields
  isTaxDocument: boolean("is_tax_document").notNull().default(false), // Tax or Non-Tax invoice
  placeOfSupply: text("place_of_supply"), // State for GST (e.g., "Kerala (32)")
  cgstTotal: decimal("cgst_total", { precision: 12, scale: 2 }).default('0'), // Total CGST amount
  sgstTotal: decimal("sgst_total", { precision: 12, scale: 2 }).default('0'), // Total SGST amount
  // Enhanced fields (same as estimates)
  subject: text("subject"),
  weddingPlannerName: text("wedding_planner_name"),
  customerAddress: text("customer_address"),
  lineItems: jsonb("line_items").$type<LineItem[]>().notNull().default([]),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull().default('0'),
  discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }).default('0'),
  discountAmount: decimal("discount_amount", { precision: 12, scale: 2 }).default('0'),
  serviceChargePercent: decimal("service_charge_percent", { precision: 5, scale: 2 }).default('0'),
  serviceChargeAmount: decimal("service_charge_amount", { precision: 12, scale: 2 }).default('0'),
  taxTotal: decimal("tax_total", { precision: 12, scale: 2 }).notNull().default('0'),
  total: decimal("total", { precision: 12, scale: 2 }).notNull().default('0'),
  totalInWords: text("total_in_words"),
  balanceDue: decimal("balance_due", { precision: 12, scale: 2 }).notNull().default('0'),
  notes: text("notes"),
  terms: text("terms"),
  thankYouMessage: text("thank_you_message"),
  signature: text("signature"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Customer Payments (Payment Receipts)
export const customerPayments = pgTable("customer_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  number: text("number").notNull().unique(), // REC-001
  customerId: varchar("customer_id").references(() => customers.id),
  invoiceId: varchar("invoice_id").references(() => invoices.id),
  eventId: varchar("event_id").references(() => events.id),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  date: date("date").notNull(),
  paymentMode: text("payment_mode").notNull(), // 'cash' | 'bank_transfer' | 'cheque' | 'upi' | 'card'
  bankId: varchar("bank_id").references(() => banks.id),
  reference: text("reference"),
  notes: text("notes"),
  daybookEntryId: varchar("daybook_entry_id").references(() => daybookEntries.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Expenses
export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id),
  number: text("number").notNull().unique(), // EXP-001
  vendorId: varchar("vendor_id").references(() => vendors.id),
  eventId: varchar("event_id").references(() => events.id),
  category: text("category").notNull(), // 'catering' | 'decoration' | 'photography' | 'venue' | 'travel' | 'salary' | 'other'
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }).notNull().default('0'),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  date: date("date").notNull(),
  status: text("status").notNull().default('recorded'), // 'recorded' | 'paid'
  bankId: varchar("bank_id").references(() => banks.id),
  daybookEntryId: varchar("daybook_entry_id").references(() => daybookEntries.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Vendor Payments
export const vendorPayments = pgTable("vendor_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id),
  number: text("number").notNull().unique(), // VPY-001
  vendorId: varchar("vendor_id").references(() => vendors.id),
  expenseId: varchar("expense_id").references(() => expenses.id),
  eventId: varchar("event_id").references(() => events.id),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  date: date("date").notNull(),
  paymentMode: text("payment_mode").notNull(), // 'cash' | 'bank_transfer' | 'cheque' | 'upi' | 'card'
  bankId: varchar("bank_id").references(() => banks.id),
  reference: text("reference"),
  notes: text("notes"),
  daybookEntryId: varchar("daybook_entry_id").references(() => daybookEntries.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Items/Products (reusable products/services)
export const items = pgTable("items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull().default('service'), // 'service' | 'product'
  rate: decimal("rate", { precision: 12, scale: 2 }).notNull().default('0'),
  unit: text("unit").default('Nos'), // 'Nos', 'Hours', 'Days', etc.
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default('0'),
  hsnCode: text("hsn_code"), // HSN/SAC code for GST
  sku: text("sku"), // Stock Keeping Unit
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Bills (from vendors)
export const bills = pgTable("bills", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id),
  number: text("number").notNull().unique(), // BILL-001
  vendorId: varchar("vendor_id").references(() => vendors.id),
  vendorBillNumber: text("vendor_bill_number"), // Vendor's bill/invoice number
  eventId: varchar("event_id").references(() => events.id),
  date: date("date").notNull(),
  dueDate: date("due_date"),
  status: text("status").notNull().default('pending'), // 'pending' | 'partially_paid' | 'paid' | 'overdue'
  lineItems: jsonb("line_items").$type<LineItem[]>().notNull().default([]),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull().default('0'),
  taxTotal: decimal("tax_total", { precision: 12, scale: 2 }).notNull().default('0'),
  total: decimal("total", { precision: 12, scale: 2 }).notNull().default('0'),
  paidAmount: decimal("paid_amount", { precision: 12, scale: 2 }).notNull().default('0'),
  balanceDue: decimal("balance_due", { precision: 12, scale: 2 }).notNull().default('0'),
  notes: text("notes"),
  attachmentUrl: text("attachment_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Company Settings (for estimate/invoice header)
export const companySettings = pgTable("company_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id),
  companyName: text("company_name").notNull().default('Your Company Name'),
  address: text("address").default(''),
  phone: text("phone").default(''),
  email: text("email").default(''),
  website: text("website").default(''),
  logo: text("logo"),
  gstNumber: text("gst_number"),
  placeOfSupply: text("place_of_supply").default(''),
  panNumber: text("pan_number"),
  bankName: text("bank_name"),
  bankAccountNumber: text("bank_account_number"),
  bankIfscCode: text("bank_ifsc_code"),
  bankBranch: text("bank_branch"),
  defaultTerms: text("default_terms"),
  defaultThankYouMessage: text("default_thank_you_message").default('Looking forward to your business.'),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Document Number Sequences (for auto-numbering)
export const documentSequences = pgTable("document_sequences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id),
  documentType: text("document_type").notNull(), // 'estimate' | 'invoice' | 'receipt' | 'expense' | 'vendor_payment'
  prefix: text("prefix").notNull(), // 'QT-', 'INV-', 'REC-', etc.
  nextNumber: integer("next_number").notNull().default(1),
  paddingLength: integer("padding_length").notNull().default(6), // For QT-000001
});

// Estimate Templates (for sample templates)
export const estimateTemplates = pgTable("estimate_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id),
  name: text("name").notNull(),
  description: text("description"),
  lineItems: jsonb("line_items").$type<LineItem[]>().notNull().default([]),
  terms: text("terms"),
  thankYouMessage: text("thank_you_message"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Customer Portal - Shareable Links
export const portalLinks = pgTable("portal_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  token: varchar("token").notNull().unique(), // Unique shareable token
  customerId: varchar("customer_id").references(() => customers.id),
  documentType: text("document_type").notNull(), // 'estimate' | 'invoice' | 'payment_receipt'
  documentId: varchar("document_id").notNull(), // ID of the estimate, invoice, or payment
  expiresAt: timestamp("expires_at"), // Optional expiry date
  isActive: boolean("is_active").notNull().default(true),
  viewCount: integer("view_count").notNull().default(0),
  lastViewedAt: timestamp("last_viewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  permissions: many(userPermissions),
}));

export const userPermissionsRelations = relations(userPermissions, ({ one }) => ({
  user: one(users, {
    fields: [userPermissions.userId],
    references: [users.id],
  }),
}));

export const leaveRequestsRelations = relations(leaveRequests, ({ one }) => ({
  employee: one(employees, {
    fields: [leaveRequests.employeeId],
    references: [employees.id],
  }),
  manager: one(users, {
    fields: [leaveRequests.managerId],
    references: [users.id],
  }),
}));

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertUserPermissionSchema = createInsertSchema(userPermissions).omit({ id: true });
export const insertEventSchema = createInsertSchema(events).omit({ id: true, createdAt: true, eventCode: true, payment60DayReminderSent: true, timelineCreated: true, productionContainerCreated: true, inventoryFinalized: true });
export const insertMeetingSchema = createInsertSchema(meetings).omit({ id: true, createdAt: true });
export const insertEmployeeSchema = createInsertSchema(employees).omit({ id: true, createdAt: true });
export const insertDaybookEntrySchema = createInsertSchema(daybookEntries).omit({ id: true, createdAt: true });
export const insertDaybookCategorySchema = createInsertSchema(daybookCategories).omit({ id: true, createdAt: true });
export const insertBankSchema = createInsertSchema(banks).omit({ id: true, createdAt: true });
export const insertBankTransferSchema = createInsertSchema(bankTransfers).omit({ id: true, createdAt: true });
export const insertLeaveRequestSchema = createInsertSchema(leaveRequests).omit({ id: true, createdAt: true });
export const insertEventMilestoneSchema = createInsertSchema(eventMilestones).omit({ id: true, createdAt: true });

// Insert Schemas
export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, createdAt: true, customerCode: true });
export const insertVendorSchema = createInsertSchema(vendors).omit({ id: true, createdAt: true });
export const insertCustomerCreationLogSchema = createInsertSchema(customerCreationLogs).omit({ id: true, createdAt: true });
export const insertEstimateSchema = createInsertSchema(estimates).omit({ id: true, createdAt: true }).extend({
  lineItems: z.array(lineItemSchema).optional().default([]),
});
export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true }).extend({
  lineItems: z.array(lineItemSchema).optional().default([]),
});
export const insertCustomerPaymentSchema = createInsertSchema(customerPayments).omit({ id: true, createdAt: true, daybookEntryId: true });
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true, createdAt: true, daybookEntryId: true });
export const insertVendorPaymentSchema = createInsertSchema(vendorPayments).omit({ id: true, createdAt: true, daybookEntryId: true });
export const insertItemSchema = createInsertSchema(items).omit({ id: true, createdAt: true });
export const insertBillSchema = createInsertSchema(bills).omit({ id: true, createdAt: true }).extend({
  lineItems: z.array(lineItemSchema).optional().default([]),
});
export const insertCompanySettingsSchema = createInsertSchema(companySettings).omit({ id: true, updatedAt: true });
export const insertDocumentSequenceSchema = createInsertSchema(documentSequences).omit({ id: true });
export const insertEstimateTemplateSchema = createInsertSchema(estimateTemplates).omit({ id: true, createdAt: true }).extend({
  lineItems: z.array(lineItemSchema).optional().default([]),
});
export const insertPortalLinkSchema = createInsertSchema(portalLinks).omit({ id: true, createdAt: true, viewCount: true, lastViewedAt: true });

// Payroll Tables
export const payrollRuns = pgTable("payroll_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id),
  month: integer("month").notNull(), // 1-12
  year: integer("year").notNull(),
  status: text("status").notNull().default('draft'), // 'draft' | 'paid'
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull().default('0'),
  payDate: date("pay_date"),
  bankId: varchar("bank_id").references(() => banks.id),
  daybookEntryId: varchar("daybook_entry_id").references(() => daybookEntries.id),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const payrollItems = pgTable("payroll_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  payrollRunId: varchar("payroll_run_id").notNull().references(() => payrollRuns.id, { onDelete: 'cascade' }),
  employeeId: varchar("employee_id").notNull().references(() => employees.id),
  employeeName: text("employee_name").notNull(), // Snapshot of name at time of payroll
  monthlySalary: decimal("monthly_salary", { precision: 10, scale: 2 }).notNull(), // Snapshot of salary
  daysWorked: integer("days_worked").notNull().default(30),
  lossOfPayDays: integer("loss_of_pay_days").notNull().default(0), // Days absent beyond allowed leaves
  salaryAdvance: decimal("salary_advance", { precision: 10, scale: 2 }).default('0'), // Advance deduction
  dailyRate: decimal("daily_rate", { precision: 10, scale: 2 }).notNull(),
  grossPay: decimal("gross_pay", { precision: 10, scale: 2 }).notNull(),
  deductions: decimal("deductions", { precision: 10, scale: 2 }).default('0'),
  netPay: decimal("net_pay", { precision: 10, scale: 2 }).notNull(),
  isPaid: boolean("is_paid").default(false),
  paidAt: timestamp("paid_at"),
  paidBankId: varchar("paid_bank_id"),
  daybookEntryId: varchar("daybook_entry_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPayrollRunSchema = createInsertSchema(payrollRuns).omit({ id: true, createdAt: true, daybookEntryId: true });
export const insertPayrollItemSchema = createInsertSchema(payrollItems).omit({ id: true, createdAt: true });

// Salary Slips - Auto-generated from payroll
export const salarySlips = pgTable("salary_slips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  payrollRunId: varchar("payroll_run_id").notNull().references(() => payrollRuns.id, { onDelete: 'cascade' }),
  payrollItemId: varchar("payroll_item_id").notNull().references(() => payrollItems.id, { onDelete: 'cascade' }),
  employeeId: varchar("employee_id").notNull().references(() => employees.id),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  employeeName: text("employee_name").notNull(),
  designation: text("designation"),
  department: text("department"),
  panNumber: text("pan_number"),
  location: text("location").default('KOCHI'),
  joinDate: date("join_date"),
  totalDays: integer("total_days").notNull().default(31),
  daysPresent: integer("days_present").notNull(),
  daysPaid: integer("days_paid").notNull(),
  basicPay: decimal("basic_pay", { precision: 10, scale: 2 }).notNull(),
  basicDa: decimal("basic_da", { precision: 10, scale: 2 }).notNull(),
  hra: decimal("hra", { precision: 10, scale: 2 }).default('0'),
  otherAllowances: decimal("other_allowances", { precision: 10, scale: 2 }).default('0'),
  transportationAllowance: decimal("transportation_allowance", { precision: 10, scale: 2 }).default('0'),
  totalEarnings: decimal("total_earnings", { precision: 10, scale: 2 }).notNull(),
  professionalTax: decimal("professional_tax", { precision: 10, scale: 2 }).default('0'),
  lossOfPay: decimal("loss_of_pay", { precision: 10, scale: 2 }).default('0'),
  salaryAdvance: decimal("salary_advance", { precision: 10, scale: 2 }).default('0'),
  transportDeduction: decimal("transport_deduction", { precision: 10, scale: 2 }).default('0'),
  totalDeductions: decimal("total_deductions", { precision: 10, scale: 2 }).notNull(),
  netPayment: decimal("net_payment", { precision: 10, scale: 2 }).notNull(),
  amountInWords: text("amount_in_words"),
  sentViaWhatsapp: boolean("sent_via_whatsapp").default(false),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSalarySlipSchema = createInsertSchema(salarySlips).omit({ id: true, createdAt: true });

// Sales CRM

// Sales Pipelines (e.g., "Bookings FY26-27", "Wedding Planning")
export const salesPipelines = pgTable("sales_pipelines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id),
  name: text("name").notNull(),
  description: text("description"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Pipeline Stages (e.g., "Lead", "Proposal", "Negotiation", "Closed Won", "Closed Lost")
export const salesStages = pgTable("sales_stages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pipelineId: varchar("pipeline_id").notNull().references(() => salesPipelines.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  order: integer("order").notNull(),
  color: text("color").default('#6B7280'),
  probability: integer("probability").default(0), // Win probability percentage
  createdAt: timestamp("created_at").defaultNow(),
});

// CRM Contacts
export const salesContacts = pgTable("sales_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  email: text("email"),
  phone: text("phone"),
  mobile: text("mobile"),
  salesCompanyId: varchar("sales_company_id"),
  title: text("title"),
  source: text("source"), // "Website", "Referral", "Social Media", etc.
  notes: text("notes"),
  ownerId: varchar("owner_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// CRM Companies/Accounts
export const salesCompanies = pgTable("sales_companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id),
  name: text("name").notNull(),
  industry: text("industry"),
  website: text("website"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  country: text("country"),
  notes: text("notes"),
  ownerId: varchar("owner_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Deals/Opportunities
export const salesDeals = pgTable("sales_deals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  pipelineId: varchar("pipeline_id").notNull().references(() => salesPipelines.id),
  stageId: varchar("stage_id").notNull().references(() => salesStages.id),
  value: decimal("value", { precision: 12, scale: 2 }).default('0'),
  currency: text("currency").default('INR'),
  contactId: varchar("contact_id").references(() => salesContacts.id),
  companyId: varchar("company_id").references(() => salesCompanies.id),
  ownerId: varchar("owner_id").references(() => users.id),
  expectedCloseDate: date("expected_close_date"),
  actualCloseDate: date("actual_close_date"),
  status: text("status").default('open'), // 'open', 'won', 'lost'
  probability: integer("probability"),
  source: text("source"),
  notes: text("notes"),
  eventType: text("event_type"), // 'wedding', 'corporate', 'birthday', 'other'
  eventDate: date("event_date"),
  venue: text("venue"),
  advancePaymentReceived: boolean("advance_payment_received").default(false),
  advancePaymentDate: timestamp("advance_payment_date"),
  convertedToCustomer: boolean("converted_to_customer").default(false),
  customerId: varchar("customer_id").references(() => customers.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Activities (Tasks, Calls, Events/Meetings)
export const salesActivities = pgTable("sales_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // 'task', 'call', 'meeting'
  subject: text("subject").notNull(),
  description: text("description"),
  dueDate: date("due_date"),
  dueTime: text("due_time"),
  status: text("status").default('pending'), // 'pending', 'completed', 'cancelled'
  priority: text("priority").default('medium'), // 'low', 'medium', 'high'
  dealId: varchar("deal_id").references(() => salesDeals.id, { onDelete: 'cascade' }),
  contactId: varchar("contact_id").references(() => salesContacts.id),
  companyId: varchar("company_id").references(() => salesCompanies.id),
  ownerId: varchar("owner_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Sales Targets for Wedding Planners
export const salesTargets = pgTable("sales_targets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  fiscalYear: text("fiscal_year").notNull(), // e.g., "FY2025-26"
  month: text("month"), // Optional: for monthly targets
  targetAmount: decimal("target_amount", { precision: 12, scale: 2 }).notNull(),
  targetDeals: integer("target_deals"), // Number of deals target
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Sales Automations
export const salesAutomations = pgTable("sales_automations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  triggerType: text("trigger_type").notNull(), // 'deal_created', 'stage_changed', 'deal_won', 'deal_lost'
  triggerConditions: jsonb("trigger_conditions"),
  actionType: text("action_type").notNull(), // 'create_task', 'send_notification', 'update_field'
  actionConfig: jsonb("action_config"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas for Oak Sales
export const insertSalesPipelineSchema = createInsertSchema(salesPipelines).omit({ id: true, createdAt: true });
export const insertSalesStageSchema = createInsertSchema(salesStages).omit({ id: true, createdAt: true });
export const insertSalesContactSchema = createInsertSchema(salesContacts).omit({ id: true, createdAt: true });
export const insertSalesCompanySchema = createInsertSchema(salesCompanies).omit({ id: true, createdAt: true });
export const insertSalesDealSchema = createInsertSchema(salesDeals).omit({ id: true, createdAt: true });
export const insertSalesActivitySchema = createInsertSchema(salesActivities).omit({ id: true, createdAt: true });
export const insertSalesTargetSchema = createInsertSchema(salesTargets).omit({ id: true, createdAt: true });
export const insertSalesAutomationSchema = createInsertSchema(salesAutomations).omit({ id: true, createdAt: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type UserPermission = typeof userPermissions.$inferSelect;
export type InsertUserPermission = z.infer<typeof insertUserPermissionSchema>;

export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;

export type Meeting = typeof meetings.$inferSelect;
export type InsertMeeting = z.infer<typeof insertMeetingSchema>;

export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;

export type DaybookEntry = typeof daybookEntries.$inferSelect;
export type InsertDaybookEntry = z.infer<typeof insertDaybookEntrySchema>;

export type DaybookCategory = typeof daybookCategories.$inferSelect;
export type InsertDaybookCategory = z.infer<typeof insertDaybookCategorySchema>;

export type Bank = typeof banks.$inferSelect;
export type InsertBank = z.infer<typeof insertBankSchema>;

export type BankTransfer = typeof bankTransfers.$inferSelect;
export type InsertBankTransfer = z.infer<typeof insertBankTransferSchema>;

export type LeaveRequest = typeof leaveRequests.$inferSelect;
export type InsertLeaveRequest = z.infer<typeof insertLeaveRequestSchema>;

export type EventMilestone = typeof eventMilestones.$inferSelect;
export type InsertEventMilestone = z.infer<typeof insertEventMilestoneSchema>;

// Types
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;

export type Vendor = typeof vendors.$inferSelect;
export type InsertVendor = z.infer<typeof insertVendorSchema>;

export type CustomerCreationLog = typeof customerCreationLogs.$inferSelect;
export type InsertCustomerCreationLog = z.infer<typeof insertCustomerCreationLogSchema>;

export type Estimate = typeof estimates.$inferSelect;
export type InsertEstimate = z.infer<typeof insertEstimateSchema>;

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;

export type CustomerPayment = typeof customerPayments.$inferSelect;
export type InsertCustomerPayment = z.infer<typeof insertCustomerPaymentSchema>;

export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;

export type VendorPayment = typeof vendorPayments.$inferSelect;
export type InsertVendorPayment = z.infer<typeof insertVendorPaymentSchema>;

export type Item = typeof items.$inferSelect;
export type InsertItem = z.infer<typeof insertItemSchema>;

export type Bill = typeof bills.$inferSelect;
export type InsertBill = z.infer<typeof insertBillSchema>;

export type CompanySettings = typeof companySettings.$inferSelect;
export type InsertCompanySettings = z.infer<typeof insertCompanySettingsSchema>;

export type DocumentSequence = typeof documentSequences.$inferSelect;
export type InsertDocumentSequence = z.infer<typeof insertDocumentSequenceSchema>;

export type EstimateTemplate = typeof estimateTemplates.$inferSelect;
export type InsertEstimateTemplate = z.infer<typeof insertEstimateTemplateSchema>;

export type PortalLink = typeof portalLinks.$inferSelect;
export type InsertPortalLink = z.infer<typeof insertPortalLinkSchema>;

export type PayrollRun = typeof payrollRuns.$inferSelect;
export type InsertPayrollRun = z.infer<typeof insertPayrollRunSchema>;

export type PayrollItem = typeof payrollItems.$inferSelect;
export type InsertPayrollItem = z.infer<typeof insertPayrollItemSchema>;

export type SalarySlip = typeof salarySlips.$inferSelect;
export type InsertSalarySlip = z.infer<typeof insertSalarySlipSchema>;

// Sales Types
export type SalesPipeline = typeof salesPipelines.$inferSelect;
export type InsertSalesPipeline = z.infer<typeof insertSalesPipelineSchema>;

export type SalesStage = typeof salesStages.$inferSelect;
export type InsertSalesStage = z.infer<typeof insertSalesStageSchema>;

export type SalesContact = typeof salesContacts.$inferSelect;
export type InsertSalesContact = z.infer<typeof insertSalesContactSchema>;

export type SalesCompany = typeof salesCompanies.$inferSelect;
export type InsertSalesCompany = z.infer<typeof insertSalesCompanySchema>;

export type SalesDeal = typeof salesDeals.$inferSelect;
export type InsertSalesDeal = z.infer<typeof insertSalesDealSchema>;

export type SalesActivity = typeof salesActivities.$inferSelect;
export type InsertSalesActivity = z.infer<typeof insertSalesActivitySchema>;

export type SalesTarget = typeof salesTargets.$inferSelect;
export type InsertSalesTarget = z.infer<typeof insertSalesTargetSchema>;

export type SalesAutomation = typeof salesAutomations.$inferSelect;
export type InsertSalesAutomation = z.infer<typeof insertSalesAutomationSchema>;

// =====================
// OAK INVENTORY TABLES
// =====================

// Inventory Items - Full inventory with photos, descriptions, costing
export const inventoryItems = pgTable("inventory_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  sku: text("sku").unique(),
  unitCost: decimal("unit_cost", { precision: 12, scale: 2 }).notNull().default('0'),
  stockQuantity: integer("stock_quantity").notNull().default(0),
  minStockLevel: integer("min_stock_level").default(0),
  location: text("location"),
  photos: text("photos").array(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertInventoryItemSchema = createInsertSchema(inventoryItems).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;
export type InventoryItem = typeof inventoryItems.$inferSelect;

// Inventory Transactions - Detailed entry logs for stock movements
export const inventoryTransactions = pgTable("inventory_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  itemId: varchar("item_id").notNull().references(() => inventoryItems.id, { onDelete: 'cascade' }),
  type: text("type").notNull(), // 'in' | 'out' | 'adjustment' | 'damage' | 'return'
  quantity: integer("quantity").notNull(),
  previousStock: integer("previous_stock").notNull(),
  newStock: integer("new_stock").notNull(),
  eventId: varchar("event_id").references(() => events.id),
  notes: text("notes"),
  performedBy: varchar("performed_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertInventoryTransactionSchema = createInsertSchema(inventoryTransactions).omit({ id: true, createdAt: true });
export type InsertInventoryTransaction = z.infer<typeof insertInventoryTransactionSchema>;
export type InventoryTransaction = typeof inventoryTransactions.$inferSelect;

// Event Inventory Sessions - Track material outflow & inflow per event
export const eventInventorySessions = pgTable("event_inventory_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: 'cascade' }),
  status: text("status").notNull().default('draft'), // 'draft' | 'issued' | 'partial_return' | 'completed'
  issuedAt: timestamp("issued_at"),
  returnedAt: timestamp("returned_at"),
  issuedBy: varchar("issued_by").references(() => users.id),
  receivedBy: varchar("received_by").references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEventInventorySessionSchema = createInsertSchema(eventInventorySessions).omit({ id: true, createdAt: true });
export type InsertEventInventorySession = z.infer<typeof insertEventInventorySessionSchema>;
export type EventInventorySession = typeof eventInventorySessions.$inferSelect;

// Event Inventory Items - Items within a session
export const eventInventoryItems = pgTable("event_inventory_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => eventInventorySessions.id, { onDelete: 'cascade' }),
  itemId: varchar("item_id").notNull().references(() => inventoryItems.id),
  quantityIssued: integer("quantity_issued").notNull().default(0),
  quantityReturned: integer("quantity_returned").notNull().default(0),
  quantityDamaged: integer("quantity_damaged").notNull().default(0),
  quantityLost: integer("quantity_lost").notNull().default(0),
  damageNotes: text("damage_notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEventInventoryItemSchema = createInsertSchema(eventInventoryItems).omit({ id: true, createdAt: true });
export type InsertEventInventoryItem = z.infer<typeof insertEventInventoryItemSchema>;
export type EventInventoryItem = typeof eventInventoryItems.$inferSelect;

// Rental Records - Items from external rental shops
export const rentalRecords = pgTable("rental_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id),
  vendorId: varchar("vendor_id").references(() => vendors.id),
  eventId: varchar("event_id").references(() => events.id),
  rentalDate: date("rental_date").notNull(),
  expectedReturnDate: date("expected_return_date"),
  actualReturnDate: date("actual_return_date"),
  status: text("status").notNull().default('active'), // 'active' | 'returned' | 'partial' | 'overdue'
  totalCost: decimal("total_cost", { precision: 12, scale: 2 }).default('0'),
  depositPaid: decimal("deposit_paid", { precision: 12, scale: 2 }).default('0'),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRentalRecordSchema = createInsertSchema(rentalRecords).omit({ id: true, createdAt: true });
export type InsertRentalRecord = z.infer<typeof insertRentalRecordSchema>;
export type RentalRecord = typeof rentalRecords.$inferSelect;

// Rental Items - Individual items in a rental
export const rentalItems = pgTable("rental_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  rentalId: varchar("rental_id").notNull().references(() => rentalRecords.id, { onDelete: 'cascade' }),
  itemName: text("item_name").notNull(),
  quantity: integer("quantity").notNull().default(1),
  quantityReturned: integer("quantity_returned").notNull().default(0),
  unitRate: decimal("unit_rate", { precision: 12, scale: 2 }).default('0'),
  photos: text("photos").array(),
  condition: text("condition"),
  returnCondition: text("return_condition"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRentalItemSchema = createInsertSchema(rentalItems).omit({ id: true, createdAt: true });
export type InsertRentalItem = z.infer<typeof insertRentalItemSchema>;
export type RentalItem = typeof rentalItems.$inferSelect;

// Inventory Templates - Pre-defined bundles for event types
export const inventoryTemplates = pgTable("inventory_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id),
  name: text("name").notNull(),
  eventType: text("event_type").notNull(), // e.g., 'Hindu Wedding Stage Décor'
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertInventoryTemplateSchema = createInsertSchema(inventoryTemplates).omit({ id: true, createdAt: true });
export type InsertInventoryTemplate = z.infer<typeof insertInventoryTemplateSchema>;
export type InventoryTemplate = typeof inventoryTemplates.$inferSelect;

// Inventory Template Items - Items in a template bundle
export const inventoryTemplateItems = pgTable("inventory_template_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull().references(() => inventoryTemplates.id, { onDelete: 'cascade' }),
  itemId: varchar("item_id").references(() => inventoryItems.id),
  itemName: text("item_name").notNull(),
  quantity: integer("quantity").notNull().default(1),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertInventoryTemplateItemSchema = createInsertSchema(inventoryTemplateItems).omit({ id: true, createdAt: true });
export type InsertInventoryTemplateItem = z.infer<typeof insertInventoryTemplateItemSchema>;
export type InventoryTemplateItem = typeof inventoryTemplateItems.$inferSelect;

// Purchase Orders - Orders to vendors
export const purchaseOrders = pgTable("purchase_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  poNumber: text("po_number").notNull().unique(),
  vendorId: varchar("vendor_id").references(() => vendors.id),
  eventId: varchar("event_id").references(() => events.id),
  status: text("status").notNull().default('draft'), // 'draft' | 'sent' | 'confirmed' | 'received' | 'cancelled'
  orderDate: date("order_date").notNull(),
  expectedDelivery: date("expected_delivery"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).default('0'),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrders).omit({ id: true, createdAt: true });
export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;

// Purchase Order Items
export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  poId: varchar("po_id").notNull().references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  itemId: varchar("item_id").references(() => inventoryItems.id),
  itemName: text("item_name").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).default('0'),
  totalPrice: decimal("total_price", { precision: 12, scale: 2 }).default('0'),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPurchaseOrderItemSchema = createInsertSchema(purchaseOrderItems).omit({ id: true, createdAt: true });
export type InsertPurchaseOrderItem = z.infer<typeof insertPurchaseOrderItemSchema>;
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;

// Production Plans - Event production schedule
export const productionPlans = pgTable("production_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").references(() => events.id),
  name: text("name").notNull(),
  status: text("status").notNull().default('draft'), // 'draft' | 'active' | 'completed'
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertProductionPlanSchema = createInsertSchema(productionPlans).omit({ id: true, createdAt: true });
export type InsertProductionPlan = z.infer<typeof insertProductionPlanSchema>;
export type ProductionPlan = typeof productionPlans.$inferSelect;

// Production Tasks - Individual tasks in a production plan
export const productionTasks = pgTable("production_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planId: varchar("plan_id").notNull().references(() => productionPlans.id, { onDelete: 'cascade' }),
  activity: text("activity").notNull(),
  taskDate: text("task_date"), // Date for the task (YYYY-MM-DD format)
  startTime: text("start_time"),
  endTime: text("end_time"),
  vendorId: varchar("vendor_id").references(() => vendors.id),
  vendorName: text("vendor_name"), // Local vendor name (not linked to global vendors)
  responsiblePersonId: varchar("responsible_person_id").references(() => users.id),
  responsiblePersonName: text("responsible_person_name"),
  status: text("status").notNull().default('pending'), // 'pending' | 'in_progress' | 'completed'
  notes: text("notes"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertProductionTaskSchema = createInsertSchema(productionTasks).omit({ id: true, createdAt: true });
export type InsertProductionTask = z.infer<typeof insertProductionTaskSchema>;
export type ProductionTask = typeof productionTasks.$inferSelect;

// Production Décor Items - Pastel cards for each décor area (Stage, Entrance Arch, etc.)
export const productionDecorImports = pgTable("production_decor_imports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").references(() => events.id),
  sourceType: text("source_type").notNull(), // 'estimate', 'invoice'
  sourceId: varchar("source_id"), // Links to estimates/invoices if available
  filename: text("filename").notNull(),
  status: text("status").notNull().default('pending'), // 'pending', 'processing', 'completed', 'failed'
  itemsCreated: integer("items_created").default(0),
  elementsCreated: integer("elements_created").default(0),
  errorLog: jsonb("error_log"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertProductionDecorImportSchema = createInsertSchema(productionDecorImports).omit({ id: true, createdAt: true });
export type InsertProductionDecorImport = z.infer<typeof insertProductionDecorImportSchema>;
export type ProductionDecorImport = typeof productionDecorImports.$inferSelect;

export const productionDecorItems = pgTable("production_decor_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").references(() => events.id),
  eventName: text("event_name"),
  eventDate: date("event_date"),
  venue: text("venue"),
  decorType: text("decor_type").notNull(), // 'Stage', 'Entrance Arch', 'Backdrop', 'Photo Booth', etc.
  setupDate: date("setup_date"),
  setupTime: text("setup_time"),
  endTime: text("end_time"), // End time for scheduled activities
  estimatedDuration: text("estimated_duration"), // e.g., '4 hours', '2 days'
  priority: text("priority").default('medium'), // 'low', 'medium', 'high', 'urgent'
  manpowerRequired: integer("manpower_required").default(0),
  teamLead: text("team_lead"),
  status: text("status").notNull().default('pending'), // 'pending', 'in_progress', 'completed', 'on_hold'
  pastelColor: text("pastel_color").default('blue'), // For UI card background
  notes: text("notes"),
  importBatchId: varchar("import_batch_id").references(() => productionDecorImports.id, { onDelete: 'cascade' }),
  sectionLabel: text("section_label"), // Original section label from imported document
  sequence: integer("sequence").default(0), // Order within import batch
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertProductionDecorItemSchema = createInsertSchema(productionDecorItems).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProductionDecorItem = z.infer<typeof insertProductionDecorItemSchema>;
export type ProductionDecorItem = typeof productionDecorItems.$inferSelect;

// Production Décor Elements - Items within a décor item (e.g., Rose Fresh Flowers – 100 bunches)
export const productionDecorElements = pgTable("production_decor_elements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  decorItemId: varchar("decor_item_id").notNull().references(() => productionDecorItems.id, { onDelete: 'cascade' }),
  elementName: text("element_name").notNull(), // e.g., 'Rose Fresh Flowers'
  categoryType: text("category_type"), // e.g., 'Flowers', 'Fabric', 'Props'
  quantity: integer("quantity").notNull().default(1),
  unit: text("unit").default('Nos'), // 'Nos', 'bunches', 'meters', 'pcs', etc.
  linkedInventoryItemId: varchar("linked_inventory_item_id").references(() => inventoryItems.id),
  externalItemName: text("external_item_name"), // For items not in inventory
  source: text("source").notNull().default('in_stock'), // 'in_stock', 'to_buy', 'to_rent'
  startTime: text("start_time"), // Start time for production task (e.g., '09:00')
  endTime: text("end_time"), // End time for production task (e.g., '17:00')
  responsible: text("responsible"), // Person responsible for this task
  assignedPersonVendor: text("assigned_person_vendor"), // Person or vendor name (legacy)
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertProductionDecorElementSchema = createInsertSchema(productionDecorElements).omit({ id: true, createdAt: true });
export type InsertProductionDecorElement = z.infer<typeof insertProductionDecorElementSchema>;
export type ProductionDecorElement = typeof productionDecorElements.$inferSelect;

// Employee Portal - Increments (Salary Increases)
export const employeeIncrements = pgTable("employee_increments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: 'cascade' }),
  effectiveDate: date("effective_date").notNull(),
  previousSalary: decimal("previous_salary", { precision: 10, scale: 2 }).notNull(),
  newSalary: decimal("new_salary", { precision: 10, scale: 2 }).notNull(),
  incrementAmount: decimal("increment_amount", { precision: 10, scale: 2 }).notNull(),
  incrementPercent: decimal("increment_percent", { precision: 5, scale: 2 }),
  reason: text("reason"), // 'annual', 'promotion', 'performance', 'adjustment'
  notes: text("notes"),
  approvedBy: varchar("approved_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEmployeeIncrementSchema = createInsertSchema(employeeIncrements).omit({ id: true, createdAt: true });
export type InsertEmployeeIncrement = z.infer<typeof insertEmployeeIncrementSchema>;
export type EmployeeIncrement = typeof employeeIncrements.$inferSelect;

// Employee Portal - Appraisals (Performance Reviews)
export const employeeAppraisals = pgTable("employee_appraisals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: 'cascade' }),
  reviewPeriodStart: date("review_period_start").notNull(),
  reviewPeriodEnd: date("review_period_end").notNull(),
  reviewDate: date("review_date").notNull(),
  rating: integer("rating"), // 1-5 scale
  ratingLabel: text("rating_label"), // 'Exceptional', 'Exceeds Expectations', 'Meets Expectations', etc.
  strengths: text("strengths"),
  areasOfImprovement: text("areas_of_improvement"),
  goals: text("goals"),
  managerComments: text("manager_comments"),
  employeeComments: text("employee_comments"),
  status: text("status").notNull().default('draft'), // 'draft', 'pending_review', 'completed'
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEmployeeAppraisalSchema = createInsertSchema(employeeAppraisals).omit({ id: true, createdAt: true });
export type InsertEmployeeAppraisal = z.infer<typeof insertEmployeeAppraisalSchema>;
export type EmployeeAppraisal = typeof employeeAppraisals.$inferSelect;

// Employee Portal - Salary Advance Requests
export const salaryAdvanceRequests = pgTable("salary_advance_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: 'cascade' }),
  requestDate: date("request_date").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  reason: text("reason"),
  repaymentMonths: integer("repayment_months").default(1), // Number of months to deduct from salary
  status: text("status").notNull().default('pending'), // 'pending', 'approved', 'rejected', 'paid', 'repaid'
  approvedAmount: decimal("approved_amount", { precision: 10, scale: 2 }),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedDate: date("approved_date"),
  paidDate: date("paid_date"),
  bankId: varchar("bank_id").references(() => banks.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSalaryAdvanceRequestSchema = createInsertSchema(salaryAdvanceRequests).omit({ id: true, createdAt: true });
export type InsertSalaryAdvanceRequest = z.infer<typeof insertSalaryAdvanceRequestSchema>;
export type SalaryAdvanceRequest = typeof salaryAdvanceRequests.$inferSelect;

// Employee Portal - Leave Balance (Per category, per year tracking)
export const employeeLeaveBalances = pgTable("employee_leave_balances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: 'cascade' }),
  fiscalYear: text("fiscal_year").notNull(), // e.g., "2025-2026"
  categoryId: varchar("category_id").references(() => leaveCategories.id, { onDelete: 'cascade' }),
  year: integer("year"), // Calendar year e.g., 2025
  allocated: integer("allocated").notNull().default(12), // Total allocated for this category
  used: integer("used").notNull().default(0),
  manuallyAdjusted: integer("manually_adjusted").notNull().default(0), // Superadmin adjustments
  carryForward: integer("carry_forward").default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEmployeeLeaveBalanceSchema = createInsertSchema(employeeLeaveBalances).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEmployeeLeaveBalance = z.infer<typeof insertEmployeeLeaveBalanceSchema>;
export type EmployeeLeaveBalance = typeof employeeLeaveBalances.$inferSelect;

// Leave Balance Adjustments (Audit log)
export const leaveBalanceAdjustments = pgTable("leave_balance_adjustments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: 'cascade' }),
  categoryId: varchar("category_id").notNull().references(() => leaveCategories.id, { onDelete: 'cascade' }),
  year: integer("year").notNull(),
  previousValue: integer("previous_value").notNull(),
  newValue: integer("new_value").notNull(),
  reason: text("reason"),
  adjustedBy: varchar("adjusted_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertLeaveBalanceAdjustmentSchema = createInsertSchema(leaveBalanceAdjustments).omit({ id: true, createdAt: true });
export type InsertLeaveBalanceAdjustment = z.infer<typeof insertLeaveBalanceAdjustmentSchema>;
export type LeaveBalanceAdjustment = typeof leaveBalanceAdjustments.$inferSelect;

// Employee Portal - Expense Reimbursement Requests
export const expenseReimbursements = pgTable("expense_reimbursements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: 'cascade' }),
  requestDate: date("request_date").notNull(),
  expenseDate: date("expense_date").notNull(),
  category: text("category").notNull(), // 'travel', 'food', 'accommodation', 'supplies', 'other'
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  voucherPath: text("voucher_path"), // File path for uploaded voucher/receipt
  status: text("status").notNull().default('pending'), // 'pending', 'approved', 'rejected', 'paid'
  approvedAmount: decimal("approved_amount", { precision: 10, scale: 2 }),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  managerComments: text("manager_comments"),
  paidDate: date("paid_date"),
  bankId: varchar("bank_id").references(() => banks.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertExpenseReimbursementSchema = createInsertSchema(expenseReimbursements).omit({ id: true, createdAt: true });
export type InsertExpenseReimbursement = z.infer<typeof insertExpenseReimbursementSchema>;
export type ExpenseReimbursement = typeof expenseReimbursements.$inferSelect;

// Public Holidays (Managed by Superadmin)
export const publicHolidays = pgTable("public_holidays", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id),
  date: date("date").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  isNational: boolean("is_national").default(true), // National vs regional holiday
  year: integer("year").notNull(),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPublicHolidaySchema = createInsertSchema(publicHolidays).omit({ id: true, createdAt: true });
export type InsertPublicHoliday = z.infer<typeof insertPublicHolidaySchema>;
export type PublicHoliday = typeof publicHolidays.$inferSelect;

// Employee Incentives/Bonuses
export const employeeIncentives = pgTable("employee_incentives", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: 'cascade' }),
  date: date("date").notNull(),
  type: text("type").notNull(), // 'bonus', 'performance', 'festival', 'retention', 'other'
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),
  fiscalYear: text("fiscal_year").notNull(), // '2024-25'
  month: text("month"), // 'April', 'May', etc
  status: text("status").notNull().default('pending'), // 'pending', 'approved', 'paid'
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  paidDate: date("paid_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEmployeeIncentiveSchema = createInsertSchema(employeeIncentives).omit({ id: true, createdAt: true });
export type InsertEmployeeIncentive = z.infer<typeof insertEmployeeIncentiveSchema>;
export type EmployeeIncentive = typeof employeeIncentives.$inferSelect;

// Event Transportation - Commercial transportation costs per event
export const eventTransportation = pgTable("event_transportation", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: 'cascade' }),
  subcontractorName: text("subcontractor_name"),
  date: date("date").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),
  status: text("status").notNull().default('pending'), // 'pending', 'approved', 'paid'
  submittedBy: varchar("submitted_by").references(() => users.id),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  paidDate: date("paid_date"),
  daybookEntryId: varchar("daybook_entry_id").references(() => daybookEntries.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEventTransportationSchema = createInsertSchema(eventTransportation).omit({ id: true, createdAt: true });
export type InsertEventTransportation = z.infer<typeof insertEventTransportationSchema>;
export type EventTransportation = typeof eventTransportation.$inferSelect;

// Event Manpower - Subcontractor manpower costs per event
export const eventManpower = pgTable("event_manpower", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: 'cascade' }),
  subcontractorName: text("subcontractor_name").notNull(),
  numberOfPersons: integer("number_of_persons").notNull(),
  date: date("date").notNull(),
  hoursWorked: decimal("hours_worked", { precision: 5, scale: 2 }).notNull(),
  ratePerHour: decimal("rate_per_hour", { precision: 10, scale: 2 }),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),
  status: text("status").notNull().default('pending'), // 'pending', 'approved', 'paid'
  submittedBy: varchar("submitted_by").references(() => users.id),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  paidDate: date("paid_date"),
  daybookEntryId: varchar("daybook_entry_id").references(() => daybookEntries.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEventManpowerSchema = createInsertSchema(eventManpower).omit({ id: true, createdAt: true });
export type InsertEventManpower = z.infer<typeof insertEventManpowerSchema>;
export type EventManpower = typeof eventManpower.$inferSelect;

// Event Staff Assignments - Staff assigned to events via Event Hub
export const eventStaffAssignments = pgTable("event_staff_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: 'cascade' }),
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: 'cascade' }),
  role: text("role").notNull(),
  reportingTime: text("reporting_time"),
  notes: text("notes"),
  notificationSent: boolean("notification_sent").default(false),
  notificationSentAt: timestamp("notification_sent_at"),
  assignedBy: varchar("assigned_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEventStaffAssignmentSchema = createInsertSchema(eventStaffAssignments).omit({ id: true, createdAt: true, notificationSent: true, notificationSentAt: true });
export type InsertEventStaffAssignment = z.infer<typeof insertEventStaffAssignmentSchema>;
export type EventStaffAssignment = typeof eventStaffAssignments.$inferSelect;

// Quick Entries - AI-processed payment screenshots from employees
export const quickEntries = pgTable("quick_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: 'cascade' }),
  source: text("source").notNull().default('upload'), // 'share' | 'upload'
  filePath: text("file_path").notNull(), // Path to uploaded screenshot
  amount: decimal("amount", { precision: 12, scale: 2 }),
  currency: text("currency").default('INR'),
  transactionDate: timestamp("transaction_date"),
  direction: text("direction"), // 'paid' | 'received'
  counterpartyName: text("counterparty_name"),
  counterpartyUpi: text("counterparty_upi"),
  transactionId: text("transaction_id"),
  confidence: decimal("confidence", { precision: 5, scale: 2 }), // AI confidence score 0-100
  rawExtraction: jsonb("raw_extraction"), // Full AI extraction response
  status: text("status").notNull().default('uploaded'), // 'uploaded' | 'processing' | 'awaiting_review' | 'approved' | 'rejected' | 'failed'
  eventId: varchar("event_id").references(() => events.id),
  categoryId: varchar("category_id"),
  bankId: varchar("bank_id").references(() => banks.id),
  notes: text("notes"),
  reviewerId: varchar("reviewer_id").references(() => users.id),
  reviewerNotes: text("reviewer_notes"),
  daybookEntryId: varchar("daybook_entry_id").references(() => daybookEntries.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertQuickEntrySchema = createInsertSchema(quickEntries).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQuickEntry = z.infer<typeof insertQuickEntrySchema>;
export type QuickEntry = typeof quickEntries.$inferSelect;

// AI Assistant - Chat conversations
export const oaksyConversations = pgTable("oaksy_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text("title"), // Auto-generated from first message
  department: text("department"), // 'sales', 'wedding_planning', 'operations', 'accounts', 'general'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertOaksyConversationSchema = createInsertSchema(oaksyConversations).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOaksyConversation = z.infer<typeof insertOaksyConversationSchema>;
export type OaksyConversation = typeof oaksyConversations.$inferSelect;

// AI Assistant - Chat messages
export const oaksyMessages = pgTable("oaksy_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => oaksyConversations.id, { onDelete: 'cascade' }),
  role: text("role").notNull(), // 'user' | 'assistant'
  content: text("content").notNull(),
  inputType: text("input_type").default('text'), // 'text' | 'voice'
  metadata: jsonb("metadata"), // Additional data like attached documents, generated files, etc.
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertOaksyMessageSchema = createInsertSchema(oaksyMessages).omit({ id: true, createdAt: true });
export type InsertOaksyMessage = z.infer<typeof insertOaksyMessageSchema>;
export type OaksyMessage = typeof oaksyMessages.$inferSelect;

// WhatsApp Message Templates
export const whatsappMessageTemplates = pgTable("whatsapp_message_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  body: text("body").notNull(),
  variables: text("variables").array(), // Placeholders like {{employee_name}}, {{event_name}}, etc.
  category: text("category").default('reminder'), // 'reminder', 'notification', 'announcement', 'custom'
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertWhatsappMessageTemplateSchema = createInsertSchema(whatsappMessageTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWhatsappMessageTemplate = z.infer<typeof insertWhatsappMessageTemplateSchema>;
export type WhatsappMessageTemplate = typeof whatsappMessageTemplates.$inferSelect;

// WhatsApp Message Jobs - Scheduled or immediate message requests
export const whatsappMessageJobs = pgTable("whatsapp_message_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").references(() => whatsappMessageTemplates.id),
  customMessage: text("custom_message"), // For custom messages not using a template
  targetMode: text("target_mode").notNull().default('selected'), // 'selected', 'department', 'all'
  targetEmployeeIds: text("target_employee_ids").array(), // Array of employee IDs
  targetDepartments: text("target_departments").array(), // Array of department names
  variableValues: jsonb("variable_values"), // Object mapping variable names to values
  scheduledFor: timestamp("scheduled_for"), // null means send immediately
  status: text("status").notNull().default('pending'), // 'pending', 'processing', 'completed', 'failed', 'cancelled'
  requestedBy: varchar("requested_by").references(() => users.id),
  requestedByOaksy: boolean("requested_by_oaksy").default(false),
  oaksyConversationId: varchar("oaksy_conversation_id").references(() => oaksyConversations.id),
  totalRecipients: integer("total_recipients").default(0),
  successCount: integer("success_count").default(0),
  failureCount: integer("failure_count").default(0),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  processedAt: timestamp("processed_at"),
});

export const insertWhatsappMessageJobSchema = createInsertSchema(whatsappMessageJobs).omit({ id: true, createdAt: true, processedAt: true });
export type InsertWhatsappMessageJob = z.infer<typeof insertWhatsappMessageJobSchema>;
export type WhatsappMessageJob = typeof whatsappMessageJobs.$inferSelect;

// WhatsApp Message Logs - Individual message delivery records
export const whatsappMessageLogs = pgTable("whatsapp_message_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => whatsappMessageJobs.id, { onDelete: 'cascade' }),
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: 'cascade' }),
  phoneNumber: text("phone_number").notNull(),
  messageContent: text("message_content").notNull(),
  status: text("status").notNull().default('pending'), // 'pending', 'sent', 'delivered', 'failed'
  providerMessageId: text("provider_message_id"), // Twilio message SID
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  failedAt: timestamp("failed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWhatsappMessageLogSchema = createInsertSchema(whatsappMessageLogs).omit({ id: true, createdAt: true });
export type InsertWhatsappMessageLog = z.infer<typeof insertWhatsappMessageLogSchema>;
export type WhatsappMessageLog = typeof whatsappMessageLogs.$inferSelect;

// ===========================
// EVENT EXECUTION PLAN TABLES
// ===========================

// Execution Plans - Main container linked to events
export const executionPlans = pgTable("execution_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").references(() => events.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default('draft'), // 'draft', 'active', 'completed'
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertExecutionPlanSchema = createInsertSchema(executionPlans).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertExecutionPlan = z.infer<typeof insertExecutionPlanSchema>;
export type ExecutionPlan = typeof executionPlans.$inferSelect;

// Execution Plan Checklist Items - Items needed with qty, vendor, check status
export const executionPlanChecklist = pgTable("execution_plan_checklist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planId: varchar("plan_id").notNull().references(() => executionPlans.id, { onDelete: 'cascade' }),
  slNo: integer("sl_no"),
  sectionLabel: text("section_label"), // Group label like "COMMON LIGHTING", "21st Nov - HALDI", etc.
  isSection: boolean("is_section").default(false), // True if this is a section header
  itemDescription: text("item_description").notNull(),
  quantity: integer("quantity").default(1),
  unit: text("unit").default('Nos'),
  vendorId: varchar("vendor_id").references(() => vendors.id),
  vendorName: text("vendor_name"),
  isChecked: boolean("is_checked").default(false),
  notes: text("notes"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertExecutionPlanChecklistSchema = createInsertSchema(executionPlanChecklist).omit({ id: true, createdAt: true });
export type InsertExecutionPlanChecklist = z.infer<typeof insertExecutionPlanChecklistSchema>;
export type ExecutionPlanChecklist = typeof executionPlanChecklist.$inferSelect;

// Execution Plan Item List - Detailed items organized by day
export const executionPlanItems = pgTable("execution_plan_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planId: varchar("plan_id").notNull().references(() => executionPlans.id, { onDelete: 'cascade' }),
  slNo: integer("sl_no"),
  dayLabel: text("day_label"), // "Day 1 : 29th November - Ring Exchange"
  sectionLabel: text("section_label"), // Sub-section like "SHADES, FURNITURES"
  isSection: boolean("is_section").default(false),
  itemDescription: text("item_description").notNull(),
  quantity: integer("quantity").default(1),
  unit: text("unit").default('Nos'),
  notes: text("notes"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertExecutionPlanItemSchema = createInsertSchema(executionPlanItems).omit({ id: true, createdAt: true });
export type InsertExecutionPlanItem = z.infer<typeof insertExecutionPlanItemSchema>;
export type ExecutionPlanItem = typeof executionPlanItems.$inferSelect;

// Execution Plan Activities - Production timeline with date, activity, times, responsible persons
export const executionPlanActivities = pgTable("execution_plan_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planId: varchar("plan_id").notNull().references(() => executionPlans.id, { onDelete: 'cascade' }),
  activityDate: date("activity_date"),
  dateLabel: text("date_label"), // "18 Nov, Tuesday"
  slNo: integer("sl_no"),
  activity: text("activity").notNull(),
  startTime: text("start_time"),
  endTime: text("end_time"),
  responsiblePersonId: varchar("responsible_person_id").references(() => users.id),
  responsiblePersonName: text("responsible_person_name"),
  status: text("status").notNull().default('pending'), // 'pending', 'in_progress', 'completed'
  notes: text("notes"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertExecutionPlanActivitySchema = createInsertSchema(executionPlanActivities).omit({ id: true, createdAt: true });
export type InsertExecutionPlanActivity = z.infer<typeof insertExecutionPlanActivitySchema>;
export type ExecutionPlanActivity = typeof executionPlanActivities.$inferSelect;

// Execution Plan Manpower - Staff assignments per activity/date
export const executionPlanManpower = pgTable("execution_plan_manpower", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planId: varchar("plan_id").notNull().references(() => executionPlans.id, { onDelete: 'cascade' }),
  activityDate: date("activity_date"),
  dateLabel: text("date_label"),
  slNo: integer("sl_no"),
  role: text("role").notNull(),
  personName: text("person_name"),
  personId: varchar("person_id").references(() => users.id),
  startTime: text("start_time"),
  endTime: text("end_time"),
  notes: text("notes"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertExecutionPlanManpowerSchema = createInsertSchema(executionPlanManpower).omit({ id: true, createdAt: true });
export type InsertExecutionPlanManpower = z.infer<typeof insertExecutionPlanManpowerSchema>;
export type ExecutionPlanManpower = typeof executionPlanManpower.$inferSelect;

// Execution Plan Godown Items - Warehouse items to be used
export const executionPlanGodownItems = pgTable("execution_plan_godown_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planId: varchar("plan_id").notNull().references(() => executionPlans.id, { onDelete: 'cascade' }),
  slNo: integer("sl_no"),
  itemDescription: text("item_description").notNull(),
  quantity: integer("quantity").default(1),
  unit: text("unit").default('Nos'),
  linkedInventoryItemId: varchar("linked_inventory_item_id").references(() => inventoryItems.id),
  issuedDate: date("issued_date"),
  returnedDate: date("returned_date"),
  notes: text("notes"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertExecutionPlanGodownItemSchema = createInsertSchema(executionPlanGodownItems).omit({ id: true, createdAt: true });
export type InsertExecutionPlanGodownItem = z.infer<typeof insertExecutionPlanGodownItemSchema>;
export type ExecutionPlanGodownItem = typeof executionPlanGodownItems.$inferSelect;

// Execution Plan Rentals - Rental items from vendors
export const executionPlanRentals = pgTable("execution_plan_rentals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planId: varchar("plan_id").notNull().references(() => executionPlans.id, { onDelete: 'cascade' }),
  slNo: integer("sl_no"),
  itemDescription: text("item_description").notNull(),
  quantity: integer("quantity").default(1),
  unit: text("unit").default('Nos'),
  vendorId: varchar("vendor_id").references(() => vendors.id),
  vendorName: text("vendor_name"),
  rentalDate: date("rental_date"),
  returnDate: date("return_date"),
  unitRate: decimal("unit_rate", { precision: 12, scale: 2 }),
  totalCost: decimal("total_cost", { precision: 12, scale: 2 }),
  status: text("status").default('pending'), // 'pending', 'rented', 'returned'
  notes: text("notes"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertExecutionPlanRentalSchema = createInsertSchema(executionPlanRentals).omit({ id: true, createdAt: true });
export type InsertExecutionPlanRental = z.infer<typeof insertExecutionPlanRentalSchema>;
export type ExecutionPlanRental = typeof executionPlanRentals.$inferSelect;

// Execution Plan Purchases - Items to buy
export const executionPlanPurchases = pgTable("execution_plan_purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planId: varchar("plan_id").notNull().references(() => executionPlans.id, { onDelete: 'cascade' }),
  slNo: integer("sl_no"),
  sectionLabel: text("section_label"), // "GODOWN", "MARKET", etc.
  itemDescription: text("item_description").notNull(),
  quantity: text("quantity"), // Can be "30 m", "1 packet", etc.
  unit: text("unit"),
  vendorId: varchar("vendor_id").references(() => vendors.id),
  vendorName: text("vendor_name"),
  estimatedCost: decimal("estimated_cost", { precision: 12, scale: 2 }),
  actualCost: decimal("actual_cost", { precision: 12, scale: 2 }),
  isPurchased: boolean("is_purchased").default(false),
  purchasedDate: date("purchased_date"),
  notes: text("notes"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertExecutionPlanPurchaseSchema = createInsertSchema(executionPlanPurchases).omit({ id: true, createdAt: true });
export type InsertExecutionPlanPurchase = z.infer<typeof insertExecutionPlanPurchaseSchema>;
export type ExecutionPlanPurchase = typeof executionPlanPurchases.$inferSelect;

// Execution Plan Prints - Print materials needed
export const executionPlanPrints = pgTable("execution_plan_prints", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planId: varchar("plan_id").notNull().references(() => executionPlans.id, { onDelete: 'cascade' }),
  slNo: integer("sl_no"),
  itemDescription: text("item_description").notNull(),
  size: text("size"), // "24x12ft", "5x2ft"
  quantity: integer("quantity").default(1),
  vendorId: varchar("vendor_id").references(() => vendors.id),
  vendorName: text("vendor_name"),
  estimatedCost: decimal("estimated_cost", { precision: 12, scale: 2 }),
  isPrinted: boolean("is_printed").default(false),
  printedDate: date("printed_date"),
  notes: text("notes"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertExecutionPlanPrintSchema = createInsertSchema(executionPlanPrints).omit({ id: true, createdAt: true });
export type InsertExecutionPlanPrint = z.infer<typeof insertExecutionPlanPrintSchema>;
export type ExecutionPlanPrint = typeof executionPlanPrints.$inferSelect;

// Checklist Templates - Reusable templates for production checklists
export const checklistTemplates = pgTable("checklist_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"), // Wedding, Corporate, Concert, etc.
  isDefault: boolean("is_default").default(false), // Default template shown first
  createdBy: varchar("created_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertChecklistTemplateSchema = createInsertSchema(checklistTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertChecklistTemplate = z.infer<typeof insertChecklistTemplateSchema>;
export type ChecklistTemplate = typeof checklistTemplates.$inferSelect;

// Checklist Template Items - Items within a template
export const checklistTemplateItems = pgTable("checklist_template_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull().references(() => checklistTemplates.id, { onDelete: 'cascade' }),
  slNo: integer("sl_no"),
  sectionLabel: text("section_label"),
  isSection: boolean("is_section").default(false),
  itemDescription: text("item_description").notNull(),
  quantity: integer("quantity").default(1),
  vendorName: text("vendor_name"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertChecklistTemplateItemSchema = createInsertSchema(checklistTemplateItems).omit({ id: true, createdAt: true });
export type InsertChecklistTemplateItem = z.infer<typeof insertChecklistTemplateItemSchema>;
export type ChecklistTemplateItem = typeof checklistTemplateItems.$inferSelect;

// Creative - Presentations
export const presentations = pgTable("presentations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id),
  title: text("title").notNull(),
  clientName: text("client_name"),
  eventId: varchar("event_id").references(() => events.id),
  theme: text("theme"), // e.g., "Kerala Traditional", "Royal Wedding"
  eventType: text("event_type"), // wedding, corporate, birthday
  status: text("status").default('draft'), // draft, completed, shared
  createdBy: varchar("created_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPresentationSchema = createInsertSchema(presentations).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPresentation = z.infer<typeof insertPresentationSchema>;
export type Presentation = typeof presentations.$inferSelect;

// Creative - Presentation Slides
export const presentationSlides = pgTable("presentation_slides", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  presentationId: varchar("presentation_id").notNull().references(() => presentations.id, { onDelete: 'cascade' }),
  slideType: text("slide_type").notNull(), // cover, category, contact
  title: text("title"),
  subtitle: text("subtitle"),
  category: text("category"), // Welcome Board, Entrance Arch, Mandap, etc.
  layout: text("layout").default('options-grid'), // options-grid, single-image, text-only
  sortOrder: integer("sort_order").default(0),
  content: jsonb("content"), // Flexible JSON for additional slide data
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPresentationSlideSchema = createInsertSchema(presentationSlides).omit({ id: true, createdAt: true });
export type InsertPresentationSlide = z.infer<typeof insertPresentationSlideSchema>;
export type PresentationSlide = typeof presentationSlides.$inferSelect;

// Creative - Slide Images/Options
export const slideImages = pgTable("slide_images", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slideId: varchar("slide_id").notNull().references(() => presentationSlides.id, { onDelete: 'cascade' }),
  imageUrl: text("image_url").notNull(),
  optionLabel: text("option_label"), // "Option 1", "Option 2", etc.
  caption: text("caption"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSlideImageSchema = createInsertSchema(slideImages).omit({ id: true, createdAt: true });
export type InsertSlideImage = z.infer<typeof insertSlideImageSchema>;
export type SlideImage = typeof slideImages.$inferSelect;

// Creative - Asset Library (reusable images for presentations)
export const presentationAssets = pgTable("presentation_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id),
  name: text("name").notNull(),
  category: text("category").notNull(), // Welcome Board, Mandap, Entrance Arch, etc.
  subcategory: text("subcategory"), // Kerala Traditional, Royal, Modern, etc.
  imageUrl: text("image_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  eventType: text("event_type"), // wedding, corporate, birthday
  tags: text("tags").array(),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPresentationAssetSchema = createInsertSchema(presentationAssets).omit({ id: true, createdAt: true });
export type InsertPresentationAsset = z.infer<typeof insertPresentationAssetSchema>;
export type PresentationAsset = typeof presentationAssets.$inferSelect;

// ============ Notifications System ============

// Notifications sent by superadmin
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull().default('info'), // info, warning, success, urgent
  actionUrl: text("action_url"), // Optional link to navigate to
  audienceType: text("audience_type").notNull().default('all'), // all, role, individual
  audienceRoles: text("audience_roles").array(), // For role-based targeting
  audienceUserIds: text("audience_user_ids").array(), // For individual targeting
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// Track which users have read which notifications
export const notificationRecipients = pgTable("notification_recipients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  notificationId: varchar("notification_id").notNull().references(() => notifications.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  readAt: timestamp("read_at"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNotificationRecipientSchema = createInsertSchema(notificationRecipients).omit({ id: true, createdAt: true });
export type InsertNotificationRecipient = z.infer<typeof insertNotificationRecipientSchema>;
export type NotificationRecipient = typeof notificationRecipients.$inferSelect;

// Push subscriptions for PWA users
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text("endpoint").notNull(),
  p256dhKey: text("p256dh_key").notNull(),
  authKey: text("auth_key").notNull(),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({ id: true, createdAt: true });
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;

// ============ Monthly Production Plan ============

// Monthly Production Plan entries for events
export const monthlyProductionPlan = pgTable("monthly_production_plan", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").references(() => events.id, { onDelete: 'cascade' }),
  month: integer("month").notNull(), // 1-12
  year: integer("year").notNull(),
  eventDate: date("event_date").notNull(),
  subEventName: text("sub_event_name").notNull(), // e.g., "Haldi", "Sangeeth", "Wedding"
  venue: text("venue"),
  weddingPlanner: text("wedding_planner"), // Wedding Planner name
  stageManager: text("stage_manager"), // Stage Manager/Event Coordinator
  teamLead: text("team_lead"),
  productionTeamCount: integer("production_team_count"),
  florist: text("florist"),
  loadingStartDateTime: text("loading_start_date_time"),
  productionStartTime: text("production_start_time"),
  productionEndTime: text("production_end_time"),
  dismantlingDateTime: text("dismantling_date_time"),
  dismantlingTeamLead: text("dismantling_team_lead"),
  groupLabel: text("group_label"), // Section header like "Dr.Sonia - KTDC Samudra - 15 & 16 Jan 2026"
  isComplete: boolean("is_complete").default(false),
  sortOrder: integer("sort_order").default(0),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertMonthlyProductionPlanSchema = createInsertSchema(monthlyProductionPlan).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMonthlyProductionPlan = z.infer<typeof insertMonthlyProductionPlanSchema>;
export type MonthlyProductionPlan = typeof monthlyProductionPlan.$inferSelect;

// ============ WhatsApp Two-Way Communication ============

// WhatsApp Conversations - tracks conversation state for each phone number
export const whatsappConversations = pgTable("whatsapp_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phoneNumber: text("phone_number").notNull(), // Normalized phone number
  employeeId: varchar("employee_id").references(() => employees.id, { onDelete: 'set null' }),
  currentState: text("current_state").notNull().default('idle'), // idle, menu, expense_purpose, expense_amount, expense_photo, leave_start, leave_end, leave_reason, awaiting_approval_response
  currentDepartment: text("current_department"), // accounts, hr
  activeIntent: text("active_intent"), // expense, leave, status, general - AI detected intent
  intentContext: jsonb("intent_context"), // Context for AI conversation (extracted amounts, dates, etc.)
  conversationHistory: jsonb("conversation_history"), // Recent messages for AI context
  pendingData: jsonb("pending_data"), // Temporary data being collected (purpose, amount, dates, etc.)
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWhatsappConversationSchema = createInsertSchema(whatsappConversations).omit({ id: true, createdAt: true });
export type InsertWhatsappConversation = z.infer<typeof insertWhatsappConversationSchema>;
export type WhatsappConversation = typeof whatsappConversations.$inferSelect;

// WhatsApp Pending Approvals - tracks approvals sent to superadmin via WhatsApp
export const whatsappPendingApprovals = pgTable("whatsapp_pending_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  approvalCode: text("approval_code").notNull().unique(), // Short code like "EXP001", "LV002" for easy reply
  type: text("type").notNull(), // expense, leave
  requestId: varchar("request_id").notNull(), // ID of the expense or leave request
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: 'cascade' }),
  employeeName: text("employee_name").notNull(),
  description: text("description").notNull(), // Summary of the request
  amount: decimal("amount", { precision: 10, scale: 2 }), // For expenses
  mediaUrl: text("media_url"), // URL of the invoice/receipt image
  status: text("status").notNull().default('pending'), // pending, approved, rejected
  approverPhone: text("approver_phone").notNull(), // Superadmin's WhatsApp number
  sentAt: timestamp("sent_at").defaultNow(),
  respondedAt: timestamp("responded_at"),
  responseMessage: text("response_message"), // Optional rejection reason
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWhatsappPendingApprovalSchema = createInsertSchema(whatsappPendingApprovals).omit({ id: true, createdAt: true });
export type InsertWhatsappPendingApproval = z.infer<typeof insertWhatsappPendingApprovalSchema>;
export type WhatsappPendingApproval = typeof whatsappPendingApprovals.$inferSelect;

// WhatsApp Inbound Messages - log of all incoming messages for audit
export const whatsappInboundMessages = pgTable("whatsapp_inbound_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: text("message_id").notNull(), // Twilio message SID
  fromNumber: text("from_number").notNull(),
  toNumber: text("to_number").notNull(),
  body: text("body"),
  mediaUrl: text("media_url"),
  mediaContentType: text("media_content_type"),
  conversationId: varchar("conversation_id").references(() => whatsappConversations.id),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWhatsappInboundMessageSchema = createInsertSchema(whatsappInboundMessages).omit({ id: true, createdAt: true });
export type InsertWhatsappInboundMessage = z.infer<typeof insertWhatsappInboundMessageSchema>;
export type WhatsappInboundMessage = typeof whatsappInboundMessages.$inferSelect;

// QR Payment Requests - Employee submits QR for payment, routed to superadmin
export const qrPaymentRequests = pgTable("qr_payment_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestCode: text("request_code").notNull().unique(), // Short code like "QR001" for tracking
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: 'cascade' }),
  employeeName: text("employee_name").notNull(),
  employeePhone: text("employee_phone").notNull(),
  category: text("category").notNull(), // 'food', 'travel', 'accommodation', 'supplies', 'other'
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  qrImageUrl: text("qr_image_url").notNull(), // URL of the QR code image from employee
  paymentScreenshotUrl: text("payment_screenshot_url"), // URL of payment confirmation from superadmin
  status: text("status").notNull().default('pending'), // 'pending', 'paid', 'rejected', 'recorded'
  eventId: varchar("event_id").references(() => events.id), // Assigned event for daybook
  eventName: text("event_name"), // Event name for display
  daybookEntryId: varchar("daybook_entry_id").references(() => daybookEntries.id), // Link to daybook entry
  superadminNotes: text("superadmin_notes"), // Notes from superadmin
  rejectionReason: text("rejection_reason"),
  paidAt: timestamp("paid_at"),
  recordedAt: timestamp("recorded_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertQrPaymentRequestSchema = createInsertSchema(qrPaymentRequests).omit({ id: true, createdAt: true });
export type InsertQrPaymentRequest = z.infer<typeof insertQrPaymentRequestSchema>;
export type QrPaymentRequest = typeof qrPaymentRequests.$inferSelect;

// Income Submissions - Employee submits payment received (with or without screenshot) for approval
export const incomeSubmissions = pgTable("income_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestCode: text("request_code").notNull().unique(), // Short code like "INC001"
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: 'cascade' }),
  employeeName: text("employee_name").notNull(),
  employeePhone: text("employee_phone").notNull(),
  type: text("type").notNull(), // 'client_payment' | 'bank_transfer'
  clientName: text("client_name"), // Client name for income
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  screenshotUrl: text("screenshot_url"), // URL of payment screenshot (optional)
  bankId: varchar("bank_id").references(() => banks.id), // Bank to deposit to
  bankName: text("bank_name"), // Bank name for display
  status: text("status").notNull().default('pending'), // 'pending', 'approved', 'rejected'
  eventId: varchar("event_id").references(() => events.id), // Assigned event for daybook
  eventName: text("event_name"), // Event name for display
  daybookEntryId: varchar("daybook_entry_id").references(() => daybookEntries.id),
  rejectionReason: text("rejection_reason"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertIncomeSubmissionSchema = createInsertSchema(incomeSubmissions).omit({ id: true, createdAt: true });
export type InsertIncomeSubmission = z.infer<typeof insertIncomeSubmissionSchema>;
export type IncomeSubmission = typeof incomeSubmissions.$inferSelect;

// Pending Vendor Payments - Employees submit pending vendor payments for tracking
export const pendingVendorPayments = pgTable("pending_vendor_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestCode: text("request_code").notNull().unique(), // Short code like "VP001"
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: 'cascade' }),
  employeeName: text("employee_name").notNull(),
  employeePhone: text("employee_phone").notNull(),
  vendorName: text("vendor_name").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  eventId: varchar("event_id").references(() => events.id),
  eventName: text("event_name"), // Event name for display
  description: text("description"), // Additional notes
  status: text("status").notNull().default('pending'), // 'pending', 'paid'
  daybookEntryId: varchar("daybook_entry_id").references(() => daybookEntries.id),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPendingVendorPaymentSchema = createInsertSchema(pendingVendorPayments).omit({ id: true, createdAt: true });
export type InsertPendingVendorPayment = z.infer<typeof insertPendingVendorPaymentSchema>;
export type PendingVendorPayment = typeof pendingVendorPayments.$inferSelect;

// Delivery Challans - For tracking goods delivery with challan documents
export const deliveryChallans = pgTable("delivery_challans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  challanNumber: text("challan_number").notNull().unique(), // DC-00033, etc.
  challanDate: date("challan_date").notNull(),
  challanType: text("challan_type").notNull().default('Job Work'), // Job Work, Supply, etc.
  vehicleNumber: text("vehicle_number"), // Vehicle number for delivery
  
  // Recipient/Delivery Address
  deliverTo: text("deliver_to").notNull(), // Recipient name/company
  deliveryAddress: text("delivery_address").notNull(),
  placeOfSupply: text("place_of_supply").default('Kerala (32)'),
  
  // Items as JSON array: [{description, hsnCode, quantity, unit, rate, amount}]
  items: jsonb("items").notNull().default([]),
  
  // Tax and totals
  subTotal: decimal("sub_total", { precision: 12, scale: 2 }).notNull().default('0'),
  cgstRate: decimal("cgst_rate", { precision: 5, scale: 2 }).default('9'), // 9%
  cgstAmount: decimal("cgst_amount", { precision: 12, scale: 2 }).default('0'),
  sgstRate: decimal("sgst_rate", { precision: 5, scale: 2 }).default('9'), // 9%
  sgstAmount: decimal("sgst_amount", { precision: 12, scale: 2 }).default('0'),
  rounding: decimal("rounding", { precision: 10, scale: 2 }).default('0'),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  totalInWords: text("total_in_words"),
  
  // Metadata
  status: text("status").notNull().default('draft'), // draft, sent, delivered
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDeliveryChallanSchema = createInsertSchema(deliveryChallans).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDeliveryChallan = z.infer<typeof insertDeliveryChallanSchema>;
export type DeliveryChallan = typeof deliveryChallans.$inferSelect;

// Event Guests - Predefined invitee list for RSVP tracking
export const eventGuests = pgTable("event_guests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  phone: text("phone").notNull(), // Primary contact number for WhatsApp
  email: text("email"),
  relationship: text("relationship"), // Bride's family, Groom's family, Friends, Colleagues, etc.
  guestGroup: text("guest_group"), // Custom grouping (e.g., "VIP", "Extended Family")
  invitedBy: text("invited_by"), // Who invited this guest (Bride, Groom, Parents, etc.)
  maxAttendees: integer("max_attendees").default(1), // Max allowed attendees for this invite
  inviteSentAt: timestamp("invite_sent_at"),
  reminderSentAt: timestamp("reminder_sent_at"),
  reminderCount: integer("reminder_count").default(0),
  notes: text("notes"), // Internal notes about the guest
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEventGuestSchema = createInsertSchema(eventGuests).omit({ id: true, createdAt: true });
export type InsertEventGuest = z.infer<typeof insertEventGuestSchema>;
export type EventGuest = typeof eventGuests.$inferSelect;

// RSVP Responses - Guest responses for event attendance
export const rsvpResponses = pgTable("rsvp_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  guestId: varchar("guest_id").notNull().references(() => eventGuests.id, { onDelete: 'cascade' }),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: 'cascade' }),
  
  // Attendance
  attendanceStatus: text("attendance_status").notNull().default('pending'), // 'yes', 'no', 'maybe', 'pending'
  numberOfAttendees: integer("number_of_attendees").default(1),
  attendeeNames: text("attendee_names"), // Comma-separated names of attendees
  
  // Meal Preferences
  mealPreference: text("meal_preference"), // 'vegetarian', 'non_vegetarian', 'both', 'no_preference'
  dietaryRestrictions: text("dietary_restrictions"), // Free text for allergies, restrictions
  
  // Logistics
  needsAccommodation: boolean("needs_accommodation").default(false),
  accommodationNights: integer("accommodation_nights"), // Number of nights
  accommodationCheckIn: date("accommodation_check_in"),
  accommodationCheckOut: date("accommodation_check_out"),
  needsTransportation: boolean("needs_transportation").default(false),
  transportationDetails: text("transportation_details"), // Pickup location, arrival time, etc.
  
  // Additional Info
  specialNotes: text("special_notes"), // Any special requests or notes from guest
  responseSource: text("response_source").default('whatsapp'), // 'whatsapp', 'website', 'manual', 'phone'
  
  // Escalation
  needsHumanFollowUp: boolean("needs_human_follow_up").default(false),
  escalationReason: text("escalation_reason"),
  humanNotes: text("human_notes"), // Notes from human coordinator
  
  // Conversation tracking
  whatsappConversationId: varchar("whatsapp_conversation_id"),
  lastInteractionAt: timestamp("last_interaction_at"),
  
  respondedAt: timestamp("responded_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRsvpResponseSchema = createInsertSchema(rsvpResponses).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRsvpResponse = z.infer<typeof insertRsvpResponseSchema>;
export type RsvpResponse = typeof rsvpResponses.$inferSelect;

// RSVP Message Templates - for greeting and reminder messages
export const rsvpMessageTemplates = pgTable("rsvp_message_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: 'cascade' }),
  templateType: text("template_type").notNull(), // 'greeting', 'reminder_1', 'reminder_2', 'reminder_final'
  templateName: text("template_name").notNull(),
  messageContent: text("message_content").notNull(), // Supports {{guestName}}, {{eventName}}, {{eventDate}}, {{rsvpLink}}
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertRsvpMessageTemplateSchema = createInsertSchema(rsvpMessageTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRsvpMessageTemplate = z.infer<typeof insertRsvpMessageTemplateSchema>;
export type RsvpMessageTemplate = typeof rsvpMessageTemplates.$inferSelect;

// RSVP Message Jobs - scheduled reminders
export const rsvpMessageJobs = pgTable("rsvp_message_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: 'cascade' }),
  templateId: varchar("template_id").notNull().references(() => rsvpMessageTemplates.id, { onDelete: 'cascade' }),
  jobType: text("job_type").notNull(), // 'immediate', 'scheduled', 'recurring'
  scheduledAt: timestamp("scheduled_at"), // When to send (null for immediate)
  recurringPattern: text("recurring_pattern"), // 'daily', 'every_3_days', 'weekly'
  targetAudience: text("target_audience").notNull().default('pending'), // 'all', 'pending', 'maybe'
  status: text("status").notNull().default('pending'), // 'pending', 'running', 'completed', 'cancelled'
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRsvpMessageJobSchema = createInsertSchema(rsvpMessageJobs).omit({ id: true, createdAt: true });
export type InsertRsvpMessageJob = z.infer<typeof insertRsvpMessageJobSchema>;
export type RsvpMessageJob = typeof rsvpMessageJobs.$inferSelect;

// RSVP Message Logs - tracking sent messages
export const rsvpMessageLogs = pgTable("rsvp_message_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: 'cascade' }),
  guestId: varchar("guest_id").notNull().references(() => eventGuests.id, { onDelete: 'cascade' }),
  templateId: varchar("template_id").references(() => rsvpMessageTemplates.id),
  jobId: varchar("job_id").references(() => rsvpMessageJobs.id),
  messageType: text("message_type").notNull(), // 'greeting', 'reminder', 'custom'
  messageContent: text("message_content").notNull(), // Actual sent message with variables replaced
  recipientPhone: text("recipient_phone").notNull(),
  deliveryStatus: text("delivery_status").notNull().default('pending'), // 'pending', 'sent', 'delivered', 'read', 'failed'
  twilioMessageSid: text("twilio_message_sid"), // Twilio message ID for tracking
  errorMessage: text("error_message"), // If failed
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  readAt: timestamp("read_at"),
  sentBy: varchar("sent_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRsvpMessageLogSchema = createInsertSchema(rsvpMessageLogs).omit({ id: true, createdAt: true });
export type InsertRsvpMessageLog = z.infer<typeof insertRsvpMessageLogSchema>;
export type RsvpMessageLog = typeof rsvpMessageLogs.$inferSelect;

// Reminders - Scheduled reminders set by employees via WhatsApp
export const oaksyReminders = pgTable("oaksy_reminders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: 'cascade' }),
  employeeName: text("employee_name").notNull(),
  employeePhone: text("employee_phone").notNull(),
  reminderMessage: text("reminder_message").notNull(),
  dueAt: timestamp("due_at").notNull(),
  timezone: text("timezone").default('Asia/Kolkata'),
  status: text("status").notNull().default('pending'), // 'pending', 'sent', 'cancelled'
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertOaksyReminderSchema = createInsertSchema(oaksyReminders).omit({ id: true, createdAt: true });
export type InsertOaksyReminder = z.infer<typeof insertOaksyReminderSchema>;
export type OaksyReminder = typeof oaksyReminders.$inferSelect;

// ============================================
// MODULAR SAAS SUBSCRIPTION SYSTEM
// ============================================

// Module catalog - defines available modules
export const saasModules = pgTable("saas_modules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(), // 'core', 'rsvp', 'crm', 'vendor', 'payments', 'automation', 'ai_assistant'
  name: text("name").notNull(),
  description: text("description"),
  monthlyPrice: integer("monthly_price").notNull(), // in paise (e.g., 49900 = ₹499)
  yearlyPrice: integer("yearly_price").notNull(), // in paise
  razorpayMonthlyPlanId: text("razorpay_monthly_plan_id"), // Razorpay plan ID for monthly
  razorpayYearlyPlanId: text("razorpay_yearly_plan_id"), // Razorpay plan ID for yearly
  features: jsonb("features").$type<string[]>(), // List of feature descriptions
  isCore: boolean("is_core").notNull().default(false), // Core platform is mandatory
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSaasModuleSchema = createInsertSchema(saasModules).omit({ id: true, createdAt: true });
export type InsertSaasModule = z.infer<typeof insertSaasModuleSchema>;
export type SaasModule = typeof saasModules.$inferSelect;

// Company module subscriptions - tracks which modules each company has
export const companyModuleSubscriptions = pgTable("company_module_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  moduleId: varchar("module_id").notNull().references(() => saasModules.id),
  moduleCode: text("module_code").notNull(), // Denormalized for quick checks
  razorpaySubscriptionId: text("razorpay_subscription_id"),
  razorpayCustomerId: text("razorpay_customer_id"),
  billingCycle: text("billing_cycle").notNull().default('monthly'), // 'monthly' | 'yearly'
  status: text("status").notNull().default('pending'), // 'pending', 'active', 'paused', 'cancelled', 'expired'
  amountPaid: integer("amount_paid"), // Last paid amount in paise
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  nextBillingDate: timestamp("next_billing_date"),
  lastPaymentDate: timestamp("last_payment_date"),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCompanyModuleSubscriptionSchema = createInsertSchema(companyModuleSubscriptions).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCompanyModuleSubscription = z.infer<typeof insertCompanyModuleSubscriptionSchema>;
export type CompanyModuleSubscription = typeof companyModuleSubscriptions.$inferSelect;

// AI Assistant settings - white-label configuration per company
export const aiAssistantSettings = pgTable("ai_assistant_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().unique().references(() => companies.id, { onDelete: 'cascade' }),
  assistantName: text("assistant_name").notNull().default('AI Assistant'),
  welcomeMessage: text("welcome_message"),
  systemPromptAddition: text("system_prompt_addition"), // Additional context for the AI
  avatarUrl: text("avatar_url"),
  primaryColor: text("primary_color"), // Custom color for chat widget
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAiAssistantSettingsSchema = createInsertSchema(aiAssistantSettings).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAiAssistantSettings = z.infer<typeof insertAiAssistantSettingsSchema>;
export type AiAssistantSettings = typeof aiAssistantSettings.$inferSelect;

// AI Usage tracking - monthly token limits per company
export const aiUsage = pgTable("ai_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  monthYear: text("month_year").notNull(), // Format: '2024-01' for easy reset
  monthlyLimitTokens: integer("monthly_limit_tokens").notNull().default(50000), // Token limit based on plan
  usedTokens: integer("used_tokens").notNull().default(0),
  requestCount: integer("request_count").notNull().default(0),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAiUsageSchema = createInsertSchema(aiUsage).omit({ id: true, createdAt: true });
export type InsertAiUsage = z.infer<typeof insertAiUsageSchema>;
export type AiUsage = typeof aiUsage.$inferSelect;

// Billing events - webhook event log for audit
export const billingEvents = pgTable("billing_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  razorpayEventId: text("razorpay_event_id").unique(), // For idempotency
  eventType: text("event_type").notNull(), // 'subscription.activated', 'subscription.charged', 'payment.failed', etc.
  companyId: varchar("company_id").references(() => companies.id),
  subscriptionId: varchar("subscription_id").references(() => companyModuleSubscriptions.id),
  payload: jsonb("payload").$type<Record<string, any>>(),
  processedAt: timestamp("processed_at"),
  status: text("status").notNull().default('pending'), // 'pending', 'processed', 'failed'
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBillingEventSchema = createInsertSchema(billingEvents).omit({ id: true, createdAt: true });
export type InsertBillingEvent = z.infer<typeof insertBillingEventSchema>;
export type BillingEvent = typeof billingEvents.$inferSelect;

// Internal notifications - in-app notification system
export const inAppNotifications = pgTable("in_app_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull().default('info'), // 'info', 'warning', 'error', 'success', 'billing'
  category: text("category"), // 'billing', 'event', 'rsvp', 'payment', 'system'
  actionUrl: text("action_url"), // Link to relevant page
  isRead: boolean("is_read").notNull().default(false),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertInAppNotificationSchema = createInsertSchema(inAppNotifications).omit({ id: true, createdAt: true });
export type InsertInAppNotification = z.infer<typeof insertInAppNotificationSchema>;
export type InAppNotification = typeof inAppNotifications.$inferSelect;

// Email notification queue - for sending scheduled emails
export const emailNotificationQueue = pgTable("email_notification_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id),
  userId: varchar("user_id").references(() => users.id),
  toEmail: text("to_email").notNull(),
  toName: text("to_name"),
  subject: text("subject").notNull(),
  htmlContent: text("html_content").notNull(),
  textContent: text("text_content"),
  templateType: text("template_type"), // 'billing_reminder', 'payment_failed', 'subscription_activated', etc.
  status: text("status").notNull().default('pending'), // 'pending', 'sent', 'failed'
  scheduledFor: timestamp("scheduled_for"),
  sentAt: timestamp("sent_at"),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEmailNotificationQueueSchema = createInsertSchema(emailNotificationQueue).omit({ id: true, createdAt: true });
export type InsertEmailNotificationQueue = z.infer<typeof insertEmailNotificationQueueSchema>;
export type EmailNotificationQueue = typeof emailNotificationQueue.$inferSelect;

// ============================================
// KNOTVITE RSVP MODULE
// ============================================

// RSVP Form Templates - form configuration per event
export const rsvpFormTemplates = pgTable("rsvp_form_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").references(() => events.id, { onDelete: 'cascade' }),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  status: text("status").notNull().default('draft'), // 'draft', 'published', 'closed'
  welcomeMessage: text("welcome_message"),
  confirmationMessage: text("confirmation_message"),
  deadline: timestamp("deadline"),
  requireEmail: boolean("require_email").notNull().default(true),
  requirePhone: boolean("require_phone").notNull().default(false),
  brandingEnabled: boolean("branding_enabled").notNull().default(true), // Show "Powered by KnotVite"
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertRsvpFormTemplateSchema = createInsertSchema(rsvpFormTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRsvpFormTemplate = z.infer<typeof insertRsvpFormTemplateSchema>;
export type RsvpFormTemplate = typeof rsvpFormTemplates.$inferSelect;

// RSVP Form Fields - custom field definitions for forms
export const rsvpFormFields = pgTable("rsvp_form_fields", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull().references(() => rsvpFormTemplates.id, { onDelete: 'cascade' }),
  fieldKey: text("field_key").notNull(), // Unique identifier within template
  label: text("label").notNull(),
  fieldType: text("field_type").notNull(), // 'text', 'dropdown', 'toggle', 'multiselect', 'number', 'date', 'textarea'
  required: boolean("required").notNull().default(false),
  placeholder: text("placeholder"),
  defaultValue: text("default_value"),
  options: jsonb("options").$type<{ value: string; label: string }[]>(), // For dropdown/multiselect
  order: integer("order").notNull().default(0),
  isSystemField: boolean("is_system_field").notNull().default(false), // Built-in fields like name, email
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRsvpFormFieldSchema = createInsertSchema(rsvpFormFields).omit({ id: true, createdAt: true });
export type InsertRsvpFormField = z.infer<typeof insertRsvpFormFieldSchema>;
export type RsvpFormField = typeof rsvpFormFields.$inferSelect;

// RSVP Submissions - guest responses
export const rsvpSubmissions = pgTable("rsvp_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: 'cascade' }),
  templateId: varchar("template_id").notNull().references(() => rsvpFormTemplates.id, { onDelete: 'cascade' }),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  guestId: varchar("guest_id").references(() => eventGuests.id), // Optional link to existing guest
  guestName: text("guest_name").notNull(),
  guestEmail: text("guest_email"),
  guestPhone: text("guest_phone"),
  attending: text("attending").notNull().default('pending'), // 'yes', 'no', 'maybe', 'pending'
  partySize: integer("party_size").notNull().default(1),
  responses: jsonb("responses").$type<Record<string, any>>().notNull().default({}), // {fieldKey: value}
  source: text("source").notNull().default('web'), // 'web', 'import', 'manual'
  ipAddress: text("ip_address"),
  submittedAt: timestamp("submitted_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertRsvpSubmissionSchema = createInsertSchema(rsvpSubmissions).omit({ id: true, submittedAt: true, updatedAt: true });
export type InsertRsvpSubmission = z.infer<typeof insertRsvpSubmissionSchema>;
export type RsvpSubmission = typeof rsvpSubmissions.$inferSelect;

// RSVP Bulk Imports - track import jobs (Premium)
export const rsvpBulkImports = pgTable("rsvp_bulk_imports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: 'cascade' }),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url"),
  status: text("status").notNull().default('pending'), // 'pending', 'processing', 'completed', 'failed'
  totalRows: integer("total_rows").notNull().default(0),
  successCount: integer("success_count").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  errorReport: jsonb("error_report").$type<{ row: number; field: string; error: string }[]>(),
  columnMapping: jsonb("column_mapping").$type<Record<string, string>>(), // {csvColumn: fieldKey}
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertRsvpBulkImportSchema = createInsertSchema(rsvpBulkImports).omit({ id: true, createdAt: true, completedAt: true });
export type InsertRsvpBulkImport = z.infer<typeof insertRsvpBulkImportSchema>;
export type RsvpBulkImport = typeof rsvpBulkImports.$inferSelect;

// Portal Leads - Client portal lead submissions
export const portalLeads = pgTable("portal_leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  whatsappNumber: text("whatsapp_number").notNull(),
  address: text("address"),
  city: text("city"),
  eventDate: date("event_date"),
  eventType: text("event_type"),
  venue: text("venue"),
  venueCity: text("venue_city"),
  guestCount: integer("guest_count"),
  budgetRange: text("budget_range"),
  servicesRequired: jsonb("services_required").$type<string[]>(),
  additionalNotes: text("additional_notes"),
  referenceUrls: jsonb("reference_urls").$type<string[]>(),
  termsAccepted: boolean("terms_accepted").default(false),
  otpVerified: boolean("otp_verified").default(false),
  otpCode: text("otp_code"),
  otpExpiresAt: timestamp("otp_expires_at"),
  portalToken: text("portal_token"),
  portalTokenExpiresAt: timestamp("portal_token_expires_at"),
  phase: text("phase").notNull().default('submitted'),
  phaseUpdatedAt: timestamp("phase_updated_at").defaultNow(),
  assignedPlannerId: varchar("assigned_planner_id").references(() => users.id),
  assignedPlannerName: text("assigned_planner_name"),
  assignedAt: timestamp("assigned_at"),
  reminderSentAt: timestamp("reminder_sent_at"),
  dealId: varchar("deal_id").references(() => salesDeals.id),
  eventId: varchar("event_id").references(() => events.id),
  sharedEstimateId: varchar("shared_estimate_id").references(() => estimates.id),
  sharedPresentationId: varchar("shared_presentation_id").references(() => presentations.id),
  sharedContractUrl: text("shared_contract_url"),
  sharedPresentationUrl: text("shared_presentation_url"),
  documentsSharedAt: timestamp("documents_shared_at"),
  documentsSharedBy: varchar("documents_shared_by").references(() => users.id),
  clientApprovalStatus: text("client_approval_status").default('pending'),
  clientApprovalAt: timestamp("client_approval_at"),
  clientApprovalNotes: text("client_approval_notes"),
  clientSignatureUrl: text("client_signature_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPortalLeadSchema = createInsertSchema(portalLeads).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPortalLead = z.infer<typeof insertPortalLeadSchema>;
export type PortalLead = typeof portalLeads.$inferSelect;

// Portfolio Albums
export const portfolioAlbums = pgTable("portfolio_albums", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id),
  title: text("title").notNull(),
  tagline: text("tagline"),
  venue: text("venue"),
  coverImageUrl: text("cover_image_url").notNull(),
  category: text("category").notNull().default('Wedding'),
  eventDate: date("event_date"),
  featured: boolean("featured").default(false),
  sortOrder: integer("sort_order").default(0),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPortfolioAlbumSchema = createInsertSchema(portfolioAlbums).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPortfolioAlbum = z.infer<typeof insertPortfolioAlbumSchema>;
export type PortfolioAlbum = typeof portfolioAlbums.$inferSelect;

// Portfolio Sets
export const portfolioSets = pgTable("portfolio_sets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  albumId: varchar("album_id").notNull().references(() => portfolioAlbums.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPortfolioSetSchema = createInsertSchema(portfolioSets).omit({ id: true, createdAt: true });
export type InsertPortfolioSet = z.infer<typeof insertPortfolioSetSchema>;
export type PortfolioSet = typeof portfolioSets.$inferSelect;

// Portfolio Photos
export const portfolioPhotos = pgTable("portfolio_photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  albumId: varchar("album_id").references(() => portfolioAlbums.id, { onDelete: 'cascade' }),
  setId: varchar("set_id").references(() => portfolioSets.id, { onDelete: 'cascade' }),
  imageUrl: text("image_url").notNull(),
  caption: text("caption"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPortfolioPhotoSchema = createInsertSchema(portfolioPhotos).omit({ id: true, createdAt: true });
export type InsertPortfolioPhoto = z.infer<typeof insertPortfolioPhotoSchema>;
export type PortfolioPhoto = typeof portfolioPhotos.$inferSelect;

// Portfolio Items (legacy)
export const portfolioItems = pgTable("portfolio_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id),
  title: text("title").notNull(),
  category: text("category").notNull(),
  venue: text("venue"),
  imageUrl: text("image_url").notNull(),
  description: text("description"),
  eventDate: date("event_date"),
  featured: boolean("featured").default(false),
  sortOrder: integer("sort_order").default(0),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPortfolioItemSchema = createInsertSchema(portfolioItems).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPortfolioItem = z.infer<typeof insertPortfolioItemSchema>;
export type PortfolioItem = typeof portfolioItems.$inferSelect;

// Portal Client Inputs
export const portalClientInputs = pgTable("portal_client_inputs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portalLeadId: varchar("portal_lead_id").notNull().references(() => portalLeads.id, { onDelete: 'cascade' }),
  inputType: text("input_type").notNull(),
  title: text("title").notNull(),
  content: text("content"),
  urls: jsonb("urls").$type<string[]>(),
  attachments: jsonb("attachments").$type<{ name: string; url: string }[]>(),
  status: text("status").default('pending'),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPortalClientInputSchema = createInsertSchema(portalClientInputs).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPortalClientInput = z.infer<typeof insertPortalClientInputSchema>;
export type PortalClientInput = typeof portalClientInputs.$inferSelect;

// Portal Feedback
export const portalFeedback = pgTable("portal_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portalLeadId: varchar("portal_lead_id").notNull().references(() => portalLeads.id, { onDelete: 'cascade' }),
  overallRating: integer("overall_rating"),
  planningRating: integer("planning_rating"),
  executionRating: integer("execution_rating"),
  communicationRating: integer("communication_rating"),
  decorRating: integer("decor_rating"),
  comments: text("comments"),
  suggestions: text("suggestions"),
  wouldRecommend: boolean("would_recommend"),
  testimonial: text("testimonial"),
  testimonialApproved: boolean("testimonial_approved").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPortalFeedbackSchema = createInsertSchema(portalFeedback).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPortalFeedback = z.infer<typeof insertPortalFeedbackSchema>;
export type PortalFeedback = typeof portalFeedback.$inferSelect;

// Portal Timelines
export const portalTimelines = pgTable("portal_timelines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portalLeadId: varchar("portal_lead_id").notNull().references(() => portalLeads.id, { onDelete: 'cascade' }),
  phase: integer("phase").notNull(),
  phaseName: text("phase_name").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  date: date("date"),
  time: text("time"),
  status: text("status").default('upcoming'),
  icon: text("icon"),
  sortOrder: integer("sort_order").default(0),
  pushedBy: varchar("pushed_by").references(() => users.id),
  pushedAt: timestamp("pushed_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPortalTimelineSchema = createInsertSchema(portalTimelines).omit({ id: true, createdAt: true, pushedAt: true });
export type InsertPortalTimeline = z.infer<typeof insertPortalTimelineSchema>;
export type PortalTimeline = typeof portalTimelines.$inferSelect;

// Portal Milestone Phases
export const portalMilestonePhases = pgTable("portal_milestone_phases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portalLeadId: varchar("portal_lead_id").notNull().references(() => portalLeads.id, { onDelete: 'cascade' }),
  phaseNumber: integer("phase_number").notNull(),
  phaseName: text("phase_name").notNull(),
  description: text("description"),
  daysBeforeStart: integer("days_before_start").notNull(),
  daysBeforeEnd: integer("days_before_end").notNull(),
  status: text("status").default('upcoming'),
  isLocked: boolean("is_locked").default(false),
  lockedAt: timestamp("locked_at"),
  lockedBy: varchar("locked_by").references(() => users.id),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPortalMilestonePhaseSchema = createInsertSchema(portalMilestonePhases).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPortalMilestonePhase = z.infer<typeof insertPortalMilestonePhaseSchema>;
export type PortalMilestonePhase = typeof portalMilestonePhases.$inferSelect;

// Portal Milestone Tasks
export const portalMilestoneTasks = pgTable("portal_milestone_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phaseId: varchar("phase_id").notNull().references(() => portalMilestonePhases.id, { onDelete: 'cascade' }),
  portalLeadId: varchar("portal_lead_id").notNull().references(() => portalLeads.id, { onDelete: 'cascade' }),
  taskName: text("task_name").notNull(),
  description: text("description"),
  status: text("status").default('pending'),
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"),
  completedBy: varchar("completed_by").references(() => users.id),
  dueDate: date("due_date"),
  requiresUpload: boolean("requires_upload").default(false),
  uploadUrl: text("upload_url"),
  uploadName: text("upload_name"),
  uploadedAt: timestamp("uploaded_at"),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  isClientTask: boolean("is_client_task").default(false),
  isApprovalRequired: boolean("is_approval_required").default(false),
  approvalStatus: text("approval_status"),
  approvedAt: timestamp("approved_at"),
  approvedBy: varchar("approved_by").references(() => users.id),
  sortOrder: integer("sort_order").default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPortalMilestoneTaskSchema = createInsertSchema(portalMilestoneTasks).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPortalMilestoneTask = z.infer<typeof insertPortalMilestoneTaskSchema>;
export type PortalMilestoneTask = typeof portalMilestoneTasks.$inferSelect;

// Portal Event Flows
export const portalEventFlows = pgTable("portal_event_flows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portalLeadId: varchar("portal_lead_id").notNull().references(() => portalLeads.id, { onDelete: 'cascade' }),
  eventName: text("event_name").notNull(),
  eventDate: date("event_date"),
  eventTime: text("event_time"),
  venue: text("venue"),
  venueAddress: text("venue_address"),
  description: text("description"),
  sortOrder: integer("sort_order").default(0),
  isPublished: boolean("is_published").default(false),
  publishedAt: timestamp("published_at"),
  publishedBy: varchar("published_by").references(() => users.id),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPortalEventFlowSchema = createInsertSchema(portalEventFlows).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPortalEventFlow = z.infer<typeof insertPortalEventFlowSchema>;
export type PortalEventFlow = typeof portalEventFlows.$inferSelect;

// Portal Event Flow Items
export const portalEventFlowItems = pgTable("portal_event_flow_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventFlowId: varchar("event_flow_id").notNull().references(() => portalEventFlows.id, { onDelete: 'cascade' }),
  portalLeadId: varchar("portal_lead_id").notNull().references(() => portalLeads.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  description: text("description"),
  startTime: text("start_time"),
  endTime: text("end_time"),
  duration: integer("duration"),
  category: text("category"),
  notes: text("notes"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPortalEventFlowItemSchema = createInsertSchema(portalEventFlowItems).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPortalEventFlowItem = z.infer<typeof insertPortalEventFlowItemSchema>;
export type PortalEventFlowItem = typeof portalEventFlowItems.$inferSelect;

// Portal Financial Milestones
export const portalFinancialMilestones = pgTable("portal_financial_milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portalLeadId: varchar("portal_lead_id").notNull().references(() => portalLeads.id, { onDelete: 'cascade' }),
  milestoneName: text("milestone_name").notNull(),
  percentage: decimal("percentage", { precision: 5, scale: 2 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }),
  dueDescription: text("due_description"),
  dueDate: date("due_date"),
  daysBefore: integer("days_before"),
  isPaid: boolean("is_paid").default(false),
  paidAmount: decimal("paid_amount", { precision: 12, scale: 2 }),
  paidAt: timestamp("paid_at"),
  paymentMethod: text("payment_method"),
  paymentReference: text("payment_reference"),
  confirmedBy: varchar("confirmed_by").references(() => users.id),
  confirmedAt: timestamp("confirmed_at"),
  notes: text("notes"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPortalFinancialMilestoneSchema = createInsertSchema(portalFinancialMilestones).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPortalFinancialMilestone = z.infer<typeof insertPortalFinancialMilestoneSchema>;
export type PortalFinancialMilestone = typeof portalFinancialMilestones.$inferSelect;

// Portal Oaksy Chat
export const portalOaksyChats = pgTable("portal_oaksy_chats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: text("session_id").notNull(),
  portalLeadId: varchar("portal_lead_id").references(() => portalLeads.id, { onDelete: 'cascade' }),
  visitorName: text("visitor_name"),
  visitorPhone: text("visitor_phone"),
  visitorEmail: text("visitor_email"),
  chatType: text("chat_type").notNull().default('landing'),
  messages: jsonb("messages").$type<Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>>().default([]),
  leadCollected: boolean("lead_collected").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPortalOaksyChatSchema = createInsertSchema(portalOaksyChats).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPortalOaksyChat = z.infer<typeof insertPortalOaksyChatSchema>;
export type PortalOaksyChat = typeof portalOaksyChats.$inferSelect;

// Event Vendor Costs
export const eventVendorCosts = pgTable("event_vendor_costs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: 'cascade' }),
  vendorName: text("vendor_name").notNull(),
  serviceDescription: text("service_description").notNull(),
  estimatedAmount: decimal("estimated_amount", { precision: 12, scale: 2 }).notNull().default('0'),
  actualAmount: decimal("actual_amount", { precision: 12, scale: 2 }),
  paymentStatus: text("payment_status").notNull().default('pending'),
  paymentDate: date("payment_date"),
  paymentReference: text("payment_reference"),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertEventVendorCostSchema = createInsertSchema(eventVendorCosts).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEventVendorCost = z.infer<typeof insertEventVendorCostSchema>;
export type EventVendorCost = typeof eventVendorCosts.$inferSelect;

// Demo Bookings
export const demoBookings = pgTable("demo_bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  companyName: text("company_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  businessType: text("business_type"),
  preferredDate: text("preferred_date"),
  preferredTime: text("preferred_time"),
  status: text("status").notNull().default('pending'),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDemoBookingSchema = createInsertSchema(demoBookings).omit({ id: true, createdAt: true });
export type InsertDemoBooking = z.infer<typeof insertDemoBookingSchema>;
export type DemoBooking = typeof demoBookings.$inferSelect;

// Enterprise Leads
export const enterpriseLeads = pgTable("enterprise_leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: text("company_name").notNull(),
  teamSize: text("team_size"),
  eventsPerMonth: text("events_per_month"),
  integrationNeeds: text("integration_needs"),
  whatsappVolume: text("whatsapp_volume"),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  status: text("status").notNull().default('new'),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEnterpriseLeadSchema = createInsertSchema(enterpriseLeads).omit({ id: true, createdAt: true });
export type InsertEnterpriseLead = z.infer<typeof insertEnterpriseLeadSchema>;
export type EnterpriseLead = typeof enterpriseLeads.$inferSelect;

// CRM Leads
export const crmLeads = pgTable("crm_leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  companyName: text("company_name"),
  source: text("source").notNull(),
  status: text("status").notNull().default('new'),
  planInterest: text("plan_interest"),
  notes: text("notes"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCrmLeadSchema = createInsertSchema(crmLeads).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCrmLead = z.infer<typeof insertCrmLeadSchema>;
export type CrmLead = typeof crmLeads.$inferSelect;

// Admin Notifications
export const adminNotifications = pgTable("admin_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(),
  payload: text("payload").notNull(),
  status: text("status").notNull().default('pending'),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAdminNotificationSchema = createInsertSchema(adminNotifications).omit({ id: true, createdAt: true });
export type InsertAdminNotification = z.infer<typeof insertAdminNotificationSchema>;
export type AdminNotification = typeof adminNotifications.$inferSelect;

// System Notifications (Atbott AI Admin Notification System)
export const systemNotifications = pgTable("system_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventType: text("event_type").notNull(), // 'demo_booking', 'trial_signup', 'enterprise_inquiry'
  title: text("title").notNull(),
  message: text("message").notNull(),
  payload: jsonb("payload"),
  isRead: boolean("is_read").notNull().default(false),
  createdBy: text("created_by").notNull().default('system'),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSystemNotificationSchema = createInsertSchema(systemNotifications).omit({ id: true, createdAt: true });
export type InsertSystemNotification = z.infer<typeof insertSystemNotificationSchema>;
export type SystemNotification = typeof systemNotifications.$inferSelect;

// Email Logs
export const emailLogs = pgTable("email_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recipient: text("recipient").notNull(),
  type: text("type").notNull(), // 'demo_confirmation', 'signup_welcome', 'enterprise_acknowledgment'
  status: text("status").notNull().default('pending'), // 'sent', 'failed', 'pending'
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEmailLogSchema = createInsertSchema(emailLogs).omit({ id: true, createdAt: true });
export type InsertEmailLog = z.infer<typeof insertEmailLogSchema>;
export type EmailLog = typeof emailLogs.$inferSelect;

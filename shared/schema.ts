import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, date, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull(), // 'admin' | 'manager' | 'employee'
  avatar: text("avatar"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userPermissions = pgTable("user_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  pageId: text("page_id").notNull(), // e.g., 'dashboard', 'event-calendar', etc.
});

export const roles = pgTable("roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  label: text("label").notNull(),
  description: text("description"),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRoleSchema = createInsertSchema(roles).omit({ id: true, createdAt: true });
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type Role = typeof roles.$inferSelect;

export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  createdAt: timestamp("created_at").defaultNow(),
});

export const meetings = pgTable("meetings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  date: date("date").notNull(),
  time: text("time").notNull(),
  attendees: text("attendees"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const employees = pgTable("employees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  employeeId: text("employee_id").notNull().unique(),
  joinDate: date("join_date").notNull(),
  designation: text("designation").notNull(),
  salary: decimal("salary", { precision: 10, scale: 2 }).notNull(),
  address: text("address").notNull(),
  emergencyContact: text("emergency_contact").notNull(),
  leaveDate: date("leave_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const daybookEntries = pgTable("daybook_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  name: text("name").notNull(),
  type: text("type").notNull(), // 'income' | 'expense'
  isSystem: boolean("is_system").notNull().default(false), // System categories can't be deleted
  createdAt: timestamp("created_at").defaultNow(),
});

export const banks = pgTable("banks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  openingBalance: decimal("opening_balance", { precision: 12, scale: 2 }).notNull().default('0'),
  balance: decimal("balance", { precision: 12, scale: 2 }).notNull().default('0'),
  createdAt: timestamp("created_at").defaultNow(),
});

export const bankTransfers = pgTable("bank_transfers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  reason: text("reason"),
  status: text("status").notNull().default('pending'), // 'pending' | 'approved' | 'rejected'
  managerId: varchar("manager_id").references(() => users.id),
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

// Oak Book - Customers
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  gstNumber: text("gst_number"),
  billingAddress: text("billing_address"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Oak Book - Vendors
export const vendors = pgTable("vendors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  gstNumber: text("gst_number"),
  category: text("category"), // 'catering' | 'decoration' | 'photography' | 'venue' | 'other'
  billingAddress: text("billing_address"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Enhanced line item type for estimates and invoices (supports section headings)
export const lineItemSchema = z.object({
  slNo: z.number().optional(),
  name: z.string(),
  description: z.string().optional(),
  quantity: z.number(),
  rate: z.number(),
  taxRate: z.number().optional().default(0),
  total: z.number(),
  isHeading: z.boolean().optional().default(false), // For section headers like "DAY 1: MEHANDI"
});

export type LineItem = z.infer<typeof lineItemSchema>;

// Oak Book - Estimates
export const estimates = pgTable("estimates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  number: text("number").notNull().unique(), // QT-000968 or EST-001
  customerId: varchar("customer_id").references(() => customers.id),
  eventId: varchar("event_id").references(() => events.id),
  date: date("date").notNull(),
  dueDate: date("due_date"),
  status: text("status").notNull().default('draft'), // 'draft' | 'sent' | 'accepted' | 'declined' | 'converted'
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

// Oak Book - Invoices
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  number: text("number").notNull().unique(), // INV-001
  customerId: varchar("customer_id").references(() => customers.id),
  eventId: varchar("event_id").references(() => events.id),
  estimateId: varchar("estimate_id").references(() => estimates.id),
  date: date("date").notNull(),
  dueDate: date("due_date"),
  status: text("status").notNull().default('draft'), // 'draft' | 'sent' | 'partial' | 'paid' | 'overdue'
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

// Oak Book - Customer Payments (Payment Receipts)
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

// Oak Book - Expenses
export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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

// Oak Book - Vendor Payments
export const vendorPayments = pgTable("vendor_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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

// Oak Book - Items/Products (reusable products/services)
export const items = pgTable("items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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

// Oak Book - Bills (from vendors)
export const bills = pgTable("bills", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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

// Oak Book - Company Settings (for estimate/invoice header)
export const companySettings = pgTable("company_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: text("company_name").notNull().default('Oakstreet Events'),
  address: text("address").default('2nd Floor, Above Devas Studio\nDeshabhimani press road\nKochi Kerala 682017\nIndia'),
  phone: text("phone").default('7902373354'),
  email: text("email").default('oakstreetevents18@gmail.com'),
  website: text("website").default('www.oakstreetevents.com'),
  logo: text("logo"),
  gstNumber: text("gst_number"),
  placeOfSupply: text("place_of_supply").default('Kerala (32)'),
  panNumber: text("pan_number"),
  bankName: text("bank_name"),
  bankAccountNumber: text("bank_account_number"),
  bankIfscCode: text("bank_ifsc_code"),
  bankBranch: text("bank_branch"),
  defaultTerms: text("default_terms"),
  defaultThankYouMessage: text("default_thank_you_message").default('Looking forward for your business.'),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Oak Book - Document Number Sequences (for auto-numbering)
export const documentSequences = pgTable("document_sequences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentType: text("document_type").notNull().unique(), // 'estimate' | 'invoice' | 'receipt' | 'expense' | 'vendor_payment'
  prefix: text("prefix").notNull(), // 'QT-', 'INV-', 'REC-', etc.
  nextNumber: integer("next_number").notNull().default(1),
  paddingLength: integer("padding_length").notNull().default(6), // For QT-000001
});

// Oak Book - Estimate Templates (for sample templates)
export const estimateTemplates = pgTable("estimate_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  lineItems: jsonb("line_items").$type<LineItem[]>().notNull().default([]),
  terms: text("terms"),
  thankYouMessage: text("thank_you_message"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Oak Customer Portal - Shareable Links
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
export const insertEventSchema = createInsertSchema(events).omit({ id: true, createdAt: true });
export const insertMeetingSchema = createInsertSchema(meetings).omit({ id: true, createdAt: true });
export const insertEmployeeSchema = createInsertSchema(employees).omit({ id: true, createdAt: true });
export const insertDaybookEntrySchema = createInsertSchema(daybookEntries).omit({ id: true, createdAt: true });
export const insertDaybookCategorySchema = createInsertSchema(daybookCategories).omit({ id: true, createdAt: true });
export const insertBankSchema = createInsertSchema(banks).omit({ id: true, createdAt: true });
export const insertBankTransferSchema = createInsertSchema(bankTransfers).omit({ id: true, createdAt: true });
export const insertLeaveRequestSchema = createInsertSchema(leaveRequests).omit({ id: true, createdAt: true });
export const insertEventMilestoneSchema = createInsertSchema(eventMilestones).omit({ id: true, createdAt: true });

// Oak Book Insert Schemas
export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, createdAt: true });
export const insertVendorSchema = createInsertSchema(vendors).omit({ id: true, createdAt: true });
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
  dailyRate: decimal("daily_rate", { precision: 10, scale: 2 }).notNull(),
  grossPay: decimal("gross_pay", { precision: 10, scale: 2 }).notNull(),
  deductions: decimal("deductions", { precision: 10, scale: 2 }).default('0'),
  netPay: decimal("net_pay", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPayrollRunSchema = createInsertSchema(payrollRuns).omit({ id: true, createdAt: true, daybookEntryId: true });
export const insertPayrollItemSchema = createInsertSchema(payrollItems).omit({ id: true, createdAt: true });

// Oak Sales CRM

// Sales Pipelines (e.g., "Bookings FY26-27", "Wedding Planning")
export const salesPipelines = pgTable("sales_pipelines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  email: text("email"),
  phone: text("phone"),
  mobile: text("mobile"),
  companyId: varchar("company_id"),
  title: text("title"),
  source: text("source"), // "Website", "Referral", "Social Media", etc.
  notes: text("notes"),
  ownerId: varchar("owner_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// CRM Companies/Accounts
export const salesCompanies = pgTable("sales_companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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

// Oak Book Types
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;

export type Vendor = typeof vendors.$inferSelect;
export type InsertVendor = z.infer<typeof insertVendorSchema>;

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

// Oak Sales Types
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
  startTime: text("start_time"),
  endTime: text("end_time"),
  vendorId: varchar("vendor_id").references(() => vendors.id),
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

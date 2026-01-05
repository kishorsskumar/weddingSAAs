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
  createdVia: text("created_via").default('admin_panel'), // 'admin_panel' | 'employee_onboarding'
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

// Leave Categories (Casual, Sick, etc.)
export const leaveCategories = pgTable("leave_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
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
  googleCalendarEventId: text("google_calendar_event_id"), // Google Calendar sync
  outlookCalendarEventId: text("outlook_calendar_event_id"), // Outlook Calendar sync
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

// Oak Book - Customers
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  gstNumber: text("gst_number"),
  billingAddress: text("billing_address"),
  weddingPlannerId: varchar("wedding_planner_id").references(() => users.id),
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

// Oak Book - Estimates
export const estimates = pgTable("estimates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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

export type SalarySlip = typeof salarySlips.$inferSelect;
export type InsertSalarySlip = z.infer<typeof insertSalarySlipSchema>;

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

// Oaksy AI Assistant - Chat conversations
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

// Oaksy AI Assistant - Chat messages
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

// Oak Creative - Presentations
export const presentations = pgTable("presentations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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

// Oak Creative - Presentation Slides
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

// Oak Creative - Slide Images/Options
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

// Oak Creative - Asset Library (reusable images for presentations)
export const presentationAssets = pgTable("presentation_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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

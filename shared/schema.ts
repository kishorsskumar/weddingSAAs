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
  description: text("description").notNull(),
  type: text("type").notNull(), // 'income' | 'expense'
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  category: text("category").notNull(),
  bankId: varchar("bank_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const banks = pgTable("banks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
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

// Oak Book - Company Settings (for estimate/invoice header)
export const companySettings = pgTable("company_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: text("company_name").notNull().default('Oakstreet Events'),
  address: text("address").default('2nd Floor, Above Devas Studio\nDeshabhimani press road\nKochi Kerala 682017\nIndia'),
  phone: text("phone").default('7902373354'),
  email: text("email").default('oakstreetevents18@gmail.com'),
  website: text("website").default('www.oakstreetevents.com'),
  logo: text("logo"), // URL or base64
  gstNumber: text("gst_number"),
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
export const insertCompanySettingsSchema = createInsertSchema(companySettings).omit({ id: true, updatedAt: true });
export const insertDocumentSequenceSchema = createInsertSchema(documentSequences).omit({ id: true });
export const insertEstimateTemplateSchema = createInsertSchema(estimateTemplates).omit({ id: true, createdAt: true }).extend({
  lineItems: z.array(lineItemSchema).optional().default([]),
});
export const insertPortalLinkSchema = createInsertSchema(portalLinks).omit({ id: true, createdAt: true, viewCount: true, lastViewedAt: true });

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

export type CompanySettings = typeof companySettings.$inferSelect;
export type InsertCompanySettings = z.infer<typeof insertCompanySettingsSchema>;

export type DocumentSequence = typeof documentSequences.$inferSelect;
export type InsertDocumentSequence = z.infer<typeof insertDocumentSequenceSchema>;

export type EstimateTemplate = typeof estimateTemplates.$inferSelect;
export type InsertEstimateTemplate = z.infer<typeof insertEstimateTemplateSchema>;

export type PortalLink = typeof portalLinks.$inferSelect;
export type InsertPortalLink = z.infer<typeof insertPortalLinkSchema>;

# KnotVite RSVP SaaS Implementation Plan

**Product:** KnotVite — Powered by AtBott  
**Base Route:** `/knotvite`  
**Status:** Planning Phase  
**Last Updated:** January 2026

---

## Executive Summary

KnotVite is a comprehensive RSVP SaaS module that enables wedding planners and event organizers to create custom RSVP forms, manage guest responses, generate reports, and communicate with guests. The system integrates with the existing AtBott Wedding SaaS platform's billing and authentication infrastructure.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Schema](#database-schema)
3. [Implementation Phases](#implementation-phases)
4. [API Endpoints](#api-endpoints)
5. [Frontend Components](#frontend-components)
6. [Security & Performance](#security--performance)
7. [Pricing & Feature Gating](#pricing--feature-gating)
8. [File Structure](#file-structure)
9. [Dependencies](#dependencies)
10. [Timeline Estimate](#timeline-estimate)

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        KnotVite RSVP SaaS                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Form      │  │   Public    │  │  Reporting  │              │
│  │   Builder   │  │   RSVP      │  │   Engine    │              │
│  │   (Admin)   │  │   Forms     │  │             │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                     │
│  ┌──────┴────────────────┴────────────────┴──────┐              │
│  │              API Layer (Express.js)           │              │
│  └──────────────────────┬────────────────────────┘              │
│                         │                                       │
│  ┌──────────────────────┴────────────────────────┐              │
│  │           Storage Layer (Drizzle ORM)         │              │
│  └──────────────────────┬────────────────────────┘              │
│                         │                                       │
│  ┌──────────────────────┴────────────────────────┐              │
│  │              PostgreSQL Database              │              │
│  └───────────────────────────────────────────────┘              │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Razorpay   │  │  WhatsApp   │  │   Email     │              │
│  │  Billing    │  │  (Premium)  │  │  (Resend)   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Multi-Tenancy Model

- Each **Company** (subscriber) can have multiple **Events**
- Each **Event** can have one **RSVP Form Template**
- Form templates contain **Custom Fields** defined by the organizer
- Guest **Submissions** are linked to events and contain field responses

---

## Database Schema

### New Tables Required

#### 1. rsvp_form_templates
Stores form configurations for each event.

```typescript
export const rsvpFormTemplates = pgTable("rsvp_form_templates", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id).notNull(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  name: text("name").notNull(),
  status: text("status").default("draft"), // draft, published, closed
  welcomeMessage: text("welcome_message"),
  confirmationMessage: text("confirmation_message"),
  deadline: timestamp("deadline"),
  requireEmail: boolean("require_email").default(true),
  requirePhone: boolean("require_phone").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

#### 2. rsvp_form_fields
Custom field definitions for each form template.

```typescript
export const rsvpFormFields = pgTable("rsvp_form_fields", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").references(() => rsvpFormTemplates.id).notNull(),
  fieldKey: text("field_key").notNull(), // unique identifier
  label: text("label").notNull(),
  fieldType: text("field_type").notNull(), // text, dropdown, toggle, multiselect, number, date
  required: boolean("required").default(false),
  placeholder: text("placeholder"),
  defaultValue: text("default_value"),
  options: jsonb("options"), // for dropdown/multiselect: [{value, label}]
  order: integer("order").default(0),
  isSystemField: boolean("is_system_field").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});
```

#### 3. rsvp_submissions
Guest RSVP responses.

```typescript
export const rsvpSubmissions = pgTable("rsvp_submissions", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id).notNull(),
  templateId: integer("template_id").references(() => rsvpFormTemplates.id).notNull(),
  guestId: integer("guest_id").references(() => eventGuests.id), // optional link
  guestName: text("guest_name").notNull(),
  guestEmail: text("guest_email"),
  guestPhone: text("guest_phone"),
  attending: text("attending"), // yes, no, maybe
  partySize: integer("party_size").default(1),
  responses: jsonb("responses").notNull(), // {fieldKey: value, ...}
  source: text("source").default("web"), // web, import, manual
  ipAddress: text("ip_address"),
  submittedAt: timestamp("submitted_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

#### 4. rsvp_bulk_imports
Track bulk import jobs.

```typescript
export const rsvpBulkImports = pgTable("rsvp_bulk_imports", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  eventId: integer("event_id").references(() => events.id).notNull(),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url"),
  status: text("status").default("pending"), // pending, processing, completed, failed
  totalRows: integer("total_rows").default(0),
  successCount: integer("success_count").default(0),
  errorCount: integer("error_count").default(0),
  errorReport: jsonb("error_report"), // [{row, field, error}]
  columnMapping: jsonb("column_mapping"), // {csvColumn: fieldKey}
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});
```

#### 5. rsvp_whatsapp_messages
WhatsApp message logs (Premium feature).

```typescript
export const rsvpWhatsappMessages = pgTable("rsvp_whatsapp_messages", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  eventId: integer("event_id").references(() => events.id).notNull(),
  submissionId: integer("submission_id").references(() => rsvpSubmissions.id),
  recipientPhone: text("recipient_phone").notNull(),
  templateName: text("template_name"),
  messageType: text("message_type"), // rsvp_link, reminder, confirmation
  status: text("status").default("pending"), // pending, sent, delivered, failed
  externalMessageId: text("external_message_id"),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});
```

### Indexes Required

```sql
CREATE INDEX idx_submissions_event ON rsvp_submissions(event_id);
CREATE INDEX idx_submissions_email ON rsvp_submissions(guest_email);
CREATE INDEX idx_submissions_template ON rsvp_submissions(template_id);
CREATE INDEX idx_fields_template ON rsvp_form_fields(template_id);
CREATE INDEX idx_templates_company ON rsvp_form_templates(company_id);
CREATE INDEX idx_templates_event ON rsvp_form_templates(event_id);
```

---

## Implementation Phases

### Phase 1: MVP Core (Recommended Starting Point)

**Duration:** 2-3 weeks  
**Priority:** High

#### Features:
1. **Form Builder UI**
   - Create/edit form templates
   - Add/remove/reorder custom fields
   - Field type selection (text, dropdown, toggle, number, date)
   - Required/optional toggle
   - Placeholder and default values
   - Form preview

2. **Public RSVP Form**
   - Dynamic form rendering based on template
   - Mobile-responsive design
   - Form validation
   - Success confirmation page
   - Rate limiting (5 submissions per IP per hour)

3. **Submissions Management**
   - View all RSVP responses
   - Filter by attendance status
   - Search by name/email
   - Pagination (50 per page)
   - Mark as confirmed/pending

4. **Basic Reporting**
   - Guest count summary
   - Attendance breakdown (Yes/No/Maybe)
   - Export to CSV

5. **Role Access**
   - Organizer: Full access to own events
   - Staff: View-only access to reports

#### Database:
- rsvp_form_templates
- rsvp_form_fields
- rsvp_submissions

---

### Phase 2: Premium Features

**Duration:** 2 weeks  
**Priority:** Medium

#### Features:
1. **Advanced Reporting**
   - Custom column selection
   - Group by any field
   - Sort by any column
   - Export to Excel (.xlsx)
   - Scheduled report emails

2. **CSV/Excel Bulk Import**
   - Upload file interface
   - Column mapping wizard
   - Data validation preview
   - Duplicate detection
   - Error reporting

3. **Feature Gating**
   - Free plan limits (1 event, 100 guests, 3 custom fields)
   - Pro plan unlocks (unlimited everything)
   - Upgrade prompts and banners

#### Database:
- rsvp_bulk_imports

---

### Phase 3: Optional Modules

**Duration:** 1-2 weeks  
**Priority:** Low

#### Features:
1. **WhatsApp Integration**
   - Send RSVP link via WhatsApp
   - Reminder messages
   - Delivery tracking
   - Provider abstraction (Twilio/Meta)

2. **Super Admin Dashboard**
   - KnotVite user analytics
   - Revenue metrics
   - User management
   - Event monitoring
   - Abuse detection

3. **Advanced Security**
   - GDPR consent checkbox
   - IP-based spam prevention
   - CSV virus scanning

#### Database:
- rsvp_whatsapp_messages

---

## API Endpoints

### Form Templates

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/knotvite/templates` | List all templates for company | Organizer |
| GET | `/api/knotvite/templates/:id` | Get template with fields | Organizer |
| POST | `/api/knotvite/templates` | Create new template | Organizer |
| PUT | `/api/knotvite/templates/:id` | Update template | Organizer |
| DELETE | `/api/knotvite/templates/:id` | Delete template | Organizer |
| POST | `/api/knotvite/templates/:id/publish` | Publish form | Organizer |

### Form Fields

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/knotvite/templates/:id/fields` | List fields for template | Organizer |
| POST | `/api/knotvite/templates/:id/fields` | Add field | Organizer |
| PUT | `/api/knotvite/fields/:id` | Update field | Organizer |
| DELETE | `/api/knotvite/fields/:id` | Delete field | Organizer |
| PUT | `/api/knotvite/templates/:id/fields/reorder` | Reorder fields | Organizer |

### Public RSVP Form

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/knotvite/public/form/:eventId` | Get public form config | Public |
| POST | `/api/knotvite/public/submit/:eventId` | Submit RSVP | Public (rate limited) |

### Submissions

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/knotvite/events/:eventId/submissions` | List submissions | Organizer/Staff |
| GET | `/api/knotvite/submissions/:id` | Get submission detail | Organizer |
| PUT | `/api/knotvite/submissions/:id` | Update submission | Organizer |
| DELETE | `/api/knotvite/submissions/:id` | Delete submission | Organizer |

### Reporting

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/knotvite/events/:eventId/reports/summary` | Get summary stats | Organizer/Staff |
| GET | `/api/knotvite/events/:eventId/reports/export` | Export CSV/Excel | Organizer (Pro) |

### Bulk Import (Premium)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/knotvite/events/:eventId/import/upload` | Upload file | Organizer (Pro) |
| POST | `/api/knotvite/events/:eventId/import/preview` | Preview mapping | Organizer (Pro) |
| POST | `/api/knotvite/events/:eventId/import/confirm` | Confirm import | Organizer (Pro) |
| GET | `/api/knotvite/imports/:id/status` | Get import status | Organizer |

### WhatsApp (Premium Module)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/knotvite/events/:eventId/whatsapp/send` | Send RSVP link | Organizer (Pro) |
| POST | `/api/knotvite/events/:eventId/whatsapp/remind` | Send reminder | Organizer (Pro) |
| GET | `/api/knotvite/events/:eventId/whatsapp/logs` | View message logs | Organizer |

### Super Admin

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/admin/knotvite/dashboard` | Analytics dashboard | Super Admin |
| GET | `/api/admin/knotvite/users` | List organizers | Super Admin |
| GET | `/api/admin/knotvite/events` | List all events | Super Admin |
| PUT | `/api/admin/knotvite/users/:id/suspend` | Suspend user | Super Admin |

---

## Frontend Components

### New Pages

#### 1. `/knotvite` - KnotVite Dashboard
Main dashboard showing:
- Active events with RSVP stats
- Quick actions (Create Event, View Submissions)
- Recent activity

#### 2. `/knotvite/form-builder/:eventId` - Form Builder
Drag-and-drop interface:
- Field palette (available field types)
- Form canvas (current fields)
- Field settings panel
- Form preview
- Publish/Save buttons

#### 3. `/knotvite/rsvp/:eventId` - Public RSVP Form
Public-facing form:
- Event branding header
- Dynamic form fields
- Submit button
- Success/Error messages

#### 4. `/knotvite/submissions/:eventId` - Submissions List
Table view with:
- Guest name, email, phone
- Attendance status
- Custom field columns
- Filters and search
- Export button

#### 5. `/knotvite/reports/:eventId` - Reports
Report views:
- Summary cards (total, attending, not attending)
- Charts (pie chart for attendance)
- Detailed tables
- Export options

#### 6. `/knotvite/import/:eventId` - Bulk Import (Pro)
Import wizard:
- File upload zone
- Column mapping interface
- Preview table
- Confirm/Cancel buttons

#### 7. `/admin/knotvite` - Super Admin Dashboard
Admin views:
- Usage metrics
- User management
- Event monitoring
- Billing overview

### Reusable Components

```
client/src/components/knotvite/
├── form-builder/
│   ├── FieldPalette.tsx
│   ├── FormCanvas.tsx
│   ├── FieldSettings.tsx
│   └── DraggableField.tsx
├── public-form/
│   ├── DynamicField.tsx
│   ├── FormHeader.tsx
│   └── SuccessPage.tsx
├── submissions/
│   ├── SubmissionsTable.tsx
│   ├── SubmissionFilters.tsx
│   └── SubmissionDetail.tsx
├── reports/
│   ├── SummaryCards.tsx
│   ├── AttendanceChart.tsx
│   └── ExportButton.tsx
└── import/
    ├── FileUploader.tsx
    ├── ColumnMapper.tsx
    └── PreviewTable.tsx
```

---

## Security & Performance

### Security Measures

| Feature | Implementation |
|---------|----------------|
| Input Sanitization | DOMPurify for text fields, Zod validation |
| Rate Limiting | 5 submissions/IP/hour on public form |
| CSRF Protection | SameSite cookies, Origin check |
| XSS Prevention | React escaping, CSP headers |
| SQL Injection | Drizzle ORM parameterized queries |
| File Upload Safety | File type validation, size limits (5MB) |
| GDPR Consent | Optional consent checkbox on public form |

### Performance Optimizations

| Feature | Implementation |
|---------|----------------|
| Pagination | 50 items per page, cursor-based |
| Lazy Loading | Reports load on demand |
| Database Indexes | eventId, email, templateId indexed |
| Caching | React Query with 5-minute stale time |
| Server-side Filtering | Filter queries in SQL, not in memory |
| Debounced Search | 300ms debounce on search inputs |

---

## Pricing & Feature Gating

### Free Plan Limits

| Resource | Limit |
|----------|-------|
| Events | 1 |
| Guests per Event | 100 |
| Custom Fields | 3 |
| CSV Import | ❌ |
| Excel Export | ❌ |
| WhatsApp | ❌ |
| Branding Removal | ❌ |

### Pro Plan (₹299/month or ₹2,999/year)

| Resource | Limit |
|----------|-------|
| Events | Unlimited |
| Guests per Event | Unlimited |
| Custom Fields | Unlimited |
| CSV Import | ✅ |
| Excel Export | ✅ |
| WhatsApp | ✅ (add-on) |
| Branding Removal | ✅ |

### Feature Gating Implementation

```typescript
// Middleware check
const checkKnotvitePlan = async (req, res, next) => {
  const company = await getCompany(req.user.companyId);
  const subscription = await getModuleSubscription(company.id, 'knotvite');
  
  req.knotvitePlan = subscription?.plan || 'free';
  req.knotviteLimits = PLAN_LIMITS[req.knotvitePlan];
  
  next();
};

// Usage in routes
app.post('/api/knotvite/import/upload', 
  checkKnotvitePlan,
  requirePlan('pro'),
  handleImport
);
```

---

## File Structure

### New Files to Create

```
shared/
└── schema.ts                    # Add new tables

server/
├── knotvite/
│   ├── routes.ts               # KnotVite API routes
│   ├── storage.ts              # Database operations
│   ├── form-builder.ts         # Form template logic
│   ├── submissions.ts          # Submission handling
│   ├── reports.ts              # Report generation
│   ├── import.ts               # Bulk import logic
│   └── whatsapp.ts             # WhatsApp integration
└── routes.ts                    # Mount KnotVite routes

client/src/
├── pages/
│   ├── knotvite/
│   │   ├── index.tsx           # Dashboard
│   │   ├── form-builder.tsx    # Form builder
│   │   ├── submissions.tsx     # Submissions list
│   │   ├── reports.tsx         # Reports page
│   │   └── import.tsx          # Bulk import
│   ├── knotvite-public/
│   │   └── rsvp.tsx            # Public RSVP form
│   └── admin/
│       └── knotvite.tsx        # Super admin dashboard
└── components/
    └── knotvite/               # Reusable components
```

### Files to Modify

```
shared/schema.ts                 # Add new table definitions
server/routes.ts                 # Mount /api/knotvite routes
client/src/App.tsx               # Add new page routes
client/src/components/layout.tsx # Add sidebar navigation
```

---

## Dependencies

### New NPM Packages

| Package | Purpose | Phase |
|---------|---------|-------|
| @dnd-kit/core | Drag-and-drop for form builder | Phase 1 |
| @dnd-kit/sortable | Sortable fields | Phase 1 |
| xlsx | Excel file generation | Phase 2 |
| papaparse | CSV parsing | Phase 2 |
| file-type | File validation | Phase 2 |

### Existing Dependencies (Already Installed)

- Drizzle ORM (database)
- Zod (validation)
- React Query (data fetching)
- Radix UI (components)
- Tailwind CSS (styling)
- Razorpay (billing)
- Resend (email)

---

## Timeline Estimate

| Phase | Features | Duration | Priority |
|-------|----------|----------|----------|
| **Phase 1** | Form Builder, Public Form, Submissions, Basic Reports | 2-3 weeks | High |
| **Phase 2** | Advanced Reports, Bulk Import, Feature Gating | 2 weeks | Medium |
| **Phase 3** | WhatsApp, Super Admin Dashboard | 1-2 weeks | Low |

**Total Estimated Duration:** 5-7 weeks

---

## Success Metrics

### Phase 1 Success Criteria
- [ ] Organizer can create custom RSVP form with 5+ field types
- [ ] Public form renders correctly on mobile
- [ ] Guests can submit RSVP without authentication
- [ ] Organizer can view and filter submissions
- [ ] Basic CSV export works

### Phase 2 Success Criteria
- [ ] Excel export includes all custom fields
- [ ] Bulk import handles 1000+ rows
- [ ] Free plan limits enforced correctly
- [ ] Pro plan upgrade flow works with Razorpay

### Phase 3 Success Criteria
- [ ] WhatsApp messages sent and tracked
- [ ] Super admin can view all KnotVite metrics
- [ ] Rate limiting prevents abuse

---

## Next Steps

1. **Review this plan** with stakeholders
2. **Finalize Phase 1 scope** (any adjustments needed?)
3. **Create database migrations** for new tables
4. **Begin Phase 1 implementation**

---

*Document prepared for AtBott Wedding SaaS Platform*

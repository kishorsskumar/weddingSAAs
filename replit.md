# Oak Event Management System

## Overview

Oak Event Management is a comprehensive full-stack web application for event planning and business management. It provides event calendar management, team scheduling, financial tracking (daybook), HR management, and administrative controls. The system aims to be an all-in-one platform for event-based businesses, featuring role-based access control and integration with AI and communication tools.

## User Preferences

Preferred communication style: Simple, everyday language.

**Company Branding:**
- Company name is "Oakstreet Events" (one word, not "Oak Street Events")
- All documents, reports, and UI elements should use "Oakstreet Events"

**Important Development Rules:**
- When creating new pages, ALWAYS add them to:
  1. `client/src/components/layout.tsx` - ALL_PAGES array and ICONS object for sidebar navigation
  2. `client/src/pages/dashboard.tsx` - ALL_PAGES array for Quick Access section on Superadmin dashboard
  3. `client/src/App.tsx` - Route definition
  4. `server/routes.ts` - ALL_PAGES array for permission system
- Superadmin dashboard must always display Quick Access cards for ALL available pages

**UI/UX Preferences:**
- Event dropdowns should be searchable and scrollable using a Combobox pattern (Command + Popover)
- Use the same searchable dropdown pattern for any long lists throughout the app

**Official WhatsApp Numbers:**
- Kishor (Superadmin): +91 7902373354
- Fida Fathima PK: +91 9895810975
- Femina KM: +91 7306687284

## System Architecture

### Frontend Architecture
- **Framework:** React with TypeScript, Vite for build/development.
- **Routing:** React Router (wouter).
- **Data Fetching:** TanStack Query for server state management.
- **UI:** Radix UI primitives, shadcn/ui with Tailwind CSS (New York style), custom earthy color palette.
- **State Management:** React Context API for auth, TanStack Query for server state, React hooks for local state.
- **Design System:** Component aliases, responsive design (mobile-first), Lucide React icons, Inter and Playfair Display fonts.

### Backend Architecture
- **Server:** Express.js with TypeScript.
- **API Design:** RESTful endpoints, consistent CRUD operations, session-based authentication.
- **Authentication & Authorization:** `express-session` with PostgreSQL store, `bcrypt` for password hashing, role-based access control (superadmin, admin, manager, employee, wedding_planner, accountant), dynamic roles, page-level permissions.
- **Build:** `esbuild` for server, Vite for client.

### Data Storage
- **Database:** PostgreSQL with Drizzle ORM for type-safe queries.
- **Schema:** Users (roles, permissions), Events (financial tracking), Meetings, Employees, Daybook, Banks, Leave Requests, Sessions, Oaksy conversations/messages, WhatsApp conversations/approvals/inbound messages, QR payment requests, Monthly Production Plan, Event Guests, RSVP Responses.
- **Validation:** Drizzle-zod integration for schema validation on API endpoints.

### Key Features
- **Calendar Integration:** Google Calendar (active, two-way sync), Outlook (planned).
- **Oaksy AI Assistant:** Intelligent, flexible companion using OpenAI GPT-4o:
  - **Role-Aware Responses:** Adapts to user role (Employee, Wedding Planner, Accountant, Superadmin)
  - **Natural Language Understanding:** Uses AI to understand intent - no strict formats required
  - **Flexible Amount Parsing:** Accepts "5k", "5 thousand", "1 lakh", "Rs 5000", "₹5000" etc.
  - **Security:** Never shares sensitive data (salaries, profits) with non-superadmins
  - **Capabilities by Role:**
    - Employees: Expenses, leave requests, QR payments, status checks, event queries, team availability
    - Wedding Planners (Fida/Femina): Vendor payments, event coordination, production planning, pending payments, event countdown
    - Accountant: Financial queries, daybook entries, payment tracking, daily summaries
    - Superadmin: Full business assistant with complete access to all queries and reports
  - **New Query Features (via WhatsApp):**
    - **Event Queries:** "events this week", "countdown to [event]", "what events today"
    - **Bank Queries (Superadmin):** "bank balance", "how much in [bank name]"
    - **Team Queries:** "who's on leave", "team availability today"
    - **Vendor Queries:** "vendor history [name]", "what did we pay [vendor]"
    - **Financial Queries:** "pending payments", "daily summary", "how much does [client] owe"
    - **Report Queries (Superadmin):** "monthly summary", "profit on [event name]"
    - **RSVP Queries (Wedding Planners/Superadmin):** "rsvp status", "pending rsvps", "meal count for [event]"
- **Two-Way WhatsApp Communication:** Employee expense/leave requests, Superadmin approval workflow, dashboard inbox for management, Superadmin lead submission with AI extraction.
- **QR Payment Request System:** Employee QR code submission for payments, Kishor approval/payment flow with screenshot collection, event assignment, automatic daybook recording.
- **Income Submission System:** Employee submits payment received screenshots with text like "Income from [client]" or "Bank transfer from [client]", Kishor approves with event assignment, automatic daybook recording as income.
- **Monthly Production Plan:** Macro-level scheduling with inline editing, auto-sync from events, PDF export.
  - **PDF Settings (for single-page fit):** A4 landscape, fontSize: 7pt, cellPadding: 2.5, minCellHeight: 8mm, 13 columns with optimized widths (16+30+26+18+18+20+12+18+24+24+24+24+20 = 274mm), margins: 8mm
- **Leave Tracker (Oak HR):** Comprehensive leave monitoring, statistics, manual entry, status management.
- **Oak RSVP:** Guest management and RSVP tracking for events:
  - **Guest List Management:** Add, edit, delete guests with phone, email, relationship, and group tags
  - **RSVP Response Tracking:** Attendance status (confirmed/declined/maybe/pending), meal preferences, dietary restrictions
  - **Logistics Tracking:** Accommodation needs (nights, check-in/out dates), transportation requirements
  - **Dashboard Analytics:** Response rates, total attendees, meal counts, accommodation/transport needs
  - **Follow-up Management:** Track guests needing human follow-up with escalation notes
  - **Bulk Import:** Add multiple guests at once
  - **WhatsApp Integration:** Query RSVP status via Oaksy AI ("rsvp status", "pending rsvps", "meal count")
  - **Outreach System (Superadmin & Wedding Planners only):**
    - **Message Templates:** Customizable greeting and reminder templates with variables ({{guestName}}, {{eventName}}, {{eventDate}}, {{venue}})
    - **Send Messages:** Select guests by RSVP status (pending/confirmed/declined/maybe) and send WhatsApp messages via Twilio
    - **Status Filtering:** Filter guests by their RSVP status before sending messages
    - **Message History:** Track all sent messages with delivery status (sent/delivered/read/failed)
    - **Outreach Analytics:** Dashboard showing total sent, delivered, read, failed, and pending message counts

## External Dependencies

### Third-Party UI/Utilities
- `@radix-ui/*`: Accessible component primitives.
- `react-hook-form`, `@hookform/resolvers`: Form management and validation.
- `date-fns`: Date manipulation.
- `class-variance-authority` (CVA), `tailwind-merge`, `clsx`: UI utilities.
- `googleapis`: Google Calendar API access.
- `twilio`: WhatsApp integration.
- `openai`: AI assistant.

### Development Tools
- `vite-plugin-cartographer`, `vite-plugin-dev-banner`, `vite-plugin-meta-images`.
- `TypeScript`: Strict mode.

### Build Dependencies
- `esbuild`: Server bundling.
- `PostCSS`, `Tailwind CSS`, `Autoprefixer`.
- `tsx`: TypeScript execution.
- `drizzle-kit`: Database migrations.

### Security & Session Management
- `bcryptjs`: Password hashing.
- `express-session`: Secure session management.
- `connect-pg-simple`: PostgreSQL session store.
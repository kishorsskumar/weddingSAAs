# Wedding SaaS Platform

## Overview

Wedding SaaS Platform is a comprehensive full-stack web application for event planning and business management. It provides event calendar management, team scheduling, financial tracking, HR management, and administrative controls. The system is designed to be a white-label platform that can be customized for any wedding or event management business through environment variables.

## User Preferences

Preferred communication style: Simple, everyday language.

**SaaS Configuration:**
- All company branding is configured via environment variables (see Configuration section below)
- The platform supports customizable document prefixes, company details, and branding

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

**Mobile-First Design Guidelines (MUST FOLLOW):**
- Mobile version should feel like a native app (Zoho Books-style experience)
- Use bottom navigation bar on mobile with 5 tabs: Home, Book, Events, Daybook, More
- Full-height views using `100dvh` for app-like experience
- Minimum 44x44px touch targets for all interactive elements
- Use `viewport-fit=cover` in index.html for iOS safe areas
- Headers must be responsive: stack vertically on mobile (flex-col), horizontal on desktop (sm:flex-row)
- Action buttons (New, Add, etc.) must be visible without horizontal scrolling on mobile
- Search bars should take full width on mobile, fixed width on desktop
- Use responsive text sizes: `text-xs sm:text-sm` or `text-base sm:text-lg`
- Tables should hide less important columns on mobile with `hidden lg:table-cell`
- Dialogs should be full-height sheets on mobile
- Always test on mobile viewport (375px width) before completing UI work

## Configuration (Environment Variables)

### Company Branding
- `COMPANY_NAME` - Your company name (default: "Wedding SaaS Platform")
- `COMPANY_SHORT_NAME` - Short name for mobile/icons (default: "WeddingSaaS")
- `COMPANY_EMAIL` - Contact email
- `COMPANY_PHONE` - Contact phone
- `COMPANY_WEBSITE` - Company website URL
- `COMPANY_ADDRESS` - Full business address

### Default Admin Account
- `DEFAULT_ADMIN_EMAIL` - Initial admin email (default: "admin@example.com")
- `DEFAULT_ADMIN_PASSWORD` - Initial admin password (default: "ChangeMe123!")
- `DEFAULT_ADMIN_NAME` - Initial admin name (default: "Super Admin")

### Document Prefixes
- `DOC_PREFIX_EVENT` - Event code prefix (default: "EVT")
- `DOC_PREFIX_CUSTOMER` - Customer code prefix (default: "CUST")
- `DOC_PREFIX_ESTIMATE` - Estimate prefix (default: "EST")
- `DOC_PREFIX_INVOICE` - Invoice prefix (default: "INV")

### Theme
- `THEME_PRIMARY_COLOR` - Primary color in HSL format (default: "135 35% 30%")
- `THEME_PRIMARY_HEX` - Primary color in hex (default: "#5B8C51")

### Features (Optional)
- `FEATURE_WHATSAPP` - Enable WhatsApp integration (true/false)
- `FEATURE_AI_ASSISTANT` - Enable AI assistant (true/false)
- `FEATURE_GOOGLE_CALENDAR` - Enable Google Calendar sync (true/false)
- `FEATURE_RSVP` - Enable RSVP system (true/false)

### Regional Settings
- `CURRENCY` - Currency code (default: "INR")
- `CURRENCY_SYMBOL` - Currency symbol (default: "₹")
- `DEFAULT_COUNTRY` - Default country (default: "India")
- `TIMEZONE` - Timezone (default: "Asia/Kolkata")

## System Architecture

### Frontend Architecture
- **Framework:** React with TypeScript, Vite.
- **Routing:** React Router (wouter).
- **Data Fetching:** TanStack Query.
- **UI:** Radix UI primitives, shadcn/ui with Tailwind CSS (New York style), Zoho-inspired clean professional theme.
  - **Design System:** Clean white backgrounds, subtle gray borders, configurable primary color, Inter font.
- **State Management:** React Context API for auth, TanStack Query for server state, React hooks for local state.

### Backend Architecture
- **Server:** Express.js with TypeScript.
- **API Design:** RESTful endpoints, consistent CRUD operations.
- **Authentication & Authorization:** `express-session` with PostgreSQL store, `bcrypt` for password hashing, role-based access control (superadmin, admin, manager, employee, wedding_planner, accountant), dynamic roles, page-level permissions.
- **Build:** `esbuild`.

### Data Storage
- **Database:** PostgreSQL with Drizzle ORM.
- **Schema:** Users (roles, permissions), Events (financial tracking), Meetings, Employees, Daybook, Banks, Leave Requests, Sessions, AI conversations/messages, WhatsApp conversations/approvals/inbound messages, QR payment requests, Monthly Production Plan, Event Guests, RSVP Responses.
- **Validation:** Drizzle-zod integration for schema validation.

### Key Features
- **AI Assistant:** Intelligent, flexible companion using OpenAI GPT-4o, role-aware responses, natural language understanding, flexible amount parsing, security by not sharing sensitive data with non-superadmins.
- **Two-Way WhatsApp Communication:** For employee requests (expenses/leave), Superadmin approval, lead submission with AI extraction, and outreach.
- **QR Payment Request System:** Employee QR submission, Superadmin approval/payment, event assignment, automatic daybook recording.
- **Income Submission System:** Employee submits payment screenshots, Superadmin approval with event assignment, automatic daybook recording.
- **Monthly Production Plan:** Macro-level scheduling with inline editing, auto-sync from events, PDF export.
- **Leave Tracker:** Comprehensive leave monitoring, statistics, manual entry, status management.
- **RSVP System:** Guest management, RSVP tracking, logistics tracking, dashboard analytics, follow-up management, bulk import, WhatsApp integration, and outreach system with message templates and history.
- **Calendar Integration:** Google Calendar (active, two-way sync).
- **Automation:** Estimate-to-Production automation including timeline creation, push to production, and inventory finalization, with logging and WhatsApp notifications.
- **Event Staff Assignment Automation:** WhatsApp notifications sent to staff when assigned to events, with supervisor summary messages and duplicate prevention via `notificationSent` flag.
- **Multi-Tenant SaaS:** Company registration, trial management (14-day Growth trial), Razorpay subscription payments (Starter ₹499/mo or ₹4999/yr, Growth ₹1499/mo or ₹14999/yr), subscription enforcement middleware, admin event logging, payment notification emails.
- **Plan-Based Access Control:** Feature matrix in `shared/plan-features.ts` restricts modules by plan. Starter: Dashboard, Sales (no Reports), Event Hub, Finance (no Payments/Masters/Daybook), People (no HR/Employee Portal), Tools (AI limited), Client Portal. Growth: adds Sales Reports, Payment Tracking, Team Calendar, Operations, KnotVite, AI Full. Enterprise: adds HR, Employee Portal, Finance Masters, Day Book, WhatsApp, Management MIS. Backend middleware enforces plan restrictions on all API routes (403 PLAN_RESTRICTED). Team member limits: Starter=1, Growth=5, Enterprise=unlimited (enforced server-side on all employee creation endpoints). Frontend sidebar renders dynamically based on allowedPages. Roles: superadmin (all + admin panel), admin/tenant_admin (plan-limited), team_member (restricted subset), client_user (minimal access).
- **Admin SaaS Dashboard:** SaaS overview stats (users, companies, revenue), admin event logs viewer with filtering, subscription management.

### Critical Files & Components
- **`client/src/components/layout.tsx`**: Main layout, sidebar navigation, mobile bottom nav.
- **Financial Module**: `client/src/components/oak-book/zoho-quotes.tsx` (Estimates/Quotes), `client/src/components/oak-book/zoho-invoices.tsx` (Invoices), `client/src/pages/print-document.tsx` (PDF generation).
- **`client/src/index.css`**: Global styles with mobile-first utilities.
- **`shared/config.ts`**: SaaS configuration with environment variables.

## External Dependencies

- `@radix-ui/*`: Accessible UI component primitives.
- `react-hook-form`, `@hookform/resolvers`: Form management and validation.
- `date-fns`: Date manipulation.
- `class-variance-authority` (CVA), `tailwind-merge`, `clsx`: UI utilities.
- `googleapis`: Google Calendar API access.
- `twilio`: WhatsApp integration.
- `openai`: AI assistant.
- `vite-plugin-cartographer`, `vite-plugin-dev-banner`, `vite-plugin-meta-images`: Vite development plugins.
- `TypeScript`: Language.
- `esbuild`: Server bundling.
- `PostCSS`, `Tailwind CSS`, `Autoprefixer`: Styling tools.
- `tsx`: TypeScript execution.
- `drizzle-kit`: Database migrations.
- `bcryptjs`: Password hashing.
- `express-session`: Secure session management.
- `connect-pg-simple`: PostgreSQL session store.

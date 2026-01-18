# Oak Event Management System

## Overview

Oak Event Management is a comprehensive full-stack web application for event planning and business management. It provides event calendar management, team scheduling, financial tracking, HR management, and administrative controls. The system aims to be an all-in-one platform for event-based businesses, featuring role-based access control and integration with AI and communication tools. Its business vision is to streamline operations for event-based companies, enhance efficiency, and provide a competitive edge in the market through advanced technological solutions.

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

## System Architecture

### Frontend Architecture
- **Framework:** React with TypeScript, Vite.
- **Routing:** React Router (wouter).
- **Data Fetching:** TanStack Query.
- **UI:** Radix UI primitives, shadcn/ui with Tailwind CSS (New York style), Zoho-inspired clean professional theme.
  - **Design System:** Clean white backgrounds, subtle gray borders, Oak Green primary color (HSL 135 35% 30%), Inter font.
- **State Management:** React Context API for auth, TanStack Query for server state, React hooks for local state.

### Backend Architecture
- **Server:** Express.js with TypeScript.
- **API Design:** RESTful endpoints, consistent CRUD operations.
- **Authentication & Authorization:** `express-session` with PostgreSQL store, `bcrypt` for password hashing, role-based access control (superadmin, admin, manager, employee, wedding_planner, accountant), dynamic roles, page-level permissions.
- **Build:** `esbuild`.

### Data Storage
- **Database:** PostgreSQL with Drizzle ORM.
- **Schema:** Users (roles, permissions), Events (financial tracking), Meetings, Employees, Daybook, Banks, Leave Requests, Sessions, Oaksy conversations/messages, WhatsApp conversations/approvals/inbound messages, QR payment requests, Monthly Production Plan, Event Guests, RSVP Responses.
- **Validation:** Drizzle-zod integration for schema validation.

### Key Features
- **Oaksy AI Assistant:** Intelligent, flexible companion using OpenAI GPT-4o, role-aware responses, natural language understanding, flexible amount parsing, security by not sharing sensitive data with non-superadmins.
- **Two-Way WhatsApp Communication:** For employee requests (expenses/leave), Superadmin approval, lead submission with AI extraction, and outreach.
- **QR Payment Request System:** Employee QR submission, Superadmin approval/payment, event assignment, automatic daybook recording.
- **Income Submission System:** Employee submits payment screenshots, Superadmin approval with event assignment, automatic daybook recording.
- **Monthly Production Plan:** Macro-level scheduling with inline editing, auto-sync from events, PDF export.
- **Leave Tracker (Oak HR):** Comprehensive leave monitoring, statistics, manual entry, status management.
- **Oak RSVP:** Guest management, RSVP tracking, logistics tracking, dashboard analytics, follow-up management, bulk import, WhatsApp integration, and outreach system with message templates and history.
- **Calendar Integration:** Google Calendar (active, two-way sync).
- **Automation:** Estimate-to-Production automation including timeline creation, push to production, and inventory finalization, with logging and WhatsApp notifications.
- **Event Staff Assignment Automation:** WhatsApp notifications sent to staff when assigned to events, with supervisor summary messages and duplicate prevention via `notificationSent` flag.

### Critical Files & Components
- **`client/src/components/layout.tsx`**: Main layout, sidebar navigation, mobile bottom nav.
- **Oak Book Financial Module**: `client/src/components/oak-book/zoho-quotes.tsx` (Estimates/Quotes), `client/src/components/oak-book/zoho-invoices.tsx` (Invoices), `client/src/pages/print-document.tsx` (PDF generation).
- **`client/src/index.css`**: Global styles with mobile-first utilities.

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
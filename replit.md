# Oak Event Management System

## Overview

Oak Event Management is a comprehensive full-stack web application designed for event planning and business management. The system provides event calendar management, team scheduling, financial tracking through a daybook, HR management, and administrative controls. Built with a modern tech stack, it serves as an all-in-one platform for managing event-based businesses with role-based access control.

## User Preferences

Preferred communication style: Simple, everyday language.

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

## System Architecture

### Frontend Architecture

**Framework & Build System**
- React with TypeScript for type-safe component development
- Vite as the build tool and development server, configured for fast refresh and optimal bundling
- React Router (wouter) for lightweight client-side routing
- TanStack Query for server state management and data fetching with caching

**UI Component System**
- Radix UI primitives for accessible, unstyled components
- shadcn/ui design system with Tailwind CSS for styling
- Custom theming with CSS variables supporting light/dark modes
- "New York" style variant from shadcn/ui
- Custom color palette based on natural, earthy tones (oak theme)

**State Management Pattern**
- React Context API for authentication state
- TanStack Query for server-side state with automatic background refetching
- Local component state with React hooks for UI interactions
- Custom hooks for mobile detection and toast notifications

**Design System Decisions**
- Component aliases configured for clean imports (@/components, @/lib, @/hooks)
- Consistent spacing and responsive design using Tailwind's mobile-first approach
- Lucide React for consistent iconography
- Custom fonts: Inter for UI, Playfair Display for headings

### Backend Architecture

**Server Framework**
- Express.js with TypeScript for the REST API
- HTTP server created separately for potential WebSocket support
- Middleware chain: JSON parsing, URL encoding, request logging
- Custom logging system with timestamps and source tracking

**API Design Pattern**
- RESTful endpoints organized by resource (/api/events, /api/meetings, etc.)
- Consistent CRUD operations across all resources
- Session-based authentication with HTTP-only cookies
- Request/response logging middleware for debugging

**Authentication & Authorization**
- Session-based authentication using express-session
- PostgreSQL session store (connect-pg-simple) for persistent sessions
- bcrypt for password hashing
- Role-based access control with dynamic roles stored in database
- System roles: superadmin, admin, manager, employee, wedding_planner, accountant
- Super admin can create custom roles through Admin panel
- Page-level permissions stored in database and checked on each request
- API endpoints protected with authentication and authorization checks
- verifyAdminAccess helper function for admin/superadmin route protection

**Build & Deployment Strategy**
- Separate client and server builds
- esbuild for server bundling with allowlist for critical dependencies
- Vite for client bundling with asset optimization
- Production build outputs to /dist directory
- Development mode uses Vite dev server with HMR

### Data Storage

**Database**
- PostgreSQL as primary database
- Drizzle ORM for type-safe database queries
- Schema-first approach with migrations stored in /migrations
- Connection pooling with node-postgres (pg)

**Database Schema Design**
- Users table with role-based access (admin, manager, employee, etc.)
- User permissions table for granular page access control
- Roles table for dynamic role management (system and custom roles)
- Events table with financial tracking (sales, payments, costs)
- Meetings table for team scheduling
- Employees table for HR management
- Daybook entries for income/expense tracking
- Banks table for account management
- Leave requests table for employee leave tracking
- Session table for authentication persistence

**Data Validation**
- Drizzle-zod integration for automatic schema validation
- Zod schemas generated from database schema
- Runtime validation on all API endpoints
- Type safety from database to frontend through shared types

### External Dependencies

**Third-Party UI Libraries**
- @radix-ui/* family for accessible component primitives
- react-hook-form with @hookform/resolvers for form management
- date-fns for date manipulation and formatting
- class-variance-authority (CVA) for component variant management
- tailwind-merge and clsx for className utilities

**Development Tools**
- Replit-specific plugins: vite-plugin-cartographer, vite-plugin-dev-banner
- Custom vite-plugin-meta-images for OpenGraph image handling
- Runtime error modal for better development experience
- TypeScript strict mode enabled for maximum type safety

**Build Dependencies**
- esbuild for fast server bundling
- PostCSS with Tailwind and Autoprefixer
- tsx for running TypeScript in development
- drizzle-kit for database migrations

**Security & Session Management**
- bcryptjs for password hashing (10 rounds)
- express-session with secure cookie configuration
- CSRF protection through session management
- HTTP-only cookies in production

**Design Decisions Rationale**
- Session-based auth chosen over JWT for better server control and revocation
- Drizzle ORM selected for type safety and migration management
- PostgreSQL chosen for ACID compliance and relational data integrity
- Monorepo structure with shared types reduces duplication and maintains consistency
- Vite chosen for superior DX with fast HMR and optimized production builds
- Component-first architecture allows for easy extension and maintenance

### Calendar Integration

**Google Calendar Integration (Active)**
- Connected via Replit's Google Calendar connector
- Uses googleapis package for API access
- Events sync to Google Calendar with customer, venue, planner details
- Sync available per event or bulk sync all events
- Admin Panel → Calendar tab for configuration and sync management
- Events store googleCalendarEventId for tracking sync status

**Outlook Calendar Integration (Not Set Up)**
- User dismissed the Outlook integration setup
- Can be enabled later through Replit's connector system
- Events schema includes outlookCalendarEventId field for future use

**Calendar API Endpoints**
- GET /api/calendar/google/status - Check connection status
- GET /api/calendar/google/calendars - List available calendars
- POST /api/calendar/google/sync/:eventId - Sync single event
- POST /api/calendar/google/sync-all - Bulk sync all events
- DELETE /api/calendar/google/event/:eventId - Remove from calendar
- GET /api/calendar/google/events - Get calendar events
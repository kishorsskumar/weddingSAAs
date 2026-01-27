import { useEffect } from "react";

export default function KnotVitePlanPDF() {
  useEffect(() => {
    document.title = "KnotVite RSVP Implementation Plan - AtBott";
  }, []);

  return (
    <div className="bg-white min-h-screen print:p-0">
      <style>{`
        @media print {
          body { margin: 0; padding: 0; }
          .no-print { display: none !important; }
          .print-break { page-break-before: always; }
        }
      `}</style>
      
      <div className="no-print fixed top-4 right-4 z-50">
        <button 
          onClick={() => window.print()}
          className="bg-primary text-white px-6 py-3 rounded-lg shadow-lg hover:bg-primary/90 font-medium"
        >
          Download PDF
        </button>
      </div>

      <div className="max-w-4xl mx-auto p-8 print:max-w-none print:p-6">
        <header className="border-b-2 border-primary pb-6 mb-8">
          <h1 className="text-3xl font-bold text-gray-900">KnotVite RSVP SaaS Implementation Plan</h1>
          <div className="mt-4 text-gray-600 space-y-1">
            <p><strong>Product:</strong> KnotVite — Powered by AtBott</p>
            <p><strong>Base Route:</strong> /knotvite</p>
            <p><strong>Status:</strong> Planning Phase</p>
            <p><strong>Last Updated:</strong> January 2026</p>
          </div>
        </header>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 border-b pb-2 mb-4">Executive Summary</h2>
          <p className="text-gray-700 leading-relaxed">
            KnotVite is a comprehensive RSVP SaaS module that enables wedding planners and event organizers to create custom RSVP forms, manage guest responses, generate reports, and communicate with guests. The system integrates with the existing AtBott Wedding SaaS platform's billing and authentication infrastructure.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 border-b pb-2 mb-4">Table of Contents</h2>
          <ol className="list-decimal list-inside space-y-1 text-gray-700">
            <li>Architecture Overview</li>
            <li>Database Schema</li>
            <li>Implementation Phases</li>
            <li>API Endpoints</li>
            <li>Frontend Components</li>
            <li>Security & Performance</li>
            <li>Pricing & Feature Gating</li>
            <li>File Structure</li>
            <li>Dependencies</li>
            <li>Timeline Estimate</li>
          </ol>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 border-b pb-2 mb-4">1. Architecture Overview</h2>
          
          <h3 className="text-lg font-semibold mt-4 mb-2">System Components</h3>
          <pre className="bg-gray-100 p-4 rounded-lg text-xs overflow-x-auto font-mono">
{`┌─────────────────────────────────────────────────────────────────┐
│                        KnotVite RSVP SaaS                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Form      │  │   Public    │  │  Reporting  │              │
│  │   Builder   │  │   RSVP      │  │   Engine    │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                     │
│  ┌──────┴────────────────┴────────────────┴──────┐              │
│  │              API Layer (Express.js)           │              │
│  └──────────────────────┬────────────────────────┘              │
│  ┌──────────────────────┴────────────────────────┐              │
│  │           Storage Layer (Drizzle ORM)         │              │
│  └──────────────────────┬────────────────────────┘              │
│  ┌──────────────────────┴────────────────────────┐              │
│  │              PostgreSQL Database              │              │
│  └───────────────────────────────────────────────┘              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Razorpay   │  │  WhatsApp   │  │   Email     │              │
│  │  Billing    │  │  (Premium)  │  │  (Resend)   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘`}
          </pre>

          <h3 className="text-lg font-semibold mt-4 mb-2">Multi-Tenancy Model</h3>
          <ul className="list-disc list-inside text-gray-700 space-y-1">
            <li>Each <strong>Company</strong> (subscriber) can have multiple <strong>Events</strong></li>
            <li>Each <strong>Event</strong> can have one <strong>RSVP Form Template</strong></li>
            <li>Form templates contain <strong>Custom Fields</strong> defined by the organizer</li>
            <li>Guest <strong>Submissions</strong> are linked to events and contain field responses</li>
          </ul>
        </section>

        <section className="mb-8 print-break">
          <h2 className="text-2xl font-bold text-gray-900 border-b pb-2 mb-4">2. Database Schema</h2>
          
          <h3 className="text-lg font-semibold mt-4 mb-2">New Tables Required</h3>
          
          <div className="mb-4">
            <h4 className="font-medium text-gray-800">1. rsvp_form_templates</h4>
            <p className="text-gray-600 text-sm mb-2">Stores form configurations for each event.</p>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 text-left">Column</th>
                  <th className="border p-2 text-left">Type</th>
                  <th className="border p-2 text-left">Description</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="border p-2">id</td><td className="border p-2">serial</td><td className="border p-2">Primary key</td></tr>
                <tr><td className="border p-2">eventId</td><td className="border p-2">integer</td><td className="border p-2">FK to events</td></tr>
                <tr><td className="border p-2">companyId</td><td className="border p-2">integer</td><td className="border p-2">FK to companies</td></tr>
                <tr><td className="border p-2">name</td><td className="border p-2">text</td><td className="border p-2">Template name</td></tr>
                <tr><td className="border p-2">status</td><td className="border p-2">text</td><td className="border p-2">draft/published/closed</td></tr>
                <tr><td className="border p-2">welcomeMessage</td><td className="border p-2">text</td><td className="border p-2">Form header message</td></tr>
                <tr><td className="border p-2">confirmationMessage</td><td className="border p-2">text</td><td className="border p-2">Success message</td></tr>
                <tr><td className="border p-2">deadline</td><td className="border p-2">timestamp</td><td className="border p-2">RSVP deadline</td></tr>
              </tbody>
            </table>
          </div>

          <div className="mb-4">
            <h4 className="font-medium text-gray-800">2. rsvp_form_fields</h4>
            <p className="text-gray-600 text-sm mb-2">Custom field definitions for each form template.</p>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 text-left">Column</th>
                  <th className="border p-2 text-left">Type</th>
                  <th className="border p-2 text-left">Description</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="border p-2">id</td><td className="border p-2">serial</td><td className="border p-2">Primary key</td></tr>
                <tr><td className="border p-2">templateId</td><td className="border p-2">integer</td><td className="border p-2">FK to templates</td></tr>
                <tr><td className="border p-2">fieldKey</td><td className="border p-2">text</td><td className="border p-2">Unique identifier</td></tr>
                <tr><td className="border p-2">label</td><td className="border p-2">text</td><td className="border p-2">Display label</td></tr>
                <tr><td className="border p-2">fieldType</td><td className="border p-2">text</td><td className="border p-2">text/dropdown/toggle/etc</td></tr>
                <tr><td className="border p-2">required</td><td className="border p-2">boolean</td><td className="border p-2">Required field flag</td></tr>
                <tr><td className="border p-2">options</td><td className="border p-2">jsonb</td><td className="border p-2">Dropdown options</td></tr>
                <tr><td className="border p-2">order</td><td className="border p-2">integer</td><td className="border p-2">Display order</td></tr>
              </tbody>
            </table>
          </div>

          <div className="mb-4">
            <h4 className="font-medium text-gray-800">3. rsvp_submissions</h4>
            <p className="text-gray-600 text-sm mb-2">Guest RSVP responses.</p>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 text-left">Column</th>
                  <th className="border p-2 text-left">Type</th>
                  <th className="border p-2 text-left">Description</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="border p-2">id</td><td className="border p-2">serial</td><td className="border p-2">Primary key</td></tr>
                <tr><td className="border p-2">eventId</td><td className="border p-2">integer</td><td className="border p-2">FK to events</td></tr>
                <tr><td className="border p-2">guestName</td><td className="border p-2">text</td><td className="border p-2">Guest name</td></tr>
                <tr><td className="border p-2">guestEmail</td><td className="border p-2">text</td><td className="border p-2">Guest email</td></tr>
                <tr><td className="border p-2">attending</td><td className="border p-2">text</td><td className="border p-2">yes/no/maybe</td></tr>
                <tr><td className="border p-2">responses</td><td className="border p-2">jsonb</td><td className="border p-2">Custom field values</td></tr>
                <tr><td className="border p-2">source</td><td className="border p-2">text</td><td className="border p-2">web/import/manual</td></tr>
              </tbody>
            </table>
          </div>

          <div className="mb-4">
            <h4 className="font-medium text-gray-800">4. rsvp_bulk_imports</h4>
            <p className="text-gray-600 text-sm mb-2">Track bulk import jobs (Premium).</p>
          </div>

          <div className="mb-4">
            <h4 className="font-medium text-gray-800">5. rsvp_whatsapp_messages</h4>
            <p className="text-gray-600 text-sm mb-2">WhatsApp message logs (Premium module).</p>
          </div>
        </section>

        <section className="mb-8 print-break">
          <h2 className="text-2xl font-bold text-gray-900 border-b pb-2 mb-4">3. Implementation Phases</h2>
          
          <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 rounded">
            <h3 className="text-lg font-semibold text-green-800">Phase 1: MVP Core</h3>
            <p className="text-green-700 text-sm">Duration: 2-3 weeks | Priority: High</p>
            <ul className="mt-2 text-gray-700 space-y-1 text-sm">
              <li>• Form Builder UI (create/edit templates, add custom fields, drag-drop reorder)</li>
              <li>• Public RSVP Form (dynamic rendering, mobile-responsive, validation)</li>
              <li>• Submissions Management (view responses, filter, search, pagination)</li>
              <li>• Basic Reporting (guest count, attendance breakdown, CSV export)</li>
              <li>• Role Access (Organizer: full access, Staff: view-only)</li>
            </ul>
          </div>

          <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
            <h3 className="text-lg font-semibold text-blue-800">Phase 2: Premium Features</h3>
            <p className="text-blue-700 text-sm">Duration: 2 weeks | Priority: Medium</p>
            <ul className="mt-2 text-gray-700 space-y-1 text-sm">
              <li>• Advanced Reporting (custom columns, group by, Excel export)</li>
              <li>• CSV/Excel Bulk Import (column mapping, validation, duplicate detection)</li>
              <li>• Feature Gating (Free vs Pro plan limits, upgrade prompts)</li>
            </ul>
          </div>

          <div className="mb-6 p-4 bg-purple-50 border-l-4 border-purple-500 rounded">
            <h3 className="text-lg font-semibold text-purple-800">Phase 3: Optional Modules</h3>
            <p className="text-purple-700 text-sm">Duration: 1-2 weeks | Priority: Low</p>
            <ul className="mt-2 text-gray-700 space-y-1 text-sm">
              <li>• WhatsApp Integration (send RSVP links, reminders, delivery tracking)</li>
              <li>• Super Admin Dashboard (analytics, user management, abuse detection)</li>
              <li>• Advanced Security (GDPR consent, IP spam prevention)</li>
            </ul>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 border-b pb-2 mb-4">4. API Endpoints</h2>
          
          <h3 className="text-lg font-semibold mt-4 mb-2">Form Templates</h3>
          <table className="w-full border-collapse text-sm mb-4">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left">Method</th>
                <th className="border p-2 text-left">Endpoint</th>
                <th className="border p-2 text-left">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className="border p-2">GET</td><td className="border p-2">/api/knotvite/templates</td><td className="border p-2">List all templates</td></tr>
              <tr><td className="border p-2">POST</td><td className="border p-2">/api/knotvite/templates</td><td className="border p-2">Create template</td></tr>
              <tr><td className="border p-2">PUT</td><td className="border p-2">/api/knotvite/templates/:id</td><td className="border p-2">Update template</td></tr>
              <tr><td className="border p-2">DELETE</td><td className="border p-2">/api/knotvite/templates/:id</td><td className="border p-2">Delete template</td></tr>
            </tbody>
          </table>

          <h3 className="text-lg font-semibold mt-4 mb-2">Public RSVP Form</h3>
          <table className="w-full border-collapse text-sm mb-4">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left">Method</th>
                <th className="border p-2 text-left">Endpoint</th>
                <th className="border p-2 text-left">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className="border p-2">GET</td><td className="border p-2">/api/knotvite/public/form/:eventId</td><td className="border p-2">Get public form</td></tr>
              <tr><td className="border p-2">POST</td><td className="border p-2">/api/knotvite/public/submit/:eventId</td><td className="border p-2">Submit RSVP</td></tr>
            </tbody>
          </table>

          <h3 className="text-lg font-semibold mt-4 mb-2">Submissions & Reporting</h3>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left">Method</th>
                <th className="border p-2 text-left">Endpoint</th>
                <th className="border p-2 text-left">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className="border p-2">GET</td><td className="border p-2">/api/knotvite/events/:eventId/submissions</td><td className="border p-2">List submissions</td></tr>
              <tr><td className="border p-2">GET</td><td className="border p-2">/api/knotvite/events/:eventId/reports/summary</td><td className="border p-2">Get summary stats</td></tr>
              <tr><td className="border p-2">GET</td><td className="border p-2">/api/knotvite/events/:eventId/reports/export</td><td className="border p-2">Export CSV/Excel</td></tr>
            </tbody>
          </table>
        </section>

        <section className="mb-8 print-break">
          <h2 className="text-2xl font-bold text-gray-900 border-b pb-2 mb-4">5. Frontend Components</h2>
          
          <h3 className="text-lg font-semibold mt-4 mb-2">New Pages</h3>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left">Route</th>
                <th className="border p-2 text-left">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className="border p-2">/knotvite</td><td className="border p-2">KnotVite Dashboard</td></tr>
              <tr><td className="border p-2">/knotvite/form-builder/:eventId</td><td className="border p-2">Drag-and-drop Form Builder</td></tr>
              <tr><td className="border p-2">/knotvite/rsvp/:eventId</td><td className="border p-2">Public RSVP Form</td></tr>
              <tr><td className="border p-2">/knotvite/submissions/:eventId</td><td className="border p-2">Submissions List</td></tr>
              <tr><td className="border p-2">/knotvite/reports/:eventId</td><td className="border p-2">Reports & Analytics</td></tr>
              <tr><td className="border p-2">/knotvite/import/:eventId</td><td className="border p-2">Bulk Import (Pro)</td></tr>
              <tr><td className="border p-2">/admin/knotvite</td><td className="border p-2">Super Admin Dashboard</td></tr>
            </tbody>
          </table>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 border-b pb-2 mb-4">6. Security & Performance</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Security Measures</h3>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Input sanitization with Zod validation</li>
                <li>• Rate limiting (5 submissions/IP/hour)</li>
                <li>• CSRF protection with SameSite cookies</li>
                <li>• XSS prevention with React escaping</li>
                <li>• SQL injection prevention via Drizzle ORM</li>
                <li>• File upload validation (5MB limit)</li>
                <li>• Optional GDPR consent checkbox</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Performance Optimizations</h3>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Pagination (50 items per page)</li>
                <li>• Lazy loading for reports</li>
                <li>• Database indexes on key columns</li>
                <li>• React Query caching (5-min stale)</li>
                <li>• Server-side filtering</li>
                <li>• Debounced search (300ms)</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 border-b pb-2 mb-4">7. Pricing & Feature Gating</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Free Plan</h3>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• 1 Event</li>
                <li>• 100 Guests per Event</li>
                <li>• 3 Custom Fields</li>
                <li>• Basic CSV Export</li>
                <li className="text-red-600">✗ Bulk CSV Import</li>
                <li className="text-red-600">✗ Excel Export</li>
                <li className="text-red-600">✗ WhatsApp Integration</li>
                <li className="text-red-600">✗ Branding Removal</li>
              </ul>
            </div>
            <div className="p-4 border-2 border-primary rounded-lg bg-green-50">
              <h3 className="text-lg font-semibold mb-2">Pro Plan</h3>
              <p className="text-sm text-gray-600 mb-2">₹299/month or ₹2,999/year</p>
              <ul className="text-sm text-gray-700 space-y-1">
                <li className="text-green-600">✓ Unlimited Events</li>
                <li className="text-green-600">✓ Unlimited Guests</li>
                <li className="text-green-600">✓ Unlimited Custom Fields</li>
                <li className="text-green-600">✓ CSV/Excel Import</li>
                <li className="text-green-600">✓ Excel Export</li>
                <li className="text-green-600">✓ WhatsApp Integration</li>
                <li className="text-green-600">✓ Branding Removal</li>
              </ul>
            </div>
          </div>

          <div className="mt-4 p-4 bg-amber-50 border-l-4 border-amber-500 rounded">
            <h4 className="font-semibold text-amber-800">Important UX Principle</h4>
            <p className="text-sm text-gray-700 mt-1">
              Free users who hit plan limits retain <strong>read access</strong> to all existing RSVP data. 
              Only <strong>new submissions</strong> are blocked until upgrade. Users never lose access to their data.
            </p>
            <div className="mt-2 text-xs text-gray-600">
              <span className="text-green-600">✓ View/Export/Edit existing data</span> | 
              <span className="text-red-600 ml-2">✗ New submissions blocked</span>
            </div>
          </div>
        </section>

        <section className="mb-8 print-break">
          <h2 className="text-2xl font-bold text-gray-900 border-b pb-2 mb-4">8. File Structure</h2>
          
          <pre className="bg-gray-100 p-4 rounded-lg text-xs overflow-x-auto font-mono">
{`shared/
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
│   └── knotvite-public/
│       └── rsvp.tsx            # Public RSVP form
└── components/
    └── knotvite/               # Reusable components`}
          </pre>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 border-b pb-2 mb-4">9. Dependencies</h2>
          
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left">Package</th>
                <th className="border p-2 text-left">Purpose</th>
                <th className="border p-2 text-left">Phase</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className="border p-2">@dnd-kit/core</td><td className="border p-2">Drag-and-drop for form builder</td><td className="border p-2">Phase 1</td></tr>
              <tr><td className="border p-2">@dnd-kit/sortable</td><td className="border p-2">Sortable fields</td><td className="border p-2">Phase 1</td></tr>
              <tr><td className="border p-2">xlsx</td><td className="border p-2">Excel file generation</td><td className="border p-2">Phase 2</td></tr>
              <tr><td className="border p-2">papaparse</td><td className="border p-2">CSV parsing</td><td className="border p-2">Phase 2</td></tr>
            </tbody>
          </table>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 border-b pb-2 mb-4">10. Timeline Estimate</h2>
          
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left">Phase</th>
                <th className="border p-2 text-left">Features</th>
                <th className="border p-2 text-left">Duration</th>
                <th className="border p-2 text-left">Priority</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-green-50">
                <td className="border p-2 font-medium">Phase 1</td>
                <td className="border p-2">Form Builder, Public Form, Submissions, Basic Reports</td>
                <td className="border p-2">2-3 weeks</td>
                <td className="border p-2 text-green-700">High</td>
              </tr>
              <tr className="bg-blue-50">
                <td className="border p-2 font-medium">Phase 2</td>
                <td className="border p-2">Advanced Reports, Bulk Import, Feature Gating</td>
                <td className="border p-2">2 weeks</td>
                <td className="border p-2 text-blue-700">Medium</td>
              </tr>
              <tr className="bg-purple-50">
                <td className="border p-2 font-medium">Phase 3</td>
                <td className="border p-2">WhatsApp, Super Admin Dashboard</td>
                <td className="border p-2">1-2 weeks</td>
                <td className="border p-2 text-purple-700">Low</td>
              </tr>
            </tbody>
          </table>
          
          <p className="mt-4 text-lg font-semibold text-gray-900">Total Estimated Duration: 5-7 weeks</p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 border-b pb-2 mb-4">Success Metrics</h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-gray-800">Phase 1 Success Criteria</h3>
              <ul className="text-sm text-gray-700 mt-1 space-y-1">
                <li>☐ Organizer can create custom RSVP form with 5+ field types</li>
                <li>☐ Public form renders correctly on mobile</li>
                <li>☐ Guests can submit RSVP without authentication</li>
                <li>☐ Organizer can view and filter submissions</li>
                <li>☐ Basic CSV export works</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">Phase 2 Success Criteria</h3>
              <ul className="text-sm text-gray-700 mt-1 space-y-1">
                <li>☐ Excel export includes all custom fields</li>
                <li>☐ Bulk import handles 1000+ rows</li>
                <li>☐ Free plan limits enforced correctly</li>
                <li>☐ Pro plan upgrade flow works with Razorpay</li>
              </ul>
            </div>
          </div>
        </section>

        <footer className="border-t pt-6 mt-8 text-center text-gray-500 text-sm">
          <p>Document prepared for AtBott Wedding SaaS Platform</p>
          <p className="mt-1">KnotVite RSVP SaaS Implementation Plan v1.0</p>
        </footer>
      </div>
    </div>
  );
}

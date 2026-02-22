import OpenAI from "openai";
import { storage } from "./storage";
import * as documentService from "./document-service";
import { sendWhatsAppMessage, sendGeneralNotification } from "./whatsapp-service";
import { db } from "./db";
import { oaksyActionLogs } from "@shared/schema";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_CONVERSATION_HISTORY = 10;

export interface OaksyContext {
  userId: string;
  userName?: string;
  userRole: string;
  department?: string;
  allowedPages?: string[];
  events?: any[];
  employees?: any[];
  banks?: any[];
  daybookCategories?: any[];
  daybookSummary?: {
    totalIncome: number;
    totalExpense: number;
    balance: number;
  };
}

export interface OaksyActionResult {
  response: string;
  actions?: {
    type: string;
    data: any;
    success: boolean;
    message: string;
  }[];
}

// =============================================
// ROLE-BASED PERMISSION CONFIGURATION
// =============================================

interface RolePermission {
  canDo: string[];
  cannotDo: string[];
  allowedToolPrefixes: string[];
  blockedTools: string[];
  requiresConfirmation: string[];
}

const ROLE_PERMISSIONS: Record<string, RolePermission> = {
  superadmin: {
    canDo: [
      'Full system authority across all modules',
      'Create, edit, delete events, employees, financial records',
      'Send bulk WhatsApp messages',
      'Override financial records',
      'Delete any records',
      'Send company-wide notifications',
      'Access all dashboards and reports',
    ],
    cannotDo: [],
    allowedToolPrefixes: ['*'],
    blockedTools: [],
    requiresConfirmation: [
      'send_whatsapp_message',
      'delete_event',
      'delete_employee',
      'delete_daybook_entry',
      'delete_meeting',
    ],
  },
  wedding_planner: {
    canDo: [
      'Create and duplicate estimates',
      'Assign and manage clients',
      'View event details for assigned events',
      'Upload estimate screenshots for cloning',
      'Create sales leads',
      'Generate smart estimates',
    ],
    cannotDo: [
      'Modify accounting ledger or daybook entries',
      'Send company-wide notifications or bulk WhatsApp',
      'Override financial records',
      'Access other planners events',
      'Delete events or employees',
      'View bank balances or salary data',
    ],
    allowedToolPrefixes: ['view_events', 'create_event', 'update_event', 'get_sales_summary', 'create_sales_lead', 'create_estimate_from_data', 'generate_smart_estimate', 'create_invoice_from_data'],
    blockedTools: ['view_daybook', 'create_daybook_entry', 'delete_daybook_entry', 'view_banks', 'create_bank_transfer', 'send_whatsapp_message', 'delete_event', 'delete_employee', 'delete_meeting', 'view_users', 'create_user'],
    requiresConfirmation: [],
  },
  accountant: {
    canDo: [
      'Log payments via screenshot',
      'Categorize transactions',
      'View financial summaries and daybook',
      'Generate financial reports',
      'Create daybook entries',
      'Manage bank transfers',
      'View and create estimates/invoices',
    ],
    cannotDo: [
      'Modify event production data',
      'Edit estimates created by planners',
      'Send bulk WhatsApp messages',
      'Delete events',
      'Access HR salary data',
    ],
    allowedToolPrefixes: ['view_daybook', 'create_daybook_entry', 'view_banks', 'create_bank_transfer', 'get_sales_summary', 'view_events', 'add_daybook_entries_batch', 'create_estimate_from_data', 'create_invoice_from_data', 'get_business_analysis'],
    blockedTools: ['send_whatsapp_message', 'delete_event', 'delete_employee', 'create_event', 'create_employee', 'create_user', 'view_users'],
    requiresConfirmation: ['delete_daybook_entry'],
  },
  production: {
    canDo: [
      'View assigned events',
      'Update task status',
      'Request materials',
      'View vendor allocations',
    ],
    cannotDo: [
      'Modify financial entries or daybook',
      'Send bulk WhatsApp messages',
      'Access bank or salary data',
      'Create or delete events',
      'Edit estimates or invoices',
    ],
    allowedToolPrefixes: ['view_events'],
    blockedTools: ['view_daybook', 'create_daybook_entry', 'delete_daybook_entry', 'view_banks', 'create_bank_transfer', 'send_whatsapp_message', 'create_event', 'delete_event', 'create_employee', 'delete_employee', 'view_users', 'create_user', 'create_estimate_from_data', 'create_invoice_from_data'],
    requiresConfirmation: [],
  },
  warehouse_incharge: {
    canDo: [
      'Update inventory levels',
      'Log material dispatch',
      'Track stock usage per event',
      'View low stock alerts',
    ],
    cannotDo: [
      'Modify event budgets or financial entries',
      'Access payroll or salary data',
      'Send notifications or bulk WhatsApp',
      'Create or delete events',
      'Access bank data',
    ],
    allowedToolPrefixes: ['view_events'],
    blockedTools: ['view_daybook', 'create_daybook_entry', 'delete_daybook_entry', 'view_banks', 'create_bank_transfer', 'send_whatsapp_message', 'create_event', 'delete_event', 'create_employee', 'delete_employee', 'view_users', 'create_user', 'create_estimate_from_data', 'create_invoice_from_data'],
    requiresConfirmation: [],
  },
  employee: {
    canDo: [
      'View assigned tasks and events',
      'Ask workflow help',
      'Submit leave requests',
      'Upload task proof',
    ],
    cannotDo: [
      'Access financial data, daybook, or bank accounts',
      'Access other department dashboards',
      'Send bulk communications',
      'Create or edit events',
      'View employee salary data',
    ],
    allowedToolPrefixes: ['view_events', 'view_leave_requests', 'get_employee_leave_balance'],
    blockedTools: ['view_daybook', 'create_daybook_entry', 'delete_daybook_entry', 'view_banks', 'create_bank_transfer', 'send_whatsapp_message', 'create_event', 'delete_event', 'create_employee', 'delete_employee', 'view_users', 'create_user', 'create_estimate_from_data', 'create_invoice_from_data', 'get_business_analysis'],
    requiresConfirmation: [],
  },
};

function getRolePermission(role: string): RolePermission {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS['employee'];
}

// =============================================
// ACTION LOGGING
// =============================================

async function logOaksyAction(params: {
  userId: string;
  userRole: string;
  conversationId?: string;
  prompt: string;
  aiOutput?: string;
  actionType?: string;
  actionData?: any;
  executedAction?: string;
  status: string;
  error?: string;
}): Promise<void> {
  try {
    await db.insert(oaksyActionLogs).values({
      userId: params.userId,
      userRole: params.userRole,
      conversationId: params.conversationId || null,
      prompt: params.prompt.substring(0, 5000),
      aiOutput: params.aiOutput?.substring(0, 5000) || null,
      actionType: params.actionType || null,
      actionData: params.actionData || null,
      executedAction: params.executedAction || null,
      status: params.status,
      error: params.error || null,
    });
  } catch (err) {
    console.error('[Oaksy Log] Failed to write action log:', err);
  }
}

// Map pages to their associated tool capabilities (only existing tools)
const PAGE_TO_TOOLS: Record<string, string[]> = {
  'dashboard': ['view_events', 'view_employees', 'view_daybook', 'view_banks', 'get_sales_summary', 'add_vendor_costs_batch', 'add_daybook_entries_batch', 'create_estimate_from_data', 'create_invoice_from_data', 'generate_smart_estimate', 'get_employee_leave_balance', 'view_leave_requests'],
  'event-calendar': ['view_events', 'create_event', 'update_event', 'delete_event', 'get_sales_summary'],
  'team-calendar': ['view_meetings', 'create_meeting', 'update_meeting', 'delete_meeting'],
  'event-database': ['view_events', 'create_event', 'update_event', 'delete_event', 'get_sales_summary', 'add_vendor_costs_batch', 'add_daybook_entries_batch', 'create_estimate_from_data', 'create_invoice_from_data', 'generate_smart_estimate'],
  'event-milestones': ['view_events', 'update_event'],
  'daybook': ['view_daybook', 'create_daybook_entry', 'delete_daybook_entry', 'create_bank_transfer', 'view_banks', 'get_sales_summary', 'add_daybook_entries_batch'],
  'oak-book': ['view_daybook', 'view_banks', 'create_daybook_entry', 'create_bank_transfer', 'get_sales_summary', 'add_daybook_entries_batch', 'create_estimate_from_data', 'create_invoice_from_data', 'generate_smart_estimate'],
  'oak-sales': ['view_events', 'create_event', 'update_event', 'get_sales_summary', 'create_sales_lead', 'generate_smart_estimate'],
  'oak-inventory': ['view_events'],
  'execution-plan': ['view_events'],
  'hr': ['view_employees', 'create_employee', 'update_employee', 'delete_employee', 'view_leave_requests', 'update_leave_request', 'send_salary_slips_whatsapp', 'get_employee_leave_balance'],
  'employee-portal': [],
  'oaksy': [],
  'admin': ['view_users', 'create_user', 'view_employees', 'view_events', 'view_daybook', 'view_banks', 'view_meetings', 'view_leave_requests', 'get_sales_summary', 'send_salary_slips_whatsapp', 'get_employee_leave_balance'],
  'management-mis': ['view_events', 'view_daybook', 'view_banks', 'get_sales_summary', 'get_business_analysis'],
};

// All available Oaksy tools with their definitions
const ALL_OAKSY_TOOLS: Record<string, OpenAI.Chat.Completions.ChatCompletionTool> = {
  get_business_analysis: {
    type: "function",
    function: {
      name: "get_business_analysis",
      description: "Get a comprehensive business analysis report with all key metrics for senior consultant-level insights. Includes: revenue & profit trends (FY and monthly), cash flow analysis, sales pipeline health, expense breakdown, accounts receivable aging, future bookings forecast, planner performance, and operational KPIs. ALWAYS use this tool when asked to 'analyze the business', 'give business report', 'how is the business doing', 'business insights', 'MIS analysis', etc.",
      parameters: {
        type: "object",
        properties: {
          fiscalYear: { type: "number", description: "Fiscal year to analyze (e.g., 2025 means FY 2025-26, April to March). Defaults to current FY." },
        },
        required: [],
      },
    },
  },
  // Sales summary tool - calculates accurate totals
  get_sales_summary: {
    type: "function",
    function: {
      name: "get_sales_summary",
      description: "Get accurate sales figures including total booked sales, payments received, and outstanding amounts. ALWAYS use this tool when asked about sales totals, revenue, or financial summaries for events. Can filter by planner, year, month, or event type.",
      parameters: {
        type: "object",
        properties: {
          planner: { type: "string", description: "Filter by wedding planner name (e.g., 'Femina KM', 'Femina'). Partial match supported." },
          year: { type: "number", description: "Filter by year (e.g., 2024, 2025). If not provided, returns all-time totals." },
          month: { type: "number", description: "Filter by month (1-12). Requires year to be set." },
          eventType: { type: "string", description: "Filter by event type (wedding, corporate, birthday, other)" },
          customer: { type: "string", description: "Filter by customer name. Partial match supported." },
        },
        required: [],
      },
    },
  },
  // View tools
  view_events: {
    type: "function",
    function: {
      name: "view_events",
      description: "View and search events. Use this to find events by date, customer, venue, or other criteria.",
      parameters: {
        type: "object",
        properties: {
          searchQuery: { type: "string", description: "Optional search term to filter events by title, customer, or venue" },
          startDate: { type: "string", description: "Optional start date filter (YYYY-MM-DD)" },
          endDate: { type: "string", description: "Optional end date filter (YYYY-MM-DD)" },
          limit: { type: "number", description: "Maximum number of events to return (default 10)" },
        },
        required: [],
      },
    },
  },
  view_meetings: {
    type: "function",
    function: {
      name: "view_meetings",
      description: "View and search meetings/team calendar entries.",
      parameters: {
        type: "object",
        properties: {
          startDate: { type: "string", description: "Optional start date filter (YYYY-MM-DD)" },
          endDate: { type: "string", description: "Optional end date filter (YYYY-MM-DD)" },
          limit: { type: "number", description: "Maximum number of meetings to return (default 10)" },
        },
        required: [],
      },
    },
  },
  view_daybook: {
    type: "function",
    function: {
      name: "view_daybook",
      description: "View daybook entries (income/expense records). Use this to check financial transactions.",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["income", "expense", "all"], description: "Filter by entry type" },
          startDate: { type: "string", description: "Optional start date filter (YYYY-MM-DD)" },
          endDate: { type: "string", description: "Optional end date filter (YYYY-MM-DD)" },
          category: { type: "string", description: "Filter by category" },
          limit: { type: "number", description: "Maximum entries to return (default 20)" },
        },
        required: [],
      },
    },
  },
  view_employees: {
    type: "function",
    function: {
      name: "view_employees",
      description: "View employee list and details.",
      parameters: {
        type: "object",
        properties: {
          department: { type: "string", description: "Filter by department" },
          searchQuery: { type: "string", description: "Search by name or email" },
        },
        required: [],
      },
    },
  },
  view_banks: {
    type: "function",
    function: {
      name: "view_banks",
      description: "View bank accounts and their current balances.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  view_users: {
    type: "function",
    function: {
      name: "view_users",
      description: "View system users and their roles. (Admin only)",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  view_leave_requests: {
    type: "function",
    function: {
      name: "view_leave_requests",
      description: "View leave requests from employees.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["pending", "approved", "rejected", "all"], description: "Filter by status" },
          employeeName: { type: "string", description: "Filter by employee name (partial match supported)" },
        },
        required: [],
      },
    },
  },
  get_employee_leave_balance: {
    type: "function",
    function: {
      name: "get_employee_leave_balance",
      description: "Get leave balance for a specific employee or all employees. Shows allocated, used, and remaining leaves for the current year by category. Use this when asked about remaining leaves, leave balance, how many leaves left, etc.",
      parameters: {
        type: "object",
        properties: {
          employeeName: { type: "string", description: "Employee name to check leave balance for (partial match supported). If not provided, returns summary for all employees." },
        },
        required: [],
      },
    },
  },

  // Create tools
  create_event: {
    type: "function",
    function: {
      name: "create_event",
      description: "Create a new event booking. Use this when the user wants to book a new wedding, corporate event, or celebration.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "The title of the event" },
          date: { type: "string", description: "The date of the event (YYYY-MM-DD)" },
          time: { type: "string", description: "The time of the event (HH:MM)" },
          type: { type: "string", enum: ["wedding", "corporate", "birthday", "other"], description: "The type of event" },
          customer: { type: "string", description: "The customer/client name" },
          venue: { type: "string", description: "The venue name and location" },
          planner: { type: "string", description: "The wedding planner or event coordinator" },
          salesValue: { type: "number", description: "The total value in Indian Rupees" },
        },
        required: ["title", "date", "type", "customer", "venue", "planner"],
      },
    },
  },
  create_meeting: {
    type: "function",
    function: {
      name: "create_meeting",
      description: "Schedule a new team meeting or client meeting.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "The title/subject of the meeting" },
          date: { type: "string", description: "The date of the meeting (YYYY-MM-DD)" },
          time: { type: "string", description: "The time of the meeting (HH:MM)" },
          attendees: { type: "string", description: "Comma-separated list of attendee names" },
        },
        required: ["title", "date", "time"],
      },
    },
  },
  create_daybook_entry: {
    type: "function",
    function: {
      name: "create_daybook_entry",
      description: "Create a new daybook entry for income or expense.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "The date (YYYY-MM-DD)" },
          description: { type: "string", description: "Description of the transaction" },
          type: { type: "string", enum: ["income", "expense"], description: "Income or expense" },
          amount: { type: "number", description: "Amount in Indian Rupees" },
          category: { type: "string", description: "Category of the entry" },
          eventName: { type: "string", description: "Optional: Related event name" },
          vendorName: { type: "string", description: "Optional: Vendor name" },
        },
        required: ["date", "description", "type", "amount", "category"],
      },
    },
  },
  create_bank_transfer: {
    type: "function",
    function: {
      name: "create_bank_transfer",
      description: "Create a bank-to-bank transfer.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "The date (YYYY-MM-DD)" },
          fromBank: { type: "string", description: "Source bank account name" },
          toBank: { type: "string", description: "Destination bank account name" },
          amount: { type: "number", description: "Amount to transfer in Rupees" },
          description: { type: "string", description: "Optional description" },
        },
        required: ["date", "fromBank", "toBank", "amount"],
      },
    },
  },
  create_employee: {
    type: "function",
    function: {
      name: "create_employee",
      description: "Add a new employee to the HR system.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Employee's full name" },
          email: { type: "string", description: "Employee's email address" },
          phone: { type: "string", description: "Phone number" },
          department: { type: "string", description: "Department name" },
          position: { type: "string", description: "Job position/title" },
          joiningDate: { type: "string", description: "Joining date (YYYY-MM-DD)" },
          salary: { type: "number", description: "Monthly salary in Rupees" },
        },
        required: ["name", "department", "position"],
      },
    },
  },
  create_user: {
    type: "function",
    function: {
      name: "create_user",
      description: "Create a new system user account. (Admin only)",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "User's full name" },
          email: { type: "string", description: "User's email address" },
          password: { type: "string", description: "Initial password" },
          role: { type: "string", description: "User role (admin, manager, employee, etc.)" },
        },
        required: ["name", "email", "password", "role"],
      },
    },
  },

  // Update tools
  update_event: {
    type: "function",
    function: {
      name: "update_event",
      description: "Update an existing event's details.",
      parameters: {
        type: "object",
        properties: {
          eventId: { type: "string", description: "The ID of the event to update" },
          eventTitle: { type: "string", description: "Or search by event title to find the event" },
          updates: {
            type: "object",
            description: "Fields to update",
            properties: {
              title: { type: "string" },
              date: { type: "string" },
              time: { type: "string" },
              venue: { type: "string" },
              customer: { type: "string" },
              planner: { type: "string" },
              salesValue: { type: "string" },
              paymentReceived: { type: "string" },
              cost: { type: "string" },
              status: { type: "string" },
            },
          },
        },
        required: ["updates"],
      },
    },
  },
  update_meeting: {
    type: "function",
    function: {
      name: "update_meeting",
      description: "Update an existing meeting.",
      parameters: {
        type: "object",
        properties: {
          meetingId: { type: "string", description: "The ID of the meeting" },
          meetingTitle: { type: "string", description: "Or search by meeting title" },
          updates: {
            type: "object",
            properties: {
              title: { type: "string" },
              date: { type: "string" },
              time: { type: "string" },
              attendees: { type: "string" },
            },
          },
        },
        required: ["updates"],
      },
    },
  },
  update_employee: {
    type: "function",
    function: {
      name: "update_employee",
      description: "Update an employee's information.",
      parameters: {
        type: "object",
        properties: {
          employeeId: { type: "string", description: "The ID of the employee" },
          employeeName: { type: "string", description: "Or search by employee name" },
          updates: {
            type: "object",
            properties: {
              name: { type: "string" },
              email: { type: "string" },
              phone: { type: "string" },
              department: { type: "string" },
              position: { type: "string" },
              salary: { type: "string" },
            },
          },
        },
        required: ["updates"],
      },
    },
  },
  update_leave_request: {
    type: "function",
    function: {
      name: "update_leave_request",
      description: "Approve or reject a leave request.",
      parameters: {
        type: "object",
        properties: {
          leaveRequestId: { type: "string", description: "The ID of the leave request" },
          status: { type: "string", enum: ["approved", "rejected"], description: "New status" },
          remarks: { type: "string", description: "Optional remarks" },
        },
        required: ["leaveRequestId", "status"],
      },
    },
  },

  // Delete tools
  delete_event: {
    type: "function",
    function: {
      name: "delete_event",
      description: "Delete an event. Use with caution.",
      parameters: {
        type: "object",
        properties: {
          eventId: { type: "string", description: "The ID of the event to delete" },
          eventTitle: { type: "string", description: "Or the title of the event to find and delete" },
          confirmDelete: { type: "boolean", description: "Must be true to confirm deletion" },
        },
        required: ["confirmDelete"],
      },
    },
  },
  delete_meeting: {
    type: "function",
    function: {
      name: "delete_meeting",
      description: "Delete a meeting.",
      parameters: {
        type: "object",
        properties: {
          meetingId: { type: "string", description: "The ID of the meeting" },
          confirmDelete: { type: "boolean", description: "Must be true to confirm deletion" },
        },
        required: ["meetingId", "confirmDelete"],
      },
    },
  },
  delete_daybook_entry: {
    type: "function",
    function: {
      name: "delete_daybook_entry",
      description: "Delete a daybook entry.",
      parameters: {
        type: "object",
        properties: {
          entryId: { type: "string", description: "The ID of the entry to delete" },
          confirmDelete: { type: "boolean", description: "Must be true to confirm deletion" },
        },
        required: ["entryId", "confirmDelete"],
      },
    },
  },
  delete_employee: {
    type: "function",
    function: {
      name: "delete_employee",
      description: "Remove an employee from the system.",
      parameters: {
        type: "object",
        properties: {
          employeeId: { type: "string", description: "The ID of the employee" },
          confirmDelete: { type: "boolean", description: "Must be true to confirm deletion" },
        },
        required: ["employeeId", "confirmDelete"],
      },
    },
  },

  // Special admin tools
  send_whatsapp_message: {
    type: "function",
    function: {
      name: "send_whatsapp_message",
      description: "Send a WhatsApp message to employees. (Superadmin only)",
      parameters: {
        type: "object",
        properties: {
          message: { type: "string", description: "The message content" },
          targetMode: { type: "string", enum: ["selected", "department", "all"], description: "Recipient selection mode" },
          employeeNames: { type: "array", items: { type: "string" }, description: "Specific employee names (for 'selected' mode)" },
          departments: { type: "array", items: { type: "string" }, description: "Department names (for 'department' mode)" },
        },
        required: ["message", "targetMode"],
      },
    },
  },

  send_salary_slips_whatsapp: {
    type: "function",
    function: {
      name: "send_salary_slips_whatsapp",
      description: "Send salary slips via WhatsApp to employees. Can send to all employees in a payroll run, or to specific employees. (Superadmin only)",
      parameters: {
        type: "object",
        properties: {
          payrollRunId: { type: "string", description: "The payroll run ID to send slips from" },
          employeeNames: { type: "array", items: { type: "string" }, description: "Specific employee names to send to (optional, sends to all if not specified)" },
          month: { type: "number", description: "Month number 1-12 to identify the payroll" },
          year: { type: "number", description: "Year of the payroll" },
        },
        required: [],
      },
    },
  },

  // Document generation tools (Superadmin only)
  generate_sales_report: {
    type: "function",
    function: {
      name: "generate_sales_report",
      description: "Generate a downloadable PDF sales report with event data, totals, and breakdown. (Superadmin only). IMPORTANT: When user says 'November 25' or 'Nov 25', they mean 'November 2025' (the whole month), so use year=2025, month=11. For a full month report, use the year and month parameters.",
      parameters: {
        type: "object",
        properties: {
          year: { type: "number", description: "Year for the report (e.g., 2024, 2025). Use this for month-based reports." },
          month: { type: "number", description: "Month number 1-12 (e.g., 11 for November). Use with year for monthly reports." },
          startDate: { type: "string", description: "Specific start date (YYYY-MM-DD). Only use if user specifies exact dates, not for month-based requests." },
          endDate: { type: "string", description: "Specific end date (YYYY-MM-DD). Only use if user specifies exact dates." },
          planner: { type: "string", description: "Filter by wedding planner name" },
          eventType: { type: "string", description: "Filter by event type (wedding, corporate, etc.)" },
        },
        required: [],
      },
    },
  },
  generate_invoice: {
    type: "function",
    function: {
      name: "generate_invoice",
      description: "Generate a downloadable PDF invoice for an event. (Superadmin only)",
      parameters: {
        type: "object",
        properties: {
          eventId: { type: "string", description: "The event ID to generate invoice for" },
          eventTitle: { type: "string", description: "Event title to search for (alternative to eventId)" },
        },
        required: [],
      },
    },
  },
  generate_quote: {
    type: "function",
    function: {
      name: "generate_quote",
      description: "Generate a downloadable PDF quotation/proposal for a potential customer. (Superadmin only)",
      parameters: {
        type: "object",
        properties: {
          customerName: { type: "string", description: "Customer name" },
          eventDate: { type: "string", description: "Proposed event date (YYYY-MM-DD)" },
          eventType: { type: "string", description: "Type of event (wedding, corporate, birthday, etc.)" },
          venue: { type: "string", description: "Venue name or location" },
          services: {
            type: "array",
            items: {
              type: "object",
              properties: {
                description: { type: "string" },
                amount: { type: "number" },
              },
              required: ["description", "amount"],
            },
            description: "List of services with descriptions and amounts",
          },
          notes: { type: "string", description: "Additional notes for the quote" },
        },
        required: ["customerName", "eventDate", "eventType", "venue", "services"],
      },
    },
  },
  generate_financial_report: {
    type: "function",
    function: {
      name: "generate_financial_report",
      description: "Generate a downloadable Excel financial report with events and daybook data. (Superadmin only)",
      parameters: {
        type: "object",
        properties: {
          startDate: { type: "string", description: "Start date for report (YYYY-MM-DD)" },
          endDate: { type: "string", description: "End date for report (YYYY-MM-DD)" },
          includeEvents: { type: "boolean", description: "Include events data (default true)" },
          includeDaybook: { type: "boolean", description: "Include daybook data (default true)" },
        },
        required: [],
      },
    },
  },
  generate_employee_report: {
    type: "function",
    function: {
      name: "generate_employee_report",
      description: "Generate a downloadable PDF report of all employees. (Superadmin only)",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  create_sales_lead: {
    type: "function",
    function: {
      name: "create_sales_lead",
      description: "Create a new sales lead in Oak Sales CRM. The lead will be assigned to a wedding planner who will receive a WhatsApp notification. Use this when the user wants to add a new lead or enquiry.",
      parameters: {
        type: "object",
        properties: {
          customerName: { type: "string", description: "Customer/client name (required)" },
          customerPhone: { type: "string", description: "Customer phone number" },
          customerEmail: { type: "string", description: "Customer email address" },
          eventDate: { type: "string", description: "Proposed event date (YYYY-MM-DD format)" },
          eventType: { type: "string", description: "Type of event (e.g., Wedding, Reception, Engagement, Corporate)" },
          venue: { type: "string", description: "Venue name or location" },
          estimatedValue: { type: "number", description: "Estimated deal value in INR" },
          assignTo: { type: "string", description: "Wedding planner name to assign (e.g., 'Fida', 'Femina')" },
          notes: { type: "string", description: "Additional notes about the lead" },
        },
        required: ["customerName"],
      },
    },
  },
  add_vendor_costs_batch: {
    type: "function",
    function: {
      name: "add_vendor_costs_batch",
      description: "Add multiple vendor costs to an event at once. Use this when the user uploads a screenshot/image of a vendor payment list or spreadsheet and asks to add them as vendor costs. Extract vendor names, service descriptions, amounts, and payment status from the image and use this tool to add them all. If the user specifies which event, use that. If not specified, ask the user which event before calling this tool. You can see the list of events in your context data.",
      parameters: {
        type: "object",
        properties: {
          eventTitle: { type: "string", description: "The title of the event to add vendor costs to. Search by event name/title." },
          vendors: {
            type: "array",
            description: "Array of vendor cost entries extracted from the image",
            items: {
              type: "object",
              properties: {
                vendorName: { type: "string", description: "Name of the vendor" },
                serviceDescription: { type: "string", description: "Description of service provided" },
                estimatedAmount: { type: "string", description: "Estimated/quoted amount as string" },
                actualAmount: { type: "string", description: "Actual amount paid as string (if available)" },
                paymentStatus: { type: "string", enum: ["pending", "partial", "paid"], description: "Payment status" },
              },
              required: ["vendorName", "serviceDescription", "estimatedAmount"],
            },
          },
        },
        required: ["eventTitle", "vendors"],
      },
    },
  },
  add_daybook_entries_batch: {
    type: "function",
    function: {
      name: "add_daybook_entries_batch",
      description: "Add multiple daybook entries (daily expenses or income) at once from a screenshot. Use this when user uploads a screenshot of expenses, bills, payment receipts, or income records and asks to add them to daily expenses/daybook. Extract each line item with date, description, amount, type (income/expense), and category from the image. If date is not visible, use today's date. Ask the user to confirm before adding.",
      parameters: {
        type: "object",
        properties: {
          entries: {
            type: "array",
            description: "Array of daybook entries extracted from the image",
            items: {
              type: "object",
              properties: {
                date: { type: "string", description: "Date in YYYY-MM-DD format. Use today if not visible in image." },
                description: { type: "string", description: "Description of the transaction" },
                type: { type: "string", enum: ["income", "expense"], description: "Whether this is income or expense" },
                amount: { type: "number", description: "Amount in Indian Rupees" },
                category: { type: "string", description: "Category (e.g., Office Expense, Travel, Food, Salary, Event Income, etc.)" },
                eventName: { type: "string", description: "Related event name if applicable" },
                vendorName: { type: "string", description: "Vendor/payee name if visible" },
              },
              required: ["date", "description", "type", "amount", "category"],
            },
          },
        },
        required: ["entries"],
      },
    },
  },
  create_estimate_from_data: {
    type: "function",
    function: {
      name: "create_estimate_from_data",
      description: "Create an estimate/quotation in Oak Book from data extracted from a screenshot or user instructions. Use this when user uploads an image of a quotation, price list, or service breakdown and asks to create an estimate. Extract customer name, event details, line items with quantities and rates. The estimate will be saved and can be viewed in Oak Book.",
      parameters: {
        type: "object",
        properties: {
          customerName: { type: "string", description: "Customer/client name" },
          customerPhone: { type: "string", description: "Customer phone number if visible" },
          customerEmail: { type: "string", description: "Customer email if visible" },
          customerAddress: { type: "string", description: "Customer address if visible" },
          eventTitle: { type: "string", description: "Event name to link this estimate to (optional)" },
          subject: { type: "string", description: "Subject line for the estimate (e.g., 'Wedding Decoration & Catering')" },
          date: { type: "string", description: "Estimate date in YYYY-MM-DD format. Use today if not specified." },
          dueDate: { type: "string", description: "Due date in YYYY-MM-DD format if specified" },
          lineItems: {
            type: "array",
            description: "Array of line items for the estimate",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Item/service name" },
                description: { type: "string", description: "Detailed description" },
                quantity: { type: "number", description: "Quantity (default 1)" },
                rate: { type: "number", description: "Rate per unit in INR" },
                isHeading: { type: "boolean", description: "True if this is a section heading (e.g., 'DAY 1: MEHANDI')" },
              },
              required: ["name", "quantity", "rate"],
            },
          },
          discountPercent: { type: "number", description: "Discount percentage if applicable" },
          serviceChargePercent: { type: "number", description: "Service charge percentage if applicable" },
          notes: { type: "string", description: "Additional notes" },
          terms: { type: "string", description: "Terms and conditions" },
        },
        required: ["customerName", "lineItems"],
      },
    },
  },
  generate_smart_estimate: {
    type: "function",
    function: {
      name: "generate_smart_estimate",
      description: "Generate a smart estimate/quotation based on event type, budget, and required heads. Oaksy will analyze past estimates for similar events and create a professionally structured estimate with appropriate budget allocation across heads. Use this when a planner asks to create/generate an estimate and provides budget, event type, or heads needed.",
      parameters: {
        type: "object",
        properties: {
          customerName: { type: "string", description: "Customer/client name" },
          eventType: { type: "string", description: "Type of event (Wedding, Reception, Engagement, Sangeet, etc.)" },
          totalBudget: { type: "number", description: "Total budget in INR" },
          heads: { type: "array", items: { type: "string" }, description: "Major heads to include (e.g., Decor, Catering, Photography, Entertainment, Lighting, Venue, Makeup, Transport)" },
          guestCount: { type: "number", description: "Approximate number of guests (if mentioned)" },
          venueType: { type: "string", description: "Indoor/Outdoor/Both (if mentioned)" },
          eventDate: { type: "string", description: "Event date in YYYY-MM-DD format (if mentioned)" },
          notes: { type: "string", description: "Any additional notes or special requirements" },
        },
        required: ["customerName", "eventType", "totalBudget", "heads"],
      },
    },
  },
  create_invoice_from_data: {
    type: "function",
    function: {
      name: "create_invoice_from_data",
      description: "Create an invoice in Oak Book from data extracted from a screenshot or user instructions. Use this when user uploads an image of an invoice or billing details and asks to create an invoice. Extract customer name, line items, amounts, and payment terms. The invoice will be saved and can be viewed in Oak Book.",
      parameters: {
        type: "object",
        properties: {
          customerName: { type: "string", description: "Customer/client name" },
          customerPhone: { type: "string", description: "Customer phone number if visible" },
          customerEmail: { type: "string", description: "Customer email if visible" },
          customerAddress: { type: "string", description: "Customer address if visible" },
          eventTitle: { type: "string", description: "Event name to link this invoice to (optional)" },
          subject: { type: "string", description: "Subject line for the invoice" },
          date: { type: "string", description: "Invoice date in YYYY-MM-DD format. Use today if not specified." },
          dueDate: { type: "string", description: "Due date in YYYY-MM-DD format if specified" },
          lineItems: {
            type: "array",
            description: "Array of line items for the invoice",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Item/service name" },
                description: { type: "string", description: "Detailed description" },
                quantity: { type: "number", description: "Quantity (default 1)" },
                rate: { type: "number", description: "Rate per unit in INR" },
                isHeading: { type: "boolean", description: "True if this is a section heading" },
              },
              required: ["name", "quantity", "rate"],
            },
          },
          discountPercent: { type: "number", description: "Discount percentage if applicable" },
          serviceChargePercent: { type: "number", description: "Service charge percentage if applicable" },
          notes: { type: "string", description: "Additional notes" },
          terms: { type: "string", description: "Payment terms" },
        },
        required: ["customerName", "lineItems"],
      },
    },
  },
};

// Get tools available for a user based on their role and permissions
function getToolsForUser(userRole: string, allowedPages: string[]): OpenAI.Chat.Completions.ChatCompletionTool[] {
  const rolePerms = getRolePermission(userRole);
  const availableToolNames = new Set<string>();

  if (rolePerms.allowedToolPrefixes.includes('*')) {
    return Object.values(ALL_OAKSY_TOOLS);
  }

  for (const pageId of allowedPages) {
    const toolsForPage = PAGE_TO_TOOLS[pageId] || [];
    toolsForPage.forEach(toolName => {
      if (!rolePerms.blockedTools.includes(toolName)) {
        availableToolNames.add(toolName);
      }
    });
  }

  rolePerms.allowedToolPrefixes.forEach(prefix => {
    if (ALL_OAKSY_TOOLS[prefix]) {
      availableToolNames.add(prefix);
    }
  });

  rolePerms.blockedTools.forEach(tool => availableToolNames.delete(tool));

  const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [];
  Array.from(availableToolNames).forEach(toolName => {
    if (ALL_OAKSY_TOOLS[toolName]) {
      tools.push(ALL_OAKSY_TOOLS[toolName]);
    }
  });

  return tools;
}

function getSystemPromptForUser(userRole: string, allowedPages: string[], department: string, userName?: string): string {
  const rolePerms = getRolePermission(userRole);

  const basePrompt = `You are the AI Assistant for this event management company.
You must strictly operate within the company's internal operations.

ALLOWED DOMAINS:
- Wedding planning and event coordination
- Estimates & quotations
- Client management
- Vendor coordination
- Production management
- Warehouse inventory
- Accounting & ledger entries
- Employee support
- Internal communication
- Performance tracking

If a request falls outside these domains, respond:
"This request is outside the operational scope."
Never provide general world knowledge, trivia, or non-business answers.

CURRENT USER: ${userName || 'Unknown'} | ROLE: ${userRole.toUpperCase()} | DEPARTMENT: ${department || 'General'}
Today's date is: ${new Date().toISOString().split('T')[0]}

YOUR ROLE-BASED ACCESS:
Can do:
${rolePerms.canDo.map(c => `- ${c}`).join('\n')}
${rolePerms.cannotDo.length > 0 ? `\nCannot do:\n${rolePerms.cannotDo.map(c => `- ${c}`).join('\n')}` : ''}

CORE PHILOSOPHY:
Think like a human expert. When a user gives you incomplete information, DON'T ask unnecessary questions — use your intelligence and the system data to fill in the gaps. Act decisively, like a trusted business partner who knows the company inside out.

YOUR THINKING APPROACH:
1. **Understand Intent, Not Just Words**: If someone says "add this bill", figure out WHERE it should go (daybook? vendor cost? invoice?) based on what the bill contains.
2. **Fill In Missing Details Intelligently**:
   - No date mentioned? Use today's date.
   - No category specified? Look at the description and pick the most logical one (e.g., "Uber ride" → Travel, "Flowers" → Event Materials, "Biryani for team" → Food & Beverages).
   - No event specified but the expense clearly relates to a client/event in the system? Auto-link it.
   - Customer name matches someone in the system? Auto-link the customer record.
3. **Cross-Reference Everything**: Always check the system context. If someone mentions "Sharma wedding", find the matching event. If they mention "the caterer", find the matching vendor.
4. **Be Proactive**: After completing an action, suggest the next logical step. Created an estimate? Mention they can share it via WhatsApp. Added expenses? Show the updated total for the day.
5. **Never Ask What You Can Figure Out**: If the answer is in the system data, use it. Only ask when you genuinely cannot determine the answer.

PERSONALITY:
- Confident, warm, and efficient — like a trusted colleague
- Use simple language, no jargon
- Always use Indian Rupees (₹) and DD/MM/YYYY date format
- Be concise but thorough
- Show personality — you're Oaksy, not a robot

SMART CATEGORIZATION RULES (use these when user doesn't specify):
- Food/catering/biryani/snacks → "Food & Beverages"
- Cab/uber/auto/fuel/diesel → "Travel & Transport"
- Flowers/decoration/mandap/lighting → "Event Materials"
- Printing/stationery/cards → "Printing & Stationery"
- Salary/wages/labour → "Staff & Labour"
- Rent/electricity/internet/phone → "Office Expenses"
- Photography/videography/drone → "Photography & Media"
- Sound/DJ/music/band → "Entertainment"
- Hotel/accommodation/rooms → "Accommodation"
- Gifts/return gifts/favours → "Gifts & Favours"
- If unclear, use "General Expense" for expenses or "Event Income" for income

ACTION RULES:
- When asked to perform an action, USE YOUR TOOLS immediately — don't describe what you would do
- Always confirm before DELETING anything (but for creating/adding, just do it and show what was done)
- After any action, give a clear summary with amounts and totals
- If multiple things need to happen (e.g., add expense + link to event), do them all in one go

IMAGE & SCREENSHOT INTELLIGENCE:
You can receive and analyze images. When a user sends a screenshot:
1. **Auto-detect the type**: Bill/receipt → daybook expense. Quotation/price list → create estimate. Invoice → create invoice. Vendor payment list → vendor costs.
2. **Extract EVERYTHING visible**: Names, amounts, dates, descriptions, phone numbers, addresses — capture it all.
3. **Take the right action automatically**: Don't ask "what should I do with this?" — figure it out from context. If user says "add this" with a bill image, add it to daybook. If they say "make estimate from this", create an estimate.
4. **Smart linking**: If the bill mentions a vendor/customer/event that exists in the system, auto-link it.
5. **Amounts**: Always parse as Indian Rupees. Handle formats like "1,50,000" or "1.5L" or "15K" correctly.

AVAILABLE IMAGE ACTIONS:
- Daily expenses/income → add_daybook_entries_batch (extract items and add to daybook)
- Vendor costs → add_vendor_costs_batch (extract vendor details and add to an event)
- Quotations/price lists → create_estimate_from_data (create formal estimate in Oak Book)
- Billing/invoicing → create_invoice_from_data (create invoice in Oak Book)

ESTIMATE CREATION RULES:
- When creating estimates from images/data, ALWAYS extract section headings (e.g., "WEDDING DECOR", "MANDAP", "FLORIST", "SHADES", "LIGHT & SOUND SYSTEM") as separate line items with isHeading=true, quantity=0, rate=0
- Section headings should appear BEFORE their child line items in the array
- If the user is a wedding planner, the customer will be auto-assigned to them. If customer doesn't exist, one will be auto-created and linked to the requesting planner
- Extract ALL details from the source: customer name, address, phone, subject, service charge percentage, discount, notes, terms
- Estimate numbers follow QT-XXXX format automatically

NATURAL LANGUAGE REPORTING:
When asked questions like "how are sales?", "how's business?", "what happened today?", "give me a summary", "how's this month going?", etc.:
1. Use your tools (get_sales_summary, view_events, view_daybook) to pull real data
2. Present the data conversationally with key insights, not raw numbers
3. Compare to previous periods when possible (e.g., "Sales are up 15% vs last month")
4. Highlight anomalies: unusually high expenses, overdue payments, approaching deadlines
5. End with 1-2 actionable suggestions

Example response style:
"This month is going great! You've booked ₹12.5L across 4 events, which is 20% higher than last month. Two things to watch: the Sharma wedding has ₹3.2L in vendor costs but only ₹2L received so far, and Femina has 3 leads older than a week. Want me to send her a reminder?"

PROACTIVE SUGGESTIONS:
After completing any action, suggest the logical next step:
- After adding income → "Want me to generate a receipt and notify the planner?"
- After creating an estimate → "Ready to share this with the client via WhatsApp?"
- After adding vendor costs → "The event's total cost is now ₹X (Y% of budget). Want me to alert the planner?"
- After creating an event → "Should I create a draft estimate for this event?"
- After viewing a lead → "This lead hasn't been updated in X days. Want me to remind the planner?"
- After viewing expenses → "Today's total expense is ₹X. The monthly total is ₹Y."

MULTI-STEP TASK EXECUTION:
When a task requires multiple steps, call ALL required tools — either in parallel in a single response or sequentially across multiple turns. NEVER claim you called a tool without actually calling it:
- "Add income of 2L for Sharma wedding and update payment received" → Create daybook entry + update event paymentReceived
- "Create estimate and send to client" → Create estimate + provide share link
- "Record payment and generate receipt" → Create daybook entry + auto-receipt will be generated
- "Close out the Mehta event" → Update status to completed + check if all vendor payments are done + summarize P&L
- "Create lead and estimate from this image" → Call create_sales_lead AND create_estimate_from_data tools together

CRITICAL ANTI-HALLUCINATION RULES:
- NEVER claim you performed an action (created estimate, added entry, etc.) unless you ACTUALLY called the corresponding tool and received a success response
- NEVER fabricate IDs, reference numbers, or confirmation codes
- If you need to create both a lead AND an estimate, you MUST call BOTH tools — do NOT call only create_sales_lead and then claim you also created an estimate
- If a tool call fails or you didn't call it, be honest about what happened and what still needs to be done
- After receiving an image with estimate data, if the user asks to create an estimate, you MUST call create_estimate_from_data with the extracted line items — reading the image is NOT the same as creating the estimate

MODULE-SPECIFIC HELP:
When users are on a specific page, provide context-aware assistance:
- **Dashboard**: Overview insights, quick actions, proactive alerts
- **Event Calendar**: Event scheduling, conflicts, timeline management
- **Event Database**: Full event lifecycle management, vendor costs, staff assignment
- **Oak Book (Estimates/Invoices)**: Document creation, smart estimates, financial documents
- **Daybook**: Daily expense/income tracking, bank reconciliation, category management
- **Oak Sales**: Lead management, pipeline insights, conversion tracking
- **HR**: Employee management, attendance, leave tracking, payroll
- **Oak Inventory**: Stock management, event-based reservations
- **RSVP**: Guest management, response tracking, logistics coordination
- **Management MIS**: Senior business consultant mode — provide CFO-level analysis with revenue trends, profit margins, cash flow health, collection efficiency, planner performance comparisons, expense optimization suggestions, receivables aging analysis, and actionable growth recommendations. Use get_business_analysis tool for comprehensive data.

AUTOMATION AWARENESS:
You should know about and inform users about the automated systems running in the background:
- Daily morning business report (7:00 AM)
- Night reminder summary (9:00 PM)
- Attendance check-in/out reminders (9:45 AM / 5:45 PM)
- 60-day payment milestone reminders
- Pre-event reminders (7/3/1 days before)
- Post-event auto-completion
- Budget alerts (80%/100% threshold)
- Stale lead reminders (5+ days)
- Vendor payment due alerts
- Low stock alerts
- Monthly P&L report (1st of month)
- Cashflow forecast (15th of month)
- Pipeline health alert (weekly Monday)
When asked "what automations do we have?" or "what does the system do automatically?", list these clearly.

DATA SECURITY & PRIVACY (CRITICAL):
- You ONLY have access to data relevant to the current user's role and permissions
- NEVER fabricate, guess, or make up data that isn't in the system context provided to you
- If the user asks about data you don't have in your context, it means they don't have permission to see it — politely say you don't have that information available
- NEVER share financial data (bank balances, daybook entries, salaries, sales values) with users who don't have financial module access
- NEVER share employee personal details (phone numbers, salaries, addresses) with users who don't have HR access
- Wedding planners should only see their own assigned events, not other planners' events
- Staff members should only see events they are assigned to
- When in doubt about access, err on the side of NOT sharing sensitive information`;

  if (userRole === 'superadmin') {
    return `${basePrompt}

USER ROLE: SUPERADMIN (Full Access)
You have COMPLETE access to all modules and can perform ANY operation in the system:
- Events: View, create, edit, delete any event
- Meetings: View, create, edit, delete any meeting
- Daybook: View, create, edit, delete financial entries
- Bank Transfers: Create bank-to-bank transfers
- HR: View, create, edit, delete employees, manage leave requests
- Users: View, create, edit, delete system users
- WhatsApp: Send messages to employees
- All other modules: Full access

You are the ultimate authority in this system. Help the superadmin manage Oak Street Events efficiently.`;
  }

  if (userRole === 'admin') {
    const adminAccessibleModules = allowedPages
      .filter(p => PAGE_TO_TOOLS[p] && PAGE_TO_TOOLS[p].length > 0)
      .map(p => `- ${p}`)
      .join('\n');
    
    return `${basePrompt}

USER ROLE: ADMIN
You have administrative access to the modules you are assigned to. Your accessible pages:
${adminAccessibleModules}

You can perform view and management operations on these modules.
Note: WhatsApp messaging is restricted to superadmin only.

Help the admin manage daily operations effectively.`;
  }

  // For other roles, describe their specific access
  const pageDescriptions: Record<string, string> = {
    'dashboard': 'Dashboard overview',
    'event-calendar': 'Event calendar (view, create, edit, delete events)',
    'team-calendar': 'Team calendar (view, create, edit, delete meetings)',
    'event-database': 'Event database (full event management)',
    'daybook': 'Daybook (financial transactions)',
    'oak-book': 'Oak Book (financial management, bank accounts)',
    'hr': 'HR (employee management, leave requests)',
    'oak-sales': 'Sales (event bookings)',
    'oak-inventory': 'Inventory management',
  };

  const accessibleModules = allowedPages
    .filter(p => pageDescriptions[p])
    .map(p => `- ${pageDescriptions[p]}`)
    .join('\n');

  return `${basePrompt}

USER ROLE: ${userRole.toUpperCase()}
Department: ${department || 'General'}

YOUR ACCESS IS LIMITED TO:
${accessibleModules || '- Basic viewing only'}

You can only perform actions on the modules listed above. If asked about something outside your access, politely explain that you don't have permission for that module.`;
}

function formatContextForAI(context: OaksyContext): string {
  let contextStr = "\n\nCURRENT SYSTEM DATA (use this to cross-reference and auto-fill details):\n";

  if (context.events && context.events.length > 0) {
    // Show all events (upcoming first, then recent past) for better matching
    const now = new Date();
    const upcomingEvents = context.events
      .filter(e => new Date(e.date) >= now)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 15);
    const recentPastEvents = context.events
      .filter(e => new Date(e.date) < now)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
    
    if (upcomingEvents.length > 0) {
      contextStr += `\nUpcoming Events (${upcomingEvents.length}):\n`;
      upcomingEvents.forEach(e => {
        contextStr += `- "${e.title}" (ID: ${e.id}) | ${new Date(e.date).toLocaleDateString('en-IN')} | ${e.venue || 'TBD'} | Customer: ${e.customer || 'N/A'} | Planner: ${(e as any).planner || 'N/A'} | Value: ₹${Number(e.salesValue).toLocaleString('en-IN')}\n`;
      });
    }
    if (recentPastEvents.length > 0) {
      contextStr += `\nRecent Past Events (${recentPastEvents.length}):\n`;
      recentPastEvents.forEach(e => {
        contextStr += `- "${e.title}" (ID: ${e.id}) | ${new Date(e.date).toLocaleDateString('en-IN')} | Customer: ${e.customer || 'N/A'} | Value: ₹${Number(e.salesValue).toLocaleString('en-IN')}\n`;
      });
    }
  }

  if (context.daybookSummary) {
    contextStr += `\nFinancial Summary (This Month):\n`;
    contextStr += `- Total Income: ₹${context.daybookSummary.totalIncome.toLocaleString('en-IN')}\n`;
    contextStr += `- Total Expenses: ₹${context.daybookSummary.totalExpense.toLocaleString('en-IN')}\n`;
    contextStr += `- Net Balance: ₹${context.daybookSummary.balance.toLocaleString('en-IN')}\n`;
  }

  if (context.employees && context.employees.length > 0) {
    contextStr += `\nTeam (${context.employees.length} employees):\n`;
    context.employees.slice(0, 20).forEach((e: any) => {
      contextStr += `- ${e.name} (${e.department || 'General'}${e.phone ? ', ' + e.phone : ''})\n`;
    });
  }

  if (context.banks && context.banks.length > 0) {
    contextStr += `\nBank Accounts:\n`;
    context.banks.forEach(b => {
      contextStr += `- ${b.name} (ID: ${b.id}, Balance: ₹${Number(b.balance).toLocaleString('en-IN')})\n`;
    });
  }

  if (context.daybookCategories && context.daybookCategories.length > 0) {
    contextStr += `\nDaybook Categories: ${context.daybookCategories.map((c: any) => c.name).join(', ')}\n`;
  }

  return contextStr;
}

async function executeToolCall(toolName: string, args: any, userRole: string, allowedPages: string[], context?: OaksyContext): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    const rolePerms = getRolePermission(userRole);

    if (rolePerms.blockedTools.includes(toolName)) {
      return { success: false, message: `Your role (${userRole}) does not have permission to use this action.` };
    }

    const availableTools = new Set<string>();
    if (rolePerms.allowedToolPrefixes.includes('*')) {
      Object.keys(ALL_OAKSY_TOOLS).forEach(t => availableTools.add(t));
    } else {
      for (const pageId of allowedPages) {
        (PAGE_TO_TOOLS[pageId] || []).forEach(t => {
          if (!rolePerms.blockedTools.includes(t)) {
            availableTools.add(t);
          }
        });
      }
      rolePerms.allowedToolPrefixes.forEach(prefix => {
        if (ALL_OAKSY_TOOLS[prefix]) availableTools.add(prefix);
      });
    }

    if (!availableTools.has(toolName)) {
      return { success: false, message: `You don't have permission to use ${toolName}` };
    }

    if (rolePerms.requiresConfirmation.includes(toolName)) {
      if (!args._confirmed) {
        return {
          success: false,
          message: `⚠️ This action (${toolName}) requires confirmation. Please confirm you want to proceed with: ${JSON.stringify(args)}`,
          data: { requiresConfirmation: true, action: toolName, args },
        };
      }
    }

    switch (toolName) {
      // Sales summary - calculates accurate totals from all events
      case "get_business_analysis": {
        const now = new Date();
        const currentMonth = now.getMonth(); // 0-indexed
        const currentYear = now.getFullYear();
        const fy = args.fiscalYear || (currentMonth >= 3 ? currentYear : currentYear - 1);
        const fyStart = new Date(fy, 3, 1); // April 1
        const fyEnd = new Date(fy + 1, 2, 31); // March 31
        const prevFyStart = new Date(fy - 1, 3, 1);
        const prevFyEnd = new Date(fy, 2, 31);

        const allEvents = await storage.getAllEvents();
        const allDaybook = await storage.getDaybookEntries();
        const allBanks = await storage.getBanks();
        
        const fyEvents = allEvents.filter(e => {
          const d = new Date(e.date);
          return d >= fyStart && d <= fyEnd;
        });
        const prevFyEvents = allEvents.filter(e => {
          const d = new Date(e.date);
          return d >= prevFyStart && d <= prevFyEnd;
        });

        const totalRevenue = fyEvents.reduce((s, e) => s + Number(e.salesValue || 0), 0);
        const totalReceived = fyEvents.reduce((s, e) => s + Number(e.paymentReceived || 0), 0);
        const totalCosts = fyEvents.reduce((s, e) => s + Number(e.cost || 0), 0);
        const grossProfit = totalRevenue - totalCosts;
        const outstanding = totalRevenue - totalReceived;
        const profitMargin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : '0';

        const prevRevenue = prevFyEvents.reduce((s, e) => s + Number(e.salesValue || 0), 0);
        const prevReceived = prevFyEvents.reduce((s, e) => s + Number(e.paymentReceived || 0), 0);
        const prevCosts = prevFyEvents.reduce((s, e) => s + Number(e.cost || 0), 0);
        const revenueGrowthNum = prevRevenue > 0 ? (((totalRevenue - prevRevenue) / prevRevenue) * 100) : null;
        const revenueGrowth = revenueGrowthNum !== null ? revenueGrowthNum.toFixed(1) : 'N/A';

        const monthlyBreakdown: Record<string, { revenue: number; received: number; costs: number; events: number }> = {};
        for (let m = 0; m < 12; m++) {
          const month = (3 + m) % 12;
          const year = month < 3 ? fy + 1 : fy;
          const key = `${year}-${String(month + 1).padStart(2, '0')}`;
          const monthEvents = fyEvents.filter(e => {
            const d = new Date(e.date);
            return d.getMonth() === month && d.getFullYear() === year;
          });
          monthlyBreakdown[key] = {
            revenue: monthEvents.reduce((s, e) => s + Number(e.salesValue || 0), 0),
            received: monthEvents.reduce((s, e) => s + Number(e.paymentReceived || 0), 0),
            costs: monthEvents.reduce((s, e) => s + Number(e.cost || 0), 0),
            events: monthEvents.length,
          };
        }

        const fyDaybook = allDaybook.filter(d => {
          const dt = new Date(d.date);
          return dt >= fyStart && dt <= fyEnd;
        });
        const totalExpenses = fyDaybook.filter(d => d.type === 'expense').reduce((s, d) => s + Number(d.amount || 0), 0);
        const totalIncome = fyDaybook.filter(d => d.type === 'income').reduce((s, d) => s + Number(d.amount || 0), 0);
        const expenseByCategory: Record<string, number> = {};
        fyDaybook.filter(d => d.type === 'expense').forEach(d => {
          const cat = d.category || 'Uncategorized';
          expenseByCategory[cat] = (expenseByCategory[cat] || 0) + Number(d.amount || 0);
        });

        const plannerPerf: Record<string, { events: number; revenue: number; received: number; costs: number }> = {};
        fyEvents.forEach(e => {
          const p = e.planner || 'Unassigned';
          if (!plannerPerf[p]) plannerPerf[p] = { events: 0, revenue: 0, received: 0, costs: 0 };
          plannerPerf[p].events++;
          plannerPerf[p].revenue += Number(e.salesValue || 0);
          plannerPerf[p].received += Number(e.paymentReceived || 0);
          plannerPerf[p].costs += Number(e.cost || 0);
        });

        const byType: Record<string, { count: number; revenue: number }> = {};
        fyEvents.forEach(e => {
          const t = e.type || 'other';
          if (!byType[t]) byType[t] = { count: 0, revenue: 0 };
          byType[t].count++;
          byType[t].revenue += Number(e.salesValue || 0);
        });

        const futureEvents = allEvents.filter(e => new Date(e.date) > now);
        const futureRevenue = futureEvents.reduce((s, e) => s + Number(e.salesValue || 0), 0);
        const futureReceivable = futureEvents.reduce((s, e) => s + Number(e.salesValue || 0) - Number(e.paymentReceived || 0), 0);

        const agingBuckets = { current: 0, thirtyDays: 0, sixtyDays: 0, ninetyPlus: 0 };
        fyEvents.forEach(e => {
          const due = Number(e.salesValue || 0) - Number(e.paymentReceived || 0);
          if (due <= 0) return;
          const eventDate = new Date(e.date);
          const daysPast = Math.floor((now.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24));
          if (daysPast < 0) agingBuckets.current += due;
          else if (daysPast <= 30) agingBuckets.thirtyDays += due;
          else if (daysPast <= 60) agingBuckets.sixtyDays += due;
          else agingBuckets.ninetyPlus += due;
        });

        const bankBalances = allBanks.map(b => ({ name: b.name, balance: Number(b.balance || 0) }));
        const totalBankBalance = bankBalances.reduce((s, b) => s + b.balance, 0);

        const avgEventValue = fyEvents.length > 0 ? totalRevenue / fyEvents.length : 0;
        const collectionRate = totalRevenue > 0 ? ((totalReceived / totalRevenue) * 100).toFixed(1) : '0';

        return {
          success: true,
          message: `Business Analysis for FY ${fy}-${(fy + 1).toString().slice(-2)}: ${fyEvents.length} events, Revenue ₹${totalRevenue.toLocaleString('en-IN')}, Profit ₹${grossProfit.toLocaleString('en-IN')} (${profitMargin}% margin)${revenueGrowthNum !== null ? `, Growth: ${revenueGrowth}%` : ''}`,
          data: {
            fiscalYear: `FY ${fy}-${(fy + 1).toString().slice(-2)}`,
            overview: {
              totalEvents: fyEvents.length,
              totalRevenue,
              totalReceived,
              totalCosts,
              grossProfit,
              profitMargin: `${profitMargin}%`,
              outstanding,
              revenueGrowth: revenueGrowthNum !== null ? `${revenueGrowth}%` : 'N/A (no prior year data)',
              prevYearRevenue: prevRevenue,
              prevYearReceived: prevReceived,
              prevYearCosts: prevCosts,
            },
            monthlyTrends: monthlyBreakdown,
            cashFlow: {
              daybookIncome: totalIncome,
              daybookExpenses: totalExpenses,
              netCashFlow: totalIncome - totalExpenses,
              bankBalances,
              totalBankBalance,
            },
            expenseBreakdown: expenseByCategory,
            receivablesAging: agingBuckets,
            plannerPerformance: plannerPerf,
            eventMix: byType,
            forecast: {
              upcomingEvents: futureEvents.length,
              futureRevenue,
              futureReceivable,
            },
            kpis: {
              avgEventValue: Math.round(avgEventValue),
              collectionRate: `${collectionRate}%`,
              eventsThisFY: fyEvents.length,
              eventsLastFY: prevFyEvents.length,
            },
          },
        };
      }

      case "get_sales_summary": {
        let events = await storage.getAllEvents();
        
        // Build filter description parts
        const filterParts: string[] = [];
        
        // Apply planner filter (case-insensitive partial match)
        if (args.planner) {
          const plannerSearch = args.planner.toLowerCase();
          events = events.filter(e => e.planner?.toLowerCase().includes(plannerSearch));
          filterParts.push(`Planner: ${args.planner}`);
        }
        
        // Apply customer filter (case-insensitive partial match)
        if (args.customer) {
          const customerSearch = args.customer.toLowerCase();
          events = events.filter(e => e.customer?.toLowerCase().includes(customerSearch));
          filterParts.push(`Customer: ${args.customer}`);
        }
        
        // Apply year/month filters
        if (args.year) {
          events = events.filter(e => {
            const eventYear = new Date(e.date).getFullYear();
            return eventYear === args.year;
          });
          if (args.month) {
            events = events.filter(e => {
              const eventMonth = new Date(e.date).getMonth() + 1;
              return eventMonth === args.month;
            });
            filterParts.push(`${args.month}/${args.year}`);
          } else {
            filterParts.push(`Year ${args.year}`);
          }
        }
        
        // Apply event type filter
        if (args.eventType) {
          events = events.filter(e => e.type?.toLowerCase() === args.eventType.toLowerCase());
          filterParts.push(`Type: ${args.eventType}`);
        }
        
        // Calculate totals with proper numeric conversion
        const totalBookedSales = events.reduce((sum, e) => sum + Number(e.salesValue || 0), 0);
        const totalPaymentsReceived = events.reduce((sum, e) => sum + Number(e.paymentReceived || 0), 0);
        const totalCosts = events.reduce((sum, e) => sum + Number(e.cost || 0), 0);
        const outstandingAmount = totalBookedSales - totalPaymentsReceived;
        const grossProfit = totalPaymentsReceived - totalCosts;
        
        // Group by event type
        const byType: Record<string, { count: number; sales: number; received: number }> = {};
        events.forEach(e => {
          const type = e.type || 'other';
          if (!byType[type]) {
            byType[type] = { count: 0, sales: 0, received: 0 };
          }
          byType[type].count++;
          byType[type].sales += Number(e.salesValue || 0);
          byType[type].received += Number(e.paymentReceived || 0);
        });
        
        const filterDescription = filterParts.length > 0 ? filterParts.join(', ') : 'All Time';
        
        // List individual events if filtered by planner/customer
        const eventDetails = (args.planner || args.customer) ? events.map(e => ({
          title: e.title,
          customer: e.customer,
          planner: e.planner,
          date: e.date,
          salesValue: Number(e.salesValue || 0),
          paymentReceived: Number(e.paymentReceived || 0),
        })) : undefined;
        
        return {
          success: true,
          message: `Sales Summary (${filterDescription}): ${events.length} events, Total Booked: ₹${totalBookedSales.toLocaleString('en-IN')}, Received: ₹${totalPaymentsReceived.toLocaleString('en-IN')}, Outstanding: ₹${outstandingAmount.toLocaleString('en-IN')}`,
          data: {
            filterDescription,
            planner: args.planner || null,
            customer: args.customer || null,
            eventType: args.eventType || 'all',
            totalEvents: events.length,
            totalBookedSales,
            totalPaymentsReceived,
            outstandingAmount,
            totalCosts,
            grossProfit,
            byEventType: byType,
            events: eventDetails,
          },
        };
      }
      
      // View operations
      case "view_events": {
        let events = await storage.getAllEvents();
        if (args.searchQuery) {
          const q = args.searchQuery.toLowerCase();
          events = events.filter(e => 
            e.title.toLowerCase().includes(q) || 
            e.customer?.toLowerCase().includes(q) || 
            e.venue?.toLowerCase().includes(q)
          );
        }
        if (args.startDate) {
          events = events.filter(e => e.date >= args.startDate);
        }
        if (args.endDate) {
          events = events.filter(e => e.date <= args.endDate);
        }
        const limit = args.limit || 10;
        events = events.slice(0, limit);
        return {
          success: true,
          message: `Found ${events.length} event(s)`,
          data: events.map(e => ({
            id: e.id,
            title: e.title,
            date: e.date,
            customer: e.customer,
            venue: e.venue,
            type: e.type,
            salesValue: e.salesValue,
          })),
        };
      }

      case "view_meetings": {
        let meetings = await storage.getAllMeetings();
        if (args.startDate) {
          meetings = meetings.filter(m => m.date >= args.startDate);
        }
        if (args.endDate) {
          meetings = meetings.filter(m => m.date <= args.endDate);
        }
        const limit = args.limit || 10;
        meetings = meetings.slice(0, limit);
        return {
          success: true,
          message: `Found ${meetings.length} meeting(s)`,
          data: meetings.map(m => ({
            id: m.id,
            title: m.title,
            date: m.date,
            time: m.time,
            attendees: m.attendees,
          })),
        };
      }

      case "view_daybook": {
        let entries = await storage.getAllDaybookEntries();
        if (args.type && args.type !== 'all') {
          entries = entries.filter(e => e.type === args.type);
        }
        if (args.startDate) {
          entries = entries.filter(e => e.date >= args.startDate);
        }
        if (args.endDate) {
          entries = entries.filter(e => e.date <= args.endDate);
        }
        if (args.category) {
          entries = entries.filter(e => e.category?.toLowerCase().includes(args.category.toLowerCase()));
        }
        const limit = args.limit || 20;
        entries = entries.slice(0, limit);
        return {
          success: true,
          message: `Found ${entries.length} daybook entries`,
          data: entries.map(e => ({
            id: e.id,
            date: e.date,
            description: e.description,
            type: e.type,
            amount: e.amount,
            category: e.category,
          })),
        };
      }

      case "view_employees": {
        let employees = await storage.getAllEmployees();
        if (args.department) {
          employees = employees.filter(e => e.department?.toLowerCase().includes(args.department.toLowerCase()));
        }
        if (args.searchQuery) {
          const q = args.searchQuery.toLowerCase();
          employees = employees.filter(e => 
            e.name.toLowerCase().includes(q) || 
            e.email?.toLowerCase().includes(q)
          );
        }
        const currentYear = new Date().getFullYear();
        const employeeData = await Promise.all(employees.map(async (e) => {
          let leaveInfo: any = undefined;
          if (userRole === 'superadmin' || userRole === 'admin') {
            try {
              const balances = await storage.getEmployeeLeaveBalancesByYear(e.id, currentYear);
              const totalAllocated = balances.reduce((s, b) => s + b.allocated, 0);
              const totalUsed = balances.reduce((s, b) => s + b.used, 0);
              leaveInfo = { totalAllocated, totalUsed, remaining: totalAllocated - totalUsed };
            } catch {}
          }
          return {
            id: e.id,
            name: e.name,
            email: e.email,
            phone: e.phone,
            department: e.department,
            designation: e.designation,
            ...(leaveInfo ? { leaveBalance: leaveInfo } : {}),
          };
        }));
        return {
          success: true,
          message: `Found ${employeeData.length} employee(s)`,
          data: employeeData,
        };
      }

      case "view_banks": {
        const banks = await storage.getAllBanks();
        return {
          success: true,
          message: `Found ${banks.length} bank account(s)`,
          data: banks.map(b => ({
            id: b.id,
            name: b.name,
            balance: b.balance,
          })),
        };
      }

      case "view_users": {
        const users = await storage.getAllUsers();
        return {
          success: true,
          message: `Found ${users.length} user(s)`,
          data: users.map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
          })),
        };
      }

      case "view_leave_requests": {
        let requests = await storage.getAllLeaveRequests();
        if (args.status && args.status !== 'all') {
          requests = requests.filter(r => r.status === args.status);
        }
        const allEmps = await storage.getAllEmployees();
        const empMap = new Map(allEmps.map(e => [e.id, e.name]));
        let enriched = requests.map(r => ({
          ...r,
          employeeName: empMap.get(r.employeeId) || 'Unknown',
        }));
        if (args.employeeName) {
          const q = args.employeeName.toLowerCase();
          enriched = enriched.filter(r => r.employeeName.toLowerCase().includes(q));
        }
        return {
          success: true,
          message: `Found ${enriched.length} leave request(s)`,
          data: enriched,
        };
      }

      case "get_employee_leave_balance": {
        const allEmps = await storage.getAllEmployees();
        const currentYear = new Date().getFullYear();
        let targetEmployees = allEmps;
        if (args.employeeName) {
          const q = args.employeeName.toLowerCase();
          targetEmployees = allEmps.filter(e => e.name.toLowerCase().includes(q));
          if (targetEmployees.length === 0) {
            return { success: false, message: `No employee found matching "${args.employeeName}"` };
          }
        }

        const leaveCategories = await storage.getAllLeaveCategories();
        const catMap = new Map(leaveCategories.map(c => [c.id, c.name]));

        const results = [];
        for (const emp of targetEmployees.slice(0, 20)) {
          const balances = await storage.getEmployeeLeaveBalancesByYear(emp.id, currentYear);
          const empLeaveRequests = await storage.getLeaveRequestsByEmployee(emp.id);
          const approvedThisYear = empLeaveRequests.filter(r =>
            r.status === 'approved' && new Date(r.startDate).getFullYear() === currentYear
          );

          const usedByCategory = new Map<string, number>();
          for (const lr of approvedThisYear) {
            const catId = lr.categoryId || 'general';
            const start = new Date(lr.startDate);
            const end = new Date(lr.endDate);
            const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            usedByCategory.set(catId, (usedByCategory.get(catId) || 0) + days);
          }

          const leaveData = balances.map(b => {
            const catId = b.categoryId || 'general';
            const actualUsed = usedByCategory.get(catId) || 0;
            return {
              category: catMap.get(b.categoryId || '') || 'General',
              allocated: b.allocated,
              used: actualUsed,
              remaining: b.allocated - actualUsed + (b.manuallyAdjusted || 0) + (b.carryForward || 0),
            };
          });
          const totalAllocated = leaveData.reduce((s, l) => s + l.allocated, 0);
          const totalUsed = leaveData.reduce((s, l) => s + l.used, 0);
          const totalRemaining = leaveData.reduce((s, l) => s + l.remaining, 0);
          results.push({
            employeeName: emp.name,
            department: emp.department,
            totalAllocated,
            totalUsed,
            totalRemaining,
            byCategory: leaveData,
          });
        }
        return {
          success: true,
          message: `Leave balance for ${results.length} employee(s)`,
          data: results,
        };
      }

      // Create operations
      case "create_daybook_entry": {
        const entry = await storage.createDaybookEntry({
          date: args.date,
          description: args.description || "",
          type: args.type,
          amount: args.amount.toString(),
          category: args.category,
          eventName: args.eventName || null,
          vendorName: args.vendorName || null,
          bankId: null,
          eventId: null,
          vendorId: null,
        });

        if (args.type === 'income' && args.eventName) {
          setTimeout(async () => {
            try {
              const { generatePaymentReceipt } = await import('./document-service');
              const { sendPushToUser } = await import('./push-notification-service');
              const { db } = await import('./db');
              const { users } = await import('@shared/schema');

              const allEvents = await storage.getAllEvents();
              const matchedEvent = allEvents.find(e =>
                e.title?.toLowerCase().includes(args.eventName.toLowerCase()) ||
                args.eventName.toLowerCase().includes(e.title?.toLowerCase() || '')
              );

              if (!matchedEvent) return;

              const receipt = await generatePaymentReceipt({
                eventId: matchedEvent.id,
                amount: args.amount,
                description: args.description || '',
                date: args.date,
              });

              console.log(`[Receipt] Oaksy AI auto-generated payment receipt ${receipt.filename} for event "${matchedEvent.title}"`);

              const allUsers = await storage.getAllUsers();
              const superadmins = allUsers.filter(u => u.role === 'superadmin');
              for (const admin of superadmins) {
                await sendPushToUser(admin.id, {
                  title: '💰 Payment Receipt Generated',
                  body: `Receipt for ₹${Number(args.amount).toLocaleString('en-IN')} received for "${matchedEvent.title}" from ${matchedEvent.customer}`,
                  actionUrl: `/api/documents/${receipt.documentId}`,
                  type: 'success',
                  sound: true,
                });
              }

              if (matchedEvent.planner) {
                const plannerUser = allUsers.find(u =>
                  u.name?.toLowerCase().trim() === matchedEvent.planner?.toLowerCase().trim()
                );
                if (plannerUser) {
                  await sendPushToUser(plannerUser.id, {
                    title: '💰 Payment Received',
                    body: `₹${Number(args.amount).toLocaleString('en-IN')} received for "${matchedEvent.title}" from ${matchedEvent.customer}. Receipt: ${receipt.filename}`,
                    actionUrl: `/api/documents/${receipt.documentId}`,
                    type: 'success',
                    sound: true,
                  });
                }
              }
            } catch (err) {
              console.error('[Receipt] Oaksy AI failed to auto-generate payment receipt:', err);
            }
          }, 0);
        }

        return {
          success: true,
          message: `Created ${args.type} entry: "${args.description}" for ₹${Number(args.amount).toLocaleString('en-IN')}`,
          data: entry,
        };
      }

      case "create_meeting": {
        const meeting = await storage.createMeeting({
          title: args.title,
          date: args.date,
          time: args.time,
          attendees: args.attendees || null,
        });
        return {
          success: true,
          message: `Scheduled meeting: "${args.title}" on ${new Date(args.date).toLocaleDateString('en-IN')} at ${args.time}`,
          data: meeting,
        };
      }

      case "create_event": {
        const event = await storage.createEvent({
          title: args.title,
          date: args.date,
          time: args.time || null,
          type: args.type,
          customer: args.customer,
          venue: args.venue,
          planner: args.planner,
          salesValue: args.salesValue?.toString() || "0",
          paymentReceived: "0",
          cost: "0",
        });
        return {
          success: true,
          message: `Created event: "${args.title}" on ${new Date(args.date).toLocaleDateString('en-IN')} for ${args.customer}`,
          data: event,
        };
      }

      case "create_bank_transfer": {
        const banks = await storage.getAllBanks();
        const fromBank = banks.find(b => b.name.toLowerCase().includes(args.fromBank.toLowerCase()));
        const toBank = banks.find(b => b.name.toLowerCase().includes(args.toBank.toLowerCase()));
        
        if (!fromBank) {
          return { success: false, message: `Source bank "${args.fromBank}" not found` };
        }
        if (!toBank) {
          return { success: false, message: `Destination bank "${args.toBank}" not found` };
        }
        
        const transfer = await storage.createBankTransfer({
          date: args.date,
          fromBankId: fromBank.id,
          toBankId: toBank.id,
          amount: args.amount.toString(),
          description: args.description || null,
        });
        
        const newFromBalance = (parseFloat(fromBank.balance) - args.amount).toString();
        const newToBalance = (parseFloat(toBank.balance) + args.amount).toString();
        await storage.updateBank(fromBank.id, { balance: newFromBalance });
        await storage.updateBank(toBank.id, { balance: newToBalance });
        
        return {
          success: true,
          message: `Transferred ₹${Number(args.amount).toLocaleString('en-IN')} from ${fromBank.name} to ${toBank.name}`,
          data: transfer,
        };
      }

      case "create_employee": {
        const employee = await storage.createEmployee({
          name: args.name,
          email: args.email || null,
          phone: args.phone || null,
          department: args.department,
          designation: args.position,
          employeeId: `EMP${Date.now()}`,
          joinDate: args.joiningDate || new Date().toISOString().split('T')[0],
          salary: args.salary?.toString() || "0",
          address: "",
          emergencyContact: "",
        });
        return {
          success: true,
          message: `Added employee: ${args.name} as ${args.position} in ${args.department}`,
          data: employee,
        };
      }

      case "create_user": {
        const bcrypt = await import('bcryptjs');
        const hashedPassword = await bcrypt.hash(args.password, 10);
        const user = await storage.createUser({
          name: args.name,
          email: args.email,
          password: hashedPassword,
          role: args.role,
        });
        return {
          success: true,
          message: `Created user: ${args.name} (${args.email}) with role ${args.role}`,
          data: { id: user.id, name: user.name, email: user.email, role: user.role },
        };
      }

      // Update operations
      case "update_event": {
        let eventId = args.eventId;
        if (!eventId && args.eventTitle) {
          const events = await storage.getAllEvents();
          const found = events.find(e => e.title.toLowerCase().includes(args.eventTitle.toLowerCase()));
          if (!found) {
            return { success: false, message: `Event "${args.eventTitle}" not found` };
          }
          eventId = found.id;
        }
        if (!eventId) {
          return { success: false, message: "Please provide an event ID or title" };
        }
        await storage.updateEvent(eventId, args.updates);
        return {
          success: true,
          message: `Updated event ${eventId}`,
          data: { eventId, updates: args.updates },
        };
      }

      case "update_meeting": {
        let meetingId = args.meetingId;
        if (!meetingId && args.meetingTitle) {
          const meetings = await storage.getAllMeetings();
          const found = meetings.find(m => m.title.toLowerCase().includes(args.meetingTitle.toLowerCase()));
          if (!found) {
            return { success: false, message: `Meeting "${args.meetingTitle}" not found` };
          }
          meetingId = found.id;
        }
        if (!meetingId) {
          return { success: false, message: "Please provide a meeting ID or title" };
        }
        await storage.updateMeeting(meetingId, args.updates);
        return {
          success: true,
          message: `Updated meeting ${meetingId}`,
          data: { meetingId, updates: args.updates },
        };
      }

      case "update_employee": {
        let employeeId = args.employeeId;
        if (!employeeId && args.employeeName) {
          const employees = await storage.getAllEmployees();
          const found = employees.find(e => e.name.toLowerCase().includes(args.employeeName.toLowerCase()));
          if (!found) {
            return { success: false, message: `Employee "${args.employeeName}" not found` };
          }
          employeeId = found.id;
        }
        if (!employeeId) {
          return { success: false, message: "Please provide an employee ID or name" };
        }
        await storage.updateEmployee(employeeId, args.updates);
        return {
          success: true,
          message: `Updated employee ${employeeId}`,
          data: { employeeId, updates: args.updates },
        };
      }

      case "update_leave_request": {
        await storage.updateLeaveRequest(args.leaveRequestId, {
          status: args.status,
          managerComments: args.remarks || null,
        });
        return {
          success: true,
          message: `Leave request ${args.status}`,
          data: { leaveRequestId: args.leaveRequestId, status: args.status },
        };
      }

      // Delete operations
      case "delete_event": {
        if (!args.confirmDelete) {
          return { success: false, message: "Please confirm deletion by setting confirmDelete to true" };
        }
        let eventId = args.eventId;
        if (!eventId && args.eventTitle) {
          const events = await storage.getAllEvents();
          const found = events.find(e => e.title.toLowerCase().includes(args.eventTitle.toLowerCase()));
          if (!found) {
            return { success: false, message: `Event "${args.eventTitle}" not found` };
          }
          eventId = found.id;
        }
        if (!eventId) {
          return { success: false, message: "Please provide an event ID or title" };
        }
        await storage.deleteEvent(eventId);
        return { success: true, message: `Deleted event ${eventId}` };
      }

      case "delete_meeting": {
        if (!args.confirmDelete) {
          return { success: false, message: "Please confirm deletion" };
        }
        await storage.deleteMeeting(args.meetingId);
        return { success: true, message: `Deleted meeting ${args.meetingId}` };
      }

      case "delete_daybook_entry": {
        if (!args.confirmDelete) {
          return { success: false, message: "Please confirm deletion" };
        }
        await storage.deleteDaybookEntry(args.entryId);
        return { success: true, message: `Deleted daybook entry ${args.entryId}` };
      }

      case "delete_employee": {
        if (!args.confirmDelete) {
          return { success: false, message: "Please confirm deletion" };
        }
        await storage.deleteEmployee(args.employeeId);
        return { success: true, message: `Deleted employee ${args.employeeId}` };
      }

      // Special tools
      case "send_whatsapp_message": {
        const { sendQuickWhatsAppMessage, isWhatsAppConfigured } = await import('./whatsapp-service');
        
        if (!isWhatsAppConfigured()) {
          return { success: false, message: "WhatsApp is not configured" };
        }
        
        const allEmployees = await storage.getAllEmployees();
        const optedInEmployees = allEmployees.filter(e => e.phone && e.whatsappOptIn);
        
        let targetEmployeeIds: string[] = [];
        
        if (args.targetMode === 'all') {
          targetEmployeeIds = optedInEmployees.map(e => e.id);
        } else if (args.targetMode === 'department' && args.departments) {
          targetEmployeeIds = optedInEmployees
            .filter(e => e.department && args.departments.some((d: string) => 
              e.department!.toLowerCase().includes(d.toLowerCase())
            ))
            .map(e => e.id);
        } else if (args.targetMode === 'selected' && args.employeeNames) {
          targetEmployeeIds = optedInEmployees
            .filter(e => args.employeeNames.some((name: string) => 
              e.name.toLowerCase().includes(name.toLowerCase())
            ))
            .map(e => e.id);
        }
        
        if (targetEmployeeIds.length === 0) {
          return { success: false, message: "No matching employees found" };
        }
        
        const result = await sendQuickWhatsAppMessage(targetEmployeeIds, args.message, 'oaksy-ai');
        
        return {
          success: result.success,
          message: result.success 
            ? `WhatsApp sent to ${targetEmployeeIds.length} employee(s)` 
            : (result.error || "Failed to send"),
        };
      }

      case "send_salary_slips_whatsapp": {
        if (userRole !== 'superadmin') {
          return { success: false, message: "Only superadmin can send salary slips via WhatsApp" };
        }
        
        const { sendWhatsAppMessage, isWhatsAppConfigured } = await import('./whatsapp-service');
        
        if (!isWhatsAppConfigured()) {
          return { success: false, message: "WhatsApp is not configured. Please set up Twilio credentials." };
        }
        
        // Get all payroll runs and find the matching one
        let payrollRunId = args.payrollRunId;
        
        if (!payrollRunId && args.month && args.year) {
          const payrollRuns = await storage.getAllPayrollRuns();
          const matchingRun = payrollRuns.find(r => r.month === args.month && r.year === args.year);
          if (matchingRun) {
            payrollRunId = matchingRun.id;
          }
        }
        
        if (!payrollRunId) {
          return { success: false, message: "Could not find the payroll run. Please specify month and year." };
        }
        
        // Get salary slips for this payroll run
        const salarySlips = await storage.getSalarySlipsByPayrollRun(payrollRunId);
        
        if (salarySlips.length === 0) {
          return { success: false, message: "No salary slips found for this payroll run. Generate slips first." };
        }
        
        // Get employees with phone numbers
        const allEmployees = await storage.getAllEmployees();
        const employeePhoneMap = new Map(allEmployees.filter(e => e.phone).map(e => [e.id, e]));
        
        // Filter by employee names if specified
        let slipsToSend = salarySlips;
        if (args.employeeNames && args.employeeNames.length > 0) {
          slipsToSend = salarySlips.filter(slip => 
            args.employeeNames.some((name: string) => 
              slip.employeeName.toLowerCase().includes(name.toLowerCase())
            )
          );
        }
        
        if (slipsToSend.length === 0) {
          return { success: false, message: "No matching employees found in the salary slips." };
        }
        
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December'];
        
        let successCount = 0;
        let failCount = 0;
        const results: string[] = [];
        
        for (const slip of slipsToSend) {
          const employee = employeePhoneMap.get(slip.employeeId);
          
          if (!employee || !employee.phone) {
            results.push(`${slip.employeeName}: No phone number`);
            failCount++;
            continue;
          }
          
          if (!employee.whatsappOptIn) {
            results.push(`${slip.employeeName}: WhatsApp not enabled`);
            failCount++;
            continue;
          }
          
          // Format salary slip message
          const message = `*SALARY SLIP - ${monthNames[slip.month - 1]} ${slip.year}*

Dear ${slip.employeeName},

Your salary details for ${monthNames[slip.month - 1]} ${slip.year}:

*Earnings:*
Basic + DA: Rs. ${slip.basicDa}
HRA: Rs. ${slip.hra || '0.00'}
Other Allowances: Rs. ${slip.otherAllowances || '0.00'}
Transportation: Rs. ${slip.transportationAllowance || '0.00'}
*Total Earnings: Rs. ${slip.totalEarnings}*

*Deductions:*
Professional Tax: Rs. ${slip.professionalTax || '0.00'}
Loss of Pay: Rs. ${slip.lossOfPay || '0.00'}
*Total Deductions: Rs. ${slip.totalDeductions}*

*NET PAYMENT: Rs. ${slip.netPayment}*

Days Present: ${slip.daysPresent}/${slip.totalDays}
Days Paid: ${slip.daysPaid}

_This is a system-generated message from Yepman International._`;

          const sendResult = await sendGeneralNotification(employee.phone, employee.name || 'Employee', message);
          
          if (sendResult.success) {
            successCount++;
            // Update the salary slip to mark as sent
            await storage.updateSalarySlip(slip.id, { 
              sentViaWhatsapp: true, 
              sentAt: new Date() 
            });
            results.push(`${slip.employeeName}: Sent successfully`);
          } else {
            failCount++;
            results.push(`${slip.employeeName}: Failed - ${sendResult.error}`);
          }
        }
        
        return {
          success: successCount > 0,
          message: `Sent ${successCount} salary slip(s) via WhatsApp. ${failCount > 0 ? `${failCount} failed.` : ''}`,
          data: results,
        };
      }

      // Document generation tools (superadmin only)
      case "generate_sales_report": {
        if (userRole !== 'superadmin') {
          return { success: false, message: "Only superadmin can generate documents" };
        }
        const result = await documentService.generateSalesReportPdf({
          year: args.year,
          month: args.month,
          startDate: args.startDate,
          endDate: args.endDate,
          planner: args.planner,
          eventType: args.eventType,
        });
        return {
          success: true,
          message: `${result.message}. Download link: /api/oaksy/documents/${result.documentId}`,
          data: { documentId: result.documentId, filename: result.filename, downloadUrl: `/api/oaksy/documents/${result.documentId}` },
        };
      }

      case "generate_invoice": {
        if (userRole !== 'superadmin') {
          return { success: false, message: "Only superadmin can generate documents" };
        }
        try {
          const result = await documentService.generateInvoicePdf({
            eventId: args.eventId,
            eventTitle: args.eventTitle,
          });
          return {
            success: true,
            message: `${result.message}. Download link: /api/oaksy/documents/${result.documentId}`,
            data: { documentId: result.documentId, filename: result.filename, downloadUrl: `/api/oaksy/documents/${result.documentId}` },
          };
        } catch (err) {
          return { success: false, message: err instanceof Error ? err.message : "Failed to generate invoice" };
        }
      }

      case "generate_quote": {
        if (userRole !== 'superadmin') {
          return { success: false, message: "Only superadmin can generate documents" };
        }
        try {
          const result = await documentService.generateQuotePdf({
            customerName: args.customerName,
            eventDate: args.eventDate,
            eventType: args.eventType,
            venue: args.venue,
            services: args.services,
            notes: args.notes,
          });
          return {
            success: true,
            message: `${result.message}. Download link: /api/oaksy/documents/${result.documentId}`,
            data: { documentId: result.documentId, filename: result.filename, downloadUrl: `/api/oaksy/documents/${result.documentId}` },
          };
        } catch (err) {
          return { success: false, message: err instanceof Error ? err.message : "Failed to generate quote" };
        }
      }

      case "generate_financial_report": {
        if (userRole !== 'superadmin') {
          return { success: false, message: "Only superadmin can generate documents" };
        }
        const result = await documentService.generateFinancialReportExcel({
          startDate: args.startDate,
          endDate: args.endDate,
          includeEvents: args.includeEvents,
          includeDaybook: args.includeDaybook,
        });
        return {
          success: true,
          message: `${result.message}. Download link: /api/oaksy/documents/${result.documentId}`,
          data: { documentId: result.documentId, filename: result.filename, downloadUrl: `/api/oaksy/documents/${result.documentId}` },
        };
      }

      case "generate_employee_report": {
        if (userRole !== 'superadmin') {
          return { success: false, message: "Only superadmin can generate documents" };
        }
        const result = await documentService.generateEmployeeReportPdf();
        return {
          success: true,
          message: `${result.message}. Download link: /api/oaksy/documents/${result.documentId}`,
          data: { documentId: result.documentId, filename: result.filename, downloadUrl: `/api/oaksy/documents/${result.documentId}` },
        };
      }

      case "create_sales_lead": {
        console.log('[Oaksy] create_sales_lead tool called with args:', JSON.stringify(args));
        const { sendWhatsAppMessage, isWhatsAppConfigured } = await import('./whatsapp-service');
        
        console.log('[Oaksy] WhatsApp configured:', isWhatsAppConfigured());
        
        // Map wedding planner names to phone numbers
        const PLANNER_PHONES: Record<string, string> = {
          'fida fathima': '+919895810975',
          'fida': '+919895810975',
          'femina km': '+917306687284',
          'femina': '+917306687284',
        };
        
        // Get users to find the wedding planner
        const users = await storage.getAllUsers();
        const weddingPlanners = users.filter((u: any) => u.role === 'wedding_planner' || u.role === 'admin');
        
        // Find the assigned planner
        let assignedPlanner: any = null;
        if (args.assignTo) {
          const plannerName = args.assignTo.toLowerCase();
          assignedPlanner = weddingPlanners.find((p: any) => 
            p.name.toLowerCase().includes(plannerName) || 
            plannerName.includes(p.name.toLowerCase().split(' ')[0])
          );
        }
        
        // If no planner specified, pick randomly or use Femina as default
        if (!assignedPlanner && weddingPlanners.length > 0) {
          assignedPlanner = weddingPlanners.find((p: any) => p.name.toLowerCase().includes('femina')) || weddingPlanners[0];
        }
        
        const pipelines = await storage.getAllSalesPipelines();
        if (!pipelines || pipelines.length === 0) {
          return { success: false, message: "No sales pipeline found. Please set up Oak Sales first." };
        }
        
        let pipeline = pipelines[0];
        if (assignedPlanner && pipelines.length > 1) {
          const plannerFirstName = assignedPlanner.name.toLowerCase().split(' ')[0];
          const matchedPipeline = pipelines.find((p: any) => 
            p.name.toLowerCase().includes(plannerFirstName)
          );
          if (matchedPipeline) pipeline = matchedPipeline;
        }
        
        const stages = await storage.getSalesStagesByPipelineId(pipeline.id);
        const firstStage = stages[0];
        if (!firstStage) {
          return { success: false, message: "No pipeline stages found. Please configure pipeline stages first." };
        }
        
        // Create or find contact
        let contactId = null;
        if (args.customerName) {
          const nameParts = args.customerName.trim().split(' ');
          const firstName = nameParts[0] || args.customerName;
          const lastName = nameParts.slice(1).join(' ') || '';
          
          // Create contact
          const contact = await storage.createSalesContact({
            firstName,
            lastName,
            phone: args.customerPhone || null,
            email: args.customerEmail || null,
            source: 'oaksy_chat',
          });
          contactId = contact.id;
        }
        
        // Create the sales deal
        const dealTitle = `${args.customerName || 'New Lead'} - ${args.eventType || 'Event'} - ${args.venue || 'TBD'}`;
        const deal = await storage.createSalesDeal({
          title: dealTitle,
          pipelineId: pipeline.id,
          stageId: firstStage.id,
          contactId,
          ownerId: assignedPlanner?.id || null,
          value: args.estimatedValue ? String(args.estimatedValue) : null,
          eventDate: args.eventDate || null,
          venue: args.venue || null,
          notes: args.notes || null,
          status: 'open',
          probability: 20,
        });
        
        try {
          const { notifyNewLeadToSuperadmins } = await import('./push-notification-service');
          await notifyNewLeadToSuperadmins(
            args.customerName || 'New Lead',
            args.customerPhone || 'N/A',
            args.eventType || '',
            'crm'
          );
        } catch (notifyError) {
          console.error('[Oaksy] Failed to send Oaksy notification to superadmins:', notifyError);
        }

        // Send WhatsApp notification to assigned planner
        console.log('[Oaksy] Assigned planner:', assignedPlanner?.name || 'none');
        console.log('[Oaksy] Deal created:', deal.id);
        
        let notificationSent = false;
        if (assignedPlanner && isWhatsAppConfigured()) {
          const plannerPhone = PLANNER_PHONES[assignedPlanner.name.toLowerCase()];
          console.log('[Oaksy] Planner phone lookup:', assignedPlanner.name.toLowerCase(), '->', plannerPhone);
          if (plannerPhone) {
            try {
              const message = `🌳 *New Lead Assigned*\n━━━━━━━━━━━━━━━━━━\n\n👤 *Customer:* ${args.customerName || 'Not specified'}\n📞 *Phone:* ${args.customerPhone || 'Not provided'}\n📅 *Event Date:* ${args.eventDate || 'TBD'}\n📍 *Venue:* ${args.venue || 'TBD'}\n💰 *Value:* ₹${args.estimatedValue ? Number(args.estimatedValue).toLocaleString('en-IN') : '0'}\n\n_Added via Oaksy Chat_\n\nCheck Oak Sales for more details 🌿`;
              
              await sendGeneralNotification(plannerPhone, assignedPlanner.name, message, 'oaksy_chat_lead_creation', deal.id);
              notificationSent = true;
              console.log(`[Oaksy] WhatsApp notification sent to ${assignedPlanner.name} for new lead`);
            } catch (notifyError) {
              console.error('[Oaksy] Failed to send WhatsApp notification:', notifyError);
            }
          }
        }
        
        return {
          success: true,
          message: `Lead created successfully! ${args.customerName || 'New Lead'} has been added to Oak Sales and assigned to ${assignedPlanner?.name || 'unassigned'}. ${notificationSent ? `WhatsApp notification sent to ${assignedPlanner?.name}!` : ''}`,
          data: { dealId: deal.id, dealTitle, assignedTo: assignedPlanner?.name, notificationSent },
        };
      }

      case "add_daybook_entries_batch": {
        if (!args.entries || !Array.isArray(args.entries) || args.entries.length === 0) {
          return { success: false, message: "No entries provided. Please extract the expense/income details from the image." };
        }

        // Pre-fetch events and vendors for linking
        const allEventsForDaybook = await storage.getAllEvents();
        const allVendorsForDaybook = await storage.getAllVendors();

        let added = 0;
        let failed = 0;
        const addedEntries: string[] = [];

        for (const entry of args.entries) {
          try {
            // Resolve eventName to eventId
            let entryEventId = null;
            if (entry.eventName) {
              const matchedEvt = allEventsForDaybook.find((e: any) =>
                e.title?.toLowerCase().includes(entry.eventName.toLowerCase()) ||
                entry.eventName.toLowerCase().includes(e.title?.toLowerCase() || '')
              );
              if (matchedEvt) entryEventId = matchedEvt.id;
            }

            // Resolve vendorName to vendorId
            let entryVendorId = null;
            if (entry.vendorName) {
              const matchedVendor = allVendorsForDaybook.find((v: any) =>
                v.name?.toLowerCase().includes(entry.vendorName.toLowerCase()) ||
                entry.vendorName.toLowerCase().includes(v.name?.toLowerCase() || '')
              );
              if (matchedVendor) entryVendorId = matchedVendor.id;
            }

            await storage.createDaybookEntry({
              date: entry.date || new Date().toISOString().split('T')[0],
              description: entry.description || "",
              type: entry.type || "expense",
              amount: String(entry.amount || 0),
              category: entry.category || "General",
              eventName: entry.eventName || null,
              vendorName: entry.vendorName || null,
              bankId: null,
              eventId: entryEventId,
              vendorId: entryVendorId,
            });
            added++;
            addedEntries.push(`${entry.type === 'income' ? '📈' : '📉'} ${entry.description}: ₹${Number(entry.amount).toLocaleString('en-IN')}`);
          } catch (e: any) {
            failed++;
            console.error(`[Oaksy] Failed to add daybook entry "${entry.description}":`, e.message);
          }
        }

        return {
          success: added > 0,
          message: `Added ${added} daybook entries${failed > 0 ? ` (${failed} failed)` : ''}:\n${addedEntries.join('\n')}`,
          data: { added, failed },
        };
      }

      case "create_estimate_from_data": {
        if (!args.customerName || !args.lineItems || args.lineItems.length === 0) {
          return { success: false, message: "Please provide customer name and at least one line item." };
        }

        let itemSlNo = 0;
        const lineItems = args.lineItems.map((item: any) => {
          const heading = item.isHeading || false;
          if (!heading) itemSlNo++;
          return {
            slNo: heading ? 0 : itemSlNo,
            name: item.name || '',
            description: item.description || '',
            quantity: heading ? 0 : (item.quantity || 1),
            rate: heading ? 0 : (item.rate || 0),
            taxRate: 0,
            cgstPercent: 0,
            cgstAmount: 0,
            sgstPercent: 0,
            sgstAmount: 0,
            total: heading ? 0 : ((item.quantity || 1) * (item.rate || 0)),
            isHeading: heading,
          };
        });

        const subtotal = lineItems.filter((i: any) => !i.isHeading).reduce((sum: number, i: any) => sum + i.total, 0);
        const discountAmount = args.discountPercent ? (subtotal * args.discountPercent / 100) : 0;
        const afterDiscount = subtotal - discountAmount;
        const serviceChargeAmount = args.serviceChargePercent ? (afterDiscount * args.serviceChargePercent / 100) : 0;
        const total = afterDiscount + serviceChargeAmount;

        // Find event if specified
        let eventId = null;
        let customerId = null;
        if (args.eventTitle) {
          const allEvents = await storage.getAllEvents();
          const matchedEvent = allEvents.find((e: any) =>
            e.title?.toLowerCase().includes(args.eventTitle.toLowerCase()) ||
            args.eventTitle.toLowerCase().includes(e.title?.toLowerCase() || '')
          );
          if (matchedEvent) eventId = matchedEvent.id;
        }

        // Find or create customer, assign to requesting wedding planner
        const customers = await storage.getAllCustomers();
        const matchedCustomer = customers.find((c: any) =>
          c.name?.toLowerCase().includes(args.customerName.toLowerCase()) ||
          args.customerName.toLowerCase().includes(c.name?.toLowerCase() || '')
        );
        if (matchedCustomer) {
          customerId = matchedCustomer.id;
        } else {
          // Auto-create customer and assign to requesting planner
          const allCustCodes = customers.map((c: any) => c.customerCode).filter(Boolean);
          let maxCustNum = 0;
          for (const code of allCustCodes) {
            const m = code.match(/OAKS-C-\d+-(\d+)/);
            if (m) maxCustNum = Math.max(maxCustNum, parseInt(m[1]));
          }
          const yearSuffix = new Date().getFullYear().toString().slice(-2);
          const newCustCode = `OAKS-C-${yearSuffix}-${String(maxCustNum + 1).padStart(4, '0')}`;
          const newCustomer = await storage.createCustomer({
            name: args.customerName,
            billingAddress: args.customerAddress || null,
            email: args.customerEmail || null,
            phone: args.customerPhone || null,
            state: null,
            country: 'India',
            company: 'oakstreet',
            customerCode: newCustCode,
            weddingPlannerId: context?.userId || null,
          });
          customerId = newCustomer.id;
        }

        const estimateNumber = await storage.getNextEstimateNumber('oakstreet');

        // Get the requesting user's name for wedding_planner_name
        let plannerName: string | null = null;
        if (context?.userId) {
          const requestingUser = await storage.getUser(context.userId);
          if (requestingUser && (requestingUser.role === 'wedding_planner' || requestingUser.role === 'superadmin')) {
            plannerName = requestingUser.name;
          }
        }

        const estimate = await storage.createEstimate({
          number: estimateNumber,
          customerId,
          eventId,
          date: args.date || new Date().toISOString().split('T')[0],
          dueDate: args.dueDate || null,
          status: 'draft',
          subject: args.subject || null,
          customerAddress: args.customerAddress || null,
          customerEmail: args.customerEmail || null,
          customerWhatsapp: args.customerPhone || null,
          lineItems,
          subtotal: String(subtotal),
          discountPercent: args.discountPercent ? String(args.discountPercent) : '0',
          discountAmount: String(discountAmount),
          serviceChargePercent: args.serviceChargePercent ? String(args.serviceChargePercent) : '0',
          serviceChargeAmount: String(serviceChargeAmount),
          taxTotal: '0',
          total: String(total),
          notes: args.notes || null,
          terms: args.terms || null,
          isTaxDocument: false,
          leadId: null,
          leadName: null,
          weddingPlannerName: plannerName,
          placeOfSupply: null,
          cgstTotal: '0',
          sgstTotal: '0',
          totalInWords: null,
          thankYouMessage: null,
          signature: null,
          companyBrand: 'oakstreet',
        });

        // Auto-create a sales deal for this estimate if one doesn't exist
        let dealMessage = '';
        try {
          const allDeals = await storage.getAllSalesDeals();
          // First check for exact customer ID match, then fall back to owner+name match
          const existingDeal = allDeals.find((d: any) => d.customerId === customerId) ||
            (context?.userId ? allDeals.find((d: any) => 
              d.ownerId === context.userId &&
              d.title?.toLowerCase().includes(args.customerName.toLowerCase())
            ) : null);

          if (!existingDeal && context?.userId) {
            const pipelines = await storage.getAllSalesPipelines();
            const stages = await storage.getAllSalesStages();

            // Find pipeline owned by this planner - match by checking which pipeline has deals owned by this user
            // If no existing deals, use pipeline name heuristic
            let targetPipeline = null;
            const plannerDeals = allDeals.filter((d: any) => d.ownerId === context.userId);
            if (plannerDeals.length > 0) {
              targetPipeline = pipelines.find((p: any) => p.id === plannerDeals[0].pipelineId);
            }
            if (!targetPipeline && plannerName) {
              const pName = plannerName.toLowerCase();
              targetPipeline = pipelines.find((p: any) => {
                const pipeName = (p.name || '').toLowerCase();
                return pName.split(' ').some((word: string) => word.length > 2 && pipeName.includes(word));
              });
            }
            if (!targetPipeline && pipelines.length > 0) {
              targetPipeline = pipelines[0];
            }

            if (targetPipeline) {
              // Find first stage (Lead) - case-insensitive match
              const pipelineStages = stages
                .filter((s: any) => s.pipelineId === targetPipeline!.id)
                .sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
              const leadStage = pipelineStages.find((s: any) => 
                (s.name || '').toLowerCase() === 'lead'
              ) || pipelineStages[0];

              if (leadStage) {
                const dealTitle = `${args.customerName} - ${args.subject || 'Wedding'}`;
                const newDeal = await storage.createSalesDeal({
                  title: dealTitle,
                  pipelineId: targetPipeline.id,
                  stageId: leadStage.id,
                  value: String(total),
                  ownerId: context.userId,
                  customerId: customerId,
                  status: 'open',
                  phone: args.customerPhone || null,
                });
                dealMessage = ` A new lead "${dealTitle}" has also been created in Oak Sales.`;

                try {
                  const { notifyNewLeadToSuperadmins } = await import('./push-notification-service');
                  await notifyNewLeadToSuperadmins(
                    args.customerName || 'New Lead',
                    args.customerPhone || 'N/A',
                    '',
                    'crm'
                  );
                } catch (notifyError) {
                  console.error('[Oaksy] Failed to send Oaksy notification to superadmins for estimate deal:', notifyError);
                }
              } else {
                console.warn('[Oaksy] No stages found for pipeline, skipping deal creation');
              }
            } else {
              console.warn('[Oaksy] No pipeline found, skipping deal creation');
            }
          } else if (existingDeal && !existingDeal.customerId && customerId) {
            await storage.updateSalesDeal(existingDeal.id, { customerId });
          }
        } catch (e) {
          console.error('[Oaksy] Failed to create/link sales deal:', e);
        }

        return {
          success: true,
          message: `Estimate ${estimateNumber} created for ${args.customerName} with ${lineItems.length} items. Total: ₹${Number(total).toLocaleString('en-IN')}.${dealMessage} You can view and edit it in Oak Book → Estimates.`,
          data: { estimateId: estimate.id, number: estimateNumber, total },
        };
      }

      case "generate_smart_estimate": {
        if (!args.customerName || !args.eventType || !args.totalBudget || !args.heads || args.heads.length === 0) {
          return { success: false, message: "Please provide customer name, event type, total budget, and at least one head." };
        }

        const allEstimatesForAnalysis = await storage.getAllEstimates();

        const eventTypeKeywords = args.eventType.toLowerCase().split(/[\s,&]+/).filter((w: string) => w.length > 2);
        const similarEstimates = allEstimatesForAnalysis.filter((est: any) => {
          const searchText = `${est.subject || ''} ${est.notes || ''}`.toLowerCase();
          return eventTypeKeywords.some((kw: string) => searchText.includes(kw));
        });

        let historicalData = '';
        if (similarEstimates.length > 0) {
          const headTotals: Record<string, { total: number; count: number }> = {};
          let grandTotal = 0;

          for (const est of similarEstimates) {
            const items = est.lineItems || [];
            let currentHead = 'General';
            for (const item of items) {
              if (item.isHeading) {
                currentHead = item.name;
                continue;
              }
              const itemTotal = (item.quantity || 1) * (item.rate || 0);
              if (!headTotals[currentHead]) headTotals[currentHead] = { total: 0, count: 0 };
              headTotals[currentHead].total += itemTotal;
              headTotals[currentHead].count += 1;
              grandTotal += itemTotal;
            }
          }

          if (grandTotal > 0) {
            historicalData = Object.entries(headTotals)
              .map(([head, data]) => `${head}: ${((data.total / grandTotal) * 100).toFixed(1)}% of budget (avg across ${similarEstimates.length} estimates)`)
              .join('\n');
          }
        }

        const analysisPrompt = `You are an expert event planner. Generate detailed line items for a ${args.eventType} estimate.

Budget: ₹${args.totalBudget.toLocaleString('en-IN')}
Heads to include: ${args.heads.join(', ')}
${args.guestCount ? `Guest count: ${args.guestCount}` : ''}
${args.venueType ? `Venue: ${args.venueType}` : ''}
${args.notes ? `Special requirements: ${args.notes}` : ''}

${historicalData ? `Based on past estimates for similar events, here are typical budget allocations:\n${historicalData}` : ''}

Generate line items as JSON array. Each item must have: name (string), description (string), quantity (number), rate (number), isHeading (boolean - true for section headers).
Group items under section headings. The total must approximately equal the budget.
Make descriptions professional and detailed.
Return a JSON object with key "lineItems" containing the array.`;

        const aiResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: analysisPrompt }],
          response_format: { type: "json_object" },
          max_completion_tokens: 4096,
          temperature: 0.7,
        });

        const aiContent = aiResponse.choices[0].message.content;
        if (!aiContent) {
          return { success: false, message: "Failed to generate line items from AI." };
        }

        let generatedItems: any[];
        try {
          const parsed = JSON.parse(aiContent);
          generatedItems = parsed.lineItems || parsed.items || parsed.line_items || [];
        } catch (e) {
          return { success: false, message: "Failed to parse AI-generated line items." };
        }

        if (generatedItems.length === 0) {
          return { success: false, message: "AI did not generate any line items." };
        }

        const smartLineItems = generatedItems.map((item: any, idx: number) => ({
          slNo: idx + 1,
          name: item.name || '',
          description: item.description || '',
          quantity: item.quantity || 1,
          rate: item.rate || 0,
          taxRate: 0,
          cgstPercent: 0,
          cgstAmount: 0,
          sgstPercent: 0,
          sgstAmount: 0,
          total: (item.quantity || 1) * (item.rate || 0),
          isHeading: item.isHeading || false,
        }));

        const smartSubtotal = smartLineItems.filter((i: any) => !i.isHeading).reduce((sum: number, i: any) => sum + i.total, 0);

        let smartCustomerId = null;
        const smartCustomers = await storage.getAllCustomers();
        const smartMatchedCustomer = smartCustomers.find((c: any) =>
          c.name?.toLowerCase().includes(args.customerName.toLowerCase()) ||
          args.customerName.toLowerCase().includes(c.name?.toLowerCase() || '')
        );
        if (smartMatchedCustomer) smartCustomerId = smartMatchedCustomer.id;

        const smartEstimateNumber = await storage.getNextEstimateNumber('oakstreet');

        const smartEstimate = await storage.createEstimate({
          number: smartEstimateNumber,
          customerId: smartCustomerId,
          eventId: null,
          date: args.eventDate || new Date().toISOString().split('T')[0],
          dueDate: null,
          status: 'draft',
          subject: `${args.eventType} - ${args.heads.join(', ')}`,
          customerAddress: null,
          customerEmail: null,
          customerWhatsapp: null,
          lineItems: smartLineItems,
          subtotal: String(smartSubtotal),
          discountPercent: '0',
          discountAmount: '0',
          serviceChargePercent: '0',
          serviceChargeAmount: '0',
          taxTotal: '0',
          total: String(smartSubtotal),
          notes: args.notes || null,
          terms: null,
          isTaxDocument: false,
          leadId: null,
          leadName: null,
          weddingPlannerName: null,
          placeOfSupply: null,
          cgstTotal: '0',
          sgstTotal: '0',
          totalInWords: null,
          thankYouMessage: null,
          signature: null,
          companyBrand: 'oakstreet',
        });

        return {
          success: true,
          message: `Smart Estimate ${smartEstimateNumber} created for ${args.customerName} (${args.eventType}) with ${smartLineItems.length} items across ${args.heads.length} heads. Total: ₹${Number(smartSubtotal).toLocaleString('en-IN')}. ${similarEstimates.length > 0 ? `Based on analysis of ${similarEstimates.length} similar past estimate(s).` : 'Generated using industry knowledge.'} You can view and edit it in Oak Book → Estimates.`,
          data: { estimateId: smartEstimate.id, number: smartEstimateNumber, total: smartSubtotal },
        };
      }

      case "create_invoice_from_data": {
        if (!args.customerName || !args.lineItems || args.lineItems.length === 0) {
          return { success: false, message: "Please provide customer name and at least one line item." };
        }

        const invLineItems = args.lineItems.map((item: any, idx: number) => ({
          slNo: idx + 1,
          name: item.name || '',
          description: item.description || '',
          quantity: item.quantity || 1,
          rate: item.rate || 0,
          taxRate: 0,
          cgstPercent: 0,
          cgstAmount: 0,
          sgstPercent: 0,
          sgstAmount: 0,
          total: (item.quantity || 1) * (item.rate || 0),
          isHeading: item.isHeading || false,
        }));

        const invSubtotal = invLineItems.filter((i: any) => !i.isHeading).reduce((sum: number, i: any) => sum + i.total, 0);
        const invDiscountAmount = args.discountPercent ? (invSubtotal * args.discountPercent / 100) : 0;
        const invAfterDiscount = invSubtotal - invDiscountAmount;
        const invServiceChargeAmount = args.serviceChargePercent ? (invAfterDiscount * args.serviceChargePercent / 100) : 0;
        const invTotal = invAfterDiscount + invServiceChargeAmount;

        let invEventId = null;
        let invCustomerId = null;
        if (args.eventTitle) {
          const allEvents = await storage.getAllEvents();
          const matchedEvent = allEvents.find((e: any) =>
            e.title?.toLowerCase().includes(args.eventTitle.toLowerCase()) ||
            args.eventTitle.toLowerCase().includes(e.title?.toLowerCase() || '')
          );
          if (matchedEvent) invEventId = matchedEvent.id;
        }

        const invCustomers = await storage.getAllCustomers();
        const invMatchedCustomer = invCustomers.find((c: any) =>
          c.name?.toLowerCase().includes(args.customerName.toLowerCase()) ||
          args.customerName.toLowerCase().includes(c.name?.toLowerCase() || '')
        );
        if (invMatchedCustomer) invCustomerId = invMatchedCustomer.id;

        const allInvoices = await storage.getAllInvoices();
        let maxInvNum = 0;
        for (const inv of allInvoices) {
          const match = inv.number?.match(/INV-(\d+)/);
          if (match) maxInvNum = Math.max(maxInvNum, parseInt(match[1]));
        }
        const invoiceNumber = `INV-${String(maxInvNum + 1).padStart(3, '0')}`;

        const invoice = await storage.createInvoice({
          number: invoiceNumber,
          customerId: invCustomerId,
          eventId: invEventId,
          date: args.date || new Date().toISOString().split('T')[0],
          dueDate: args.dueDate || null,
          status: 'draft',
          subject: args.subject || null,
          customerAddress: args.customerAddress || null,
          customerEmail: args.customerEmail || null,
          customerWhatsapp: args.customerPhone || null,
          lineItems: invLineItems,
          subtotal: String(invSubtotal),
          discountPercent: args.discountPercent ? String(args.discountPercent) : '0',
          discountAmount: String(invDiscountAmount),
          serviceChargePercent: args.serviceChargePercent ? String(args.serviceChargePercent) : '0',
          serviceChargeAmount: String(invServiceChargeAmount),
          taxTotal: '0',
          total: String(invTotal),
          balanceDue: String(invTotal),
          notes: args.notes || null,
          terms: args.terms || null,
          isTaxDocument: false,
          estimateId: null,
          weddingPlannerName: null,
          placeOfSupply: null,
          cgstTotal: '0',
          sgstTotal: '0',
          totalInWords: null,
          thankYouMessage: null,
          signature: null,
          companyBrand: 'oakstreet',
        });

        return {
          success: true,
          message: `Invoice ${invoiceNumber} created for ${args.customerName} with ${invLineItems.length} items. Total: ₹${Number(invTotal).toLocaleString('en-IN')}. You can view and edit it in Oak Book → Invoices.`,
          data: { invoiceId: invoice.id, number: invoiceNumber, total: invTotal },
        };
      }

      case "add_vendor_costs_batch": {
        if (!args.eventTitle || !args.vendors || !Array.isArray(args.vendors) || args.vendors.length === 0) {
          return { success: false, message: "Please provide the event name and vendor cost details." };
        }
        if (!context?.userId) {
          return { success: false, message: "User context is required to add vendor costs." };
        }

        const allEvents = await storage.getAllEvents();
        const searchTitle = args.eventTitle.toLowerCase();
        const matchedEvent = allEvents.find((e: any) =>
          e.title?.toLowerCase().includes(searchTitle) ||
          searchTitle.includes(e.title?.toLowerCase() || '') ||
          e.customer?.toLowerCase().includes(searchTitle)
        );

        if (!matchedEvent) {
          const eventNames = allEvents.slice(0, 15).map((e: any) => e.title).join(', ');
          return { success: false, message: `Could not find event "${args.eventTitle}". Available events: ${eventNames}` };
        }

        const { db } = await import('./db');
        const { eventVendorCosts } = await import('@shared/schema');

        let added = 0;
        let failed = 0;

        for (const vendor of args.vendors) {
          try {
            await db.insert(eventVendorCosts).values({
              eventId: matchedEvent.id,
              vendorName: vendor.vendorName || 'Unknown Vendor',
              serviceDescription: vendor.serviceDescription || 'Service',
              estimatedAmount: String(vendor.estimatedAmount || '0'),
              actualAmount: vendor.actualAmount ? String(vendor.actualAmount) : null,
              paymentStatus: vendor.paymentStatus || 'pending',
              paymentDate: null,
              paymentReference: null,
              notes: null,
              createdBy: context.userId,
            });
            added++;
          } catch (e: any) {
            failed++;
            console.error(`[Oaksy] Failed to add vendor cost for ${vendor.vendorName}:`, e.message);
          }
        }

        return {
          success: added > 0,
          message: `Added ${added} vendor costs to "${matchedEvent.title}"${failed > 0 ? ` (${failed} failed)` : ''}`,
          data: { eventId: matchedEvent.id, eventTitle: matchedEvent.title, added, failed },
        };
      }

      default:
        return { success: false, message: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    console.error(`Error executing tool ${toolName}:`, error);
    return {
      success: false,
      message: `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export async function generateOaksyResponse(
  conversationId: string,
  userMessage: string,
  context: OaksyContext,
  department: string = 'general',
  imageBase64?: string
): Promise<OaksyActionResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured");
  }

  const allowedPages = context.allowedPages || [];
  const userRole = context.userRole;

  const availableTools = getToolsForUser(userRole, allowedPages);

  if (availableTools.length === 0) {
    await logOaksyAction({
      userId: context.userId,
      userRole,
      conversationId,
      prompt: userMessage,
      aiOutput: 'No tools available - access denied',
      status: 'blocked',
    });
    return {
      response: "I'm sorry, but you don't have access to Oaksy's management features. Please contact your administrator if you need assistance.",
      actions: [],
    };
  }

  const allMessages = await storage.getOaksyMessages(conversationId);
  const recentMessages = allMessages.slice(-MAX_CONVERSATION_HISTORY);

  const systemPrompt = getSystemPromptForUser(userRole, allowedPages, department, context.userName) + formatContextForAI(context);

  const conversationHistory: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...recentMessages.map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  if (imageBase64) {
    const imageContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
      { type: "text", text: userMessage },
      { type: "image_url", image_url: { url: imageBase64, detail: "high" } },
    ];
    conversationHistory.push({ role: "user", content: imageContent });
  } else {
    conversationHistory.push({ role: "user", content: userMessage });
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: conversationHistory,
      tools: availableTools.length > 0 ? availableTools : undefined,
      tool_choice: availableTools.length > 0 ? "auto" : undefined,
      max_completion_tokens: imageBase64 ? 4096 : 2048,
      temperature: 0.7,
    });

    const message = response.choices[0].message;
    const actions: OaksyActionResult['actions'] = [];

    if (message.tool_calls && message.tool_calls.length > 0) {
      const toolResults: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
      
      for (const toolCall of message.tool_calls) {
        if (toolCall.type !== 'function') continue;
        const funcCall = toolCall as { id: string; type: 'function'; function: { name: string; arguments: string } };
        const args = JSON.parse(funcCall.function.arguments);
        const result = await executeToolCall(funcCall.function.name, args, userRole, allowedPages, context);
        
        actions.push({
          type: funcCall.function.name,
          data: result.data,
          success: result.success,
          message: result.message,
        });

        await logOaksyAction({
          userId: context.userId,
          userRole,
          conversationId,
          prompt: userMessage,
          actionType: funcCall.function.name,
          actionData: args,
          executedAction: funcCall.function.name,
          status: result.success ? 'success' : 'failed',
          error: result.success ? undefined : result.message,
        });

        toolResults.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }

      let followUpMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        ...conversationHistory,
        {
          role: "assistant",
          content: message.content || "",
          tool_calls: message.tool_calls,
        },
        ...toolResults,
      ];

      let maxRounds = 3;
      let finalMessage: string | null = null;
      
      while (maxRounds > 0) {
        maxRounds--;
        const followUpResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: followUpMessages,
          tools: availableTools.length > 0 ? availableTools : undefined,
          tool_choice: availableTools.length > 0 ? "auto" : undefined,
          max_completion_tokens: 1024,
          temperature: 0.7,
        });

        const followUpMsg = followUpResponse.choices[0].message;
        
        if (followUpMsg.tool_calls && followUpMsg.tool_calls.length > 0) {
          const moreToolResults: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
          for (const toolCall of followUpMsg.tool_calls) {
            if (toolCall.type !== 'function') continue;
            const funcCall = toolCall as { id: string; type: 'function'; function: { name: string; arguments: string } };
            const toolArgs = JSON.parse(funcCall.function.arguments);
            const result = await executeToolCall(funcCall.function.name, toolArgs, userRole, allowedPages, context);
            actions.push({
              type: funcCall.function.name,
              data: result.data,
              success: result.success,
              message: result.message,
            });

            await logOaksyAction({
              userId: context.userId,
              userRole,
              conversationId,
              prompt: userMessage,
              actionType: funcCall.function.name,
              actionData: toolArgs,
              executedAction: funcCall.function.name,
              status: result.success ? 'success' : 'failed',
              error: result.success ? undefined : result.message,
            });

            moreToolResults.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(result),
            });
          }
          followUpMessages = [
            ...followUpMessages,
            { role: "assistant", content: followUpMsg.content || "", tool_calls: followUpMsg.tool_calls },
            ...moreToolResults,
          ];
          continue;
        }
        
        finalMessage = followUpMsg.content;
        break;
      }

      if (!finalMessage) {
        const actionSummary = actions.map(a => a.message).join('\n');
        return { response: actionSummary || "Action completed.", actions };
      }

      return { response: finalMessage, actions };
    }

    const assistantMessage = message.content;
    if (!assistantMessage) {
      throw new Error("No response from AI");
    }

    await logOaksyAction({
      userId: context.userId,
      userRole,
      conversationId,
      prompt: userMessage,
      aiOutput: assistantMessage.substring(0, 2000),
      status: 'success',
    });

    return { response: assistantMessage, actions: [] };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    await logOaksyAction({
      userId: context.userId,
      userRole,
      conversationId,
      prompt: userMessage,
      status: 'error',
      error: errMsg,
    });
    console.error("Oaksy AI error:", error);
    throw new Error(`Failed to generate response: ${errMsg}`);
  }
}

export async function generateConversationTitle(firstMessage: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    return firstMessage.substring(0, 50) + (firstMessage.length > 50 ? "..." : "");
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Generate a brief 3-5 word title summarizing this conversation topic. Reply with just the title, no quotes or punctuation.",
        },
        { role: "user", content: firstMessage },
      ],
      max_completion_tokens: 20,
      temperature: 0.5,
    });

    return response.choices[0].message.content || firstMessage.substring(0, 50);
  } catch {
    return firstMessage.substring(0, 50) + (firstMessage.length > 50 ? "..." : "");
  }
}

// Check if user can access Oaksy (exclude employee portal users)
export function canAccessOaksy(userRole: string, allowedPages: string[]): boolean {
  // Employee portal users cannot access Oaksy
  if (userRole === 'employee' && allowedPages.length === 1 && allowedPages[0] === 'employee-portal') {
    return false;
  }
  
  // Superadmin and admin always have access
  if (userRole === 'superadmin' || userRole === 'admin') {
    return true;
  }
  
  // Other users need at least one non-employee-portal page access
  return allowedPages.some(p => p !== 'employee-portal' && p !== 'oaksy');
}

import OpenAI from "openai";
import { storage } from "./storage";
import * as documentService from "./document-service";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface OaksyContext {
  userId: string;
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

// Map pages to their associated tool capabilities (only existing tools)
const PAGE_TO_TOOLS: Record<string, string[]> = {
  'dashboard': ['view_events', 'view_employees', 'view_daybook', 'view_banks', 'get_sales_summary'],
  'event-calendar': ['view_events', 'create_event', 'update_event', 'delete_event', 'get_sales_summary'],
  'team-calendar': ['view_meetings', 'create_meeting', 'update_meeting', 'delete_meeting'],
  'event-database': ['view_events', 'create_event', 'update_event', 'delete_event', 'get_sales_summary'],
  'event-milestones': ['view_events', 'update_event'],
  'daybook': ['view_daybook', 'create_daybook_entry', 'delete_daybook_entry', 'create_bank_transfer', 'view_banks', 'get_sales_summary'],
  'oak-book': ['view_daybook', 'view_banks', 'create_daybook_entry', 'create_bank_transfer', 'get_sales_summary'],
  'oak-sales': ['view_events', 'create_event', 'update_event', 'get_sales_summary'],
  'oak-inventory': ['view_events'],
  'execution-plan': ['view_events'],
  'hr': ['view_employees', 'create_employee', 'update_employee', 'delete_employee', 'view_leave_requests', 'update_leave_request', 'send_salary_slips_whatsapp'],
  'employee-portal': [],
  'oaksy': [],
  'admin': ['view_users', 'create_user', 'view_employees', 'view_events', 'view_daybook', 'view_banks', 'view_meetings', 'view_leave_requests', 'get_sales_summary', 'send_salary_slips_whatsapp'],
};

// All available Oaksy tools with their definitions
const ALL_OAKSY_TOOLS: Record<string, OpenAI.Chat.Completions.ChatCompletionTool> = {
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
};

// Get tools available for a user based on their role and permissions
function getToolsForUser(userRole: string, allowedPages: string[]): OpenAI.Chat.Completions.ChatCompletionTool[] {
  const availableToolNames = new Set<string>();

  // Superadmin gets ALL tools including WhatsApp
  if (userRole === 'superadmin') {
    return Object.values(ALL_OAKSY_TOOLS);
  }

  // For all other users (including admin), filter by allowed pages
  for (const pageId of allowedPages) {
    const toolsForPage = PAGE_TO_TOOLS[pageId] || [];
    toolsForPage.forEach(toolName => availableToolNames.add(toolName));
  }

  // Convert tool names to actual tool definitions (only include existing tools)
  const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [];
  Array.from(availableToolNames).forEach(toolName => {
    if (ALL_OAKSY_TOOLS[toolName]) {
      tools.push(ALL_OAKSY_TOOLS[toolName]);
    }
  });

  return tools;
}

function getSystemPromptForUser(userRole: string, allowedPages: string[], department: string): string {
  const basePrompt = `You are Oaksy, the intelligent AI assistant for Oak Street Events, an event management company in India. You are a powerful personal assistant that can help manage the entire business.

Your personality:
- Professional, efficient, and helpful
- Proactive in offering solutions
- Use simple language and avoid jargon
- Always refer to amounts in Indian Rupees (₹)
- Use date format DD/MM/YYYY (Indian format) when displaying dates

Company context: Oak Street Events specializes in weddings, corporate events, and special celebrations.

Today's date is: ${new Date().toISOString().split('T')[0]}

IMPORTANT INSTRUCTIONS:
- You have tools to VIEW, CREATE, EDIT, and DELETE items in the system
- When asked to perform an action, USE YOUR TOOLS - don't just describe what you would do
- Always confirm before deleting anything
- After any create/update/delete action, summarize what was done`;

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
  let contextStr = "\n\nCurrent context from the system:\n";

  if (context.events && context.events.length > 0) {
    const upcomingEvents = context.events
      .filter(e => new Date(e.date) >= new Date())
      .slice(0, 5);
    if (upcomingEvents.length > 0) {
      contextStr += `\nUpcoming Events (${upcomingEvents.length}):\n`;
      upcomingEvents.forEach(e => {
        contextStr += `- ${e.title} (ID: ${e.id}) on ${new Date(e.date).toLocaleDateString('en-IN')} at ${e.venue} (Customer: ${e.customer}, Value: ₹${Number(e.salesValue).toLocaleString('en-IN')})\n`;
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
    contextStr += `\nTeam Size: ${context.employees.length} employees\n`;
  }

  if (context.banks && context.banks.length > 0) {
    contextStr += `\nAvailable Bank Accounts:\n`;
    context.banks.forEach(b => {
      contextStr += `- ${b.name} (ID: ${b.id}, Balance: ₹${Number(b.balance).toLocaleString('en-IN')})\n`;
    });
  }

  if (context.daybookCategories && context.daybookCategories.length > 0) {
    contextStr += `\nDaybook Categories: ${context.daybookCategories.map((c: any) => c.name).join(', ')}\n`;
  }

  return contextStr;
}

async function executeToolCall(toolName: string, args: any, userRole: string, allowedPages: string[]): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    // Check if user has permission for this tool (consistent with getToolsForUser)
    const availableTools = new Set<string>();
    if (userRole === 'superadmin') {
      // Superadmin gets ALL tools
      Object.keys(ALL_OAKSY_TOOLS).forEach(t => availableTools.add(t));
    } else {
      // All other users (including admin) are filtered by their allowed pages
      for (const pageId of allowedPages) {
        (PAGE_TO_TOOLS[pageId] || []).forEach(t => availableTools.add(t));
      }
    }

    if (!availableTools.has(toolName)) {
      return { success: false, message: `You don't have permission to use ${toolName}` };
    }

    switch (toolName) {
      // Sales summary - calculates accurate totals from all events
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
        return {
          success: true,
          message: `Found ${employees.length} employee(s)`,
          data: employees.map(e => ({
            id: e.id,
            name: e.name,
            email: e.email,
            phone: e.phone,
            department: e.department,
            designation: e.designation,
          })),
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
        return {
          success: true,
          message: `Found ${requests.length} leave request(s)`,
          data: requests,
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

          const sendResult = await sendWhatsAppMessage(employee.phone, message);
          
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
  department: string = 'general'
): Promise<OaksyActionResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured");
  }

  const allowedPages = context.allowedPages || [];
  const userRole = context.userRole;

  // Get tools available for this user
  const availableTools = getToolsForUser(userRole, allowedPages);

  // If user has no tools (e.g., employee portal user), return limited response
  if (availableTools.length === 0) {
    return {
      response: "I'm sorry, but you don't have access to Oaksy's management features. Please contact your administrator if you need assistance.",
      actions: [],
    };
  }

  const messages = await storage.getOaksyMessages(conversationId);
  
  const systemPrompt = getSystemPromptForUser(userRole, allowedPages, department) + formatContextForAI(context);

  const conversationHistory: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...messages.map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: userMessage },
  ];

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: conversationHistory,
      tools: availableTools.length > 0 ? availableTools : undefined,
      tool_choice: availableTools.length > 0 ? "auto" : undefined,
      max_completion_tokens: 1024,
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
        const result = await executeToolCall(funcCall.function.name, args, userRole, allowedPages);
        
        actions.push({
          type: funcCall.function.name,
          data: result.data,
          success: result.success,
          message: result.message,
        });

        toolResults.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }

      const followUpResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          ...conversationHistory,
          {
            role: "assistant",
            content: message.content || "",
            tool_calls: message.tool_calls,
          },
          ...toolResults,
        ],
        max_completion_tokens: 512,
        temperature: 0.7,
      });

      const finalMessage = followUpResponse.choices[0].message.content;
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

    return { response: assistantMessage, actions: [] };
  } catch (error) {
    console.error("Oaksy AI error:", error);
    throw new Error(`Failed to generate response: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

import OpenAI from "openai";
import { storage } from "./storage";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface OaksyContext {
  userId: string;
  userRole: string;
  department?: string;
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

const oaksyTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "create_daybook_entry",
      description: "Create a new daybook entry for income or expense. Use this when the user wants to record a payment received, expense paid, or any financial transaction.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "The date of the entry in YYYY-MM-DD format. Use today's date if not specified.",
          },
          description: {
            type: "string",
            description: "A clear description of the transaction",
          },
          type: {
            type: "string",
            enum: ["income", "expense"],
            description: "Whether this is income (money received) or expense (money paid out)",
          },
          amount: {
            type: "number",
            description: "The amount in Indian Rupees (without currency symbol)",
          },
          category: {
            type: "string",
            description: "The category of the entry (e.g., 'Event Payment', 'Vendor Payment', 'Salary', 'Office Expense', 'Travel', etc.)",
          },
          eventName: {
            type: "string",
            description: "Optional: The name of the event this entry is related to",
          },
          vendorName: {
            type: "string",
            description: "Optional: The name of the vendor if this is a vendor payment",
          },
        },
        required: ["date", "description", "type", "amount", "category"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_meeting",
      description: "Schedule a new team meeting or client meeting. Use this when the user wants to create a meeting.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "The title/subject of the meeting",
          },
          date: {
            type: "string",
            description: "The date of the meeting in YYYY-MM-DD format",
          },
          time: {
            type: "string",
            description: "The time of the meeting in HH:MM format (24-hour)",
          },
          attendees: {
            type: "string",
            description: "Comma-separated list of attendee names",
          },
        },
        required: ["title", "date", "time"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_event",
      description: "Create a new event booking. Use this when the user wants to book a new wedding, corporate event, or celebration.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "The title of the event (e.g., 'Sharma Wedding', 'ABC Corp Annual Day')",
          },
          date: {
            type: "string",
            description: "The date of the event in YYYY-MM-DD format",
          },
          time: {
            type: "string",
            description: "The time of the event in HH:MM format (24-hour)",
          },
          type: {
            type: "string",
            enum: ["wedding", "corporate", "birthday", "other"],
            description: "The type of event",
          },
          customer: {
            type: "string",
            description: "The customer/client name",
          },
          venue: {
            type: "string",
            description: "The venue name and location",
          },
          planner: {
            type: "string",
            description: "The wedding planner or event coordinator assigned",
          },
          salesValue: {
            type: "number",
            description: "The total value/price of the event in Indian Rupees",
          },
        },
        required: ["title", "date", "type", "customer", "venue", "planner"],
      },
    },
  },
];

function getDepartmentSystemPrompt(department: string): string {
  const basePrompt = `You are Oaksy, the friendly AI assistant for Oak Street Events, an event management company in India. You help the team with their daily tasks, answer questions about company data, and provide guidance for event planning and management.

Your personality:
- Warm, professional, and helpful
- Use simple language and avoid jargon
- Be concise but thorough
- Always refer to amounts in Indian Rupees (₹)
- Use date format DD/MM/YYYY (Indian format) when displaying dates to users

Company context: Oak Street Events specializes in weddings, corporate events, and special celebrations. The team includes wedding planners, operations staff, sales team, and accounts professionals.

IMPORTANT: You have the ability to CREATE entries in the system. When a user asks you to record, create, add, or enter something, USE THE APPROPRIATE TOOL to do it. Don't just say you'll help - actually create the entry using your tools.

Today's date is: ${new Date().toISOString().split('T')[0]}`;

  const departmentPrompts: Record<string, string> = {
    sales: `${basePrompt}

Department Focus: SALES
You specialize in helping the sales team with:
- Lead management and follow-ups
- Creating quotes and proposals
- Understanding event pricing and packages
- Client communication tips
- Sales pipeline management
- Converting inquiries to bookings

ACTION CAPABILITIES:
- You CAN create new event bookings using the create_event tool
- You CAN schedule meetings using the create_meeting tool
- When a salesperson wants to record a new booking, USE the create_event tool`,

    wedding_planning: `${basePrompt}

Department Focus: WEDDING PLANNING
You specialize in helping wedding planners with:
- Event milestone tracking and timelines
- Vendor coordination
- Decor planning and themes
- Budget management for events
- Day-of coordination checklists
- Client meetings and presentations

ACTION CAPABILITIES:
- You CAN create new events using the create_event tool
- You CAN schedule client meetings using the create_meeting tool
- When a planner wants to book a new event or schedule a meeting, USE the appropriate tool`,

    operations: `${basePrompt}

Department Focus: OPERATIONS
You specialize in helping the operations team with:
- Inventory management
- Transportation logistics
- Manpower scheduling
- Vendor coordination
- Event setup and breakdown
- Quality control checklists

ACTION CAPABILITIES:
- You CAN schedule meetings using the create_meeting tool
- You CAN create expense entries for operations costs using create_daybook_entry tool
- When operations wants to record an expense or schedule a meeting, USE the appropriate tool`,

    accounts: `${basePrompt}

Department Focus: ACCOUNTS
You specialize in helping the accounts team with:
- Daybook entries and reconciliation
- Payment tracking (receivables and payables)
- Vendor payments
- Expense management
- Financial reports
- GST and tax compliance

ACTION CAPABILITIES:
- You CAN create daybook entries for income and expenses using the create_daybook_entry tool
- When an accountant wants to record a payment received, vendor payment, or any expense, USE the create_daybook_entry tool
- Always confirm the details before creating the entry
- After creating an entry, summarize what was created with the amount in ₹`,

    general: `${basePrompt}

ACTION CAPABILITIES:
- You CAN create daybook entries using the create_daybook_entry tool
- You CAN schedule meetings using the create_meeting tool
- You CAN create events using the create_event tool
- When asked to record, create, or add something, USE the appropriate tool`,
  };

  return departmentPrompts[department] || departmentPrompts.general;
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
        contextStr += `- ${e.title} on ${new Date(e.date).toLocaleDateString('en-IN')} at ${e.venue} (Customer: ${e.customer}, Value: ₹${Number(e.salesValue).toLocaleString('en-IN')})\n`;
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
      contextStr += `- ${b.name} (Balance: ₹${Number(b.balance).toLocaleString('en-IN')})\n`;
    });
  }

  if (context.daybookCategories && context.daybookCategories.length > 0) {
    contextStr += `\nDaybook Categories: ${context.daybookCategories.map((c: any) => c.name).join(', ')}\n`;
  }

  return contextStr;
}

async function executeToolCall(toolName: string, args: any): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    switch (toolName) {
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
          message: `Created event: "${args.title}" on ${new Date(args.date).toLocaleDateString('en-IN')} for ${args.customer} at ${args.venue}${args.salesValue ? ` (Value: ₹${Number(args.salesValue).toLocaleString('en-IN')})` : ''}`,
          data: event,
        };
      }

      default:
        return { success: false, message: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    console.error(`Error executing tool ${toolName}:`, error);
    return {
      success: false,
      message: `Failed to execute ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
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

  const messages = await storage.getOaksyMessages(conversationId);
  
  const systemPrompt = getDepartmentSystemPrompt(department) + formatContextForAI(context);

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
      tools: oaksyTools,
      tool_choice: "auto",
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
        const result = await executeToolCall(funcCall.function.name, args);
        
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

import OpenAI from "openai";
import { storage } from "./storage";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface OaksyContext {
  userId: string;
  userRole: string;
  department?: string;
  events?: any[];
  employees?: any[];
  daybookSummary?: {
    totalIncome: number;
    totalExpense: number;
    balance: number;
  };
}

function getDepartmentSystemPrompt(department: string): string {
  const basePrompt = `You are Oaksy, the friendly AI assistant for Oak Street Events, an event management company in India. You help the team with their daily tasks, answer questions about company data, and provide guidance for event planning and management.

Your personality:
- Warm, professional, and helpful
- Use simple language and avoid jargon
- Be concise but thorough
- Always refer to amounts in Indian Rupees (₹)
- Use date format DD/MM/YYYY (Indian format)

Company context: Oak Street Events specializes in weddings, corporate events, and special celebrations. The team includes wedding planners, operations staff, sales team, and accounts professionals.`;

  const departmentPrompts: Record<string, string> = {
    sales: `${basePrompt}

Department Focus: SALES
You specialize in helping the sales team with:
- Lead management and follow-ups
- Creating quotes and proposals
- Understanding event pricing and packages
- Client communication tips
- Sales pipeline management
- Converting inquiries to bookings`,

    wedding_planning: `${basePrompt}

Department Focus: WEDDING PLANNING
You specialize in helping wedding planners with:
- Event milestone tracking and timelines
- Vendor coordination
- Decor planning and themes
- Budget management for events
- Day-of coordination checklists
- Client meetings and presentations`,

    operations: `${basePrompt}

Department Focus: OPERATIONS
You specialize in helping the operations team with:
- Inventory management
- Transportation logistics
- Manpower scheduling
- Vendor coordination
- Event setup and breakdown
- Quality control checklists`,

    accounts: `${basePrompt}

Department Focus: ACCOUNTS
You specialize in helping the accounts team with:
- Daybook entries and reconciliation
- Payment tracking (receivables and payables)
- Vendor payments
- Expense management
- Financial reports
- GST and tax compliance`,

    general: basePrompt,
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

  return contextStr;
}

export async function generateOaksyResponse(
  conversationId: string,
  userMessage: string,
  context: OaksyContext,
  department: string = 'general'
): Promise<string> {
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
      max_completion_tokens: 1024,
      temperature: 0.7,
    });

    const assistantMessage = response.choices[0].message.content;
    if (!assistantMessage) {
      throw new Error("No response from AI");
    }

    return assistantMessage;
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

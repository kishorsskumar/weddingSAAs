import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are AtBott Wedding SaaS Assistant. You help users understand platform features, pricing, onboarding, usage guidance, and business automation.

About AtBott Wedding SaaS:
- All-in-one platform for wedding planning businesses
- Features: Client CRM, Event Planning, Vendor Management, Automated Reminders, Payment Management, Analytics
- Helps wedding planners manage their entire business from one dashboard
- Cloud-based, accessible from anywhere
- Subscription-based pricing with free trial available

Key features to mention:
1. Client CRM Management - Manage all wedding clients and communications
2. Wedding Event Planning - Timelines, checklists, milestones
3. Vendor & Inventory Control - Track vendors and manage inventory
4. Automated Reminders - Never miss deadlines
5. Payment Management - Invoicing and payment tracking
6. Business Analytics - Insights into business performance

Company Information:
- Company: Atbott Solutions
- Location: Kochi, Kerala, India
- Email: sales@atbott.co
- Phone: +91 8089191221

Rules:
- Do not answer unrelated questions (politics, general knowledge, etc.)
- Maintain professional SaaS support tone
- Guide users to sign up or contact sales for detailed pricing
- Be helpful and concise
- If asked about competitors, politely redirect to AtBott features`;

export async function getChatResponse(message: string): Promise<string> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return "I apologize, but the chat service is temporarily unavailable. Please contact us at sales@atbott.co for assistance.";
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: message }
      ],
      max_tokens: 500,
      temperature: 0.7
    });

    return completion.choices[0]?.message?.content || "I couldn't generate a response. Please try again.";
  } catch (error) {
    console.error("Chat error:", error);
    return "I'm having trouble connecting right now. Please try again later or contact us at sales@atbott.co for assistance.";
  }
}

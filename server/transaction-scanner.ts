import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ParsedTransaction {
  type: 'income' | 'expense';
  amount: number;
  date: string;
  description: string;
  paymentMethod: string;
  reference: string | null;
  counterparty: string | null;
  confidence: number;
  rawText: string;
}

export interface ImageAnalysis {
  imageType: 'qr_code' | 'transaction_receipt' | 'income_screenshot' | 'expense_screenshot' | 'unknown';
  amount: number | null;
  status: 'success' | 'pending' | 'failed' | 'unknown';
  counterparty: string | null;
  transactionType: 'income' | 'expense' | 'unknown';
  confidence: number;
  description: string;
}

export async function analyzeImageFromUrl(imageUrl: string): Promise<ImageAnalysis> {
  const prompt = `Analyze this image and determine what type it is. Respond ONLY with valid JSON:

{
  "imageType": "qr_code" | "transaction_receipt" | "income_screenshot" | "expense_screenshot" | "unknown",
  "amount": number or null (extract amount in INR if visible, e.g., "₹45,000" = 45000),
  "status": "success" | "pending" | "failed" | "unknown" (look for SUCCESS, Completed, Pending, Failed keywords),
  "counterparty": "name of person/business if visible" or null,
  "transactionType": "income" | "expense" | "unknown" (Received/Credited = income, Sent/Paid/Debited = expense),
  "confidence": number 0-1 (how confident you are),
  "description": "brief description of what the image shows"
}

Classification rules:
- QR CODE: Shows a scannable QR pattern, UPI ID, "Scan to Pay", GPay/PhonePe/Paytm QR
- TRANSACTION RECEIPT: Shows completed payment with Transaction ID, SUCCESS/Completed status, amount, date/time
- INCOME SCREENSHOT: Shows money received/credited to user's account
- EXPENSE SCREENSHOT: Shows money sent/paid/debited from user's account
- UNKNOWN: Cannot determine or unclear image

For Indian payment apps (GPay, PhonePe, Paytm, bank apps), look for:
- "Transaction Amount" or "Amount" fields for the amount
- "SUCCESS", "Completed", "Payment Successful" for status
- "Sent to" vs "Received from" to determine transaction type`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: imageUrl }
            }
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 512,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(content);
    
    return {
      imageType: parsed.imageType || 'unknown',
      amount: parsed.amount ? Number(parsed.amount) : null,
      status: parsed.status || 'unknown',
      counterparty: parsed.counterparty || null,
      transactionType: parsed.transactionType || 'unknown',
      confidence: Number(parsed.confidence) || 0.5,
      description: parsed.description || '',
    };
  } catch (error) {
    console.error('Image analysis error:', error);
    return {
      imageType: 'unknown',
      amount: null,
      status: 'unknown',
      counterparty: null,
      transactionType: 'unknown',
      confidence: 0,
      description: 'Could not analyze image',
    };
  }
}

export async function parseTransactionScreenshot(base64Image: string): Promise<ParsedTransaction> {
  const prompt = `Analyze this transaction screenshot (likely from an Indian bank app, UPI payment, or payment gateway like GPay, PhonePe, Paytm, HDFC, ICICI, SBI, etc.).

Extract the following information and respond ONLY with valid JSON:
{
  "type": "income" or "expense" (determine based on whether money was received or sent),
  "amount": number (the transaction amount in INR, just the number without currency symbols),
  "date": "YYYY-MM-DD" format (the transaction date),
  "description": "brief description of the transaction",
  "paymentMethod": "UPI" | "NEFT" | "IMPS" | "Card" | "Cash" | "Bank Transfer" | "Other",
  "reference": "transaction ID or reference number if visible, or null",
  "counterparty": "name of the other party (sender for income, receiver for expense), or null if not visible",
  "confidence": number between 0 and 1 indicating how confident you are in the extraction,
  "rawText": "key text extracted from the image"
}

Important:
- If the screenshot shows "Received" or "Credited", it's income
- If it shows "Sent", "Paid", "Debited", it's expense
- For amount, extract only the numeric value (e.g., "₹5,000" becomes 5000)
- If date is not clearly visible, use today's date
- Be conservative with confidence - use lower values if information is unclear`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: base64Image.startsWith('data:') ? base64Image : `data:image/jpeg;base64,${base64Image}`
              }
            }
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 1024,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(content);
    
    return {
      type: parsed.type === 'income' ? 'income' : 'expense',
      amount: Number(parsed.amount) || 0,
      date: parsed.date || new Date().toISOString().split('T')[0],
      description: parsed.description || 'Transaction',
      paymentMethod: parsed.paymentMethod || 'Other',
      reference: parsed.reference || null,
      counterparty: parsed.counterparty || null,
      confidence: Number(parsed.confidence) || 0.5,
      rawText: parsed.rawText || '',
    };
  } catch (error) {
    console.error('Transaction parsing error:', error);
    throw new Error(`Failed to parse transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

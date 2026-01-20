import Razorpay from 'razorpay';
import crypto from 'crypto';

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

let razorpay: Razorpay | null = null;

export function isRazorpayConfigured(): boolean {
  return !!(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET);
}

function getRazorpayInstance(): Razorpay {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay credentials not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.');
  }
  
  if (!razorpay) {
    razorpay = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET,
    });
  }
  
  return razorpay;
}

export function getRazorpayKeyId(): string {
  return RAZORPAY_KEY_ID || '';
}

interface CreateSubscriptionParams {
  planId: string;
  customerEmail: string;
  customerName: string;
  companyId: string;
}

interface SubscriptionResponse {
  id: string;
  short_url: string;
  status: string;
  customer_id?: string;
}

export async function createSubscription(params: CreateSubscriptionParams): Promise<SubscriptionResponse> {
  const rp = getRazorpayInstance();
  
  const subscription = await rp.subscriptions.create({
    plan_id: params.planId,
    total_count: 12,
    quantity: 1,
    customer_notify: 1,
    notes: {
      company_id: params.companyId,
      customer_email: params.customerEmail,
      customer_name: params.customerName,
    },
  });
  
  return {
    id: subscription.id,
    short_url: subscription.short_url,
    status: subscription.status,
    customer_id: subscription.customer_id,
  };
}

interface CreateOrderParams {
  amount: number;
  currency?: string;
  companyId: string;
  planName: string;
}

interface OrderResponse {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

export async function createOrder(params: CreateOrderParams): Promise<OrderResponse> {
  const rp = getRazorpayInstance();
  
  const order = await rp.orders.create({
    amount: params.amount * 100,
    currency: params.currency || 'INR',
    notes: {
      company_id: params.companyId,
      plan_name: params.planName,
    },
  });
  
  return {
    id: order.id,
    amount: order.amount as number,
    currency: order.currency,
    status: order.status,
  };
}

interface VerifyPaymentParams {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export function verifyPaymentSignature(params: VerifyPaymentParams): boolean {
  if (!RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay secret not configured');
  }
  
  const body = params.razorpayOrderId + '|' + params.razorpayPaymentId;
  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');
  
  return expectedSignature === params.razorpaySignature;
}

interface VerifySubscriptionParams {
  razorpaySubscriptionId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export function verifySubscriptionSignature(params: VerifySubscriptionParams): boolean {
  if (!RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay secret not configured');
  }
  
  const body = params.razorpayPaymentId + '|' + params.razorpaySubscriptionId;
  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');
  
  return expectedSignature === params.razorpaySignature;
}

export function isWebhookSecretConfigured(): boolean {
  return !!RAZORPAY_WEBHOOK_SECRET;
}

export function verifyWebhookSignature(body: string, signature: string): boolean {
  if (!RAZORPAY_WEBHOOK_SECRET) {
    console.error('SECURITY: Razorpay webhook secret not configured, rejecting webhook');
    return false;
  }
  
  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest('hex');
  
  return expectedSignature === signature;
}

export async function getSubscription(subscriptionId: string): Promise<any> {
  const rp = getRazorpayInstance();
  return await rp.subscriptions.fetch(subscriptionId);
}

export async function cancelSubscription(subscriptionId: string): Promise<any> {
  const rp = getRazorpayInstance();
  return await rp.subscriptions.cancel(subscriptionId);
}

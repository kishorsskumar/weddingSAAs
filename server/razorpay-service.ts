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

// ============================================
// MODULAR SUBSCRIPTION SYSTEM
// ============================================

interface CreatePlanParams {
  name: string;
  description?: string;
  amount: number; // in paise
  currency?: string;
  period: 'monthly' | 'yearly';
  interval: number;
}

interface PlanResponse {
  id: string;
  entity: string;
  interval: number;
  period: string;
  item: {
    id: string;
    name: string;
    amount: number;
  };
}

export async function createPlan(params: CreatePlanParams): Promise<PlanResponse> {
  const rp = getRazorpayInstance();
  
  const plan = await rp.plans.create({
    period: params.period,
    interval: params.interval,
    item: {
      name: params.name,
      description: params.description || '',
      amount: params.amount,
      currency: params.currency || 'INR',
    },
  });
  
  return plan as PlanResponse;
}

export async function getPlan(planId: string): Promise<any> {
  const rp = getRazorpayInstance();
  return await rp.plans.fetch(planId);
}

export async function getAllPlans(): Promise<any> {
  const rp = getRazorpayInstance();
  return await rp.plans.all();
}

interface CreateModuleSubscriptionParams {
  planId: string;
  customerId?: string;
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  companyId: string;
  moduleCode: string;
  totalCount?: number; // Number of billing cycles
  startAt?: number; // Unix timestamp for delayed start
}

export async function createModuleSubscription(params: CreateModuleSubscriptionParams): Promise<SubscriptionResponse> {
  const rp = getRazorpayInstance();
  
  let customerId = params.customerId;
  
  // Create customer if not exists
  if (!customerId) {
    try {
      const customer = await rp.customers.create({
        name: params.customerName,
        email: params.customerEmail,
        contact: params.customerPhone || '',
        notes: {
          company_id: params.companyId,
        },
      });
      customerId = customer.id;
    } catch (error: any) {
      // Customer might already exist, try to fetch by email
      console.log('Customer creation failed, might already exist:', error.message);
    }
  }
  
  const subscriptionParams: any = {
    plan_id: params.planId,
    total_count: params.totalCount || 120, // Default 10 years
    quantity: 1,
    customer_notify: 1,
    notes: {
      company_id: params.companyId,
      module_code: params.moduleCode,
      customer_email: params.customerEmail,
      customer_name: params.customerName,
    },
  };
  
  if (customerId) {
    subscriptionParams.customer_id = customerId;
  }
  
  if (params.startAt) {
    subscriptionParams.start_at = params.startAt;
  }
  
  const subscription = await rp.subscriptions.create(subscriptionParams);
  
  return {
    id: subscription.id,
    short_url: subscription.short_url,
    status: subscription.status,
    customer_id: subscription.customer_id || customerId,
  };
}

export async function pauseSubscription(subscriptionId: string, pauseAt?: string): Promise<any> {
  const rp = getRazorpayInstance();
  return await rp.subscriptions.pause(subscriptionId, { pause_at: pauseAt || 'now' });
}

export async function resumeSubscription(subscriptionId: string, resumeAt?: string): Promise<any> {
  const rp = getRazorpayInstance();
  return await rp.subscriptions.resume(subscriptionId, { resume_at: resumeAt || 'now' });
}

export async function updateSubscription(subscriptionId: string, params: any): Promise<any> {
  const rp = getRazorpayInstance();
  return await rp.subscriptions.update(subscriptionId, params);
}

export async function getSubscriptionInvoices(subscriptionId: string): Promise<any> {
  const rp = getRazorpayInstance();
  return await rp.invoices.all({ subscription_id: subscriptionId });
}

export async function getPendingUpdate(subscriptionId: string): Promise<any> {
  const rp = getRazorpayInstance();
  return await rp.subscriptions.pendingUpdate(subscriptionId);
}

export async function cancelPendingUpdate(subscriptionId: string): Promise<any> {
  const rp = getRazorpayInstance();
  return await rp.subscriptions.cancelScheduledChanges(subscriptionId);
}

// Calculate amount with any discounts for yearly plans
export function calculatePlanAmount(monthlyPrice: number, billingCycle: 'monthly' | 'yearly'): number {
  if (billingCycle === 'yearly') {
    // Yearly price is already 2 months discount (10 months price)
    return monthlyPrice * 10;
  }
  return monthlyPrice;
}

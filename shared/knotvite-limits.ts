export interface KnotVitePlanLimits {
  maxForms: number;
  maxGuestsPerForm: number;
  maxCustomFields: number;
  canExportExcel: boolean;
  canBulkImport: boolean;
  canRemoveBranding: boolean;
  canUseWhatsApp: boolean;
  canUseQrCheckin: boolean;
  canUseWeddingPage: boolean;
  canUseCustomDomain: boolean;
  canUseWhatsAppAutomation: boolean;
  maxEvents: number;
}

export const KNOTVITE_PLANS = {
  basic: {
    name: 'Basic',
    price: 4999,
    trialDays: 14,
    limits: {
      maxForms: 1,
      maxGuestsPerForm: 200,
      maxCustomFields: 5,
      maxEvents: 1,
      canExportExcel: false,
      canBulkImport: false,
      canRemoveBranding: false,
      canUseWhatsApp: false,
      canUseQrCheckin: false,
      canUseWeddingPage: false,
      canUseCustomDomain: false,
      canUseWhatsAppAutomation: false,
    } as KnotVitePlanLimits,
  },
  pro: {
    name: 'Pro',
    price: 14999,
    trialDays: 0,
    limits: {
      maxForms: 999999,
      maxGuestsPerForm: 400,
      maxCustomFields: 999999,
      maxEvents: 5,
      canExportExcel: true,
      canBulkImport: true,
      canRemoveBranding: true,
      canUseWhatsApp: true,
      canUseQrCheckin: false,
      canUseWeddingPage: false,
      canUseCustomDomain: false,
      canUseWhatsAppAutomation: true,
    } as KnotVitePlanLimits,
  },
  premium: {
    name: 'Premium',
    price: 24999,
    trialDays: 0,
    limits: {
      maxForms: 999999,
      maxGuestsPerForm: 999999,
      maxCustomFields: 999999,
      maxEvents: 999999,
      canExportExcel: true,
      canBulkImport: true,
      canRemoveBranding: true,
      canUseWhatsApp: true,
      canUseQrCheckin: true,
      canUseWeddingPage: true,
      canUseCustomDomain: true,
      canUseWhatsAppAutomation: true,
    } as KnotVitePlanLimits,
  },
} as const;

export type KnotVitePlan = 'basic' | 'pro' | 'premium';

export const KNOTVITE_PLAN_CATALOG: Record<string, { name: string; amount: number }> = {
  knotvite_basic: { name: 'KnotVite Basic', amount: 4999 },
  knotvite_pro: { name: 'KnotVite Pro', amount: 14999 },
  knotvite_premium: { name: 'KnotVite Premium', amount: 24999 },
};

export function getKnotViteLimits(plan: KnotVitePlan): KnotVitePlanLimits {
  return KNOTVITE_PLANS[plan]?.limits || KNOTVITE_PLANS.basic.limits;
}

export function getKnotVitePlanPrice(plan: KnotVitePlan): number {
  return KNOTVITE_PLANS[plan]?.price || KNOTVITE_PLANS.basic.price;
}

export function checkKnotViteLimit(
  plan: KnotVitePlan,
  limitType: keyof KnotVitePlanLimits,
  currentValue?: number
): { allowed: boolean; limit: number | boolean; message?: string } {
  const limits = getKnotViteLimits(plan);
  const limit = limits[limitType];

  if (typeof limit === 'boolean') {
    return {
      allowed: limit,
      limit,
      message: limit ? undefined : `This feature requires a higher plan. Upgrade to unlock it.`,
    };
  }

  if (currentValue !== undefined && currentValue >= limit) {
    return {
      allowed: false,
      limit,
      message: `You've reached the limit of ${limit} for this feature. Upgrade your plan for more.`,
    };
  }

  return { allowed: true, limit };
}

export const GST_RATE = 0.18;

export function calculateGSTBreakdown(baseAmount: number) {
  const gstAmount = Math.round(baseAmount * GST_RATE);
  const totalAmount = baseAmount + gstAmount;
  const cgst = Math.round(gstAmount / 2);
  const sgst = Math.round(gstAmount / 2);
  return { baseAmount, gstAmount, cgst, sgst, totalAmount, gstRate: GST_RATE };
}

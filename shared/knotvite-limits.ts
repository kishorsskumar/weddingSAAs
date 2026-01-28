// KnotVite Plan Limits
// Free plan has limited features, Pro unlocks everything

export interface KnotVitePlanLimits {
  maxForms: number;
  maxGuestsPerForm: number;
  maxCustomFields: number;
  canExportExcel: boolean;
  canBulkImport: boolean;
  canRemoveBranding: boolean;
  canUseWhatsApp: boolean;
}

export const KNOTVITE_FREE_LIMITS: KnotVitePlanLimits = {
  maxForms: 1,
  maxGuestsPerForm: 100,
  maxCustomFields: 5,
  canExportExcel: false,
  canBulkImport: false,
  canRemoveBranding: false,
  canUseWhatsApp: false,
};

export const KNOTVITE_PRO_LIMITS: KnotVitePlanLimits = {
  maxForms: 999999, // Unlimited
  maxGuestsPerForm: 999999, // Unlimited
  maxCustomFields: 999999, // Unlimited
  canExportExcel: true,
  canBulkImport: true,
  canRemoveBranding: true,
  canUseWhatsApp: true,
};

export type KnotVitePlan = 'free' | 'pro';

export function getKnotViteLimits(plan: KnotVitePlan): KnotVitePlanLimits {
  return plan === 'pro' ? KNOTVITE_PRO_LIMITS : KNOTVITE_FREE_LIMITS;
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
      message: limit ? undefined : `This feature requires a Pro subscription`,
    };
  }
  
  if (currentValue !== undefined && currentValue >= limit) {
    return {
      allowed: false,
      limit,
      message: `You've reached the limit of ${limit} for this feature. Upgrade to Pro for unlimited access.`,
    };
  }
  
  return { allowed: true, limit };
}

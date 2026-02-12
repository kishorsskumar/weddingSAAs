export type PlanType = 'starter' | 'growth' | 'enterprise';

export function normalizePlanName(planName: string | null | undefined): PlanType {
  if (!planName) return 'starter';
  const lower = planName.toLowerCase();
  if (lower.includes('enterprise')) return 'enterprise';
  if (lower.includes('growth') || lower.includes('pro') || lower.includes('trial')) return 'growth';
  return 'starter';
}

const STARTER_PAGES = [
  'dashboard',
  'sales', 'sales-leads', 'sales-pipeline', 'sales-estimates', 'sales-settings',
  'event-hub', 'event-calendar', 'event-milestones', 'execution-plan',
  'finance', 'finance-customers', 'finance-estimates', 'finance-invoices', 'finance-settings',
  'client-portal', 'portal-admin', 'portfolio-admin',
  'people',
  'tools', 'oaksy',
];

const GROWTH_ADDITIONS = [
  'sales-reports',
  'finance-payments', 'finance-reports', 'finance-vendors',
  'team-calendar',
  'oak-rsvp', 'oak-creative',
  'operations', 'ops-items', 'ops-purchase-orders', 'ops-templates',
  'ops-event-inventory', 'ops-rentals', 'ops-production', 'ops-execution',
  'ops-transportation', 'ops-manpower',
];

const ENTERPRISE_ADDITIONS = [
  'knotvite', 'knotvite-dashboard', 'knotvite-forms', 'knotvite-submissions',
  'hr', 'employee-portal',
  'finance-masters',
  'daybook',
  'whatsapp-inbox',
  'management-mis', 'mis-overview', 'event-database', 'mis-financial', 'mis-sales', 'mis-operations',
];

const SUPERADMIN_PAGES = ['admin'];

const CLIENT_USER_PAGES = [
  'dashboard', 'client-portal',
];

const TEAM_MEMBER_PAGES = [
  'dashboard', 'event-hub', 'event-calendar', 'event-milestones', 'execution-plan',
  'employee-portal', 'team-calendar', 'tools', 'oaksy',
];

const GROWTH_PAGES = [...STARTER_PAGES, ...GROWTH_ADDITIONS];
const ENTERPRISE_PAGES = [...GROWTH_PAGES, ...ENTERPRISE_ADDITIONS];
const ALL_PLAN_PAGES = [...ENTERPRISE_PAGES, ...SUPERADMIN_PAGES];

export const PLAN_FEATURE_MATRIX: Record<PlanType, string[]> = {
  starter: STARTER_PAGES,
  growth: GROWTH_PAGES,
  enterprise: ENTERPRISE_PAGES,
};

export const PLAN_TEAM_LIMITS: Record<PlanType, number> = {
  starter: 1,
  growth: 5,
  enterprise: Infinity,
};

export function getAllowedPagesByPlanAndRole(
  planName: string | null | undefined,
  role: string,
): string[] {
  if (role === 'superadmin') return ALL_PLAN_PAGES;

  const plan = normalizePlanName(planName);
  const planPages = PLAN_FEATURE_MATRIX[plan] || STARTER_PAGES;

  if (role === 'admin' || role === 'tenant_admin') {
    return planPages;
  }

  if (role === 'client_user') {
    return CLIENT_USER_PAGES.filter(p => planPages.includes(p));
  }

  if (role === 'team_member' || role === 'employee') {
    return TEAM_MEMBER_PAGES.filter(p => planPages.includes(p));
  }

  return planPages;
}

export function isPageAllowedByPlan(
  pageId: string,
  planName: string | null | undefined,
  role: string,
): boolean {
  const allowed = getAllowedPagesByPlanAndRole(planName, role);
  return allowed.includes(pageId);
}

export function getRouteToPageMapping(): Record<string, string> {
  return {
    '/dashboard': 'dashboard',
    '/events': 'event-calendar',
    '/milestones': 'event-milestones',
    '/execution-plan': 'execution-plan',
    '/monthly-plan': 'operations',
    '/oak-sales': 'sales',
    '/oak-book': 'finance',
    '/daybook': 'daybook',
    '/hr': 'hr',
    '/employee-portal': 'employee-portal',
    '/team': 'team-calendar',
    '/admin': 'admin',
    '/oak-inventory': 'operations',
    '/oaksy': 'oaksy',
    '/oak-creative': 'oak-creative',
    '/oak-rsvp': 'oak-rsvp',
    '/whatsapp-inbox': 'whatsapp-inbox',
    '/management-mis': 'management-mis',
    '/database': 'event-database',
    '/knotvite/dashboard': 'knotvite',
    '/knotvite/forms': 'knotvite',
    '/knotvite/submissions': 'knotvite',
    '/portal-admin': 'portal-admin',
    '/portfolio-admin': 'portfolio-admin',
  };
}

export const PLAN_DISPLAY_NAMES: Record<PlanType, string> = {
  starter: 'Starter',
  growth: 'Growth',
  enterprise: 'Enterprise',
};

export function getRequiredPlanForPage(pageId: string): PlanType | null {
  if (STARTER_PAGES.includes(pageId)) return 'starter';
  if (GROWTH_ADDITIONS.includes(pageId)) return 'growth';
  if (ENTERPRISE_ADDITIONS.includes(pageId)) return 'enterprise';
  if (SUPERADMIN_PAGES.includes(pageId)) return null;
  return null;
}

export function getApiRouteToPageMapping(): Record<string, string> {
  return {
    '/events': 'event-calendar',
    '/meetings': 'event-calendar',
    '/milestones': 'event-milestones',
    '/leads': 'sales-leads',
    '/crm': 'sales',
    '/pipeline': 'sales-pipeline',
    '/customers': 'finance-customers',
    '/vendors': 'finance-vendors',
    '/estimates': 'finance-estimates',
    '/invoices': 'finance-invoices',
    '/customer-payments': 'finance-payments',
    '/payments-received': 'finance-payments',
    '/expenses': 'finance',
    '/vendor-payments': 'finance-vendors',
    '/daybook': 'daybook',
    '/banks': 'finance',
    '/employees': 'hr',
    '/leave': 'hr',
    '/leave-categories': 'hr',
    '/attendance': 'hr',
    '/hr': 'hr',
    '/inventory': 'operations',
    '/purchase-orders': 'operations',
    '/production-plan': 'operations',
    '/monthly-plan': 'operations',
    '/transportation': 'operations',
    '/manpower': 'operations',
    '/rentals': 'operations',
    '/decor': 'operations',
    '/whatsapp': 'whatsapp-inbox',
    '/oaksy': 'oaksy',
    '/rsvp': 'oak-rsvp',
    '/knotvite': 'knotvite',
    '/management-mis': 'management-mis',
    '/creative': 'oak-creative',
    '/portfolio': 'portfolio-admin',
    '/portal': 'portal-admin',
    '/event-guests': 'oak-rsvp',
    '/guest': 'oak-rsvp',
    '/sales-reports': 'sales-reports',
  };
}

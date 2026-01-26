import { Request, Response, NextFunction } from 'express';
import { db } from './db';
import { companyModuleSubscriptions, aiUsage, aiAssistantSettings, users } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    companyId?: string;
  }
}

async function getCompanyIdFromSession(req: Request): Promise<string | null> {
  if (!req.session.userId) return null;
  
  const [user] = await db.select().from(users).where(eq(users.id, req.session.userId));
  return user?.companyId || null;
}

export function requireModule(moduleCode: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await getCompanyIdFromSession(req);
      
      if (!companyId) {
        return res.status(401).json({ 
          error: 'Authentication required',
          moduleRequired: moduleCode 
        });
      }

      const [coreSub] = await db.select().from(companyModuleSubscriptions)
        .where(and(
          eq(companyModuleSubscriptions.companyId, companyId),
          eq(companyModuleSubscriptions.moduleCode, 'core'),
          eq(companyModuleSubscriptions.status, 'active')
        ));

      if (!coreSub) {
        return res.status(403).json({ 
          error: 'Core platform subscription required',
          moduleRequired: 'core',
          upgradeUrl: '/billing'
        });
      }

      if (moduleCode !== 'core') {
        const [moduleSub] = await db.select().from(companyModuleSubscriptions)
          .where(and(
            eq(companyModuleSubscriptions.companyId, companyId),
            eq(companyModuleSubscriptions.moduleCode, moduleCode),
            eq(companyModuleSubscriptions.status, 'active')
          ));

        if (!moduleSub) {
          return res.status(403).json({ 
            error: `${moduleCode.toUpperCase()} module subscription required`,
            moduleRequired: moduleCode,
            upgradeUrl: '/billing'
          });
        }
      }

      next();
    } catch (error) {
      console.error('Module middleware error:', error);
      res.status(500).json({ error: 'Failed to verify module access' });
    }
  };
}

export function requireAiWithTokenLimit() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = await getCompanyIdFromSession(req);
      
      if (!companyId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const [coreSub] = await db.select().from(companyModuleSubscriptions)
        .where(and(
          eq(companyModuleSubscriptions.companyId, companyId),
          eq(companyModuleSubscriptions.moduleCode, 'core'),
          eq(companyModuleSubscriptions.status, 'active')
        ));

      if (!coreSub) {
        return res.status(403).json({ 
          error: 'Core platform subscription required for AI access',
          upgradeUrl: '/billing'
        });
      }

      const [aiSub] = await db.select().from(companyModuleSubscriptions)
        .where(and(
          eq(companyModuleSubscriptions.companyId, companyId),
          eq(companyModuleSubscriptions.moduleCode, 'ai_assistant'),
          eq(companyModuleSubscriptions.status, 'active')
        ));

      if (!aiSub) {
        return res.status(403).json({ 
          error: 'AI Assistant module subscription required',
          moduleRequired: 'ai_assistant',
          upgradeUrl: '/billing'
        });
      }

      const [settings] = await db.select().from(aiAssistantSettings)
        .where(eq(aiAssistantSettings.companyId, companyId));

      const tokenLimit = settings?.monthlyTokenLimit || 50000;

      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      const [usage] = await db.select().from(aiUsage)
        .where(and(
          eq(aiUsage.companyId, companyId),
          eq(aiUsage.month, month),
          eq(aiUsage.year, year)
        ));

      const tokensUsed = usage?.tokensUsed || 0;

      if (tokensUsed >= tokenLimit) {
        return res.status(429).json({ 
          error: 'Monthly AI token limit reached',
          tokensUsed,
          tokenLimit,
          resetsAt: new Date(year, month, 1).toISOString()
        });
      }

      (req as any).aiTokensRemaining = tokenLimit - tokensUsed;
      (req as any).aiTokenLimit = tokenLimit;
      (req as any).aiSettings = settings;

      next();
    } catch (error) {
      console.error('AI middleware error:', error);
      res.status(500).json({ error: 'Failed to verify AI access' });
    }
  };
}

export const MODULE_ROUTE_MAP: Record<string, string[]> = {
  rsvp: ['/api/rsvp', '/api/event-guests'],
  crm: ['/api/sales', '/api/leads', '/api/deals'],
  vendor: ['/api/vendors'],
  payments: ['/api/daybook', '/api/invoices', '/api/payments'],
  automation: ['/api/automations'],
  ai_assistant: ['/api/ai', '/api/oaksy'],
};

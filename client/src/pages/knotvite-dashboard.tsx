import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  FileText, Users, CheckCircle2, XCircle, HelpCircle, 
  TrendingUp, Crown, ArrowUpRight, Calendar
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { format } from "date-fns";
import { useLocation } from "wouter";

interface KnotVitePlanStatus {
  plan: 'free' | 'pro';
  limits: {
    maxForms: number;
    maxGuestsPerForm: number;
    maxCustomFields: number;
    canExportExcel: boolean;
    canBulkImport: boolean;
    canRemoveBranding: boolean;
    canUseWhatsApp: boolean;
  };
  usage: {
    formsCount: number;
    totalGuests: number;
  };
  subscription?: {
    status: string;
    billingCycle: string;
    nextBillingDate: string;
  } | null;
}

interface RsvpFormTemplate {
  id: string;
  name: string;
  status: string;
  eventId?: string | null;
  createdAt: string;
}

interface RsvpStats {
  total: number;
  attending: number;
  notAttending: number;
  maybe: number;
  pending: number;
}

export default function KnotViteDashboard() {
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const { data: planStatus } = useQuery<KnotVitePlanStatus>({
    queryKey: ['/api/knotvite/plan-status'],
    queryFn: async () => {
      const res = await fetch('/api/knotvite/plan-status', { credentials: 'include' });
      if (!res.ok) return { 
        plan: 'free', 
        limits: { maxForms: 1, maxGuestsPerForm: 100, maxCustomFields: 5, canExportExcel: false, canBulkImport: false, canRemoveBranding: false, canUseWhatsApp: false }, 
        usage: { formsCount: 0, totalGuests: 0 } 
      };
      return res.json();
    },
  });

  const { data: templates = [] } = useQuery<RsvpFormTemplate[]>({
    queryKey: ['/api/rsvp/templates'],
    queryFn: async () => {
      const res = await fetch('/api/rsvp/templates', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const isPro = planStatus?.plan === 'pro';
  const publishedForms = templates.filter(t => t.status === 'published').length;
  const draftForms = templates.filter(t => t.status === 'draft').length;

  const formUsagePercent = useMemo(() => {
    if (!planStatus || isPro) return 0;
    return Math.min((planStatus.usage.formsCount / planStatus.limits.maxForms) * 100, 100);
  }, [planStatus, isPro]);

  const guestUsagePercent = useMemo(() => {
    if (!planStatus || isPro) return 0;
    return Math.min((planStatus.usage.totalGuests / planStatus.limits.maxGuestsPerForm) * 100, 100);
  }, [planStatus, isPro]);

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="dashboard-title">KnotVite Dashboard</h1>
          <p className="text-muted-foreground text-sm">Your RSVP management overview</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isPro ? "default" : "secondary"} className="text-sm">
            {isPro ? (
              <><Crown className="h-3 w-3 mr-1" /> Pro Plan</>
            ) : (
              "Free Plan"
            )}
          </Badge>
          {!isPro && (
            <Button size="sm" onClick={() => navigate('/billing')}>
              <ArrowUpRight className="h-4 w-4 mr-1" />
              Upgrade
            </Button>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card data-testid="stat-forms">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <div className="text-2xl font-bold">{templates.length}</div>
            </div>
            <p className="text-xs text-muted-foreground">Total Forms</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-published">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div className="text-2xl font-bold text-green-600">{publishedForms}</div>
            </div>
            <p className="text-xs text-muted-foreground">Published</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-draft">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-yellow-600" />
              <div className="text-2xl font-bold text-yellow-600">{draftForms}</div>
            </div>
            <p className="text-xs text-muted-foreground">Drafts</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-guests">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              <div className="text-2xl font-bold text-blue-600">{planStatus?.usage.totalGuests || 0}</div>
            </div>
            <p className="text-xs text-muted-foreground">Total Guests</p>
          </CardContent>
        </Card>
      </div>

      {/* Plan Usage (Free users only) */}
      {!isPro && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Plan Usage</CardTitle>
            <CardDescription>Your current usage against free plan limits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Forms ({planStatus?.usage.formsCount || 0} / {planStatus?.limits.maxForms || 1})</span>
                <span>{Math.round(formUsagePercent)}%</span>
              </div>
              <Progress value={formUsagePercent} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Guests ({planStatus?.usage.totalGuests || 0} / {planStatus?.limits.maxGuestsPerForm || 100})</span>
                <span>{Math.round(guestUsagePercent)}%</span>
              </div>
              <Progress value={guestUsagePercent} className="h-2" />
            </div>
            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground mb-3">Upgrade to Pro to unlock:</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Unlimited Forms
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Unlimited Guests
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Excel Export
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Bulk Import
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  WhatsApp Invites
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Remove Branding
                </div>
              </div>
              <Button className="w-full mt-4" onClick={() => navigate('/billing')}>
                <Crown className="h-4 w-4 mr-2" />
                Upgrade to Pro
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Forms */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Recent Forms</CardTitle>
            <CardDescription>Your latest RSVP forms</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/knotvite/forms')}>
            View All
          </Button>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No forms created yet</p>
              <Button className="mt-4" onClick={() => navigate('/knotvite/forms')}>
                Create Your First Form
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {templates.slice(0, 5).map((template) => (
                <div 
                  key={template.id} 
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => navigate('/knotvite/forms')}
                >
                  <div>
                    <p className="font-medium">{template.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Created {format(new Date(template.createdAt), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <Badge variant={template.status === 'published' ? "default" : "secondary"}>
                    {template.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Button variant="outline" className="h-auto py-4 flex-col" onClick={() => navigate('/knotvite/forms')}>
              <FileText className="h-6 w-6 mb-2" />
              <span>Create Form</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col" onClick={() => navigate('/knotvite/submissions')}>
              <Users className="h-6 w-6 mb-2" />
              <span>View Submissions</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col" onClick={() => navigate('/event-calendar')}>
              <Calendar className="h-6 w-6 mb-2" />
              <span>Events</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col" onClick={() => navigate('/billing')}>
              <TrendingUp className="h-6 w-6 mb-2" />
              <span>Billing</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/auth-context";
import Layout from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import Home from "@/pages/home";
import Login from "@/pages/login";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import Signup from "@/pages/signup";
import Dashboard from "@/pages/dashboard";
import EventCalendar from "@/pages/event-calendar";
import TeamCalendar from "@/pages/team-calendar";
import EventDatabase from "@/pages/event-database";
import EventMilestones from "@/pages/event-milestones";
import Daybook from "@/pages/daybook";
import OakBook from "@/pages/oak-book";
import HR from "@/pages/hr";
import Admin from "@/pages/admin";
import OakSales from "@/pages/oak-sales";
import OakInventory from "@/pages/oak-inventory";
import ExecutionPlan from "@/pages/execution-plan";
import CustomerPortal from "@/pages/customer-portal";
import PrintDocument from "@/pages/print-document";
import EmployeePortal from "@/pages/employee-portal";
import Oaksy from "@/pages/oaksy";
import OakCreative from "@/pages/oak-creative";
import OakRSVP from "@/pages/oak-rsvp";
import MonthlyPlan from "@/pages/monthly-plan";
import WhatsappInbox from "@/pages/whatsapp-inbox";
import ManagementMIS from "@/pages/management-mis";
import DownloadPage from "@/pages/download";
import Billing from "@/pages/billing";
import NotFound from "@/pages/not-found";
import PrivacyPolicy from "@/pages/privacy-policy";
import Terms from "@/pages/terms";
import RefundPolicy from "@/pages/refund-policy";
import Contact from "@/pages/contact";
import Pricing from "@/pages/pricing";
import DemoPage from "@/pages/demo";
import DemoConfirmation from "@/pages/demo-confirmation";
import ContactEnterprise from "@/pages/contact-enterprise";
import KnotVitePlanPDF from "@/pages/knotvite-plan-pdf";
import KnotViteForms from "@/pages/knotvite-forms";
import KnotViteSubmissions from "@/pages/knotvite-submissions";
import KnotViteDashboard from "@/pages/knotvite-dashboard";
import KnotViteLanding from "@/pages/knotvite-landing";
import KnotViteSignup from "@/pages/knotvite-signup";
import KnotViteBilling from "@/pages/knotvite-billing";
import PublicRsvpForm from "@/pages/public-rsvp";
import PortfolioAdmin from "@/pages/portfolio-admin";
import PortalAdmin from "@/pages/portal-admin";
import PortfolioPage from "@/pages/portfolio-page";
import ClientPortal from "@/pages/client-portal";
import PortalLanding from "@/pages/portal-landing";
import MyPortal from "@/pages/my-portal";
import Attendance from "@/pages/attendance";
import AttendanceAdmin from "@/pages/attendance-admin";
import OakIncentives from "@/pages/oak-incentives";
import OaksyHelp from "@/pages/oaksy-help";
import EventRsvp from "@/pages/event-rsvp";
import RsvpLanding from "@/pages/rsvp-landing";
import RsvpResponse from "@/pages/rsvp-response";
import RsvpWeddingPage from "@/pages/rsvp-wedding-page";
import RsvpFlowPdf from "@/pages/rsvp-flow-pdf";
import RsvpServicePdf from "@/pages/rsvp-service-pdf";
import { AIChatbot } from "@/components/ai-chatbot";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getRouteToPageMapping, getRequiredPlanForPage, PLAN_DISPLAY_NAMES, type PlanType } from "@shared/plan-features";
import { Button } from "@/components/ui/button";
import { Lock, ArrowUpRight } from "lucide-react";

interface BillingStatus {
  subscription: { status: string } | null;
  isActive: boolean;
  isTrial?: boolean;
  isTrialExpired?: boolean;
  trialDaysRemaining?: number | null;
  currentPlan?: string;
  razorpayConfigured: boolean;
}

const ROUTE_PAGE_MAP = getRouteToPageMapping();

function PlanRestrictedPage({ requiredPlan }: { requiredPlan: string }) {
  const [, setLocation] = useLocation();
  const planLabel = PLAN_DISPLAY_NAMES[requiredPlan as PlanType] || requiredPlan;
  return (
    <div className="flex items-center justify-center min-h-[60vh]" data-testid="plan-restricted-page">
      <div className="text-center max-w-md mx-auto p-8">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="h-8 w-8 text-amber-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Feature Not Available</h2>
        <p className="text-gray-600 mb-6">
          This feature requires the <strong>{planLabel}</strong> plan or above. Upgrade your plan to unlock this and more.
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => setLocation("/dashboard")} data-testid="button-go-dashboard">
            Go to Dashboard
          </Button>
          <Button className="bg-[#2FA4BC] hover:bg-[#2590a6]" onClick={() => setLocation("/billing?upgrade=true")} data-testid="button-upgrade-plan">
            Upgrade Plan <ArrowUpRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function PrivateRoute({ component: Component, path, skipSubscriptionCheck = false }: { component: any; path: string; skipSubscriptionCheck?: boolean }) {
  const { user, allowedPages, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  const { data: billingStatus, isLoading: billingLoading } = useQuery<BillingStatus>({
    queryKey: ["/api/billing/status"],
    enabled: !!user && !skipSubscriptionCheck,
  });

  const isKnotViteRoute = path.startsWith("/knotvite");

  useEffect(() => {
    if (!isLoading && !user) {
      if (isKnotViteRoute) {
        setLocation("/knotvite/signup?mode=signin");
      } else {
        setLocation("/login");
      }
    }
  }, [user, isLoading, setLocation, isKnotViteRoute]);

  useEffect(() => {
    if (!skipSubscriptionCheck && !billingLoading && billingStatus) {
      if (!billingStatus.isActive && billingStatus.isTrialExpired) {
        if (location !== "/billing") {
          setLocation("/billing");
        }
      }
    }
  }, [billingStatus, billingLoading, skipSubscriptionCheck, setLocation, location]);

  if (isLoading || !user) return null;
  if (!skipSubscriptionCheck && billingLoading) return null;

  if (isKnotViteRoute) {
    return <Component />;
  }

  if (path === "/billing") {
    const hasUpgradeParam = window.location.search.includes('upgrade=true');
    if (billingStatus?.isTrial && !billingStatus?.isTrialExpired && user.role !== 'superadmin' && !hasUpgradeParam) {
      setLocation("/dashboard");
      return null;
    }
  }

  const pageId = ROUTE_PAGE_MAP[path];
  if (pageId && allowedPages.length > 0 && !allowedPages.includes(pageId) && user.role !== 'superadmin') {
    const requiredPlan = getRequiredPlanForPage(pageId);
    if (requiredPlan) {
      return <PlanRestrictedPage requiredPlan={requiredPlan} />;
    }
    setLocation("/dashboard");
    return null;
  }

  return <Component />;
}

function AppRoutes() {
  return (
    <Layout>
      <Switch>
        <Route path="/dashboard">
          <PrivateRoute component={Dashboard} path="/dashboard" />
        </Route>
        <Route path="/events">
          <PrivateRoute component={EventCalendar} path="/events" />
        </Route>
        <Route path="/monthly-plan">
          <PrivateRoute component={MonthlyPlan} path="/monthly-plan" />
        </Route>
        <Route path="/team">
           <PrivateRoute component={TeamCalendar} path="/team" />
        </Route>
        <Route path="/database">
           <PrivateRoute component={EventDatabase} path="/database" />
        </Route>
        <Route path="/milestones">
           <PrivateRoute component={EventMilestones} path="/milestones" />
        </Route>
        <Route path="/daybook">
           <PrivateRoute component={Daybook} path="/daybook" />
        </Route>
        <Route path="/oak-book">
           <PrivateRoute component={OakBook} path="/oak-book" />
        </Route>
        <Route path="/hr">
           <PrivateRoute component={HR} path="/hr" />
        </Route>
        <Route path="/admin">
           <PrivateRoute component={Admin} path="/admin" />
        </Route>
        <Route path="/oak-sales">
           <PrivateRoute component={OakSales} path="/oak-sales" />
        </Route>
        <Route path="/oak-inventory">
           <PrivateRoute component={OakInventory} path="/oak-inventory" />
        </Route>
        <Route path="/execution-plan">
           <PrivateRoute component={ExecutionPlan} path="/execution-plan" />
        </Route>
        <Route path="/employee-portal">
           <PrivateRoute component={EmployeePortal} path="/employee-portal" />
        </Route>
        <Route path="/oaksy">
           <PrivateRoute component={Oaksy} path="/oaksy" />
        </Route>
        <Route path="/oak-creative">
           <PrivateRoute component={OakCreative} path="/oak-creative" />
        </Route>
        <Route path="/whatsapp-inbox">
           <PrivateRoute component={WhatsappInbox} path="/whatsapp-inbox" />
        </Route>
        <Route path="/oak-rsvp">
           <PrivateRoute component={OakRSVP} path="/oak-rsvp" />
        </Route>
        <Route path="/management-mis">
           <PrivateRoute component={ManagementMIS} path="/management-mis" />
        </Route>
        <Route path="/billing">
          <PrivateRoute component={Billing} path="/billing" skipSubscriptionCheck={true} />
        </Route>
        <Route path="/portfolio-admin">
          <PrivateRoute component={PortfolioAdmin} path="/portfolio-admin" />
        </Route>
        <Route path="/portal-admin">
          <PrivateRoute component={PortalAdmin} path="/portal-admin" />
        </Route>
        <Route path="/attendance">
          <PrivateRoute component={Attendance} path="/attendance" />
        </Route>
        <Route path="/attendance-admin">
          <PrivateRoute component={AttendanceAdmin} path="/attendance-admin" />
        </Route>
        <Route path="/oak-incentives">
          <PrivateRoute component={OakIncentives} path="/oak-incentives" />
        </Route>
        <Route path="/oaksy-help">
          <PrivateRoute component={OaksyHelp} path="/oaksy-help" />
        </Route>
        <Route path="/event-rsvp/:eventId">
          <PrivateRoute component={EventRsvp} path="/event-rsvp/:eventId" />
        </Route>
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function PublicPages() {
  const [location] = useLocation();
  const showChatbot = ['/', '/pricing'].includes(location);

  return (
    <>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/login" component={Login} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/signup" component={Signup} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/demo" component={DemoPage} />
        <Route path="/demo-confirmation" component={DemoConfirmation} />
        <Route path="/contact-enterprise" component={ContactEnterprise} />
        <Route path="/privacy-policy" component={PrivacyPolicy} />
        <Route path="/terms" component={Terms} />
        <Route path="/refund-policy" component={RefundPolicy} />
        <Route path="/contact" component={Contact} />
        <Route path="/knotvite/signup" component={KnotViteSignup} />
        <Route path="/knotvite/dashboard">
          <PrivateRoute component={KnotViteDashboard} path="/knotvite/dashboard" skipSubscriptionCheck={true} />
        </Route>
        <Route path="/knotvite/forms">
          <PrivateRoute component={KnotViteForms} path="/knotvite/forms" skipSubscriptionCheck={true} />
        </Route>
        <Route path="/knotvite/submissions">
          <PrivateRoute component={KnotViteSubmissions} path="/knotvite/submissions" skipSubscriptionCheck={true} />
        </Route>
        <Route path="/knotvite/billing">
          <PrivateRoute component={KnotViteBilling} path="/knotvite/billing" skipSubscriptionCheck={true} />
        </Route>
        <Route path="/knotvite" component={KnotViteLanding} />
        <Route path="/rsvp/:slug" component={PublicRsvpForm} />
        <Route path="/rsvp-landing/:code" component={RsvpLanding} />
        <Route path="/rsvp-response/:code" component={RsvpResponse} />
        <Route path="/rsvp-wedding/:code" component={RsvpWeddingPage} />
        <Route path="/portfolio" component={PortfolioPage} />
        <Route path="/client-portal" component={PortalLanding} />
        <Route>
          <AppRoutes />
        </Route>
      </Switch>
      {showChatbot && <AIChatbot />}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Switch>
            <Route path="/portal/:token">
              <CustomerPortal />
            </Route>
            <Route path="/my-portal/:token">
              <MyPortal />
            </Route>
            <Route path="/print/:type/:id">
              <PrintDocument />
            </Route>
            <Route path="/download">
              <DownloadPage />
            </Route>
            <Route path="/docs/knotvite-plan">
              <KnotVitePlanPDF />
            </Route>
            <Route path="/docs/rsvp-flow">
              <RsvpFlowPdf />
            </Route>
            <Route path="/docs/rsvp-service">
              <RsvpServicePdf />
            </Route>
            <Route>
              <PublicPages />
            </Route>
          </Switch>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

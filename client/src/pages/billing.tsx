import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, CreditCard, CheckCircle, Crown, Zap, Rocket, Clock, ArrowRight, Shield, Star, Users, BarChart3, MessageSquare, Building2, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth-context";
import { getAuthHeaders } from "@/lib/queryClient";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface BillingStatus {
  subscription: {
    id: string;
    planName: string;
    status: string;
    startDate: string | null;
    endDate: string | null;
    razorpayPaymentId: string | null;
  } | null;
  isActive: boolean;
  isTrial: boolean;
  trialDaysRemaining: number | null;
  isTrialExpired: boolean;
  currentPlan: string;
  teamLimit: number;
  teamCount: number;
  razorpayConfigured: boolean;
  razorpayKeyId: string;
  planCatalog: Record<string, { name: string; amount: number }>;
}

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    description: "Perfect for solo wedding planners getting started",
    monthlyPrice: 499,
    annualPrice: 4999,
    monthlyPlanKey: "starter_monthly",
    annualPlanKey: "starter_annual",
    teamLimit: "1 user",
    icon: Zap,
    color: "blue",
    features: [
      "Dashboard & Analytics",
      "Sales CRM (Leads, Pipeline)",
      "Event Hub (Calendar, Timeline)",
      "Finance (Estimates, Invoices)",
      "Client Portal",
      "AI Assistant (Basic)",
    ],
    notIncluded: [
      "Sales Reports",
      "Payment Tracking",
      "Operations & Inventory",
      "KnotVite RSVP",
      "HR & Employee Portal",
      "WhatsApp Integration",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    description: "For growing teams that need more power and features",
    monthlyPrice: 1499,
    annualPrice: 14999,
    monthlyPlanKey: "growth_monthly",
    annualPlanKey: "growth_annual",
    teamLimit: "Up to 5 users",
    icon: Rocket,
    color: "primary",
    popular: true,
    features: [
      "Everything in Starter, plus:",
      "Sales Reports & Analytics",
      "Payment Tracking",
      "Operations & Inventory",
      "KnotVite RSVP System",
      "Team Calendar",
      "Creative Studio",
      "Full AI Assistant",
    ],
    notIncluded: [
      "HR Management",
      "Employee Portal",
      "Finance Masters",
      "Day Book",
      "WhatsApp Integration",
      "Management MIS",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "For large teams with custom needs and dedicated support",
    monthlyPrice: 0,
    annualPrice: 0,
    monthlyPlanKey: "enterprise",
    annualPlanKey: "enterprise",
    teamLimit: "Unlimited users",
    icon: Building2,
    color: "purple",
    features: [
      "Everything in Growth, plus:",
      "HR Management",
      "Employee Portal",
      "Finance Masters",
      "Day Book",
      "WhatsApp Integration",
      "Management MIS Reports",
      "Dedicated Support",
      "Custom Integrations",
    ],
    notIncluded: [],
  },
];

export default function BillingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  const { data: billing, isLoading } = useQuery<BillingStatus>({
    queryKey: ["/api/billing/status"],
    queryFn: async () => {
      const res = await fetch("/api/billing/status", { credentials: "include", headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to load billing");
      return res.json();
    },
  });

  const handleSubscribe = async (planKey: string) => {
    if (!billing?.razorpayConfigured) {
      toast({
        title: "Payment Not Available",
        description: "Payment system is being configured. Please contact support.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch("/api/billing/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ planName: planKey }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create order");
      }

      const order = await res.json();

      const options = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "AtBott",
        description: `${billingCycle === "yearly" ? "Annual" : "Monthly"} Subscription`,
        order_id: order.orderId,
        handler: async function (response: any) {
          try {
            const verifyRes = await fetch("/api/billing/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json", ...getAuthHeaders() },
              credentials: "include",
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            if (!verifyRes.ok) throw new Error("Payment verification failed");

            queryClient.invalidateQueries({ queryKey: ["/api/billing/status"] });
            queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
            toast({
              title: "Payment Successful!",
              description: "Your subscription is now active. Enjoy all the features!",
            });
          } catch (err) {
            toast({
              title: "Verification Failed",
              description: "Payment was received but verification failed. Please contact support.",
              variant: "destructive",
            });
          }
        },
        prefill: {
          name: user?.name || "",
          email: user?.email || "",
        },
        theme: {
          color: "#2FA4BC",
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.on("payment.failed", function () {
        toast({
          title: "Payment Failed",
          description: "Your payment could not be processed. Please try again.",
          variant: "destructive",
        });
      });
      razorpay.open();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentPlan = billing?.currentPlan || "starter";
  const isTrial = billing?.isTrial || false;
  const trialDays = billing?.trialDaysRemaining ?? 0;
  const isTrialExpired = billing?.isTrialExpired || false;

  return (
    <div className="min-h-screen bg-gray-50/50" data-testid="billing-page">
      <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10">

        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1" data-testid="text-billing-title">
            Subscription & Billing
          </h1>
          <p className="text-gray-500 text-sm sm:text-base">
            Manage your plan, view usage, and upgrade anytime.
          </p>
        </div>

        <Card className="mb-8 border-l-4 border-l-primary" data-testid="current-plan-card">
          <CardContent className="py-5 px-5 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  {isTrial ? (
                    <Clock className="h-6 w-6 text-primary" />
                  ) : (
                    <Crown className="h-6 w-6 text-primary" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-lg text-gray-900">
                      {isTrial ? "Free Trial" : `${currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} Plan`}
                    </h3>
                    {isTrial && !isTrialExpired && (
                      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                        {trialDays} day{trialDays !== 1 ? "s" : ""} remaining
                      </Badge>
                    )}
                    {isTrialExpired && (
                      <Badge variant="destructive">Expired</Badge>
                    )}
                    {!isTrial && billing?.subscription?.status === "active" && (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {isTrial
                      ? `You're on a 14-day Growth Trial. Upgrade to keep all features after the trial ends.`
                      : billing?.subscription?.endDate
                      ? `Renews on ${new Date(billing.subscription.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`
                      : "Your subscription is active."}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      Team: {billing?.teamCount || 0}/{billing?.teamLimit === -1 ? "Unlimited" : billing?.teamLimit || 1}
                    </span>
                    {billing?.subscription?.razorpayPaymentId && (
                      <span className="flex items-center gap-1">
                        <CreditCard className="h-3.5 w-3.5" />
                        Payment ID: {billing.subscription.razorpayPaymentId}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {isTrial && (
                <div className="sm:text-right">
                  <div className="w-full sm:w-48 bg-gray-200 rounded-full h-2 mb-1.5">
                    <div
                      className={`h-2 rounded-full transition-all ${trialDays <= 3 ? "bg-red-500" : trialDays <= 7 ? "bg-amber-500" : "bg-primary"}`}
                      style={{ width: `${Math.min(100, ((14 - trialDays) / 14) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500">{14 - trialDays} of 14 days used</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-center gap-3 mb-8">
          <Label
            htmlFor="billing-toggle"
            className={`text-sm cursor-pointer ${billingCycle === "monthly" ? "font-semibold text-gray-900" : "text-gray-500"}`}
          >
            Monthly
          </Label>
          <Switch
            id="billing-toggle"
            checked={billingCycle === "yearly"}
            onCheckedChange={(checked) => setBillingCycle(checked ? "yearly" : "monthly")}
            data-testid="billing-cycle-toggle"
          />
          <Label
            htmlFor="billing-toggle"
            className={`text-sm cursor-pointer flex items-center gap-1.5 ${billingCycle === "yearly" ? "font-semibold text-gray-900" : "text-gray-500"}`}
          >
            Yearly
            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-[10px] px-1.5 py-0">Save 17%</Badge>
          </Label>
        </div>

        <div className="grid md:grid-cols-3 gap-5 mb-10">
          {PLANS.map((plan) => {
            const isCurrentPlan = currentPlan === plan.id && !isTrial;
            const isTrialPlan = isTrial && plan.id === "growth";
            const isEnterprise = plan.id === "enterprise";
            const Icon = plan.icon;
            const price = billingCycle === "yearly" ? plan.annualPrice : plan.monthlyPrice;
            const planKey = billingCycle === "yearly" ? plan.annualPlanKey : plan.monthlyPlanKey;

            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col ${
                  plan.popular ? "border-primary border-2 shadow-lg" : "border"
                } ${isCurrentPlan ? "ring-2 ring-primary/30" : ""}`}
                data-testid={`plan-card-${plan.id}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-white px-3 py-0.5 text-xs">
                      <Star className="h-3 w-3 mr-1" /> Most Popular
                    </Badge>
                  </div>
                )}

                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      plan.id === "starter" ? "bg-blue-100" : plan.id === "growth" ? "bg-primary/10" : "bg-purple-100"
                    }`}>
                      <Icon className={`h-5 w-5 ${
                        plan.id === "starter" ? "text-blue-600" : plan.id === "growth" ? "text-primary" : "text-purple-600"
                      }`} />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                    </div>
                  </div>
                  <CardDescription className="text-xs">{plan.description}</CardDescription>

                  <div className="mt-3">
                    {isEnterprise ? (
                      <div>
                        <span className="text-3xl font-bold text-gray-900">Custom</span>
                        <p className="text-xs text-gray-500 mt-1">Contact us for pricing</p>
                      </div>
                    ) : (
                      <div>
                        <span className="text-3xl font-bold text-gray-900">
                          ₹{price.toLocaleString("en-IN")}
                        </span>
                        <span className="text-gray-500 text-sm">
                          /{billingCycle === "yearly" ? "year" : "month"}
                        </span>
                        {billingCycle === "yearly" && (
                          <p className="text-xs text-green-600 mt-0.5">
                            ₹{Math.round(price / 12).toLocaleString("en-IN")}/month effective
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
                    <Users className="h-3.5 w-3.5" />
                    {plan.teamLimit}
                  </div>
                </CardHeader>

                <CardContent className="flex-1 pb-4">
                  <div className="space-y-2.5">
                    {plan.features.map((feature, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                        <span className={i === 0 && plan.id !== "starter" ? "font-medium text-gray-900" : "text-gray-700"}>
                          {feature}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>

                <CardFooter className="pt-0">
                  {isCurrentPlan ? (
                    <Button variant="outline" className="w-full" disabled data-testid={`btn-current-${plan.id}`}>
                      <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                      Current Plan
                    </Button>
                  ) : isTrialPlan ? (
                    <Button
                      className="w-full bg-primary hover:bg-primary/90"
                      onClick={() => handleSubscribe(planKey)}
                      disabled={isProcessing}
                      data-testid={`btn-subscribe-${plan.id}`}
                    >
                      {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Rocket className="h-4 w-4 mr-2" />}
                      Upgrade Now
                    </Button>
                  ) : isEnterprise ? (
                    <a href="mailto:sales@atbott.com" className="w-full">
                      <Button variant="outline" className="w-full" data-testid="btn-contact-enterprise">
                        <Mail className="h-4 w-4 mr-2" />
                        Contact Sales
                      </Button>
                    </a>
                  ) : currentPlan === plan.id ? (
                    <Button variant="outline" className="w-full" disabled>
                      <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                      Current Plan
                    </Button>
                  ) : (
                    <Button
                      className={`w-full ${plan.popular ? "bg-primary hover:bg-primary/90" : ""}`}
                      variant={plan.popular ? "default" : "outline"}
                      onClick={() => handleSubscribe(planKey)}
                      disabled={isProcessing}
                      data-testid={`btn-subscribe-${plan.id}`}
                    >
                      {isProcessing ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <ArrowRight className="h-4 w-4 mr-2" />
                      )}
                      {currentPlan === "starter" && plan.id === "growth" ? "Upgrade" : "Subscribe"}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>

        <Card className="border-gray-200" data-testid="plan-comparison">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-gray-500" />
              Plan Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 pr-4 font-medium text-gray-500">Feature</th>
                    <th className="text-center py-3 px-3 font-medium text-gray-700">Starter</th>
                    <th className="text-center py-3 px-3 font-medium text-primary">Growth</th>
                    <th className="text-center py-3 px-3 font-medium text-purple-700">Enterprise</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[
                    { feature: "Team Members", starter: "1", growth: "5", enterprise: "Unlimited" },
                    { feature: "Dashboard & Events", starter: true, growth: true, enterprise: true },
                    { feature: "Sales CRM", starter: true, growth: true, enterprise: true },
                    { feature: "Estimates & Invoices", starter: true, growth: true, enterprise: true },
                    { feature: "Client Portal", starter: true, growth: true, enterprise: true },
                    { feature: "Sales Reports", starter: false, growth: true, enterprise: true },
                    { feature: "Payment Tracking", starter: false, growth: true, enterprise: true },
                    { feature: "Operations & Inventory", starter: false, growth: true, enterprise: true },
                    { feature: "KnotVite RSVP", starter: false, growth: true, enterprise: true },
                    { feature: "Team Calendar", starter: false, growth: true, enterprise: true },
                    { feature: "HR Management", starter: false, growth: false, enterprise: true },
                    { feature: "Employee Portal", starter: false, growth: false, enterprise: true },
                    { feature: "Day Book", starter: false, growth: false, enterprise: true },
                    { feature: "WhatsApp Integration", starter: false, growth: false, enterprise: true },
                    { feature: "Management MIS", starter: false, growth: false, enterprise: true },
                    { feature: "Dedicated Support", starter: false, growth: false, enterprise: true },
                  ].map((row) => (
                    <tr key={row.feature}>
                      <td className="py-2.5 pr-4 text-gray-700">{row.feature}</td>
                      {(["starter", "growth", "enterprise"] as const).map((plan) => (
                        <td key={plan} className="text-center py-2.5 px-3">
                          {typeof row[plan] === "string" ? (
                            <span className="font-medium text-gray-900">{row[plan]}</span>
                          ) : row[plan] ? (
                            <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            Need help choosing?{" "}
            <a href="mailto:sales@atbott.com" className="text-primary hover:underline">
              Contact our team
            </a>{" "}
            for a personalized recommendation.
          </p>
          <p className="mt-2">
            All plans include SSL, daily backups, and 99.9% uptime guarantee.
          </p>
        </div>
      </div>
    </div>
  );
}

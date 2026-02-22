import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  CreditCard,
  Download,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Crown,
  Shield,
  Zap,
  Loader2,
} from "lucide-react";

declare global {
  interface Window {
    Razorpay: any;
  }
}

const PLAN_DETAILS: Record<string, { name: string; price: string; amount: number; features: string[] }> = {
  basic: {
    name: "Basic",
    price: "₹4,999",
    amount: 4999,
    features: ["1 Event", "200 Guests", "Email Invitations", "RSVP Tracking", "Basic Analytics"],
  },
  pro: {
    name: "Pro",
    price: "₹14,999",
    amount: 14999,
    features: ["5 Events", "400 Guests/Event", "WhatsApp Integration", "Custom Templates", "Advanced Analytics", "Priority Support"],
  },
  premium: {
    name: "Premium",
    price: "₹24,999",
    amount: 24999,
    features: ["Unlimited Events", "Unlimited Guests", "QR Check-in", "Wedding Page Builder", "Custom Domain", "WhatsApp Automation", "Dedicated Support"],
  },
};

function getAuthHeaders() {
  const token = localStorage.getItem("knotvite_token") || localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function KnotViteBilling() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);

  const { data: billing, isLoading } = useQuery({
    queryKey: ["/api/knotvite/billing/status"],
    queryFn: async () => {
      const res = await fetch("/api/knotvite/billing/status", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch billing status");
      return res.json();
    },
  });

  const createOrderMutation = useMutation({
    mutationFn: async (plan: string) => {
      const res = await fetch("/api/knotvite/billing/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create order");
      }
      return res.json();
    },
    onSuccess: (data) => {
      openRazorpay(data);
    },
    onError: (error: Error) => {
      setProcessingPlan(null);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const verifyPaymentMutation = useMutation({
    mutationFn: async (paymentData: any) => {
      const res = await fetch("/api/knotvite/billing/verify-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(paymentData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Payment verification failed");
      }
      return res.json();
    },
    onSuccess: () => {
      setProcessingPlan(null);
      queryClient.invalidateQueries({ queryKey: ["/api/knotvite/billing/status"] });
      toast({ title: "Payment Successful!", description: "Your plan has been upgraded. GST invoice sent to your email." });
    },
    onError: (error: Error) => {
      setProcessingPlan(null);
      toast({ title: "Payment Verification Failed", description: error.message, variant: "destructive" });
    },
  });

  function openRazorpay(orderData: any) {
    if (!window.Razorpay) {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => initiatePayment(orderData);
      script.onerror = () => {
        setProcessingPlan(null);
        toast({ title: "Error", description: "Failed to load payment gateway", variant: "destructive" });
      };
      document.body.appendChild(script);
    } else {
      initiatePayment(orderData);
    }
  }

  function initiatePayment(orderData: any) {
    const options = {
      key: orderData.keyId,
      amount: orderData.amount,
      currency: orderData.currency,
      name: "KnotVite",
      description: `${orderData.planName} Plan`,
      order_id: orderData.orderId,
      handler: (response: any) => {
        verifyPaymentMutation.mutate({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        });
      },
      prefill: {},
      theme: { color: "#2FA4BC" },
      modal: {
        ondismiss: () => setProcessingPlan(null),
      },
    };
    const rzp = new window.Razorpay(options);
    rzp.open();
  }

  function handleUpgrade(plan: string) {
    setProcessingPlan(plan);
    createOrderMutation.mutate(plan);
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "active":
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle2 className="w-3 h-3 mr-1" /> Active</Badge>;
      case "trial":
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200"><Clock className="w-3 h-3 mr-1" /> Trial</Badge>;
      case "pending_payment":
        return <Badge className="bg-orange-100 text-orange-700 border-orange-200"><AlertTriangle className="w-3 h-3 mr-1" /> Pending Payment</Badge>;
      case "expired":
        return <Badge className="bg-red-100 text-red-700 border-red-200"><AlertTriangle className="w-3 h-3 mr-1" /> Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  function getPlanIcon(plan: string) {
    switch (plan) {
      case "premium": return <Crown className="w-5 h-5 text-amber-500" />;
      case "pro": return <Zap className="w-5 h-5 text-[#2FA4BC]" />;
      default: return <Shield className="w-5 h-5 text-gray-500" />;
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#2FA4BC]" />
      </div>
    );
  }

  const currentPlan = billing?.plan || "basic";
  const planInfo = PLAN_DETAILS[currentPlan];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-[#2FA4BC] to-[#268fa5] text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex items-center gap-3 mb-4">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={() => navigate("/knotvite/dashboard")}
              data-testid="button-back-dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-billing-title">Billing & Subscription</h1>
              <p className="text-white/80 text-sm">Manage your KnotVite plan and invoices</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 -mt-4 pb-20 space-y-6">
        <Card className="border-0 shadow-md" data-testid="card-current-plan">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                {getPlanIcon(currentPlan)}
                <div>
                  <CardTitle className="text-lg" data-testid="text-current-plan">{planInfo?.name || currentPlan} Plan</CardTitle>
                  <CardDescription>
                    {billing?.isTrial
                      ? `Trial - ${billing.trialDaysRemaining} days remaining`
                      : billing?.isActive
                        ? "Active subscription"
                        : "Subscription inactive"}
                  </CardDescription>
                </div>
              </div>
              {getStatusBadge(billing?.status || "none")}
            </div>
          </CardHeader>
          {billing?.isTrial && billing.trialDaysRemaining !== null && (
            <CardContent>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-amber-800">Trial Period</p>
                    <p className="text-sm text-amber-700 mt-1">
                      Your free trial ends in <strong>{billing.trialDaysRemaining} day{billing.trialDaysRemaining !== 1 ? "s" : ""}</strong>.
                      Upgrade to keep all your data and unlock premium features.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          )}
          {billing?.isTrialExpired && (
            <CardContent>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-red-800">Trial Expired</p>
                    <p className="text-sm text-red-700 mt-1">
                      Your trial has ended. Please upgrade to continue using KnotVite.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {(billing?.status !== "active" || currentPlan === "basic") && (
          <div>
            <h2 className="text-lg font-semibold mb-4" data-testid="text-upgrade-title">
              {billing?.status === "active" ? "Upgrade Your Plan" : "Choose a Plan"}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(PLAN_DETAILS).map(([key, plan]) => {
                const isCurrentPlan = key === currentPlan && billing?.isActive;
                const isDowngrade = ["basic"].includes(key) && ["pro", "premium"].includes(currentPlan);
                const isPremiumDowngrade = key === "pro" && currentPlan === "premium";
                const disabled = isCurrentPlan || isDowngrade || isPremiumDowngrade;

                return (
                  <Card
                    key={key}
                    className={`relative ${key === "pro" ? "border-[#2FA4BC] border-2 shadow-lg" : "border"} ${isCurrentPlan ? "bg-gray-50" : ""}`}
                    data-testid={`card-plan-${key}`}
                  >
                    {key === "pro" && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-[#2FA4BC] text-white px-3">Most Popular</Badge>
                      </div>
                    )}
                    <CardHeader className="text-center pt-6">
                      {getPlanIcon(key)}
                      <CardTitle className="mt-2">{plan.name}</CardTitle>
                      <div className="mt-2">
                        <span className="text-3xl font-bold">{plan.price}</span>
                        <span className="text-gray-500 text-sm ml-1">+ 18% GST</span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2 mb-6">
                        {plan.features.map((feature, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-[#2FA4BC] flex-shrink-0" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                      <Button
                        className={`w-full ${key === "pro" ? "bg-[#2FA4BC] hover:bg-[#268fa5]" : ""}`}
                        variant={key === "pro" ? "default" : "outline"}
                        disabled={disabled || processingPlan === key}
                        onClick={() => handleUpgrade(key)}
                        data-testid={`button-upgrade-${key}`}
                      >
                        {processingPlan === key ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                        ) : isCurrentPlan ? (
                          "Current Plan"
                        ) : key === "basic" && currentPlan !== "basic" ? (
                          "Included"
                        ) : (
                          <><CreditCard className="w-4 h-4 mr-2" /> Upgrade to {plan.name}</>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        <Separator />

        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" data-testid="text-invoices-title">
            <FileText className="w-5 h-5" /> Invoices
          </h2>
          {billing?.invoices && billing.invoices.length > 0 ? (
            <div className="space-y-3">
              {billing.invoices.map((inv: any) => (
                <Card key={inv.id} className="border" data-testid={`card-invoice-${inv.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#e0f4f8] flex items-center justify-center">
                          <FileText className="w-5 h-5 text-[#2FA4BC]" />
                        </div>
                        <div>
                          <p className="font-medium" data-testid={`text-invoice-number-${inv.id}`}>{inv.invoiceNumber}</p>
                          <p className="text-sm text-gray-500">{inv.planName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-semibold" data-testid={`text-invoice-amount-${inv.id}`}>
                            ₹{inv.totalAmount?.toLocaleString("en-IN")}
                          </p>
                          <p className="text-xs text-gray-500">
                            {inv.paidAt ? new Date(inv.paidAt).toLocaleDateString("en-IN") : "Pending"}
                          </p>
                        </div>
                        <Badge className="bg-emerald-100 text-emerald-700">{inv.status}</Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`/api/knotvite/invoices/${inv.id}/download`, "_blank")}
                          data-testid={`button-download-invoice-${inv.id}`}
                        >
                          <Download className="w-4 h-4 mr-1" /> Download
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border">
              <CardContent className="p-8 text-center">
                <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No invoices yet</p>
                <p className="text-sm text-gray-400 mt-1">Invoices will appear here after your first payment</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

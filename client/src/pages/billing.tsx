import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, CheckCircle, AlertCircle, Crown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  } | null;
  isActive: boolean;
  razorpayConfigured: boolean;
  razorpayKeyId: string;
}

export default function BillingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: billingStatus, isLoading } = useQuery<BillingStatus>({
    queryKey: ["/api/billing/status"],
  });

  const createOrderMutation = useMutation({
    mutationFn: async (data: { planName: string; amount: number }) => {
      const response = await fetch("/api/billing/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create order");
      return response.json();
    },
  });

  const verifyPaymentMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/billing/verify-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to verify payment");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing/status"] });
      toast({
        title: "Payment Successful!",
        description: "Your subscription is now active.",
      });
    },
  });

  const handleSubscribe = async (planName: string, amount: number) => {
    if (!billingStatus?.razorpayConfigured) {
      toast({
        title: "Payment Not Configured",
        description: "Please contact support to enable payments.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      const order = await createOrderMutation.mutateAsync({ planName, amount });

      const options = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "Wedding SaaS Platform",
        description: `${planName} Plan Subscription`,
        order_id: order.orderId,
        handler: async function (response: any) {
          await verifyPaymentMutation.mutateAsync({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            plan_name: planName,
          });
        },
        prefill: {
          email: "",
        },
        theme: {
          color: "#5B8C51",
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to initiate payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">Active</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const plans = [
    {
      name: "Basic",
      price: 999,
      features: [
        "Up to 10 events/month",
        "Basic event management",
        "Email support",
        "1 team member",
      ],
    },
    {
      name: "Pro",
      price: 2499,
      features: [
        "Unlimited events",
        "Advanced analytics",
        "Priority support",
        "5 team members",
        "WhatsApp integration",
      ],
      popular: true,
    },
    {
      name: "Enterprise",
      price: 4999,
      features: [
        "Everything in Pro",
        "Custom branding",
        "Dedicated support",
        "Unlimited team members",
        "API access",
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4" data-testid="billing-page">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Subscription Plans</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Choose the plan that best fits your wedding planning business needs.
          </p>
        </div>

        {billingStatus?.subscription && (
          <Card className="mb-8 border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Current Subscription
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-lg font-semibold capitalize">
                    {billingStatus.subscription.planName} Plan
                  </p>
                  <p className="text-sm text-gray-600">
                    {billingStatus.subscription.endDate
                      ? `Valid until ${new Date(billingStatus.subscription.endDate).toLocaleDateString()}`
                      : "No expiry date set"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(billingStatus.subscription.status)}
                  {billingStatus.isActive && (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {!billingStatus?.razorpayConfigured && (
          <Card className="mb-8 border-yellow-200 bg-yellow-50">
            <CardContent className="py-4">
              <div className="flex items-center gap-2 text-yellow-800">
                <AlertCircle className="h-5 w-5" />
                <span>Payment system is not configured. Please contact support.</span>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative ${plan.popular ? "border-primary shadow-lg" : ""}`}
              data-testid={`plan-card-${plan.name.toLowerCase()}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary flex items-center gap-1">
                    <Crown className="h-3 w-3" />
                    Most Popular
                  </Badge>
                </div>
              )}
              <CardHeader className="text-center">
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>
                  <span className="text-3xl font-bold text-gray-900">₹{plan.price}</span>
                  <span className="text-gray-600">/month</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  variant={plan.popular ? "default" : "outline"}
                  onClick={() => handleSubscribe(plan.name.toLowerCase(), plan.price)}
                  disabled={
                    isProcessing ||
                    !billingStatus?.razorpayConfigured ||
                    (billingStatus?.isActive &&
                      billingStatus?.subscription?.planName === plan.name.toLowerCase())
                  }
                  data-testid={`subscribe-${plan.name.toLowerCase()}`}
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : billingStatus?.isActive &&
                    billingStatus?.subscription?.planName === plan.name.toLowerCase() ? (
                    "Current Plan"
                  ) : (
                    "Subscribe"
                  )}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

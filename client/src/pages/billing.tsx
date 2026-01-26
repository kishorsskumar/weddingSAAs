import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, CreditCard, CheckCircle, AlertCircle, Crown, Package, Zap, Users, Calendar, DollarSign, Bot, Settings, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AiSettingsPanel } from "@/components/ai-settings";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface SaasModule {
  id: string;
  code: string;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  isCore: boolean;
  sortOrder: number;
}

interface ModuleSubscription {
  id: string;
  companyId: string;
  moduleId: string;
  moduleCode: string;
  billingCycle: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  nextBillingDate: string | null;
  module: SaasModule;
}

interface ModulesResponse {
  subscriptions: ModuleSubscription[];
  hasActiveCore: boolean;
  activatedModules: string[];
}

const MODULE_ICONS: Record<string, React.ReactNode> = {
  core: <Package className="h-6 w-6" />,
  rsvp: <Users className="h-6 w-6" />,
  crm: <Users className="h-6 w-6" />,
  vendor: <Package className="h-6 w-6" />,
  payments: <DollarSign className="h-6 w-6" />,
  automation: <Zap className="h-6 w-6" />,
  ai_assistant: <Bot className="h-6 w-6" />,
};

export default function BillingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [moduleToCancel, setModuleToCancel] = useState<string | null>(null);

  const { data: modules, isLoading: modulesLoading } = useQuery<SaasModule[]>({
    queryKey: ["/api/modules"],
  });

  const { data: subscriptionData, isLoading: subsLoading } = useQuery<ModulesResponse>({
    queryKey: ["/api/modules/subscriptions"],
  });

  const subscribeMutation = useMutation({
    mutationFn: async (data: { moduleCode: string; billingCycle: string }) => {
      const response = await fetch("/api/modules/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to subscribe");
      }
      return response.json();
    },
  });

  const verifyPaymentMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/modules/verify-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to verify payment");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/modules/subscriptions"] });
      toast({
        title: "Payment Successful!",
        description: "Your module is now active.",
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (moduleCode: string) => {
      const response = await fetch("/api/modules/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ moduleCode }),
      });
      if (!response.ok) throw new Error("Failed to cancel subscription");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/modules/subscriptions"] });
      toast({
        title: "Subscription Cancelled",
        description: "Your subscription has been cancelled.",
      });
      setCancelDialogOpen(false);
      setModuleToCancel(null);
    },
  });

  const handleSubscribe = async (module: SaasModule) => {
    if (!subscriptionData?.hasActiveCore && !module.isCore) {
      toast({
        title: "Core Platform Required",
        description: "Please subscribe to Core Platform first before adding modules.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      const result = await subscribeMutation.mutateAsync({
        moduleCode: module.code,
        billingCycle,
      });

      if (result.type === 'order') {
        const options = {
          key: result.keyId,
          amount: result.amount,
          currency: result.currency,
          name: "AtBott Wedding SaaS",
          description: `${module.name} - ${billingCycle === 'yearly' ? 'Annual' : 'Monthly'}`,
          order_id: result.orderId,
          handler: async function (response: any) {
            await verifyPaymentMutation.mutateAsync({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              moduleCode: module.code,
            });
          },
          theme: {
            color: "#2F6B3F",
          },
        };

        const razorpay = new window.Razorpay(options);
        razorpay.open();
      } else if (result.shortUrl) {
        window.location.href = result.shortUrl;
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to initiate payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelClick = (moduleCode: string) => {
    setModuleToCancel(moduleCode);
    setCancelDialogOpen(true);
  };

  const confirmCancel = () => {
    if (moduleToCancel) {
      cancelMutation.mutate(moduleToCancel);
    }
  };

  const formatPrice = (price: number) => {
    return `₹${(price / 100).toLocaleString('en-IN')}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">Active</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      case "paused":
        return <Badge className="bg-yellow-500">Paused</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const isLoading = modulesLoading || subsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const coreModule = modules?.find(m => m.isCore);
  const addonModules = modules?.filter(m => !m.isCore) || [];
  const activeSubscriptions = subscriptionData?.subscriptions.filter(s => s.status === 'active') || [];

  const hasAiSubscription = subscriptionData?.activatedModules.includes('ai_assistant');

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4" data-testid="billing-page">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Billing & Settings</h1>
          <p className="text-gray-600">
            Manage your platform subscriptions, modules, and AI settings.
          </p>
        </div>

        <Tabs defaultValue="subscriptions" className="space-y-6">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
            <TabsTrigger value="subscriptions" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Subscriptions
            </TabsTrigger>
            <TabsTrigger value="ai-settings" className="flex items-center gap-2" disabled={!hasAiSubscription}>
              <Bot className="h-4 w-4" />
              AI Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="subscriptions" className="space-y-6">

        {activeSubscriptions.length > 0 && (
          <Card className="mb-8 border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Active Subscriptions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeSubscriptions.map((sub) => (
                  <div key={sub.id} className="bg-white rounded-lg p-4 border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {MODULE_ICONS[sub.moduleCode] || <Package className="h-5 w-5" />}
                        <span className="font-medium">{sub.module.name}</span>
                      </div>
                      {getStatusBadge(sub.status)}
                    </div>
                    <p className="text-sm text-gray-500 mb-2">
                      {sub.billingCycle === 'yearly' ? 'Annual' : 'Monthly'} billing
                    </p>
                    {sub.endDate && (
                      <p className="text-xs text-gray-400">
                        Renews: {new Date(sub.endDate).toLocaleDateString()}
                      </p>
                    )}
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="mt-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleCancelClick(sub.moduleCode)}
                    >
                      Cancel
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-center gap-4 mb-8">
          <Label htmlFor="billing-toggle" className={billingCycle === 'monthly' ? 'font-semibold' : 'text-gray-500'}>
            Monthly
          </Label>
          <Switch
            id="billing-toggle"
            checked={billingCycle === 'yearly'}
            onCheckedChange={(checked) => setBillingCycle(checked ? 'yearly' : 'monthly')}
          />
          <Label htmlFor="billing-toggle" className={billingCycle === 'yearly' ? 'font-semibold' : 'text-gray-500'}>
            Yearly
            <Badge className="ml-2 bg-green-100 text-green-800">Save 17%</Badge>
          </Label>
        </div>

        {coreModule && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Crown className="h-5 w-5 text-yellow-500" />
              Core Platform (Required)
            </h2>
            <Card className="border-primary border-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {MODULE_ICONS.core}
                      {coreModule.name}
                    </CardTitle>
                    <CardDescription className="mt-1">{coreModule.description}</CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">
                      {formatPrice(billingCycle === 'yearly' ? coreModule.yearlyPrice : coreModule.monthlyPrice)}
                    </div>
                    <div className="text-sm text-gray-500">
                      /{billingCycle === 'yearly' ? 'year' : 'month'}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-2">
                  {coreModule.features?.map((feature, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      {feature}
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter>
                {subscriptionData?.hasActiveCore ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Active</span>
                  </div>
                ) : (
                  <Button
                    onClick={() => handleSubscribe(coreModule)}
                    disabled={isProcessing}
                    className="w-full sm:w-auto"
                  >
                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Subscribe to Core Platform
                  </Button>
                )}
              </CardFooter>
            </Card>
          </div>
        )}

        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Add-on Modules
          </h2>
          
          {!subscriptionData?.hasActiveCore && (
            <Card className="mb-4 border-yellow-200 bg-yellow-50">
              <CardContent className="py-4">
                <div className="flex items-center gap-2 text-yellow-800">
                  <AlertCircle className="h-5 w-5" />
                  <span>Subscribe to Core Platform first to enable add-on modules.</span>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {addonModules.map((module) => {
              const isSubscribed = subscriptionData?.activatedModules.includes(module.code);
              
              return (
                <Card
                  key={module.id}
                  className={`relative ${isSubscribed ? 'border-green-200 bg-green-50/30' : ''}`}
                  data-testid={`module-card-${module.code}`}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        {MODULE_ICONS[module.code] || <Package className="h-5 w-5" />}
                        {module.name}
                      </CardTitle>
                      {isSubscribed && (
                        <Badge className="bg-green-500">Active</Badge>
                      )}
                    </div>
                    <CardDescription>{module.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4">
                      <span className="text-2xl font-bold">
                        {formatPrice(billingCycle === 'yearly' ? module.yearlyPrice : module.monthlyPrice)}
                      </span>
                      <span className="text-gray-500 text-sm">
                        /{billingCycle === 'yearly' ? 'year' : 'month'}
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {module.features?.slice(0, 4).map((feature, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    {isSubscribed ? (
                      <Button
                        variant="outline"
                        className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleCancelClick(module.code)}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Cancel Module
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        onClick={() => handleSubscribe(module)}
                        disabled={isProcessing || !subscriptionData?.hasActiveCore}
                      >
                        {isProcessing ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Zap className="h-4 w-4 mr-2" />
                        )}
                        Add Module
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </div>

        <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel Subscription</DialogTitle>
              <DialogDescription>
                {moduleToCancel === 'core' 
                  ? 'Canceling Core Platform will also cancel all add-on modules. Are you sure you want to continue?'
                  : 'Are you sure you want to cancel this module subscription?'}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
                Keep Subscription
              </Button>
              <Button 
                variant="destructive" 
                onClick={confirmCancel}
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Cancel Subscription
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

          </TabsContent>

          <TabsContent value="ai-settings">
            {hasAiSubscription ? (
              <AiSettingsPanel />
            ) : (
              <Card className="border-yellow-200 bg-yellow-50">
                <CardContent className="py-8 text-center">
                  <Bot className="h-12 w-12 mx-auto text-yellow-600 mb-4" />
                  <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                    AI Assistant Not Subscribed
                  </h3>
                  <p className="text-yellow-700 mb-4">
                    Subscribe to the AI Assistant module to customize your white-label AI.
                  </p>
                  <Button onClick={() => {
                    const el = document.querySelector('[data-testid="module-card-ai_assistant"]');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }}>
                    View AI Module
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

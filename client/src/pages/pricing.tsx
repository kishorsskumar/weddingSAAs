import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { PublicLayout } from "@/components/public-layout";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Package, Users, DollarSign, Zap, Bot, ArrowRight, Rocket, Building2, ChevronDown, ChevronUp } from "lucide-react";
import { motion } from "framer-motion";

const plans = [
  {
    code: "starter",
    name: "Business Starter Suite",
    subtitle: "Everything you need to run weddings professionally",
    monthlyPrice: 499,
    yearlyPrice: 4999,
    icon: Package,
    recommended: true,
    features: [
      "Up to 100 Wedding Projects",
      "Up to 1,000 Monthly Enquiries",
      "5 Team Members",
      "Unlimited Client Records",
      "Business Dashboard",
      "Automated Email Notifications",
      "Task & Team Alerts"
    ],
    cta: "Get Started"
  },
  {
    code: "growth",
    name: "Growth Suite",
    subtitle: "Built for growing wedding businesses",
    monthlyPrice: 999,
    yearlyPrice: 9999,
    icon: Rocket,
    recommended: false,
    features: [
      "Up to 500 Wedding Projects",
      "Up to 5,000 Monthly Enquiries",
      "15 Team Members",
      "WhatsApp Automation",
      "Advanced Reports",
      "Priority Support"
    ],
    cta: "Choose Growth"
  },
  {
    code: "agency",
    name: "Agency Pro",
    subtitle: "For high-volume event companies",
    monthlyPrice: 1999,
    yearlyPrice: 19999,
    icon: Building2,
    recommended: false,
    features: [
      "Unlimited Weddings",
      "Unlimited Leads",
      "Unlimited Team Members",
      "Unlimited Storage",
      "API Access",
      "Dedicated Support"
    ],
    cta: "Choose Agency"
  }
];

const comparisonFeatures = [
  { name: "Wedding Projects", starter: "100", growth: "500", agency: "Unlimited" },
  { name: "Monthly Enquiries", starter: "1,000", growth: "5,000", agency: "Unlimited" },
  { name: "Team Members", starter: "5", growth: "15", agency: "Unlimited" },
  { name: "Client Records", starter: "Unlimited", growth: "Unlimited", agency: "Unlimited" },
  { name: "Business Dashboard", starter: true, growth: true, agency: true },
  { name: "Email Notifications", starter: true, growth: true, agency: true },
  { name: "Task Alerts", starter: true, growth: true, agency: true },
  { name: "WhatsApp Automation", starter: false, growth: true, agency: true },
  { name: "Advanced Reports", starter: false, growth: true, agency: true },
  { name: "Priority Support", starter: false, growth: true, agency: true },
  { name: "API Access", starter: false, growth: false, agency: true },
  { name: "Dedicated Support", starter: false, growth: false, agency: true },
];

const modules = [
  {
    code: "rsvp",
    name: "RSVP Module",
    description: "Complete guest management system",
    monthlyPrice: 399,
    yearlyPrice: 3999,
    icon: Users,
    features: [
      "Guest list management",
      "RSVP public links",
      "Email invite system",
      "Auto email reminders",
      "QR code check-in"
    ]
  },
  {
    code: "crm",
    name: "CRM Module",
    description: "Lead tracking & follow-ups",
    monthlyPrice: 299,
    yearlyPrice: 2999,
    icon: Users,
    features: [
      "Lead tracking",
      "Follow-up scheduler",
      "Deal stages",
      "Pipeline management"
    ]
  },
  {
    code: "vendor",
    name: "Vendor Module",
    description: "Vendor database & assignments",
    monthlyPrice: 249,
    yearlyPrice: 2499,
    icon: Package,
    features: [
      "Vendor database",
      "Event assignment",
      "Vendor payments tracking"
    ]
  },
  {
    code: "payments",
    name: "Payments Module",
    description: "Financial tracking & invoicing",
    monthlyPrice: 299,
    yearlyPrice: 2999,
    icon: DollarSign,
    features: [
      "Budget tracking",
      "Transaction viewer",
      "Invoice export",
      "Payment reports"
    ]
  },
  {
    code: "automation",
    name: "Automation Module",
    description: "Timeline automation & reminders",
    monthlyPrice: 199,
    yearlyPrice: 1999,
    icon: Zap,
    features: [
      "Timeline automation",
      "Dashboard reminders",
      "Email trigger engine"
    ]
  },
  {
    code: "ai_assistant",
    name: "AI Assistant",
    description: "White-label AI for your business",
    monthlyPrice: 499,
    yearlyPrice: 4999,
    icon: Bot,
    features: [
      "Natural language queries",
      "Report generation",
      "Planning assistance",
      "Custom branding"
    ]
  }
];

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [showComparison, setShowComparison] = useState(false);

  useEffect(() => {
    document.title = "Pricing | AtBott Wedding SaaS";
  }, []);

  const formatPrice = (price: number) => `₹${price.toLocaleString('en-IN')}`;

  return (
    <PublicLayout>
      <section className="py-20 lg:py-28 bg-gradient-to-b from-primary/5 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
              Simple, Flexible Pricing
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Choose the plan that fits your business. Upgrade anytime as you grow.
            </p>
          </div>

          <div className="flex items-center justify-center gap-4 mb-12">
            <Label htmlFor="billing-toggle" className={billingCycle === 'monthly' ? 'font-semibold text-gray-900' : 'text-gray-500'}>
              Monthly
            </Label>
            <Switch
              id="billing-toggle"
              checked={billingCycle === 'yearly'}
              onCheckedChange={(checked) => setBillingCycle(checked ? 'yearly' : 'monthly')}
              data-testid="billing-toggle"
            />
            <Label htmlFor="billing-toggle" className={billingCycle === 'yearly' ? 'font-semibold text-gray-900' : 'text-gray-500'}>
              Yearly
              <Badge className="ml-2 bg-green-100 text-green-800 hover:bg-green-100">Save 17%</Badge>
            </Label>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {plans.map((plan, index) => (
              <motion.div
                key={plan.code}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={`relative bg-white rounded-2xl p-6 border-2 ${
                  plan.recommended ? 'border-primary shadow-xl' : 'border-gray-200 shadow-sm'
                }`}
                data-testid={`plan-card-${plan.code}`}
              >
                {plan.recommended && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-white text-sm font-medium px-4 py-1 rounded-full flex items-center gap-1">
                    <Crown className="h-4 w-4" />
                    Recommended
                  </div>
                )}
                <div className="text-center mb-6">
                  <div className={`w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center ${
                    plan.recommended ? 'bg-primary/10' : 'bg-gray-100'
                  }`}>
                    <plan.icon className={`h-6 w-6 ${plan.recommended ? 'text-primary' : 'text-gray-600'}`} />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">{plan.name}</h2>
                  <p className="text-sm text-gray-500">{plan.subtitle}</p>
                </div>
                
                <div className="text-center mb-6">
                  <div className="text-4xl font-bold text-gray-900">
                    {formatPrice(billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice)}
                  </div>
                  <div className="text-gray-500">
                    /{billingCycle === 'yearly' ? 'year' : 'month'}
                  </div>
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-gray-700">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link href="/signup">
                  <Button 
                    size="lg" 
                    className="w-full text-sm"
                    data-testid={`cta-${plan.code}`}
                  >
                    {plan.cta}
                    <ArrowRight className="ml-2 h-4 w-4 flex-shrink-0" />
                  </Button>
                </Link>
              </motion.div>
            ))}
          </div>

          <div className="text-center mb-16">
            <Button
              variant="outline"
              onClick={() => setShowComparison(!showComparison)}
              className="gap-2"
              data-testid="compare-plans-btn"
            >
              {showComparison ? 'Hide' : 'Compare'} Plans
              {showComparison ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>

          {showComparison && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-16 overflow-hidden"
            >
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-x-auto">
                <table className="w-full" data-testid="comparison-table">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left p-4 font-semibold text-gray-900">Feature</th>
                      <th className="text-center p-4 font-semibold text-gray-900">Starter</th>
                      <th className="text-center p-4 font-semibold text-primary bg-primary/5">Growth</th>
                      <th className="text-center p-4 font-semibold text-gray-900">Agency Pro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonFeatures.map((feature, index) => (
                      <tr key={feature.name} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                        <td className="p-4 text-gray-700">{feature.name}</td>
                        <td className="p-4 text-center">
                          {typeof feature.starter === 'boolean' ? (
                            feature.starter ? <Check className="h-5 w-5 text-green-500 mx-auto" /> : <span className="text-gray-300">—</span>
                          ) : (
                            <span className="font-medium">{feature.starter}</span>
                          )}
                        </td>
                        <td className="p-4 text-center bg-primary/5">
                          {typeof feature.growth === 'boolean' ? (
                            feature.growth ? <Check className="h-5 w-5 text-green-500 mx-auto" /> : <span className="text-gray-300">—</span>
                          ) : (
                            <span className="font-medium">{feature.growth}</span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {typeof feature.agency === 'boolean' ? (
                            feature.agency ? <Check className="h-5 w-5 text-green-500 mx-auto" /> : <span className="text-gray-300">—</span>
                          ) : (
                            <span className="font-medium">{feature.agency}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-4">
              Add-on Modules
            </h2>
            <p className="text-center text-gray-600 mb-8">
              Enhance your platform with specialized modules — works with any plan
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {modules.map((module, index) => (
              <motion.div
                key={module.code}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                data-testid={`module-card-${module.code}`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <module.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{module.name}</h3>
                    <p className="text-sm text-gray-500">{module.description}</p>
                  </div>
                </div>
                <div className="mb-4">
                  <span className="text-2xl font-bold text-gray-900">
                    {formatPrice(billingCycle === 'yearly' ? module.yearlyPrice : module.monthlyPrice)}
                  </span>
                  <span className="text-gray-500 text-sm">
                    /{billingCycle === 'yearly' ? 'year' : 'month'}
                  </span>
                </div>
                <ul className="space-y-2">
                  {module.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-gray-700">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>

          <div className="mt-16 text-center">
            <div className="bg-gray-50 rounded-2xl p-8 max-w-3xl mx-auto">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                Example Monthly Bundle
              </h3>
              <div className="flex flex-wrap justify-center gap-4 mb-6">
                <div className="bg-white rounded-lg px-4 py-2 border shadow-sm">
                  <span className="font-medium">Starter Suite</span>
                  <span className="text-gray-500 ml-2">₹499</span>
                </div>
                <span className="text-gray-400 self-center">+</span>
                <div className="bg-white rounded-lg px-4 py-2 border shadow-sm">
                  <span className="font-medium">RSVP</span>
                  <span className="text-gray-500 ml-2">₹399</span>
                </div>
                <span className="text-gray-400 self-center">+</span>
                <div className="bg-white rounded-lg px-4 py-2 border shadow-sm">
                  <span className="font-medium">Payments</span>
                  <span className="text-gray-500 ml-2">₹299</span>
                </div>
                <span className="text-gray-400 self-center">=</span>
                <div className="bg-primary/10 rounded-lg px-4 py-2 border-2 border-primary">
                  <span className="font-bold text-primary">₹1,197/month</span>
                </div>
              </div>
              <p className="text-gray-600 mb-6">
                Pay only for what you need. Add or remove modules anytime.
              </p>
              <Link href="/signup">
                <Button size="lg" data-testid="get-started-btn">
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          <div className="mt-12 text-center">
            <p className="text-sm text-gray-500">
              All plans include a 14-day free trial. Need help choosing?{" "}
              <Link href="/contact" className="text-primary hover:underline">
                Contact us
              </Link>
            </p>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

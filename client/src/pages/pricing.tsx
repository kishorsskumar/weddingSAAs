import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { PublicLayout } from "@/components/public-layout";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Package, Users, DollarSign, Zap, Bot, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const coreFeatures = [
  "One Login — Full Business Control",
  "Manage Every Wedding in One Place",
  "Never Lose Client Details Again",
  "Instant Team Task Notifications",
  "Automatic Client Email Updates",
  "Live Business Performance Overview"
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
              Modular Pricing
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Start with the Core Platform, then add only the modules you need. Pay for what you use.
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
            />
            <Label htmlFor="billing-toggle" className={billingCycle === 'yearly' ? 'font-semibold text-gray-900' : 'text-gray-500'}>
              Yearly
              <Badge className="ml-2 bg-green-100 text-green-800 hover:bg-green-100">Save 17%</Badge>
            </Label>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-16"
          >
            <div className="relative bg-white rounded-2xl p-8 border-2 border-primary shadow-xl max-w-3xl mx-auto">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-white text-sm font-medium px-4 py-1 rounded-full flex items-center gap-1">
                <Crown className="h-4 w-4" />
                Recommended to Start
              </div>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <Package className="h-6 w-6 text-primary" />
                    Business Starter Suite
                  </h2>
                  <p className="text-gray-600 mb-4">
                    Everything you need to run weddings professionally
                  </p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {coreFeatures.map((feature) => (
                      <div key={feature} className="flex items-center gap-2 text-sm text-gray-700">
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="text-center md:text-right">
                  <div className="text-4xl font-bold text-gray-900">
                    {formatPrice(billingCycle === 'yearly' ? 4999 : 499)}
                  </div>
                  <div className="text-gray-500 mb-4">
                    /{billingCycle === 'yearly' ? 'year' : 'month'}
                  </div>
                  <Link href="/signup">
                    <Button size="lg" className="w-full md:w-auto">
                      Activate Business Starter Suite
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
              Add-on Modules
            </h2>
            <p className="text-center text-gray-600 mb-8">
              Enhance your platform with specialized modules
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
                <Button size="lg">
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

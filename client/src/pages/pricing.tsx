import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { PublicLayout } from "@/components/public-layout";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Package, Rocket, Building2, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const plans = [
  {
    code: "starter",
    name: "Starter",
    subtitle: "Perfect for Solo Event Planners",
    monthlyPrice: 499,
    yearlyPrice: 4999,
    yearlySavings: 989,
    icon: Package,
    recommended: false,
    badge: null,
    features: [
      "Up to 5 Active Events",
      "Lead Management System",
      "Basic Client Portal (Timeline + Documents)",
      "Event Calendar",
      "1 Team Member",
      "Email Support",
    ],
    cta: "Start Free Trial",
    ctaLink: "/signup?plan=starter",
    reassurance: false,
  },
  {
    code: "growth",
    name: "Growth",
    subtitle: "Best for Growing Event Businesses",
    monthlyPrice: 1499,
    yearlyPrice: 14999,
    yearlySavings: 2989,
    icon: Rocket,
    recommended: true,
    badge: "Most Popular",
    features: [
      "Unlimited Events",
      "Full Client Portal",
      "Client Payment & Installment Tracking",
      "Automated Follow-up Reminders",
      "Revenue & Lead Analytics Dashboard",
      "Custom Branding (Your Logo in Client Portal)",
      "5 Team Members",
      "Priority Support",
    ],
    cta: "Start Free Trial",
    ctaLink: "/signup?plan=growth",
    reassurance: true,
  },
  {
    code: "enterprise",
    name: "Enterprise",
    subtitle: "For Large Agencies & Multi-Branch Teams",
    monthlyPrice: null,
    yearlyPrice: null,
    yearlySavings: null,
    icon: Building2,
    recommended: false,
    badge: null,
    features: [
      "Everything in Growth",
      "Unlimited Team Members",
      "Vendor Management Module",
      "API & Custom Integrations",
      "Multi-Branch Access",
      "Dedicated Account Manager",
      "SLA Guarantee",
      "WhatsApp Integration",
    ],
    cta: "Contact Sales",
    ctaLink: "/contact-enterprise",
    reassurance: false,
  },
];

const comparisonFeatures = [
  { name: "Active Events", starter: "5", growth: "Unlimited", enterprise: "Unlimited" },
  { name: "Team Members", starter: "1", growth: "5", enterprise: "Unlimited" },
  { name: "Lead Management", starter: true, growth: true, enterprise: true },
  { name: "Event Calendar", starter: true, growth: true, enterprise: true },
  { name: "Basic Client Portal", starter: true, growth: true, enterprise: true },
  { name: "Full Client Portal", starter: false, growth: true, enterprise: true },
  { name: "Payment & Installment Tracking", starter: false, growth: true, enterprise: true },
  { name: "Automated Follow-up Reminders", starter: false, growth: true, enterprise: true },
  { name: "Revenue & Lead Analytics", starter: false, growth: true, enterprise: true },
  { name: "Custom Branding", starter: false, growth: true, enterprise: true },
  { name: "Priority Support", starter: false, growth: true, enterprise: true },
  { name: "Vendor Management", starter: false, growth: false, enterprise: true },
  { name: "API & Custom Integrations", starter: false, growth: false, enterprise: true },
  { name: "Multi-Branch Access", starter: false, growth: false, enterprise: true },
  { name: "Dedicated Account Manager", starter: false, growth: false, enterprise: true },
  { name: "SLA Guarantee", starter: false, growth: false, enterprise: true },
  { name: "WhatsApp Integration", starter: false, growth: false, enterprise: true },
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
      <section className="py-20 lg:py-28 bg-gradient-to-b from-[#2FA4BC]/5 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
              Simple, Transparent Pricing
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Choose the plan that fits your business. Upgrade anytime as you grow.
            </p>
          </div>

          <div className="flex items-center justify-center gap-4 mb-12">
            <Label htmlFor="billing-toggle" className={`cursor-pointer ${billingCycle === 'monthly' ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
              Monthly
            </Label>
            <Switch
              id="billing-toggle"
              checked={billingCycle === 'yearly'}
              onCheckedChange={(checked) => setBillingCycle(checked ? 'yearly' : 'monthly')}
              data-testid="billing-toggle"
            />
            <Label htmlFor="billing-toggle" className={`cursor-pointer ${billingCycle === 'yearly' ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
              Annual
              <Badge className="ml-2 bg-[#2FA4BC]/10 text-[#1e7a8c] hover:bg-[#2FA4BC]/10">Save 2 Months</Badge>
            </Label>
          </div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8 mb-8 items-start">
            {plans.map((plan, index) => (
              <motion.div
                key={plan.code}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={`relative bg-white rounded-2xl p-6 lg:p-8 ${
                  plan.recommended
                    ? 'border-[3px] border-[#2FA4BC] shadow-xl scale-[1.02] bg-gradient-to-b from-[#2FA4BC]/[0.03] to-white'
                    : 'border-2 border-gray-200 shadow-sm'
                }`}
                data-testid={`plan-card-${plan.code}`}
              >
                {plan.recommended && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <div className="bg-[#2FA4BC] text-white text-sm font-semibold px-5 py-1.5 rounded-full flex items-center gap-1.5 whitespace-nowrap">
                      <Crown className="h-4 w-4" />
                      Most Popular
                    </div>
                  </div>
                )}
                <div className={`text-center ${plan.recommended ? 'mt-4' : ''} mb-6`}>
                  <div className={`w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center ${
                    plan.recommended ? 'bg-[#2FA4BC]/10' : 'bg-gray-100'
                  }`}>
                    <plan.icon className={`h-6 w-6 ${plan.recommended ? 'text-[#2FA4BC]' : 'text-gray-600'}`} />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">{plan.name}</h2>
                  <p className="text-sm text-gray-500">{plan.subtitle}</p>
                </div>
                
                <div className="text-center mb-6">
                  {plan.monthlyPrice !== null ? (
                    <>
                      <div className="text-4xl font-bold text-gray-900">
                        {formatPrice(billingCycle === 'yearly' ? plan.yearlyPrice! : plan.monthlyPrice)}
                      </div>
                      <div className="text-gray-500">
                        /{billingCycle === 'yearly' ? 'year' : 'month'}
                      </div>
                      {billingCycle === 'yearly' && plan.yearlySavings && (
                        <div className="text-sm text-[#2FA4BC] font-medium mt-1">
                          You save {formatPrice(plan.yearlySavings)}/year
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="text-4xl font-bold text-gray-900">Custom</div>
                      <div className="text-gray-500">Contact us for pricing</div>
                    </>
                  )}
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-gray-700">
                      <Check className="h-4 w-4 text-[#2FA4BC] flex-shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {plan.reassurance && (
                  <div className="mb-6 space-y-1.5 px-1">
                    <p className="text-sm text-gray-600 flex items-center gap-1.5">
                      <span className="text-[#2FA4BC]">✔</span> No setup fees
                    </p>
                    <p className="text-sm text-gray-600 flex items-center gap-1.5">
                      <span className="text-[#2FA4BC]">✔</span> Free onboarding support
                    </p>
                    <p className="text-sm text-gray-600 flex items-center gap-1.5">
                      <span className="text-[#2FA4BC]">✔</span> Cancel anytime
                    </p>
                  </div>
                )}

                <Link href={plan.ctaLink}>
                  <Button 
                    size="lg" 
                    className={`w-full text-sm ${
                      plan.recommended
                        ? 'bg-[#2FA4BC] hover:bg-[#2590a6] text-white'
                        : plan.code === 'enterprise'
                          ? 'bg-white text-gray-900 border-2 border-gray-300 hover:bg-gray-50'
                          : ''
                    }`}
                    variant={plan.code === 'enterprise' ? 'outline' : 'default'}
                    data-testid={`cta-${plan.code}`}
                  >
                    {plan.cta}
                    <ArrowRight className="ml-2 h-4 w-4 flex-shrink-0" />
                  </Button>
                </Link>
              </motion.div>
            ))}
          </div>

          <div className="text-center mb-10">
            <button
              onClick={() => setShowComparison(!showComparison)}
              className="text-[#2FA4BC] hover:text-[#2590a6] font-medium text-sm inline-flex items-center gap-1 transition-colors"
              data-testid="compare-plans-btn"
            >
              {showComparison ? 'Hide Plan Comparison' : 'Compare All Plans'}
              <ArrowRight className={`h-4 w-4 transition-transform ${showComparison ? 'rotate-90' : ''}`} />
            </button>
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
                      <th className="text-center p-4 font-semibold text-[#1e7a8c] bg-[#2FA4BC]/5">Growth</th>
                      <th className="text-center p-4 font-semibold text-gray-900">Enterprise</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonFeatures.map((feature, index) => (
                      <tr key={feature.name} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                        <td className="p-4 text-gray-700">{feature.name}</td>
                        <td className="p-4 text-center">
                          {typeof feature.starter === 'boolean' ? (
                            feature.starter ? <Check className="h-5 w-5 text-[#2FA4BC] mx-auto" /> : <span className="text-gray-300">—</span>
                          ) : (
                            <span className="font-medium">{feature.starter}</span>
                          )}
                        </td>
                        <td className="p-4 text-center bg-[#2FA4BC]/5">
                          {typeof feature.growth === 'boolean' ? (
                            feature.growth ? <Check className="h-5 w-5 text-[#2FA4BC] mx-auto" /> : <span className="text-gray-300">—</span>
                          ) : (
                            <span className="font-medium">{feature.growth}</span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {typeof feature.enterprise === 'boolean' ? (
                            feature.enterprise ? <Check className="h-5 w-5 text-[#2FA4BC] mx-auto" /> : <span className="text-gray-300">—</span>
                          ) : (
                            <span className="font-medium">{feature.enterprise}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          <div className="mt-12 text-center">
            <div className="bg-[#2FA4BC]/5 border border-[#2FA4BC]/20 rounded-xl py-4 px-6 inline-block">
              <p className="text-gray-700 text-sm sm:text-base">
                All plans include a <strong>14-day Growth Trial</strong>. No credit card required.
              </p>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

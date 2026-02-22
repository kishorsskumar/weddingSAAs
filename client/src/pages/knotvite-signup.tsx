import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { useAuth } from "@/context/auth-context";
import { Heart, Mail, Lock, User, ArrowRight, Check, Gift, Star, Crown, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import atbottLogo from "../assets/atbott-logo-dark.png";

const TEAL = "#2FA4BC";
const TEAL_DARK = "#268fa5";
const TEAL_LIGHT = "#e0f4f8";

const PLANS_INFO: Record<string, { name: string; price: string; features: string[]; trial?: boolean; badge?: string }> = {
  basic: {
    name: "Basic",
    price: "₹4,999",
    trial: true,
    features: ["1 Event", "Up to 200 Guests", "Basic RSVP Form", "Guest Dashboard", "Mobile-Friendly Pages", "Email Notifications"],
  },
  pro: {
    name: "Pro",
    price: "₹14,999",
    badge: "Most Popular",
    features: ["Up to 5 Events", "Up to 400 Guests", "Custom RSVP Fields", "WhatsApp Reminders", "Excel Import/Export", "Remove Branding", "Priority Support"],
  },
  premium: {
    name: "Premium",
    price: "₹24,999",
    features: ["Unlimited Events", "Unlimited Guests", "Wedding Page Builder", "QR Check-in", "WhatsApp Automation", "Custom Domain", "Dedicated Support"],
  },
};

export default function KnotViteSignup() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const selectedPlan = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("plan") || "basic";
  }, []);

  const planInfo = PLANS_INFO[selectedPlan] || PLANS_INFO.basic;

  useEffect(() => {
    if (user) setLocation("/knotvite/dashboard");
  }, [user, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/knotvite/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, email, password, phone, plan: selectedPlan }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Signup failed");

      if (data.token) {
        localStorage.setItem("auth_token", data.token);
      }

      toast({ title: "Welcome to KnotVite!", description: planInfo.trial ? "Your 14-day free trial has started." : "Your account is ready." });

      if (selectedPlan !== "basic" && !planInfo.trial) {
        setLocation("/knotvite/billing?plan=" + selectedPlan);
      } else {
        window.location.href = "/knotvite/dashboard";
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#e0f4f8] via-white to-[#f0fafb]">
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setLocation("/knotvite")} data-testid="nav-logo">
              <img src={atbottLogo} alt="AtBott" className="h-7 w-auto" />
              <div className="h-5 w-px bg-gray-300" />
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: TEAL }}>
                  <Heart className="h-3.5 w-3.5 text-white fill-white" />
                </div>
                <span className="font-semibold text-sm text-gray-900">KnotVite</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500 hidden sm:inline">Already have an account?</span>
              <Button variant="ghost" size="sm" onClick={() => setLocation("/login")} data-testid="nav-signin">Sign In</Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
        <div className="grid md:grid-cols-5 gap-6 lg:gap-10">
          <div className="md:col-span-2 space-y-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                Create Your Account
              </h1>
              <p className="text-gray-600 text-sm sm:text-base">
                {planInfo.trial
                  ? "Start your 14-day free trial — no credit card needed."
                  : `Get started with KnotVite ${planInfo.name}.`}
              </p>
            </div>

            <Card className="border-2" style={{ borderColor: TEAL }} data-testid="selected-plan-card">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-lg" style={{ color: TEAL }}>{planInfo.name} Plan</h3>
                  {planInfo.trial && (
                    <Badge className="bg-amber-100 text-amber-800 text-[10px]">
                      <Gift className="h-3 w-3 mr-1" /> 14-Day Trial
                    </Badge>
                  )}
                  {planInfo.badge && (
                    <Badge className="text-white text-[10px]" style={{ backgroundColor: TEAL }}>
                      <Star className="h-3 w-3 mr-1" /> {planInfo.badge}
                    </Badge>
                  )}
                </div>
                <div className="mb-4">
                  <span className="text-2xl font-bold text-gray-900">{planInfo.price}</span>
                  <span className="text-xs text-gray-400 ml-1">+ GST</span>
                </div>
                <ul className="space-y-2">
                  {planInfo.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                      <Check className="h-4 w-4 flex-shrink-0" style={{ color: TEAL }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 pt-3 border-t flex gap-2">
                  {Object.entries(PLANS_INFO).map(([key, plan]) => (
                    <button
                      key={key}
                      onClick={() => {
                        const url = new URL(window.location.href);
                        url.searchParams.set("plan", key);
                        window.history.replaceState({}, "", url.toString());
                        window.location.reload();
                      }}
                      className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${selectedPlan === key ? 'text-white' : 'text-gray-600 bg-gray-100 hover:bg-gray-200'}`}
                      style={selectedPlan === key ? { backgroundColor: TEAL } : {}}
                      data-testid={`plan-switch-${key}`}
                    >
                      {plan.name}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-3">
            <Card className="shadow-xl border-0" data-testid="signup-form-card">
              <CardContent className="p-6 sm:p-8">
                <form onSubmit={handleSubmit} className="space-y-5">
                  {error && (
                    <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg border border-red-200" data-testid="error-message">
                      {error}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name"
                        required
                        className="pl-10"
                        data-testid="input-name"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                        className="pl-10"
                        data-testid="input-email"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 9876543210"
                      data-testid="input-phone"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min. 8 characters"
                        required
                        minLength={8}
                        className="pl-10"
                        data-testid="input-password"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full py-5 text-base text-white hover:brightness-110"
                    style={{ backgroundColor: TEAL }}
                    disabled={submitting}
                    data-testid="submit-signup"
                  >
                    {submitting ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating Account...</>
                    ) : planInfo.trial ? (
                      <><Gift className="h-4 w-4 mr-2" /> Start 14-Day Free Trial</>
                    ) : (
                      <><ArrowRight className="h-4 w-4 mr-2" /> Create Account & Pay</>
                    )}
                  </Button>

                  <p className="text-[11px] text-gray-400 text-center">
                    By signing up, you agree to our{" "}
                    <a href="/terms" className="underline">Terms</a> and{" "}
                    <a href="/privacy-policy" className="underline">Privacy Policy</a>.
                    {planInfo.trial && " No credit card required for trial."}
                  </p>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

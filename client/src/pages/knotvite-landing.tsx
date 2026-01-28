import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Link2, Users, LayoutDashboard, FileSpreadsheet, QrCode, MessageSquare,
  CheckCircle2, ArrowRight, Sparkles, Calendar, Share2, BarChart3
} from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/auth-context";

const FEATURES = [
  {
    icon: Link2,
    title: "Smart RSVP Links",
    description: "Share one link and track guest confirmations instantly.",
  },
  {
    icon: Users,
    title: "Custom Guest Fields",
    description: "Collect hotel stay, transport needs, meal preference and special requests.",
  },
  {
    icon: LayoutDashboard,
    title: "Live Guest Dashboard",
    description: "View confirmed, pending and declined guests in real-time.",
  },
  {
    icon: FileSpreadsheet,
    title: "Excel Import & Export",
    description: "Upload guest lists and export reports in CSV/Excel.",
    badge: "Pro",
  },
  {
    icon: QrCode,
    title: "QR Check-in",
    description: "Scan guests at venue for instant attendance tracking.",
  },
  {
    icon: MessageSquare,
    title: "WhatsApp Integration",
    description: "Send RSVP links and reminders via WhatsApp.",
    badge: "Premium",
  },
];

const STEPS = [
  { step: 1, title: "Create Event", icon: Calendar },
  { step: 2, title: "Customize RSVP Form", icon: Sparkles },
  { step: 3, title: "Share RSVP Link", icon: Share2 },
  { step: 4, title: "Track Responses", icon: BarChart3 },
];

export default function KnotViteLanding() {
  const [, navigate] = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    document.title = "KnotVite RSVP | Wedding Guest Management Software";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Collect wedding RSVPs, manage guest lists and track attendance with KnotVite powered by AtBott.');
    }
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute('content', 'KnotVite RSVP | Wedding Guest Management Software');
    }
    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription) {
      ogDescription.setAttribute('content', 'Collect wedding RSVPs, manage guest lists and track attendance with KnotVite powered by AtBott.');
    }
    
    return () => {
      document.title = "AtBott Wedding SaaS - Manage Your Wedding Business Smarter";
    };
  }, []);

  const handleGetStarted = () => {
    if (user) {
      navigate("/knotvite/dashboard");
    } else {
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#2F6B3F] flex items-center justify-center">
                <span className="text-white font-bold text-sm">K</span>
              </div>
              <span className="font-semibold text-lg text-gray-900">KnotVite</span>
              <span className="text-xs text-gray-500">by AtBott</span>
            </div>
            <div className="flex items-center gap-3">
              {user ? (
                <Button onClick={() => navigate("/knotvite/dashboard")} className="bg-[#2F6B3F] hover:bg-[#245530]" data-testid="nav-dashboard-btn">
                  Go to Dashboard
                </Button>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => navigate("/login")} data-testid="nav-signin-btn">
                    Sign In
                  </Button>
                  <Button onClick={handleGetStarted} className="bg-[#2F6B3F] hover:bg-[#245530]" data-testid="nav-getstarted-btn">
                    Get Started Free
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                  KnotVite — Smart Wedding RSVP Management
                </h1>
                <p className="text-lg sm:text-xl text-gray-600 max-w-xl">
                  Create RSVP links, track guest responses, manage hotel stays, meal preferences and attendance — all in one dashboard.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  size="lg" 
                  onClick={handleGetStarted}
                  className="bg-[#2F6B3F] hover:bg-[#245530] text-lg px-8 py-6"
                  data-testid="hero-cta-primary"
                >
                  Create Free RSVP Event
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={() => navigate("/pricing")}
                  className="text-lg px-8 py-6"
                  data-testid="hero-cta-secondary"
                >
                  View Demo
                </Button>
              </div>
              
              <p className="text-sm text-gray-500 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#2F6B3F]" />
                No credit card required • Free forever plan available
              </p>
            </div>
            
            {/* Dashboard Mockup */}
            <div className="relative">
              <div className="bg-gradient-to-br from-[#2F6B3F]/10 to-[#2F6B3F]/5 rounded-2xl p-6 shadow-xl border">
                <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                  <div className="bg-[#2F6B3F] px-4 py-3 flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-400"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                      <div className="w-3 h-3 rounded-full bg-green-400"></div>
                    </div>
                    <span className="text-white/80 text-sm ml-2">KnotVite Dashboard</span>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-green-50 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-green-600">124</div>
                        <div className="text-xs text-green-700">Confirmed</div>
                      </div>
                      <div className="bg-yellow-50 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-yellow-600">45</div>
                        <div className="text-xs text-yellow-700">Pending</div>
                      </div>
                      <div className="bg-red-50 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-red-600">12</div>
                        <div className="text-xs text-red-700">Declined</div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                          <div className="w-8 h-8 rounded-full bg-gray-200"></div>
                          <div className="flex-1">
                            <div className="h-3 bg-gray-200 rounded w-24"></div>
                            <div className="h-2 bg-gray-100 rounded w-16 mt-1"></div>
                          </div>
                          <div className="px-2 py-1 bg-green-100 rounded text-xs text-green-700">Attending</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Everything You Need for Wedding RSVPs
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Powerful features designed to make guest management effortless
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, index) => (
              <Card 
                key={index} 
                className="relative overflow-hidden hover:shadow-lg transition-shadow border-0 shadow-md"
                data-testid={`feature-card-${index}`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-[#2F6B3F]/10 flex items-center justify-center">
                      <feature.icon className="h-6 w-6 text-[#2F6B3F]" />
                    </div>
                    {feature.badge && (
                      <Badge variant="secondary" className="bg-[#2F6B3F]/10 text-[#2F6B3F] hover:bg-[#2F6B3F]/20">
                        {feature.badge}
                      </Badge>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-lg text-gray-600">
              Get started in minutes with 4 simple steps
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {STEPS.map((step, index) => (
              <div key={index} className="text-center relative" data-testid={`step-${step.step}`}>
                <div className="w-16 h-16 rounded-full bg-[#2F6B3F] flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <step.icon className="h-8 w-8 text-white" />
                </div>
                <div className="absolute top-8 left-1/2 w-full h-0.5 bg-[#2F6B3F]/20 -z-10 hidden lg:block" 
                     style={{ display: index === STEPS.length - 1 ? 'none' : undefined }}></div>
                <div className="text-sm font-medium text-[#2F6B3F] mb-2">Step {step.step}</div>
                <h3 className="text-lg font-semibold text-gray-900">{step.title}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-gray-600">
              Start free, upgrade when you need more
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Plan */}
            <Card className="relative border-2 hover:border-[#2F6B3F]/30 transition-colors" data-testid="pricing-free">
              <CardContent className="p-8">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Free Plan</h3>
                  <div className="text-4xl font-bold text-gray-900">₹0<span className="text-lg font-normal text-gray-500">/forever</span></div>
                </div>
                <ul className="space-y-3 mb-8">
                  {["1 Event", "100 Guests", "Basic RSVP Form", "AtBott Branding"].map((item, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-[#2F6B3F]" />
                      <span className="text-gray-600">{item}</span>
                    </li>
                  ))}
                </ul>
                <Button 
                  variant="outline" 
                  className="w-full" 
                  size="lg"
                  onClick={handleGetStarted}
                  data-testid="pricing-free-cta"
                >
                  Get Started Free
                </Button>
              </CardContent>
            </Card>
            
            {/* Pro Plan */}
            <Card className="relative border-2 border-[#2F6B3F] shadow-xl" data-testid="pricing-pro">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-[#2F6B3F] text-white px-4 py-1">Most Popular</Badge>
              </div>
              <CardContent className="p-8">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Pro Plan</h3>
                  <div className="text-4xl font-bold text-[#2F6B3F]">₹999<span className="text-lg font-normal text-gray-500">/event</span></div>
                </div>
                <ul className="space-y-3 mb-8">
                  {[
                    "Unlimited Events",
                    "Unlimited Guests",
                    "Excel Import/Export",
                    "Custom Fields",
                    "WhatsApp Integration",
                    "Remove Branding"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-[#2F6B3F]" />
                      <span className="text-gray-600">{item}</span>
                    </li>
                  ))}
                </ul>
                <Button 
                  className="w-full bg-[#2F6B3F] hover:bg-[#245530]" 
                  size="lg"
                  onClick={() => navigate("/pricing")}
                  data-testid="pricing-pro-cta"
                >
                  View Full Pricing
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Upsell Banner */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-[#2F6B3F] to-[#1e4a2a]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Need Full Wedding Business Management?
          </h2>
          <p className="text-lg text-white/80 mb-8 max-w-2xl mx-auto">
            Upgrade to AtBott platform to manage clients, vendors, payments and automation.
          </p>
          <Button 
            size="lg" 
            variant="secondary"
            onClick={() => navigate("/")}
            className="text-[#2F6B3F] bg-white hover:bg-gray-100 px-8"
            data-testid="upsell-cta"
          >
            Explore AtBott Platform
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6 lg:px-8 border-t bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="w-6 h-6 rounded bg-[#2F6B3F] flex items-center justify-center">
                <span className="text-white font-bold text-xs">K</span>
              </div>
              KnotVite powered by AtBott Solutions © 2026
            </div>
            <div className="flex items-center gap-6 text-sm">
              <a href="/privacy-policy" className="text-gray-600 hover:text-[#2F6B3F] transition-colors" data-testid="footer-privacy">
                Privacy Policy
              </a>
              <a href="/terms" className="text-gray-600 hover:text-[#2F6B3F] transition-colors" data-testid="footer-terms">
                Terms
              </a>
              <a href="/refund-policy" className="text-gray-600 hover:text-[#2F6B3F] transition-colors" data-testid="footer-refund">
                Refund Policy
              </a>
              <a href="/contact" className="text-gray-600 hover:text-[#2F6B3F] transition-colors" data-testid="footer-contact">
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

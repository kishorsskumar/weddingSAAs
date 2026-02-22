import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Link2, Users, LayoutDashboard, FileSpreadsheet, QrCode, MessageSquare,
  CheckCircle2, ArrowRight, Sparkles, Calendar, Share2, BarChart3,
  Play, ChevronDown, Star, Shield, Zap, Crown, Gift, Clock,
  Heart, Send, UserPlus, Eye, Bell, Globe, Smartphone, ChefHat,
  Plane, Hotel, Car, Check, X
} from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/auth-context";
import atbottLogo from "../assets/atbott-logo-dark.png";

const BRAND = "#2FA4BC";
const BRAND_DARK = "#1a8a9e";
const BRAND_LIGHT = "#e0f4f8";

const FEATURES = [
  { icon: Link2, title: "Smart RSVP Links", description: "One link per event — share via WhatsApp, SMS or email. Guests RSVP in seconds." },
  { icon: Users, title: "Guest Dashboard", description: "Real-time view of confirmed, pending, and declined guests with meal & travel details." },
  { icon: Smartphone, title: "Mobile-First Design", description: "Beautiful RSVP pages that look stunning on every device — phone, tablet, or desktop." },
  { icon: ChefHat, title: "Meal & Diet Tracking", description: "Collect vegetarian, non-veg, Jain, and custom diet preferences per guest." },
  { icon: Plane, title: "Travel & Logistics", description: "Track airport pickups, hotel stays, local transport needs — all in one place." },
  { icon: MessageSquare, title: "WhatsApp Reminders", description: "Automated RSVP reminders and follow-ups sent directly to guests via WhatsApp.", badge: "Pro" },
  { icon: FileSpreadsheet, title: "Excel Import & Export", description: "Bulk upload guest lists from Excel. Export reports for vendors and planners.", badge: "Pro" },
  { icon: QrCode, title: "QR Check-in", description: "Generate unique QR codes per guest. Scan at venue for instant attendance tracking.", badge: "Premium" },
  { icon: Heart, title: "Wedding Page Builder", description: "Create beautiful, shareable wedding info pages with countdown, venue maps & photos.", badge: "Premium" },
];

const STEPS = [
  { 
    step: 1, title: "Create Your Event", icon: Calendar, color: BRAND,
    description: "Set up your wedding or event in under 2 minutes. Add venue, date and custom fields.",
    detail: "Name your event, pick the date, and customize the RSVP form with the fields you need."
  },
  { 
    step: 2, title: "Share the RSVP Link", icon: Send, color: "#f59e0b",
    description: "Share a single link via WhatsApp, SMS, email or social media.",
    detail: "Each guest gets a unique, trackable link. No app downloads needed."
  },
  { 
    step: 3, title: "Guests Respond", icon: UserPlus, color: "#10b981",
    description: "Guests fill in attendance, meal preference, travel needs — on any device.",
    detail: "Beautiful mobile-first forms that take 30 seconds to complete."
  },
  { 
    step: 4, title: "Track Everything Live", icon: BarChart3, color: "#8b5cf6",
    description: "Watch responses come in real-time on your dashboard. Export anytime.",
    detail: "See confirmed vs pending guests, meal counts, hotel needs — all at a glance."
  },
];

const PLANS = [
  {
    name: "Basic",
    price: "Free",
    period: "14-day trial",
    description: "Perfect for trying out KnotVite with your first event",
    highlight: false,
    trial: true,
    features: [
      { text: "1 Event", included: true },
      { text: "Up to 100 Guests", included: true },
      { text: "Basic RSVP Form", included: true },
      { text: "Guest Dashboard", included: true },
      { text: "Mobile-Friendly Pages", included: true },
      { text: "Email Notifications", included: true },
      { text: "KnotVite Branding", included: true },
      { text: "WhatsApp Reminders", included: false },
      { text: "Excel Import/Export", included: false },
      { text: "QR Check-in", included: false },
    ],
    cta: "Start Free Trial",
    ctaVariant: "outline" as const,
  },
  {
    name: "Pro",
    price: "₹2,999",
    period: "per event",
    description: "For couples who want the complete RSVP experience",
    highlight: true,
    trial: false,
    features: [
      { text: "Unlimited Events", included: true },
      { text: "Up to 500 Guests", included: true },
      { text: "Custom RSVP Fields", included: true },
      { text: "Guest Dashboard", included: true },
      { text: "Mobile-Friendly Pages", included: true },
      { text: "WhatsApp Reminders", included: true },
      { text: "Excel Import/Export", included: true },
      { text: "Remove KnotVite Branding", included: true },
      { text: "Priority Support", included: true },
      { text: "QR Check-in", included: false },
    ],
    cta: "Get Started",
    ctaVariant: "default" as const,
  },
  {
    name: "Premium",
    price: "₹7,999",
    period: "per event",
    description: "Full-service RSVP with wedding page, QR check-in & automation",
    highlight: false,
    trial: false,
    features: [
      { text: "Unlimited Events", included: true },
      { text: "Unlimited Guests", included: true },
      { text: "Custom RSVP Fields", included: true },
      { text: "Wedding Page Builder", included: true },
      { text: "WhatsApp Automation", included: true },
      { text: "Excel Import/Export", included: true },
      { text: "QR Check-in at Venue", included: true },
      { text: "Remove All Branding", included: true },
      { text: "Dedicated Support", included: true },
      { text: "Custom Domain", included: true },
    ],
    cta: "Contact Sales",
    ctaVariant: "outline" as const,
  },
];

const TESTIMONIALS = [
  { name: "Priya & Rohit", location: "Mumbai", text: "KnotVite made our 800-guest wedding so easy. We knew exactly who was coming, their meal preferences, and travel plans. Absolute lifesaver!", rating: 5 },
  { name: "Anjali & Karan", location: "Delhi", text: "The WhatsApp reminders were amazing. Our RSVP response rate jumped from 40% to 92% within a week. Highly recommend!", rating: 5 },
  { name: "Meera & Arjun", location: "Bangalore", text: "We loved the QR check-in at the venue. No more running around with guest lists. Everything was on our phones.", rating: 5 },
];

function AnimatedCounter({ target, label, suffix = "" }: { target: number; label: string; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const duration = 2000;
          const steps = 60;
          const increment = target / steps;
          let current = 0;
          const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
              setCount(target);
              clearInterval(timer);
            } else {
              setCount(Math.floor(current));
            }
          }, duration / steps);
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return (
    <div ref={ref} className="text-center">
      <div className="text-3xl sm:text-4xl font-bold text-white">{count.toLocaleString()}{suffix}</div>
      <div className="text-sm text-white/70 mt-1">{label}</div>
    </div>
  );
}

function AnimatedStep({ step, index }: { step: typeof STEPS[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setIsVisible(true);
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div 
      ref={ref}
      className={`transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      style={{ transitionDelay: `${index * 200}ms` }}
      data-testid={`step-${step.step}`}
    >
      <div className="relative">
        <div 
          className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg transition-transform hover:scale-110"
          style={{ backgroundColor: step.color }}
        >
          <step.icon className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
        </div>
        {index < STEPS.length - 1 && (
          <div className="hidden lg:block absolute top-10 left-[calc(50%+40px)] w-[calc(100%-80px)] h-0.5 bg-gradient-to-r from-gray-300 to-gray-200" />
        )}
      </div>
      <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: step.color }}>Step {step.step}</div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">{step.title}</h3>
      <p className="text-sm text-gray-600 mb-2">{step.description}</p>
      <p className="text-xs text-gray-400 italic">{step.detail}</p>
    </div>
  );
}

function PhoneMockup() {
  const [currentScreen, setCurrentScreen] = useState(0);
  const screens = [
    { title: "RSVP Invitation", content: (
      <div className="space-y-3">
        <div className="text-center">
          <Heart className="h-8 w-8 mx-auto mb-2" style={{ color: BRAND }} />
          <h4 className="font-bold text-sm">Priya & Rohit</h4>
          <p className="text-[10px] text-gray-500">Wedding Reception</p>
          <p className="text-[10px] text-gray-400">Dec 15, 2026 • Mumbai</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <p className="text-[10px] font-medium">Will you attend?</p>
          <div className="flex gap-1.5 mt-1.5 justify-center">
            <div className="px-3 py-1 rounded-full text-[10px] font-medium text-white" style={{ backgroundColor: BRAND }}>Yes!</div>
            <div className="px-3 py-1 rounded-full text-[10px] font-medium bg-gray-200">Maybe</div>
            <div className="px-3 py-1 rounded-full text-[10px] font-medium bg-gray-200">No</div>
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[10px]"><ChefHat className="h-3 w-3" style={{ color: BRAND }} /> Meal: Vegetarian</div>
          <div className="flex items-center gap-1.5 text-[10px]"><Hotel className="h-3 w-3" style={{ color: BRAND }} /> Hotel: Yes, 2 nights</div>
          <div className="flex items-center gap-1.5 text-[10px]"><Car className="h-3 w-3" style={{ color: BRAND }} /> Pickup: Airport</div>
        </div>
      </div>
    )},
    { title: "Live Dashboard", content: (
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-1.5">
          <div className="bg-green-50 rounded p-1.5 text-center">
            <div className="text-sm font-bold text-green-600">324</div>
            <div className="text-[8px] text-green-700">Confirmed</div>
          </div>
          <div className="bg-yellow-50 rounded p-1.5 text-center">
            <div className="text-sm font-bold text-yellow-600">89</div>
            <div className="text-[8px] text-yellow-700">Pending</div>
          </div>
          <div className="bg-red-50 rounded p-1.5 text-center">
            <div className="text-sm font-bold text-red-600">24</div>
            <div className="text-[8px] text-red-700">Declined</div>
          </div>
        </div>
        <div className="space-y-1">
          {["Sharma Family (4)", "Rajesh & Priya (2)", "Anita Kapoor (1)"].map((name, i) => (
            <div key={i} className="flex items-center gap-2 p-1.5 bg-gray-50 rounded text-[10px]">
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold" style={{ backgroundColor: BRAND }}>{name[0]}</div>
              <span className="flex-1 font-medium">{name}</span>
              <span className="text-green-600 text-[8px]">✓</span>
            </div>
          ))}
        </div>
        <div className="flex gap-1">
          <div className="flex-1 h-1.5 rounded-full bg-green-400" style={{ width: '70%' }}></div>
          <div className="h-1.5 rounded-full bg-yellow-400" style={{ width: '20%' }}></div>
          <div className="h-1.5 rounded-full bg-red-300" style={{ width: '10%' }}></div>
        </div>
      </div>
    )},
    { title: "WhatsApp Reminder", content: (
      <div className="space-y-2">
        <div className="bg-green-50 rounded-lg p-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <MessageSquare className="h-3 w-3 text-green-600" />
            <span className="text-[10px] font-medium text-green-700">WhatsApp</span>
          </div>
          <div className="bg-white rounded p-2 text-[10px] space-y-1">
            <p>🎉 <strong>RSVP Reminder</strong></p>
            <p>Hi Sharma Ji! 👋</p>
            <p>Friendly reminder about <strong>Priya & Rohit's Wedding</strong> on Dec 15!</p>
            <p>Please confirm: <span style={{ color: BRAND }}>knotvite.com/r/PR2026</span></p>
          </div>
        </div>
        <div className="bg-blue-50 rounded-lg p-2 text-center">
          <Bell className="h-4 w-4 mx-auto mb-1 text-blue-500" />
          <p className="text-[10px] font-medium text-blue-700">Auto-reminder sent!</p>
          <p className="text-[8px] text-blue-500">3 days before event</p>
        </div>
      </div>
    )},
  ];

  useEffect(() => {
    const timer = setInterval(() => setCurrentScreen((p) => (p + 1) % screens.length), 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative mx-auto" style={{ width: '220px' }}>
      <div className="bg-gray-900 rounded-[28px] p-2 shadow-2xl">
        <div className="bg-gray-900 rounded-t-[20px] pt-2 px-4 pb-1">
          <div className="w-16 h-1 bg-gray-700 rounded-full mx-auto" />
        </div>
        <div className="bg-white rounded-[20px] overflow-hidden" style={{ height: '340px' }}>
          <div className="px-3 py-2 border-b flex items-center justify-between" style={{ backgroundColor: BRAND_LIGHT }}>
            <span className="text-[10px] font-bold" style={{ color: BRAND_DARK }}>{screens[currentScreen].title}</span>
            <div className="flex gap-1">
              {screens.map((_, i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full transition-colors" style={{ backgroundColor: i === currentScreen ? BRAND : '#d1d5db' }} />
              ))}
            </div>
          </div>
          <div className="p-3 transition-opacity duration-500" key={currentScreen}>
            {screens[currentScreen].content}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function KnotViteLanding() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    document.title = "KnotVite — Smart Wedding RSVP Management | by AtBott";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Collect wedding RSVPs, manage guest lists, track meals & travel — all from one link. Start your 14-day free trial.');
    }
    return () => { document.title = "AtBott Wedding SaaS"; };
  }, []);

  const handleGetStarted = () => {
    if (user) {
      navigate("/knotvite/dashboard");
    } else {
      navigate("/register?plan=knotvite_basic&trial=14");
    }
  };

  const handleContactSales = () => {
    navigate("/contact");
  };

  const scrollToHowItWorks = () => {
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b" data-testid="knotvite-nav">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img src={atbottLogo} alt="AtBott" className="h-8 w-auto" />
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-1.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: BRAND }}>
                  <Heart className="h-4 w-4 text-white fill-white" />
                </div>
                <span className="font-semibold text-base text-gray-900">KnotVite</span>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-6 text-sm">
              <button onClick={scrollToHowItWorks} className="text-gray-600 hover:text-gray-900 transition-colors">How It Works</button>
              <a href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">Features</a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900 transition-colors">Pricing</a>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              {user ? (
                <Button onClick={() => navigate("/knotvite/dashboard")} style={{ backgroundColor: BRAND }} className="hover:brightness-110 text-white text-sm" data-testid="nav-dashboard-btn">
                  Dashboard
                </Button>
              ) : (
                <>
                  <Button variant="ghost" size="sm" onClick={() => navigate("/login")} className="text-sm" data-testid="nav-signin-btn">
                    Sign In
                  </Button>
                  <Button onClick={handleGetStarted} style={{ backgroundColor: BRAND }} className="hover:brightness-110 text-white text-sm" data-testid="nav-getstarted-btn">
                    Start Free Trial
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#e0f4f8] via-white to-[#f0fafb]" />
        <div className="absolute top-20 right-0 w-96 h-96 rounded-full opacity-10" style={{ backgroundColor: BRAND, filter: 'blur(80px)' }} />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full opacity-10" style={{ backgroundColor: BRAND, filter: 'blur(60px)' }} />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div className="space-y-6 sm:space-y-8 text-center lg:text-left">
              <div>
                <Badge className="mb-4 text-white border-0 px-3 py-1" style={{ backgroundColor: BRAND }} data-testid="badge-trial">
                  <Gift className="h-3 w-3 mr-1" /> 14-Day Free Trial — No Credit Card
                </Badge>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-gray-900 leading-tight">
                  Wedding RSVPs,{" "}
                  <span style={{ color: BRAND }}>Made Simple</span>
                </h1>
                <p className="text-base sm:text-lg lg:text-xl text-gray-600 mt-4 max-w-xl mx-auto lg:mx-0">
                  One link. All your guests. Real-time tracking of attendance, meals, hotel stays & travel — beautifully on any device.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <Button 
                  size="lg" 
                  onClick={handleGetStarted}
                  className="text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 text-white hover:brightness-110 shadow-lg"
                  style={{ backgroundColor: BRAND }}
                  data-testid="hero-cta-primary"
                >
                  Start Free 14-Day Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={scrollToHowItWorks}
                  className="text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 border-2"
                  data-testid="hero-cta-secondary"
                >
                  <Play className="mr-2 h-5 w-5" /> See How It Works
                </Button>
              </div>
              
              <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-sm text-gray-500 justify-center lg:justify-start">
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" style={{ color: BRAND }} /> No credit card required</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" style={{ color: BRAND }} /> Set up in 2 minutes</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" style={{ color: BRAND }} /> Works on all devices</span>
              </div>
            </div>
            
            <div className="flex justify-center lg:justify-end">
              <PhoneMockup />
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Stats */}
      <section className="py-10 sm:py-12" style={{ background: `linear-gradient(135deg, ${BRAND}, ${BRAND_DARK})` }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8">
            <AnimatedCounter target={5000} label="Guests Managed" suffix="+" />
            <AnimatedCounter target={200} label="Events Created" suffix="+" />
            <AnimatedCounter target={95} label="Response Rate" suffix="%" />
            <AnimatedCounter target={50} label="Happy Couples" suffix="+" />
          </div>
        </div>
      </section>

      {/* How It Works — Video + Animated */}
      <section id="how-it-works" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <Badge className="mb-3 text-white border-0" style={{ backgroundColor: BRAND }}>How It Works</Badge>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">
              From Guest List to Check-in — In 4 Easy Steps
            </h2>
            <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto">
              Set up your wedding RSVP in minutes, not hours. Here's how KnotVite makes it effortless.
            </p>
          </div>

          {/* Video Section */}
          <div className="max-w-4xl mx-auto mb-12 sm:mb-16">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border" style={{ aspectRatio: '16/9' }}>
              {showVideo ? (
                <div className="w-full h-full flex items-center justify-center bg-gray-900">
                  <div className="text-center text-white space-y-3 p-8">
                    <Play className="h-16 w-16 mx-auto opacity-50" />
                    <p className="text-lg font-medium">Demo Video Coming Soon</p>
                    <p className="text-sm text-gray-400">We're creating an amazing walkthrough for you</p>
                    <Button variant="outline" className="text-white border-white/30 hover:bg-white/10" onClick={() => setShowVideo(false)}>
                      Close Preview
                    </Button>
                  </div>
                </div>
              ) : (
                <div 
                  className="w-full h-full flex items-center justify-center cursor-pointer group"
                  style={{ background: `linear-gradient(135deg, ${BRAND_LIGHT}, white, ${BRAND_LIGHT})` }}
                  onClick={() => setShowVideo(true)}
                  data-testid="video-placeholder"
                >
                  <div className="text-center space-y-4">
                    <div className="relative">
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center mx-auto shadow-xl group-hover:scale-110 transition-transform text-white" style={{ backgroundColor: BRAND }}>
                        <Play className="h-10 w-10 sm:h-12 sm:w-12 ml-1" />
                      </div>
                      <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ backgroundColor: BRAND }} />
                    </div>
                    <div>
                      <p className="text-lg sm:text-xl font-bold text-gray-900">Watch KnotVite in Action</p>
                      <p className="text-sm text-gray-500">2 minute walkthrough</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Animated Steps */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-6 text-center">
            {STEPS.map((step, index) => (
              <AnimatedStep key={index} step={step} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#f8fbfc' }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <Badge className="mb-3 text-white border-0" style={{ backgroundColor: BRAND }}>Features</Badge>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">
              Everything You Need for Wedding RSVPs
            </h2>
            <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto">
              Powerful features designed to make guest management effortless for Indian weddings
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {FEATURES.map((feature, index) => (
              <Card 
                key={index} 
                className="relative overflow-hidden hover:shadow-lg transition-all duration-300 border-0 shadow-md bg-white group hover:-translate-y-1"
                data-testid={`feature-card-${index}`}
              >
                <CardContent className="p-5 sm:p-6">
                  <div className="flex items-start justify-between mb-3 sm:mb-4">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-colors" style={{ backgroundColor: BRAND_LIGHT }}>
                      <feature.icon className="h-5 w-5 sm:h-6 sm:w-6" style={{ color: BRAND }} />
                    </div>
                    {feature.badge && (
                      <Badge variant="secondary" className="text-white text-[10px]" style={{ backgroundColor: feature.badge === 'Premium' ? '#8b5cf6' : BRAND }}>
                        {feature.badge}
                      </Badge>
                    )}
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1.5 sm:mb-2">{feature.title}</h3>
                  <p className="text-sm text-gray-600">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <Badge className="mb-3 text-white border-0" style={{ backgroundColor: BRAND }}>Pricing</Badge>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto">
              Start with a free 14-day trial. Upgrade when you're ready — no surprises.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto">
            {PLANS.map((plan, index) => (
              <Card 
                key={index} 
                className={`relative overflow-hidden transition-all duration-300 hover:shadow-xl ${plan.highlight ? 'border-2 shadow-xl scale-[1.02]' : 'border hover:border-gray-300'}`}
                style={plan.highlight ? { borderColor: BRAND } : {}}
                data-testid={`pricing-${plan.name.toLowerCase()}`}
              >
                {plan.highlight && (
                  <div className="absolute -top-px left-0 right-0 h-1" style={{ backgroundColor: BRAND }} />
                )}
                {plan.trial && (
                  <div className="absolute top-3 right-3">
                    <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]">
                      <Clock className="h-3 w-3 mr-1" /> 14-Day Trial
                    </Badge>
                  </div>
                )}
                {plan.highlight && (
                  <div className="absolute top-3 right-3">
                    <Badge className="text-white border-0 text-[10px]" style={{ backgroundColor: BRAND }}>
                      <Star className="h-3 w-3 mr-1" /> Most Popular
                    </Badge>
                  </div>
                )}
                <CardContent className="p-6 sm:p-8">
                  <div className="mb-6">
                    <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">{plan.name}</h3>
                    <p className="text-sm text-gray-500 mb-4">{plan.description}</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl sm:text-4xl font-bold" style={plan.highlight ? { color: BRAND } : { color: '#111' }}>{plan.price}</span>
                      <span className="text-sm text-gray-500">/{plan.period}</span>
                    </div>
                  </div>
                  
                  <ul className="space-y-2.5 mb-8">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2.5 text-sm">
                        {feature.included ? (
                          <Check className="h-4 w-4 flex-shrink-0" style={{ color: BRAND }} />
                        ) : (
                          <X className="h-4 w-4 flex-shrink-0 text-gray-300" />
                        )}
                        <span className={feature.included ? "text-gray-700" : "text-gray-400"}>{feature.text}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <Button 
                    className={`w-full text-sm sm:text-base py-5 ${plan.highlight ? 'text-white hover:brightness-110 shadow-md' : ''}`}
                    style={plan.highlight ? { backgroundColor: BRAND } : {}}
                    variant={plan.ctaVariant}
                    size="lg"
                    onClick={plan.name === 'Premium' ? handleContactSales : handleGetStarted}
                    data-testid={`pricing-${plan.name.toLowerCase()}-cta`}
                  >
                    {plan.cta}
                    {plan.name !== 'Premium' && <ArrowRight className="ml-2 h-4 w-4" />}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#f8fbfc' }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <Badge className="mb-3 text-white border-0" style={{ backgroundColor: BRAND }}>Testimonials</Badge>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">
              Loved by Couples Across India
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
            {TESTIMONIALS.map((t, i) => (
              <Card key={i} className="border-0 shadow-md hover:shadow-lg transition-shadow bg-white" data-testid={`testimonial-${i}`}>
                <CardContent className="p-5 sm:p-6">
                  <div className="flex gap-0.5 mb-3">
                    {Array.from({ length: t.rating }).map((_, j) => (
                      <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm sm:text-base text-gray-700 mb-4 italic">"{t.text}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: BRAND }}>
                      {t.name.split(' ')[0][0]}
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-gray-900">{t.name}</div>
                      <div className="text-xs text-gray-500">{t.location}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-4">
            {[
              { q: "Do my guests need to download an app?", a: "No! Guests simply click the RSVP link and fill in their details on a beautiful web page. Works on any phone, tablet or computer." },
              { q: "Can I customize what information I collect?", a: "Yes. You can add custom fields for meal preference, hotel stay, airport pickup, dietary restrictions, plus-ones, and more." },
              { q: "How does the 14-day free trial work?", a: "Sign up with just your email. You get full access to the Basic plan for 14 days — no credit card needed. Upgrade anytime to Pro or Premium." },
              { q: "Can I send RSVP reminders via WhatsApp?", a: "Yes! With the Pro and Premium plans, you can send automated reminders via WhatsApp to guests who haven't responded yet." },
              { q: "Is my guest data secure?", a: "Absolutely. All data is encrypted and stored securely. We never share your guest information with anyone." },
            ].map((faq, i) => (
              <details key={i} className="group border rounded-xl overflow-hidden" data-testid={`faq-${i}`}>
                <summary className="flex items-center justify-between p-4 sm:p-5 cursor-pointer hover:bg-gray-50 transition-colors">
                  <span className="font-medium text-sm sm:text-base text-gray-900 pr-4">{faq.q}</span>
                  <ChevronDown className="h-5 w-5 text-gray-400 group-open:rotate-180 transition-transform flex-shrink-0" />
                </summary>
                <div className="px-4 sm:px-5 pb-4 sm:pb-5 text-sm text-gray-600">{faq.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8" style={{ background: `linear-gradient(135deg, ${BRAND}, ${BRAND_DARK})` }}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-3 sm:mb-4">
            Ready to Simplify Your Wedding RSVPs?
          </h2>
          <p className="text-base sm:text-lg text-white/80 mb-6 sm:mb-8 max-w-2xl mx-auto">
            Join hundreds of couples who trust KnotVite to manage their wedding guest list. Start your free trial today.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Button 
              size="lg" 
              onClick={handleGetStarted}
              className="bg-white hover:bg-gray-100 text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 shadow-lg"
              style={{ color: BRAND }}
              data-testid="final-cta-primary"
            >
              Start Free 14-Day Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => navigate("/")}
              className="text-white border-white/30 hover:bg-white/10 text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6"
              data-testid="final-cta-secondary"
            >
              Explore AtBott Platform
            </Button>
          </div>
        </div>
      </section>

      {/* Upsell to AtBott */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 bg-gray-50 border-t">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <img src={atbottLogo} alt="AtBott" className="h-6 w-auto" />
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
            Need Full Wedding Business Management?
          </h3>
          <p className="text-sm sm:text-base text-gray-600 mb-6 max-w-xl mx-auto">
            AtBott platform offers CRM, invoicing, vendor management, team scheduling, and more — perfect for wedding planners and event companies.
          </p>
          <Button 
            variant="outline" 
            onClick={() => navigate("/")} 
            className="border-2"
            data-testid="upsell-atbott-cta"
          >
            Explore AtBott Platform <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6 lg:px-8 border-t bg-white" data-testid="knotvite-footer">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="w-6 h-6 rounded flex items-center justify-center text-white" style={{ backgroundColor: BRAND }}>
                <Heart className="h-3 w-3 fill-white" />
              </div>
              KnotVite by AtBott Solutions © 2026
            </div>
            <div className="flex items-center gap-4 sm:gap-6 text-sm">
              <a href="/privacy-policy" className="text-gray-600 hover:transition-colors" style={{ '--hover-color': BRAND } as any} data-testid="footer-privacy">
                Privacy Policy
              </a>
              <a href="/terms" className="text-gray-600 hover:transition-colors" data-testid="footer-terms">
                Terms
              </a>
              <a href="/refund-policy" className="text-gray-600 hover:transition-colors" data-testid="footer-refund">
                Refund Policy
              </a>
              <a href="/contact" className="text-gray-600 hover:transition-colors" data-testid="footer-contact">
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

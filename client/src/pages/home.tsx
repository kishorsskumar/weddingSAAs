import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { PublicLayout } from "@/components/public-layout";
import { useAuth } from "@/context/auth-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  Users, 
  Calendar, 
  Package, 
  Bell, 
  CreditCard, 
  BarChart3,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  LayoutDashboard,
  MessageSquare,
  AlertTriangle,
  Clock,
  FileText,
  Briefcase,
  Camera,
  Building2,
  Heart,
  Play,
  ChevronRight,
  Star,
  Quote,
  Mail,
  Phone,
  MapPin,
  Target,
  Shield,
  Zap,
  UserCheck,
  ClipboardList,
  TrendingUp,
  DollarSign,
  Globe,
  Loader2
} from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

const problemCards = [
  { icon: AlertTriangle, title: "Leads Getting Missed", description: "Potential clients slip through the cracks with scattered follow-ups" },
  { icon: MessageSquare, title: "Clients Asking Repeated Updates", description: "Spending hours answering the same questions over WhatsApp" },
  { icon: Users, title: "Team Coordination Confusion", description: "Miscommunication between team members causing delays" },
  { icon: Calendar, title: "Vendor Schedule Clashes", description: "Double bookings and conflicts with vendor availability" },
  { icon: DollarSign, title: "Payment Tracking Chaos", description: "Lost track of who paid what and when payments are due" },
];

const solutionColumns = [
  {
    title: "Lead Management",
    icon: Target,
    features: ["Pipeline tracking", "Automated follow-ups", "Lead assignment", "Analytics dashboard"]
  },
  {
    title: "Client Portal",
    icon: Users,
    features: ["Event timeline", "Document sharing", "Payment tracking", "Client checklist", "Communication hub"]
  },
  {
    title: "Event Calendar",
    icon: Calendar,
    features: ["Event scheduling", "Vendor coordination", "Team scheduling", "Conflict detection", "Milestone tracking"]
  }
];

const howItWorks = [
  { step: "01", title: "Capture Leads", description: "Collect inquiries from website, WhatsApp, or referrals automatically", icon: Target },
  { step: "02", title: "Convert Clients", description: "Send proposals, track negotiations, and close deals faster", icon: UserCheck },
  { step: "03", title: "Manage Event", description: "Plan timelines, coordinate vendors, and track milestones", icon: ClipboardList },
  { step: "04", title: "Deliver Experience", description: "Execute flawlessly with real-time team coordination", icon: Star },
];

const industries = [
  { icon: Heart, title: "Wedding Planners", description: "End-to-end wedding management" },
  { icon: Building2, title: "Event Management Companies", description: "Corporate and social events" },
  { icon: Camera, title: "Photography Agencies", description: "Booking and client management" },
  { icon: Sparkles, title: "Decor Companies", description: "Inventory and project tracking" },
  { icon: Briefcase, title: "Corporate Event Teams", description: "Internal event coordination" },
];

const differentiators = [
  "Event-specific CRM designed for your workflow",
  "Client experience portal for transparency",
  "WhatsApp workflow integration ready",
  "Multi-event tracking and management",
  "Vendor milestone visibility and payments",
];

const pricingPlans = [
  {
    name: "Starter",
    price: "₹999",
    period: "/month",
    description: "Perfect for solo planners",
    features: ["Up to 10 events/month", "Basic CRM", "Email support", "1 team member"],
    highlighted: false
  },
  {
    name: "Growth",
    price: "₹2,499",
    period: "/month",
    description: "For growing businesses",
    features: ["Unlimited events", "Full CRM + Client Portal", "WhatsApp integration", "5 team members", "Priority support"],
    highlighted: true
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For large agencies",
    features: ["Everything in Growth", "Unlimited team members", "Custom integrations", "Dedicated account manager", "SLA guarantee"],
    highlighted: false
  }
];

const testimonials = [
  { name: "Priya Sharma", company: "Dream Weddings Co.", quote: "Atbott transformed how we manage our wedding clients. No more Excel chaos!", rating: 5 },
  { name: "Rahul Menon", company: "Eventify Agency", quote: "The client portal feature alone saved us hours of back-and-forth communication.", rating: 5 },
  { name: "Sneha Patel", company: "Captured Moments Studio", quote: "Finally, a CRM that understands event businesses. Highly recommend!", rating: 5 },
];

const faqs = [
  { question: "Is this only for wedding planners?", answer: "No! Atbott is designed for all event professionals including corporate event planners, photography agencies, decor companies, and any business that manages client events." },
  { question: "Can I migrate from Excel?", answer: "Absolutely! We provide free migration support to help you import your existing client data, event history, and contacts from Excel or other systems." },
  { question: "Do clients need a mobile app?", answer: "No app needed. Clients access their portal through any web browser on desktop or mobile. It works seamlessly across all devices." },
  { question: "Does it support multiple events?", answer: "Yes! You can manage unlimited events simultaneously with our calendar view, conflict detection, and team assignment features." },
  { question: "Do you provide onboarding help?", answer: "Every paid plan includes personalized onboarding sessions to help you set up your account, import data, and train your team." },
];

export default function HomePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [demoFormData, setDemoFormData] = useState({
    name: "",
    companyName: "",
    email: "",
    phone: "",
    businessType: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  useEffect(() => {
    document.title = "Atbott - Close More Event Clients Without Losing Leads";
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleDemoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    toast({ title: "Demo request submitted!", description: "We'll contact you within 24 hours." });
    setDemoFormData({ name: "", companyName: "", email: "", phone: "", businessType: "" });
    setIsSubmitting(false);
  };

  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-white py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Sparkles className="h-4 w-4" />
                CRM + Client Portal + Event Calendar
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
                Close More Event Clients{" "}
                <span className="bg-gradient-to-r from-green-700 to-emerald-700 bg-clip-text text-transparent">Without Losing Leads</span>
              </h1>
              <p className="text-lg sm:text-xl text-gray-600 mb-8 max-w-xl">
                Lead Management, Client Portal, and Event Calendar built for event planners and wedding businesses.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <Link href="/#demo">
                  <Button size="lg" className="w-full sm:w-auto text-base px-8 bg-gradient-to-r from-green-700 to-emerald-700 hover:from-green-800 hover:to-emerald-800">
                    Book Live Demo
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto text-base px-8 border-2">
                    Start Free Trial
                  </Button>
                </Link>
              </div>
              <div className="flex items-center gap-6 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>No credit card required</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>14-day free trial</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative mt-12 lg:mt-0"
            >
              <motion.div
                animate={{ y: [-6, 6, -6] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="relative"
              >
                <div className="bg-gradient-to-br from-green-100 to-emerald-100 rounded-2xl p-4 shadow-2xl">
                  <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                    <div className="bg-gradient-to-r from-green-700 to-emerald-700 px-4 py-3 flex items-center gap-2">
                      <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-400"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                        <div className="w-3 h-3 rounded-full bg-green-400"></div>
                      </div>
                      <span className="text-white/80 text-sm ml-2">Atbott Dashboard</span>
                    </div>
                    <div className="p-4 space-y-4">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-green-50 rounded-lg p-3 text-center">
                          <div className="text-xl font-bold text-green-700">24</div>
                          <div className="text-xs text-green-700">Active Leads</div>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-3 text-center">
                          <div className="text-xl font-bold text-blue-600">12</div>
                          <div className="text-xs text-blue-700">This Month</div>
                        </div>
                        <div className="bg-green-50 rounded-lg p-3 text-center">
                          <div className="text-xl font-bold text-green-600">₹8.5L</div>
                          <div className="text-xs text-green-700">Revenue</div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-2">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                            <Users className="h-4 w-4 text-green-700" />
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium">Sharma Wedding</div>
                            <div className="text-xs text-gray-500">March 15, 2026</div>
                          </div>
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Confirmed</span>
                        </div>
                        <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-2">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <Calendar className="h-4 w-4 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium">Patel Reception</div>
                            <div className="text-xs text-gray-500">April 8, 2026</div>
                          </div>
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">Planning</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
              <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-green-200/50 rounded-full blur-2xl"></div>
              <div className="absolute -top-4 -left-4 w-32 h-32 bg-blue-200/50 rounded-full blur-2xl"></div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-20 lg:py-28 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Still Managing Clients in Excel, WhatsApp and Diaries?
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              We understand the challenges event professionals face every day
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {problemCards.map((card, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-shadow"
              >
                <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mb-4">
                  <card.icon className="h-6 w-6 text-red-500" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{card.title}</h3>
                <p className="text-sm text-gray-600">{card.description}</p>
              </motion.div>
            ))}
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center text-lg text-gray-600 mt-12 font-medium"
          >
            Event planning is stressful. <span className="text-green-700">Your software shouldn't be.</span>
          </motion.p>
        </div>
      </section>

      {/* Solution Section */}
      <section id="product" className="py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Everything You Need To Run Your Event Business
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              One platform to manage leads, clients, and events seamlessly
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {solutionColumns.map((column, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-8 border border-green-100"
              >
                <div className="w-14 h-14 bg-gradient-to-br from-green-700 to-emerald-700 rounded-xl flex items-center justify-center mb-6">
                  <column.icon className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">{column.title}</h3>
                <ul className="space-y-3">
                  {column.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-3 text-gray-700">
                      <CheckCircle2 className="h-5 w-5 text-green-700 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo Video Section */}
      <section id="features" className="py-20 lg:py-28 bg-gradient-to-br from-green-900 to-emerald-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              See Atbott In Action
            </h2>
            <p className="text-lg text-green-200 mb-12 max-w-2xl mx-auto">
              Watch how event professionals manage their entire business with Atbott
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative aspect-video bg-black/20 rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center group cursor-pointer"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-green-700/20 to-emerald-700/20"></div>
            <div className="relative z-10 w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
              <Play className="h-8 w-8 text-green-700 ml-1" />
            </div>
            <p className="absolute bottom-6 text-white/60 text-sm">Click to watch demo video</p>
          </motion.div>

          <Button size="lg" variant="outline" className="mt-8 text-white border-white/30 hover:bg-white/10">
            Watch Full Demo
            <Play className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              From first inquiry to event delivery in 4 simple steps
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {howItWorks.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="relative"
              >
                <div className="text-center">
                  <div className="relative inline-block mb-6">
                    <div className="w-20 h-20 bg-gradient-to-br from-green-100 to-emerald-100 rounded-2xl flex items-center justify-center">
                      <step.icon className="h-10 w-10 text-green-700" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-r from-green-700 to-emerald-700 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {step.step}
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{step.title}</h3>
                  <p className="text-sm text-gray-600">{step.description}</p>
                </div>
                {index < howItWorks.length - 1 && (
                  <div className="hidden lg:block absolute top-10 left-full w-full">
                    <ChevronRight className="h-6 w-6 text-green-300 mx-auto" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Industry Focus */}
      <section className="py-20 lg:py-28 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Built For Event Professionals
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Trusted by businesses across the event industry
            </p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {industries.map((industry, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="bg-white rounded-2xl p-6 text-center shadow-sm border border-gray-100 hover:shadow-lg hover:border-green-200 transition-all cursor-pointer"
              >
                <div className="w-14 h-14 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <industry.icon className="h-7 w-7 text-green-700" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{industry.title}</h3>
                <p className="text-xs text-gray-500">{industry.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Differentiation */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">
                Why Event Businesses Choose Atbott
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                Unlike generic CRMs, Atbott is purpose-built for the event industry with features that actually matter.
              </p>
              <ul className="space-y-4">
                {differentiators.map((item, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center gap-4"
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-green-700 to-emerald-700 rounded-lg flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-gray-700 font-medium">{item}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="bg-gradient-to-br from-green-100 to-emerald-100 rounded-3xl p-8">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl p-4 shadow-sm">
                    <Zap className="h-8 w-8 text-green-700 mb-2" />
                    <div className="text-2xl font-bold text-gray-900">3x</div>
                    <div className="text-sm text-gray-500">Faster lead response</div>
                  </div>
                  <div className="bg-white rounded-xl p-4 shadow-sm">
                    <TrendingUp className="h-8 w-8 text-blue-600 mb-2" />
                    <div className="text-2xl font-bold text-gray-900">40%</div>
                    <div className="text-sm text-gray-500">Higher conversion</div>
                  </div>
                  <div className="bg-white rounded-xl p-4 shadow-sm">
                    <Clock className="h-8 w-8 text-green-600 mb-2" />
                    <div className="text-2xl font-bold text-gray-900">10hrs</div>
                    <div className="text-sm text-gray-500">Saved per week</div>
                  </div>
                  <div className="bg-white rounded-xl p-4 shadow-sm">
                    <Shield className="h-8 w-8 text-orange-600 mb-2" />
                    <div className="text-2xl font-bold text-gray-900">100%</div>
                    <div className="text-sm text-gray-500">Data secure</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="py-20 lg:py-28 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Choose the plan that fits your business
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {pricingPlans.map((plan, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className={`relative bg-white rounded-2xl p-8 shadow-sm border-2 ${
                  plan.highlighted 
                    ? "border-green-600 shadow-lg scale-105" 
                    : "border-gray-100"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-green-700 to-emerald-700 text-white text-sm font-medium px-4 py-1 rounded-full">
                    Most Popular
                  </div>
                )}
                <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                <p className="text-sm text-gray-500 mb-4">{plan.description}</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-gray-500">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                      <CheckCircle2 className="h-4 w-4 text-green-700" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button 
                  className={`w-full ${
                    plan.highlighted 
                      ? "bg-gradient-to-r from-green-700 to-emerald-700 hover:from-green-800 hover:to-emerald-800" 
                      : ""
                  }`}
                  variant={plan.highlighted ? "default" : "outline"}
                >
                  Get Started
                </Button>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link href="/pricing">
              <Button variant="link" className="text-green-700">
                View Full Pricing Details
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Loved By Event Professionals
            </h2>
          </motion.div>

          <div className="relative">
            <motion.div
              key={currentTestimonial}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-3xl p-8 lg:p-12 text-center"
            >
              <Quote className="h-12 w-12 text-green-300 mx-auto mb-6" />
              <p className="text-xl lg:text-2xl text-gray-700 mb-8 font-medium">
                "{testimonials[currentTestimonial].quote}"
              </p>
              <div className="flex items-center justify-center gap-1 mb-4">
                {[...Array(testimonials[currentTestimonial].rating)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">
                  {testimonials[currentTestimonial].name.charAt(0)}
                </span>
              </div>
              <h4 className="font-semibold text-gray-900">{testimonials[currentTestimonial].name}</h4>
              <p className="text-sm text-gray-500">{testimonials[currentTestimonial].company}</p>
            </motion.div>

            <div className="flex justify-center gap-2 mt-6">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentTestimonial(index)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentTestimonial ? "bg-green-700" : "bg-gray-300"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Demo Booking Form */}
      <section id="demo" className="py-20 lg:py-28 bg-gradient-to-br from-green-900 to-emerald-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="text-white"
            >
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                Ready to Transform Your Event Business?
              </h2>
              <p className="text-lg text-green-200 mb-8">
                Schedule a personalized demo and see how Atbott can help you close more clients and deliver better events.
              </p>
              <ul className="space-y-4">
                <li className="flex items-center gap-3 text-green-100">
                  <CheckCircle2 className="h-5 w-5 text-green-400" />
                  30-minute personalized walkthrough
                </li>
                <li className="flex items-center gap-3 text-green-100">
                  <CheckCircle2 className="h-5 w-5 text-green-400" />
                  See features tailored to your business
                </li>
                <li className="flex items-center gap-3 text-green-100">
                  <CheckCircle2 className="h-5 w-5 text-green-400" />
                  Get answers to all your questions
                </li>
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <form onSubmit={handleDemoSubmit} className="bg-white rounded-2xl p-8 shadow-xl">
                <h3 className="text-xl font-bold text-gray-900 mb-6">Schedule Your Demo</h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Your Name</Label>
                    <Input
                      id="name"
                      value={demoFormData.name}
                      onChange={(e) => setDemoFormData({ ...demoFormData, name: e.target.value })}
                      required
                      data-testid="input-demo-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input
                      id="companyName"
                      value={demoFormData.companyName}
                      onChange={(e) => setDemoFormData({ ...demoFormData, companyName: e.target.value })}
                      required
                      data-testid="input-demo-company"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={demoFormData.email}
                      onChange={(e) => setDemoFormData({ ...demoFormData, email: e.target.value })}
                      required
                      data-testid="input-demo-email"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={demoFormData.phone}
                      onChange={(e) => setDemoFormData({ ...demoFormData, phone: e.target.value })}
                      required
                      data-testid="input-demo-phone"
                    />
                  </div>
                  <div>
                    <Label htmlFor="businessType">Business Type</Label>
                    <Select
                      value={demoFormData.businessType}
                      onValueChange={(value) => setDemoFormData({ ...demoFormData, businessType: value })}
                    >
                      <SelectTrigger data-testid="select-demo-business-type">
                        <SelectValue placeholder="Select your business type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="wedding_planner">Wedding Planner</SelectItem>
                        <SelectItem value="event_company">Event Management Company</SelectItem>
                        <SelectItem value="photography">Photography Agency</SelectItem>
                        <SelectItem value="decor">Decor Company</SelectItem>
                        <SelectItem value="corporate">Corporate Events</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-green-700 to-emerald-700 hover:from-green-800 hover:to-emerald-800"
                    disabled={isSubmitting}
                    data-testid="button-submit-demo"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        Schedule Demo
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Frequently Asked Questions
            </h2>
          </motion.div>

          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="bg-gray-50 rounded-xl px-6 border-0"
              >
                <AccordionTrigger className="text-left font-medium text-gray-900 hover:no-underline py-5">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-gray-600 pb-5">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Final CTA Banner */}
      <section className="py-20 lg:py-28 bg-gradient-to-br from-green-700 to-emerald-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
              Stop Losing Event Leads.<br />Start Scaling Your Business.
            </h2>
            <p className="text-lg text-green-100 mb-10 max-w-2xl mx-auto">
              Join hundreds of event professionals who've transformed their business with Atbott
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup">
                <Button size="lg" className="w-full sm:w-auto text-base px-10 bg-white text-green-700 hover:bg-gray-100">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/#demo">
                <Button size="lg" variant="outline" className="w-full sm:w-auto text-base px-10 text-white border-white/50 hover:bg-white/10">
                  Book Demo
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </PublicLayout>
  );
}

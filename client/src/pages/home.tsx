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
    features: [
      "Up to 10 active events per month",
      "Lead Management System",
      "Basic Client Portal (view-only)",
      "Event Calendar",
      "1 Team Member",
      "Email Support"
    ],
    highlighted: false
  },
  {
    name: "Growth",
    price: "₹2,499",
    period: "/month",
    description: "For growing businesses",
    features: [
      "Unlimited events",
      "Full Lead Management System",
      "Full Client Portal",
      "Event Calendar + Milestone Tracking",
      "Client Payment & Installment Tracking",
      "Automated Follow-up Reminders",
      "Revenue & Lead Analytics Dashboard",
      "Custom Branding (Logo in portal)",
      "5 Team Members",
      "Priority Support"
    ],
    highlighted: true
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For large agencies",
    features: [
      "Everything in Growth",
      "Unlimited Team Members",
      "WhatsApp Integration",
      "API Access & Custom Integrations",
      "Vendor Management Module",
      "Multi-Branch Management",
      "Advanced Reporting & Data Export",
      "Dedicated Account Manager",
      "SLA Guarantee",
      "Data Migration Assistance"
    ],
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
    try {
      const res = await fetch("/api/demo-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(demoFormData),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit");
      }
      toast({ title: "Demo request submitted!", description: "We'll contact you within 24 hours." });
      setDemoFormData({ name: "", companyName: "", email: "", phone: "", businessType: "" });
    } catch (err: any) {
      toast({ title: "Something went wrong", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PublicLayout>
      <section className="relative overflow-hidden py-28 lg:py-40 bg-white">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#2FA4BC]/[0.03] rounded-full blur-3xl"></div>
          <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-[#2FA4BC]/[0.03] rounded-full blur-3xl"></div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 bg-[#2FA4BC]/10 text-[#2590a6] px-5 py-2.5 rounded-full text-sm font-semibold mb-8 border border-[#2FA4BC]/20/60">
                <Sparkles className="h-4 w-4" />
                Built for Wedding Professionals
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold text-slate-800 leading-[1.1] mb-6 tracking-tight">
                Plan Events{" "}
                <span className="text-[#2FA4BC]">Smarter</span>
                ,{" "}Not Harder
              </h1>
              <p className="text-lg sm:text-xl text-slate-500 mb-10 max-w-xl leading-relaxed">
                Lead Management, Client Portal, and Event Calendar built for event planners and wedding businesses.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mb-10">
                <Link href="/demo">
                  <Button size="lg" className="w-full sm:w-auto text-base px-8 py-6 bg-[#2FA4BC] hover:bg-[#2590a6] shadow-lg shadow-[#2FA4BC]/25 text-white font-semibold" data-testid="button-hero-demo">
                    Book Live Demo
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/signup?plan=growth">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto text-base px-8 py-6 border-2 border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold" data-testid="button-hero-trial">
                    Start Free Trial
                  </Button>
                </Link>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-sm text-slate-400">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#2FA4BC]" />
                  <span>No credit card required</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#2FA4BC]" />
                  <span>14-day free trial</span>
                </div>
              </div>
              <div className="mt-8 pt-6 border-t border-slate-200/60">
                <p className="text-sm text-slate-400 mb-1">Trusted by 50+ Event Professionals</p>
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                  <span className="text-sm text-slate-500 ml-2">4.8/5 average rating</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative mt-12 lg:mt-0"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#2FA4BC]/10 to-[#2FA4BC]/5 rounded-3xl blur-2xl scale-105"></div>
              <motion.div
                animate={{ y: [-4, 4, -4] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                className="relative"
              >
                <div className="bg-white rounded-[20px] p-1.5 shadow-2xl shadow-slate-900/10 border border-slate-200/60">
                  <div className="bg-white rounded-2xl overflow-hidden border border-slate-100">
                    <div className="flex">
                      <div className="w-44 bg-slate-50 border-r border-slate-100 p-4 hidden sm:block">
                        <div className="flex items-center gap-2 mb-6">
                          <div className="w-8 h-8 rounded-lg bg-[#2FA4BC] flex items-center justify-center">
                            <span className="text-white font-bold text-sm">A</span>
                          </div>
                          <span className="font-semibold text-slate-800 text-sm">Dashboard</span>
                        </div>
                        <nav className="space-y-1">
                          {["Dashboard", "Leads", "Clients", "Events", "Calendar", "Finance", "Team"].map((item, i) => (
                            <div key={item} className={`px-3 py-2 rounded-lg text-xs font-medium ${i === 0 ? "bg-[#2FA4BC]/10 text-[#2FA4BC]" : "text-slate-500"}`}>
                              {item}
                            </div>
                          ))}
                        </nav>
                      </div>
                      <div className="flex-1 p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-bold text-slate-800 text-base">Dashboard</h3>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-100"></div>
                            <div className="w-7 h-7 rounded-full bg-slate-200"></div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2.5 mb-4">
                          <div className="bg-[#2FA4BC]/5 rounded-xl p-3 border border-[#2FA4BC]/10">
                            <div className="text-[10px] text-slate-500 mb-1">Active Leads</div>
                            <div className="text-lg font-bold text-[#2FA4BC]">24</div>
                          </div>
                          <div className="bg-[#2FA4BC] rounded-xl p-3">
                            <div className="text-[10px] text-white/70 mb-1">Revenue</div>
                            <div className="text-lg font-bold text-white">₹8.5L</div>
                          </div>
                          <div className="bg-[#2FA4BC]/5 rounded-xl p-3 border border-[#2FA4BC]/10">
                            <div className="text-[10px] text-slate-500 mb-1">Events</div>
                            <div className="text-lg font-bold text-[#2FA4BC]">12</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="text-xs font-semibold text-slate-700 mb-2">Upcoming Weddings</div>
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2 bg-[#2FA4BC]/5 rounded-lg p-2 border border-[#2FA4BC]/10">
                                <div className="w-1 h-8 rounded-full bg-[#2FA4BC]"></div>
                                <div>
                                  <div className="text-[11px] font-semibold text-slate-800">Sharma Wedding</div>
                                  <div className="text-[10px] text-slate-400">March 15, 2026</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 bg-amber-50 rounded-lg p-2 border border-amber-100">
                                <div className="w-1 h-8 rounded-full bg-amber-400"></div>
                                <div>
                                  <div className="text-[11px] font-semibold text-slate-800">Patel Reception</div>
                                  <div className="text-[10px] text-slate-400">April 8, 2026</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 bg-blue-50 rounded-lg p-2 border border-blue-100">
                                <div className="w-1 h-8 rounded-full bg-blue-400"></div>
                                <div>
                                  <div className="text-[11px] font-semibold text-slate-800">Menon Engagement</div>
                                  <div className="text-[10px] text-slate-400">April 20, 2026</div>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-slate-700 mb-2">Recent Clients</div>
                            <div className="space-y-1.5">
                              {[
                                { name: "Priya Sharma", status: "Confirmed", color: "text-emerald-600 bg-emerald-50" },
                                { name: "Rahul Patel", status: "Planning", color: "text-amber-600 bg-amber-50" },
                                { name: "Sneha Menon", status: "New Lead", color: "text-blue-600 bg-blue-50" },
                              ].map((client) => (
                                <div key={client.name} className="flex items-center justify-between bg-slate-50 rounded-lg p-2 border border-slate-100">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
                                      <span className="text-[9px] font-bold text-slate-500">{client.name.charAt(0)}</span>
                                    </div>
                                    <span className="text-[11px] font-medium text-slate-700">{client.name}</span>
                                  </div>
                                  <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${client.color}`}>{client.status}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-28 lg:py-36 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-4">
              Still Managing Clients in Excel, WhatsApp and Diaries?
            </h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
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
                className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all hover:-translate-y-0.5"
              >
                <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mb-4">
                  <card.icon className="h-6 w-6 text-red-400" />
                </div>
                <h3 className="font-semibold text-slate-800 mb-2">{card.title}</h3>
                <p className="text-sm text-slate-500">{card.description}</p>
              </motion.div>
            ))}
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center text-lg text-slate-500 mt-14 font-medium"
          >
            Event planning is stressful. <span className="text-[#2FA4BC] font-semibold">Your software shouldn't be.</span>
          </motion.p>
        </div>
      </section>

      <section id="product" className="py-28 lg:py-36 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-4">
              Everything You Need To Run Your Event Business
            </h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
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
                className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm hover:shadow-lg transition-all hover:-translate-y-1"
              >
                <div className="w-14 h-14 bg-[#2FA4BC] rounded-xl flex items-center justify-center mb-6 shadow-sm shadow-[#2FA4BC]/20">
                  <column.icon className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-4">{column.title}</h3>
                <ul className="space-y-3">
                  {column.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-3 text-slate-600">
                      <CheckCircle2 className="h-5 w-5 text-[#2FA4BC] flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="py-28 lg:py-36" style={{ background: "linear-gradient(180deg, #ecfeff 0%, #fafafa 100%)" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-4">
              See Atbott In Action
            </h2>
            <p className="text-lg text-slate-500 mb-12 max-w-2xl mx-auto">
              Watch how event professionals manage their entire business with Atbott
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative aspect-video bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 flex items-center justify-center group cursor-pointer shadow-lg shadow-slate-200/50"
          >
            <div className="relative z-10 w-20 h-20 bg-[#2FA4BC] rounded-full flex items-center justify-center shadow-xl shadow-[#2FA4BC]/30 group-hover:scale-110 transition-transform">
              <Play className="h-8 w-8 text-white ml-1" />
            </div>
            <p className="absolute bottom-6 text-slate-400 text-sm">Click to watch demo video</p>
          </motion.div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
            <Button size="lg" variant="outline" className="border-2 border-slate-200 text-slate-700 hover:bg-slate-50">
              Watch Full Demo
              <Play className="ml-2 h-4 w-4" />
            </Button>
            <Link href="/demo">
              <Button size="lg" className="bg-[#2FA4BC] hover:bg-[#2590a6] shadow-lg shadow-[#2FA4BC]/20 text-white font-semibold">
                Book Live Demo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-28 lg:py-36 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-4">
              How It Works
            </h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              From first inquiry to event delivery in 4 simple steps
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
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
                    <div className="w-20 h-20 bg-[#2FA4BC]/5 rounded-2xl flex items-center justify-center border border-[#2FA4BC]/15/60">
                      <step.icon className="h-10 w-10 text-[#2FA4BC]" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-8 h-8 bg-[#2FA4BC] rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md shadow-[#2FA4BC]/30">
                      {step.step}
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2">{step.title}</h3>
                  <p className="text-sm text-slate-500">{step.description}</p>
                </div>
                {index < howItWorks.length - 1 && (
                  <div className="hidden lg:block absolute top-10 left-full w-full">
                    <ChevronRight className="h-6 w-6 text-slate-300 mx-auto" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-28 lg:py-36 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-4">
              Built For Event Professionals
            </h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
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
                className="bg-white rounded-2xl p-6 text-center shadow-sm border border-slate-100 hover:shadow-md hover:border-[#2FA4BC]/20 transition-all cursor-pointer hover:-translate-y-0.5"
              >
                <div className="w-14 h-14 bg-[#2FA4BC]/5 rounded-xl flex items-center justify-center mx-auto mb-4 border border-[#2FA4BC]/15/60">
                  <industry.icon className="h-7 w-7 text-[#2FA4BC]" />
                </div>
                <h3 className="font-semibold text-slate-800 mb-1">{industry.title}</h3>
                <p className="text-xs text-slate-500">{industry.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-28 lg:py-36 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-6">
                Why Event Businesses Choose Atbott
              </h2>
              <p className="text-lg text-slate-500 mb-8">
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
                    <div className="w-8 h-8 bg-[#2FA4BC] rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm shadow-[#2FA4BC]/20">
                      <CheckCircle2 className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-slate-600 font-medium">{item}</span>
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
              <div className="grid grid-cols-2 gap-5">
                <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <Zap className="h-8 w-8 text-[#2FA4BC] mb-3" />
                  <div className="text-3xl font-bold text-slate-800">3x</div>
                  <div className="text-sm text-slate-500 mt-1">Faster lead response</div>
                </div>
                <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <TrendingUp className="h-8 w-8 text-[#2FA4BC] mb-3" />
                  <div className="text-3xl font-bold text-slate-800">40%</div>
                  <div className="text-sm text-slate-500 mt-1">Higher conversion</div>
                </div>
                <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <Clock className="h-8 w-8 text-[#2FA4BC] mb-3" />
                  <div className="text-3xl font-bold text-slate-800">10hrs</div>
                  <div className="text-sm text-slate-500 mt-1">Saved per week</div>
                </div>
                <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <Shield className="h-8 w-8 text-[#2FA4BC] mb-3" />
                  <div className="text-3xl font-bold text-slate-800">100%</div>
                  <div className="text-sm text-slate-500 mt-1">Data secure</div>
                </div>
              </div>
              <p className="text-xs text-slate-400 text-center mt-4">Based on early customer data</p>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-28 lg:py-36 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
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
                className={`relative bg-white rounded-2xl p-8 border ${
                  plan.highlighted 
                    ? "border-[#2FA4BC]/30 shadow-xl shadow-[#2FA4BC]/10 scale-105" 
                    : "border-slate-100 shadow-sm"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#2FA4BC] text-white text-sm font-semibold px-5 py-1.5 rounded-full shadow-md shadow-[#2FA4BC]/30">
                    Most Popular
                  </div>
                )}
                <h3 className="text-xl font-bold text-slate-800 mb-2">{plan.name}</h3>
                <p className="text-sm text-slate-500 mb-4">{plan.description}</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-slate-800">{plan.price}</span>
                  <span className="text-slate-400">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-slate-600">
                      <CheckCircle2 className="h-4 w-4 text-[#2FA4BC]" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link href={
                  plan.name === "Enterprise" ? "/contact-enterprise" :
                  plan.name === "Growth" ? "/signup?plan=growth" :
                  "/signup?plan=starter"
                }>
                  <Button 
                    className={`w-full ${
                      plan.highlighted 
                        ? "bg-[#2FA4BC] hover:bg-[#2590a6] shadow-md shadow-[#2FA4BC]/20 text-white font-semibold" 
                        : "border-2 border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                    variant={plan.highlighted ? "default" : "outline"}
                    data-testid={`button-pricing-${plan.name.toLowerCase()}`}
                  >
                    {plan.name === "Enterprise" ? "Contact Sales" : "Get Started"}
                  </Button>
                </Link>
              </motion.div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 mt-10 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#2FA4BC]" />
              No setup fees
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#2FA4BC]" />
              Free onboarding
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#2FA4BC]" />
              Cancel anytime
            </div>
          </div>

          <div className="text-center mt-8">
            <Link href="/pricing">
              <Button variant="link" className="text-[#2FA4BC] hover:text-[#2590a6] font-semibold">
                View Full Pricing Details
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-28 lg:py-36 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-4">
              Loved By Event Professionals
            </h2>
          </motion.div>

          <div className="relative">
            <motion.div
              key={currentTestimonial}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white rounded-3xl p-10 lg:p-14 text-center border border-slate-100 shadow-lg shadow-slate-100/50"
            >
              <Quote className="h-10 w-10 text-[#2FA4BC]/20 mx-auto mb-8" />
              <p className="text-xl lg:text-2xl text-slate-700 mb-8 font-medium leading-relaxed">
                "{testimonials[currentTestimonial].quote}"
              </p>
              <div className="flex items-center justify-center gap-1 mb-4">
                {[...Array(testimonials[currentTestimonial].rating)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <div className="w-14 h-14 bg-[#2FA4BC] rounded-full flex items-center justify-center mx-auto mb-4 shadow-md shadow-[#2FA4BC]/20">
                <span className="text-xl font-bold text-white">
                  {testimonials[currentTestimonial].name.charAt(0)}
                </span>
              </div>
              <h4 className="font-bold text-slate-800 text-lg">{testimonials[currentTestimonial].name}</h4>
              <p className="text-sm text-slate-500 font-medium">{testimonials[currentTestimonial].company}</p>
            </motion.div>

            <div className="flex justify-center gap-2 mt-8">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentTestimonial(index)}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                    index === currentTestimonial ? "bg-[#2FA4BC]" : "bg-slate-200"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="demo" className="py-28 lg:py-36 bg-slate-900">
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
              <p className="text-lg text-slate-300 mb-8">
                Schedule a personalized demo and see how Atbott can help you close more clients and deliver better events.
              </p>
              <ul className="space-y-4">
                <li className="flex items-center gap-3 text-slate-300">
                  <CheckCircle2 className="h-5 w-5 text-[#5cbdd0]" />
                  30-minute personalized walkthrough
                </li>
                <li className="flex items-center gap-3 text-slate-300">
                  <CheckCircle2 className="h-5 w-5 text-[#5cbdd0]" />
                  See features tailored to your business
                </li>
                <li className="flex items-center gap-3 text-slate-300">
                  <CheckCircle2 className="h-5 w-5 text-[#5cbdd0]" />
                  Get answers to all your questions
                </li>
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <form onSubmit={handleDemoSubmit} className="bg-white rounded-2xl p-8 shadow-2xl">
                <h3 className="text-xl font-bold text-slate-800 mb-6">Schedule Your Demo</h3>
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
                    className="w-full bg-[#2FA4BC] hover:bg-[#2590a6] shadow-lg shadow-[#2FA4BC]/20 text-white font-semibold"
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

      <section className="py-28 lg:py-36 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-4">
              Frequently Asked Questions
            </h2>
          </motion.div>

          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="bg-slate-50 rounded-xl px-6 border border-slate-100"
              >
                <AccordionTrigger className="text-left font-semibold text-slate-800 hover:no-underline py-5">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-slate-500 pb-5 leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <section className="py-28 lg:py-36" style={{ background: "linear-gradient(135deg, #2FA4BC 0%, #2590a6 50%, #1e7a8c 100%)" }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
              Stop Losing Event Leads.<br />Start Scaling Your Business.
            </h2>
            <p className="text-lg text-white/80 mb-10 max-w-2xl mx-auto">
              Join hundreds of event professionals who've transformed their business with Atbott
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup?plan=growth">
                <Button size="lg" className="w-full sm:w-auto text-base px-10 py-6 bg-white text-[#2FA4BC] hover:bg-[#2FA4BC]/5 shadow-xl font-semibold">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/demo">
                <Button size="lg" variant="outline" className="w-full sm:w-auto text-base px-10 py-6 text-white border-2 border-white/40 hover:bg-white/10 font-semibold">
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

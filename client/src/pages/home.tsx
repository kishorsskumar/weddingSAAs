import { useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { PublicLayout } from "@/components/public-layout";
import { 
  Users, 
  Calendar, 
  Package, 
  Bell, 
  CreditCard, 
  BarChart3,
  CheckCircle2,
  ArrowRight,
  Sparkles
} from "lucide-react";
import { motion } from "framer-motion";

const features = [
  {
    icon: Users,
    title: "Client CRM Management",
    description: "Manage all your wedding clients, contacts, and communications in one centralized place."
  },
  {
    icon: Calendar,
    title: "Wedding Event Planning Workflow",
    description: "Streamline your event planning with customizable timelines, checklists, and milestones."
  },
  {
    icon: Package,
    title: "Vendor & Inventory Control",
    description: "Track vendors, manage inventory, and coordinate logistics seamlessly."
  },
  {
    icon: Bell,
    title: "Automated Reminder System",
    description: "Never miss a deadline with intelligent reminders and notifications."
  },
  {
    icon: CreditCard,
    title: "Subscription & Payment Management",
    description: "Handle invoicing, payments, and subscription billing effortlessly."
  },
  {
    icon: BarChart3,
    title: "Business Analytics Dashboard",
    description: "Get insights into your business performance with powerful analytics."
  }
];

const steps = [
  { number: "01", title: "Create Account", description: "Sign up in seconds and set up your workspace." },
  { number: "02", title: "Add Clients & Events", description: "Import or add your clients and upcoming weddings." },
  { number: "03", title: "Automate Your Operations", description: "Let the platform handle reminders, invoices, and more." }
];

const benefits = [
  "Save operational time with automation",
  "Increase profitability with better tracking",
  "Reduce manual errors",
  "Centralize all business data",
  "Access from anywhere with cloud"
];

export default function HomePage() {
  useEffect(() => {
    document.title = "AtBott Wedding SaaS - Manage Your Wedding Business Smarter";
  }, []);

  return (
    <PublicLayout>
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-white to-primary/10 py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Sparkles className="h-4 w-4" />
                Built for Wedding Professionals
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
                Manage Your Wedding Business{" "}
                <span className="text-primary">Smarter</span> With AtBott
              </h1>
              <p className="text-lg sm:text-xl text-gray-600 mb-8 max-w-xl">
                All-in-one platform to manage clients, events, vendors, payments and 
                automation from one dashboard.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/signup">
                  <Button size="lg" className="w-full sm:w-auto text-base px-8">
                    Start Free Trial
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/pricing">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto text-base px-8">
                    View Pricing
                  </Button>
                </Link>
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
                <img 
                  src="/assets/hero-dashboard.png" 
                  alt="AtBott Wedding SaaS Dashboard"
                  className="w-full max-w-full h-auto rounded-2xl shadow-2xl border border-gray-200"
                />
              </motion.div>
              <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-primary/20 rounded-full blur-2xl"></div>
              <div className="absolute -top-4 -left-4 w-32 h-32 bg-blue-200/30 rounded-full blur-2xl"></div>
            </motion.div>
          </div>
        </div>
      </section>

      <section id="features" className="py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Everything You Need to Run Your Business
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Powerful features designed specifically for wedding planning professionals.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group p-6 rounded-2xl border border-gray-100 bg-white hover:shadow-lg hover:border-primary/20 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-lg text-gray-600">
              Get started in minutes, not hours.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.15 }}
                className="text-center"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary text-white text-2xl font-bold mb-6">
                  {step.number}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{step.title}</h3>
                <p className="text-gray-600">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">
                Why Choose AtBott?
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                Join hundreds of wedding professionals who trust AtBott to grow their business.
              </p>
              <ul className="space-y-4">
                {benefits.map((benefit, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                    className="flex items-center gap-3"
                  >
                    <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0" />
                    <span className="text-gray-700">{benefit}</span>
                  </motion.li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-8 lg:p-12">
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl p-6 shadow-sm">
                    <div className="text-3xl font-bold text-primary mb-2">500+</div>
                    <div className="text-sm text-gray-600">Events Managed</div>
                  </div>
                  <div className="bg-white rounded-xl p-6 shadow-sm">
                    <div className="text-3xl font-bold text-primary mb-2">98%</div>
                    <div className="text-sm text-gray-600">Client Satisfaction</div>
                  </div>
                  <div className="bg-white rounded-xl p-6 shadow-sm">
                    <div className="text-3xl font-bold text-primary mb-2">40%</div>
                    <div className="text-sm text-gray-600">Time Saved</div>
                  </div>
                  <div className="bg-white rounded-xl p-6 shadow-sm">
                    <div className="text-3xl font-bold text-primary mb-2">24/7</div>
                    <div className="text-sm text-gray-600">Cloud Access</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28 bg-primary">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
              Start Managing Weddings Like A Professional Agency
            </h2>
            <p className="text-lg text-white/80 mb-8 max-w-2xl mx-auto">
              Join thousands of wedding planners who have transformed their business with AtBott.
            </p>
            <Link href="/signup">
              <Button size="lg" variant="secondary" className="text-base px-8">
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </PublicLayout>
  );
}

import { useAuth } from "@/context/auth-context";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Sparkles,
  Rocket,
  LayoutDashboard,
  Calendar,
  BookOpen,
  Receipt,
  Target,
  Briefcase,
  Image,
  Zap,
  Lightbulb,
  HelpCircle,
  Shield,
  MessageSquare,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Package,
  ClipboardList,
  Mic,
  ChevronRight,
  Info,
  FileText,
  Users,
} from "lucide-react";

function CommandExample({ children }: { children: string }) {
  return (
    <code
      className="inline-block bg-[#4b7c29]/10 text-[#4b7c29] px-2 py-1 rounded text-sm font-mono border border-[#4b7c29]/20 cursor-pointer hover:bg-[#4b7c29]/20 transition-colors"
      onClick={() => navigator.clipboard.writeText(children)}
      title="Click to copy"
      data-testid="text-command-example"
    >
      {children}
    </code>
  );
}

function SectionIcon({ icon: Icon }: { icon: any }) {
  return (
    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#4b7c29]/10 flex items-center justify-center">
      <Icon className="h-4 w-4 text-[#4b7c29]" />
    </div>
  );
}

interface RoleGuide {
  title: string;
  description: string;
  badgeColor: string;
  canDo: { icon: any; text: string }[];
  cannotDo: string[];
  samplePrompts: string[];
  tips: string[];
}

const ROLE_GUIDES: Record<string, RoleGuide> = {
  superadmin: {
    title: "Superadmin",
    description: "Full access to every Oaksy capability. Oaksy is your AI business partner with complete authority across all modules — events, finance, HR, sales, and communications.",
    badgeColor: "bg-amber-500",
    canDo: [
      { icon: Calendar, text: "Create, edit, and delete events" },
      { icon: BookOpen, text: "Manage daybook entries, bank transfers, and financial records" },
      { icon: FileText, text: "Generate estimates and invoices from conversation" },
      { icon: Users, text: "View and manage employees and HR data" },
      { icon: MessageSquare, text: "Send WhatsApp messages and notifications" },
      { icon: Target, text: "Access sales pipeline and lead management" },
      { icon: Package, text: "View inventory and production data" },
      { icon: ClipboardList, text: "Get business analysis and MIS reports" },
      { icon: Image, text: "Upload screenshots for analysis (bills, estimates, payments)" },
      { icon: Mic, text: "Use voice input for hands-free interaction" },
    ],
    cannotDo: [],
    samplePrompts: [
      "Show me this month's revenue vs expenses",
      "Create a daybook entry: received 50,000 from Sharma wedding, cash",
      "How many events do we have in March?",
      "Send a WhatsApp to the production team about tomorrow's event",
      "Generate an estimate for a 300-guest wedding in Goa",
      "What's our total outstanding from all events?",
      "Create a new event: Mehra Reception, March 15, Taj Hotel",
      "Show me all pending payments across events",
    ],
    tips: [
      "Destructive actions (delete, send WhatsApp) will ask for your confirmation first",
      "Upload bill/payment screenshots — Oaksy extracts and logs them automatically",
      "Ask for business analysis — Oaksy calculates real-time from your actual data",
      "Oaksy remembers the last 10 messages in each conversation for context",
      "Every action Oaksy takes is logged in the audit trail for transparency",
    ],
  },
  admin: {
    title: "Admin",
    description: "Broad access to most Oaksy features based on your assigned page permissions. Your tools depend on what the superadmin has granted.",
    badgeColor: "bg-blue-500",
    canDo: [
      { icon: Calendar, text: "View and manage events (based on permissions)" },
      { icon: BookOpen, text: "Access financial summaries and daybook" },
      { icon: FileText, text: "Generate estimates and invoices" },
      { icon: Users, text: "View team information" },
      { icon: Target, text: "Access sales data and pipeline" },
      { icon: Image, text: "Upload screenshots for analysis" },
    ],
    cannotDo: [
      "Features may be restricted based on your specific page permissions",
    ],
    samplePrompts: [
      "Show me upcoming events this week",
      "What's the daybook balance for today?",
      "Create an estimate for a corporate event",
      "List all pending tasks for this month",
    ],
    tips: [
      "Your available tools depend on the pages your superadmin has granted access to",
      "If Oaksy says it can't do something, ask your superadmin to grant that page permission",
    ],
  },
  wedding_planner: {
    title: "Wedding Planner",
    description: "Oaksy helps you manage clients, create estimates, track your sales pipeline, and generate smart quotes — all through natural conversation.",
    badgeColor: "bg-pink-500",
    canDo: [
      { icon: FileText, text: "Create and duplicate estimates" },
      { icon: Target, text: "Manage sales leads and pipeline" },
      { icon: Calendar, text: "View assigned event details" },
      { icon: Users, text: "Manage client information" },
      { icon: Image, text: "Upload estimate screenshots for cloning" },
      { icon: Sparkles, text: "Generate smart estimates with AI" },
    ],
    cannotDo: [
      "Modify accounting ledger or daybook entries",
      "Send company-wide notifications or bulk WhatsApp",
      "Override financial records",
      "Access other planner's events",
      "Delete events or employees",
      "View bank balances or salary data",
    ],
    samplePrompts: [
      "Create an estimate for a 200-guest wedding in Mumbai",
      "Show me my active leads",
      "What events do I have assigned this month?",
      "Generate a smart estimate for a destination wedding in Udaipur",
      "Duplicate the estimate from the Kapoor wedding",
    ],
    tips: [
      "Upload a competitor's estimate screenshot and Oaksy can clone it into your format",
      "Use 'smart estimate' to let Oaksy suggest line items based on event type and guest count",
      "Oaksy can only show events you are assigned to as a planner",
    ],
  },
  accountant: {
    title: "Accountant",
    description: "Oaksy is your financial assistant — log payments, categorize transactions, manage bank transfers, and generate reports through natural conversation.",
    badgeColor: "bg-green-600",
    canDo: [
      { icon: BookOpen, text: "View and create daybook entries" },
      { icon: Receipt, text: "Manage bank transfers and balances" },
      { icon: FileText, text: "Create estimates and invoices" },
      { icon: Target, text: "View sales summaries and financial reports" },
      { icon: Calendar, text: "View event financial data" },
      { icon: Image, text: "Upload payment screenshots for auto-logging" },
    ],
    cannotDo: [
      "Modify event production data",
      "Edit estimates created by planners",
      "Send bulk WhatsApp messages",
      "Delete events",
      "Access HR salary data",
    ],
    samplePrompts: [
      "Log a payment: received 1,00,000 from Gupta wedding, bank transfer, HDFC",
      "What's today's daybook balance?",
      "Show me all expenses for last month",
      "Create an invoice for the Sharma event",
      "Transfer 50,000 from HDFC to ICICI",
      "Show me outstanding payments across all events",
    ],
    tips: [
      "Upload bill/payment screenshots and Oaksy will extract amount, vendor, and category",
      "Oaksy understands Indian number formats (1,00,000 = 1 lakh)",
      "Deleting daybook entries will ask for your confirmation first",
    ],
  },
  production: {
    title: "Production",
    description: "Oaksy helps you stay on top of assigned events, schedules, and vendor allocations.",
    badgeColor: "bg-orange-500",
    canDo: [
      { icon: Calendar, text: "View assigned events and schedules" },
      { icon: ClipboardList, text: "Check task status and deadlines" },
      { icon: Package, text: "View vendor allocations for events" },
    ],
    cannotDo: [
      "Modify financial entries or daybook",
      "Send bulk WhatsApp messages",
      "Access bank or salary data",
      "Create or delete events",
      "Edit estimates or invoices",
    ],
    samplePrompts: [
      "What events are scheduled this week?",
      "Show me my upcoming event details",
      "What vendors are assigned to the Mehra wedding?",
    ],
    tips: [
      "Ask Oaksy about event timelines and vendor details for quick reference",
      "Financial and admin features are not accessible from your role",
    ],
  },
  warehouse_incharge: {
    title: "Warehouse In-charge",
    description: "Oaksy helps you track inventory levels and plan event logistics.",
    badgeColor: "bg-teal-500",
    canDo: [
      { icon: Package, text: "View inventory levels and stock alerts" },
      { icon: Calendar, text: "View event details for dispatch planning" },
      { icon: ClipboardList, text: "Track material usage per event" },
    ],
    cannotDo: [
      "Modify event budgets or financial entries",
      "Access payroll or salary data",
      "Send notifications or bulk WhatsApp",
      "Create or delete events",
      "Access bank data",
    ],
    samplePrompts: [
      "What events need dispatch this week?",
      "Show me events coming up in the next 3 days",
    ],
    tips: [
      "Use Oaksy to quickly check event details before planning dispatch",
      "Financial and HR modules are not accessible from your role",
    ],
  },
  employee: {
    title: "Employee",
    description: "Oaksy helps you with workflow questions, view your assigned tasks, and check leave balances.",
    badgeColor: "bg-gray-500",
    canDo: [
      { icon: Calendar, text: "View your assigned tasks and events" },
      { icon: HelpCircle, text: "Ask workflow and process questions" },
      { icon: Users, text: "Check your leave balance" },
    ],
    cannotDo: [
      "Access financial data, daybook, or bank accounts",
      "Access other department dashboards",
      "Send bulk communications",
      "Create or edit events",
      "View employee salary data",
    ],
    samplePrompts: [
      "What events am I assigned to this week?",
      "How many leave days do I have left?",
      "What's the process for submitting an expense?",
    ],
    tips: [
      "Oaksy can answer general Oakstreet workflow questions",
      "For expense or leave requests, use the Employee Portal or WhatsApp",
    ],
  },
  manager: {
    title: "Manager",
    description: "Oaksy helps you manage your team and track operations within your assigned permissions.",
    badgeColor: "bg-indigo-500",
    canDo: [
      { icon: Calendar, text: "View events and schedules" },
      { icon: Users, text: "View team information" },
      { icon: ClipboardList, text: "Check task assignments" },
    ],
    cannotDo: [
      "Some features may be restricted based on your specific permissions",
    ],
    samplePrompts: [
      "What events are scheduled for my team this week?",
      "Show me the upcoming deadlines",
    ],
    tips: [
      "Your tool access depends on the pages assigned to you by the admin",
    ],
  },
};

const GENERAL_SECTIONS = [
  {
    id: "getting-started",
    icon: Rocket,
    title: "Getting Started",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">What is Oaksy?</strong> — An AI business manager that understands your event management needs. Oaksy can create events, manage finances, handle HR tasks, and more — all through natural conversation.
        </p>
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">How to open Oaksy:</strong> Click the <Sparkles className="inline h-4 w-4 text-[#4b7c29]" /> Oaksy icon on any page, or navigate to the Oaksy page from the sidebar.
        </p>
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">Domain Lock:</strong> Oaksy only responds to Oakstreet business topics. General knowledge questions will be politely declined.
        </p>
      </div>
    ),
  },
  {
    id: "image-intelligence",
    icon: Image,
    title: "Image Intelligence",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground mb-3">
          Upload images and Oaksy takes action automatically:
        </p>
        <div className="grid gap-2">
          {[
            { badge: "Bill", desc: "Upload a bill — auto-adds to daybook with extracted details" },
            { badge: "Price List", desc: "Upload a quotation — creates an estimate with line items" },
            { badge: "Vendor", desc: "Upload a vendor payment list — adds vendor costs to the event" },
            { badge: "Any", desc: "Upload any document — Oaksy figures out what to do" },
          ].map((item) => (
            <div key={item.badge} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Badge variant="secondary" className="bg-[#4b7c29]/10 text-[#4b7c29] mt-0.5 shrink-0">{item.badge}</Badge>
              <span className="text-sm text-muted-foreground">{item.desc}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "how-it-works",
    icon: HelpCircle,
    title: "How Oaksy Works",
    content: (
      <div className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-muted/50 space-y-1">
            <h4 className="font-semibold text-sm">Conversations</h4>
            <p className="text-xs text-muted-foreground">Each conversation has its own context. Start a new one for a different topic. Oaksy remembers the last 10 messages per conversation.</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 space-y-1">
            <h4 className="font-semibold text-sm">Actions vs Answers</h4>
            <p className="text-xs text-muted-foreground">Oaksy can both answer questions AND take actions (create entries, generate documents). It decides based on your request.</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 space-y-1">
            <h4 className="font-semibold text-sm">Audit Trail</h4>
            <p className="text-xs text-muted-foreground">Every action Oaksy takes is logged for transparency. Superadmins can review all AI interactions.</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 space-y-1">
            <h4 className="font-semibold text-sm">Role Awareness</h4>
            <p className="text-xs text-muted-foreground">Oaksy only shows tools and data you're authorized to access based on your role and page permissions.</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "automations",
    icon: Zap,
    title: "Automations (Background)",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground mb-3">
          These run automatically to keep your business on track:
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          {[
            { time: "7:00 AM", label: "Morning business report" },
            { time: "9:00 PM", label: "Night summary" },
            { time: "9:45 AM / 5:45 PM", label: "Attendance reminders" },
            { time: "7 / 3 / 1 days before", label: "Pre-event reminders" },
            { time: "Auto", label: "Post-event auto-completion" },
            { time: "Auto", label: "Budget alerts" },
            { time: "Auto", label: "Stale lead reminders" },
            { time: "Monthly", label: "P&L report & cashflow forecast" },
          ].map((item, idx) => (
            <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
              <Badge variant="outline" className="text-xs shrink-0 font-mono">{item.time}</Badge>
              <span className="text-sm text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "tips",
    icon: Lightbulb,
    title: "Tips & Tricks",
    content: (
      <div className="space-y-3">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Use natural language</strong> — Say things like{" "}
            <CommandExample>add 2 lakhs income for the wedding next week</CommandExample>
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Batch actions</strong> — Send multiple items in one message:{" "}
            <CommandExample>Add 3 expenses: chai 50, uber 350, flowers 2000</CommandExample>
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Follow-up naturally</strong> — Oaksy remembers context within your conversation, so follow-up questions work.
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Voice input</strong> — Click the mic button for hands-free interaction.
          </p>
        </div>
      </div>
    ),
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

export default function OaksyHelp() {
  const { user } = useAuth();
  const userRole = user?.role || "employee";
  const guide = ROLE_GUIDES[userRole] || ROLE_GUIDES["employee"];

  return (
    <div className="space-y-6 sm:space-y-8 px-2 sm:px-0 pb-24 md:pb-8" data-testid="oaksy-help-page">
      <motion.div
        className="flex flex-col gap-2 pl-12 md:pl-0"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#4b7c29] flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-serif text-[#4b7c29]" data-testid="text-page-title">
              Oaksy AI Guide
            </h1>
            <p className="text-sm text-muted-foreground" data-testid="text-page-subtitle">
              Personalized guide for your role
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card className="border-2 border-[#4b7c29]/20 bg-[#4b7c29]/5" data-testid="card-role-info">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <Badge className={`${guide.badgeColor} text-white px-3 py-1`} data-testid="badge-user-role">
                {guide.title}
              </Badge>
              <CardTitle className="text-lg">Your Access Level</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground" data-testid="text-role-description">{guide.description}</p>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
      >
        <Card data-testid="card-what-you-can-do">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-[#4b7c29] text-base">
              <CheckCircle className="h-5 w-5" />
              What You Can Do
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {guide.canDo.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors" data-testid={`row-can-do-${i}`}>
                  <div className="h-7 w-7 rounded-md bg-[#4b7c29]/10 flex items-center justify-center flex-shrink-0">
                    <item.icon className="h-3.5 w-3.5 text-[#4b7c29]" />
                  </div>
                  <span className="text-sm text-muted-foreground">{item.text}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {guide.cannotDo.length > 0 ? (
          <Card className="border-red-200/50" data-testid="card-restrictions">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-red-600 text-base">
                <XCircle className="h-5 w-5" />
                Restrictions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {guide.cannotDo.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground p-2" data-testid={`row-cannot-do-${i}`}>
                    <XCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-[#4b7c29]/20" data-testid="card-no-restrictions">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-[#4b7c29] text-base">
                <Shield className="h-5 w-5" />
                Full Access
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">You have unrestricted access to all Oaksy tools and modules. Sensitive actions like deleting records or sending WhatsApp messages will still require your confirmation before execution.</p>
            </CardContent>
          </Card>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <Card className="bg-gradient-to-br from-gray-900 to-gray-800 text-white" data-testid="card-sample-prompts">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-[#4b7c29] text-base">
              <MessageSquare className="h-5 w-5" />
              Try These Prompts
            </CardTitle>
            <p className="text-gray-400 text-xs">Click any prompt to copy it, then paste into Oaksy</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {guide.samplePrompts.map((prompt, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 p-2.5 rounded-lg bg-white/10 hover:bg-white/15 transition-colors cursor-pointer group"
                  onClick={() => navigator.clipboard.writeText(prompt)}
                  data-testid={`prompt-sample-${i}`}
                >
                  <ChevronRight className="h-4 w-4 text-[#4b7c29] flex-shrink-0" />
                  <span className="text-sm text-gray-200 flex-1">{prompt}</span>
                  <span className="text-xs text-gray-500 group-hover:text-[#4b7c29] transition-colors hidden sm:block">click to copy</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
      >
        <Card data-testid="card-tips">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-amber-600 text-base">
              <AlertTriangle className="h-5 w-5" />
              Tips for {guide.title} Role
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {guide.tips.map((tip, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground p-1" data-testid={`row-tip-${i}`}>
                  <div className="h-5 w-5 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-amber-600">{i + 1}</span>
                  </div>
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        <Card className="shadow-sm" data-testid="card-general-guide">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="h-5 w-5 text-[#4b7c29]" />
              General Reference
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
            <Accordion type="multiple" className="w-full" data-testid="accordion-help-sections">
              {GENERAL_SECTIONS.map((section) => (
                <motion.div key={section.id} variants={itemVariants}>
                  <AccordionItem value={section.id} data-testid={`accordion-item-${section.id}`}>
                    <AccordionTrigger className="hover:no-underline py-4" data-testid={`accordion-trigger-${section.id}`}>
                      <div className="flex items-center gap-3">
                        <SectionIcon icon={section.icon} />
                        <span className="font-semibold text-sm text-left">{section.title}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pl-11" data-testid={`accordion-content-${section.id}`}>
                      {section.content}
                    </AccordionContent>
                  </AccordionItem>
                </motion.div>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </motion.div>

      <div className="text-center pb-4">
        <p className="text-xs text-muted-foreground">Oaksy AI is powered by OpenAI GPT-4o and is exclusive to Oakstreet Events.</p>
      </div>
    </div>
  );
}

import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/context/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { 
  Calendar, 
  DollarSign, 
  Users, 
  TrendingUp,
  LayoutDashboard,
  Database,
  CheckSquare,
  BookOpen,
  Receipt,
  Target,
  Package,
  Briefcase,
  Shield,
  UserCircle,
  Clock,
  AlertCircle,
  Bell,
  Banknote,
  FileText,
  Camera,
  ArrowRight,
  Upload,
  Loader2,
  CheckCircle2,
  Pencil,
  Sparkles,
  ClipboardList,
  Palette,
  MessageSquare,
  Settings,
  HelpCircle,
  BarChart3,
  Award,
  ChevronLeft,
  ChevronRight,
  Image
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";
import type { Event } from "@/lib/types";
import type { InventoryItem, EventMilestone } from "@shared/schema";

interface PendingMilestone extends EventMilestone {
  event?: Event;
}

const ALL_PAGES = [
  { id: "dashboard", label: "Dashboard", path: "/", icon: LayoutDashboard, description: "Overview & stats" },
  { id: "sales", label: "Sales", path: "/oak-sales", icon: Target, description: "Leads, pipeline & CRM" },
  { id: "event-hub", label: "Event Hub", path: "/events", icon: Calendar, description: "Calendar, timeline & execution" },
  { id: "event-calendar", label: "Oak Event Calendar", path: "/events", icon: Calendar, description: "Manage events" },
  { id: "operations", label: "Operations", path: "/oak-inventory", icon: Package, description: "Operations & fulfilment" },
  { id: "finance", label: "Finance", path: "/oak-book", icon: Receipt, description: "Accounting & invoicing" },
  { id: "people", label: "People", path: "/hr", icon: Users, description: "HR & team management" },
  { id: "hr", label: "HR Management", path: "/hr", icon: Briefcase, description: "HR & payroll" },
  { id: "employee-portal", label: "Employee Portal", path: "/employee-portal", icon: UserCircle, description: "Your profile & requests" },
  { id: "team-calendar", label: "Team Calendar", path: "/team", icon: Users, description: "Team scheduling" },
  { id: "tools", label: "Tools", path: "/whatsapp-inbox", icon: Settings, description: "Communication & AI tools" },
  { id: "whatsapp-inbox", label: "WhatsApp Inbox", path: "/whatsapp-inbox", icon: MessageSquare, description: "Employee requests via WhatsApp" },
  { id: "oak-rsvp", label: "Oak RSVP", path: "/oak-rsvp", icon: Users, description: "Event guest management" },
  { id: "oaksy", label: "Oaksy AI", path: "/oaksy", icon: Sparkles, description: "AI assistant" },
  { id: "oak-creative", label: "Oak Creative", path: "/oak-creative", icon: Palette, description: "Presentation builder" },
  { id: "management-mis", label: "Management MIS", path: "/management-mis", icon: LayoutDashboard, description: "Executive dashboard & reports" },
  { id: "event-database", label: "Event Database", path: "/database", icon: Database, description: "Event records" },
  { id: "event-milestones", label: "Oak Milestones", path: "/milestones", icon: CheckSquare, description: "Track milestones" },
  { id: "daybook", label: "Day Book", path: "/daybook", icon: BookOpen, description: "Daily finances" },
  { id: "execution-plan", label: "Execution Plan", path: "/execution-plan", icon: ClipboardList, description: "Event production planning" },
  { id: "attendance", label: "Attendance", path: "/attendance", icon: CheckSquare, description: "Track daily attendance" },
  { id: "attendance-admin", label: "Attendance Admin", path: "/attendance-admin", icon: ClipboardList, description: "Attendance management" },
  { id: "oak-incentives", label: "Incentives & Bonus", path: "/oak-incentives", icon: Award, description: "Employee incentives & KPI" },
  { id: "knotvite", label: "KnotVite RSVP", path: "/knotvite/dashboard", icon: FileText, description: "RSVP & guest management" },
  { id: "knotvite-forms", label: "KnotVite Forms", path: "/knotvite/forms", icon: FileText, description: "RSVP form builder" },
  { id: "knotvite-submissions", label: "KnotVite Submissions", path: "/knotvite/submissions", icon: Users, description: "RSVP responses" },
  { id: "client-portal", label: "Client Portal", path: "/portal-admin", icon: Users, description: "Client-facing portal" },
  { id: "portal-admin", label: "Portal Dashboard", path: "/portal-admin", icon: LayoutDashboard, description: "Client portal management" },
  { id: "portfolio-admin", label: "Portfolio Manager", path: "/portfolio-admin", icon: Image, description: "Showcase portfolio" },
  { id: "admin", label: "Admin Panel", path: "/admin", icon: Shield, description: "User management" },
  { id: "oaksy-help", label: "Oaksy Help", path: "/oaksy-help", icon: HelpCircle, description: "AI assistant guide" },
];

export default function Dashboard() {
  const { user, allowedPages } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const isSuperAdmin = user?.role === 'superadmin';
  
  const accessiblePages = isSuperAdmin 
    ? ALL_PAGES.filter(p => p.id !== 'dashboard')
    : ALL_PAGES.filter(p => allowedPages.includes(p.id) && p.id !== 'dashboard');
  const isWeddingPlanner = user?.role === 'wedding_planner';
  const isAccountant = user?.role === 'accountant';
  const isEmployee = user?.role === 'employee';

  // Only fetch events for admins and wedding planners, not for regular employees
  const { data: allEvents = [] } = useQuery<Event[]>({
    queryKey: ['/api/events'],
    queryFn: async () => {
      const res = await fetch('/api/events');
      if (!res.ok) throw new Error('Failed to fetch events');
      return res.json();
    },
    enabled: isAdmin || isWeddingPlanner,
  });

  const { data: inventoryItems = [] } = useQuery<InventoryItem[]>({
    queryKey: ['/api/inventory/items'],
    queryFn: async () => {
      const res = await fetch('/api/inventory/items');
      if (!res.ok) throw new Error('Failed to fetch inventory');
      return res.json();
    },
    enabled: isSuperAdmin,
  });

  const { data: monthlyDaybookEntries = [] } = useQuery<any[]>({
    queryKey: ['/api/daybook-entries/monthly-summary'],
    queryFn: async () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      const res = await fetch(`/api/daybook?startDate=${start}&endDate=${end}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isSuperAdmin,
  });

  // Pending approvals for superadmin dashboard
  const { data: pendingLeaves = [] } = useQuery<any[]>({
    queryKey: ['/api/hr/leaves/pending'],
    queryFn: async () => {
      const res = await fetch('/api/hr/leaves/pending', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAdmin,
  });

  const { data: pendingAdvances = [] } = useQuery<any[]>({
    queryKey: ['/api/hr/salary-advances/pending'],
    queryFn: async () => {
      const res = await fetch('/api/hr/salary-advances/pending', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAdmin,
  });

  const { data: pendingExpenses = [] } = useQuery<any[]>({
    queryKey: ['/api/hr/expenses/pending'],
    queryFn: async () => {
      const res = await fetch('/api/hr/expenses/pending', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAdmin,
  });

  const { data: pendingQuickEntries = [] } = useQuery<any[]>({
    queryKey: ['/api/hr/quick-entries/pending'],
    queryFn: async () => {
      const res = await fetch('/api/hr/quick-entries/pending', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAdmin,
  });

  const totalPendingApprovals = pendingLeaves.length + pendingAdvances.length + pendingExpenses.length + pendingQuickEntries.length;

  const { data: salesTargetsData = [] } = useQuery<any[]>({
    queryKey: ['/api/sales/targets'],
    queryFn: async () => {
      const res = await fetch('/api/sales/targets', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAdmin || isWeddingPlanner,
  });

  const { data: allUsers = [] } = useQuery<any[]>({
    queryKey: ['/api/users-for-targets'],
    queryFn: async () => {
      const res = await fetch('/api/users', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isSuperAdmin,
  });

  // Fetch sales deals to count active leads
  // For wedding planners, filter by their own leads only
  const { data: salesDeals = [] } = useQuery<any[]>({
    queryKey: ['/api/sales/deals', isWeddingPlanner ? user?.id : null],
    queryFn: async () => {
      const url = isWeddingPlanner && user?.id 
        ? `/api/sales/deals?ownerId=${user.id}` 
        : '/api/sales/deals';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAdmin || isWeddingPlanner,
  });

  const { data: salesStages = [] } = useQuery<any[]>({
    queryKey: ['/api/sales/stages'],
    queryFn: async () => {
      const res = await fetch('/api/sales/stages', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAdmin || isWeddingPlanner,
  });

  const { data: upcomingPaymentsData } = useQuery<any>({
    queryKey: ['/api/admin/upcoming-payments'],
    queryFn: async () => {
      const res = await fetch('/api/admin/upcoming-payments', { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: isAdmin || isWeddingPlanner || isAccountant,
  });

  // Calculate active leads (deals not in Closed Won or Closed Lost stages)
  const activeLeads = useMemo(() => {
    const closedStageIds = salesStages
      .filter((s: any) => {
        const name = s.name?.toLowerCase() || '';
        return name.includes('won') || name.includes('lost') || name === 'closed';
      })
      .map((s: any) => s.id);
    return salesDeals.filter((d: any) => !closedStageIds.includes(d.stageId));
  }, [salesDeals, salesStages]);

  // Count leads created today
  const todayStr = new Date().toISOString().split('T')[0];
  const newLeadsToday = activeLeads.filter((d: any) => 
    d.createdAt && d.createdAt.split('T')[0] === todayStr
  ).length;

  const queryClient = useQueryClient();

  const { data: myIncentives = [] } = useQuery<any[]>({
    queryKey: ['/api/my/incentives'],
    queryFn: async () => {
      const res = await fetch('/api/my/incentives', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: myKpiTargets = [] } = useQuery<any[]>({
    queryKey: ['/api/my/kpi-targets'],
    queryFn: async () => {
      const res = await fetch('/api/my/kpi-targets', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const pendingIncentives = myIncentives.filter((i: any) => i.status === 'pending' || i.status === 'in_progress');

  const completeTask = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await fetch(`/api/my/incentive-tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted: true }),
      });
      if (!res.ok) throw new Error('Failed to complete task');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my/incentives'] });
    },
  });
  
  // Check if user has access to milestones
  const hasAccess = isSuperAdmin || allowedPages.includes('event-milestones');
  
  // Fetch pending milestones - server filters by authenticated user's role
  const { data: pendingMilestones = [] } = useQuery<PendingMilestone[]>({
    queryKey: ['/api/milestones/pending-by-planner'],
    queryFn: async () => {
      const res = await fetch('/api/milestones/pending-by-planner');
      if (!res.ok) throw new Error('Failed to fetch pending milestones');
      return res.json();
    },
    enabled: hasAccess,
  });

  // Mutation to mark milestone as completed
  const completeMilestone = useMutation({
    mutationFn: async (milestoneId: string) => {
      const res = await fetch(`/api/milestones/${milestoneId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });
      if (!res.ok) throw new Error('Failed to complete milestone');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/milestones/pending-by-planner'] });
    },
  });

  // Get overdue and upcoming tasks
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const overdueTasks = pendingMilestones.filter(m => new Date(m.date) < today);
  const upcomingTasks = pendingMilestones.filter(m => new Date(m.date) >= today).slice(0, 10);

  const events = useMemo(() => {
    if (isAdmin) return allEvents;
    if (isWeddingPlanner) {
      return allEvents.filter(e => 
        e.planner?.toLowerCase() === user?.name?.toLowerCase()
      );
    }
    return allEvents;
  }, [allEvents, isAdmin, isWeddingPlanner, user?.name]);

  const totalSales = events.reduce((acc, curr) => acc + parseFloat(curr.salesValue || '0'), 0);
  const now = new Date();
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const upcomingEvents = events.filter((e) => {
    const eventDate = new Date(e.date);
    return eventDate > now && eventDate <= thirtyDaysLater;
  }).length;
  
  const totalInventoryValue = useMemo(() => {
    return inventoryItems.reduce((acc, item) => {
      const unitCost = typeof item.unitCost === 'string' ? parseFloat(item.unitCost) : (item.unitCost || 0);
      return acc + (item.stockQuantity * (isNaN(unitCost) ? 0 : unitCost));
    }, 0);
  }, [inventoryItems]);

  const FY_MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
  const FIDA_COLOR = '#ec4899';
  const FEMINA_COLOR = '#3b82f6';

  const getCurrentFY = () => {
    const now = new Date();
    const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return { label: `FY${year}-${(year + 1).toString().slice(2)}`, startYear: year };
  };

  const defaultFY = getCurrentFY();
  const [selectedFYStart, setSelectedFYStart] = useState<number>(defaultFY.startYear);
  const currentFY = { label: `FY${selectedFYStart}-${(selectedFYStart + 1).toString().slice(2)}`, startYear: selectedFYStart };

  const [wpSelectedMonthIdx, setWpSelectedMonthIdx] = useState<number>(() => {
    const now = new Date();
    const m = now.getMonth();
    return m >= 3 ? m - 3 : m + 9;
  });

  const fyOptions = useMemo(() => {
    const current = defaultFY.startYear;
    return [
      { label: `FY ${current + 1}-${(current + 2).toString().slice(2)}`, value: current + 1 },
      { label: `FY ${current}-${(current + 1).toString().slice(2)}`, value: current },
      { label: `FY ${current - 1}-${current.toString().slice(2)}`, value: current - 1 },
    ];
  }, [defaultFY.startYear]);

  const classifyPlanner = (name: string): 'fida' | 'femina' | 'other' => {
    const n = (name || '').toLowerCase().trim();
    if (n.includes('fida')) return 'fida';
    if (n.includes('femina')) return 'femina';
    return 'other';
  };

  const isMyEvent = (plannerName: string) => {
    const evN = (plannerName || '').toLowerCase().trim();
    const myN = (user?.name || '').toLowerCase().trim();
    return evN === myN || evN.includes(myN) || myN.includes(evN);
  };

  const fyKey = `FY${currentFY.startYear}-${(currentFY.startYear + 1).toString().slice(2)}`;

  const weddingPlannerUsers = useMemo(() => {
    return isSuperAdmin ? allUsers.filter((u: any) => u.role === 'wedding_planner') : [];
  }, [allUsers, isSuperAdmin]);

  const fidaUserId = useMemo(() => weddingPlannerUsers.find((u: any) => classifyPlanner(u.name) === 'fida')?.id, [weddingPlannerUsers]);
  const feminaUserId = useMemo(() => weddingPlannerUsers.find((u: any) => classifyPlanner(u.name) === 'femina')?.id, [weddingPlannerUsers]);

  const MONTH_LABELS_MAP: Record<string, string> = {
    '4': 'Apr', '04': 'Apr', 'apr': 'Apr', 'april': 'Apr',
    '5': 'May', '05': 'May', 'may': 'May',
    '6': 'Jun', '06': 'Jun', 'jun': 'Jun', 'june': 'Jun',
    '7': 'Jul', '07': 'Jul', 'jul': 'Jul', 'july': 'Jul',
    '8': 'Aug', '08': 'Aug', 'aug': 'Aug', 'august': 'Aug',
    '9': 'Sep', '09': 'Sep', 'sep': 'Sep', 'september': 'Sep',
    '10': 'Oct', 'oct': 'Oct', 'october': 'Oct',
    '11': 'Nov', 'nov': 'Nov', 'november': 'Nov',
    '12': 'Dec', 'dec': 'Dec', 'december': 'Dec',
    '1': 'Jan', '01': 'Jan', 'jan': 'Jan', 'january': 'Jan',
    '2': 'Feb', '02': 'Feb', 'feb': 'Feb', 'february': 'Feb',
    '3': 'Mar', '03': 'Mar', 'mar': 'Mar', 'march': 'Mar',
  };

  const normalizeMonth = (month: string): string | null => {
    return MONTH_LABELS_MAP[(month || '').toLowerCase().trim()] || null;
  };

  const salesChartData = useMemo(() => {
    const fy = currentFY;

    const monthData = FY_MONTHS.map((monthLabel, idx) => {
      const monthNum = idx < 9 ? idx + 4 : idx - 8;
      const year = idx < 9 ? fy.startYear : fy.startYear + 1;

      const entry: any = { month: monthLabel };

      if (isSuperAdmin) {
        let fidaActual = 0;
        let feminaActual = 0;
        allEvents.forEach((ev: any) => {
          const evDate = new Date(ev.date);
          if (evDate.getFullYear() === year && evDate.getMonth() + 1 === monthNum) {
            const val = parseFloat(ev.salesValue || '0');
            const cat = classifyPlanner(ev.planner);
            if (cat === 'fida') fidaActual += val;
            else if (cat === 'femina') feminaActual += val;
          }
        });
        entry.fidaActual = fidaActual;
        entry.feminaActual = feminaActual;

        let fidaTarget = 0;
        let feminaTarget = 0;
        salesTargetsData.forEach((t: any) => {
          const tfy = (t.fiscalYear || '').trim();
          if (tfy !== fyKey) return;
          const targetAmt = parseFloat(t.targetAmount || '0');
          const isFida = t.userId === fidaUserId;
          const isFemina = t.userId === feminaUserId;
          if (!isFida && !isFemina) return;

          if (t.month) {
            const normalized = normalizeMonth(t.month);
            if (normalized === monthLabel) {
              if (isFida) fidaTarget += targetAmt;
              if (isFemina) feminaTarget += targetAmt;
            }
          } else {
            if (isFida) fidaTarget += targetAmt / 12;
            if (isFemina) feminaTarget += targetAmt / 12;
          }
        });
        entry.fidaTarget = fidaTarget;
        entry.feminaTarget = feminaTarget;
        entry.totalTarget = fidaTarget + feminaTarget;
      } else {
        let myActual = 0;
        allEvents.forEach((ev: any) => {
          const evDate = new Date(ev.date);
          if (evDate.getFullYear() === year && evDate.getMonth() + 1 === monthNum) {
            if (isMyEvent(ev.planner)) {
              myActual += parseFloat(ev.salesValue || '0');
            }
          }
        });
        entry.myActual = myActual;

        let myTarget = 0;
        salesTargetsData.forEach((t: any) => {
          const tfy = (t.fiscalYear || '').trim();
          if (tfy !== fyKey || t.userId !== user?.id) return;
          const targetAmt = parseFloat(t.targetAmount || '0');
          if (t.month) {
            const normalized = normalizeMonth(t.month);
            if (normalized === monthLabel) myTarget += targetAmt;
          } else {
            myTarget += targetAmt / 12;
          }
        });
        entry.myTarget = myTarget;
      }

      return entry;
    });

    return monthData;
  }, [allEvents, salesTargetsData, isSuperAdmin, user, selectedFYStart, fidaUserId, feminaUserId, fyKey]);

  const wpMonthlyData = useMemo(() => {
    if (!isWeddingPlanner || isSuperAdmin) return null;
    const monthLabel = FY_MONTHS[wpSelectedMonthIdx];
    const monthNum = wpSelectedMonthIdx < 9 ? wpSelectedMonthIdx + 4 : wpSelectedMonthIdx - 8;
    const year = wpSelectedMonthIdx < 9 ? currentFY.startYear : currentFY.startYear + 1;

    let actual = 0;
    allEvents.forEach((ev: any) => {
      const evDate = new Date(ev.date);
      if (evDate.getFullYear() === year && evDate.getMonth() + 1 === monthNum && isMyEvent(ev.planner)) {
        actual += parseFloat(ev.salesValue || '0');
      }
    });

    let target = 0;
    salesTargetsData.forEach((t: any) => {
      const tfy = (t.fiscalYear || '').trim();
      if (tfy !== fyKey || t.userId !== user?.id) return;
      const targetAmt = parseFloat(t.targetAmount || '0');
      if (t.month) {
        const normalized = normalizeMonth(t.month);
        if (normalized === monthLabel) target += targetAmt;
      } else {
        target += targetAmt / 12;
      }
    });

    const pct = target > 0 ? (actual / target) * 100 : 0;
    const fullMonthNames: Record<string, string> = {
      Apr: 'April', May: 'May', Jun: 'June', Jul: 'July', Aug: 'August', Sep: 'September',
      Oct: 'October', Nov: 'November', Dec: 'December', Jan: 'January', Feb: 'February', Mar: 'March'
    };
    return { monthLabel, fullMonth: fullMonthNames[monthLabel] || monthLabel, year, actual, target, pct };
  }, [isWeddingPlanner, isSuperAdmin, wpSelectedMonthIdx, allEvents, salesTargetsData, fyKey, user, currentFY]);

  const wpFYData = useMemo(() => {
    if (!isWeddingPlanner || isSuperAdmin) return null;
    let totalActual = 0;
    FY_MONTHS.forEach((_ml, idx) => {
      const monthNum = idx < 9 ? idx + 4 : idx - 8;
      const year = idx < 9 ? currentFY.startYear : currentFY.startYear + 1;
      allEvents.forEach((ev: any) => {
        const evDate = new Date(ev.date);
        if (evDate.getFullYear() === year && evDate.getMonth() + 1 === monthNum && isMyEvent(ev.planner)) {
          totalActual += parseFloat(ev.salesValue || '0');
        }
      });
    });

    let monthlyTargetSum = 0;
    let annualTargetSum = 0;
    salesTargetsData.forEach((t: any) => {
      const tfy = (t.fiscalYear || '').trim();
      if (tfy !== fyKey || t.userId !== user?.id) return;
      const targetAmt = parseFloat(t.targetAmount || '0');
      if (t.month) {
        monthlyTargetSum += targetAmt;
      } else {
        annualTargetSum += targetAmt;
      }
    });
    const totalTarget = monthlyTargetSum > 0 ? monthlyTargetSum : annualTargetSum;
    const pct = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;
    return { totalActual, totalTarget, pct };
  }, [isWeddingPlanner, isSuperAdmin, allEvents, salesTargetsData, fyKey, user, currentFY]);

  const { monthlyIncome, monthlyExpense, monthlyProfit, monthlyProfitPercent } = useMemo(() => {
    let income = 0;
    let expense = 0;
    monthlyDaybookEntries.forEach((entry: any) => {
      const amount = parseFloat(entry.amount) || 0;
      if (entry.type === 'income') income += amount;
      else if (entry.type === 'expense') expense += amount;
    });
    const profit = income - expense;
    const profitPercent = income > 0 ? ((profit / income) * 100) : 0;
    return { monthlyIncome: income, monthlyExpense: expense, monthlyProfit: profit, monthlyProfitPercent: profitPercent };
  }, [monthlyDaybookEntries]);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } }
  };

  return (
    <div className="space-y-6 sm:space-y-8 px-2 sm:px-0">
      <motion.div 
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pl-12 md:pl-0"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-serif text-primary">Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Welcome back, {user?.name}</p>
        </div>
        <motion.div 
          className="text-xs sm:text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full w-fit"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </motion.div>
      </motion.div>

      <motion.div 
        className={`grid gap-3 sm:gap-4 ${isSuperAdmin ? 'grid-cols-2 lg:grid-cols-4' : isWeddingPlanner ? 'grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {isWeddingPlanner && !isSuperAdmin && (
          <>
            <motion.div variants={itemVariants} whileHover={{ y: -4, transition: { duration: 0.2 } }}>
              <Card className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                    My Revenue (FY)
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-primary hidden sm:block" />
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                  <motion.div 
                    className="text-xl sm:text-2xl font-bold"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    ₹{(totalSales / 100000).toFixed(2)}L
                  </motion.div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Your events total</p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants} whileHover={{ y: -4, transition: { duration: 0.2 } }}>
              <Card className="border-l-4 border-l-chart-3 shadow-sm hover:shadow-md transition-shadow h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                    My Active Leads
                  </CardTitle>
                  <Target className="h-4 w-4 text-chart-3 hidden sm:block" />
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                  <div className="text-xl sm:text-2xl font-bold">{activeLeads.length}</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{newLeadsToday > 0 ? `+${newLeadsToday} new today` : 'From Oak Sales'}</p>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}

        <motion.div variants={itemVariants} whileHover={{ y: -4, transition: { duration: 0.2 } }}>
          <Card className="border-l-4 border-l-chart-2 shadow-sm hover:shadow-md transition-shadow h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                {isWeddingPlanner ? 'My Upcoming Events' : 'Upcoming Events'}
              </CardTitle>
              <Calendar className="h-4 w-4 text-chart-2 hidden sm:block" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <motion.div 
                className="text-xl sm:text-2xl font-bold"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                {upcomingEvents}
              </motion.div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Next 30 days</p>
            </CardContent>
          </Card>
        </motion.div>

        {isSuperAdmin && (
          <>
            <motion.div variants={itemVariants} whileHover={{ y: -4, transition: { duration: 0.2 } }}>
              <Card className="border-l-4 border-l-chart-3 shadow-sm hover:shadow-md transition-shadow h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                    Active Leads
                  </CardTitle>
                  <Users className="h-4 w-4 text-chart-3 hidden sm:block" />
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                  <div className="text-xl sm:text-2xl font-bold">{activeLeads.length}</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{newLeadsToday > 0 ? `+${newLeadsToday} new today` : 'From Oak Sales'}</p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants} whileHover={{ y: -4, transition: { duration: 0.2 } }}>
              <Card className="border-l-4 border-l-chart-4 shadow-sm hover:shadow-md transition-shadow h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                    Monthly Profit
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-chart-4 hidden sm:block" />
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                  <div className="text-xl sm:text-2xl font-bold">
                    {monthlyIncome > 0 
                      ? `₹${monthlyProfit >= 100000 
                          ? (monthlyProfit / 100000).toFixed(1) + 'L' 
                          : monthlyProfit >= 1000 
                            ? (monthlyProfit / 1000).toFixed(1) + 'K'
                            : monthlyProfit.toFixed(0)}`
                      : '₹0'}
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    {monthlyIncome > 0 
                      ? `${monthlyProfitPercent >= 0 ? '+' : ''}${monthlyProfitPercent.toFixed(1)}% margin this month`
                      : 'No entries this month'}
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants} whileHover={{ y: -4, transition: { duration: 0.2 } }}>
              <Card className="border-l-4 border-l-chart-5 shadow-sm hover:shadow-md transition-shadow h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6 sm:pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                    Inventory Value
                  </CardTitle>
                  <Package className="h-4 w-4 text-chart-5 hidden sm:block" />
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                  <div className="text-xl sm:text-2xl font-bold">₹{(totalInventoryValue / 100000).toFixed(2)}L</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{inventoryItems.length} items in stock</p>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </motion.div>

      {isWeddingPlanner && !isSuperAdmin && wpMonthlyData && wpFYData && (
        <motion.div
          className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.4 }}
        >
          <Card className="shadow-sm border-l-4 border-l-primary" data-testid="card-wp-monthly-target">
            <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-primary">
                  <Target className="h-4 w-4" />
                  Monthly Target
                </CardTitle>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setWpSelectedMonthIdx(prev => prev === 0 ? 11 : prev - 1)}
                    data-testid="btn-wp-month-prev"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs font-medium min-w-[80px] text-center">
                    {wpMonthlyData.fullMonth} {wpMonthlyData.year}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setWpSelectedMonthIdx(prev => prev === 11 ? 0 : prev + 1)}
                    data-testid="btn-wp-month-next"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Target</p>
                    <p className="text-lg sm:text-xl font-bold text-gray-700">
                      ₹{wpMonthlyData.target >= 100000 ? (wpMonthlyData.target / 100000).toFixed(1) + 'L' : wpMonthlyData.target >= 1000 ? (wpMonthlyData.target / 1000).toFixed(0) + 'K' : wpMonthlyData.target.toFixed(0)}
                    </p>
                  </div>
                  <div className="bg-primary/5 rounded-lg p-2">
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Actual</p>
                    <p className="text-lg sm:text-xl font-bold text-primary">
                      ₹{wpMonthlyData.actual >= 100000 ? (wpMonthlyData.actual / 100000).toFixed(1) + 'L' : wpMonthlyData.actual >= 1000 ? (wpMonthlyData.actual / 1000).toFixed(0) + 'K' : wpMonthlyData.actual.toFixed(0)}
                    </p>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Achievement</span>
                    <Badge variant={wpMonthlyData.pct >= 100 ? 'default' : wpMonthlyData.pct >= 50 ? 'secondary' : 'destructive'} className="text-[10px]">
                      {wpMonthlyData.pct.toFixed(0)}%
                    </Badge>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full transition-all ${wpMonthlyData.pct >= 100 ? 'bg-primary' : wpMonthlyData.pct >= 50 ? 'bg-amber-500' : 'bg-red-400'}`}
                      style={{ width: `${Math.min(100, wpMonthlyData.pct)}%` }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-l-4 border-l-chart-2" data-testid="card-wp-fy-target">
            <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-primary">
                  <BarChart3 className="h-4 w-4" />
                  FY Target
                </CardTitle>
                <Select value={String(selectedFYStart)} onValueChange={(v) => setSelectedFYStart(Number(v))}>
                  <SelectTrigger className="w-[110px] h-7 text-xs" data-testid="select-wp-fy">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fyOptions.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-[10px] sm:text-xs text-muted-foreground">FY Target</p>
                    <p className="text-lg sm:text-xl font-bold text-gray-700">
                      ₹{wpFYData.totalTarget >= 100000 ? (wpFYData.totalTarget / 100000).toFixed(1) + 'L' : wpFYData.totalTarget >= 1000 ? (wpFYData.totalTarget / 1000).toFixed(0) + 'K' : wpFYData.totalTarget.toFixed(0)}
                    </p>
                  </div>
                  <div className="bg-primary/5 rounded-lg p-2">
                    <p className="text-[10px] sm:text-xs text-muted-foreground">FY Actual</p>
                    <p className="text-lg sm:text-xl font-bold text-primary">
                      ₹{wpFYData.totalActual >= 100000 ? (wpFYData.totalActual / 100000).toFixed(1) + 'L' : wpFYData.totalActual >= 1000 ? (wpFYData.totalActual / 1000).toFixed(0) + 'K' : wpFYData.totalActual.toFixed(0)}
                    </p>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Annual Achievement</span>
                    <Badge variant={wpFYData.pct >= 100 ? 'default' : wpFYData.pct >= 50 ? 'secondary' : 'destructive'} className="text-[10px]">
                      {wpFYData.pct.toFixed(0)}%
                    </Badge>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full transition-all ${wpFYData.pct >= 100 ? 'bg-primary' : wpFYData.pct >= 50 ? 'bg-amber-500' : 'bg-red-400'}`}
                      style={{ width: `${Math.min(100, wpFYData.pct)}%` }}
                    />
                  </div>
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground pt-1">
                  <span>{wpFYData.totalActual >= wpFYData.totalTarget ? 'Exceeded by' : 'Remaining'}: ₹{(() => {
                    const gap = Math.abs(wpFYData.totalTarget - wpFYData.totalActual);
                    return gap >= 100000 ? (gap / 100000).toFixed(1) + 'L' : gap >= 1000 ? (gap / 1000).toFixed(0) + 'K' : gap.toFixed(0);
                  })()}</span>
                  <span>{currentFY.label}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {isSuperAdmin && (
        <motion.div
          className="grid gap-3 sm:gap-4 grid-cols-1 lg:grid-cols-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <Card className="shadow-sm" data-testid="card-monthly-pl">
            <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-primary">
                <TrendingUp className="h-4 w-4" />
                Monthly P&L Summary
              </CardTitle>
              <CardDescription className="text-xs">
                {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Income</p>
                  <p className="text-lg font-bold text-green-600">
                    ₹{monthlyIncome >= 100000 ? (monthlyIncome / 100000).toFixed(1) + 'L' : monthlyIncome >= 1000 ? (monthlyIncome / 1000).toFixed(0) + 'K' : monthlyIncome.toFixed(0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Expense</p>
                  <p className="text-lg font-bold text-red-500">
                    ₹{monthlyExpense >= 100000 ? (monthlyExpense / 100000).toFixed(1) + 'L' : monthlyExpense >= 1000 ? (monthlyExpense / 1000).toFixed(0) + 'K' : monthlyExpense.toFixed(0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Profit</p>
                  <p className={`text-lg font-bold ${monthlyProfit >= 0 ? 'text-primary' : 'text-red-600'}`}>
                    ₹{Math.abs(monthlyProfit) >= 100000 ? (monthlyProfit / 100000).toFixed(1) + 'L' : Math.abs(monthlyProfit) >= 1000 ? (monthlyProfit / 1000).toFixed(0) + 'K' : monthlyProfit.toFixed(0)}
                  </p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Profit Margin</span>
                  <Badge variant={monthlyProfitPercent >= 20 ? 'default' : monthlyProfitPercent >= 0 ? 'secondary' : 'destructive'}>
                    {monthlyProfitPercent >= 0 ? '+' : ''}{monthlyProfitPercent.toFixed(1)}%
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm" data-testid="card-cashflow-forecast">
            <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-primary">
                <Banknote className="h-4 w-4" />
                Cashflow Snapshot
              </CardTitle>
              <CardDescription className="text-xs">Expected collections & dues</CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              {(() => {
                const totalReceivable = events.reduce((sum, e) => {
                  const sv = parseFloat(e.salesValue || '0');
                  const pr = parseFloat(e.paymentReceived || '0');
                  return sum + Math.max(0, sv - pr);
                }, 0);
                const upcomingRevenue = events.filter(e => {
                  const ed = new Date(e.date);
                  return ed > now && ed <= thirtyDaysLater;
                }).reduce((sum, e) => sum + parseFloat(e.salesValue || '0'), 0);
                const collectedThisMonth = monthlyDaybookEntries.filter((e: any) => e.type === 'income').reduce((sum: number, e: any) => sum + parseFloat(e.amount || '0'), 0);
                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Total Receivable</span>
                      <span className="text-sm font-semibold text-orange-600">
                        ₹{totalReceivable === 0 ? '0' : totalReceivable >= 100000 ? (totalReceivable / 100000).toFixed(1) + 'L' : (totalReceivable / 1000).toFixed(0) + 'K'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Upcoming Events Value (30d)</span>
                      <span className="text-sm font-semibold">
                        ₹{upcomingRevenue === 0 ? '0' : upcomingRevenue >= 100000 ? (upcomingRevenue / 100000).toFixed(1) + 'L' : (upcomingRevenue / 1000).toFixed(0) + 'K'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Collected This Month</span>
                      <span className="text-sm font-semibold text-green-600">
                        ₹{collectedThisMonth === 0 ? '0' : collectedThisMonth >= 100000 ? (collectedThisMonth / 100000).toFixed(1) + 'L' : (collectedThisMonth / 1000).toFixed(0) + 'K'}
                      </span>
                    </div>
                    <div className="pt-2 border-t flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Net Expected Inflow</span>
                      <span className="font-semibold text-primary">
                        ₹{totalReceivable === 0 ? '0' : totalReceivable >= 100000 ? (totalReceivable / 100000).toFixed(1) + 'L' : (totalReceivable / 1000).toFixed(0) + 'K'}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {(isSuperAdmin || isWeddingPlanner || isAccountant) && upcomingPaymentsData?.milestones?.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <Card className="shadow-sm border-l-4 border-l-amber-500" data-testid="card-upcoming-payments">
            <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-700">
                  <Banknote className="h-4 w-4" />
                  Upcoming Collections
                </CardTitle>
                <Badge variant="outline" className="text-xs border-amber-300 text-amber-700">
                  {upcomingPaymentsData.summary.totalMilestones} pending
                </Badge>
              </div>
              <CardDescription className="text-xs mt-1">
                Payment milestones due from client portal
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="text-center p-2 rounded-lg bg-red-50 border border-red-100">
                  <div className="text-sm sm:text-lg font-bold text-red-600">
                    ₹{upcomingPaymentsData.summary.overdueAmount >= 100000 ? (upcomingPaymentsData.summary.overdueAmount / 100000).toFixed(1) + 'L' : upcomingPaymentsData.summary.overdueAmount > 0 ? (upcomingPaymentsData.summary.overdueAmount / 1000).toFixed(0) + 'K' : '0'}
                  </div>
                  <div className="text-[10px] text-red-500">Overdue ({upcomingPaymentsData.summary.overdueCount})</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-amber-50 border border-amber-100">
                  <div className="text-sm sm:text-lg font-bold text-amber-600">
                    ₹{upcomingPaymentsData.summary.next7DaysAmount >= 100000 ? (upcomingPaymentsData.summary.next7DaysAmount / 100000).toFixed(1) + 'L' : upcomingPaymentsData.summary.next7DaysAmount > 0 ? (upcomingPaymentsData.summary.next7DaysAmount / 1000).toFixed(0) + 'K' : '0'}
                  </div>
                  <div className="text-[10px] text-amber-500">Next 7 days ({upcomingPaymentsData.summary.next7DaysCount})</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-blue-50 border border-blue-100">
                  <div className="text-sm sm:text-lg font-bold text-blue-600">
                    ₹{upcomingPaymentsData.summary.totalPending >= 100000 ? (upcomingPaymentsData.summary.totalPending / 100000).toFixed(1) + 'L' : upcomingPaymentsData.summary.totalPending > 0 ? (upcomingPaymentsData.summary.totalPending / 1000).toFixed(0) + 'K' : '0'}
                  </div>
                  <div className="text-[10px] text-blue-500">Total Pending</div>
                </div>
              </div>
              <div className="space-y-2 max-h-[250px] overflow-y-auto">
                {upcomingPaymentsData.milestones
                  .sort((a: any, b: any) => {
                    if (!a.dueDate) return 1;
                    if (!b.dueDate) return -1;
                    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
                  })
                  .slice(0, 8)
                  .map((m: any, i: number) => {
                    const isOverdue = m.dueDate && new Date(m.dueDate) < new Date();
                    return (
                      <div key={i} className={`flex items-center justify-between p-2 rounded-lg text-xs ${isOverdue ? 'bg-red-50 border border-red-100' : 'bg-gray-50 border border-gray-100'}`}>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{m.clientName}</div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                            <span>{m.milestoneName}</span>
                            {m.dueDate && (
                              <>
                                <span>·</span>
                                <span className={isOverdue ? 'text-red-500 font-medium' : ''}>
                                  {isOverdue ? 'Overdue' : ''} {new Date(m.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className={`font-semibold ${isOverdue ? 'text-red-600' : 'text-amber-700'}`}>
                          ₹{parseFloat(m.amount || '0') >= 100000 ? (parseFloat(m.amount) / 100000).toFixed(1) + 'L' : (parseFloat(m.amount) / 1000).toFixed(0) + 'K'}
                        </div>
                      </div>
                    );
                  })}
              </div>
              {(isSuperAdmin || isAccountant) && upcomingPaymentsData.plannerSummary?.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-[10px] font-medium text-muted-foreground mb-2">By Wedding Planner</p>
                  <div className="space-y-1.5">
                    {upcomingPaymentsData.plannerSummary.map((ps: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{ps.plannerName}</span>
                        <span className="font-medium">
                          ₹{ps.totalPending >= 100000 ? (ps.totalPending / 100000).toFixed(1) + 'L' : (ps.totalPending / 1000).toFixed(0) + 'K'}
                          <span className="text-[10px] text-muted-foreground ml-1">({ps.milestoneCount})</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {(isSuperAdmin || isWeddingPlanner) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.4 }}
        >
          <Card className="shadow-sm" data-testid="card-sales-target-chart">
            <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm font-medium flex items-center gap-2 text-primary">
                    <BarChart3 className="h-4 w-4" />
                    Sales Target vs Actual
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    {isSuperAdmin ? 'Combined sales performance of Fida & Femina' : 'Your monthly sales performance'}
                  </CardDescription>
                </div>
                <Select value={String(selectedFYStart)} onValueChange={(v) => setSelectedFYStart(Number(v))}>
                  <SelectTrigger className="w-[130px] h-8 text-xs" data-testid="select-fy-chart">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fyOptions.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              {isSuperAdmin && (
                <div className="flex items-center gap-4 mb-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: FIDA_COLOR }} />
                    <span className="text-muted-foreground">Fida (Actual)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: FEMINA_COLOR }} />
                    <span className="text-muted-foreground">Femina (Actual)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm border-2 border-dashed border-gray-400 bg-transparent" />
                    <span className="text-muted-foreground">Combined Target</span>
                  </div>
                </div>
              )}
              <div className="w-full" style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  {isSuperAdmin ? (
                    <BarChart data={salesChartData} barGap={0} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v: number) => v >= 100000 ? `${(v / 100000).toFixed(0)}L` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`}
                      />
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                        formatter={(value: number, name: string) => {
                          const label = name === 'fidaActual' ? 'Fida Actual' :
                                        name === 'feminaActual' ? 'Femina Actual' :
                                        name === 'totalTarget' ? 'Combined Target' : name;
                          return [`₹${(value / 100000).toFixed(2)}L`, label];
                        }}
                      />
                      <Bar dataKey="fidaActual" stackId="actual" fill={FIDA_COLOR} radius={[0, 0, 0, 0]} name="fidaActual" />
                      <Bar dataKey="feminaActual" stackId="actual" fill={FEMINA_COLOR} radius={[4, 4, 0, 0]} name="feminaActual" />
                      <Bar dataKey="totalTarget" fill="transparent" stroke="#9ca3af" strokeWidth={1.5} strokeDasharray="4 3" radius={[4, 4, 0, 0]} name="totalTarget" />
                    </BarChart>
                  ) : (
                    <BarChart data={salesChartData} barGap={4} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v: number) => v >= 100000 ? `${(v / 100000).toFixed(0)}L` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`}
                      />
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                        formatter={(value: number, name: string) => {
                          const label = name === 'myActual' ? 'Actual' : name === 'myTarget' ? 'Target' : name;
                          return [`₹${(value / 100000).toFixed(2)}L`, label];
                        }}
                      />
                      <Bar dataKey="myTarget" fill="#e5e7eb" radius={[4, 4, 0, 0]} name="myTarget" />
                      <Bar dataKey="myActual" fill="#4b7c29" radius={[4, 4, 0, 0]} name="myActual" />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
              {(() => {
                if (isSuperAdmin) {
                  const totalFidaActual = salesChartData.reduce((s: number, d: any) => s + (d.fidaActual || 0), 0);
                  const totalFeminaActual = salesChartData.reduce((s: number, d: any) => s + (d.feminaActual || 0), 0);
                  const totalFidaTarget = salesChartData.reduce((s: number, d: any) => s + (d.fidaTarget || 0), 0);
                  const totalFeminaTarget = salesChartData.reduce((s: number, d: any) => s + (d.feminaTarget || 0), 0);
                  return (
                    <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-4 text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: FIDA_COLOR }} />
                          <span className="font-medium">Fida</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Actual: ₹{(totalFidaActual / 100000).toFixed(1)}L</span>
                          <span>Target: ₹{(totalFidaTarget / 100000).toFixed(1)}L</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full" style={{ width: `${Math.min(100, totalFidaTarget > 0 ? (totalFidaActual / totalFidaTarget) * 100 : 0)}%`, backgroundColor: FIDA_COLOR }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{totalFidaTarget > 0 ? ((totalFidaActual / totalFidaTarget) * 100).toFixed(0) : 0}% achieved</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: FEMINA_COLOR }} />
                          <span className="font-medium">Femina</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Actual: ₹{(totalFeminaActual / 100000).toFixed(1)}L</span>
                          <span>Target: ₹{(totalFeminaTarget / 100000).toFixed(1)}L</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full" style={{ width: `${Math.min(100, totalFeminaTarget > 0 ? (totalFeminaActual / totalFeminaTarget) * 100 : 0)}%`, backgroundColor: FEMINA_COLOR }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{totalFeminaTarget > 0 ? ((totalFeminaActual / totalFeminaTarget) * 100).toFixed(0) : 0}% achieved</span>
                      </div>
                    </div>
                  );
                } else {
                  const totalActual = salesChartData.reduce((s: number, d: any) => s + (d.myActual || 0), 0);
                  const totalTarget = salesChartData.reduce((s: number, d: any) => s + (d.myTarget || 0), 0);
                  return (
                    <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs">
                      <div className="space-y-0.5">
                        <span className="text-muted-foreground">Total Actual: </span>
                        <span className="font-semibold">₹{(totalActual / 100000).toFixed(1)}L</span>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-muted-foreground">Annual Target: </span>
                        <span className="font-semibold">₹{(totalTarget / 100000).toFixed(1)}L</span>
                      </div>
                      <Badge variant={totalTarget > 0 && totalActual >= totalTarget ? 'default' : 'secondary'}>
                        {totalTarget > 0 ? ((totalActual / totalTarget) * 100).toFixed(0) : 0}% achieved
                      </Badge>
                    </div>
                  );
                }
              })()}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Pending Approvals Section - for admins */}
      {isAdmin && totalPendingApprovals > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-serif font-semibold text-primary flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Pending Approvals
              <Badge variant="destructive" className="ml-2" data-testid="badge-pending-approvals">
                {totalPendingApprovals}
              </Badge>
            </h2>
          </div>
          <motion.div 
            className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            {pendingLeaves.length > 0 && (
              <motion.div variants={itemVariants} whileHover={{ y: -4 }}>
                <Link href="/hr?tab=leaves">
                  <Card className="cursor-pointer hover:shadow-lg transition-all border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/50">
                        <Calendar className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-lg">{pendingLeaves.length}</p>
                        <p className="text-xs text-muted-foreground">Leave Requests</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            )}

            {pendingAdvances.length > 0 && (
              <motion.div variants={itemVariants} whileHover={{ y: -4 }}>
                <Link href="/hr?tab=advances">
                  <Card className="cursor-pointer hover:shadow-lg transition-all border-l-4 border-l-green-500 bg-green-50/50 dark:bg-green-950/20">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/50">
                        <Banknote className="h-5 w-5 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-lg">{pendingAdvances.length}</p>
                        <p className="text-xs text-muted-foreground">Salary Advances</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            )}

            {pendingExpenses.length > 0 && (
              <motion.div variants={itemVariants} whileHover={{ y: -4 }}>
                <Link href="/hr?tab=expenses">
                  <Card className="cursor-pointer hover:shadow-lg transition-all border-l-4 border-l-orange-500 bg-orange-50/50 dark:bg-orange-950/20">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-900/50">
                        <FileText className="h-5 w-5 text-orange-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-lg">{pendingExpenses.length}</p>
                        <p className="text-xs text-muted-foreground">Expense Claims</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            )}

            {pendingQuickEntries.length > 0 && (
              <motion.div variants={itemVariants} whileHover={{ y: -4 }}>
                <Link href="/hr?tab=quick-entries">
                  <Card className="cursor-pointer hover:shadow-lg transition-all border-l-4 border-l-purple-500 bg-purple-50/50 dark:bg-purple-950/20">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/50">
                        <Camera className="h-5 w-5 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-lg">{pendingQuickEntries.length}</p>
                        <p className="text-xs text-muted-foreground">Quick Entries</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}

      {/* My Incentives & KPI Section */}
      {(pendingIncentives.length > 0 || myKpiTargets.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26, duration: 0.4 }}
          className="space-y-4"
        >
          {pendingIncentives.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg sm:text-xl font-serif font-semibold text-primary flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  My Incentives
                </h2>
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">
                  {pendingIncentives.length} pending
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {pendingIncentives.slice(0, 4).map((inc: any) => {
                  const completedTasks = (inc.tasks || []).filter((t: any) => t.isCompleted).length;
                  const totalTasks = (inc.tasks || []).length;
                  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
                  return (
                    <Card key={inc.id} className="border-l-4 border-l-amber-500 hover:shadow-md transition-shadow" data-testid={`card-incentive-${inc.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-semibold text-sm">{inc.incentiveTitle}</p>
                            <p className="text-xs text-muted-foreground capitalize">{inc.incentiveType?.replace('_', ' ')}</p>
                          </div>
                          <span className="text-sm font-bold text-green-600">
                            {inc.amount ? `₹${Number(inc.amount).toLocaleString('en-IN')}` : ''}
                          </span>
                        </div>
                        {inc.eventTitle && (
                          <p className="text-xs text-muted-foreground mb-2">Event: {inc.eventTitle}</p>
                        )}
                        {totalTasks > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{completedTasks}/{totalTasks} tasks</span>
                              <span className="font-medium">{progress}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-amber-500 h-2 rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <div className="space-y-1 mt-2">
                              {(inc.tasks || []).slice(0, 3).map((task: any) => (
                                <div key={task.id} className="flex items-center gap-2 text-xs" data-testid={`task-item-${task.id}`}>
                                  <button
                                    onClick={() => !task.isCompleted && completeTask.mutate(task.id)}
                                    className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                                      task.isCompleted
                                        ? 'bg-green-500 border-green-500 text-white'
                                        : 'border-gray-300 hover:border-amber-500 cursor-pointer'
                                    }`}
                                    disabled={task.isCompleted}
                                    data-testid={`btn-complete-task-${task.id}`}
                                  >
                                    {task.isCompleted && <CheckCircle2 className="w-3 h-3" />}
                                  </button>
                                  <span className={task.isCompleted ? 'line-through text-muted-foreground' : ''}>
                                    {task.title}
                                  </span>
                                </div>
                              ))}
                              {(inc.tasks || []).length > 3 && (
                                <p className="text-xs text-muted-foreground pl-6">+{(inc.tasks || []).length - 3} more tasks</p>
                              )}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {myKpiTargets.length > 0 && (
            <div>
              <h2 className="text-lg sm:text-xl font-serif font-semibold text-primary flex items-center gap-2 mb-3">
                <BarChart3 className="h-5 w-5" />
                My Yearly KPI
              </h2>
              <Card>
                <CardContent className="p-4 space-y-4">
                  {myKpiTargets.slice(0, 4).map((kpi: any) => {
                    const achieved = Number(kpi.achievedValue || 0);
                    const target = Number(kpi.targetValue || 1);
                    const pct = Math.min(Math.round((achieved / target) * 100), 100);
                    const isOnTrack = pct >= 50;
                    return (
                      <div key={kpi.id} data-testid={`kpi-progress-${kpi.id}`}>
                        <div className="flex items-center justify-between mb-1">
                          <div>
                            <p className="text-sm font-medium">{kpi.metricName}</p>
                            <p className="text-xs text-muted-foreground">FY {kpi.fiscalYear}</p>
                          </div>
                          <span className={`text-sm font-bold ${isOnTrack ? 'text-green-600' : 'text-amber-600'}`}>
                            {pct}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div
                            className={`h-2.5 rounded-full transition-all ${isOnTrack ? 'bg-green-500' : 'bg-amber-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                          <span>Achieved: {achieved.toLocaleString('en-IN')}</span>
                          <span>Target: {target.toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          )}
        </motion.div>
      )}

      {/* Quick Entry Upload Section - for superadmin */}
      {isSuperAdmin && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.4 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-serif font-semibold text-primary flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Quick Entry
            </h2>
          </div>
          <Link href="/employee-portal?tab=quick-entry">
            <Card className="cursor-pointer hover:shadow-lg transition-all border-l-4 border-l-[#7C8B5D] bg-[#7C8B5D]/5 hover:bg-[#7C8B5D]/10">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 rounded-full bg-[#7C8B5D]/20">
                  <Camera className="h-6 w-6 text-[#7C8B5D]" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">Upload Payment Screenshot</p>
                  <p className="text-sm text-muted-foreground">AI will extract payment details automatically</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        </motion.div>
      )}

    </div>
  );
}

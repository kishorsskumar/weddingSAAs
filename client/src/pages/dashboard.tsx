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
  MessageSquare
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { Event } from "@/lib/types";
import type { InventoryItem, EventMilestone } from "@shared/schema";

interface PendingMilestone extends EventMilestone {
  event?: Event;
}

const ALL_PAGES = [
  { id: "dashboard", label: "Dashboard", path: "/", icon: LayoutDashboard, description: "Overview & stats" },
  { id: "event-calendar", label: "Oak Event Calendar", path: "/events", icon: Calendar, description: "Manage events" },
  { id: "monthly-plan", label: "Monthly Plan", path: "/monthly-plan", icon: Calendar, description: "Production planning" },
  { id: "team-calendar", label: "Oak Team Calendar", path: "/team", icon: Users, description: "Team scheduling" },
  { id: "event-database", label: "Oak Event Database", path: "/database", icon: Database, description: "Event records" },
  { id: "event-milestones", label: "Oak Milestones", path: "/milestones", icon: CheckSquare, description: "Track milestones" },
  { id: "daybook", label: "Oak Daybook", path: "/daybook", icon: BookOpen, description: "Daily finances" },
  { id: "oak-book", label: "Oak Book", path: "/oak-book", icon: Receipt, description: "Invoices & estimates" },
  { id: "oak-sales", label: "Oak Sales", path: "/oak-sales", icon: Target, description: "CRM & pipeline" },
  { id: "oak-inventory", label: "Oak Inventory", path: "/oak-inventory", icon: Package, description: "Inventory & rentals" },
  { id: "execution-plan", label: "Execution Plan", path: "/execution-plan", icon: ClipboardList, description: "Event production planning" },
  { id: "hr", label: "Oak HR", path: "/hr", icon: Briefcase, description: "HR & payroll" },
  { id: "employee-portal", label: "Employee Portal", path: "/employee-portal", icon: UserCircle, description: "Your profile & requests" },
  { id: "oaksy", label: "Oaksy AI", path: "/oaksy", icon: Sparkles, description: "AI assistant" },
  { id: "oak-creative", label: "Oak Creative", path: "/oak-creative", icon: Palette, description: "Presentation builder" },
  { id: "whatsapp-inbox", label: "WhatsApp Inbox", path: "/whatsapp-inbox", icon: MessageSquare, description: "Employee requests via WhatsApp" },
  { id: "oak-rsvp", label: "Oak RSVP", path: "/oak-rsvp", icon: Users, description: "Event guest management" },
  { id: "admin", label: "Admin Panel", path: "/admin", icon: Shield, description: "User management" },
];

export default function Dashboard() {
  const { user, allowedPages } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const isSuperAdmin = user?.role === 'superadmin';
  
  const accessiblePages = isSuperAdmin 
    ? ALL_PAGES.filter(p => p.id !== 'dashboard')
    : ALL_PAGES.filter(p => allowedPages.includes(p.id) && p.id !== 'dashboard');
  const isWeddingPlanner = user?.role === 'wedding_planner';
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

  // Fetch sales deals to count active leads
  const { data: salesDeals = [] } = useQuery<any[]>({
    queryKey: ['/api/sales/deals'],
    queryFn: async () => {
      const res = await fetch('/api/sales/deals', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAdmin,
  });

  const { data: salesStages = [] } = useQuery<any[]>({
    queryKey: ['/api/sales/stages'],
    queryFn: async () => {
      const res = await fetch('/api/sales/stages', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAdmin,
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
  const upcomingEvents = events.filter((e) => new Date(e.date) > new Date()).length;
  
  const totalInventoryValue = useMemo(() => {
    return inventoryItems.reduce((acc, item) => {
      const unitCost = typeof item.unitCost === 'string' ? parseFloat(item.unitCost) : (item.unitCost || 0);
      return acc + (item.stockQuantity * (isNaN(unitCost) ? 0 : unitCost));
    }, 0);
  }, [inventoryItems]);

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
        className={`grid gap-3 sm:gap-4 ${isSuperAdmin ? 'grid-cols-2 lg:grid-cols-5' : isWeddingPlanner ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {(isSuperAdmin || isWeddingPlanner) && (
          <motion.div variants={itemVariants} whileHover={{ y: -4, transition: { duration: 0.2 } }}>
            <Card className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6 sm:pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                  {isWeddingPlanner ? 'My Revenue (FY)' : 'Total Revenue (FY)'}
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
                <p className="text-[10px] sm:text-xs text-muted-foreground">{isWeddingPlanner ? 'Your events total' : '+20.1% from last month'}</p>
              </CardContent>
            </Card>
          </motion.div>
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
                  <div className="text-xl sm:text-2xl font-bold">18%</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">+2.5% from target</p>
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

      {/* Quick Access Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        <h2 className="text-lg sm:text-xl font-serif font-semibold text-primary mb-4">Quick Access</h2>
        <motion.div 
          className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {accessiblePages.map((page, index) => {
            const Icon = page.icon;
            return (
              <motion.div
                key={page.id}
                variants={itemVariants}
                whileHover={{ y: -6, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                <Link href={page.path}>
                  <Card 
                    className="cursor-pointer hover:shadow-lg transition-all hover:border-primary/50 group h-full"
                    data-testid={`quick-access-${page.id}`}
                  >
                    <CardContent className="p-4 sm:p-5 flex flex-col items-center text-center gap-2 sm:gap-3">
                      <motion.div 
                        className="p-2 sm:p-3 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors"
                        whileHover={{ rotate: [0, -10, 10, 0] }}
                        transition={{ duration: 0.4 }}
                      >
                        <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                      </motion.div>
                      <div>
                        <p className="font-medium text-xs sm:text-sm">{page.label}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 hidden sm:block">{page.description}</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </motion.div>

      {/* Pending Tasks Section - only show if user has access to milestones */}
      {pendingMilestones.length > 0 && hasAccess && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-serif font-semibold text-primary flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              Pending Tasks
              {overdueTasks.length > 0 && (
                <Badge variant="destructive" className="ml-2" data-testid="badge-overdue-count">
                  {overdueTasks.length} overdue
                </Badge>
              )}
            </h2>
            <Link href="/milestones">
              <Button variant="outline" size="sm" data-testid="button-view-all-milestones">
                View All
              </Button>
            </Link>
          </div>
          
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="divide-y">
                {/* Overdue Tasks */}
                {overdueTasks.slice(0, 5).map((milestone, index) => (
                  <motion.div
                    key={milestone.id}
                    className="flex items-center gap-3 p-3 sm:p-4 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/30 transition-colors"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * index }}
                    data-testid={`task-overdue-${milestone.id}`}
                  >
                    <Checkbox
                      checked={false}
                      onCheckedChange={() => completeMilestone.mutate(milestone.id)}
                      disabled={completeMilestone.isPending}
                      data-testid={`checkbox-task-${milestone.id}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">{milestone.name}</p>
                        <Badge variant="outline" className="text-[10px] shrink-0 border-red-300 text-red-600">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Overdue
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <span className="truncate">{milestone.event?.title || 'Event'}</span>
                        <span>•</span>
                        <span className="text-red-600 font-medium">
                          Due: {new Date(milestone.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px] hidden sm:flex shrink-0">
                      {milestone.phaseName}
                    </Badge>
                  </motion.div>
                ))}
                
                {/* Upcoming Tasks */}
                {upcomingTasks.map((milestone, index) => (
                  <motion.div
                    key={milestone.id}
                    className="flex items-center gap-3 p-3 sm:p-4 hover:bg-muted/50 transition-colors"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * (index + overdueTasks.length) }}
                    data-testid={`task-upcoming-${milestone.id}`}
                  >
                    <Checkbox
                      checked={false}
                      onCheckedChange={() => completeMilestone.mutate(milestone.id)}
                      disabled={completeMilestone.isPending}
                      data-testid={`checkbox-task-${milestone.id}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">{milestone.name}</p>
                        {new Date(milestone.date).toDateString() === today.toDateString() && (
                          <Badge variant="outline" className="text-[10px] shrink-0 border-amber-300 text-amber-600">
                            <Clock className="h-3 w-3 mr-1" />
                            Today
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <span className="truncate">{milestone.event?.title || 'Event'}</span>
                        <span>•</span>
                        <span>Due: {new Date(milestone.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                        {milestone.time && <span>at {milestone.time}</span>}
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px] hidden sm:flex shrink-0">
                      {milestone.phaseName}
                    </Badge>
                  </motion.div>
                ))}
              </div>
              
              {pendingMilestones.length > 15 && (
                <div className="p-3 text-center border-t bg-muted/30">
                  <Link href="/milestones">
                    <Button variant="ghost" size="sm" className="text-primary" data-testid="button-see-more-tasks">
                      See {pendingMilestones.length - 15} more pending tasks
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      <motion.div 
        className="grid gap-4 sm:gap-8 grid-cols-1 md:grid-cols-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
      >
        <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
          <Card className="h-full">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="font-serif text-lg sm:text-xl">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
              <div className="space-y-3 sm:space-y-4">
                {[1, 2, 3].map((i) => (
                  <motion.div 
                    key={i} 
                    className="flex items-start gap-3 sm:gap-4 pb-3 sm:pb-4 border-b last:border-0 last:pb-0"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + i * 0.1 }}
                  >
                    <motion.div 
                      className="h-2 w-2 mt-2 rounded-full bg-primary flex-shrink-0"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                    />
                    <div>
                      <p className="text-sm font-medium">New event created</p>
                      <p className="text-xs text-muted-foreground">2 hours ago</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
          <Card className="h-full">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="font-serif text-lg sm:text-xl">Upcoming Schedule</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
               <div className="space-y-3 sm:space-y-4">
                {events
                  .filter(e => new Date(e.date) >= new Date(new Date().toDateString()))
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .slice(0, 3)
                  .map((e, index) => (
                  <motion.div 
                    key={e.id} 
                    className="flex items-center justify-between p-2 sm:p-3 bg-muted/30 rounded-lg gap-2"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + index * 0.1 }}
                    whileHover={{ x: 4, backgroundColor: "rgba(var(--muted), 0.5)" }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{e.title}</p>
                      <p className="text-xs text-muted-foreground">{new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                    <motion.div 
                      className="text-[10px] sm:text-xs font-medium px-2 py-1 rounded bg-primary/10 text-primary capitalize flex-shrink-0"
                      whileHover={{ scale: 1.05 }}
                    >
                      {e.type}
                    </motion.div>
                  </motion.div>
                ))}
                {events.filter(e => new Date(e.date) >= new Date(new Date().toDateString())).length === 0 && (
                  <p className="text-center py-4 text-muted-foreground text-sm">No upcoming events</p>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}

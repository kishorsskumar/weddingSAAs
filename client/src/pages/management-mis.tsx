import { useState, useMemo, useCallback } from "react";
import { useSearch } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarWidget } from "@/components/ui/calendar";
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Filter,
  IndianRupee,
  BarChart3,
  PieChart,
  Activity,
  Wallet,
  Users,
  Target,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Minus,
  Briefcase,
  CreditCard,
  Banknote,
  ArrowRightLeft,
  Flame,
  ShieldCheck,
  CircleDollarSign,
  Building2,
  FileText,
  Sparkles,
  Plus,
  Trash2,
  RotateCcw,
  X,
  Pencil,
  RefreshCw,
  Repeat,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Check,
  Store,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import type { Event } from "@/lib/types";
import { format, subMonths, startOfMonth, endOfMonth, startOfYear, differenceInDays, isWithinInterval, subDays, addDays, getDaysInMonth, getDay, eachDayOfInterval, isSameDay } from "date-fns";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface DaybookEntry {
  id: number;
  type: string;
  amount: string;
  date: string;
  category?: string;
}

interface Bank {
  id: string;
  name: string;
  balance: string;
}

interface SalesDeal {
  id: string;
  title: string;
  value: string;
  stageId: string;
  status: string;
  probability?: number;
  createdAt: string;
  expectedCloseDate?: string;
  actualCloseDate?: string;
  eventType?: string;
  ownerId?: string;
}

interface SalesStage {
  id: string;
  name: string;
  order: number;
  probability?: number;
}

const STATUS_COLORS = {
  healthy: "#16a34a",
  watch: "#d97706",
  critical: "#dc2626",
  neutral: "#6b7280",
};

const formatINR = (amount: number) => {
  if (Math.abs(amount) >= 10000000) return `₹${(amount / 10000000).toFixed(2)}Cr`;
  if (Math.abs(amount) >= 100000) return `₹${(amount / 100000).toFixed(2)}L`;
  if (Math.abs(amount) >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount.toLocaleString("en-IN")}`;
};

const formatINRFull = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

const getStatusColor = (value: number, thresholds: { green: number; amber: number }, higher = true) => {
  if (higher) {
    if (value >= thresholds.green) return STATUS_COLORS.healthy;
    if (value >= thresholds.amber) return STATUS_COLORS.watch;
    return STATUS_COLORS.critical;
  }
  if (value <= thresholds.green) return STATUS_COLORS.healthy;
  if (value <= thresholds.amber) return STATUS_COLORS.watch;
  return STATUS_COLORS.critical;
};

function KPICard({
  title, value, subtitle, trend, trendValue, statusColor, icon: Icon,
}: {
  title: string;
  value: string;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  statusColor?: string;
  icon?: any;
}) {
  const TrendIcon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;
  const trendColor = trend === "up" ? "text-green-600" : trend === "down" ? "text-red-600" : "text-gray-500";

  return (
    <Card className="relative overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-200" data-testid={`kpi-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      {statusColor && (
        <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: statusColor }} />
      )}
      <CardContent className="p-3 sm:p-4 pt-4 sm:pt-5">
        <div className="flex items-start justify-between gap-1">
          <div className="flex-1 min-w-0 overflow-hidden">
            <p className="text-[10px] sm:text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1 truncate">{title}</p>
            <p className="text-base sm:text-xl font-bold text-gray-900 tracking-tight truncate">{value}</p>
            {(subtitle || trendValue) && (
              <div className="flex flex-wrap items-center gap-1 mt-1">
                {trendValue && (
                  <span className={`flex items-center text-[10px] sm:text-xs font-medium ${trendColor}`}>
                    <TrendIcon className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{trendValue}</span>
                  </span>
                )}
                {subtitle && <span className="text-[9px] sm:text-[10px] text-gray-400 truncate">{subtitle}</span>}
              </div>
            )}
          </div>
          {Icon && (
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
              <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const FY_MONTHS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const getPlannerColor = (planner: string) => {
  const name = (planner || "").trim().toLowerCase();
  if (name.includes("fida")) return { bg: "bg-pink-500", text: "Fida" };
  if (name.includes("femina")) return { bg: "bg-blue-500", text: "Femina" };
  return { bg: "bg-gray-400", text: "Other" };
};

function FYCalendarHeatmap({ events, fyYear }: { events: Event[]; fyYear: number }) {
  const today = new Date();

  const eventsByDate = useMemo(() => {
    const map = new Map<string, Event[]>();
    events.forEach((e) => {
      const key = format(new Date(e.date), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    return map;
  }, [events]);

  const totalBooked = eventsByDate.size;
  const fyStartDate = new Date(fyYear, 3, 1);
  const fyEndDate = new Date(fyYear + 1, 2, 31);
  const totalDays = differenceInDays(fyEndDate, fyStartDate) + 1;

  return (
    <Card className="border border-gray-100 shadow-sm">
      <CardHeader className="pb-2 p-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
              FY {fyYear}–{fyYear + 1} Booking Calendar
            </CardTitle>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {totalBooked} days booked out of {totalDays} • {((totalBooked / totalDays) * 100).toFixed(0)}% occupancy
            </p>
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-pink-500" />
              <span className="text-gray-500">Fida</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
              <span className="text-gray-500">Femina</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-gray-100 border border-gray-200" />
              <span className="text-gray-500">Vacant</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <TooltipProvider delayDuration={100}>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {FY_MONTHS.map((monthIdx) => {
              const year = monthIdx >= 3 ? fyYear : fyYear + 1;
              const daysInMonth = getDaysInMonth(new Date(year, monthIdx));
              const firstDayOfWeek = getDay(new Date(year, monthIdx, 1));
              const blanks = Array(firstDayOfWeek).fill(null);
              const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

              return (
                <div key={`${year}-${monthIdx}`} className="min-w-0">
                  <p className="text-[11px] font-semibold text-gray-700 mb-1.5 text-center">
                    {MONTH_NAMES[monthIdx]} {year}
                  </p>
                  <div className="grid grid-cols-7 gap-px">
                    {DAY_LABELS.map((d) => (
                      <div key={d} className="text-[8px] text-gray-400 text-center font-medium pb-0.5">
                        {d[0]}
                      </div>
                    ))}
                    {blanks.map((_, i) => (
                      <div key={`b-${i}`} className="aspect-square" />
                    ))}
                    {days.map((day) => {
                      const date = new Date(year, monthIdx, day);
                      const dateKey = format(date, "yyyy-MM-dd");
                      const dayEvents = eventsByDate.get(dateKey) || [];
                      const hasEvents = dayEvents.length > 0;
                      const isToday = isSameDay(date, today);
                      const isPast = date < today && !isToday;
                      const colors = hasEvents ? getPlannerColor(dayEvents[0].planner) : null;

                      return (
                        <UITooltip key={day}>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                "aspect-square rounded-[3px] flex items-center justify-center text-[8px] font-medium cursor-default transition-all",
                                hasEvents && colors ? `${colors.bg} text-white` : "",
                                !hasEvents && isPast && "bg-gray-50 text-gray-300",
                                !hasEvents && !isPast && "bg-gray-100 text-gray-400 border border-gray-200/50",
                                isToday && "ring-1 ring-offset-1 ring-[#4b7c29]",
                                dayEvents.length > 1 && "ring-1 ring-white/50"
                              )}
                            >
                              {day}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[220px] bg-gray-900 border-gray-700">
                            <p className="font-semibold text-xs text-white">{format(date, "EEE, dd MMM yyyy")}</p>
                            {hasEvents ? (
                              <div className="mt-1 space-y-0.5">
                                {dayEvents.map((ev, idx) => (
                                  <p key={idx} className="text-[11px] text-gray-200 truncate">
                                    • {ev.title} ({ev.planner})
                                  </p>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[11px] text-gray-400">{isPast ? "No events" : "Available"}</p>
                            )}
                          </TooltipContent>
                        </UITooltip>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">{title}</h2>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}

export default function ManagementMIS() {
  const currentDate = new Date();
  const currentFY = currentDate.getMonth() >= 3 ? currentDate.getFullYear() : currentDate.getFullYear() - 1;

  const [selectedFY, setSelectedFY] = useState<string>(String(currentFY));
  const [selectedMonth, setSelectedMonth] = useState<string>(String(currentDate.getMonth()));
  const [selectedEventType, setSelectedEventType] = useState<string>("all");
  const [selectedPlanner, setSelectedPlanner] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCashflowPlanning, setShowCashflowPlanning] = useState(false);

  const searchString = useSearch();
  const activeTab = new URLSearchParams(searchString).get('tab') || 'overview';

  const fyStart = useMemo(() => new Date(parseInt(selectedFY), 3, 1), [selectedFY]);
  const fyEnd = useMemo(() => new Date(parseInt(selectedFY) + 1, 2, 31), [selectedFY]);
  const prevFyStart = useMemo(() => new Date(parseInt(selectedFY) - 1, 3, 1), [selectedFY]);
  const prevFyEnd = useMemo(() => new Date(parseInt(selectedFY), 2, 31), [selectedFY]);

  const selectedMonthInt = parseInt(selectedMonth);
  const monthYear = useMemo(() => {
    const fy = parseInt(selectedFY);
    if (selectedMonthInt >= 3) return fy;
    return fy + 1;
  }, [selectedFY, selectedMonthInt]);

  const monthStart = useMemo(() => new Date(monthYear, selectedMonthInt, 1), [monthYear, selectedMonthInt]);
  const monthEnd = useMemo(() => endOfMonth(monthStart), [monthStart]);
  const prevMonthStart = useMemo(() => startOfMonth(subMonths(monthStart, 1)), [monthStart]);
  const prevMonthEnd = useMemo(() => endOfMonth(subMonths(monthStart, 1)), [monthStart]);

  const { data: allEvents = [] } = useQuery<Event[]>({ queryKey: ["/api/events"] });
  const { data: daybook = [] } = useQuery<DaybookEntry[]>({ queryKey: ["/api/daybook"] });
  const { data: banks = [] } = useQuery<Bank[]>({ queryKey: ["/api/banks"] });
  const { data: salesDeals = [] } = useQuery<SalesDeal[]>({ queryKey: ["/api/sales/deals"] });
  const { data: salesStages = [] } = useQuery<SalesStage[]>({ queryKey: ["/api/sales/stages"] });
  const { data: invoices = [] } = useQuery<any[]>({ queryKey: ["/api/invoices"] });
  const { data: salesTargetsData = [] } = useQuery<any[]>({ queryKey: ["/api/sales/targets"] });
  const { data: allUsers = [] } = useQuery<any[]>({ queryKey: ["/api/users"] });
  const { data: upcomingPaymentsData } = useQuery<any>({
    queryKey: ['/api/admin/upcoming-payments'],
    queryFn: async () => {
      const res = await fetch('/api/admin/upcoming-payments', { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const events = useMemo(() => {
    let filtered = allEvents;
    if (selectedEventType !== "all") {
      filtered = filtered.filter((e) => e.type?.toLowerCase() === selectedEventType.toLowerCase());
    }
    if (selectedPlanner !== "all") {
      filtered = filtered.filter((e) => e.planner?.trim().toLowerCase() === selectedPlanner.toLowerCase());
    }
    return filtered;
  }, [allEvents, selectedEventType, selectedPlanner]);

  const eventTypes = useMemo(() => {
    const types = new Set(allEvents.map((e) => e.type).filter(Boolean));
    return Array.from(types).sort();
  }, [allEvents]);

  const planners = useMemo(() => {
    const seen = new Map<string, string>();
    allEvents.forEach((e) => {
      const raw = e.planner?.trim();
      if (raw && !seen.has(raw.toLowerCase())) {
        seen.set(raw.toLowerCase(), raw);
      }
    });
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [allEvents]);

  const isInFY = (date: Date) => date >= fyStart && date <= fyEnd;
  const isInPrevFY = (date: Date) => date >= prevFyStart && date <= prevFyEnd;
  const isInMonth = (date: Date) => date >= monthStart && date <= monthEnd;
  const isInPrevMonth = (date: Date) => date >= prevMonthStart && date <= prevMonthEnd;
  const isToday = (date: Date) => format(date, "yyyy-MM-dd") === format(currentDate, "yyyy-MM-dd");
  const isYesterday = (date: Date) => format(date, "yyyy-MM-dd") === format(subDays(currentDate, 1), "yyyy-MM-dd");

  const isInDateRange = (date: Date) => {
    if (dateRange?.from && dateRange?.to) {
      return isWithinInterval(date, { start: dateRange.from, end: dateRange.to });
    }
    return true;
  };

  const fyEvents = useMemo(() => events.filter((e) => isInFY(new Date(e.date)) && isInDateRange(new Date(e.date))), [events, fyStart, fyEnd, dateRange]);
  const prevFyEvents = useMemo(() => events.filter((e) => isInPrevFY(new Date(e.date))), [events, prevFyStart, prevFyEnd]);
  const monthEvents = useMemo(() => events.filter((e) => isInMonth(new Date(e.date)) && isInDateRange(new Date(e.date))), [events, monthStart, monthEnd, dateRange]);
  const prevMonthEvents = useMemo(() => events.filter((e) => isInPrevMonth(new Date(e.date))), [events, prevMonthStart, prevMonthEnd]);
  const todayEvents = useMemo(() => events.filter((e) => isToday(new Date(e.date))), [events]);
  const yesterdayEvents = useMemo(() => events.filter((e) => isYesterday(new Date(e.date))), [events]);

  const sumField = (evts: Event[], field: "salesValue" | "paymentReceived" | "cost") =>
    evts.reduce((s, e) => s + (parseFloat((e as any)[field] || "0") || 0), 0);

  const fyRevenue = sumField(fyEvents, "salesValue");
  const prevFyRevenue = sumField(prevFyEvents, "salesValue");
  const fyRevenueChange = prevFyRevenue > 0 ? ((fyRevenue - prevFyRevenue) / prevFyRevenue) * 100 : 0;

  const monthRevenue = sumField(monthEvents, "salesValue");
  const prevMonthRevenue = sumField(prevMonthEvents, "salesValue");
  const monthRevenueChange = prevMonthRevenue > 0 ? ((monthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100 : 0;

  const todayRevenue = sumField(todayEvents, "paymentReceived");
  const yesterdayRevenue = sumField(yesterdayEvents, "paymentReceived");
  const todayRevenueChange = yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : 0;

  const fyCost = sumField(fyEvents, "cost");
  const fyGrossProfit = fyRevenue - fyCost;
  const fyGrossProfitPct = fyRevenue > 0 ? (fyGrossProfit / fyRevenue) * 100 : 0;

  const fyDaybookEntries = useMemo(() => daybook.filter((e) => isInFY(new Date(e.date)) && isInDateRange(new Date(e.date))), [daybook, fyStart, fyEnd, dateRange]);
  const monthDaybookEntries = useMemo(() => daybook.filter((e) => isInMonth(new Date(e.date)) && isInDateRange(new Date(e.date))), [daybook, monthStart, monthEnd, dateRange]);

  const monthIncome = monthDaybookEntries.filter((e) => e.type === "income").reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const monthExpense = monthDaybookEntries.filter((e) => e.type === "expense").reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const monthNetProfit = monthIncome - monthExpense;
  const monthNetProfitPct = monthIncome > 0 ? (monthNetProfit / monthIncome) * 100 : 0;

  const cashInBank = useMemo(() => banks.reduce((s, b) => s + (parseFloat(b.balance) || 0), 0), [banks]);

  const accountsReceivable = useMemo(() => {
    return events.reduce((s, e) => {
      const total = parseFloat((e as any).salesValue || "0") || 0;
      const received = parseFloat((e as any).paymentReceived || "0") || 0;
      return s + Math.max(0, total - received);
    }, 0);
  }, [events]);

  const accountsPayable = useMemo(() => {
    return invoices
      .filter((inv: any) => inv.status && inv.status !== "paid" && inv.status !== "draft")
      .reduce((s, inv: any) => s + (parseFloat(inv.total || "0") || 0), 0);
  }, [invoices]);

  // ZONE 2 - Revenue & Profit Analytics
  const monthlyRevenueTrend = useMemo(() => {
    const months: { name: string; revenue: number; profit: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const m = subMonths(currentDate, i);
      const mStart = startOfMonth(m);
      const mEnd = endOfMonth(m);
      const mEvents = events.filter((e) => {
        const d = new Date(e.date);
        return d >= mStart && d <= mEnd;
      });
      const rev = sumField(mEvents, "salesValue");
      const cost = sumField(mEvents, "cost");
      months.push({
        name: format(m, "MMM"),
        revenue: Math.round(rev),
        profit: Math.round(rev - cost),
      });
    }
    return months;
  }, [events, currentDate]);

  const last30DaysRevenue = useMemo(() => {
    const days: { name: string; revenue: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = subDays(currentDate, i);
      const dateStr = format(d, "yyyy-MM-dd");
      const dayEntries = daybook.filter((e) => e.date === dateStr && e.type === "income");
      const rev = dayEntries.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
      days.push({ name: format(d, "dd"), revenue: Math.round(rev) });
    }
    return days;
  }, [daybook, currentDate]);

  const profitTrend = useMemo(() => {
    const months: { name: string; profitPct: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const m = subMonths(currentDate, i);
      const mStart = startOfMonth(m);
      const mEnd = endOfMonth(m);
      const mEntries = daybook.filter((e) => {
        const d = new Date(e.date);
        return d >= mStart && d <= mEnd;
      });
      const inc = mEntries.filter((e) => e.type === "income").reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
      const exp = mEntries.filter((e) => e.type === "expense").reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
      months.push({ name: format(m, "MMM"), profitPct: inc > 0 ? Math.round(((inc - exp) / inc) * 100) : 0 });
    }
    return months;
  }, [daybook, currentDate]);

  const avgRevenuePerEvent = fyEvents.length > 0 ? fyRevenue / fyEvents.length : 0;

  const highestRevenueEvent = useMemo(() => {
    if (fyEvents.length === 0) return null;
    return fyEvents.reduce((max, e) => (parseFloat((e as any).salesValue || "0") > parseFloat((max as any).salesValue || "0") ? e : max), fyEvents[0]);
  }, [fyEvents]);

  const lowestRevenueEvent = useMemo(() => {
    if (fyEvents.length === 0) return null;
    const withRevenue = fyEvents.filter((e) => parseFloat((e as any).salesValue || "0") > 0);
    if (withRevenue.length === 0) return null;
    return withRevenue.reduce((min, e) => (parseFloat((e as any).salesValue || "0") < parseFloat((min as any).salesValue || "0") ? e : min), withRevenue[0]);
  }, [fyEvents]);

  // ZONE 3 - Operations
  const now = new Date();
  const next30 = addDays(now, 30);
  const next60 = addDays(now, 60);
  const next90 = addDays(now, 90);
  const upcoming30 = events.filter((e) => { const d = new Date(e.date); return d > now && d <= next30; }).length;
  const upcoming60 = events.filter((e) => { const d = new Date(e.date); return d > now && d <= next60; }).length;
  const upcoming90 = events.filter((e) => { const d = new Date(e.date); return d > now && d <= next90; }).length;
  const activeProjects = events.filter((e) => (e as any).status === "active" || (e as any).status === "confirmed").length;

  const clientPaymentPending = events.filter((e) => {
    const total = parseFloat((e as any).salesValue || "0") || 0;
    const received = parseFloat((e as any).paymentReceived || "0") || 0;
    return total > 0 && received < total;
  }).length;

  const overBudgetProjects = events.filter((e) => {
    const sales = parseFloat((e as any).salesValue || "0") || 0;
    const cost = parseFloat((e as any).cost || "0") || 0;
    return sales > 0 && cost > sales;
  }).length;

  const budgetVsActual = useMemo(() => {
    return fyEvents
      .filter((e) => parseFloat((e as any).salesValue || "0") > 0)
      .slice(0, 10)
      .map((e) => ({
        name: (e.title || "").slice(0, 12),
        budget: Math.round(parseFloat((e as any).salesValue || "0")),
        actual: Math.round(parseFloat((e as any).cost || "0")),
      }));
  }, [fyEvents]);

  // ZONE 4 - Sales Pipeline
  const closedStageIds = useMemo(() => {
    return salesStages
      .filter((s) => {
        const n = s.name?.toLowerCase() || "";
        return n.includes("won") || n.includes("lost") || n === "closed";
      })
      .map((s) => s.id);
  }, [salesStages]);

  const wonStageIds = useMemo(() => {
    return salesStages.filter((s) => s.name?.toLowerCase().includes("won")).map((s) => s.id);
  }, [salesStages]);

  const monthDeals = useMemo(() => {
    return salesDeals.filter((d) => {
      const created = new Date(d.createdAt);
      return isInMonth(created);
    });
  }, [salesDeals, monthStart, monthEnd]);

  const totalLeadsThisMonth = monthDeals.length;
  const bookedThisMonth = monthDeals.filter((d) => wonStageIds.includes(d.stageId) || d.status === "won").length;
  const leadToBookingPct = totalLeadsThisMonth > 0 ? (bookedThisMonth / totalLeadsThisMonth) * 100 : 0;

  const totalPipelineValue = salesDeals
    .filter((d) => !closedStageIds.includes(d.stageId) && d.status === "open")
    .reduce((s, d) => s + (parseFloat(d.value) || 0), 0);

  const weightedForecast = salesDeals
    .filter((d) => !closedStageIds.includes(d.stageId) && d.status === "open")
    .reduce((s, d) => {
      const prob = d.probability ?? 50;
      return s + (parseFloat(d.value) || 0) * (prob / 100);
    }, 0);

  const avgSalesCycle = useMemo(() => {
    const wonDeals = salesDeals.filter((d) => d.status === "won" && d.actualCloseDate && d.createdAt);
    if (wonDeals.length === 0) return 0;
    const totalDays = wonDeals.reduce((s, d) => s + differenceInDays(new Date(d.actualCloseDate!), new Date(d.createdAt)), 0);
    return Math.round(totalDays / wonDeals.length);
  }, [salesDeals]);

  const funnelData = useMemo(() => {
    const stagesSorted = [...salesStages].sort((a, b) => a.order - b.order);
    const openDeals = salesDeals.filter((d) => d.status !== "lost");
    return stagesSorted.map((stage) => ({
      name: stage.name,
      count: openDeals.filter((d) => d.stageId === stage.id).length,
    }));
  }, [salesDeals, salesStages]);

  const maxFunnelCount = Math.max(...funnelData.map((f) => f.count), 1);

  // ZONE 5 - Cashflow
  const monthCollections = monthDaybookEntries.filter((e) => e.type === "income").reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const monthExpenses = monthDaybookEntries.filter((e) => e.type === "expense").reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const netCashMovement = monthCollections - monthExpenses;

  const last3MonthsExpense = useMemo(() => {
    let total = 0;
    for (let i = 0; i < 3; i++) {
      const m = subMonths(currentDate, i);
      const mStart = startOfMonth(m);
      const mEnd = endOfMonth(m);
      total += daybook
        .filter((e) => { const d = new Date(e.date); return d >= mStart && d <= mEnd && e.type === "expense"; })
        .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    }
    return total / 3;
  }, [daybook, currentDate]);

  const burnRate = last3MonthsExpense;
  const runwayMonths = burnRate > 0 ? Math.round(cashInBank / burnRate) : 999;

  const receivablesAging = useMemo(() => {
    let age030 = 0, age3060 = 0, age60plus = 0;
    events.forEach((e) => {
      const total = parseFloat((e as any).salesValue || "0") || 0;
      const received = parseFloat((e as any).paymentReceived || "0") || 0;
      const outstanding = Math.max(0, total - received);
      if (outstanding <= 0) return;
      const eventDate = new Date(e.date);
      const daysSince = differenceInDays(now, eventDate);
      if (daysSince <= 30) age030 += outstanding;
      else if (daysSince <= 60) age3060 += outstanding;
      else age60plus += outstanding;
    });
    return { age030, age3060, age60plus };
  }, [events]);

  const receivablesVsRevenue = monthRevenue > 0 ? (accountsReceivable / monthRevenue) * 100 : 0;

  const fyOptions = useMemo(() => {
    const years = new Set<number>();
    allEvents.forEach((e) => {
      const d = new Date(e.date);
      const fy = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
      years.add(fy);
    });
    salesTargetsData.forEach((t: any) => {
      const fyStr = (t.fiscalYear || '').replace('FY', '').split('-')[0];
      const fyNum = parseInt(fyStr);
      if (!isNaN(fyNum)) years.add(fyNum);
    });
    years.add(currentFY);
    return Array.from(years).sort((a, b) => b - a);
  }, [allEvents, currentFY, salesTargetsData]);

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const chartTooltipStyle = { fontSize: 11, backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" };

  const SALES_FY_MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
  const FIDA_COLOR = '#ec4899';
  const FEMINA_COLOR = '#3b82f6';

  const classifyPlanner = (name: string): 'fida' | 'femina' | 'other' => {
    const n = (name || '').toLowerCase().trim();
    if (n.includes('fida')) return 'fida';
    if (n.includes('femina')) return 'femina';
    return 'other';
  };

  const weddingPlannerUsers = useMemo(() => {
    return allUsers.filter((u: any) => u.role === 'wedding_planner');
  }, [allUsers]);

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

  const fyKeyForSales = `FY${selectedFY}-${(parseInt(selectedFY) + 1).toString().slice(2)}`;

  const salesPerformanceData = useMemo(() => {
    const fy = parseInt(selectedFY);

    return SALES_FY_MONTHS.map((monthLabel, idx) => {
      const monthNum = idx < 9 ? idx + 4 : idx - 8;
      const year = idx < 9 ? fy : fy + 1;

      let fidaActual = 0;
      let feminaActual = 0;
      let otherActual = 0;
      allEvents.forEach((ev: any) => {
        const evDate = new Date(ev.date);
        if (evDate.getFullYear() === year && evDate.getMonth() + 1 === monthNum) {
          const val = parseFloat(ev.salesValue || '0');
          const cat = classifyPlanner(ev.planner);
          if (cat === 'fida') fidaActual += val;
          else if (cat === 'femina') feminaActual += val;
          else otherActual += val;
        }
      });

      let fidaTarget = 0;
      let feminaTarget = 0;
      salesTargetsData.forEach((t: any) => {
        const tfy = (t.fiscalYear || '').trim();
        if (tfy !== fyKeyForSales) return;
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

      return {
        month: monthLabel,
        fidaActual,
        feminaActual,
        otherActual,
        totalActual: fidaActual + feminaActual + otherActual,
        fidaTarget,
        feminaTarget,
        totalTarget: fidaTarget + feminaTarget,
      };
    });
  }, [allEvents, salesTargetsData, selectedFY, fidaUserId, feminaUserId, fyKeyForSales]);

  const salesPerfSummary = useMemo(() => {
    const totalFidaActual = salesPerformanceData.reduce((s, d) => s + d.fidaActual, 0);
    const totalFeminaActual = salesPerformanceData.reduce((s, d) => s + d.feminaActual, 0);
    const totalFidaTarget = salesPerformanceData.reduce((s, d) => s + d.fidaTarget, 0);
    const totalFeminaTarget = salesPerformanceData.reduce((s, d) => s + d.feminaTarget, 0);
    const totalActual = salesPerformanceData.reduce((s, d) => s + d.totalActual, 0);
    const totalTarget = salesPerformanceData.reduce((s, d) => s + d.totalTarget, 0);

    const totalOtherActual = salesPerformanceData.reduce((s, d) => s + d.otherActual, 0);

    const fidaEventCount = allEvents.filter((e: any) => {
      const d = new Date(e.date);
      return d >= fyStart && d <= fyEnd && classifyPlanner(e.planner) === 'fida';
    }).length;
    const feminaEventCount = allEvents.filter((e: any) => {
      const d = new Date(e.date);
      return d >= fyStart && d <= fyEnd && classifyPlanner(e.planner) === 'femina';
    }).length;
    const totalEventCount = fidaEventCount + feminaEventCount;
    const combinedActual = totalFidaActual + totalFeminaActual;

    return {
      totalFidaActual, totalFeminaActual, totalFidaTarget, totalFeminaTarget,
      totalActual, totalTarget, totalOtherActual, combinedActual,
      fidaPct: totalFidaTarget > 0 ? (totalFidaActual / totalFidaTarget) * 100 : 0,
      feminaPct: totalFeminaTarget > 0 ? (totalFeminaActual / totalFeminaTarget) * 100 : 0,
      totalPct: totalTarget > 0 ? (combinedActual / totalTarget) * 100 : 0,
      fidaEventCount, feminaEventCount, totalEventCount,
      fidaAvgDeal: fidaEventCount > 0 ? totalFidaActual / fidaEventCount : 0,
      feminaAvgDeal: feminaEventCount > 0 ? totalFeminaActual / feminaEventCount : 0,
      overallAvgDeal: totalEventCount > 0 ? combinedActual / totalEventCount : 0,
    };
  }, [salesPerformanceData, allEvents, fyStart, fyEnd]);

  return (
    <div className="flex flex-col min-h-full" style={{ backgroundColor: "#F8F9FB" }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-lg font-bold text-gray-900 tracking-tight">Management Information System</h1>
              <p className="text-xs text-gray-400 mt-0.5">Executive Dashboard</p>
            </div>
            <Button
              data-testid="button-ask-oaksy-analysis"
              size="sm"
              className="bg-[#4b7c29] hover:bg-[#3d6622] text-white gap-1.5 ml-2 hidden sm:flex"
              onClick={() => {
                window.dispatchEvent(new CustomEvent("openOaksyChat", {
                  detail: { message: "Give me a full business analysis for this fiscal year" }
                }));
              }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Ask Oaksy
            </Button>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Calendar className="w-3.5 h-3.5" />
            {format(currentDate, "EEEE, dd MMMM yyyy")}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-100 px-6 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-gray-400" />
          <Select value={selectedFY} onValueChange={setSelectedFY}>
            <SelectTrigger className="w-[130px] h-8 text-xs border-gray-200" data-testid="filter-fy">
              <SelectValue placeholder="FY" />
            </SelectTrigger>
            <SelectContent>
              {fyOptions.map((fy) => (
                <SelectItem key={fy} value={String(fy)} className="text-xs">FY {fy}-{String(fy + 1).slice(2)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[130px] h-8 text-xs border-gray-200" data-testid="filter-month">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              {monthNames.map((m, i) => (
                <SelectItem key={i} value={String(i)} className="text-xs">{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs border-gray-200 px-3" data-testid="filter-date-range">
                {dateRange?.from ? `${format(dateRange.from, "dd MMM")} - ${dateRange.to ? format(dateRange.to, "dd MMM") : "..."}` : "Date Range"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarWidget
                mode="range"
                selected={dateRange}
                onSelect={(range) => { setDateRange(range); if (range?.to) setShowDatePicker(false); }}
                numberOfMonths={2}
              />
              {dateRange && (
                <div className="p-2 border-t">
                  <Button variant="ghost" size="sm" className="text-xs w-full" onClick={() => { setDateRange(undefined); setShowDatePicker(false); }}>
                    Clear Range
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>

          <Select value={selectedEventType} onValueChange={setSelectedEventType}>
            <SelectTrigger className="w-[140px] h-8 text-xs border-gray-200" data-testid="filter-event-type">
              <SelectValue placeholder="Event Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Types</SelectItem>
              {eventTypes.map((t) => (
                <SelectItem key={t} value={t!} className="text-xs">{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedPlanner} onValueChange={setSelectedPlanner}>
            <SelectTrigger className="w-[140px] h-8 text-xs border-gray-200" data-testid="filter-planner">
              <SelectValue placeholder="Planner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Planners</SelectItem>
              {planners.map(([key, display]) => (
                <SelectItem key={key} value={key} className="text-xs">{display}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="flex-1 px-4 sm:px-6 py-5 space-y-8">

        {/* ZONE 1 - Executive Snapshot */}
        {activeTab === 'overview' && (
        <section>
          <SectionHeader title="Executive Snapshot" subtitle="Key performance indicators at a glance" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KPICard
              title="FY Revenue"
              value={formatINR(fyRevenue)}
              trend={fyRevenueChange >= 0 ? "up" : "down"}
              trendValue={`${Math.abs(fyRevenueChange).toFixed(1)}% vs last FY`}
              statusColor={STATUS_COLORS.healthy}
              icon={IndianRupee}
            />
            <KPICard
              title="Monthly Revenue"
              value={formatINR(monthRevenue)}
              trend={monthRevenueChange >= 0 ? "up" : "down"}
              trendValue={`${Math.abs(monthRevenueChange).toFixed(1)}% vs last month`}
              statusColor={monthRevenueChange >= 0 ? STATUS_COLORS.healthy : STATUS_COLORS.watch}
              icon={BarChart3}
            />
            <KPICard
              title="Today Revenue"
              value={formatINR(todayRevenue)}
              trend={todayRevenueChange >= 0 ? "up" : "down"}
              trendValue={yesterdayRevenue > 0 ? `${Math.abs(todayRevenueChange).toFixed(0)}% vs yesterday` : "—"}
              statusColor={STATUS_COLORS.neutral}
              icon={Activity}
            />
            <KPICard
              title="FY Gross Profit %"
              value={`${fyGrossProfitPct.toFixed(1)}%`}
              subtitle={formatINR(fyGrossProfit)}
              statusColor={getStatusColor(fyGrossProfitPct, { green: 25, amber: 15 })}
              icon={TrendingUp}
            />
            <KPICard
              title="Monthly Net Profit %"
              value={`${monthNetProfitPct.toFixed(1)}%`}
              subtitle={formatINR(monthNetProfit)}
              statusColor={getStatusColor(monthNetProfitPct, { green: 10, amber: 5 })}
              icon={PieChart}
            />
            <KPICard
              title="Cash in Bank"
              value={formatINR(cashInBank)}
              statusColor={cashInBank > 0 ? STATUS_COLORS.healthy : STATUS_COLORS.critical}
              icon={Wallet}
            />
            <KPICard
              title="Accounts Receivable"
              value={formatINR(accountsReceivable)}
              subtitle={receivablesVsRevenue > 30 ? "⚠ >30% of revenue" : ""}
              statusColor={receivablesVsRevenue > 30 ? STATUS_COLORS.watch : STATUS_COLORS.healthy}
              icon={FileText}
            />
            <KPICard
              title="Accounts Payable"
              value={formatINR(accountsPayable)}
              statusColor={accountsPayable > 0 ? STATUS_COLORS.watch : STATUS_COLORS.healthy}
              icon={CreditCard}
            />
          </div>
        </section>
        )}

        {/* FY Calendar Heatmap */}
        {activeTab === 'overview' && (
        <section className="mb-6">
          <SectionHeader title="FY Booking Calendar" subtitle="Visual overview of filled and vacant slots across the financial year" />
          <FYCalendarHeatmap events={allEvents} fyYear={parseInt(selectedFY)} />
        </section>
        )}

        {/* ZONE 2 - Revenue & Profit Analytics */}
        {(activeTab === 'overview' || activeTab === 'financial') && (
        <section>
          <SectionHeader title="Revenue & Profit Analytics" subtitle="Trends, targets, and performance analysis" />

          {/* FY Revenue vs Target Bar */}
          <div className="mb-4">
            <Card className="border border-gray-100 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-gray-500">FY Revenue vs Previous FY</p>
                  <p className="text-xs font-bold text-gray-700">{formatINR(fyRevenue)}</p>
                </div>
                {prevFyRevenue > 0 ? (
                  <>
                    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.min((fyRevenue / prevFyRevenue) * 100, 100)}%`,
                          backgroundColor: fyRevenue >= prevFyRevenue ? STATUS_COLORS.healthy : STATUS_COLORS.watch,
                        }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <p className="text-[10px] text-gray-400">Previous FY: {formatINR(prevFyRevenue)}</p>
                      <p className="text-[10px] font-medium" style={{ color: fyRevenueChange >= 0 ? STATUS_COLORS.healthy : STATUS_COLORS.critical }}>
                        {fyRevenueChange >= 0 ? "+" : ""}{fyRevenueChange.toFixed(1)}%
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-[10px] text-gray-400 mt-1">No previous FY data for comparison</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <Card className="border border-gray-100 shadow-sm">
              <CardHeader className="pb-2 p-4">
                <CardTitle className="text-xs font-semibold text-gray-600">Monthly Revenue Trend</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={monthlyRevenueTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 100000).toFixed(0)}L`} />
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => [formatINRFull(v), "Revenue"]} />
                    <Line type="monotone" dataKey="revenue" stroke="#4b7c29" strokeWidth={2} dot={{ r: 3, fill: "#4b7c29" }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border border-gray-100 shadow-sm">
              <CardHeader className="pb-2 p-4">
                <CardTitle className="text-xs font-semibold text-gray-600">Last 30 Days Revenue</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={last30DaysRevenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} interval={4} />
                    <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => [formatINRFull(v), "Revenue"]} />
                    <Bar dataKey="revenue" fill="#4b7c29" radius={[2, 2, 0, 0]} maxBarSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="border border-gray-100 shadow-sm">
              <CardHeader className="pb-2 p-4">
                <CardTitle className="text-xs font-semibold text-gray-600">Profit % Trend (12 months)</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={profitTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => [`${v}%`, "Profit"]} />
                    <Line type="monotone" dataKey="profitPct" stroke="#d97706" strokeWidth={2} dot={{ r: 3, fill: "#d97706" }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border border-gray-100 shadow-sm">
              <CardContent className="p-4 flex flex-col justify-center h-full">
                <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1">Avg Revenue / Event</p>
                <p className="text-2xl font-bold text-gray-900">{formatINR(avgRevenuePerEvent)}</p>
                <p className="text-[10px] text-gray-400 mt-1">{fyEvents.length} events in FY</p>
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                  {highestRevenueEvent && (
                    <div>
                      <p className="text-[10px] font-medium text-green-600 uppercase">Highest Revenue</p>
                      <p className="text-xs font-semibold text-gray-800 truncate">{highestRevenueEvent.title}</p>
                      <p className="text-xs text-gray-500">{formatINR(parseFloat((highestRevenueEvent as any).salesValue || "0"))}</p>
                    </div>
                  )}
                  {lowestRevenueEvent && (
                    <div>
                      <p className="text-[10px] font-medium text-red-500 uppercase">Lowest Revenue</p>
                      <p className="text-xs font-semibold text-gray-800 truncate">{lowestRevenueEvent.title}</p>
                      <p className="text-xs text-gray-500">{formatINR(parseFloat((lowestRevenueEvent as any).salesValue || "0"))}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border border-gray-100 shadow-sm">
              <CardHeader className="pb-2 p-4">
                <CardTitle className="text-xs font-semibold text-gray-600">Budget vs Actual (Top Events)</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={budgetVsActual} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 100000).toFixed(0)}L`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: "#6b7280" }} axisLine={false} tickLine={false} width={70} />
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => [formatINRFull(v)]} />
                    <Bar dataKey="budget" fill="#4b7c29" radius={[0, 2, 2, 0]} maxBarSize={10} name="Revenue" />
                    <Bar dataKey="actual" fill="#dc2626" radius={[0, 2, 2, 0]} maxBarSize={10} name="Cost" opacity={0.7} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </section>
        )}

        {/* SALES PERFORMANCE SECTION */}
        {(activeTab === 'overview' || activeTab === 'sales') && (
        <section id="sales-performance">
          <SectionHeader title="Sales Performance" subtitle={`Target vs Actual analysis — FY ${selectedFY}-${(parseInt(selectedFY) + 1).toString().slice(2)}`} />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <KPICard
              title="Total Sales (FY)"
              value={formatINR(salesPerfSummary.combinedActual)}
              subtitle={`Target: ${formatINR(salesPerfSummary.totalTarget)}`}
              statusColor={salesPerfSummary.totalPct >= 80 ? STATUS_COLORS.healthy : salesPerfSummary.totalPct >= 50 ? STATUS_COLORS.watch : STATUS_COLORS.critical}
              icon={Target}
            />
            <KPICard
              title="Achievement"
              value={`${salesPerfSummary.totalPct.toFixed(1)}%`}
              subtitle={`${formatINR(Math.max(0, salesPerfSummary.totalTarget - salesPerfSummary.combinedActual))} remaining`}
              trend={salesPerfSummary.totalPct >= 80 ? "up" : "down"}
              statusColor={salesPerfSummary.totalPct >= 80 ? STATUS_COLORS.healthy : salesPerfSummary.totalPct >= 50 ? STATUS_COLORS.watch : STATUS_COLORS.critical}
              icon={TrendingUp}
            />
            <KPICard
              title="Total Events (FY)"
              value={String(salesPerfSummary.totalEventCount)}
              subtitle={`Fida: ${salesPerfSummary.fidaEventCount} | Femina: ${salesPerfSummary.feminaEventCount}`}
              statusColor={STATUS_COLORS.neutral}
              icon={Calendar}
            />
            <KPICard
              title="Avg Deal Value"
              value={formatINR(salesPerfSummary.overallAvgDeal)}
              subtitle={`F: ${formatINR(salesPerfSummary.fidaAvgDeal)} | Fe: ${formatINR(salesPerfSummary.feminaAvgDeal)}`}
              statusColor={STATUS_COLORS.neutral}
              icon={IndianRupee}
            />
          </div>

          <Card className="border border-gray-100 shadow-sm mb-4">
            <CardHeader className="pb-2 p-4">
              <CardTitle className="text-xs font-semibold text-gray-600">Monthly Sales — Target vs Actual (Planner Split)</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="flex items-center gap-4 mb-3 text-xs flex-wrap">
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
                  <span className="text-muted-foreground">Target (Fida + Femina)</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={salesPerformanceData} barGap={2} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => v >= 100000 ? `${(v / 100000).toFixed(0)}L` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`}
                  />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    formatter={(value: number, name: string) => {
                      const label = name === 'fidaActual' ? 'Fida Actual' :
                                    name === 'feminaActual' ? 'Femina Actual' :
                                    name === 'fidaTarget' ? 'Fida Target' :
                                    name === 'feminaTarget' ? 'Femina Target' : name;
                      return [`₹${(value / 100000).toFixed(2)}L`, label];
                    }}
                  />
                  <Bar dataKey="fidaActual" stackId="actual" fill={FIDA_COLOR} radius={[0, 0, 0, 0]} name="fidaActual" />
                  <Bar dataKey="feminaActual" stackId="actual" fill={FEMINA_COLOR} radius={[4, 4, 0, 0]} name="feminaActual" />
                  <Bar dataKey="fidaTarget" stackId="target" fill="transparent" stroke={FIDA_COLOR} strokeWidth={1.5} strokeDasharray="4 3" opacity={0.5} radius={[0, 0, 0, 0]} name="fidaTarget" />
                  <Bar dataKey="feminaTarget" stackId="target" fill="transparent" stroke={FEMINA_COLOR} strokeWidth={1.5} strokeDasharray="4 3" opacity={0.5} radius={[4, 4, 0, 0]} name="feminaTarget" />
                </BarChart>
              </ResponsiveContainer>

              <div className="mt-4 pt-3 border-t grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: FIDA_COLOR }} />
                    <span className="text-xs font-semibold text-gray-700">Fida</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Actual: {formatINR(salesPerfSummary.totalFidaActual)}</span>
                    <span>Target: {formatINR(salesPerfSummary.totalFidaTarget)}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${Math.min(100, salesPerfSummary.fidaPct)}%`, backgroundColor: FIDA_COLOR }} />
                  </div>
                  <span className="text-[10px] text-gray-400">{salesPerfSummary.fidaPct.toFixed(0)}% achieved • {salesPerfSummary.fidaEventCount} events • Avg: {formatINR(salesPerfSummary.fidaAvgDeal)}</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: FEMINA_COLOR }} />
                    <span className="text-xs font-semibold text-gray-700">Femina</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Actual: {formatINR(salesPerfSummary.totalFeminaActual)}</span>
                    <span>Target: {formatINR(salesPerfSummary.totalFeminaTarget)}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${Math.min(100, salesPerfSummary.feminaPct)}%`, backgroundColor: FEMINA_COLOR }} />
                  </div>
                  <span className="text-[10px] text-gray-400">{salesPerfSummary.feminaPct.toFixed(0)}% achieved • {salesPerfSummary.feminaEventCount} events • Avg: {formatINR(salesPerfSummary.feminaAvgDeal)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-100 shadow-sm mb-4">
            <CardHeader className="pb-2 p-4">
              <CardTitle className="text-xs font-semibold text-gray-600">Monthly Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th rowSpan={2} className="text-left py-2 px-2 font-semibold text-gray-600 align-bottom">Month</th>
                      <th colSpan={2} className="text-center py-1 px-2 font-semibold border-b border-gray-100" style={{ color: FIDA_COLOR }}>Fida</th>
                      <th colSpan={2} className="text-center py-1 px-2 font-semibold border-b border-gray-100" style={{ color: FEMINA_COLOR }}>Femina</th>
                      <th rowSpan={2} className="text-right py-2 px-2 font-semibold text-gray-700 align-bottom">Total Actual</th>
                      <th rowSpan={2} className="text-right py-2 px-2 font-semibold text-gray-500 align-bottom">Total Target</th>
                      <th rowSpan={2} className="text-right py-2 px-2 font-semibold text-gray-600 align-bottom">Achievement</th>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <th className="text-right py-1 px-2 text-[10px] font-medium" style={{ color: FIDA_COLOR }}>Actual</th>
                      <th className="text-right py-1 px-2 text-[10px] font-medium" style={{ color: FIDA_COLOR, opacity: 0.6 }}>Target</th>
                      <th className="text-right py-1 px-2 text-[10px] font-medium" style={{ color: FEMINA_COLOR }}>Actual</th>
                      <th className="text-right py-1 px-2 text-[10px] font-medium" style={{ color: FEMINA_COLOR, opacity: 0.6 }}>Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesPerformanceData.map((row) => {
                      const achievePct = row.totalTarget > 0 ? (row.totalActual / row.totalTarget) * 100 : 0;
                      return (
                        <tr key={row.month} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 px-2 font-medium text-gray-700">{row.month}</td>
                          <td className="py-2 px-2 text-right" style={{ color: FIDA_COLOR }}>{formatINR(row.fidaActual)}</td>
                          <td className="py-2 px-2 text-right text-gray-400 text-[10px]">{formatINR(row.fidaTarget)}</td>
                          <td className="py-2 px-2 text-right" style={{ color: FEMINA_COLOR }}>{formatINR(row.feminaActual)}</td>
                          <td className="py-2 px-2 text-right text-gray-400 text-[10px]">{formatINR(row.feminaTarget)}</td>
                          <td className="py-2 px-2 text-right font-semibold text-gray-800">{formatINR(row.totalActual)}</td>
                          <td className="py-2 px-2 text-right text-gray-400">{formatINR(row.totalTarget)}</td>
                          <td className="py-2 px-2 text-right">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              achievePct >= 100 ? 'bg-green-50 text-green-700' :
                              achievePct >= 70 ? 'bg-amber-50 text-amber-700' :
                              row.totalTarget === 0 ? 'bg-gray-50 text-gray-400' :
                              'bg-red-50 text-red-600'
                            }`}>
                              {row.totalTarget > 0 ? `${achievePct.toFixed(0)}%` : '—'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                      <td className="py-2 px-2 text-gray-800">Total</td>
                      <td className="py-2 px-2 text-right" style={{ color: FIDA_COLOR }}>{formatINR(salesPerfSummary.totalFidaActual)}</td>
                      <td className="py-2 px-2 text-right text-gray-400 text-[10px]">{formatINR(salesPerfSummary.totalFidaTarget)}</td>
                      <td className="py-2 px-2 text-right" style={{ color: FEMINA_COLOR }}>{formatINR(salesPerfSummary.totalFeminaActual)}</td>
                      <td className="py-2 px-2 text-right text-gray-400 text-[10px]">{formatINR(salesPerfSummary.totalFeminaTarget)}</td>
                      <td className="py-2 px-2 text-right text-gray-800">{formatINR(salesPerfSummary.totalActual)}</td>
                      <td className="py-2 px-2 text-right text-gray-500">{formatINR(salesPerfSummary.totalTarget)}</td>
                      <td className="py-2 px-2 text-right">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          salesPerfSummary.totalPct >= 100 ? 'bg-green-100 text-green-800' :
                          salesPerfSummary.totalPct >= 70 ? 'bg-amber-100 text-amber-800' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {salesPerfSummary.totalPct.toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>
        )}

        {/* ZONE 3 - Operations Performance */}
        {(activeTab === 'overview' || activeTab === 'operations') && (
        <section>
          <SectionHeader title="Operations Performance" subtitle="Projects, events, and operational health" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KPICard title="Active Projects" value={String(activeProjects)} icon={Briefcase} statusColor={STATUS_COLORS.neutral} />
            <KPICard title="Next 30 Days" value={String(upcoming30)} icon={Calendar} statusColor={STATUS_COLORS.neutral} />
            <KPICard title="Next 60 Days" value={String(upcoming60)} icon={Calendar} statusColor={STATUS_COLORS.neutral} />
            <KPICard title="Next 90 Days" value={String(upcoming90)} icon={Calendar} statusColor={STATUS_COLORS.neutral} />
            <KPICard
              title="Payment Pending"
              value={String(clientPaymentPending)}
              subtitle="clients"
              icon={AlertTriangle}
              statusColor={clientPaymentPending > 5 ? STATUS_COLORS.watch : STATUS_COLORS.healthy}
            />
            <KPICard
              title="Over-Budget"
              value={String(overBudgetProjects)}
              subtitle="projects"
              icon={AlertTriangle}
              statusColor={overBudgetProjects > 0 ? STATUS_COLORS.critical : STATUS_COLORS.healthy}
            />
          </div>
        </section>
        )}

        {/* ZONE 4 - Sales Pipeline Health */}
        {(activeTab === 'overview' || activeTab === 'sales') && (
        <section>
          <SectionHeader title="Sales Pipeline Health" subtitle="Lead tracking, conversion, and forecast" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
            <KPICard title="Leads This Month" value={String(totalLeadsThisMonth)} icon={Users} statusColor={STATUS_COLORS.neutral} />
            <KPICard
              title="Lead → Booking %"
              value={`${leadToBookingPct.toFixed(1)}%`}
              icon={Target}
              statusColor={getStatusColor(leadToBookingPct, { green: 15, amber: 8 })}
            />
            <KPICard title="Pipeline Value" value={formatINR(totalPipelineValue)} icon={CircleDollarSign} statusColor={STATUS_COLORS.neutral} />
            <KPICard title="Weighted Forecast" value={formatINR(weightedForecast)} icon={TrendingUp} statusColor={STATUS_COLORS.neutral} />
            <KPICard title="Avg Sales Cycle" value={avgSalesCycle > 0 ? `${avgSalesCycle}d` : "—"} subtitle="days" icon={Clock} statusColor={STATUS_COLORS.neutral} />
            <KPICard title="Open Deals" value={String(salesDeals.filter((d) => d.status === "open").length)} icon={Briefcase} statusColor={STATUS_COLORS.neutral} />
          </div>

          {/* Funnel Visualization */}
          {funnelData.length > 0 && (
            <Card className="border border-gray-100 shadow-sm">
              <CardHeader className="pb-2 p-4">
                <CardTitle className="text-xs font-semibold text-gray-600">Sales Funnel</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="space-y-2">
                  {funnelData.map((stage, i) => {
                    const widthPct = maxFunnelCount > 0 ? Math.max((stage.count / maxFunnelCount) * 100, 8) : 8;
                    const colors = ["#4b7c29", "#5a8f33", "#6ea03d", "#82b247", "#96c451", "#aad66b", "#c0e88e"];
                    return (
                      <div key={stage.name} className="flex items-center gap-3">
                        <span className="text-[11px] text-gray-500 w-24 text-right truncate">{stage.name}</span>
                        <div className="flex-1">
                          <div
                            className="h-7 rounded flex items-center px-3 transition-all duration-500"
                            style={{
                              width: `${widthPct}%`,
                              backgroundColor: colors[i % colors.length],
                              minWidth: 40,
                            }}
                          >
                            <span className="text-[11px] font-semibold text-white">{stage.count}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </section>
        )}

        {/* ZONE 5 - Cashflow Control */}
        {(activeTab === 'overview' || activeTab === 'financial') && (
        <section className="pb-8">
          <SectionHeader title="Cashflow Control" subtitle="Collections, expenses, and financial runway" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
            <KPICard
              title="Collections (Month)"
              value={formatINR(monthCollections)}
              icon={Banknote}
              statusColor={STATUS_COLORS.healthy}
            />
            <KPICard
              title="Expenses (Month)"
              value={formatINR(monthExpenses)}
              icon={CreditCard}
              statusColor={monthExpenses > monthCollections ? STATUS_COLORS.critical : STATUS_COLORS.neutral}
            />
            <KPICard
              title="Net Cash Movement"
              value={formatINR(netCashMovement)}
              trend={netCashMovement >= 0 ? "up" : "down"}
              icon={ArrowRightLeft}
              statusColor={netCashMovement >= 0 ? STATUS_COLORS.healthy : STATUS_COLORS.critical}
            />
            <KPICard
              title="Burn Rate"
              value={formatINR(burnRate)}
              subtitle="avg/month (3m)"
              icon={Flame}
              statusColor={STATUS_COLORS.neutral}
            />
            <KPICard
              title="Runway"
              value={runwayMonths >= 999 ? "∞" : `${runwayMonths}m`}
              subtitle="months at current rate"
              icon={ShieldCheck}
              statusColor={runwayMonths >= 6 ? STATUS_COLORS.healthy : runwayMonths >= 3 ? STATUS_COLORS.watch : STATUS_COLORS.critical}
            />
            <KPICard
              title="Cash in Bank"
              value={formatINR(cashInBank)}
              icon={Building2}
              statusColor={cashInBank > 0 ? STATUS_COLORS.healthy : STATUS_COLORS.critical}
            />
          </div>

          {/* Receivables Aging */}
          <Card className="border border-gray-100 shadow-sm">
            <CardHeader className="pb-2 p-4">
              <CardTitle className="text-xs font-semibold text-gray-600">Receivables Aging</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 rounded-lg bg-green-50 border border-green-100">
                  <p className="text-[10px] font-medium text-green-700 uppercase mb-1">0–30 Days</p>
                  <p className="text-lg font-bold text-green-800">{formatINR(receivablesAging.age030)}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-amber-50 border border-amber-100">
                  <p className="text-[10px] font-medium text-amber-700 uppercase mb-1">30–60 Days</p>
                  <p className="text-lg font-bold text-amber-800">{formatINR(receivablesAging.age3060)}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-red-50 border border-red-100">
                  <p className="text-[10px] font-medium text-red-700 uppercase mb-1">60+ Days</p>
                  <p className="text-lg font-bold text-red-800">{formatINR(receivablesAging.age60plus)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {upcomingPaymentsData?.milestones?.length > 0 && (
            <Card className="border border-gray-100 shadow-sm mt-4">
              <CardHeader className="pb-2 p-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-semibold text-amber-700 flex items-center gap-2">
                    <Banknote className="h-3.5 w-3.5" />
                    Upcoming Client Collections (Portal Milestones)
                  </CardTitle>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    {upcomingPaymentsData.summary.totalMilestones} pending
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <div className="text-center p-3 rounded-lg bg-red-50 border border-red-100">
                    <p className="text-[10px] font-medium text-red-700 uppercase mb-1">Overdue</p>
                    <p className="text-lg font-bold text-red-800">{formatINR(upcomingPaymentsData.summary.overdueAmount)}</p>
                    <p className="text-[10px] text-red-500">{upcomingPaymentsData.summary.overdueCount} milestone{upcomingPaymentsData.summary.overdueCount !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-amber-50 border border-amber-100">
                    <p className="text-[10px] font-medium text-amber-700 uppercase mb-1">Next 7 Days</p>
                    <p className="text-lg font-bold text-amber-800">{formatINR(upcomingPaymentsData.summary.next7DaysAmount)}</p>
                    <p className="text-[10px] text-amber-500">{upcomingPaymentsData.summary.next7DaysCount} milestone{upcomingPaymentsData.summary.next7DaysCount !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-blue-50 border border-blue-100">
                    <p className="text-[10px] font-medium text-blue-700 uppercase mb-1">Next 30 Days</p>
                    <p className="text-lg font-bold text-blue-800">{formatINR(upcomingPaymentsData.summary.next30DaysAmount)}</p>
                    <p className="text-[10px] text-blue-500">{upcomingPaymentsData.summary.next30DaysCount} milestone{upcomingPaymentsData.summary.next30DaysCount !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-green-50 border border-green-100">
                    <p className="text-[10px] font-medium text-green-700 uppercase mb-1">Total Pending</p>
                    <p className="text-lg font-bold text-green-800">{formatINR(upcomingPaymentsData.summary.totalPending)}</p>
                    <p className="text-[10px] text-green-500">{upcomingPaymentsData.summary.totalMilestones} total</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-semibold text-gray-500 uppercase mb-2">By Wedding Planner</p>
                    <div className="space-y-2">
                      {(upcomingPaymentsData.plannerSummary || []).map((ps: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                              {ps.plannerName?.charAt(0) || '?'}
                            </div>
                            <span className="text-xs font-medium">{ps.plannerName}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-bold text-amber-700">{formatINR(ps.totalPending)}</span>
                            <span className="text-[10px] text-muted-foreground ml-1">({ps.milestoneCount})</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold text-gray-500 uppercase mb-2">Upcoming Due (Next items)</p>
                    <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                      {upcomingPaymentsData.milestones
                        .sort((a: any, b: any) => {
                          if (!a.dueDate) return 1;
                          if (!b.dueDate) return -1;
                          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
                        })
                        .slice(0, 10)
                        .map((m: any, i: number) => {
                          const isOverdue = m.dueDate && new Date(m.dueDate) < new Date();
                          return (
                            <div key={i} className={`flex items-center justify-between p-2 rounded text-[11px] ${isOverdue ? 'bg-red-50 border border-red-100' : 'bg-gray-50 border border-gray-100'}`}>
                              <div className="flex-1 min-w-0">
                                <span className="font-medium">{m.clientName}</span>
                                <span className="text-muted-foreground"> · {m.milestoneName}</span>
                                {m.assignedPlannerName && (
                                  <span className="text-muted-foreground"> · {m.assignedPlannerName}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                                {m.dueDate && (
                                  <span className={`text-[10px] ${isOverdue ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                                    {new Date(m.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                  </span>
                                )}
                                <span className={`font-semibold ${isOverdue ? 'text-red-600' : 'text-amber-700'}`}>
                                  {formatINR(parseFloat(m.amount || '0'))}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cashflow Planning - Collapsible */}
          <div className="mt-4">
            <Button
              variant="outline"
              className="w-full flex items-center justify-between py-3 text-sm font-semibold text-gray-700 border-gray-200 hover:bg-gray-50"
              onClick={() => setShowCashflowPlanning(!showCashflowPlanning)}
              data-testid="btn-toggle-cashflow-planning"
            >
              <span className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" />
                Cashflow Planning & Liabilities
              </span>
              {showCashflowPlanning ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            {showCashflowPlanning && (
              <div className="mt-3">
                <CashflowPlanningSection />
              </div>
            )}
          </div>
        </section>
        )}

      </div>
    </div>
  );
}

function CashflowPlanningSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const now = new Date();
  const [cfMonth, setCfMonth] = useState(format(now, "yyyy-MM"));
  const [cfTab, setCfTab] = useState<"expenses" | "inflows" | "liabilities" | "vendor_payments">("expenses");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showLiabilityDialog, setShowLiabilityDialog] = useState(false);
  const [showVendorPaymentDialog, setShowVendorPaymentDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [editingLiability, setEditingLiability] = useState<any>(null);
  const [editingVendorPayment, setEditingVendorPayment] = useState<any>(null);

  const [formName, setFormName] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formDueDate, setFormDueDate] = useState("");
  const [formCategory, setFormCategory] = useState("other");
  const [formDescription, setFormDescription] = useState("");
  const [formIsRecurring, setFormIsRecurring] = useState(false);
  const [formType, setFormType] = useState<"expense" | "inflow">("expense");

  const [liabName, setLiabName] = useState("");
  const [liabAmount, setLiabAmount] = useState("");
  const [liabCreditor, setLiabCreditor] = useState("");
  const [liabDueDate, setLiabDueDate] = useState("");
  const [liabDescription, setLiabDescription] = useState("");

  const [vpVendorId, setVpVendorId] = useState("");
  const [vpVendorName, setVpVendorName] = useState("");
  const [vpAmount, setVpAmount] = useState("");
  const [vpDueDate, setVpDueDate] = useState("");
  const [vpDescription, setVpDescription] = useState("");
  const [vpVendorSearchOpen, setVpVendorSearchOpen] = useState(false);
  const [vpVendorSearchValue, setVpVendorSearchValue] = useState("");
  const [showAddVendorInline, setShowAddVendorInline] = useState(false);
  const [newVendorName, setNewVendorName] = useState("");
  const [newVendorPhone, setNewVendorPhone] = useState("");
  const [newVendorCategory, setNewVendorCategory] = useState("other");

  const { data: cashflowData = [] } = useQuery<any[]>({
    queryKey: ["/api/cashflow-entries", cfMonth],
    queryFn: async () => {
      const res = await fetch(`/api/cashflow-entries?month=${cfMonth}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: liabilitiesData = [] } = useQuery<any[]>({
    queryKey: ["/api/liabilities"],
  });

  const createEntry = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/cashflow-entries", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow-entries"] });
      toast({ title: "Entry added" });
      resetForm();
      setShowAddDialog(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateEntry = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/cashflow-entries/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow-entries"] });
      toast({ title: "Entry updated" });
      setEditingEntry(null);
      resetForm();
      setShowAddDialog(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/cashflow-entries/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow-entries"] });
      toast({ title: "Entry deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const generateRecurring = useMutation({
    mutationFn: async (month: string) => {
      const res = await apiRequest("POST", "/api/cashflow-entries/generate-recurring", { month });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow-entries"] });
      toast({ title: "Recurring entries generated", description: `${data.generated || 0} entries created` });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createLiability = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/liabilities", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/liabilities"] });
      toast({ title: "Liability added" });
      resetLiabilityForm();
      setShowLiabilityDialog(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateLiability = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/liabilities/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/liabilities"] });
      toast({ title: "Liability updated" });
      setEditingLiability(null);
      resetLiabilityForm();
      setShowLiabilityDialog(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteLiability = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/liabilities/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/liabilities"] });
      toast({ title: "Liability deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const { data: vendorsData = [] } = useQuery<any[]>({
    queryKey: ["/api/vendors"],
  });

  const { data: vendorPaymentsData = [] } = useQuery<any[]>({
    queryKey: ["/api/cashflow-vendor-payments"],
  });

  const createVendorPayment = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/cashflow-vendor-payments", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow-vendor-payments"] });
      toast({ title: "Vendor payment added" });
      resetVendorPaymentForm();
      setShowVendorPaymentDialog(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateVendorPayment = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/cashflow-vendor-payments/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow-vendor-payments"] });
      toast({ title: "Vendor payment updated" });
      setEditingVendorPayment(null);
      resetVendorPaymentForm();
      setShowVendorPaymentDialog(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteVendorPayment = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/cashflow-vendor-payments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow-vendor-payments"] });
      toast({ title: "Vendor payment deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createVendorMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/vendors", data);
      return res.json();
    },
    onSuccess: (newVendor: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      setVpVendorId(newVendor.id);
      setVpVendorName(newVendor.name);
      setShowAddVendorInline(false);
      setNewVendorName("");
      setNewVendorPhone("");
      setNewVendorCategory("other");
      toast({ title: "Vendor added to global list" });
    },
    onError: (e: Error) => toast({ title: "Error adding vendor", description: e.message, variant: "destructive" }),
  });

  const resetForm = () => {
    setFormName(""); setFormAmount(""); setFormDueDate(""); setFormCategory("other");
    setFormDescription(""); setFormIsRecurring(false); setFormType("expense"); setEditingEntry(null);
  };

  const resetLiabilityForm = () => {
    setLiabName(""); setLiabAmount(""); setLiabCreditor(""); setLiabDueDate("");
    setLiabDescription(""); setEditingLiability(null);
  };

  const resetVendorPaymentForm = () => {
    setVpVendorId(""); setVpVendorName(""); setVpAmount(""); setVpDueDate("");
    setVpDescription(""); setEditingVendorPayment(null);
    setShowAddVendorInline(false); setNewVendorName(""); setNewVendorPhone(""); setNewVendorCategory("other");
  };

  const openEditEntry = (entry: any) => {
    setEditingEntry(entry);
    setFormName(entry.name || "");
    setFormAmount(entry.amount || "");
    setFormDueDate(entry.dueDate || "");
    setFormCategory(entry.category || "other");
    setFormDescription(entry.description || "");
    setFormIsRecurring(entry.isRecurring || false);
    setFormType(entry.type || "expense");
    setShowAddDialog(true);
  };

  const openEditLiability = (liab: any) => {
    setEditingLiability(liab);
    setLiabName(liab.name || "");
    setLiabAmount(liab.amount || "");
    setLiabCreditor(liab.creditor || "");
    setLiabDueDate(liab.dueDate || "");
    setLiabDescription(liab.description || "");
    setShowLiabilityDialog(true);
  };

  const openEditVendorPayment = (vp: any) => {
    setEditingVendorPayment(vp);
    setVpVendorId(vp.vendorId || "");
    setVpVendorName(vp.vendorName || "");
    setVpAmount(vp.amount || "");
    setVpDueDate(vp.dueDate || "");
    setVpDescription(vp.description || "");
    setShowVendorPaymentDialog(true);
  };

  const handleSubmitEntry = () => {
    if (!formName || !formAmount) return;
    const entryMonth = formDueDate ? formDueDate.substring(0, 7) : cfMonth;
    const payload = {
      name: formName,
      amount: formAmount,
      dueDate: formDueDate || null,
      month: entryMonth,
      category: formCategory,
      description: formDescription || null,
      isRecurring: formIsRecurring,
      type: formType,
    };
    if (entryMonth !== cfMonth) {
      setCfMonth(entryMonth);
    }
    if (editingEntry) {
      updateEntry.mutate({ id: editingEntry.id, data: payload });
    } else {
      createEntry.mutate(payload);
    }
  };

  const handleSubmitLiability = () => {
    if (!liabName || !liabAmount) return;
    const payload = {
      name: liabName,
      amount: liabAmount,
      creditor: liabCreditor || null,
      dueDate: liabDueDate || null,
      description: liabDescription || null,
    };
    if (editingLiability) {
      updateLiability.mutate({ id: editingLiability.id, data: payload });
    } else {
      createLiability.mutate(payload);
    }
  };

  const handleSubmitVendorPayment = () => {
    if (!vpVendorName || !vpAmount) return;
    const payload = {
      vendorId: vpVendorId || null,
      vendorName: vpVendorName,
      amount: vpAmount,
      dueDate: vpDueDate || null,
      description: vpDescription || null,
    };
    if (editingVendorPayment) {
      updateVendorPayment.mutate({ id: editingVendorPayment.id, data: payload });
    } else {
      createVendorPayment.mutate(payload);
    }
  };

  const filteredVendors = useMemo(() => {
    if (!vpVendorSearchValue) return vendorsData;
    return vendorsData.filter((v: any) =>
      v.name?.toLowerCase().includes(vpVendorSearchValue.toLowerCase())
    );
  }, [vendorsData, vpVendorSearchValue]);

  const expenses = cashflowData.filter((e: any) => e.type === "expense");
  const inflows = cashflowData.filter((e: any) => e.type === "inflow");

  const totalExpenses = expenses.reduce((s: number, e: any) => s + (parseFloat(e.amount) || 0), 0);
  const totalInflows = inflows.reduce((s: number, e: any) => s + (parseFloat(e.amount) || 0), 0);
  const netPosition = totalInflows - totalExpenses;
  const totalUnpaidLiabilities = liabilitiesData
    .filter((l: any) => !l.isPaid)
    .reduce((s: number, l: any) => s + (parseFloat(l.amount) || 0), 0);
  const totalPendingVendorPayments = vendorPaymentsData
    .filter((vp: any) => !vp.isPaid)
    .reduce((s: number, vp: any) => s + (parseFloat(vp.amount) || 0), 0);

  const today = new Date();

  const categoryColors: Record<string, string> = {
    salary: "bg-blue-100 text-blue-700",
    rent: "bg-purple-100 text-purple-700",
    subscription: "bg-cyan-100 text-cyan-700",
    vendor: "bg-orange-100 text-orange-700",
    collection: "bg-green-100 text-green-700",
    other: "bg-gray-100 text-gray-700",
  };

  const renderEntryList = (entries: any[]) => {
    if (entries.length === 0) {
      return <p className="text-xs text-gray-400 text-center py-8" data-testid="cashflow-empty">No entries for this month</p>;
    }
    return (
      <div className="space-y-2">
        {entries.map((entry: any) => {
          const isOverdue = entry.dueDate && new Date(entry.dueDate) < today && !entry.isPaid;
          const isPaid = entry.isPaid;
          return (
            <div
              key={entry.id}
              data-testid={`cashflow-entry-${entry.id}`}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg border transition-colors",
                isOverdue && "bg-red-50 border-red-200",
                isPaid && "bg-green-50/50 border-green-100",
                !isOverdue && !isPaid && "bg-white border-gray-100 hover:bg-gray-50"
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn("text-sm font-medium", isPaid && "line-through text-gray-400")} data-testid={`entry-name-${entry.id}`}>
                    {entry.name}
                  </span>
                  {entry.category && (
                    <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", categoryColors[entry.category] || categoryColors.other)} data-testid={`entry-category-${entry.id}`}>
                      {entry.category}
                    </Badge>
                  )}
                  {entry.isRecurring && entry.recurringActive && (
                    <span className="flex items-center gap-0.5 text-[10px] text-blue-500" data-testid={`entry-recurring-${entry.id}`}>
                      <Repeat className="w-3 h-3" /> Recurring
                    </span>
                  )}
                  {isPaid && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                  {isOverdue && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500">
                  <span className={cn("font-semibold text-sm", isPaid ? "text-gray-400" : entry.type === "inflow" ? "text-green-700" : "text-red-700")} data-testid={`entry-amount-${entry.id}`}>
                    {formatINRFull(parseFloat(entry.amount) || 0)}
                  </span>
                  {entry.dueDate && (
                    <span className={cn(isOverdue && "text-red-500 font-medium")}>
                      Due: {format(new Date(entry.dueDate), "dd MMM yyyy")}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                {!isPaid && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[10px] text-green-600 hover:text-green-700"
                    onClick={() => updateEntry.mutate({ id: entry.id, data: { isPaid: true, paidAt: new Date().toISOString() } })}
                    data-testid={`mark-paid-${entry.id}`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </Button>
                )}
                {entry.isRecurring && entry.recurringActive && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[10px] text-orange-500 hover:text-orange-600"
                    onClick={() => updateEntry.mutate({ id: entry.id, data: { recurringActive: false } })}
                    data-testid={`stop-recurring-${entry.id}`}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[10px]"
                  onClick={() => openEditEntry(entry)}
                  data-testid={`edit-entry-${entry.id}`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[10px] text-red-500 hover:text-red-600"
                  onClick={() => deleteEntry.mutate(entry.id)}
                  data-testid={`delete-entry-${entry.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <section className="pb-8" data-testid="cashflow-planning-section">
      <SectionHeader title="Cashflow Planning" subtitle="Track expected inflows, expenses, and liabilities" />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-gray-500">Month</Label>
          <Input
            type="month"
            value={cfMonth}
            onChange={(e) => setCfMonth(e.target.value)}
            className="w-40 h-8 text-xs"
            data-testid="cashflow-month-selector"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1"
          onClick={() => generateRecurring.mutate(cfMonth)}
          disabled={generateRecurring.isPending}
          data-testid="generate-recurring-btn"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", generateRecurring.isPending && "animate-spin")} />
          Generate Recurring
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        <KPICard
          title="Expected Inflows"
          value={formatINR(totalInflows)}
          icon={TrendingUp}
          statusColor={STATUS_COLORS.healthy}
        />
        <KPICard
          title="Expected Expenses"
          value={formatINR(totalExpenses)}
          icon={TrendingDown}
          statusColor={totalExpenses > totalInflows ? STATUS_COLORS.critical : STATUS_COLORS.neutral}
        />
        <KPICard
          title="Net Position"
          value={formatINR(netPosition)}
          trend={netPosition >= 0 ? "up" : "down"}
          icon={ArrowRightLeft}
          statusColor={netPosition >= 0 ? STATUS_COLORS.healthy : STATUS_COLORS.critical}
        />
        <KPICard
          title="Unpaid Liabilities"
          value={formatINR(totalUnpaidLiabilities)}
          icon={AlertTriangle}
          statusColor={totalUnpaidLiabilities > 0 ? STATUS_COLORS.watch : STATUS_COLORS.healthy}
        />
        <KPICard
          title="Pending Vendor Payments"
          value={formatINR(totalPendingVendorPayments)}
          icon={Store}
          statusColor={totalPendingVendorPayments > 0 ? STATUS_COLORS.watch : STATUS_COLORS.healthy}
        />
      </div>

      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="pb-2 p-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-1 flex-wrap">
              {(["expenses", "inflows", "liabilities", "vendor_payments"] as const).map((tab) => (
                <Button
                  key={tab}
                  size="sm"
                  variant={cfTab === tab ? "default" : "ghost"}
                  className={cn("h-7 text-xs capitalize", cfTab === tab && "bg-[#4b7c29] hover:bg-[#3d6521]")}
                  onClick={() => setCfTab(tab)}
                  data-testid={`cashflow-tab-${tab}`}
                >
                  {tab === "expenses" ? "Expected Expenses" : tab === "inflows" ? "Expected Inflows" : tab === "liabilities" ? "Liabilities" : "Vendor Payments"}
                </Button>
              ))}
            </div>
            <div className="flex gap-1">
              {cfTab !== "liabilities" && cfTab !== "vendor_payments" && (
                <Dialog open={showAddDialog} onOpenChange={(open) => { setShowAddDialog(open); if (!open) resetForm(); }}>
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      className="h-7 text-xs gap-1 bg-[#4b7c29] hover:bg-[#3d6521]"
                      onClick={() => { resetForm(); setFormType(cfTab === "inflows" ? "inflow" : "expense"); }}
                      data-testid="add-cashflow-entry-btn"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Entry
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle className="text-sm">{editingEntry ? "Edit Entry" : "Add Cashflow Entry"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 mt-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Type</Label>
                        <Select value={formType} onValueChange={(v) => setFormType(v as "expense" | "inflow")}>
                          <SelectTrigger className="h-8 text-xs" data-testid="entry-type-select">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="expense">Expense</SelectItem>
                            <SelectItem value="inflow">Inflow</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Name *</Label>
                        <Input value={formName} onChange={(e) => setFormName(e.target.value)} className="h-8 text-xs" placeholder="e.g. Office Rent" data-testid="entry-name-input" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Amount *</Label>
                          <Input type="number" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} className="h-8 text-xs" placeholder="0" data-testid="entry-amount-input" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Due Date</Label>
                          <Input type="date" value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} className="h-8 text-xs" data-testid="entry-due-date-input" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Category</Label>
                        <Select value={formCategory} onValueChange={setFormCategory}>
                          <SelectTrigger className="h-8 text-xs" data-testid="entry-category-select">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="salary">Salary</SelectItem>
                            <SelectItem value="rent">Rent</SelectItem>
                            <SelectItem value="subscription">Subscription</SelectItem>
                            <SelectItem value="vendor">Vendor</SelectItem>
                            <SelectItem value="collection">Collection</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Description</Label>
                        <Input value={formDescription} onChange={(e) => setFormDescription(e.target.value)} className="h-8 text-xs" placeholder="Optional description" data-testid="entry-description-input" />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Is Recurring</Label>
                        <Switch checked={formIsRecurring} onCheckedChange={setFormIsRecurring} data-testid="entry-recurring-toggle" />
                      </div>
                      <Button
                        className="w-full h-8 text-xs bg-[#4b7c29] hover:bg-[#3d6521]"
                        onClick={handleSubmitEntry}
                        disabled={createEntry.isPending || updateEntry.isPending}
                        data-testid="submit-entry-btn"
                      >
                        {editingEntry ? "Update Entry" : "Add Entry"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
              {cfTab === "vendor_payments" && (
                <Dialog open={showVendorPaymentDialog} onOpenChange={(open) => { setShowVendorPaymentDialog(open); if (!open) resetVendorPaymentForm(); }}>
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      className="h-7 text-xs gap-1 bg-[#4b7c29] hover:bg-[#3d6521]"
                      onClick={() => resetVendorPaymentForm()}
                      data-testid="add-vendor-payment-btn"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Vendor Payment
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle className="text-sm">{editingVendorPayment ? "Edit Vendor Payment" : "Add Vendor Payment"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 mt-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Vendor *</Label>
                        {!showAddVendorInline ? (
                          <Popover open={vpVendorSearchOpen} onOpenChange={setVpVendorSearchOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={vpVendorSearchOpen}
                                className="w-full justify-between h-8 text-xs"
                                data-testid="select-vendor-payment-vendor"
                              >
                                {vpVendorName || "Select vendor..."}
                                <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-full p-0" align="start">
                              <Command>
                                <CommandInput
                                  placeholder="Search vendors..."
                                  value={vpVendorSearchValue}
                                  onValueChange={setVpVendorSearchValue}
                                  className="h-8 text-xs"
                                />
                                <CommandList className="max-h-48">
                                  <CommandEmpty>
                                    <div className="py-2 text-center">
                                      <p className="text-xs text-gray-500 mb-2">No vendors found</p>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs gap-1"
                                        onClick={() => {
                                          setNewVendorName(vpVendorSearchValue);
                                          setShowAddVendorInline(true);
                                          setVpVendorSearchOpen(false);
                                        }}
                                        data-testid="add-new-vendor-from-search"
                                      >
                                        <Plus className="w-3 h-3" /> Add "{vpVendorSearchValue}" as new vendor
                                      </Button>
                                    </div>
                                  </CommandEmpty>
                                  <CommandGroup>
                                    {filteredVendors.map((v: any) => (
                                      <CommandItem
                                        key={v.id}
                                        value={v.name}
                                        onSelect={() => {
                                          setVpVendorId(v.id);
                                          setVpVendorName(v.name);
                                          setVpVendorSearchOpen(false);
                                          setVpVendorSearchValue("");
                                        }}
                                        className="text-xs"
                                      >
                                        <Check className={cn("mr-2 h-3.5 w-3.5", vpVendorId === v.id ? "opacity-100" : "opacity-0")} />
                                        <div>
                                          <span>{v.name}</span>
                                          {v.category && <span className="ml-1 text-[10px] text-gray-400">({v.category})</span>}
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                  <CommandGroup>
                                    <CommandItem
                                      onSelect={() => {
                                        setNewVendorName(vpVendorSearchValue);
                                        setShowAddVendorInline(true);
                                        setVpVendorSearchOpen(false);
                                      }}
                                      className="text-xs text-[#4b7c29] font-medium"
                                    >
                                      <Plus className="mr-2 h-3.5 w-3.5" /> Add new vendor
                                    </CommandItem>
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <div className="space-y-2 p-3 border rounded-lg bg-gray-50">
                            <p className="text-[10px] font-medium text-gray-600">Add New Vendor to Global List</p>
                            <Input
                              value={newVendorName}
                              onChange={(e) => setNewVendorName(e.target.value)}
                              className="h-8 text-xs"
                              placeholder="Vendor name *"
                              data-testid="new-vendor-name-input"
                            />
                            <Input
                              value={newVendorPhone}
                              onChange={(e) => setNewVendorPhone(e.target.value)}
                              className="h-8 text-xs"
                              placeholder="Phone (optional)"
                              data-testid="new-vendor-phone-input"
                            />
                            <Select value={newVendorCategory} onValueChange={setNewVendorCategory}>
                              <SelectTrigger className="h-8 text-xs" data-testid="new-vendor-category-select">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="catering">Catering</SelectItem>
                                <SelectItem value="decoration">Decoration</SelectItem>
                                <SelectItem value="photography">Photography</SelectItem>
                                <SelectItem value="venue">Venue</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="h-7 text-xs flex-1 bg-[#4b7c29] hover:bg-[#3d6521]"
                                onClick={() => {
                                  if (!newVendorName.trim()) return;
                                  createVendorMutation.mutate({
                                    name: newVendorName.trim(),
                                    phone: newVendorPhone || null,
                                    category: newVendorCategory,
                                  });
                                }}
                                disabled={createVendorMutation.isPending || !newVendorName.trim()}
                                data-testid="save-new-vendor-btn"
                              >
                                Save Vendor
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => {
                                  setShowAddVendorInline(false);
                                  setNewVendorName("");
                                  setNewVendorPhone("");
                                  setNewVendorCategory("other");
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Amount *</Label>
                          <Input type="number" value={vpAmount} onChange={(e) => setVpAmount(e.target.value)} className="h-8 text-xs" placeholder="0" data-testid="vendor-payment-amount-input" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Due Date</Label>
                          <Input type="date" value={vpDueDate} onChange={(e) => setVpDueDate(e.target.value)} className="h-8 text-xs" data-testid="vendor-payment-due-date-input" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Description</Label>
                        <Input value={vpDescription} onChange={(e) => setVpDescription(e.target.value)} className="h-8 text-xs" placeholder="e.g. Material cost for event" data-testid="vendor-payment-description-input" />
                      </div>
                      <Button
                        className="w-full h-8 text-xs bg-[#4b7c29] hover:bg-[#3d6521]"
                        onClick={handleSubmitVendorPayment}
                        disabled={createVendorPayment.isPending || updateVendorPayment.isPending || !vpVendorName}
                        data-testid="submit-vendor-payment-btn"
                      >
                        {editingVendorPayment ? "Update Vendor Payment" : "Add Vendor Payment"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
              {cfTab === "liabilities" && (
                <Dialog open={showLiabilityDialog} onOpenChange={(open) => { setShowLiabilityDialog(open); if (!open) resetLiabilityForm(); }}>
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      className="h-7 text-xs gap-1 bg-[#4b7c29] hover:bg-[#3d6521]"
                      onClick={() => resetLiabilityForm()}
                      data-testid="add-liability-btn"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Liability
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle className="text-sm">{editingLiability ? "Edit Liability" : "Add Liability"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 mt-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Name *</Label>
                        <Input value={liabName} onChange={(e) => setLiabName(e.target.value)} className="h-8 text-xs" placeholder="e.g. Vendor Payment" data-testid="liability-name-input" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Amount *</Label>
                          <Input type="number" value={liabAmount} onChange={(e) => setLiabAmount(e.target.value)} className="h-8 text-xs" placeholder="0" data-testid="liability-amount-input" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Due Date</Label>
                          <Input type="date" value={liabDueDate} onChange={(e) => setLiabDueDate(e.target.value)} className="h-8 text-xs" data-testid="liability-due-date-input" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Creditor</Label>
                        <Input value={liabCreditor} onChange={(e) => setLiabCreditor(e.target.value)} className="h-8 text-xs" placeholder="e.g. ABC Suppliers" data-testid="liability-creditor-input" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Description</Label>
                        <Input value={liabDescription} onChange={(e) => setLiabDescription(e.target.value)} className="h-8 text-xs" placeholder="Optional description" data-testid="liability-description-input" />
                      </div>
                      <Button
                        className="w-full h-8 text-xs bg-[#4b7c29] hover:bg-[#3d6521]"
                        onClick={handleSubmitLiability}
                        disabled={createLiability.isPending || updateLiability.isPending}
                        data-testid="submit-liability-btn"
                      >
                        {editingLiability ? "Update Liability" : "Add Liability"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {cfTab === "expenses" && renderEntryList(expenses)}
          {cfTab === "inflows" && renderEntryList(inflows)}
          {cfTab === "liabilities" && (
            <div>
              {liabilitiesData.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-8" data-testid="liabilities-empty">No liabilities recorded</p>
              ) : (
                <div className="space-y-2">
                  {liabilitiesData.map((liab: any) => {
                    const isOverdue = liab.dueDate && new Date(liab.dueDate) < today && !liab.isPaid;
                    const isPaid = liab.isPaid;
                    return (
                      <div
                        key={liab.id}
                        data-testid={`liability-${liab.id}`}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border transition-colors",
                          isOverdue && "bg-red-50 border-red-200",
                          isPaid && "bg-green-50/50 border-green-100",
                          !isOverdue && !isPaid && "bg-white border-gray-100 hover:bg-gray-50"
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn("text-sm font-medium", isPaid && "line-through text-gray-400")} data-testid={`liability-name-${liab.id}`}>
                              {liab.name}
                            </span>
                            {isPaid && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                            {isOverdue && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500 flex-wrap">
                            <span className={cn("font-semibold text-sm", isPaid ? "text-gray-400" : "text-red-700")} data-testid={`liability-amount-${liab.id}`}>
                              {formatINRFull(parseFloat(liab.amount) || 0)}
                            </span>
                            {liab.creditor && <span>Creditor: {liab.creditor}</span>}
                            {liab.dueDate && (
                              <span className={cn(isOverdue && "text-red-500 font-medium")}>
                                Due: {format(new Date(liab.dueDate), "dd MMM yyyy")}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                          {!isPaid && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-[10px] text-green-600 hover:text-green-700"
                              onClick={() => updateLiability.mutate({ id: liab.id, data: { isPaid: true, paidAt: new Date().toISOString() } })}
                              data-testid={`mark-liability-paid-${liab.id}`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[10px]"
                            onClick={() => openEditLiability(liab)}
                            data-testid={`edit-liability-${liab.id}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[10px] text-red-500 hover:text-red-600"
                            onClick={() => deleteLiability.mutate(liab.id)}
                            data-testid={`delete-liability-${liab.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {cfTab === "vendor_payments" && (
            <div>
              {vendorPaymentsData.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-8" data-testid="vendor-payments-empty">No vendor payments recorded</p>
              ) : (
                <div className="space-y-2">
                  {vendorPaymentsData.map((vp: any) => {
                    const isOverdue = vp.dueDate && new Date(vp.dueDate) < today && !vp.isPaid;
                    const isPaid = vp.isPaid;
                    return (
                      <div
                        key={vp.id}
                        data-testid={`vendor-payment-${vp.id}`}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border transition-colors",
                          isOverdue && "bg-red-50 border-red-200",
                          isPaid && "bg-green-50/50 border-green-100",
                          !isOverdue && !isPaid && "bg-white border-gray-100 hover:bg-gray-50"
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn("text-sm font-medium", isPaid && "line-through text-gray-400")} data-testid={`vendor-payment-name-${vp.id}`}>
                              {vp.vendorName}
                            </span>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-orange-100 text-orange-700">
                              vendor
                            </Badge>
                            {isPaid && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                            {isOverdue && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500 flex-wrap">
                            <span className={cn("font-semibold text-sm", isPaid ? "text-gray-400" : "text-red-700")} data-testid={`vendor-payment-amount-${vp.id}`}>
                              {formatINRFull(parseFloat(vp.amount) || 0)}
                            </span>
                            {vp.description && <span>{vp.description}</span>}
                            {vp.dueDate && (
                              <span className={cn(isOverdue && "text-red-500 font-medium")}>
                                Due: {format(new Date(vp.dueDate), "dd MMM yyyy")}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                          {!isPaid && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-[10px] text-green-600 hover:text-green-700"
                              onClick={() => updateVendorPayment.mutate({ id: vp.id, data: { isPaid: true, paidAt: new Date().toISOString() } })}
                              data-testid={`mark-vendor-payment-paid-${vp.id}`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[10px]"
                            onClick={() => openEditVendorPayment(vp)}
                            data-testid={`edit-vendor-payment-${vp.id}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[10px] text-red-500 hover:text-red-600"
                            onClick={() => deleteVendorPayment.mutate(vp.id)}
                            data-testid={`delete-vendor-payment-${vp.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

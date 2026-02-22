import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, parseISO, differenceInDays } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Edit,
  Trash2,
  Calendar,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  AlertTriangle,
  Repeat,
  X,
  Wallet,
  TrendingUp,
  TrendingDown,
  Ban,
  CircleDollarSign,
  Bell,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { BudgetPlanEntry } from "@shared/schema";

const OUTFLOW_CATEGORIES = [
  "Vendor Payment",
  "Salary & Wages",
  "Office Rent",
  "EMI / Loan Repayment",
  "Material Purchase",
  "Equipment Purchase",
  "Transportation",
  "Marketing & Ads",
  "Utilities",
  "Insurance",
  "Tax Payment",
  "Professional Fees",
  "Maintenance",
  "Event Expenses",
  "Other Expense",
];

const INFLOW_CATEGORIES = [
  "Event Payment",
  "Advance Payment",
  "Client Settlement",
  "Rental Income",
  "Refund Received",
  "Other Income",
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  upcoming: { label: "Upcoming", color: "bg-blue-50 text-blue-700 border-blue-200", icon: Clock },
  due: { label: "Due", color: "bg-amber-50 text-amber-700 border-amber-200", icon: AlertCircle },
  paid: { label: "Paid", color: "bg-green-50 text-green-700 border-green-200", icon: CheckCircle2 },
  overdue: { label: "Overdue", color: "bg-red-50 text-red-700 border-red-200", icon: AlertTriangle },
  cancelled: { label: "Cancelled", color: "bg-gray-50 text-gray-500 border-gray-200", icon: Ban },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: "Low", color: "bg-gray-50 text-gray-600 border-gray-200" },
  normal: { label: "Normal", color: "bg-blue-50 text-blue-600 border-blue-200" },
  high: { label: "High", color: "bg-orange-50 text-orange-600 border-orange-200" },
  urgent: { label: "Urgent", color: "bg-red-50 text-red-600 border-red-200" },
};

function formatINR(amount: number): string {
  if (Math.abs(amount) >= 10000000) return `₹${(amount / 10000000).toFixed(2)}Cr`;
  if (Math.abs(amount) >= 100000) return `₹${(amount / 100000).toFixed(2)}L`;
  if (Math.abs(amount) >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

function formatFullINR(amount: number): string {
  return `₹${Math.abs(amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getDaysUntilDue(dueDate: string): number {
  return differenceInDays(parseISO(dueDate), new Date());
}

function getDueDateLabel(dueDate: string): string {
  const days = getDaysUntilDue(dueDate);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `${days}d left`;
}

interface BudgetPlanFormData {
  title: string;
  category: string;
  amount: string;
  dueDate: string;
  type: string;
  recurring: string;
  status: string;
  reminderDaysBefore: string;
  eventName: string;
  vendorName: string;
  payeeName: string;
  notes: string;
  priority: string;
}

const defaultFormData: BudgetPlanFormData = {
  title: "",
  category: "",
  amount: "",
  dueDate: format(new Date(), "yyyy-MM-dd"),
  type: "outflow",
  recurring: "",
  status: "upcoming",
  reminderDaysBefore: "3",
  eventName: "",
  vendorName: "",
  payeeName: "",
  notes: "",
  priority: "normal",
};

export function BudgetPlan() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<BudgetPlanEntry | null>(null);
  const [formData, setFormData] = useState<BudgetPlanFormData>(defaultFormData);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");

  const startDate = format(startOfMonth(currentMonth), "yyyy-MM-dd");
  const endDate = format(endOfMonth(currentMonth), "yyyy-MM-dd");

  const { data: entries = [], isLoading } = useQuery<BudgetPlanEntry[]>({
    queryKey: ["/api/budget-plan", startDate, endDate],
    queryFn: async () => {
      const res = await fetch(`/api/budget-plan?startDate=${startDate}&endDate=${endDate}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: events = [] } = useQuery<any[]>({
    queryKey: ["/api/events"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/budget-plan", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budget-plan"] });
      closeModal();
      toast({ title: "Entry created", description: "Budget plan entry added successfully" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/budget-plan/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budget-plan"] });
      closeModal();
      toast({ title: "Entry updated", description: "Budget plan entry updated successfully" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/budget-plan/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budget-plan"] });
      toast({ title: "Entry deleted", description: "Budget plan entry removed" });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/budget-plan/${id}/mark-paid`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budget-plan"] });
      toast({ title: "Marked as paid", description: "Payment recorded successfully" });
    },
  });

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEntry(null);
    setFormData(defaultFormData);
  };

  const openCreateModal = () => {
    setFormData({ ...defaultFormData, dueDate: format(new Date(), "yyyy-MM-dd") });
    setEditingEntry(null);
    setIsModalOpen(true);
  };

  const openEditModal = (entry: BudgetPlanEntry) => {
    setEditingEntry(entry);
    setFormData({
      title: entry.title,
      category: entry.category,
      amount: entry.amount,
      dueDate: entry.dueDate,
      type: entry.type,
      recurring: entry.recurring || "",
      status: entry.status,
      reminderDaysBefore: String(entry.reminderDaysBefore),
      eventName: entry.eventName || "",
      vendorName: entry.vendorName || "",
      payeeName: entry.payeeName || "",
      notes: entry.notes || "",
      priority: entry.priority,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.title || !formData.category || !formData.amount || !formData.dueDate) return;
    const payload = {
      ...formData,
      reminderDaysBefore: parseInt(formData.reminderDaysBefore) || 3,
      recurring: formData.recurring || null,
      eventName: formData.eventName || null,
      vendorName: formData.vendorName || null,
      payeeName: formData.payeeName || null,
      notes: formData.notes || null,
    };
    if (editingEntry) {
      updateMutation.mutate({ id: editingEntry.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (filterType !== "all" && e.type !== filterType) return false;
      if (filterStatus !== "all" && e.status !== filterStatus) return false;
      if (filterPriority !== "all" && e.priority !== filterPriority) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          e.title.toLowerCase().includes(term) ||
          e.category.toLowerCase().includes(term) ||
          (e.eventName || "").toLowerCase().includes(term) ||
          (e.vendorName || "").toLowerCase().includes(term) ||
          (e.payeeName || "").toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [entries, filterType, filterStatus, filterPriority, searchTerm]);

  const summary = useMemo(() => {
    const totalOutflow = entries.filter(e => e.type === "outflow" && e.status !== "cancelled").reduce((s, e) => s + parseFloat(e.amount), 0);
    const totalInflow = entries.filter(e => e.type === "inflow" && e.status !== "cancelled").reduce((s, e) => s + parseFloat(e.amount), 0);
    const paidAmount = entries.filter(e => e.status === "paid").reduce((s, e) => s + parseFloat(e.amount), 0);
    const pendingAmount = entries.filter(e => e.status !== "paid" && e.status !== "cancelled").reduce((s, e) => s + parseFloat(e.amount), 0);
    const overdueCount = entries.filter(e => e.status !== "paid" && e.status !== "cancelled" && getDaysUntilDue(e.dueDate) < 0).length;
    const upcomingDue = entries.filter(e => {
      if (e.status === "paid" || e.status === "cancelled") return false;
      const days = getDaysUntilDue(e.dueDate);
      return days >= 0 && days <= 7;
    }).length;
    return { totalOutflow, totalInflow, paidAmount, pendingAmount, overdueCount, upcomingDue };
  }, [entries]);

  const categories = formData.type === "inflow" ? INFLOW_CATEGORIES : OUTFLOW_CATEGORIES;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900" data-testid="text-budget-plan-title">Budget Plan</h2>
          <p className="text-xs sm:text-sm text-gray-500">Schedule and track upcoming payments with automated reminders</p>
        </div>
        <Button onClick={openCreateModal} className="bg-[#4b7c29] hover:bg-[#3d6622] w-full sm:w-auto" data-testid="button-add-budget-entry">
          <Plus className="h-4 w-4 mr-2" /> New Entry
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border border-gray-100">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <span className="text-xs text-gray-500">Total Outflow</span>
            </div>
            <p className="text-base sm:text-lg font-bold text-red-600" data-testid="text-total-outflow">{formatINR(summary.totalOutflow)}</p>
          </CardContent>
        </Card>
        <Card className="border border-gray-100">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-xs text-gray-500">Total Inflow</span>
            </div>
            <p className="text-base sm:text-lg font-bold text-green-600" data-testid="text-total-inflow">{formatINR(summary.totalInflow)}</p>
          </CardContent>
        </Card>
        <Card className="border border-gray-100">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="h-4 w-4 text-gray-500" />
              <span className="text-xs text-gray-500">Pending</span>
            </div>
            <p className="text-base sm:text-lg font-bold text-gray-700" data-testid="text-pending-amount">{formatINR(summary.pendingAmount)}</p>
          </CardContent>
        </Card>
        <Card className="border border-gray-100">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-xs text-gray-500">Alerts</span>
            </div>
            <div className="flex items-center gap-2">
              {summary.overdueCount > 0 && (
                <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 text-xs" data-testid="badge-overdue-count">
                  {summary.overdueCount} overdue
                </Badge>
              )}
              {summary.upcomingDue > 0 && (
                <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 text-xs" data-testid="badge-upcoming-count">
                  {summary.upcomingDue} this week
                </Badge>
              )}
              {summary.overdueCount === 0 && summary.upcomingDue === 0 && (
                <span className="text-sm text-gray-400">All clear</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(m => subMonths(m, 1))} data-testid="button-prev-month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[140px] text-center text-sm font-medium" data-testid="text-current-month">
            {format(currentMonth, "MMMM yyyy")}
          </div>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(m => addMonths(m, 1))} data-testid="button-next-month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative flex-1 sm:max-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search..."
            className="pl-8 h-8 text-sm"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            data-testid="input-search"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-8 text-xs w-full sm:w-[110px]" data-testid="select-filter-type">
            <Filter className="h-3 w-3 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="outflow">Outflow</SelectItem>
            <SelectItem value="inflow">Inflow</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 text-xs w-full sm:w-[120px]" data-testid="select-filter-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="due">Due</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="h-8 text-xs w-full sm:w-[120px]" data-testid="select-filter-priority">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/80">
              <TableHead className="text-xs font-medium text-gray-500 w-[100px]">Due Date</TableHead>
              <TableHead className="text-xs font-medium text-gray-500">Title</TableHead>
              <TableHead className="text-xs font-medium text-gray-500 hidden lg:table-cell">Category</TableHead>
              <TableHead className="text-xs font-medium text-gray-500 text-right">Amount</TableHead>
              <TableHead className="text-xs font-medium text-gray-500 hidden md:table-cell">Status</TableHead>
              <TableHead className="text-xs font-medium text-gray-500 hidden lg:table-cell">Priority</TableHead>
              <TableHead className="text-xs font-medium text-gray-500 hidden xl:table-cell">Reminder</TableHead>
              <TableHead className="text-xs font-medium text-gray-500 w-[44px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-gray-400 text-sm">Loading...</TableCell>
              </TableRow>
            ) : filteredEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <CircleDollarSign className="h-10 w-10 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No budget plan entries for this month</p>
                  <Button variant="link" className="text-[#4b7c29] text-xs mt-1" onClick={openCreateModal} data-testid="button-add-first-entry">
                    Add your first entry
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              filteredEntries.map((entry) => {
                const statusConf = STATUS_CONFIG[entry.status] || STATUS_CONFIG.upcoming;
                const StatusIcon = statusConf.icon;
                const priorityConf = PRIORITY_CONFIG[entry.priority] || PRIORITY_CONFIG.normal;
                const daysLeft = getDaysUntilDue(entry.dueDate);
                const isOverdue = daysLeft < 0 && entry.status !== "paid" && entry.status !== "cancelled";

                return (
                  <TableRow key={entry.id} className={`hover:bg-gray-50/50 ${isOverdue ? 'bg-red-50/30' : ''}`} data-testid={`row-budget-entry-${entry.id}`}>
                    <TableCell className="text-xs text-gray-600">
                      <div>{format(parseISO(entry.dueDate), "dd MMM")}</div>
                      <div className={`text-[10px] ${isOverdue ? 'text-red-500 font-medium' : daysLeft <= 3 ? 'text-amber-500' : 'text-gray-400'}`}>
                        {getDueDateLabel(entry.dueDate)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={`w-1 h-8 rounded-full ${entry.type === 'inflow' ? 'bg-green-400' : 'bg-red-400'}`} />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{entry.title}</div>
                          <div className="text-[10px] text-gray-400 flex items-center gap-1">
                            {entry.vendorName && <span>{entry.vendorName}</span>}
                            {entry.vendorName && entry.eventName && <span>·</span>}
                            {entry.eventName && <span>{entry.eventName}</span>}
                            {entry.recurring && (
                              <>
                                <Repeat className="h-2.5 w-2.5 ml-1" />
                                <span className="capitalize">{entry.recurring}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-gray-500">{entry.category}</TableCell>
                    <TableCell className={`text-right text-sm font-medium ${entry.type === 'inflow' ? 'text-green-600' : 'text-red-600'}`}>
                      {entry.type === 'inflow' ? '+' : '-'}{formatFullINR(parseFloat(entry.amount))}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline" className={`${isOverdue ? STATUS_CONFIG.overdue.color : statusConf.color} text-[10px] px-1.5 py-0`}>
                        <StatusIcon className="h-2.5 w-2.5 mr-0.5" />
                        {isOverdue ? 'Overdue' : statusConf.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Badge variant="outline" className={`${priorityConf.color} text-[10px] px-1.5 py-0`}>
                        {priorityConf.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-xs text-gray-400">
                      <div className="flex items-center gap-1">
                        <Bell className="h-3 w-3" />
                        {entry.reminderDaysBefore}d before
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`button-actions-${entry.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditModal(entry)} data-testid={`button-edit-${entry.id}`}>
                            <Edit className="h-3.5 w-3.5 mr-2" /> Edit
                          </DropdownMenuItem>
                          {entry.status !== "paid" && entry.status !== "cancelled" && (
                            <DropdownMenuItem onClick={() => markPaidMutation.mutate(entry.id)} data-testid={`button-mark-paid-${entry.id}`}>
                              <CheckCircle2 className="h-3.5 w-3.5 mr-2" /> Mark Paid
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => {
                              if (confirm("Delete this budget plan entry?")) deleteMutation.mutate(entry.id);
                            }}
                            className="text-red-600"
                            data-testid={`button-delete-${entry.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEntry ? "Edit Budget Entry" : "New Budget Entry"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Title *</Label>
              <Input
                placeholder="e.g., Office Rent - February"
                value={formData.title}
                onChange={e => setFormData(d => ({ ...d, title: e.target.value }))}
                data-testid="input-title"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={formData.type} onValueChange={v => setFormData(d => ({ ...d, type: v, category: "" }))}>
                  <SelectTrigger data-testid="select-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="outflow">Outflow (Payment)</SelectItem>
                    <SelectItem value="inflow">Inflow (Receipt)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Category *</Label>
                <Select value={formData.category} onValueChange={v => setFormData(d => ({ ...d, category: v }))}>
                  <SelectTrigger data-testid="select-category">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Amount (₹) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={e => setFormData(d => ({ ...d, amount: e.target.value }))}
                  data-testid="input-amount"
                />
              </div>
              <div>
                <Label className="text-xs">Due Date *</Label>
                <Input
                  type="date"
                  value={formData.dueDate}
                  onChange={e => setFormData(d => ({ ...d, dueDate: e.target.value }))}
                  data-testid="input-due-date"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Priority</Label>
                <Select value={formData.priority} onValueChange={v => setFormData(d => ({ ...d, priority: v }))}>
                  <SelectTrigger data-testid="select-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Recurring</Label>
                <Select value={formData.recurring || "none"} onValueChange={v => setFormData(d => ({ ...d, recurring: v === "none" ? "" : v }))}>
                  <SelectTrigger data-testid="select-recurring">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">One-time</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={formData.status} onValueChange={v => setFormData(d => ({ ...d, status: v }))}>
                  <SelectTrigger data-testid="select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="due">Due</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Remind (days before)</Label>
                <Input
                  type="number"
                  min="0"
                  max="30"
                  value={formData.reminderDaysBefore}
                  onChange={e => setFormData(d => ({ ...d, reminderDaysBefore: e.target.value }))}
                  data-testid="input-reminder-days"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Payee / Vendor</Label>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="Payee name"
                  value={formData.payeeName}
                  onChange={e => setFormData(d => ({ ...d, payeeName: e.target.value }))}
                  data-testid="input-payee-name"
                />
                <Input
                  placeholder="Vendor name"
                  value={formData.vendorName}
                  onChange={e => setFormData(d => ({ ...d, vendorName: e.target.value }))}
                  data-testid="input-vendor-name"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Event (optional)</Label>
              <Select value={formData.eventName || "none"} onValueChange={v => setFormData(d => ({ ...d, eventName: v === "none" ? "" : v }))}>
                <SelectTrigger data-testid="select-event">
                  <SelectValue placeholder="Link to event..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No event</SelectItem>
                  {events.map((ev: any) => (
                    <SelectItem key={ev.id} value={ev.title || ev.eventName || ev.id}>
                      {ev.title || ev.eventName || ev.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea
                placeholder="Additional notes..."
                rows={2}
                value={formData.notes}
                onChange={e => setFormData(d => ({ ...d, notes: e.target.value }))}
                data-testid="input-notes"
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={closeModal} data-testid="button-cancel">Cancel</Button>
            <Button
              onClick={handleSubmit}
              className="bg-[#4b7c29] hover:bg-[#3d6622]"
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-submit"
            >
              {editingEntry ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
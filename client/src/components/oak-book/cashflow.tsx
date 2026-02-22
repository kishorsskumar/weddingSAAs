import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, parseISO, isSameMonth } from "date-fns";
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
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Calendar,
  Filter,
  ArrowDownUp,
  Copy,
  CheckCircle2,
  Clock,
  AlertCircle,
  Repeat,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { CashFlowEntry } from "@shared/schema";
import { BudgetPlan } from "./budget-plan";

const INFLOW_CATEGORIES = [
  "Event Payment",
  "Advance Payment",
  "Client Settlement",
  "Rental Income",
  "Refund Received",
  "Investment Return",
  "Loan Received",
  "Other Income",
];

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

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  expected: { label: "Expected", color: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
  confirmed: { label: "Confirmed", color: "bg-blue-50 text-blue-700 border-blue-200", icon: CheckCircle2 },
  received: { label: "Received", color: "bg-green-50 text-green-700 border-green-200", icon: ArrowDownRight },
  paid: { label: "Paid", color: "bg-green-50 text-green-700 border-green-200", icon: ArrowUpRight },
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

interface CashFlowFormData {
  date: string;
  type: string;
  category: string;
  description: string;
  amount: string;
  status: string;
  recurring: string;
  eventName: string;
  vendorName: string;
  notes: string;
}

const defaultFormData: CashFlowFormData = {
  date: format(new Date(), "yyyy-MM-dd"),
  type: "inflow",
  category: "",
  description: "",
  amount: "",
  status: "expected",
  recurring: "",
  eventName: "",
  vendorName: "",
  notes: "",
};

export function CashFlow() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CashFlowEntry | null>(null);
  const [formData, setFormData] = useState<CashFlowFormData>(defaultFormData);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const startDate = format(startOfMonth(currentMonth), "yyyy-MM-dd");
  const endDate = format(endOfMonth(currentMonth), "yyyy-MM-dd");

  const { data: entries = [], isLoading } = useQuery<CashFlowEntry[]>({
    queryKey: ["/api/cashflow", startDate, endDate],
    queryFn: async () => {
      const res = await fetch(`/api/cashflow?startDate=${startDate}&endDate=${endDate}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: events = [] } = useQuery<any[]>({
    queryKey: ["/api/events"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/cashflow", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow"] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/cashflow/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow"] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/cashflow/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow"] });
    },
  });

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEntry(null);
    setFormData(defaultFormData);
  };

  const openCreateModal = (type: string = "inflow") => {
    setFormData({ ...defaultFormData, type, date: format(new Date(), "yyyy-MM-dd") });
    setEditingEntry(null);
    setIsModalOpen(true);
  };

  const openEditModal = (entry: CashFlowEntry) => {
    setEditingEntry(entry);
    setFormData({
      date: entry.date,
      type: entry.type,
      category: entry.category,
      description: entry.description,
      amount: entry.amount,
      status: entry.status,
      recurring: entry.recurring || "",
      eventName: entry.eventName || "",
      vendorName: entry.vendorName || "",
      notes: entry.notes || "",
    });
    setIsModalOpen(true);
  };

  const duplicateEntry = (entry: CashFlowEntry) => {
    const nextMonth = addMonths(parseISO(entry.date), 1);
    setFormData({
      date: format(nextMonth, "yyyy-MM-dd"),
      type: entry.type,
      category: entry.category,
      description: entry.description,
      amount: entry.amount,
      status: "expected",
      recurring: entry.recurring || "",
      eventName: entry.eventName || "",
      vendorName: entry.vendorName || "",
      notes: entry.notes || "",
    });
    setEditingEntry(null);
    setIsModalOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.category || !formData.description || !formData.amount || !formData.date) return;
    const payload = {
      ...formData,
      recurring: formData.recurring || null,
      eventName: formData.eventName || null,
      vendorName: formData.vendorName || null,
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
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          e.description.toLowerCase().includes(term) ||
          e.category.toLowerCase().includes(term) ||
          (e.eventName || "").toLowerCase().includes(term) ||
          (e.vendorName || "").toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [entries, filterType, filterStatus, searchTerm]);

  const summary = useMemo(() => {
    const totalInflow = entries.filter((e) => e.type === "inflow").reduce((s, e) => s + parseFloat(e.amount), 0);
    const totalOutflow = entries.filter((e) => e.type === "outflow").reduce((s, e) => s + parseFloat(e.amount), 0);
    const confirmedInflow = entries.filter((e) => e.type === "inflow" && (e.status === "confirmed" || e.status === "received")).reduce((s, e) => s + parseFloat(e.amount), 0);
    const confirmedOutflow = entries.filter((e) => e.type === "outflow" && (e.status === "confirmed" || e.status === "paid")).reduce((s, e) => s + parseFloat(e.amount), 0);
    const expectedInflow = entries.filter((e) => e.type === "inflow" && e.status === "expected").reduce((s, e) => s + parseFloat(e.amount), 0);
    const expectedOutflow = entries.filter((e) => e.type === "outflow" && e.status === "expected").reduce((s, e) => s + parseFloat(e.amount), 0);
    return { totalInflow, totalOutflow, netFlow: totalInflow - totalOutflow, confirmedInflow, confirmedOutflow, expectedInflow, expectedOutflow };
  }, [entries]);

  const generateRecurringMutation = useMutation({
    mutationFn: async (data: { month: number; year: number }) => {
      const res = await apiRequest("POST", "/api/cashflow/generate-recurring", data);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashflow"] });
      toast({ title: data.created > 0 ? "Recurring entries generated" : "No new entries", description: data.message });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate recurring entries", variant: "destructive" });
    },
  });

  const handleGenerateRecurring = () => {
    const month = currentMonth.getMonth() + 1;
    const year = currentMonth.getFullYear();
    generateRecurringMutation.mutate({ month, year });
  };

  const categories = formData.type === "inflow" ? INFLOW_CATEGORIES : OUTFLOW_CATEGORIES;

  return (
    <div className="flex flex-col h-full" data-testid="cashflow-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b bg-white">
        <div>
          <h2 className="text-lg font-semibold text-gray-900" data-testid="text-cashflow-title">Cash Flow Forecast</h2>
          <p className="text-xs text-gray-500">Plan and track upcoming income & expenses</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            size="sm"
            variant="outline"
            className="text-green-700 border-green-300 hover:bg-green-50"
            onClick={() => openCreateModal("inflow")}
            data-testid="button-add-inflow"
          >
            <ArrowDownRight className="w-3.5 h-3.5 mr-1" />
            Inflow
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-red-700 border-red-300 hover:bg-red-50"
            onClick={() => openCreateModal("outflow")}
            data-testid="button-add-outflow"
          >
            <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
            Outflow
          </Button>
        </div>
      </div>

      {/* Month Navigation & Summary */}
      <div className="px-4 sm:px-6 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} data-testid="button-prev-month">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-center">
            <h3 className="text-base font-semibold text-gray-900" data-testid="text-current-month">{format(currentMonth, "MMMM yyyy")}</h3>
            <p className="text-xs text-gray-500">{entries.length} entries</p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-gray-500 hover:text-gray-700"
              onClick={handleGenerateRecurring}
              disabled={generateRecurringMutation.isPending}
              data-testid="button-generate-recurring"
            >
              <Repeat className="w-3.5 h-3.5 mr-1" />
              {generateRecurringMutation.isPending ? "Generating..." : "Auto-fill"}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} data-testid="button-next-month">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="border-t-2 border-t-green-500" data-testid="card-total-inflow">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Total Inflow</p>
              </div>
              <p className="text-lg sm:text-xl font-bold text-green-700 truncate">{formatINR(summary.totalInflow)}</p>
              <p className="text-[10px] text-gray-400 mt-0.5 truncate">Confirmed: {formatINR(summary.confirmedInflow)}</p>
            </CardContent>
          </Card>
          <Card className="border-t-2 border-t-red-500" data-testid="card-total-outflow">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4 text-red-600" />
                <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Total Outflow</p>
              </div>
              <p className="text-lg sm:text-xl font-bold text-red-700 truncate">{formatINR(summary.totalOutflow)}</p>
              <p className="text-[10px] text-gray-400 mt-0.5 truncate">Confirmed: {formatINR(summary.confirmedOutflow)}</p>
            </CardContent>
          </Card>
          <Card className={`border-t-2 ${summary.netFlow >= 0 ? "border-t-green-500" : "border-t-red-500"}`} data-testid="card-net-flow">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="w-4 h-4 text-gray-600" />
                <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Net Cash Flow</p>
              </div>
              <p className={`text-lg sm:text-xl font-bold truncate ${summary.netFlow >= 0 ? "text-green-700" : "text-red-700"}`}>
                {summary.netFlow >= 0 ? "+" : "-"}{formatINR(Math.abs(summary.netFlow))}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">{summary.netFlow >= 0 ? "Surplus" : "Deficit"}</p>
            </CardContent>
          </Card>
          <Card className="border-t-2 border-t-amber-500" data-testid="card-expected">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Expected</p>
              </div>
              <p className="text-sm font-semibold text-green-600 truncate">+{formatINR(summary.expectedInflow)}</p>
              <p className="text-sm font-semibold text-red-600 truncate">-{formatINR(summary.expectedOutflow)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search entries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-sm"
              data-testid="input-search"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full sm:w-36 h-9 text-sm" data-testid="select-filter-type">
              <ArrowDownUp className="w-3.5 h-3.5 mr-1 text-gray-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="inflow">Inflows</SelectItem>
              <SelectItem value="outflow">Outflows</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-36 h-9 text-sm" data-testid="select-filter-status">
              <Filter className="w-3.5 h-3.5 mr-1 text-gray-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="expected">Expected</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="received">Received</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Entries Table */}
      <div className="flex-1 overflow-auto px-4 sm:px-6 pb-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4b7c29]"></div>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Calendar className="w-12 h-12 mb-3 text-gray-300" />
            <p className="text-sm font-medium">No cash flow entries for {format(currentMonth, "MMMM yyyy")}</p>
            <p className="text-xs mt-1">Add expected income or expenses to plan ahead</p>
            <div className="flex gap-2 mt-4">
              <Button size="sm" variant="outline" onClick={() => openCreateModal("inflow")} className="text-green-700">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Inflow
              </Button>
              <Button size="sm" variant="outline" onClick={() => openCreateModal("outflow")} className="text-red-700">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Outflow
              </Button>
            </div>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/80">
                  <TableHead className="text-xs font-semibold w-24">Date</TableHead>
                  <TableHead className="text-xs font-semibold">Description</TableHead>
                  <TableHead className="text-xs font-semibold hidden lg:table-cell">Category</TableHead>
                  <TableHead className="text-xs font-semibold hidden lg:table-cell">Event / Vendor</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Amount</TableHead>
                  <TableHead className="text-xs font-semibold w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => {
                  const statusConfig = STATUS_CONFIG[entry.status] || STATUS_CONFIG.expected;
                  const isInflow = entry.type === "inflow";
                  return (
                    <TableRow key={entry.id} className="hover:bg-gray-50/50 group" data-testid={`row-cashflow-${entry.id}`}>
                      <TableCell className="text-xs text-gray-600 whitespace-nowrap">
                        {format(parseISO(entry.date), "dd MMM")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isInflow ? "bg-green-500" : "bg-red-500"}`} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{entry.description}</p>
                            <p className="text-[10px] text-gray-400 lg:hidden truncate">{entry.category}</p>
                          </div>
                          {entry.recurring && (
                            <Repeat className="w-3 h-3 text-blue-400 flex-shrink-0" title={`Recurring: ${entry.recurring}`} />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="text-xs text-gray-600">{entry.category}</span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="text-xs text-gray-500 truncate block max-w-[150px]">
                          {entry.eventName || entry.vendorName || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 ${statusConfig.color}`}>
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`text-sm font-semibold ${isInflow ? "text-green-700" : "text-red-700"}`}>
                          {isInflow ? "+" : "-"}{formatFullINR(parseFloat(entry.amount))}
                        </span>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" data-testid={`button-actions-${entry.id}`}>
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={() => openEditModal(entry)}>
                              <Edit className="w-3.5 h-3.5 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => duplicateEntry(entry)}>
                              <Copy className="w-3.5 h-3.5 mr-2" /> Duplicate
                            </DropdownMenuItem>
                            {entry.status === "expected" && (
                              <DropdownMenuItem onClick={() => updateMutation.mutate({ id: entry.id, data: { status: "confirmed" } })}>
                                <CheckCircle2 className="w-3.5 h-3.5 mr-2" /> Mark Confirmed
                              </DropdownMenuItem>
                            )}
                            {entry.status === "confirmed" && entry.type === "inflow" && (
                              <DropdownMenuItem onClick={() => updateMutation.mutate({ id: entry.id, data: { status: "received" } })}>
                                <ArrowDownRight className="w-3.5 h-3.5 mr-2" /> Mark Received
                              </DropdownMenuItem>
                            )}
                            {entry.status === "confirmed" && entry.type === "outflow" && (
                              <DropdownMenuItem onClick={() => updateMutation.mutate({ id: entry.id, data: { status: "paid" } })}>
                                <ArrowUpRight className="w-3.5 h-3.5 mr-2" /> Mark Paid
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => { if (confirm("Delete this entry?")) deleteMutation.mutate(entry.id); }}
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) closeModal(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              {editingEntry ? "Edit Entry" : `New ${formData.type === "inflow" ? "Inflow" : "Outflow"}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* Type Toggle */}
            <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
              <button
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  formData.type === "inflow" ? "bg-white text-green-700 shadow-sm" : "text-gray-500"
                }`}
                onClick={() => setFormData({ ...formData, type: "inflow", category: "" })}
              >
                <ArrowDownRight className="w-3.5 h-3.5 inline mr-1" /> Inflow
              </button>
              <button
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  formData.type === "outflow" ? "bg-white text-red-700 shadow-sm" : "text-gray-500"
                }`}
                onClick={() => setFormData({ ...formData, type: "outflow", category: "" })}
              >
                <ArrowUpRight className="w-3.5 h-3.5 inline mr-1" /> Outflow
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Date *</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="h-9 text-sm"
                  data-testid="input-date"
                />
              </div>
              <div>
                <Label className="text-xs">Amount (₹) *</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="h-9 text-sm"
                  data-testid="input-amount"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Category *</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                <SelectTrigger className="h-9 text-sm" data-testid="select-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Description *</Label>
              <Input
                placeholder={formData.type === "inflow" ? "e.g. Wedding payment from Sharma" : "e.g. Monthly office rent"}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="h-9 text-sm"
                data-testid="input-description"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger className="h-9 text-sm" data-testid="select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expected">Expected</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    {formData.type === "inflow" && <SelectItem value="received">Received</SelectItem>}
                    {formData.type === "outflow" && <SelectItem value="paid">Paid</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Recurring</Label>
                <Select value={formData.recurring || "none"} onValueChange={(v) => setFormData({ ...formData, recurring: v === "none" ? "" : v })}>
                  <SelectTrigger className="h-9 text-sm" data-testid="select-recurring">
                    <SelectValue placeholder="One-time" />
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
                <Label className="text-xs">Event (optional)</Label>
                <Input
                  placeholder="Event name"
                  value={formData.eventName}
                  onChange={(e) => setFormData({ ...formData, eventName: e.target.value })}
                  className="h-9 text-sm"
                  data-testid="input-event"
                />
              </div>
              <div>
                <Label className="text-xs">Vendor (optional)</Label>
                <Input
                  placeholder="Vendor name"
                  value={formData.vendorName}
                  onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                  className="h-9 text-sm"
                  data-testid="input-vendor"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Notes (optional)</Label>
              <Textarea
                placeholder="Additional details..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="text-sm min-h-[60px]"
                data-testid="input-notes"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={closeModal}>Cancel</Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!formData.category || !formData.description || !formData.amount || !formData.date || createMutation.isPending || updateMutation.isPending}
              className="bg-[#4b7c29] hover:bg-[#3d6622] text-white"
              data-testid="button-save"
            >
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingEntry ? "Update" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mt-8 pt-6 border-t border-gray-200">
        <BudgetPlan />
      </div>
    </div>
  );
}

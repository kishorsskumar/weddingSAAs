import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import {
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  ChevronDown,
  X,
  MoreHorizontal,
  Receipt,
  Clock,
  Tag,
  Building2
} from "lucide-react";

type Expense = {
  id: string;
  number: string;
  vendorId: string | null;
  eventId: string | null;
  category: string | null;
  amount: string;
  date: string;
  paymentMode: string | null;
  reference: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
};

type Vendor = {
  id: string;
  name: string;
};

type Event = {
  id: string;
  title: string;
};

const EXPENSE_CATEGORIES = [
  { value: "travel", label: "Travel" },
  { value: "food", label: "Food & Beverages" },
  { value: "materials", label: "Materials" },
  { value: "equipment", label: "Equipment Rental" },
  { value: "labor", label: "Labor" },
  { value: "transport", label: "Transport" },
  { value: "utilities", label: "Utilities" },
  { value: "other", label: "Other" },
];

export function ZohoExpenses() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { data: expenses = [] } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const filteredExpenses = useMemo(() => {
    let filtered = expenses;

    if (categoryFilter !== "all") {
      filtered = filtered.filter((e) => e.category === categoryFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.number.toLowerCase().includes(query) ||
          vendors.find((v) => v.id === e.vendorId)?.name.toLowerCase().includes(query)
      );
    }

    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, categoryFilter, searchQuery, vendors]);

  const selectedExpense = useMemo(
    () => expenses.find((e) => e.id === selectedExpenseId),
    [expenses, selectedExpenseId]
  );

  const createExpense = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/expenses", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      setIsCreateModalOpen(false);
      setEditingExpense(null);
      toast({ title: "Expense Created", description: "Expense has been saved successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateExpense = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/expenses/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      setIsCreateModalOpen(false);
      setEditingExpense(null);
      toast({ title: "Expense Updated", description: "Expense has been updated successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteExpense = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      setSelectedExpenseId(null);
      toast({ title: "Expense Deleted", description: "Expense has been deleted." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const getVendorName = (vendorId: string | null) => {
    if (!vendorId) return "—";
    return vendors.find((v) => v.id === vendorId)?.name || "Unknown";
  };

  const getCategoryLabel = (category: string | null) => {
    return EXPENSE_CATEGORIES.find((c) => c.value === category)?.label || category || "—";
  };

  const getCategoryBadge = (category: string | null) => {
    const colors: Record<string, string> = {
      travel: "bg-blue-50 text-blue-700 border-blue-200",
      food: "bg-orange-50 text-orange-700 border-orange-200",
      materials: "bg-purple-50 text-purple-700 border-purple-200",
      equipment: "bg-green-50 text-green-700 border-green-200",
      labor: "bg-yellow-50 text-yellow-700 border-yellow-200",
      transport: "bg-teal-50 text-teal-700 border-teal-200",
      utilities: "bg-gray-50 text-gray-700 border-gray-200",
      other: "bg-gray-50 text-gray-700 border-gray-200",
    };
    return (
      <Badge variant="outline" className={cn("font-medium", colors[category || "other"] || colors.other)}>
        {getCategoryLabel(category)}
      </Badge>
    );
  };

  return (
    <div className="flex h-full">
      <div className={cn("flex-1 flex flex-col transition-all duration-300", selectedExpense ? "mr-[480px]" : "")}>
        <div className="flex items-center justify-between p-4 border-b bg-white">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-800">Expenses</h2>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                  <Tag className="h-4 w-4 mr-2" />
                  {categoryFilter === "all" ? "All Categories" : getCategoryLabel(categoryFilter)}
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setCategoryFilter("all")}>All Categories</DropdownMenuItem>
                <DropdownMenuSeparator />
                {EXPENSE_CATEGORIES.map((cat) => (
                  <DropdownMenuItem key={cat.value} onClick={() => setCategoryFilter(cat.value)}>
                    {cat.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search expenses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64 h-9"
              />
            </div>
            <Button
              onClick={() => {
                setEditingExpense(null);
                setIsCreateModalOpen(true);
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              New
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-gray-50">
          <table className="w-full">
            <thead className="bg-gray-100 sticky top-0">
              <tr className="text-left text-sm text-gray-600">
                <th className="p-3 w-10">
                  <Checkbox />
                </th>
                <th className="p-3 font-medium">DATE</th>
                <th className="p-3 font-medium">EXPENSE#</th>
                <th className="p-3 font-medium hidden md:table-cell">VENDOR</th>
                <th className="p-3 font-medium">CATEGORY</th>
                <th className="p-3 font-medium text-right">AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    <Receipt className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>No expenses found</p>
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((expense) => (
                  <tr
                    key={expense.id}
                    onClick={() => setSelectedExpenseId(expense.id)}
                    className={cn(
                      "border-b border-gray-100 cursor-pointer hover:bg-blue-50/50 transition-colors",
                      selectedExpenseId === expense.id && "bg-blue-50"
                    )}
                  >
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox />
                    </td>
                    <td className="p-3 text-sm text-gray-700">
                      {format(new Date(expense.date), "dd MMM yyyy")}
                    </td>
                    <td className="p-3">
                      <span className="text-blue-600 hover:underline font-medium">{expense.number}</span>
                    </td>
                    <td className="p-3 text-sm text-gray-600 hidden md:table-cell">
                      {getVendorName(expense.vendorId)}
                    </td>
                    <td className="p-3">{getCategoryBadge(expense.category)}</td>
                    <td className="p-3 text-sm text-right font-medium text-red-600">
                      ₹{parseFloat(expense.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3 border-t bg-white text-sm text-gray-500">
          Showing {filteredExpenses.length} expense{filteredExpenses.length !== 1 ? "s" : ""}
        </div>
      </div>

      {selectedExpense && (
        <ExpenseDetailPanel
          expense={selectedExpense}
          vendor={vendors.find((v) => v.id === selectedExpense.vendorId)}
          event={events.find((e) => e.id === selectedExpense.eventId)}
          onClose={() => setSelectedExpenseId(null)}
          onEdit={() => {
            setEditingExpense(selectedExpense);
            setIsCreateModalOpen(true);
          }}
          onDelete={() => deleteExpense.mutate(selectedExpense.id)}
          getCategoryLabel={getCategoryLabel}
        />
      )}

      <ExpenseFormModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingExpense(null);
        }}
        editingExpense={editingExpense}
        vendors={vendors}
        events={events}
        onSubmit={(data) => {
          if (editingExpense) {
            updateExpense.mutate({ id: editingExpense.id, data });
          } else {
            createExpense.mutate(data);
          }
        }}
        isSubmitting={createExpense.isPending || updateExpense.isPending}
      />
    </div>
  );
}

function ExpenseDetailPanel({
  expense,
  vendor,
  event,
  onClose,
  onEdit,
  onDelete,
  getCategoryLabel,
}: {
  expense: Expense;
  vendor?: Vendor;
  event?: Event;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  getCategoryLabel: (cat: string | null) => string;
}) {
  return (
    <div className="fixed right-0 top-0 h-full w-[480px] bg-white border-l shadow-lg flex flex-col z-50">
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <Receipt className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{expense.number}</h3>
              <p className="text-sm text-gray-500">{getCategoryLabel(expense.category)}</p>
            </div>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-red-600">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2 p-3 border-b bg-white">
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Edit className="h-4 w-4 mr-1" />
          Edit
        </Button>
      </div>

      <div className="p-4 bg-red-50 border-b border-red-100">
        <p className="text-xs text-red-600 uppercase font-medium">Amount</p>
        <p className="text-2xl font-bold text-red-700">
          ₹{parseFloat(expense.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase mb-1">Date</p>
              <p className="text-sm font-medium">{format(new Date(expense.date), "dd MMM yyyy")}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase mb-1">Category</p>
              <p className="text-sm font-medium">{getCategoryLabel(expense.category)}</p>
            </div>
          </div>

          {vendor && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 uppercase mb-2">Vendor</p>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium">{vendor.name}</span>
              </div>
            </div>
          )}

          {event && (
            <div>
              <p className="text-xs text-gray-500 uppercase mb-1">Event</p>
              <p className="text-sm font-medium">{event.title}</p>
            </div>
          )}

          {expense.reference && (
            <div>
              <p className="text-xs text-gray-500 uppercase mb-1">Reference#</p>
              <p className="text-sm text-gray-700">{expense.reference}</p>
            </div>
          )}

          {expense.notes && (
            <div>
              <p className="text-xs text-gray-500 uppercase mb-1">Notes</p>
              <p className="text-sm text-gray-700">{expense.notes}</p>
            </div>
          )}

          <div>
            <p className="text-xs text-gray-500 uppercase mb-2">Created</p>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="h-4 w-4" />
              {expense.createdAt ? format(new Date(expense.createdAt), "dd MMM yyyy 'at' hh:mm a") : "—"}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

function ExpenseFormModal({
  isOpen,
  onClose,
  editingExpense,
  vendors,
  events,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  editingExpense: Expense | null;
  vendors: Vendor[];
  events: Event[];
  onSubmit: (data: any) => void;
  isSubmitting: boolean;
}) {
  const [formData, setFormData] = useState({
    vendorId: "",
    eventId: "",
    category: "",
    amount: "",
    date: format(new Date(), "yyyy-MM-dd"),
    paymentMode: "bank_transfer",
    reference: "",
    notes: "",
  });

  useEffect(() => {
    setFormData({
      vendorId: editingExpense?.vendorId || "",
      eventId: editingExpense?.eventId || "",
      category: editingExpense?.category || "",
      amount: editingExpense?.amount || "",
      date: editingExpense?.date || format(new Date(), "yyyy-MM-dd"),
      paymentMode: editingExpense?.paymentMode || "bank_transfer",
      reference: editingExpense?.reference || "",
      notes: editingExpense?.notes || "",
    });
  }, [editingExpense]);

  const handleSubmit = () => {
    onSubmit(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingExpense ? "Edit Expense" : "New Expense"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Vendor</Label>
              <Select
                value={formData.vendorId}
                onValueChange={(value) => setFormData({ ...formData, vendorId: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Amount *</Label>
              <Input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Date *</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label>Event</Label>
            <Select
              value={formData.eventId}
              onValueChange={(value) => setFormData({ ...formData, eventId: value })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select event (optional)" />
              </SelectTrigger>
              <SelectContent>
                {events.map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Reference#</Label>
            <Input
              value={formData.reference}
              onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
              placeholder="Invoice number, receipt, etc."
              className="mt-1"
            />
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add notes"
              className="mt-1"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.category || !formData.amount}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {editingExpense ? "Update" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
  FileText,
  Clock,
  Building2,
  CreditCard,
  AlertCircle,
  CheckCircle2
} from "lucide-react";

type Bill = {
  id: string;
  number: string;
  vendorId: string | null;
  date: string;
  status: string;
  total: string;
  balanceDue: string;
};

type Vendor = {
  id: string;
  name: string;
};

type Event = {
  id: string;
  title: string;
};

const BILL_STATUSES = [
  { value: "draft", label: "Draft", color: "bg-gray-50 text-gray-700 border-gray-200" },
  { value: "pending", label: "Pending", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  { value: "paid", label: "Paid", color: "bg-green-50 text-green-700 border-green-200" },
  { value: "overdue", label: "Overdue", color: "bg-red-50 text-red-700 border-red-200" },
  { value: "partially_paid", label: "Partially Paid", color: "bg-blue-50 text-blue-700 border-blue-200" },
];

export function ZohoBills() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: bills = [] } = useQuery<Bill[]>({
    queryKey: ["/api/bills"],
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const filteredBills = useMemo(() => {
    let filtered = bills;

    if (statusFilter !== "all") {
      filtered = filtered.filter((b) => b.status === statusFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (b) =>
          b.number.toLowerCase().includes(query) ||
          vendors.find((v) => v.id === b.vendorId)?.name.toLowerCase().includes(query)
      );
    }

    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [bills, statusFilter, searchQuery, vendors]);

  const selectedBill = useMemo(
    () => bills.find((b) => b.id === selectedBillId),
    [bills, selectedBillId]
  );

  const createBill = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/bills", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      setIsCreateModalOpen(false);
      setEditingBill(null);
      toast({ title: "Bill Created", description: "Bill has been saved successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateBill = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/bills/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      setIsCreateModalOpen(false);
      setEditingBill(null);
      toast({ title: "Bill Updated", description: "Bill has been updated successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteBill = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/bills/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      setSelectedBillId(null);
      toast({ title: "Bill Deleted", description: "Bill has been deleted." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const getVendorName = (vendorId: string | null) => {
    if (!vendorId) return "—";
    return vendors.find((v) => v.id === vendorId)?.name || "Unknown";
  };

  const getStatusBadge = (status: string) => {
    const statusInfo = BILL_STATUSES.find((s) => s.value === status) || BILL_STATUSES[0];
    return (
      <Badge variant="outline" className={cn("font-medium", statusInfo.color)}>
        {statusInfo.label}
      </Badge>
    );
  };

  const totalAmount = useMemo(() => {
    return filteredBills.reduce((sum, b) => sum + parseFloat(b.total || "0"), 0);
  }, [filteredBills]);

  const pendingAmount = useMemo(() => {
    return filteredBills
      .filter((b) => parseFloat(b.balanceDue || "0") > 0)
      .reduce((sum, b) => sum + parseFloat(b.balanceDue || "0"), 0);
  }, [filteredBills]);

  return (
    <div className="flex h-full">
      <div className={cn("flex-1 flex flex-col transition-all duration-300", selectedBill ? "mr-[480px]" : "")}>
        <div className="flex items-center justify-between p-4 border-b bg-white">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-800">Bills</h2>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                  <Filter className="h-4 w-4 mr-2" />
                  {statusFilter === "all" ? "All Status" : BILL_STATUSES.find((s) => s.value === statusFilter)?.label}
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setStatusFilter("all")}>All Status</DropdownMenuItem>
                <DropdownMenuSeparator />
                {BILL_STATUSES.map((status) => (
                  <DropdownMenuItem key={status.value} onClick={() => setStatusFilter(status.value)}>
                    {status.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search bills..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64 h-9"
              />
            </div>
            <Button
              onClick={() => {
                setEditingBill(null);
                setIsCreateModalOpen(true);
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              New
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 border-b">
          <div className="bg-white p-4 rounded-lg border">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600">Total Bills</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              ₹{totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-gray-600">Pending Payment</span>
            </div>
            <p className="text-2xl font-bold text-orange-600">
              ₹{pendingAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
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
                <th className="p-3 font-medium">BILL#</th>
                <th className="p-3 font-medium">VENDOR</th>
                <th className="p-3 font-medium">STATUS</th>
                <th className="p-3 font-medium text-right">TOTAL</th>
                <th className="p-3 font-medium text-right">BALANCE DUE</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>No bills found</p>
                  </td>
                </tr>
              ) : (
                filteredBills.map((bill) => (
                  <tr
                    key={bill.id}
                    onClick={() => setSelectedBillId(bill.id)}
                    className={cn(
                      "border-b border-gray-100 cursor-pointer hover:bg-blue-50/50 transition-colors",
                      selectedBillId === bill.id && "bg-blue-50"
                    )}
                  >
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox />
                    </td>
                    <td className="p-3 text-sm text-gray-700">
                      {format(new Date(bill.date), "dd MMM yyyy")}
                    </td>
                    <td className="p-3">
                      <span className="text-blue-600 hover:underline font-medium">{bill.number}</span>
                    </td>
                    <td className="p-3 text-sm text-gray-700">{getVendorName(bill.vendorId)}</td>
                    <td className="p-3">{getStatusBadge(bill.status || "draft")}</td>
                    <td className="p-3 text-sm text-right">
                      ₹{parseFloat(bill.total || "0").toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-sm text-right font-medium text-red-600">
                      ₹{parseFloat(bill.balanceDue || "0").toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3 border-t bg-white text-sm text-gray-500">
          Showing {filteredBills.length} bill{filteredBills.length !== 1 ? "s" : ""}
        </div>
      </div>

      {selectedBill && (
        <BillDetailPanel
          bill={selectedBill}
          vendor={vendors.find((v) => v.id === selectedBill.vendorId)}
          event={undefined}
          onClose={() => setSelectedBillId(null)}
          onEdit={() => {
            setEditingBill(selectedBill);
            setIsCreateModalOpen(true);
          }}
          onDelete={() => deleteBill.mutate(selectedBill.id)}
        />
      )}

      <BillFormModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingBill(null);
        }}
        editingBill={editingBill}
        vendors={vendors}
        events={events}
        onSubmit={(data) => {
          if (editingBill) {
            updateBill.mutate({ id: editingBill.id, data });
          } else {
            createBill.mutate(data);
          }
        }}
        isSubmitting={createBill.isPending || updateBill.isPending}
      />
    </div>
  );
}

function BillDetailPanel({
  bill,
  vendor,
  event,
  onClose,
  onEdit,
  onDelete,
}: {
  bill: Bill;
  vendor?: Vendor;
  event?: Event;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const statusInfo = BILL_STATUSES.find((s) => s.value === bill.status) || BILL_STATUSES[0];

  return (
    <div className="fixed right-0 top-0 h-full w-[480px] bg-white border-l shadow-lg flex flex-col z-50">
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <FileText className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{bill.number}</h3>
              <p className="text-sm text-gray-500">{vendor?.name || "No vendor"}</p>
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
        <Button variant="outline" size="sm">
          <CreditCard className="h-4 w-4 mr-1" />
          Record Payment
        </Button>
      </div>

      <div className="p-4 bg-purple-50 border-b border-purple-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-purple-600 uppercase font-medium">Bill Total</p>
            <p className="text-2xl font-bold text-purple-700">
              ₹{parseFloat(bill.total || "0").toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
            {parseFloat(bill.balanceDue || "0") > 0 && (
              <p className="text-sm text-red-600 mt-1">
                Balance Due: ₹{parseFloat(bill.balanceDue || "0").toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
            )}
          </div>
          <Badge variant="outline" className={cn("font-medium", statusInfo.color)}>
            {statusInfo.label}
          </Badge>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          <div>
            <p className="text-xs text-gray-500 uppercase mb-1">Bill Date</p>
            <p className="text-sm font-medium">{format(new Date(bill.date), "dd MMM yyyy")}</p>
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
        </div>
      </ScrollArea>
    </div>
  );
}

function BillFormModal({
  isOpen,
  onClose,
  editingBill,
  vendors,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  editingBill: Bill | null;
  vendors: Vendor[];
  events?: Event[];
  onSubmit: (data: any) => void;
  isSubmitting: boolean;
}) {
  const [formData, setFormData] = useState({
    vendorId: "",
    total: "",
    date: format(new Date(), "yyyy-MM-dd"),
    status: "pending",
  });

  useEffect(() => {
    setFormData({
      vendorId: editingBill?.vendorId || "",
      total: editingBill?.total || "",
      date: editingBill?.date || format(new Date(), "yyyy-MM-dd"),
      status: editingBill?.status || "pending",
    });
  }, [editingBill]);

  const handleSubmit = () => {
    onSubmit(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingBill ? "Edit Bill" : "New Bill"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>Vendor *</Label>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Total Amount *</Label>
              <Input
                type="number"
                value={formData.total}
                onChange={(e) => setFormData({ ...formData, total: e.target.value })}
                placeholder="0.00"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Bill Date *</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label>Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BILL_STATUSES.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.vendorId || !formData.total}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {editingBill ? "Update" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

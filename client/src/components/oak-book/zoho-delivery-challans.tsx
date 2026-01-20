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
  Truck,
  Clock,
  MapPin,
  FileText,
  Car,
  Download
} from "lucide-react";

type DeliveryChallan = {
  id: string;
  challanNumber: string;
  challanDate: string;
  challanType: string;
  vehicleNumber: string | null;
  deliverTo: string | null;
  deliveryAddress: string | null;
  placeOfSupply: string | null;
  items: any[];
  subTotal: string;
  cgstRate: string;
  cgstAmount: string;
  sgstRate: string;
  sgstAmount: string;
  rounding: string;
  totalAmount: string;
  totalInWords: string | null;
  status: string;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
};

const CHALLAN_TYPES = [
  { value: "Supply", label: "Supply" },
  { value: "Job Work", label: "Job Work" },
  { value: "Export", label: "Export" },
  { value: "SKD/CKD/Lots", label: "SKD/CKD/Lots" },
  { value: "For Own Use", label: "For Own Use" },
  { value: "Line Sales", label: "Line Sales" },
  { value: "Others", label: "Others" },
];

const CHALLAN_STATUSES = [
  { value: "draft", label: "Draft", color: "bg-gray-50 text-gray-700 border-gray-200" },
  { value: "sent", label: "Sent", color: "bg-blue-50 text-primary border-blue-200" },
  { value: "delivered", label: "Delivered", color: "bg-green-50 text-green-700 border-green-200" },
];

export function ZohoDeliveryChallans() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedChallanId, setSelectedChallanId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingChallan, setEditingChallan] = useState<DeliveryChallan | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: challans = [] } = useQuery<DeliveryChallan[]>({
    queryKey: ["/api/delivery-challans"],
  });

  const filteredChallans = useMemo(() => {
    let filtered = challans;

    if (statusFilter !== "all") {
      filtered = filtered.filter((c) => c.status === statusFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.challanNumber.toLowerCase().includes(query) ||
          c.deliverTo?.toLowerCase().includes(query) ||
          c.vehicleNumber?.toLowerCase().includes(query)
      );
    }

    return filtered.sort((a, b) => new Date(b.challanDate).getTime() - new Date(a.challanDate).getTime());
  }, [challans, statusFilter, searchQuery]);

  const selectedChallan = useMemo(
    () => challans.find((c) => c.id === selectedChallanId),
    [challans, selectedChallanId]
  );

  const deleteChallan = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/delivery-challans/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/delivery-challans"] });
      setSelectedChallanId(null);
      toast({ title: "Challan Deleted", description: "Delivery challan has been deleted." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/delivery-challans/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/delivery-challans"] });
      toast({ title: "Status Updated", description: "Challan status has been updated." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const getStatusBadge = (status: string) => {
    const statusInfo = CHALLAN_STATUSES.find((s) => s.value === status) || CHALLAN_STATUSES[0];
    return (
      <Badge variant="outline" className={cn("font-medium", statusInfo.color)}>
        {statusInfo.label}
      </Badge>
    );
  };

  return (
    <div className="flex h-full">
      <div className={cn("flex-1 flex flex-col transition-all duration-300", selectedChallan ? "md:mr-[480px]" : "")}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 border-b bg-white gap-3">
          <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-4">
            <h2 className="text-base sm:text-lg font-semibold text-gray-800">Delivery Challans</h2>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs sm:text-sm">
                  <Filter className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  {statusFilter === "all" ? "All" : CHALLAN_STATUSES.find((s) => s.value === statusFilter)?.label}
                  <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 ml-1 sm:ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setStatusFilter("all")}>All Status</DropdownMenuItem>
                <DropdownMenuSeparator />
                {CHALLAN_STATUSES.map((status) => (
                  <DropdownMenuItem key={status.value} onClick={() => setStatusFilter(status.value)}>
                    {status.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              onClick={() => {
                setEditingChallan(null);
                setIsCreateModalOpen(true);
              }}
              size="sm"
              className="bg-primary hover:bg-primary/90 h-8 sm:hidden ml-auto"
            >
              <Plus className="h-4 w-4 mr-1" />
              New
            </Button>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-full sm:w-48 lg:w-64 h-9"
              />
            </div>
            <Button
              onClick={() => {
                setEditingChallan(null);
                setIsCreateModalOpen(true);
              }}
              className="bg-primary hover:bg-primary/90 hidden sm:flex"
            >
              <Plus className="h-4 w-4 mr-2" />
              New
            </Button>
          </div>
        </div>

        <div className={cn(
          "flex-1 overflow-auto bg-gray-50",
          selectedChallanId && "hidden md:block"
        )}>
          {/* Mobile Card View */}
          <div className="md:hidden divide-y">
            {filteredChallans.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Truck className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No delivery challans found</p>
              </div>
            ) : (
              filteredChallans.map((challan) => (
                <div
                  key={challan.id}
                  onClick={() => setSelectedChallanId(challan.id)}
                  className={cn(
                    "p-4 cursor-pointer transition-colors active:bg-blue-50/50",
                    selectedChallanId === challan.id && "bg-blue-50"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-primary font-semibold text-sm">{challan.challanNumber}</span>
                        {getStatusBadge(challan.status)}
                      </div>
                      <p className="text-sm font-medium text-gray-900 truncate">{challan.deliverTo || "—"}</p>
                      <p className="text-xs text-gray-500">{format(new Date(challan.challanDate), "dd MMM yyyy")}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold">₹{parseFloat(challan.totalAmount).toLocaleString("en-IN")}</p>
                      {challan.vehicleNumber && (
                        <p className="text-xs text-gray-500">{challan.vehicleNumber}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table View */}
          <table className="w-full hidden md:table">
            <thead className="bg-gray-100 sticky top-0">
              <tr className="text-left text-sm text-gray-600">
                <th className="p-3 w-10">
                  <Checkbox />
                </th>
                <th className="p-3 font-medium">DATE</th>
                <th className="p-3 font-medium">CHALLAN#</th>
                <th className="p-3 font-medium hidden lg:table-cell">DELIVER TO</th>
                <th className="p-3 font-medium hidden lg:table-cell">VEHICLE</th>
                <th className="p-3 font-medium">STATUS</th>
                <th className="p-3 font-medium text-right">AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {filteredChallans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    <Truck className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>No delivery challans found</p>
                  </td>
                </tr>
              ) : (
                filteredChallans.map((challan) => (
                  <tr
                    key={challan.id}
                    onClick={() => setSelectedChallanId(challan.id)}
                    className={cn(
                      "border-b border-gray-100 cursor-pointer hover:bg-blue-50/50 transition-colors",
                      selectedChallanId === challan.id && "bg-blue-50"
                    )}
                  >
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox />
                    </td>
                    <td className="p-3 text-sm text-gray-700">
                      {format(new Date(challan.challanDate), "dd MMM yyyy")}
                    </td>
                    <td className="p-3">
                      <span className="text-primary hover:underline font-medium">{challan.challanNumber}</span>
                    </td>
                    <td className="p-3 text-sm text-gray-700 max-w-[200px] truncate hidden lg:table-cell">
                      {challan.deliverTo || "—"}
                    </td>
                    <td className="p-3 text-sm text-gray-600 hidden lg:table-cell">
                      {challan.vehicleNumber || "—"}
                    </td>
                    <td className="p-3">{getStatusBadge(challan.status)}</td>
                    <td className="p-3 text-sm text-right font-medium">
                      ₹{parseFloat(challan.totalAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className={cn(
          "p-3 border-t bg-white text-sm text-gray-500",
          selectedChallanId && "hidden md:block"
        )}>
          Showing {filteredChallans.length} challan{filteredChallans.length !== 1 ? "s" : ""}
        </div>
      </div>

      {selectedChallan && (
        <ChallanDetailPanel
          challan={selectedChallan}
          onClose={() => setSelectedChallanId(null)}
          onDelete={() => deleteChallan.mutate(selectedChallan.id)}
          onUpdateStatus={(status) => updateStatus.mutate({ id: selectedChallan.id, status })}
          onEdit={() => {
            setEditingChallan(selectedChallan);
            setIsCreateModalOpen(true);
          }}
          onNew={() => {
            setEditingChallan(null);
            setIsCreateModalOpen(true);
          }}
        />
      )}

      <ChallanFormModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        editingChallan={editingChallan}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/delivery-challans"] });
          setIsCreateModalOpen(false);
          setEditingChallan(null);
        }}
      />
    </div>
  );
}

function ChallanDetailPanel({
  challan,
  onClose,
  onDelete,
  onUpdateStatus,
  onEdit,
  onNew,
}: {
  challan: DeliveryChallan;
  onClose: () => void;
  onDelete: () => void;
  onUpdateStatus: (status: string) => void;
  onEdit: () => void;
  onNew: () => void;
}) {
  const statusInfo = CHALLAN_STATUSES.find((s) => s.value === challan.status) || CHALLAN_STATUSES[0];

  return (
    <div className="fixed inset-0 md:right-0 md:left-auto md:top-0 h-full w-full md:w-[480px] bg-white md:border-l shadow-lg flex flex-col z-50">
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
              <Truck className="h-5 w-5 text-teal-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{challan.challanNumber}</h3>
              <p className="text-sm text-gray-500">{challan.challanType}</p>
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
            <DropdownMenuItem onClick={onDelete} className="text-red-600">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2 p-3 border-b bg-white flex-wrap">
        <Button onClick={onNew} size="sm" className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-1" />
          New
        </Button>
        <Button onClick={onEdit} variant="outline" size="sm">
          <Edit className="h-4 w-4 mr-1" />
          Edit
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              Mark as
              <ChevronDown className="h-4 w-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {CHALLAN_STATUSES.map((status) => (
              <DropdownMenuItem
                key={status.value}
                onClick={() => onUpdateStatus(status.value)}
                disabled={challan.status === status.value}
              >
                {status.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="outline" size="sm" onClick={() => window.open(`/print/delivery-challan/${challan.id}`, '_blank')}>
          <Download className="h-4 w-4 mr-1" />
          PDF
        </Button>
      </div>

      <div className="p-4 bg-teal-50 border-b border-teal-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-teal-600 uppercase font-medium">Total Amount</p>
            <p className="text-2xl font-bold text-teal-700">
              ₹{parseFloat(challan.totalAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <Badge variant="outline" className={cn("font-medium", statusInfo.color)}>
            {statusInfo.label}
          </Badge>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase mb-1">Challan Date</p>
              <p className="text-sm font-medium">{format(new Date(challan.challanDate), "dd MMM yyyy")}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase mb-1">Type</p>
              <p className="text-sm font-medium">{challan.challanType}</p>
            </div>
          </div>

          {challan.deliverTo && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 uppercase mb-2">Deliver To</p>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                <div>
                  <span className="text-sm font-medium block">{challan.deliverTo}</span>
                  {challan.deliveryAddress && (
                    <span className="text-sm text-gray-600">{challan.deliveryAddress}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {challan.vehicleNumber && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 uppercase mb-2">Vehicle</p>
              <div className="flex items-center gap-2">
                <Car className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium">{challan.vehicleNumber}</span>
              </div>
            </div>
          )}

          {challan.items && challan.items.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 uppercase mb-2">Items</p>
              <div className="border rounded-lg divide-y">
                {challan.items.map((item: any, index: number) => (
                  <div key={index} className="p-3 flex justify-between">
                    <div>
                      <p className="text-sm font-medium">{item.description}</p>
                      <p className="text-xs text-gray-500">
                        {item.quantity} {item.unit} × ₹{parseFloat(item.rate || 0).toLocaleString("en-IN")}
                      </p>
                    </div>
                    <p className="text-sm font-medium">
                      ₹{parseFloat(item.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span>₹{parseFloat(challan.subTotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">CGST ({challan.cgstRate}%)</span>
              <span>₹{parseFloat(challan.cgstAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">SGST ({challan.sgstRate}%)</span>
              <span>₹{parseFloat(challan.sgstAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-sm font-bold pt-2 border-t">
              <span>Total</span>
              <span>₹{parseFloat(challan.totalAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {challan.totalInWords && (
            <div>
              <p className="text-xs text-gray-500 uppercase mb-1">Amount in Words</p>
              <p className="text-sm text-gray-700">{challan.totalInWords}</p>
            </div>
          )}

          {challan.notes && (
            <div>
              <p className="text-xs text-gray-500 uppercase mb-1">Notes</p>
              <p className="text-sm text-gray-700">{challan.notes}</p>
            </div>
          )}

          <div>
            <p className="text-xs text-gray-500 uppercase mb-2">Created</p>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="h-4 w-4" />
              {challan.createdAt ? format(new Date(challan.createdAt), "dd MMM yyyy 'at' hh:mm a") : "—"}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

function ChallanFormModal({
  open,
  onOpenChange,
  editingChallan,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingChallan: DeliveryChallan | null;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    challanNumber: "",
    challanDate: format(new Date(), "yyyy-MM-dd"),
    challanType: "Supply",
    vehicleNumber: "",
    deliverTo: "",
    deliveryAddress: "",
    placeOfSupply: "Kerala",
    items: [{ description: "", quantity: "1", unit: "Nos", rate: "0", amount: "0" }],
    notes: "",
  });

  useEffect(() => {
    if (open) {
      if (editingChallan) {
        setFormData({
          challanNumber: editingChallan.challanNumber,
          challanDate: editingChallan.challanDate,
          challanType: editingChallan.challanType,
          vehicleNumber: editingChallan.vehicleNumber || "",
          deliverTo: editingChallan.deliverTo || "",
          deliveryAddress: editingChallan.deliveryAddress || "",
          placeOfSupply: editingChallan.placeOfSupply || "Kerala",
          items: editingChallan.items?.length > 0 ? editingChallan.items : [{ description: "", quantity: "1", unit: "Nos", rate: "0", amount: "0" }],
          notes: editingChallan.notes || "",
        });
      } else {
        apiRequest("GET", "/api/delivery-challans/next-number").then((res: any) => {
          setFormData(prev => ({
            ...prev,
            challanNumber: res.number || `DC-${Date.now()}`,
            challanDate: format(new Date(), "yyyy-MM-dd"),
            challanType: "Supply",
            vehicleNumber: "",
            deliverTo: "",
            deliveryAddress: "",
            placeOfSupply: "Kerala",
            items: [{ description: "", quantity: "1", unit: "Nos", rate: "0", amount: "0" }],
            notes: "",
          }));
        }).catch(() => {
          setFormData(prev => ({
            ...prev,
            challanNumber: `DC-${Date.now()}`,
          }));
        });
      }
    }
  }, [open, editingChallan]);

  const updateItem = (index: number, field: string, value: string) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === "quantity" || field === "rate") {
      const qty = parseFloat(newItems[index].quantity) || 0;
      const rate = parseFloat(newItems[index].rate) || 0;
      newItems[index].amount = (qty * rate).toFixed(2);
    }
    setFormData({ ...formData, items: newItems });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { description: "", quantity: "1", unit: "Nos", rate: "0", amount: "0" }],
    });
  };

  const removeItem = (index: number) => {
    if (formData.items.length > 1) {
      setFormData({
        ...formData,
        items: formData.items.filter((_, i) => i !== index),
      });
    }
  };

  const calculateTotals = () => {
    const subTotal = formData.items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const cgstRate = 9;
    const sgstRate = 9;
    const cgstAmount = subTotal * (cgstRate / 100);
    const sgstAmount = subTotal * (sgstRate / 100);
    const totalAmount = subTotal + cgstAmount + sgstAmount;
    return { subTotal, cgstRate, cgstAmount, sgstRate, sgstAmount, totalAmount };
  };

  const handleSubmit = async () => {
    if (!formData.challanNumber || !formData.challanDate) {
      toast({ title: "Error", description: "Please fill in required fields", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const totals = calculateTotals();
      const payload = {
        challanNumber: formData.challanNumber,
        challanDate: formData.challanDate,
        challanType: formData.challanType,
        vehicleNumber: formData.vehicleNumber || null,
        deliverTo: formData.deliverTo || null,
        deliveryAddress: formData.deliveryAddress || null,
        placeOfSupply: formData.placeOfSupply || null,
        items: formData.items,
        subTotal: totals.subTotal.toFixed(2),
        cgstRate: totals.cgstRate.toString(),
        cgstAmount: totals.cgstAmount.toFixed(2),
        sgstRate: totals.sgstRate.toString(),
        sgstAmount: totals.sgstAmount.toFixed(2),
        rounding: "0.00",
        totalAmount: totals.totalAmount.toFixed(2),
        notes: formData.notes || null,
        status: "draft",
      };

      if (editingChallan) {
        await apiRequest("PATCH", `/api/delivery-challans/${editingChallan.id}`, payload);
        toast({ title: "Success", description: "Delivery challan updated successfully" });
      } else {
        await apiRequest("POST", "/api/delivery-challans", payload);
        toast({ title: "Success", description: "Delivery challan created successfully" });
      }
      onSuccess();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to save challan", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const totals = calculateTotals();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingChallan ? "Edit Delivery Challan" : "New Delivery Challan"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label>Challan Number *</Label>
              <Input
                value={formData.challanNumber}
                onChange={(e) => setFormData({ ...formData, challanNumber: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Challan Date *</Label>
              <Input
                type="date"
                value={formData.challanDate}
                onChange={(e) => setFormData({ ...formData, challanDate: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Challan Type</Label>
              <Select value={formData.challanType} onValueChange={(value) => setFormData({ ...formData, challanType: value })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHALLAN_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Deliver To</Label>
              <Input
                value={formData.deliverTo}
                onChange={(e) => setFormData({ ...formData, deliverTo: e.target.value })}
                placeholder="Recipient name"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Vehicle Number</Label>
              <Input
                value={formData.vehicleNumber}
                onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value })}
                placeholder="e.g., KL 07 AB 1234"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label>Delivery Address</Label>
            <Textarea
              value={formData.deliveryAddress}
              onChange={(e) => setFormData({ ...formData, deliveryAddress: e.target.value })}
              placeholder="Full delivery address"
              className="mt-1"
              rows={2}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Items</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" /> Add Item
              </Button>
            </div>
            <div className="border rounded-lg divide-y">
              {formData.items.map((item, index) => (
                <div key={index} className="p-3 grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-12 sm:col-span-4">
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateItem(index, "description", e.target.value)}
                    />
                  </div>
                  <div className="col-span-3 sm:col-span-2">
                    <Input
                      type="number"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, "quantity", e.target.value)}
                    />
                  </div>
                  <div className="col-span-3 sm:col-span-2">
                    <Input
                      placeholder="Unit"
                      value={item.unit}
                      onChange={(e) => updateItem(index, "unit", e.target.value)}
                    />
                  </div>
                  <div className="col-span-3 sm:col-span-2">
                    <Input
                      type="number"
                      placeholder="Rate"
                      value={item.rate}
                      onChange={(e) => updateItem(index, "rate", e.target.value)}
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1 text-right text-sm font-medium">
                    ₹{parseFloat(item.amount || "0").toLocaleString("en-IN")}
                  </div>
                  <div className="col-span-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(index)}
                      disabled={formData.items.length === 1}
                    >
                      <X className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>₹{totals.subTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>CGST (9%)</span>
              <span>₹{totals.cgstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>SGST (9%)</span>
              <span>₹{totals.sgstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between font-bold pt-2 border-t">
              <span>Total</span>
              <span>₹{totals.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes"
              className="mt-1"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-primary hover:bg-primary/90">
            {isSubmitting ? "Saving..." : editingChallan ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
        />
      )}
    </div>
  );
}

function ChallanDetailPanel({
  challan,
  onClose,
  onDelete,
  onUpdateStatus,
}: {
  challan: DeliveryChallan;
  onClose: () => void;
  onDelete: () => void;
  onUpdateStatus: (status: string) => void;
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

      <div className="flex items-center gap-2 p-3 border-b bg-white">
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
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-1" />
          Download PDF
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

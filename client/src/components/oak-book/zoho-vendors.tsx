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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  X,
  MoreHorizontal,
  Building2,
  Mail,
  Phone,
  MapPin,
  Building,
  FileText,
  Clock,
  Tag
} from "lucide-react";

type Vendor = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  gstNumber: string | null;
  category: string | null;
  billingAddress: string | null;
  createdAt: string;
};

const VENDOR_CATEGORIES = [
  { value: "catering", label: "Catering" },
  { value: "decoration", label: "Decoration" },
  { value: "photography", label: "Photography" },
  { value: "venue", label: "Venue" },
  { value: "sound", label: "Sound & Lighting" },
  { value: "transport", label: "Transport" },
  { value: "other", label: "Other" },
];

export function ZohoVendors() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const filteredVendors = useMemo(() => {
    let filtered = vendors;
    
    if (categoryFilter !== "all") {
      filtered = filtered.filter((v) => v.category === categoryFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (v) =>
          v.name.toLowerCase().includes(query) ||
          v.email?.toLowerCase().includes(query) ||
          v.phone?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [vendors, searchQuery, categoryFilter]);

  const selectedVendor = useMemo(
    () => vendors.find((v) => v.id === selectedVendorId),
    [vendors, selectedVendorId]
  );

  const createVendor = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/vendors", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      setIsCreateModalOpen(false);
      setEditingVendor(null);
      toast({ title: "Vendor Created", description: "Vendor has been saved successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateVendor = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/vendors/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      setIsCreateModalOpen(false);
      setEditingVendor(null);
      toast({ title: "Vendor Updated", description: "Vendor has been updated successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteVendor = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/vendors/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      setSelectedVendorId(null);
      toast({ title: "Vendor Deleted", description: "Vendor has been deleted." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const getCategoryLabel = (category: string | null) => {
    return VENDOR_CATEGORIES.find((c) => c.value === category)?.label || category || "—";
  };

  const getCategoryBadge = (category: string | null) => {
    const colors: Record<string, string> = {
      catering: "bg-orange-50 text-orange-700 border-orange-200",
      decoration: "bg-pink-50 text-pink-700 border-pink-200",
      photography: "bg-purple-50 text-purple-700 border-purple-200",
      venue: "bg-blue-50 text-blue-700 border-blue-200",
      sound: "bg-yellow-50 text-yellow-700 border-yellow-200",
      transport: "bg-green-50 text-green-700 border-green-200",
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
      <div className={cn("flex-1 flex flex-col transition-all duration-300", selectedVendor ? "mr-[480px]" : "")}>
        <div className="flex items-center justify-between p-4 border-b bg-white">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-800">Vendors</h2>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                  <Tag className="h-4 w-4 mr-2" />
                  {categoryFilter === "all" ? "All Categories" : getCategoryLabel(categoryFilter)}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setCategoryFilter("all")}>All Categories</DropdownMenuItem>
                <DropdownMenuSeparator />
                {VENDOR_CATEGORIES.map((cat) => (
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
                placeholder="Search vendors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64 h-9"
              />
            </div>
            <Button
              onClick={() => {
                setEditingVendor(null);
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
                <th className="p-3 font-medium">NAME</th>
                <th className="p-3 font-medium hidden md:table-cell">EMAIL</th>
                <th className="p-3 font-medium hidden lg:table-cell">PHONE</th>
                <th className="p-3 font-medium">CATEGORY</th>
              </tr>
            </thead>
            <tbody>
              {filteredVendors.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    <Building2 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>No vendors found</p>
                  </td>
                </tr>
              ) : (
                filteredVendors.map((vendor) => (
                  <tr
                    key={vendor.id}
                    onClick={() => setSelectedVendorId(vendor.id)}
                    className={cn(
                      "border-b border-gray-100 cursor-pointer hover:bg-blue-50/50 transition-colors",
                      selectedVendorId === vendor.id && "bg-blue-50"
                    )}
                  >
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox />
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center">
                          <Building2 className="h-4 w-4 text-purple-600" />
                        </div>
                        <div>
                          <span className="text-blue-600 hover:underline font-medium">{vendor.name}</span>
                          {vendor.gstNumber && (
                            <p className="text-xs text-gray-500">GST: {vendor.gstNumber}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-sm text-gray-600 hidden md:table-cell">
                      {vendor.email || "—"}
                    </td>
                    <td className="p-3 text-sm text-gray-600 hidden lg:table-cell">
                      {vendor.phone || "—"}
                    </td>
                    <td className="p-3">
                      {getCategoryBadge(vendor.category)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3 border-t bg-white text-sm text-gray-500">
          Showing {filteredVendors.length} vendor{filteredVendors.length !== 1 ? "s" : ""}
        </div>
      </div>

      {selectedVendor && (
        <VendorDetailPanel
          vendor={selectedVendor}
          onClose={() => setSelectedVendorId(null)}
          onEdit={() => {
            setEditingVendor(selectedVendor);
            setIsCreateModalOpen(true);
          }}
          onDelete={() => deleteVendor.mutate(selectedVendor.id)}
          getCategoryLabel={getCategoryLabel}
        />
      )}

      <VendorFormModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingVendor(null);
        }}
        editingVendor={editingVendor}
        onSubmit={(data) => {
          if (editingVendor) {
            updateVendor.mutate({ id: editingVendor.id, data });
          } else {
            createVendor.mutate(data);
          }
        }}
        isSubmitting={createVendor.isPending || updateVendor.isPending}
      />
    </div>
  );
}

function VendorDetailPanel({
  vendor,
  onClose,
  onEdit,
  onDelete,
  getCategoryLabel,
}: {
  vendor: Vendor;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  getCategoryLabel: (cat: string | null) => string;
}) {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="fixed right-0 top-0 h-full w-[480px] bg-white border-l shadow-lg flex flex-col z-50">
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{vendor.name}</h3>
              <p className="text-sm text-gray-500">{getCategoryLabel(vendor.category)}</p>
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
          <FileText className="h-4 w-4 mr-1" />
          New Bill
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-2 justify-start bg-transparent border-b rounded-none h-auto p-0">
          <TabsTrigger
            value="overview"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-4 py-2"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="transactions"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-4 py-2"
          >
            Transactions
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          <TabsContent value="overview" className="p-4 m-0">
            <div className="space-y-6">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 uppercase mb-3">Contact Details</p>
                <div className="space-y-3">
                  {vendor.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">{vendor.email}</span>
                    </div>
                  )}
                  {vendor.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">{vendor.phone}</span>
                    </div>
                  )}
                  {vendor.billingAddress && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                      <span className="text-sm text-gray-600">{vendor.billingAddress}</span>
                    </div>
                  )}
                  {vendor.gstNumber && (
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">GST: {vendor.gstNumber}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase mb-2">Created</p>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="h-4 w-4" />
                  {vendor.createdAt ? format(new Date(vendor.createdAt), "dd MMM yyyy") : "—"}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="transactions" className="p-4 m-0">
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No transactions yet</p>
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

function VendorFormModal({
  isOpen,
  onClose,
  editingVendor,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  editingVendor: Vendor | null;
  onSubmit: (data: any) => void;
  isSubmitting: boolean;
}) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    gstNumber: "",
    category: "",
    billingAddress: "",
  });

  useEffect(() => {
    setFormData({
      name: editingVendor?.name || "",
      email: editingVendor?.email || "",
      phone: editingVendor?.phone || "",
      gstNumber: editingVendor?.gstNumber || "",
      category: editingVendor?.category || "",
      billingAddress: editingVendor?.billingAddress || "",
    });
  }, [editingVendor]);

  const handleSubmit = () => {
    onSubmit(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingVendor ? "Edit Vendor" : "New Vendor"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>Vendor Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter vendor name"
              className="mt-1"
            />
          </div>

          <div>
            <Label>Category</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData({ ...formData, category: value })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {VENDOR_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@example.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91 XXXXX XXXXX"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label>GST Number</Label>
            <Input
              value={formData.gstNumber}
              onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value })}
              placeholder="Enter GST number"
              className="mt-1"
            />
          </div>

          <div>
            <Label>Address</Label>
            <Textarea
              value={formData.billingAddress}
              onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
              placeholder="Enter address"
              className="mt-1"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.name}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {editingVendor ? "Update" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

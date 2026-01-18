import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
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
  Filter,
  Edit,
  Trash2,
  ChevronDown,
  X,
  MoreHorizontal,
  User,
  Mail,
  Phone,
  MapPin,
  Building,
  FileText,
  Receipt,
  Clock,
  CreditCard
} from "lucide-react";

type Customer = {
  id: string;
  customerCode: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  gstNumber: string | null;
  billingAddress: string | null;
  state: string | null;
  country: string | null;
  weddingPlannerId: string | null;
  createdAt: string;
};

type Invoice = {
  id: string;
  number: string;
  customerId: string | null;
  date: string;
  total: string;
  balanceDue: string;
  status: string;
};

type Estimate = {
  id: string;
  number: string;
  customerId: string | null;
  date: string;
  total: string;
  status: string;
};

export function ZohoCustomers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const { data: estimates = [] } = useQuery<Estimate[]>({
    queryKey: ["/api/estimates"],
  });

  const filteredCustomers = useMemo(() => {
    if (!searchQuery) return customers;
    const query = searchQuery.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.email?.toLowerCase().includes(query) ||
        c.phone?.toLowerCase().includes(query)
    );
  }, [customers, searchQuery]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId),
    [customers, selectedCustomerId]
  );

  const createCustomer = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/customers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setIsCreateModalOpen(false);
      setEditingCustomer(null);
      toast({ title: "Customer Created", description: "Customer has been saved successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateCustomer = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/customers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setIsCreateModalOpen(false);
      setEditingCustomer(null);
      toast({ title: "Customer Updated", description: "Customer has been updated successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteCustomer = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/customers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setSelectedCustomerId(null);
      toast({ title: "Customer Deleted", description: "Customer has been deleted." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const getCustomerStats = (customerId: string) => {
    const customerInvoices = invoices.filter((i) => i.customerId === customerId);
    const customerEstimates = estimates.filter((e) => e.customerId === customerId);
    const totalInvoiced = customerInvoices.reduce((sum, i) => sum + parseFloat(i.total || "0"), 0);
    const totalOutstanding = customerInvoices.reduce((sum, i) => sum + parseFloat(i.balanceDue || "0"), 0);
    return {
      invoiceCount: customerInvoices.length,
      estimateCount: customerEstimates.length,
      totalInvoiced,
      totalOutstanding,
    };
  };

  return (
    <div className="flex h-full">
      <div className={cn("flex-1 flex flex-col transition-all duration-300", selectedCustomer ? "md:mr-[480px]" : "")}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 border-b bg-white gap-3">
          <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-4">
            <h2 className="text-base sm:text-lg font-semibold text-gray-800">Customers</h2>
            <Badge variant="outline" className="bg-gray-100 hidden sm:inline-flex">
              {filteredCustomers.length} {filteredCustomers.length === 1 ? "customer" : "customers"}
            </Badge>
            <Button
              onClick={() => {
                setEditingCustomer(null);
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
                setEditingCustomer(null);
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
          selectedCustomerId && "hidden md:block"
        )}>
          <div className="md:hidden divide-y">
            {filteredCustomers.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <User className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No customers found</p>
              </div>
            ) : (
              filteredCustomers.map((customer) => {
                const stats = getCustomerStats(customer.id);
                return (
                  <div
                    key={customer.id}
                    onClick={() => setSelectedCustomerId(customer.id)}
                    className={cn(
                      "p-4 cursor-pointer transition-colors active:bg-blue-50/50",
                      selectedCustomerId === customer.id && "bg-blue-50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-primary truncate">{customer.name}</p>
                          {customer.email && <p className="text-xs text-gray-500 truncate">{customer.email}</p>}
                          {customer.phone && <p className="text-xs text-gray-500">{customer.phone}</p>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={cn("text-sm font-bold", stats.totalOutstanding > 0 ? "text-red-600" : "text-gray-500")}>
                          ₹{stats.totalOutstanding.toLocaleString("en-IN")}
                        </p>
                        <p className="text-xs text-gray-400">outstanding</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <table className="w-full hidden md:table">
            <thead className="bg-gray-100 sticky top-0">
              <tr className="text-left text-sm text-gray-600">
                <th className="p-3 w-10">
                  <Checkbox />
                </th>
                <th className="p-3 font-medium">NAME</th>
                <th className="p-3 font-medium hidden md:table-cell">EMAIL</th>
                <th className="p-3 font-medium hidden lg:table-cell">PHONE</th>
                <th className="p-3 font-medium text-right">OUTSTANDING</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    <User className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>No customers found</p>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => {
                  const stats = getCustomerStats(customer.id);
                  return (
                    <tr
                      key={customer.id}
                      onClick={() => setSelectedCustomerId(customer.id)}
                      className={cn(
                        "border-b border-gray-100 cursor-pointer hover:bg-blue-50/50 transition-colors",
                        selectedCustomerId === customer.id && "bg-blue-50"
                      )}
                    >
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <span className="text-primary hover:underline font-medium">{customer.name}</span>
                            {customer.gstNumber && (
                              <p className="text-xs text-gray-500">GST: {customer.gstNumber}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-sm text-gray-600 hidden md:table-cell">
                        {customer.email || "—"}
                      </td>
                      <td className="p-3 text-sm text-gray-600 hidden lg:table-cell">
                        {customer.phone || "—"}
                      </td>
                      <td className="p-3 text-sm text-right font-medium">
                        <span className={stats.totalOutstanding > 0 ? "text-red-600" : "text-gray-500"}>
                          ₹{stats.totalOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className={cn(
          "p-3 border-t bg-white text-sm text-gray-500",
          selectedCustomerId && "hidden md:block"
        )}>
          Showing {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? "s" : ""}
        </div>
      </div>

      {selectedCustomer && (
        <CustomerDetailPanel
          customer={selectedCustomer}
          invoices={invoices.filter((i) => i.customerId === selectedCustomer.id)}
          estimates={estimates.filter((e) => e.customerId === selectedCustomer.id)}
          onClose={() => setSelectedCustomerId(null)}
          onEdit={() => {
            setEditingCustomer(selectedCustomer);
            setIsCreateModalOpen(true);
          }}
          onDelete={() => deleteCustomer.mutate(selectedCustomer.id)}
        />
      )}

      <CustomerFormModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingCustomer(null);
        }}
        editingCustomer={editingCustomer}
        onSubmit={(data) => {
          if (editingCustomer) {
            updateCustomer.mutate({ id: editingCustomer.id, data });
          } else {
            createCustomer.mutate(data);
          }
        }}
        isSubmitting={createCustomer.isPending || updateCustomer.isPending}
      />

    </div>
  );
}

function CustomerDetailPanel({
  customer,
  invoices,
  estimates,
  onClose,
  onEdit,
  onDelete,
}: {
  customer: Customer;
  invoices: Invoice[];
  estimates: Estimate[];
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [activeTab, setActiveTab] = useState("overview");

  const totalInvoiced = invoices.reduce((sum, i) => sum + parseFloat(i.total || "0"), 0);
  const totalOutstanding = invoices.reduce((sum, i) => sum + parseFloat(i.balanceDue || "0"), 0);

  return (
    <div className="fixed inset-0 md:right-0 md:left-auto md:top-0 h-full w-full md:w-[480px] bg-white md:border-l shadow-lg flex flex-col z-50">
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{customer.name}</h3>
              <p className="text-sm text-gray-500">{customer.email || "No email"}</p>
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
          New Quote
        </Button>
        <Button variant="outline" size="sm">
          <Receipt className="h-4 w-4 mr-1" />
          New Invoice
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 border-b">
        <div className="p-3 bg-white rounded-lg border">
          <p className="text-xs text-gray-500 uppercase">Total Invoiced</p>
          <p className="text-lg font-bold text-gray-900">
            ₹{totalInvoiced.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="p-3 bg-white rounded-lg border">
          <p className="text-xs text-gray-500 uppercase">Outstanding</p>
          <p className={cn("text-lg font-bold", totalOutstanding > 0 ? "text-red-600" : "text-green-600")}>
            ₹{totalOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </p>
        </div>
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
                  {customer.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">{customer.email}</span>
                    </div>
                  )}
                  {customer.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">{customer.phone}</span>
                    </div>
                  )}
                  {customer.billingAddress && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                      <span className="text-sm text-gray-600">{customer.billingAddress}</span>
                    </div>
                  )}
                  {customer.gstNumber && (
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">GST: {customer.gstNumber}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase mb-2">Activity Summary</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 border rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="h-4 w-4 text-primary/80" />
                      <span className="text-sm font-medium">Quotes</span>
                    </div>
                    <p className="text-2xl font-bold">{estimates.length}</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Receipt className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium">Invoices</span>
                    </div>
                    <p className="text-2xl font-bold">{invoices.length}</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase mb-2">Created</p>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="h-4 w-4" />
                  {customer.createdAt ? format(new Date(customer.createdAt), "dd MMM yyyy") : "—"}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="transactions" className="p-4 m-0">
            <div className="space-y-4">
              {invoices.length === 0 && estimates.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CreditCard className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No transactions yet</p>
                </div>
              ) : (
                <>
                  {invoices.map((invoice) => (
                    <div key={invoice.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                          <Receipt className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{invoice.number}</p>
                          <p className="text-xs text-gray-500">{format(new Date(invoice.date), "dd MMM yyyy")}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">₹{parseFloat(invoice.total).toLocaleString("en-IN")}</p>
                        <Badge variant="outline" className={cn(
                          "text-xs",
                          invoice.status === "paid" && "bg-green-50 text-green-700",
                          invoice.status === "sent" && "bg-blue-50 text-primary",
                          invoice.status === "draft" && "bg-gray-100 text-gray-700"
                        )}>
                          {invoice.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {estimates.map((estimate) => (
                    <div key={estimate.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{estimate.number}</p>
                          <p className="text-xs text-gray-500">{format(new Date(estimate.date), "dd MMM yyyy")}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">₹{parseFloat(estimate.total).toLocaleString("en-IN")}</p>
                        <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">
                          Quote
                        </Badge>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

function CustomerFormModal({
  isOpen,
  onClose,
  editingCustomer,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  editingCustomer: Customer | null;
  onSubmit: (data: any) => void;
  isSubmitting: boolean;
}) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    gstNumber: "",
    billingAddress: "",
  });

  useEffect(() => {
    setFormData({
      name: editingCustomer?.name || "",
      email: editingCustomer?.email || "",
      phone: editingCustomer?.phone || "",
      gstNumber: editingCustomer?.gstNumber || "",
      billingAddress: editingCustomer?.billingAddress || "",
    });
  }, [editingCustomer]);

  const handleSubmit = () => {
    onSubmit(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingCustomer ? "Edit Customer" : "New Customer"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>Customer Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter customer name"
              className="mt-1"
            />
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
            <Label>Billing Address</Label>
            <Textarea
              value={formData.billingAddress}
              onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
              placeholder="Enter billing address"
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
            className="bg-primary hover:bg-primary/90"
          >
            {editingCustomer ? "Update" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

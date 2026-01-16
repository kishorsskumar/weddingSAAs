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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  Download,
  ChevronDown,
  ChevronRight,
  X,
  Send,
  Printer,
  MoreHorizontal,
  FileText,
  Share2,
  Mail,
  Check,
  ChevronsUpDown,
  Calendar,
  Clock,
  User,
  Building,
  Phone,
  MapPin,
  DollarSign,
  CreditCard
} from "lucide-react";

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  billingAddress: string | null;
};

type Invoice = {
  id: string;
  number: string;
  customerId: string | null;
  eventId: string | null;
  estimateId: string | null;
  date: string;
  dueDate: string | null;
  status: string;
  subject: string | null;
  lineItems: any[];
  subtotal: string;
  discountPercent: string;
  discountAmount: string;
  total: string;
  balanceDue: string;
  notes: string | null;
  terms: string | null;
  isTaxDocument: boolean;
  createdAt: string;
};

type Event = {
  id: string;
  title: string;
  customer: string | null;
};

interface ZohoInvoicesProps {
  filterType?: "standard" | "tax";
  onDownloadPdf?: (type: "invoice" | "quote" | "receipt" | "delivery-challan", id: string, hideHeader?: boolean) => void;
}

export function ZohoInvoices({ filterType = "standard", onDownloadPdf }: ZohoInvoicesProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [isNewCustomerDialogOpen, setIsNewCustomerDialogOpen] = useState(false);

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const { data: nextNumber } = useQuery<{ number: string }>({
    queryKey: ["/api/invoices/next-number"],
  });

  const filteredInvoices = useMemo(() => {
    let filtered = filterType === "tax"
      ? invoices.filter((i) => i.isTaxDocument === true)
      : invoices.filter((i) => !i.isTaxDocument);

    if (statusFilter !== "all") {
      filtered = filtered.filter((i) => i.status === statusFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.number.toLowerCase().includes(query) ||
          customers.find((c) => c.id === i.customerId)?.name.toLowerCase().includes(query)
      );
    }

    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [invoices, filterType, statusFilter, searchQuery, customers]);

  const selectedInvoice = useMemo(
    () => filteredInvoices.find((i) => i.id === selectedInvoiceId),
    [filteredInvoices, selectedInvoiceId]
  );

  const createInvoice = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/invoices", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices/next-number"] });
      setIsCreateModalOpen(false);
      setEditingInvoice(null);
      toast({ title: "Invoice Created", description: "Invoice has been saved successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateInvoice = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/invoices/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setIsCreateModalOpen(false);
      setEditingInvoice(null);
      toast({ title: "Invoice Updated", description: "Invoice has been updated successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteInvoice = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/invoices/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setSelectedInvoiceId(null);
      toast({ title: "Invoice Deleted", description: "Invoice has been deleted." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const markAsSent = useMutation({
    mutationFn: (id: string) =>
      apiRequest("PATCH", `/api/invoices/${id}`, { status: "sent" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice Sent", description: "Invoice has been marked as sent." });
    },
  });

  const recordPayment = useMutation({
    mutationFn: (id: string) =>
      apiRequest("PATCH", `/api/invoices/${id}`, { status: "paid", balanceDue: "0" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Payment Recorded", description: "Invoice has been marked as paid." });
    },
  });

  const createCustomer = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/customers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setIsNewCustomerDialogOpen(false);
      toast({ title: "Customer Created", description: "New customer has been added." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const getStatusBadge = (status: string) => {
    const statusStyles: Record<string, string> = {
      draft: "bg-gray-100 text-gray-700 border-gray-200",
      sent: "bg-blue-50 text-blue-700 border-blue-200",
      partial: "bg-yellow-50 text-yellow-700 border-yellow-200",
      paid: "bg-green-50 text-green-700 border-green-200",
      overdue: "bg-red-50 text-red-700 border-red-200",
    };
    return (
      <Badge variant="outline" className={cn("font-medium", statusStyles[status] || statusStyles.draft)}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getCustomerName = (customerId: string | null) => {
    if (!customerId) return "—";
    return customers.find((c) => c.id === customerId)?.name || "Unknown";
  };

  const getEventName = (eventId: string | null) => {
    if (!eventId) return "—";
    return events.find((e) => e.id === eventId)?.title || "Unknown";
  };

  return (
    <div className="flex h-full">
      <div className={cn("flex-1 flex flex-col transition-all duration-300", selectedInvoice ? "md:mr-[480px]" : "")}>
        {/* Mobile-optimized header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 border-b bg-white gap-3">
          <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-4">
            <h2 className="text-base sm:text-lg font-semibold text-gray-800">
              {filterType === "tax" ? "Tax Invoices" : "Invoices"}
            </h2>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs sm:text-sm">
                  <Filter className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  {statusFilter === "all" ? "All" : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
                  <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 ml-1 sm:ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setStatusFilter("all")}>All Invoices</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setStatusFilter("draft")}>Draft</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("sent")}>Sent</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("partial")}>Partially Paid</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("paid")}>Paid</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("overdue")}>Overdue</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* New button visible on mobile in top row */}
            <Button
              onClick={() => {
                setEditingInvoice(null);
                setIsCreateModalOpen(true);
              }}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 h-8 sm:hidden ml-auto"
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
            {/* Desktop New button */}
            <Button
              onClick={() => {
                setEditingInvoice(null);
                setIsCreateModalOpen(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 hidden sm:flex"
            >
              <Plus className="h-4 w-4 mr-2" />
              New
            </Button>
          </div>
        </div>

        <div className={cn(
          "flex-1 overflow-auto bg-gray-50",
          selectedInvoiceId && "hidden md:block"
        )}>
          {/* Mobile Card View */}
          <div className="md:hidden divide-y">
            {filteredInvoices.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No invoices found</p>
              </div>
            ) : (
              filteredInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  onClick={() => setSelectedInvoiceId(invoice.id)}
                  className={cn(
                    "p-4 cursor-pointer transition-colors active:bg-blue-50/50",
                    selectedInvoiceId === invoice.id && "bg-blue-50"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-blue-600 font-semibold text-sm">{invoice.number}</span>
                        {getStatusBadge(invoice.status)}
                      </div>
                      <p className="text-sm font-medium text-gray-900 truncate">{getCustomerName(invoice.customerId)}</p>
                      <p className="text-xs text-gray-500">{format(new Date(invoice.date), "dd MMM yyyy")}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold">₹{parseFloat(invoice.total).toLocaleString("en-IN")}</p>
                      {parseFloat(invoice.balanceDue) > 0 && (
                        <p className="text-xs text-red-600">Due: ₹{parseFloat(invoice.balanceDue).toLocaleString("en-IN")}</p>
                      )}
                      <ChevronRight className="h-4 w-4 text-gray-400 ml-auto mt-1" />
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
                <th className="p-3 font-medium">INVOICE NUMBER</th>
                <th className="p-3 font-medium hidden lg:table-cell">EVENT</th>
                <th className="p-3 font-medium">CUSTOMER NAME</th>
                <th className="p-3 font-medium text-right">AMOUNT</th>
                <th className="p-3 font-medium text-right">BALANCE DUE</th>
                <th className="p-3 font-medium">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>No invoices found</p>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    onClick={() => setSelectedInvoiceId(invoice.id)}
                    className={cn(
                      "border-b border-gray-100 cursor-pointer hover:bg-blue-50/50 transition-colors",
                      selectedInvoiceId === invoice.id && "bg-blue-50"
                    )}
                  >
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox />
                    </td>
                    <td className="p-3 text-sm text-gray-700">
                      {format(new Date(invoice.date), "dd MMM yyyy")}
                    </td>
                    <td className="p-3">
                      <span className="text-blue-600 hover:underline font-medium">{invoice.number}</span>
                    </td>
                    <td className="p-3 text-sm text-gray-600 hidden lg:table-cell">
                      {getEventName(invoice.eventId)}
                    </td>
                    <td className="p-3 text-sm text-gray-700">{getCustomerName(invoice.customerId)}</td>
                    <td className="p-3 text-sm text-gray-700 text-right font-medium">
                      ₹{parseFloat(invoice.total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-sm text-right font-medium">
                      <span className={parseFloat(invoice.balanceDue) > 0 ? "text-red-600" : "text-green-600"}>
                        ₹{parseFloat(invoice.balanceDue).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="p-3">{getStatusBadge(invoice.status)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className={cn(
          "p-3 border-t bg-white text-sm text-gray-500",
          selectedInvoiceId && "hidden md:block"
        )}>
          Showing {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? "s" : ""}
        </div>
      </div>

      {selectedInvoice && (
        <InvoiceDetailPanel
          invoice={selectedInvoice}
          customer={customers.find((c) => c.id === selectedInvoice.customerId)}
          event={events.find((e) => e.id === selectedInvoice.eventId)}
          onClose={() => setSelectedInvoiceId(null)}
          onEdit={() => {
            setEditingInvoice(selectedInvoice);
            setIsCreateModalOpen(true);
          }}
          onDelete={() => deleteInvoice.mutate(selectedInvoice.id)}
          onSend={() => markAsSent.mutate(selectedInvoice.id)}
          onRecordPayment={() => recordPayment.mutate(selectedInvoice.id)}
          onDownloadPdf={onDownloadPdf}
        />
      )}

      <InvoiceFormModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingInvoice(null);
        }}
        editingInvoice={editingInvoice}
        customers={customers}
        events={events}
        nextNumber={nextNumber?.number || "INV-001"}
        filterType={filterType}
        customerSearchOpen={customerSearchOpen}
        setCustomerSearchOpen={setCustomerSearchOpen}
        onOpenNewCustomer={() => setIsNewCustomerDialogOpen(true)}
        onSubmit={(data, isDraft) => {
          if (editingInvoice) {
            updateInvoice.mutate({ id: editingInvoice.id, data });
          } else {
            createInvoice.mutate({ ...data, status: isDraft ? "draft" : "sent" });
          }
        }}
        isSubmitting={createInvoice.isPending || updateInvoice.isPending}
      />

      <Dialog open={isNewCustomerDialogOpen} onOpenChange={setIsNewCustomerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Customer</DialogTitle>
          </DialogHeader>
          <NewCustomerForm
            onSubmit={(data) => createCustomer.mutate(data)}
            onCancel={() => setIsNewCustomerDialogOpen(false)}
            isSubmitting={createCustomer.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InvoiceDetailPanel({
  invoice,
  customer,
  event,
  onClose,
  onEdit,
  onDelete,
  onSend,
  onRecordPayment,
  onDownloadPdf,
}: {
  invoice: Invoice;
  customer?: Customer;
  event?: Event;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSend: () => void;
  onRecordPayment: () => void;
  onDownloadPdf?: (type: "invoice" | "quote" | "receipt" | "delivery-challan", id: string, hideHeader?: boolean) => void;
}) {
  const [activeTab, setActiveTab] = useState("details");

  return (
    <div className="fixed inset-0 md:right-0 md:left-auto md:top-0 h-full w-full md:w-[480px] bg-white md:border-l shadow-lg flex flex-col z-50 overflow-y-auto md:overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
          <div>
            <h3 className="font-semibold text-gray-900">{invoice.number}</h3>
            <p className="text-sm text-gray-500">{customer?.name || "No customer"}</p>
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
            <DropdownMenuItem onClick={() => onDownloadPdf?.("invoice", invoice.id, false)}>
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-red-600">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-wrap items-center gap-2 p-3 border-b bg-white">
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Edit className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">Edit</span>
        </Button>
        {invoice.status === "draft" && (
          <Button variant="outline" size="sm" onClick={onSend}>
            <Send className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Send</span>
          </Button>
        )}
        {(invoice.status === "sent" || invoice.status === "partial") && parseFloat(invoice.balanceDue) > 0 && (
          <Button variant="outline" size="sm" onClick={onRecordPayment} className="text-green-600 border-green-200 hover:bg-green-50">
            <CreditCard className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Pay</span>
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => onDownloadPdf?.("invoice", invoice.id, false)}>
          <Printer className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">PDF</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>
              <Share2 className="h-4 w-4 mr-2" />
              Share Link
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Mail className="h-4 w-4 mr-2" />
              Email Invoice
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {parseFloat(invoice.balanceDue) > 0 && invoice.status !== "draft" && (
        <div className="p-3 bg-yellow-50 border-b border-yellow-100">
          <div className="flex items-center gap-2 text-yellow-700">
            <DollarSign className="h-4 w-4" />
            <span className="text-sm font-medium">BALANCE DUE</span>
          </div>
          <p className="text-lg font-bold text-yellow-800 mt-1">
            ₹{parseFloat(invoice.balanceDue).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </p>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-2 justify-start bg-transparent border-b rounded-none h-auto p-0">
          <TabsTrigger
            value="details"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-4 py-2"
          >
            Invoice Details
          </TabsTrigger>
          <TabsTrigger
            value="activity"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-4 py-2"
          >
            Activity Logs
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          <TabsContent value="details" className="p-4 m-0">
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Invoice Date</p>
                  <p className="text-sm font-medium">{format(new Date(invoice.date), "dd MMM yyyy")}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Due Date</p>
                  <p className="text-sm font-medium">
                    {invoice.dueDate ? format(new Date(invoice.dueDate), "dd MMM yyyy") : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Status</p>
                  <div className="mt-1">
                    {invoice.status === "draft" && <Badge variant="outline" className="bg-gray-100">Draft</Badge>}
                    {invoice.status === "sent" && <Badge variant="outline" className="bg-blue-50 text-blue-700">Sent</Badge>}
                    {invoice.status === "partial" && <Badge variant="outline" className="bg-yellow-50 text-yellow-700">Partial</Badge>}
                    {invoice.status === "paid" && <Badge variant="outline" className="bg-green-50 text-green-700">Paid</Badge>}
                    {invoice.status === "overdue" && <Badge variant="outline" className="bg-red-50 text-red-700">Overdue</Badge>}
                  </div>
                </div>
                {event && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase mb-1">Event</p>
                    <p className="text-sm font-medium">{event.title}</p>
                  </div>
                )}
              </div>

              {customer && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 uppercase mb-2">Customer Details</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium">{customer.name}</span>
                    </div>
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
                  </div>
                </div>
              )}

              {invoice.lineItems && invoice.lineItems.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-2">Line Items</p>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="p-2 text-left font-medium text-gray-600">Item</th>
                          <th className="p-2 text-right font-medium text-gray-600">Qty</th>
                          <th className="p-2 text-right font-medium text-gray-600">Rate</th>
                          <th className="p-2 text-right font-medium text-gray-600">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoice.lineItems.map((item: any, idx: number) => (
                          <tr key={idx} className="border-t">
                            <td className="p-2">{item.description || item.name}</td>
                            <td className="p-2 text-right">{item.quantity}</td>
                            <td className="p-2 text-right">₹{parseFloat(item.rate || item.unitPrice || 0).toLocaleString("en-IN")}</td>
                            <td className="p-2 text-right">₹{parseFloat(item.amount || item.total || 0).toLocaleString("en-IN")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="space-y-2 pt-4 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span>₹{parseFloat(invoice.subtotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                {parseFloat(invoice.discountAmount) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Discount ({invoice.discountPercent}%)</span>
                    <span className="text-red-600">-₹{parseFloat(invoice.discountAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold pt-2 border-t">
                  <span>Total</span>
                  <span>₹{parseFloat(invoice.total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-gray-500">Balance Due</span>
                  <span className={parseFloat(invoice.balanceDue) > 0 ? "text-red-600" : "text-green-600"}>
                    ₹{parseFloat(invoice.balanceDue).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {invoice.notes && (
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Notes</p>
                  <p className="text-sm text-gray-700">{invoice.notes}</p>
                </div>
              )}

              {invoice.terms && (
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Terms & Conditions</p>
                  <p className="text-sm text-gray-700">{invoice.terms}</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="activity" className="p-4 m-0">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">Invoice Created</p>
                  <p className="text-xs text-gray-500">
                    {format(new Date(invoice.createdAt), "dd MMM yyyy 'at' hh:mm a")}
                  </p>
                </div>
              </div>
              {invoice.status === "sent" && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <Send className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Invoice Sent</p>
                    <p className="text-xs text-gray-500">Sent to customer</p>
                  </div>
                </div>
              )}
              {invoice.status === "paid" && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <Check className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Payment Received</p>
                    <p className="text-xs text-gray-500">Invoice marked as paid</p>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

// Indian states for GST Place of Supply
const INDIAN_STATES = [
  "Andaman and Nicobar Islands (35)", "Andhra Pradesh (37)", "Arunachal Pradesh (12)", 
  "Assam (18)", "Bihar (10)", "Chandigarh (04)", "Chhattisgarh (22)", "Dadra and Nagar Haveli (26)", 
  "Daman and Diu (25)", "Delhi (07)", "Goa (30)", "Gujarat (24)", "Haryana (06)", 
  "Himachal Pradesh (02)", "Jammu and Kashmir (01)", "Jharkhand (20)", "Karnataka (29)", 
  "Kerala (32)", "Ladakh (38)", "Lakshadweep (31)", "Madhya Pradesh (23)", "Maharashtra (27)", 
  "Manipur (14)", "Meghalaya (17)", "Mizoram (15)", "Nagaland (13)", "Odisha (21)", 
  "Puducherry (34)", "Punjab (03)", "Rajasthan (08)", "Sikkim (11)", "Tamil Nadu (33)", 
  "Telangana (36)", "Tripura (16)", "Uttar Pradesh (09)", "Uttarakhand (05)", "West Bengal (19)"
];

function InvoiceFormModal({
  isOpen,
  onClose,
  editingInvoice,
  customers,
  events,
  nextNumber,
  filterType,
  customerSearchOpen,
  setCustomerSearchOpen,
  onOpenNewCustomer,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  editingInvoice: Invoice | null;
  customers: Customer[];
  events: Event[];
  nextNumber: string;
  filterType: "standard" | "tax";
  customerSearchOpen: boolean;
  setCustomerSearchOpen: (open: boolean) => void;
  onOpenNewCustomer: () => void;
  onSubmit: (data: any, isDraft: boolean) => void;
  isSubmitting: boolean;
}) {
  const isTaxInvoice = filterType === "tax";
  
  const [formData, setFormData] = useState({
    number: editingInvoice?.number || nextNumber,
    customerId: editingInvoice?.customerId || "",
    eventId: editingInvoice?.eventId || "",
    date: editingInvoice?.date || format(new Date(), "yyyy-MM-dd"),
    dueDate: editingInvoice?.dueDate || "",
    subject: editingInvoice?.subject || "",
    notes: editingInvoice?.notes || "",
    terms: editingInvoice?.terms || "",
    placeOfSupply: (editingInvoice as any)?.placeOfSupply || "Kerala (32)",
  });

  // Initialize line items with tax fields for tax invoices
  const getDefaultLineItem = () => {
    if (isTaxInvoice) {
      return { type: "item", description: "", quantity: 1, rate: 0, amount: 0, hsnSac: "", cgstPercent: 9, sgstPercent: 9, cgstAmount: 0, sgstAmount: 0 };
    }
    return { type: "item", description: "", quantity: 1, rate: 0, amount: 0 };
  };

  const [lineItems, setLineItems] = useState<any[]>(
    editingInvoice?.lineItems?.length
      ? editingInvoice.lineItems.map((item: any) => ({
          ...item,
          description: item.name || item.description || "",
          amount: item.total || item.amount || 0,
          ...(isTaxInvoice ? { 
            hsnSac: item.hsnSac || "", 
            cgstPercent: item.cgstPercent ?? 9, 
            sgstPercent: item.sgstPercent ?? 9,
            cgstAmount: item.cgstAmount || 0,
            sgstAmount: item.sgstAmount || 0
          } : {})
        }))
      : [getDefaultLineItem()]
  );

  const [discount, setDiscount] = useState({
    percent: editingInvoice?.discountPercent || "0",
    amount: editingInvoice?.discountAmount || "0",
  });

  useEffect(() => {
    if (isOpen) {
      if (editingInvoice) {
        setFormData({
          number: editingInvoice.number,
          customerId: editingInvoice.customerId || "",
          eventId: editingInvoice.eventId || "",
          date: editingInvoice.date,
          dueDate: editingInvoice.dueDate || "",
          subject: editingInvoice.subject || "",
          notes: editingInvoice.notes || "",
          terms: editingInvoice.terms || "",
          placeOfSupply: (editingInvoice as any)?.placeOfSupply || "Kerala (32)",
        });
        setLineItems(editingInvoice.lineItems?.length 
          ? editingInvoice.lineItems.map((item: any) => ({
              ...item,
              description: item.name || item.description || "",
              amount: item.total || item.amount || 0,
              ...(isTaxInvoice ? { 
                hsnSac: item.hsnSac || "", 
                cgstPercent: item.cgstPercent ?? 9, 
                sgstPercent: item.sgstPercent ?? 9,
                cgstAmount: item.cgstAmount || 0,
                sgstAmount: item.sgstAmount || 0
              } : {})
            }))
          : [getDefaultLineItem()]);
        setDiscount({
          percent: editingInvoice.discountPercent || "0",
          amount: editingInvoice.discountAmount || "0",
        });
      } else {
        setFormData({
          number: nextNumber,
          customerId: "",
          eventId: "",
          date: format(new Date(), "yyyy-MM-dd"),
          dueDate: "",
          subject: "",
          notes: "",
          terms: "",
          placeOfSupply: "Kerala (32)",
        });
        setLineItems([getDefaultLineItem()]);
        setDiscount({ percent: "0", amount: "0" });
      }
    }
  }, [isOpen, editingInvoice, nextNumber, isTaxInvoice]);

  const calculateSubtotal = () => {
    return lineItems
      .filter((item) => item.type !== "section")
      .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  };

  const calculateTaxTotals = () => {
    if (!isTaxInvoice) return { cgstTotal: 0, sgstTotal: 0 };
    const items = lineItems.filter((item) => item.type !== "section");
    const cgstTotal = items.reduce((sum, item) => sum + (parseFloat(item.cgstAmount) || 0), 0);
    const sgstTotal = items.reduce((sum, item) => sum + (parseFloat(item.sgstAmount) || 0), 0);
    return { cgstTotal, sgstTotal };
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const discountAmt = parseFloat(discount.amount) || 0;
    const { cgstTotal, sgstTotal } = calculateTaxTotals();
    if (isTaxInvoice) {
      return Math.max(0, subtotal + cgstTotal + sgstTotal);
    }
    return Math.max(0, subtotal - discountAmt);
  };

  const handleLineItemChange = (index: number, field: string, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };

    if (field === "quantity" || field === "rate" || field === "cgstPercent" || field === "sgstPercent") {
      const qty = parseFloat(field === "quantity" ? value : updated[index].quantity) || 0;
      const rate = parseFloat(field === "rate" ? value : updated[index].rate) || 0;
      const baseAmount = qty * rate;
      updated[index].amount = baseAmount;
      
      if (isTaxInvoice) {
        const cgstPercent = parseFloat(field === "cgstPercent" ? value : updated[index].cgstPercent) || 0;
        const sgstPercent = parseFloat(field === "sgstPercent" ? value : updated[index].sgstPercent) || 0;
        updated[index].cgstAmount = baseAmount * (cgstPercent / 100);
        updated[index].sgstAmount = baseAmount * (sgstPercent / 100);
      }
    }

    setLineItems(updated);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, getDefaultLineItem()]);
  };

  const addSectionHeading = () => {
    setLineItems([...lineItems, { type: "section", heading: "" }]);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const handleDiscountPercentChange = (percentStr: string) => {
    const percent = parseFloat(percentStr) || 0;
    const subtotal = calculateSubtotal();
    const amount = (subtotal * percent) / 100;
    setDiscount({ percent: percentStr, amount: amount.toFixed(2) });
  };

  const handleSubmit = (isDraft: boolean) => {
    const subtotal = calculateSubtotal();
    const total = calculateTotal();
    const { cgstTotal, sgstTotal } = calculateTaxTotals();

    // Transform line items to match backend schema (name/total instead of description/amount)
    // Ensure all numeric values are properly parsed as numbers
    let slNo = 0;
    const transformedLineItems = lineItems.map((item: any) => {
      if (item.type === "section") {
        return {
          name: item.heading || "",
          quantity: 0,
          rate: 0,
          total: 0,
          isHeading: true,
        };
      }
      slNo++;
      const baseItem = {
        name: item.description || "",
        quantity: parseFloat(item.quantity) || 1,
        rate: parseFloat(item.rate) || 0,
        total: parseFloat(item.amount) || 0,
        isHeading: false,
        slNo,
      };
      
      if (isTaxInvoice) {
        return {
          ...baseItem,
          hsnSac: item.hsnSac || "",
          cgstPercent: parseFloat(item.cgstPercent) || 9,
          sgstPercent: parseFloat(item.sgstPercent) || 9,
          cgstAmount: parseFloat(item.cgstAmount) || 0,
          sgstAmount: parseFloat(item.sgstAmount) || 0,
        };
      }
      return baseItem;
    });

    onSubmit(
      {
        ...formData,
        // Convert empty strings to null for optional foreign key fields
        customerId: formData.customerId || null,
        eventId: formData.eventId || null,
        // Date is required, ensure it has a value
        date: formData.date || format(new Date(), "yyyy-MM-dd"),
        // Omit dueDate if empty (don't send null)
        ...(formData.dueDate ? { dueDate: formData.dueDate } : {}),
        lineItems: transformedLineItems,
        subtotal: subtotal.toFixed(2),
        discountPercent: isTaxInvoice ? "0" : discount.percent,
        discountAmount: isTaxInvoice ? "0" : discount.amount,
        cgstTotal: cgstTotal.toFixed(2),
        sgstTotal: sgstTotal.toFixed(2),
        taxTotal: (cgstTotal + sgstTotal).toFixed(2),
        total: total.toFixed(2),
        balanceDue: total.toFixed(2),
        isTaxDocument: isTaxInvoice,
        placeOfSupply: isTaxInvoice ? formData.placeOfSupply : null,
      },
      isDraft
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingInvoice ? "Edit Invoice" : "New Invoice"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Customer Name</Label>
              <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between mt-1"
                  >
                    {formData.customerId
                      ? customers.find((c) => c.id === formData.customerId)?.name
                      : "Select customer..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                  <Command>
                    <CommandInput placeholder="Search customer..." />
                    <CommandList>
                      <CommandEmpty>
                        <div className="p-2">
                          <p className="text-sm text-gray-500 mb-2">No customer found.</p>
                          <Button size="sm" variant="outline" onClick={onOpenNewCustomer}>
                            <Plus className="h-4 w-4 mr-1" />
                            New Customer
                          </Button>
                        </div>
                      </CommandEmpty>
                      <CommandGroup>
                        {customers.map((customer) => (
                          <CommandItem
                            key={customer.id}
                            onSelect={() => {
                              setFormData({ ...formData, customerId: customer.id });
                              setCustomerSearchOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.customerId === customer.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {customer.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label>Invoice#</Label>
              <Input
                value={formData.number}
                onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>

          {isTaxInvoice && (
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <p className="text-sm font-medium text-purple-800 mb-1">Tax Invoice (GST)</p>
              <p className="text-xs text-purple-600">This invoice will be issued under Yepman International</p>
            </div>
          )}

          <div className={`grid ${isTaxInvoice ? 'grid-cols-4' : 'grid-cols-3'} gap-4`}>
            <div>
              <Label>Invoice Date</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Due Date</Label>
              <Input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Event</Label>
              <Select
                value={formData.eventId}
                onValueChange={(value) => setFormData({ ...formData, eventId: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select event" />
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
            {isTaxInvoice && (
              <div>
                <Label>Place of Supply</Label>
                <Select
                  value={formData.placeOfSupply}
                  onValueChange={(value) => setFormData({ ...formData, placeOfSupply: value })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {INDIAN_STATES.map((state) => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div>
            <Label>Subject</Label>
            <Input
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="Let your customer know what this invoice is for"
              className="mt-1"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Item Table</Label>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={addSectionHeading}>
                  Add Section
                </Button>
                <Button variant="outline" size="sm" onClick={addLineItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add New Row
                </Button>
              </div>
            </div>
            <div className="border rounded-lg overflow-hidden overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 text-left text-sm font-medium text-gray-600" style={{width: isTaxInvoice ? '25%' : '40%'}}>Item Details</th>
                    {isTaxInvoice && <th className="p-2 text-left text-sm font-medium text-gray-600 w-24">HSN/SAC</th>}
                    <th className="p-2 text-right text-sm font-medium text-gray-600 w-16">Qty</th>
                    <th className="p-2 text-right text-sm font-medium text-gray-600 w-24">Rate</th>
                    <th className="p-2 text-right text-sm font-medium text-gray-600 w-24">Amount</th>
                    {isTaxInvoice && <th className="p-2 text-center text-sm font-medium text-gray-600 w-16">CGST%</th>}
                    {isTaxInvoice && <th className="p-2 text-center text-sm font-medium text-gray-600 w-16">SGST%</th>}
                    <th className="p-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item, index) => (
                    <tr key={index} className="border-t">
                      {item.type === "section" ? (
                        <>
                          <td colSpan={isTaxInvoice ? 7 : 4} className="p-2">
                            <Input
                              value={item.heading}
                              onChange={(e) => handleLineItemChange(index, "heading", e.target.value)}
                              placeholder="Section heading"
                              className="font-semibold bg-gray-50"
                            />
                          </td>
                          <td className="p-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeLineItem(index)}
                            >
                              <Trash2 className="h-4 w-4 text-gray-400" />
                            </Button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="p-2">
                            <Input
                              value={item.description}
                              onChange={(e) => handleLineItemChange(index, "description", e.target.value)}
                              placeholder="Type or click to select an item"
                            />
                          </td>
                          {isTaxInvoice && (
                            <td className="p-2">
                              <Input
                                value={item.hsnSac || ""}
                                onChange={(e) => handleLineItemChange(index, "hsnSac", e.target.value)}
                                placeholder="HSN/SAC"
                                className="text-sm"
                              />
                            </td>
                          )}
                          <td className="p-2">
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) =>
                                handleLineItemChange(index, "quantity", parseFloat(e.target.value) || 0)
                              }
                              className="text-right"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              value={item.rate}
                              onChange={(e) =>
                                handleLineItemChange(index, "rate", parseFloat(e.target.value) || 0)
                              }
                              className="text-right"
                            />
                          </td>
                          <td className="p-2 text-right font-medium">
                            ₹{(parseFloat(item.amount) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                          {isTaxInvoice && (
                            <td className="p-2">
                              <Input
                                type="number"
                                value={item.cgstPercent || 9}
                                onChange={(e) =>
                                  handleLineItemChange(index, "cgstPercent", parseFloat(e.target.value) || 0)
                                }
                                className="text-center w-14"
                              />
                            </td>
                          )}
                          {isTaxInvoice && (
                            <td className="p-2">
                              <Input
                                type="number"
                                value={item.sgstPercent || 9}
                                onChange={(e) =>
                                  handleLineItemChange(index, "sgstPercent", parseFloat(e.target.value) || 0)
                                }
                                className="text-center w-14"
                              />
                            </td>
                          )}
                          <td className="p-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeLineItem(index)}
                            >
                              <Trash2 className="h-4 w-4 text-gray-400" />
                            </Button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end">
            <div className="w-80 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Sub Total</span>
                <span className="font-medium">
                  ₹{calculateSubtotal().toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              {isTaxInvoice ? (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">CGST</span>
                    <span className="font-medium">
                      ₹{calculateTaxTotals().cgstTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">SGST</span>
                    <span className="font-medium">
                      ₹{calculateTaxTotals().sgstTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Discount</span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={discount.percent}
                      onChange={(e) => handleDiscountPercentChange(e.target.value)}
                      className="w-16 h-8 text-right text-sm"
                      placeholder="%"
                    />
                    <span className="text-sm">%</span>
                    <Input
                      type="number"
                      value={discount.amount}
                      onChange={(e) =>
                        setDiscount({ ...discount, amount: e.target.value, percent: "0" })
                      }
                      className="w-24 h-8 text-right text-sm"
                    />
                  </div>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t font-semibold">
                <span>Total (₹)</span>
                <span>₹{calculateTotal().toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Customer Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notes visible to customer"
                className="mt-1"
                rows={3}
              />
            </div>
            <div>
              <Label>Terms & Conditions</Label>
              <Textarea
                value={formData.terms}
                onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                placeholder="Payment terms, etc."
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={() => handleSubmit(true)}
            disabled={isSubmitting}
          >
            Save as Draft
          </Button>
          <Button
            onClick={() => handleSubmit(false)}
            disabled={isSubmitting}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Save and Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewCustomerForm({
  onSubmit,
  onCancel,
  isSubmitting,
}: {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    billingAddress: "",
  });

  return (
    <div className="space-y-4">
      <div>
        <Label>Customer Name *</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="mt-1"
        />
      </div>
      <div>
        <Label>Email</Label>
        <Input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="mt-1"
        />
      </div>
      <div>
        <Label>Phone</Label>
        <Input
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          className="mt-1"
        />
      </div>
      <div>
        <Label>Billing Address</Label>
        <Textarea
          value={formData.billingAddress}
          onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
          className="mt-1"
          rows={2}
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          onClick={() => onSubmit(formData)}
          disabled={isSubmitting || !formData.name}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Save
        </Button>
      </DialogFooter>
    </div>
  );
}

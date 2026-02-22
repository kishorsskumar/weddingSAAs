import { useState, useMemo, useEffect, useCallback, useRef } from "react";
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
  CreditCard,
  MessageSquare,
  Undo2,
  Redo2
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
  filterType?: "oakstreet" | "meta_events" | "yepman";
  onDownloadPdf?: (type: "invoice" | "quote" | "receipt" | "delivery-challan", id: string, hideHeader?: boolean) => void;
}

export function ZohoInvoices({ filterType = "oakstreet", onDownloadPdf }: ZohoInvoicesProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [weddingPlannerFilter, setWeddingPlannerFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [isNewCustomerDialogOpen, setIsNewCustomerDialogOpen] = useState(false);
  const [pendingWhatsAppCopy, setPendingWhatsAppCopy] = useState(false);

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
    queryKey: ["/api/invoices/next-number", filterType],
    queryFn: () => fetch(`/api/invoices/next-number?companyBrand=${filterType}`).then(res => res.json()),
  });

  // Get unique wedding planner names from invoices
  const weddingPlannerNames = useMemo(() => {
    const names = invoices
      .map((i) => (i as any).weddingPlannerName)
      .filter((name): name is string => !!name && name.trim() !== "");
    return Array.from(new Set(names)).sort();
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    let filtered = invoices;
    
    // Filter by company type
    if (filterType === "yepman") {
      // Yepman = Tax documents (GST)
      filtered = invoices.filter((i) => i.isTaxDocument === true);
    } else if (filterType === "meta_events") {
      // Meta Events = non-tax documents with companyBrand = meta_events
      filtered = invoices.filter((i) => !i.isTaxDocument && (i as any).companyBrand === "meta_events");
    } else {
      // Oakstreet = non-tax documents with companyBrand = oakstreet or undefined
      filtered = invoices.filter((i) => !i.isTaxDocument && ((i as any).companyBrand === "oakstreet" || !(i as any).companyBrand));
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((i) => i.status === statusFilter);
    }

    if (weddingPlannerFilter !== "all") {
      filtered = filtered.filter((i) => (i as any).weddingPlannerName === weddingPlannerFilter);
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
  }, [invoices, filterType, statusFilter, weddingPlannerFilter, searchQuery, customers]);

  const selectedInvoice = useMemo(
    () => filteredInvoices.find((i) => i.id === selectedInvoiceId),
    [filteredInvoices, selectedInvoiceId]
  );

  const createInvoice = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/invoices", data);
      return { invoice: await res.json() };
    },
    onSuccess: async ({ invoice }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices/next-number"] });
      setIsCreateModalOpen(false);
      setEditingInvoice(null);
      
      // Send WhatsApp copy to current user if requested
      if (pendingWhatsAppCopy && invoice?.id) {
        try {
          await apiRequest("POST", `/api/invoices/${invoice.id}/send-whatsapp-copy`);
          toast({ title: "WhatsApp Copy Sent", description: "A copy has been sent to your WhatsApp." });
        } catch (err: any) {
          toast({ title: "WhatsApp Failed", description: err.message || "Could not send WhatsApp copy.", variant: "destructive" });
        }
        setPendingWhatsAppCopy(false);
      }
      
      toast({ title: "Invoice Created", description: "Invoice has been saved successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateInvoice = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await apiRequest("PATCH", `/api/invoices/${id}`, data);
      return { id };
    },
    onSuccess: async ({ id }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setIsCreateModalOpen(false);
      setEditingInvoice(null);
      
      // Send WhatsApp copy to current user if requested
      if (pendingWhatsAppCopy && id) {
        try {
          await apiRequest("POST", `/api/invoices/${id}/send-whatsapp-copy`);
          toast({ title: "WhatsApp Copy Sent", description: "A copy has been sent to your WhatsApp." });
        } catch (err: any) {
          toast({ title: "WhatsApp Failed", description: err.message || "Could not send WhatsApp copy.", variant: "destructive" });
        }
        setPendingWhatsAppCopy(false);
      }
      
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
      sent: "bg-blue-50 text-primary border-blue-200",
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
    <div className="flex h-full overflow-hidden">
      <div
        className={cn(
          "overflow-auto transition-all duration-300 w-full flex flex-col",
          selectedInvoiceId && "hidden md:flex md:border-r md:w-[360px] md:flex-shrink-0"
        )}
      >
        {/* Full header when no preview panel */}
        {!selectedInvoiceId && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 border-b bg-white gap-3 flex-shrink-0">
            <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-4">
              <h2 className="text-base sm:text-lg font-semibold text-gray-800">
                {filterType === "yepman" ? "Yep Invoices" : filterType === "meta_events" ? "Meta Invoices" : "Oak Invoices"}
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

              {weddingPlannerNames.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs sm:text-sm">
                      <User className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                      {weddingPlannerFilter === "all" ? "All Planners" : weddingPlannerFilter}
                      <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 ml-1 sm:ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => setWeddingPlannerFilter("all")}>All Planners</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {weddingPlannerNames.map((name) => (
                      <DropdownMenuItem key={name} onClick={() => setWeddingPlannerFilter(name)}>
                        {name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <Button
                onClick={() => {
                  setEditingInvoice(null);
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
                  setEditingInvoice(null);
                  setIsCreateModalOpen(true);
                }}
                className="bg-primary hover:bg-primary/90 hidden sm:flex"
              >
                <Plus className="h-4 w-4 mr-2" />
                New
              </Button>
            </div>
          </div>
        )}

        {/* Compact header inside left list when panel is open */}
        {selectedInvoiceId && (
          <div className="hidden md:flex items-center justify-between p-2.5 border-b bg-card gap-2 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1 h-8 text-xs">
                    {statusFilter === "all" ? "All" : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setStatusFilter("all")}>All Invoices</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setStatusFilter("draft")}>Draft</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter("sent")}>Sent</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter("partial")}>Partially Paid</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter("paid")}>Paid</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter("overdue")}>Overdue</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {weddingPlannerNames.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1 h-8 text-xs">
                      <User className="h-3 w-3" />
                      {weddingPlannerFilter === "all" ? "All Planners" : weddingPlannerFilter}
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setWeddingPlannerFilter("all")}>All Planners</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {weddingPlannerNames.map((name) => (
                      <DropdownMenuItem key={name} onClick={() => setWeddingPlannerFilter(name)}>
                        {name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <div className="flex items-center gap-1 pr-1">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  className="pl-7 w-24 h-7 text-xs"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button
                onClick={() => {
                  setEditingInvoice(null);
                  setIsCreateModalOpen(true);
                }}
                size="icon"
                className="bg-primary hover:bg-primary/90 h-7 w-7 rounded-full flex-shrink-0"
                title="New Invoice"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

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
                        <span className="text-primary font-semibold text-sm">{invoice.number}</span>
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

          {/* Desktop Table View - full table when no panel, compact cards when panel open */}
          {selectedInvoiceId ? (
            <div className="hidden md:block divide-y">
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
                      "px-3 py-2.5 cursor-pointer hover:bg-blue-50/50 transition-colors",
                      selectedInvoiceId === invoice.id && "bg-blue-50 border-l-2 border-l-primary"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Checkbox className="h-3.5 w-3.5" onClick={(e) => e.stopPropagation()} />
                          <p className="text-sm font-medium text-gray-900 truncate">{getCustomerName(invoice.customerId)}</p>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 ml-5">
                          {invoice.number} • {format(new Date(invoice.date), "dd/MM/yyyy")}
                        </p>
                        <div className="mt-1 ml-5">{getStatusBadge(invoice.status)}</div>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                        ₹{parseFloat(invoice.total).toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
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
                        <span className="text-primary hover:underline font-medium">{invoice.number}</span>
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
          )}
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
        onSubmit={(data, isDraft, sendWhatsAppCopy) => {
          // Set the WhatsApp copy flag before mutation
          if (sendWhatsAppCopy) {
            setPendingWhatsAppCopy(true);
          }
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
  const [sendEmailDialogOpen, setSendEmailDialogOpen] = useState(false);
  const [sendWhatsAppDialogOpen, setSendWhatsAppDialogOpen] = useState(false);
  const [sendEmail, setSendEmail] = useState((invoice as any).customerEmail || "");
  const [sendPhone, setSendPhone] = useState((invoice as any).customerWhatsapp || "");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const handleSendEmail = async () => {
    if (!sendEmail) {
      toast({ title: "Error", description: "Please enter an email address", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: sendEmail }),
        credentials: "include"
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Success", description: "Invoice sent via email" });
        setSendEmailDialogOpen(false);
      } else {
        toast({ title: "Error", description: data.error || "Failed to send email", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to send email", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!sendPhone) {
      toast({ title: "Error", description: "Please enter a phone number", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/send-whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: sendPhone }),
        credentials: "include"
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Success", description: "Invoice sent via WhatsApp" });
        setSendWhatsAppDialogOpen(false);
      } else {
        toast({ title: "Error", description: data.error || "Failed to send WhatsApp", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to send WhatsApp", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const getInvoiceStatusStyle = (status: string) => {
    switch (status) {
      case "draft": return "bg-gray-100 text-gray-700";
      case "sent": return "bg-blue-100 text-blue-700";
      case "partial": return "bg-yellow-100 text-yellow-700";
      case "paid": return "bg-green-100 text-green-700";
      case "overdue": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="fixed inset-0 md:relative md:inset-auto flex flex-col bg-white md:border-l z-50 md:z-auto overflow-hidden flex-1 min-h-0">
      <div className="flex-shrink-0 bg-white">
        <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50/80">
          <div>
            <p className="text-[11px] text-gray-400 font-medium tracking-wide uppercase">Invoice</p>
            <h2 className="text-base font-bold text-gray-900 -mt-0.5">{invoice.number}</h2>
          </div>
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-gray-700" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 px-4 py-2.5 border-b bg-white">
          <Button variant="outline" size="sm" onClick={onEdit} className="h-8 rounded-md text-xs font-medium border-gray-300 text-gray-700 hover:bg-gray-50">
            <Edit className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Edit</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 rounded-md text-xs font-medium border-gray-300 text-gray-700 hover:bg-gray-50">
                <Send className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Send</span>
                <ChevronDown className="h-3 w-3 ml-1 text-gray-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem data-testid="btn-send-invoice-email" onClick={() => setSendEmailDialogOpen(true)}>
                <Mail className="h-4 w-4 mr-2" />
                Send via Email
              </DropdownMenuItem>
              <DropdownMenuItem data-testid="btn-send-invoice-whatsapp" onClick={() => setSendWhatsAppDialogOpen(true)}>
                <Phone className="h-4 w-4 mr-2" />
                Send via WhatsApp
              </DropdownMenuItem>
              {invoice.status === "draft" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem data-testid="btn-mark-invoice-sent" onClick={onSend}>
                    <Check className="h-4 w-4 mr-2" />
                    Mark as Sent
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          {(invoice.status === "sent" || invoice.status === "partial") && parseFloat(invoice.balanceDue) > 0 && (
            <Button data-testid="btn-record-payment" variant="outline" size="sm" onClick={onRecordPayment} className="h-8 rounded-md text-xs font-medium text-green-700 border-green-300 hover:bg-green-50">
              <CreditCard className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Record Payment</span>
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 rounded-md text-xs font-medium border-gray-300 text-gray-700 hover:bg-gray-50">
                <Printer className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">PDF</span>
                <ChevronDown className="h-3 w-3 ml-1 text-gray-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => onDownloadPdf?.("invoice", invoice.id, false)}>
                Download with Header
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDownloadPdf?.("invoice", invoice.id, true)}>
                Download without Header
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => window.open(`/print/invoice/${invoice.id}`, '_blank')}>
                Print
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Dialog open={sendEmailDialogOpen} onOpenChange={setSendEmailDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send Invoice via Email</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Recipient Email</Label>
                  <Input 
                    data-testid="input-invoice-email"
                    type="email" 
                    value={sendEmail} 
                    onChange={(e) => setSendEmail(e.target.value)}
                    placeholder="customer@example.com"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  An email with a link to view <strong>{invoice.number}</strong> will be sent.
                </p>
              </div>
              <DialogFooter>
                <Button data-testid="btn-cancel-invoice-email" variant="outline" onClick={() => setSendEmailDialogOpen(false)}>Cancel</Button>
                <Button data-testid="btn-submit-invoice-email" onClick={handleSendEmail} disabled={sending}>
                  {sending ? "Sending..." : "Send Email"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={sendWhatsAppDialogOpen} onOpenChange={setSendWhatsAppDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send Invoice via WhatsApp</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Phone Number (with country code)</Label>
                  <Input 
                    data-testid="input-invoice-phone"
                    type="tel" 
                    value={sendPhone} 
                    onChange={(e) => setSendPhone(e.target.value)}
                    placeholder="+919876543210"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  A WhatsApp message with a link to view <strong>{invoice.number}</strong> will be sent.
                </p>
              </div>
              <DialogFooter>
                <Button data-testid="btn-cancel-invoice-whatsapp" variant="outline" onClick={() => setSendWhatsAppDialogOpen(false)}>Cancel</Button>
                <Button data-testid="btn-submit-invoice-whatsapp" onClick={handleSendWhatsApp} disabled={sending}>
                  {sending ? "Sending..." : "Send WhatsApp"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Share2 className="h-4 w-4 mr-2" />
                Share Link
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {invoice.status === "draft" && (
          <div className="mx-4 mt-3 mb-2 p-3.5 rounded-lg bg-blue-50/80 border border-blue-100">
            <div className="flex items-start gap-2">
              <span className="text-blue-500 text-base mt-0.5">✦</span>
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-blue-800">WHAT'S NEXT?</p>
                <p className="text-xs text-blue-600 mt-0.5">Go ahead and email this invoice to your customer or simply mark it as sent.</p>
              </div>
            </div>
            <div className="flex gap-2 mt-2.5 ml-6">
              <Button size="sm" className="h-7 text-xs bg-[#4b7c29] hover:bg-[#3d6622] text-white rounded-md px-3" onClick={() => setSendEmailDialogOpen(true)}>
                Send Invoice
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs border-gray-300 text-gray-700 rounded-md px-3" onClick={onSend}>
                Mark As Sent
              </Button>
            </div>
          </div>
        )}

        {parseFloat(invoice.balanceDue) > 0 && invoice.status !== "draft" && (
          <div className="mx-4 mt-3 mb-2 p-3.5 rounded-lg bg-amber-50/80 border border-amber-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-amber-600" />
                <span className="text-[13px] font-semibold text-amber-800">BALANCE DUE</span>
              </div>
              <p className="text-lg font-bold text-amber-800">
                ₹{parseFloat(invoice.balanceDue).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between px-4 border-b">
          <div className="flex gap-0">
            <button
              onClick={() => setActiveTab("details")}
              className={cn(
                "px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors",
                activeTab === "details" ? "border-[#4b7c29] text-[#4b7c29]" : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              Invoice Details
            </button>
            <button
              onClick={() => setActiveTab("activity")}
              className={cn(
                "px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors",
                activeTab === "activity" ? "border-[#4b7c29] text-[#4b7c29]" : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              Activity Logs
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-white">
        {activeTab === "details" && (
          <div className="p-5 space-y-5">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-gray-900">{invoice.number}</h3>
                <span className={cn(
                  "text-[10px] font-semibold uppercase px-2 py-0.5 rounded",
                  getInvoiceStatusStyle(invoice.status)
                )}>
                  {invoice.status}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                Total : <span className="text-gray-800 font-medium">₹{parseFloat(invoice.total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm py-3 border-t border-b border-gray-100">
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Invoice Number</p>
                <p className="font-medium text-gray-900">{invoice.number}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Invoice Date</p>
                <p className="font-medium text-gray-900">{format(new Date(invoice.date), "dd/MM/yyyy")}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Due Date</p>
                <p className="font-medium text-gray-900">{invoice.dueDate ? format(new Date(invoice.dueDate), "dd/MM/yyyy") : "-"}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Balance Due</p>
                <p className={cn("font-medium", parseFloat(invoice.balanceDue) > 0 ? "text-red-600" : "text-green-600")}>
                  ₹{parseFloat(invoice.balanceDue).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </p>
              </div>
              {event && (
                <div className="col-span-2">
                  <p className="text-gray-400 text-xs mb-0.5">Event</p>
                  <p className="font-medium text-gray-900">{event.title}</p>
                </div>
              )}
            </div>

            <div>
              <h4 className="text-sm font-bold text-gray-900 mb-3">Customer Details</h4>
              {customer ? (
                <div className="space-y-2.5 text-sm">
                  <div className="flex items-center gap-2.5">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="font-medium text-gray-900">{customer.name}</span>
                  </div>
                  {customer.email && (
                    <div className="flex items-center gap-2.5">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600">{customer.email}</span>
                    </div>
                  )}
                  {customer.phone && (
                    <div className="flex items-center gap-2.5">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600">{customer.phone}</span>
                    </div>
                  )}
                  {customer.billingAddress && (
                    <div className="flex items-start gap-2.5">
                      <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                      <span className="text-gray-600">{customer.billingAddress}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-400 text-sm">No customer assigned</p>
              )}
            </div>

            {invoice.lineItems && invoice.lineItems.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-gray-900 mb-3">Line Items</h4>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-3 py-2 font-semibold text-gray-600 text-xs">Item</th>
                        <th className="text-right px-3 py-2 font-semibold text-gray-600 text-xs">Qty</th>
                        <th className="text-right px-3 py-2 font-semibold text-gray-600 text-xs">Rate</th>
                        <th className="text-right px-3 py-2 font-semibold text-gray-600 text-xs">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.lineItems.map((item: any, idx: number) => (
                        <tr key={idx} className={cn(
                          "border-t border-gray-100",
                          item.isHeading && "bg-gray-50/50"
                        )}>
                          <td className="px-3 py-2" colSpan={item.isHeading ? 4 : 1}>
                            {item.isHeading ? (
                              <span className="font-semibold text-[#4b7c29] text-xs uppercase tracking-wide">{item.name || item.description}</span>
                            ) : (
                              <span className="text-gray-800">{item.name || item.description}</span>
                            )}
                          </td>
                          {!item.isHeading && (
                            <>
                              <td className="px-3 py-2 text-right text-gray-600">{item.quantity}</td>
                              <td className="px-3 py-2 text-right text-gray-600">₹{parseFloat(item.rate || item.unitPrice || 0).toLocaleString("en-IN")}</td>
                              <td className="px-3 py-2 text-right font-medium text-gray-900">₹{parseFloat(item.amount || item.total || 0).toLocaleString("en-IN")}</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between py-1">
                <span className="text-gray-500">Sub Total</span>
                <span className="font-medium text-gray-900">₹{parseFloat(invoice.subtotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              {parseFloat(invoice.discountAmount) > 0 && (
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">Discount ({invoice.discountPercent}%)</span>
                  <span className="text-red-500">-₹{parseFloat(invoice.discountAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between py-2 border-t border-gray-200 mt-1">
                <span className="text-base font-bold text-gray-900">Total</span>
                <span className="text-base font-bold text-gray-900">₹{parseFloat(invoice.total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-500 font-medium">Balance Due</span>
                <span className={cn("font-bold", parseFloat(invoice.balanceDue) > 0 ? "text-red-600" : "text-green-600")}>
                  ₹{parseFloat(invoice.balanceDue).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {invoice.notes && (
              <div className="border-t border-gray-100 pt-4">
                <h4 className="text-sm font-bold text-gray-900 mb-2">Notes</h4>
                <p className="text-sm text-gray-600">{invoice.notes}</p>
              </div>
            )}

            {invoice.terms && (
              <div className="border-t border-gray-100 pt-4">
                <h4 className="text-sm font-bold text-gray-900 mb-2">Terms & Conditions</h4>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{invoice.terms}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "activity" && (
          <div className="p-5">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Invoice Created</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {format(new Date(invoice.createdAt), "dd MMM yyyy, hh:mm a")}
                  </p>
                </div>
              </div>
              {(invoice.status === "sent" || invoice.status === "partial" || invoice.status === "paid") && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-50 border border-green-200 flex items-center justify-center flex-shrink-0">
                    <Send className="h-3.5 w-3.5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Invoice Sent</p>
                    <p className="text-xs text-gray-400 mt-0.5">Sent to customer</p>
                  </div>
                </div>
              )}
              {(invoice.status === "partial" || invoice.status === "paid") && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-50 border border-green-200 flex items-center justify-center flex-shrink-0">
                    <CreditCard className="h-3.5 w-3.5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Payment Received</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {invoice.status === "paid" ? "Full payment received" : "Partial payment received"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
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
  filterType: "oakstreet" | "meta_events" | "yepman";
  customerSearchOpen: boolean;
  setCustomerSearchOpen: (open: boolean) => void;
  onOpenNewCustomer: () => void;
  onSubmit: (data: any, isDraft: boolean, sendWhatsAppCopy?: boolean) => void;
  isSubmitting: boolean;
}) {
  const [sendWhatsAppCopy, setSendWhatsAppCopy] = useState(false);
  const isTaxInvoice = filterType === "yepman";
  
  const [formData, setFormData] = useState({
    number: editingInvoice?.number || nextNumber,
    customerId: editingInvoice?.customerId || "",
    eventId: editingInvoice?.eventId || "",
    date: editingInvoice?.date || format(new Date(), "yyyy-MM-dd"),
    dueDate: editingInvoice?.dueDate || "",
    subject: editingInvoice?.subject || "",
    weddingPlannerName: (editingInvoice as any)?.weddingPlannerName || "",
    notes: editingInvoice?.notes || "",
    terms: editingInvoice?.terms || "",
    placeOfSupply: (editingInvoice as any)?.placeOfSupply || "Kerala (32)",
    companyBrand: editingInvoice ? (editingInvoice as any)?.companyBrand : filterType,
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

  const undoHistoryRef = useRef<any[]>([]);
  const undoPointerRef = useRef(0);
  const isUndoingRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const initRef = useRef(false);

  const updateUndoButtons = useCallback(() => {
    setCanUndo(undoPointerRef.current > 0);
    setCanRedo(undoPointerRef.current < undoHistoryRef.current.length - 1);
  }, []);

  const saveToUndoHistory = useCallback((snapshot: any) => {
    if (isUndoingRef.current) {
      isUndoingRef.current = false;
      return;
    }
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      const trimmed = undoHistoryRef.current.slice(0, undoPointerRef.current + 1);
      trimmed.push(snapshot);
      if (trimmed.length > 50) {
        trimmed.shift();
      }
      undoHistoryRef.current = trimmed;
      undoPointerRef.current = trimmed.length - 1;
      updateUndoButtons();
    }, 300);
  }, [updateUndoButtons]);

  const handleUndo = useCallback(() => {
    if (undoPointerRef.current > 0) {
      undoPointerRef.current -= 1;
      const prev = undoHistoryRef.current[undoPointerRef.current];
      if (prev) {
        isUndoingRef.current = true;
        setFormData(JSON.parse(JSON.stringify(prev.formData)));
        setLineItems(JSON.parse(JSON.stringify(prev.lineItems)));
        setDiscount(JSON.parse(JSON.stringify(prev.discount)));
        updateUndoButtons();
      }
    }
  }, [updateUndoButtons]);

  const handleRedo = useCallback(() => {
    if (undoPointerRef.current < undoHistoryRef.current.length - 1) {
      undoPointerRef.current += 1;
      const next = undoHistoryRef.current[undoPointerRef.current];
      if (next) {
        isUndoingRef.current = true;
        setFormData(JSON.parse(JSON.stringify(next.formData)));
        setLineItems(JSON.parse(JSON.stringify(next.lineItems)));
        setDiscount(JSON.parse(JSON.stringify(next.discount)));
        updateUndoButtons();
      }
    }
  }, [updateUndoButtons]);

  useEffect(() => {
    if (!isOpen) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleUndo, handleRedo]);

  useEffect(() => {
    if (isOpen) {
      let newFormData: any;
      let newLineItems: any[];
      let newDiscount: any;
      if (editingInvoice) {
        newFormData = {
          number: editingInvoice.number,
          customerId: editingInvoice.customerId || "",
          eventId: editingInvoice.eventId || "",
          date: editingInvoice.date,
          dueDate: editingInvoice.dueDate || "",
          subject: editingInvoice.subject || "",
          weddingPlannerName: (editingInvoice as any)?.weddingPlannerName || "",
          notes: editingInvoice.notes || "",
          terms: editingInvoice.terms || "",
          placeOfSupply: (editingInvoice as any)?.placeOfSupply || "Kerala (32)",
        };
        newLineItems = editingInvoice.lineItems?.length 
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
          : [getDefaultLineItem()];
        newDiscount = {
          percent: editingInvoice.discountPercent || "0",
          amount: editingInvoice.discountAmount || "0",
        };
      } else {
        newFormData = {
          number: nextNumber,
          customerId: "",
          eventId: "",
          date: format(new Date(), "yyyy-MM-dd"),
          dueDate: "",
          subject: "",
          weddingPlannerName: "",
          notes: "",
          terms: "",
          placeOfSupply: "Kerala (32)",
        };
        newLineItems = [getDefaultLineItem()];
        newDiscount = { percent: "0", amount: "0" };
      }
      setFormData(newFormData);
      setLineItems(newLineItems);
      setDiscount(newDiscount);
      undoHistoryRef.current = [JSON.parse(JSON.stringify({ formData: newFormData, lineItems: newLineItems, discount: newDiscount }))];
      undoPointerRef.current = 0;
      initRef.current = true;
      setCanUndo(false);
      setCanRedo(false);
    } else {
      initRef.current = false;
    }
  }, [isOpen, editingInvoice, nextNumber, isTaxInvoice]);

  useEffect(() => {
    if (isOpen && initRef.current) {
      saveToUndoHistory(JSON.parse(JSON.stringify({ formData, lineItems, discount })));
    }
  }, [formData]);

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
    saveToUndoHistory(JSON.parse(JSON.stringify({ formData, lineItems: updated, discount })));
  };

  const addLineItem = () => {
    const newItems = [...lineItems, getDefaultLineItem()];
    setLineItems(newItems);
    saveToUndoHistory(JSON.parse(JSON.stringify({ formData, lineItems: newItems, discount })));
  };

  const addSectionHeading = () => {
    const newItems = [...lineItems, { type: "section", heading: "" }];
    setLineItems(newItems);
    saveToUndoHistory(JSON.parse(JSON.stringify({ formData, lineItems: newItems, discount })));
  };

  const removeLineItem = (index: number) => {
    const newItems = lineItems.filter((_, i) => i !== index);
    setLineItems(newItems);
    saveToUndoHistory(JSON.parse(JSON.stringify({ formData, lineItems: newItems, discount })));
  };

  const handleDiscountPercentChange = (percentStr: string) => {
    const percent = parseFloat(percentStr) || 0;
    const subtotal = calculateSubtotal();
    const amount = (subtotal * percent) / 100;
    const newDiscount = { percent: percentStr, amount: amount.toFixed(2) };
    setDiscount(newDiscount);
    saveToUndoHistory(JSON.parse(JSON.stringify({ formData, lineItems, discount: newDiscount })));
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
      isDraft,
      sendWhatsAppCopy
    );
    // Reset the checkbox after save
    setSendWhatsAppCopy(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {editingInvoice ? "Edit Invoice" : "New Invoice"}
            <div className="flex items-center gap-1 ml-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleUndo}
                disabled={!canUndo}
                title="Undo (Ctrl+Z)"
                data-testid="button-undo-invoice"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleRedo}
                disabled={!canRedo}
                title="Redo (Ctrl+Shift+Z)"
                data-testid="button-redo-invoice"
              >
                <Redo2 className="h-4 w-4" />
              </Button>
            </div>
          </DialogTitle>
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
            {/* Company Brand Selector - Only for Standard (non-tax) invoices */}
            {!isTaxInvoice && (
              <div>
                <Label>Company</Label>
                <Select
                  value={formData.companyBrand}
                  onValueChange={(value) => setFormData({ ...formData, companyBrand: value })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="oakstreet">Default Company</SelectItem>
                    <SelectItem value="meta_events">Meta Events</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
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
            <Label>Wedding Planner</Label>
            <Input
              value={formData.weddingPlannerName || ""}
              onChange={(e) => setFormData({ ...formData, weddingPlannerName: e.target.value })}
              placeholder="Enter wedding planner name (optional)"
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
          <div className="flex items-center gap-2 mr-auto">
            <input
              type="checkbox"
              id="sendWhatsAppCopyInvoice"
              checked={sendWhatsAppCopy}
              onChange={(e) => setSendWhatsAppCopy(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <label htmlFor="sendWhatsAppCopyInvoice" className="text-sm text-muted-foreground cursor-pointer">
              Send me a WhatsApp copy
            </label>
          </div>
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
            className="bg-primary hover:bg-primary/90"
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
          className="bg-primary hover:bg-primary/90"
        >
          Save
        </Button>
      </DialogFooter>
    </div>
  );
}

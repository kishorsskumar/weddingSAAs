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
  ArrowRight,
  Mail,
  Check,
  ChevronsUpDown,
  Calendar,
  RefreshCw,
  Clock,
  User,
  Building,
  Phone,
  MapPin
} from "lucide-react";

// Indian states with GST codes for Place of Supply dropdown
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

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  billingAddress: string | null;
};

type Estimate = {
  id: string;
  number: string;
  customerId: string | null;
  eventId: string | null;
  date: string;
  dueDate: string | null;
  status: string;
  subject: string | null;
  lineItems: any[];
  subtotal: string;
  discountPercent: string;
  discountAmount: string;
  total: string;
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

interface ZohoQuotesProps {
  filterType?: "standard" | "tax";
  onDownloadPdf?: (type: "invoice" | "quote" | "receipt" | "delivery-challan", id: string, hideHeader?: boolean) => void;
}

export function ZohoQuotes({ filterType = "standard", onDownloadPdf }: ZohoQuotesProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Estimate | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [isNewCustomerDialogOpen, setIsNewCustomerDialogOpen] = useState(false);

  const { data: estimates = [] } = useQuery<Estimate[]>({
    queryKey: ["/api/estimates"],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const { data: nextNumber } = useQuery<{ number: string }>({
    queryKey: ["/api/estimates/next-number"],
  });

  const filteredQuotes = useMemo(() => {
    let filtered = filterType === "tax"
      ? estimates.filter((e) => e.isTaxDocument === true)
      : estimates.filter((e) => !e.isTaxDocument);

    if (statusFilter !== "all") {
      filtered = filtered.filter((e) => e.status === statusFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.number.toLowerCase().includes(query) ||
          customers.find((c) => c.id === e.customerId)?.name.toLowerCase().includes(query)
      );
    }

    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [estimates, filterType, statusFilter, searchQuery, customers]);

  const selectedQuote = useMemo(
    () => filteredQuotes.find((q) => q.id === selectedQuoteId),
    [filteredQuotes, selectedQuoteId]
  );

  const createEstimate = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/estimates", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/estimates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/estimates/next-number"] });
      setIsCreateModalOpen(false);
      setEditingQuote(null);
      toast({ title: "Quote Created", description: "Quote has been saved successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateEstimate = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/estimates/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/estimates"] });
      setIsCreateModalOpen(false);
      setEditingQuote(null);
      toast({ title: "Quote Updated", description: "Quote has been updated successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteEstimate = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/estimates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/estimates"] });
      setSelectedQuoteId(null);
      toast({ title: "Quote Deleted", description: "Quote has been deleted." });
    },
  });

  const createCustomer = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/customers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setIsNewCustomerDialogOpen(false);
      toast({ title: "Customer Created", description: "New customer added successfully." });
    },
  });

  const convertToInvoice = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/estimates/${id}/convert-to-invoice`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/estimates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setSelectedQuoteId(null);
      toast({ title: "Converted to Invoice", description: "Quote has been converted to an invoice successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to convert to invoice", variant: "destructive" });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft":
        return "bg-gray-100 text-gray-700";
      case "sent":
        return "bg-blue-100 text-blue-700";
      case "accepted":
        return "bg-green-100 text-green-700";
      case "declined":
        return "bg-red-100 text-red-700";
      case "converted":
        return "bg-purple-100 text-purple-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getCustomer = (customerId: string | null) =>
    customers.find((c) => c.id === customerId);

  const getEvent = (eventId: string | null) =>
    events.find((e) => e.id === eventId);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Mobile-optimized header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 border-b bg-card gap-3">
        <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 sm:gap-2 h-9 text-xs sm:text-sm">
                {statusFilter === "all" ? "All" : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
                <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setStatusFilter("all")}>All Quotes</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setStatusFilter("draft")}>Draft</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("sent")}>Sent</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("accepted")}>Accepted</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("declined")}>Declined</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("converted")}>Converted</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* New button visible on mobile in top row */}
          <Button
            onClick={() => {
              setEditingQuote(null);
              setIsCreateModalOpen(true);
            }}
            size="sm"
            className="bg-primary hover:bg-primary/90 h-9 sm:hidden"
          >
            <Plus className="h-4 w-4 mr-1" />
            New
          </Button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="pl-9 w-full sm:w-48 lg:w-64 h-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Desktop New button */}
          <Button
            onClick={() => {
              setEditingQuote(null);
              setIsCreateModalOpen(true);
            }}
            className="bg-primary hover:bg-primary/90 hidden sm:flex"
          >
            <Plus className="h-4 w-4 mr-2" />
            New
          </Button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <div
          className={cn(
            "overflow-auto transition-all duration-300 w-full",
            selectedQuoteId && "hidden md:block md:border-r md:w-[400px]"
          )}
        >
          {/* Mobile Card View */}
          <div className="md:hidden divide-y">
            {filteredQuotes.map((quote) => {
              const customer = getCustomer(quote.customerId);
              const isSelected = selectedQuoteId === quote.id;
              return (
                <div
                  key={quote.id}
                  className={cn(
                    "p-4 cursor-pointer transition-colors active:bg-muted/50",
                    isSelected && "bg-primary/10"
                  )}
                  onClick={() => setSelectedQuoteId(quote.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-primary font-semibold text-sm">{quote.number}</span>
                        <span className={cn("text-xs px-2 py-0.5 rounded font-medium", getStatusColor(quote.status))}>
                          {quote.status}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-foreground truncate">{customer?.name || "No customer"}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(quote.date), "dd MMM yyyy")}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold">₹{parseFloat(quote.total).toLocaleString("en-IN")}</p>
                      <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto mt-1" />
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredQuotes.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">No quotes found</div>
            )}
          </div>

          {/* Desktop Table View */}
          <table className="w-full hidden md:table">
            <thead className="sticky top-0 bg-card z-10 border-b">
              <tr className="text-left text-sm text-muted-foreground">
                <th className="p-3 w-10">
                  <Checkbox />
                </th>
                <th className="p-3 font-medium">DATE</th>
                <th className="p-3 font-medium">QUOTE NUMBER</th>
                <th className="p-3 font-medium hidden lg:table-cell">EVENT</th>
                <th className="p-3 font-medium">CUSTOMER NAME</th>
                <th className="p-3 font-medium text-right">AMOUNT</th>
                <th className="p-3 font-medium">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuotes.map((quote) => {
                const customer = getCustomer(quote.customerId);
                const event = getEvent(quote.eventId);
                const isSelected = selectedQuoteId === quote.id;
                return (
                  <tr
                    key={quote.id}
                    className={cn(
                      "border-b cursor-pointer transition-colors hover:bg-muted/50",
                      isSelected && "bg-primary/10"
                    )}
                    onClick={() => setSelectedQuoteId(isSelected ? null : quote.id)}
                  >
                    <td className="p-3">
                      <Checkbox onClick={(e) => e.stopPropagation()} />
                    </td>
                    <td className="p-3 text-sm">{format(new Date(quote.date), "dd/MM/yyyy")}</td>
                    <td className="p-3">
                      <span className="text-primary font-medium text-sm">{quote.number}</span>
                      {quote.status === "sent" && (
                        <Mail className="inline h-3 w-3 ml-1 text-muted-foreground" />
                      )}
                    </td>
                    <td className="p-3 text-sm text-muted-foreground hidden lg:table-cell">
                      {event ? event.title.substring(0, 20) + (event.title.length > 20 ? "..." : "") : "-"}
                    </td>
                    <td className="p-3 text-sm font-medium">{customer?.name || "-"}</td>
                    <td className="p-3 text-sm font-medium text-right">
                      ₹{parseFloat(quote.total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3">
                      <span
                        className={cn(
                          "text-xs px-2 py-1 rounded font-medium uppercase",
                          getStatusColor(quote.status)
                        )}
                      >
                        {quote.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filteredQuotes.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No quotes found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {selectedQuote && (
          <QuoteDetailPanel
            quote={selectedQuote}
            customer={getCustomer(selectedQuote.customerId)}
            event={getEvent(selectedQuote.eventId)}
            onClose={() => setSelectedQuoteId(null)}
            onEdit={() => {
              setEditingQuote(selectedQuote);
              setIsCreateModalOpen(true);
            }}
            onDelete={() => deleteEstimate.mutate(selectedQuote.id)}
            onDownloadPdf={onDownloadPdf}
            onConvert={() => convertToInvoice.mutate(selectedQuote.id)}
          />
        )}
      </div>

      <QuoteFormModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        editingQuote={editingQuote}
        customers={customers}
        events={events}
        nextNumber={nextNumber?.number || "QT-001"}
        isTaxDocument={filterType === "tax"}
        onSave={(data, asDraft) => {
          if (editingQuote) {
            updateEstimate.mutate({ id: editingQuote.id, data: { ...data, status: asDraft ? "draft" : "sent" } });
          } else {
            createEstimate.mutate({ ...data, status: asDraft ? "draft" : "sent" });
          }
        }}
        isPending={createEstimate.isPending || updateEstimate.isPending}
        onNewCustomer={() => setIsNewCustomerDialogOpen(true)}
      />

      <NewCustomerDialog
        open={isNewCustomerDialogOpen}
        onOpenChange={setIsNewCustomerDialogOpen}
        onSave={(data) => createCustomer.mutate(data)}
        isPending={createCustomer.isPending}
      />
    </div>
  );
}

interface QuoteDetailPanelProps {
  quote: Estimate;
  customer: Customer | undefined;
  event: Event | undefined;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDownloadPdf?: (type: "invoice" | "quote" | "receipt" | "delivery-challan", id: string, hideHeader?: boolean) => void;
  onConvert?: () => void;
}

function QuoteDetailPanel({
  quote,
  customer,
  event,
  onClose,
  onEdit,
  onDelete,
  onDownloadPdf,
  onConvert,
}: QuoteDetailPanelProps) {
  const [activeTab, setActiveTab] = useState("details");

  return (
    <div className="fixed inset-0 md:relative md:inset-auto flex-1 flex flex-col bg-card md:border-l overflow-hidden z-50 md:z-auto">
      <div className="flex items-center justify-between p-4 border-b bg-muted/30">
        <div>
          <p className="text-xs text-muted-foreground">Quote</p>
          <h2 className="text-lg font-semibold">{quote.number}</h2>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" title="Attachment">
            <FileText className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title="Comments">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 p-3 border-b bg-background">
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Edit className="h-4 w-4 mr-1" />
          Edit
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Send className="h-4 w-4 mr-1" />
              Send
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Send via Email</DropdownMenuItem>
            <DropdownMenuItem>Send via WhatsApp</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="outline" size="sm">
          <Share2 className="h-4 w-4 mr-1" />
          Share
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Printer className="h-4 w-4 mr-1" />
              PDF/Print
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => onDownloadPdf?.("quote", quote.id, false)}>
              Download with Header
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDownloadPdf?.("quote", quote.id, true)}>
              Download without Header
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Print</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              Convert
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => onConvert?.()}>
              Convert to Invoice
            </DropdownMenuItem>
            <DropdownMenuItem>Convert to Sales Order</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Clone</DropdownMenuItem>
            <DropdownMenuItem>Mark as Sent</DropdownMenuItem>
            <DropdownMenuItem>Mark as Accepted</DropdownMenuItem>
            <DropdownMenuItem>Mark as Declined</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={onDelete}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {quote.status === "sent" && (
        <div className="p-4 border-b bg-blue-50">
          <div className="flex items-center gap-2 text-blue-700">
            <RefreshCw className="h-4 w-4" />
            <span className="text-sm font-medium">WHAT'S NEXT?</span>
          </div>
          <p className="text-sm text-blue-600 mt-1">Convert this quote to an invoice or a sales order.</p>
          <div className="flex gap-2 mt-2">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => onConvert?.()}>
              Convert
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start px-4 bg-transparent border-b rounded-none h-auto">
          <TabsTrigger
            value="details"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
          >
            Quote Details
          </TabsTrigger>
          <TabsTrigger
            value="activity"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
          >
            Activity Logs
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          <TabsContent value="details" className="p-4 m-0 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">
                  {quote.number}{" "}
                  <span className={cn("text-xs px-2 py-1 rounded ml-2", getStatusColor(quote.status))}>
                    {quote.status}
                  </span>
                </h3>
                <p className="text-sm text-muted-foreground">
                  Total: ₹{parseFloat(quote.total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <span>Show PDF View</span>
                <input type="checkbox" className="toggle" />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Quote Number</p>
                <p className="font-medium">{quote.number}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Quote Date</p>
                <p className="font-medium">{format(new Date(quote.date), "dd/MM/yyyy")}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Subject</p>
                <p className="font-medium">{quote.subject || "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Event</p>
                <p className="font-medium">{event?.title || "-"}</p>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold mb-3">Customer Details</h4>
              {customer ? (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{customer.name}</span>
                  </div>
                  {customer.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{customer.email}</span>
                    </div>
                  )}
                  {customer.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{customer.phone}</span>
                    </div>
                  )}
                  {customer.billingAddress && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <span>{customer.billingAddress}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No customer assigned</p>
              )}
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold mb-3">Line Items</h4>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2 font-medium">Item</th>
                      <th className="text-right p-2 font-medium">Qty</th>
                      <th className="text-right p-2 font-medium">Rate</th>
                      <th className="text-right p-2 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quote.lineItems.map((item: any, index: number) => (
                      <tr key={index} className="border-t">
                        <td className="p-2">
                          {item.isHeading ? (
                            <span className="font-semibold text-primary">{item.description}</span>
                          ) : (
                            <span>{item.description || item.name}</span>
                          )}
                        </td>
                        <td className="p-2 text-right">{item.isHeading ? "" : item.quantity}</td>
                        <td className="p-2 text-right">{item.isHeading ? "" : `₹${parseFloat(item.rate || "0").toLocaleString()}`}</td>
                        <td className="p-2 text-right font-medium">
                          {item.isHeading ? "" : `₹${parseFloat(item.amount || "0").toLocaleString()}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Sub Total</span>
                  <span className="font-medium">₹{parseFloat(quote.subtotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                {parseFloat(quote.discountAmount) > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Discount ({quote.discountPercent}%)</span>
                    <span>-₹{parseFloat(quote.discountAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-semibold border-t pt-2">
                  <span>Total</span>
                  <span>₹{parseFloat(quote.total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {quote.notes && (
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-2">Notes</h4>
                <p className="text-sm text-muted-foreground">{quote.notes}</p>
              </div>
            )}

            {quote.terms && (
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-2">Terms & Conditions</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quote.terms}</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="activity" className="p-4 m-0">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">Quote Created</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(quote.createdAt), "dd MMM yyyy, hh:mm a")}
                  </p>
                </div>
              </div>
              {quote.status === "sent" && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <Send className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Quote Sent</p>
                    <p className="text-xs text-muted-foreground">Sent to customer</p>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );

  function getStatusColor(status: string) {
    switch (status) {
      case "draft":
        return "bg-gray-100 text-gray-700";
      case "sent":
        return "bg-blue-100 text-blue-700";
      case "accepted":
        return "bg-green-100 text-green-700";
      case "declined":
        return "bg-red-100 text-red-700";
      case "converted":
        return "bg-purple-100 text-purple-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  }
}

interface QuoteFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingQuote: Estimate | null;
  customers: Customer[];
  events: Event[];
  nextNumber: string;
  isTaxDocument: boolean;
  onSave: (data: any, asDraft: boolean) => void;
  isPending: boolean;
  onNewCustomer: () => void;
}

function QuoteFormModal({
  open,
  onOpenChange,
  editingQuote,
  customers,
  events,
  nextNumber,
  isTaxDocument,
  onSave,
  isPending,
  onNewCustomer,
}: QuoteFormModalProps) {
  const [formData, setFormData] = useState<any>({
    number: "",
    customerId: "",
    eventId: "",
    date: format(new Date(), "yyyy-MM-dd"),
    subject: "",
    lineItems: isTaxDocument 
      ? [{ description: "", quantity: 1, rate: 0, amount: 0, isHeading: false, hsnSac: "", cgstPercent: 9, sgstPercent: 9, cgstAmount: 0, sgstAmount: 0 }]
      : [{ description: "", quantity: 1, rate: 0, amount: 0, isHeading: false }],
    discountPercent: 0,
    notes: "",
    terms: "",
    placeOfSupply: "Kerala (32)",
  });
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [eventSearchOpen, setEventSearchOpen] = useState(false);

  useEffect(() => {
    if (open) {
      if (editingQuote) {
        // Transform line items from backend format (name/total) to form format (description/amount)
        const transformedLineItems = editingQuote.lineItems.length > 0 
          ? editingQuote.lineItems.map((item: any) => ({
              description: item.name || item.description || "",
              quantity: item.quantity || 1,
              rate: item.rate || 0,
              amount: item.total || item.amount || 0,
              isHeading: item.isHeading || false,
              ...(isTaxDocument ? {
                hsnSac: item.hsnSac || "",
                cgstPercent: item.cgstPercent ?? 9,
                sgstPercent: item.sgstPercent ?? 9,
                cgstAmount: item.cgstAmount || 0,
                sgstAmount: item.sgstAmount || 0,
              } : {}),
            }))
          : isTaxDocument 
            ? [{ description: "", quantity: 1, rate: 0, amount: 0, isHeading: false, hsnSac: "", cgstPercent: 9, sgstPercent: 9, cgstAmount: 0, sgstAmount: 0 }]
            : [{ description: "", quantity: 1, rate: 0, amount: 0, isHeading: false }];
        
        setFormData({
          number: editingQuote.number,
          customerId: editingQuote.customerId || "",
          eventId: editingQuote.eventId || "",
          date: editingQuote.date,
          subject: editingQuote.subject || "",
          lineItems: transformedLineItems,
          discountPercent: parseFloat(editingQuote.discountPercent) || 0,
          notes: editingQuote.notes || "",
          terms: editingQuote.terms || "",
          placeOfSupply: (editingQuote as any).placeOfSupply || "Kerala (32)",
        });
      } else {
        setFormData({
          number: nextNumber,
          customerId: "",
          eventId: "",
          date: format(new Date(), "yyyy-MM-dd"),
          subject: "",
          lineItems: isTaxDocument 
            ? [{ description: "", quantity: 1, rate: 0, amount: 0, isHeading: false, hsnSac: "", cgstPercent: 9, sgstPercent: 9, cgstAmount: 0, sgstAmount: 0 }]
            : [{ description: "", quantity: 1, rate: 0, amount: 0, isHeading: false }],
          discountPercent: 0,
          notes: "",
          terms: "",
          placeOfSupply: "Kerala (32)",
        });
      }
    }
  }, [open, editingQuote, nextNumber]);

  const calculateTotals = () => {
    const items = formData.lineItems.filter((item: any) => !item.isHeading);
    const subtotal = items.reduce((sum: number, item: any) => sum + (parseFloat(item.amount) || 0), 0);
    
    if (isTaxDocument) {
      // For tax documents, no discount - taxes are calculated on full line item amounts
      const cgstTotal = items.reduce((sum: number, item: any) => sum + (parseFloat(item.cgstAmount) || 0), 0);
      const sgstTotal = items.reduce((sum: number, item: any) => sum + (parseFloat(item.sgstAmount) || 0), 0);
      const total = subtotal + cgstTotal + sgstTotal;
      return { subtotal, discountAmount: 0, cgstTotal, sgstTotal, total };
    } else {
      // For standard estimates, apply discount
      const discountAmount = (subtotal * (formData.discountPercent || 0)) / 100;
      const total = subtotal - discountAmount;
      return { subtotal, discountAmount, cgstTotal: 0, sgstTotal: 0, total };
    }
  };

  const updateLineItem = (index: number, field: string, value: any) => {
    const newLineItems = [...formData.lineItems];
    newLineItems[index] = { ...newLineItems[index], [field]: value };

    if (field === "quantity" || field === "rate" || field === "cgstPercent" || field === "sgstPercent") {
      const qty = parseFloat(newLineItems[index].quantity) || 0;
      const rate = parseFloat(newLineItems[index].rate) || 0;
      const baseAmount = qty * rate;
      newLineItems[index].amount = baseAmount;
      
      if (isTaxDocument) {
        const cgstPercent = parseFloat(newLineItems[index].cgstPercent) || 0;
        const sgstPercent = parseFloat(newLineItems[index].sgstPercent) || 0;
        newLineItems[index].cgstAmount = baseAmount * (cgstPercent / 100);
        newLineItems[index].sgstAmount = baseAmount * (sgstPercent / 100);
      }
    }

    setFormData({ ...formData, lineItems: newLineItems });
  };

  const addLineItem = (isHeading = false) => {
    const newItem = isHeading
      ? { description: "", isHeading: true }
      : isTaxDocument
        ? { description: "", quantity: 1, rate: 0, amount: 0, isHeading: false, hsnSac: "", cgstPercent: 9, sgstPercent: 9, cgstAmount: 0, sgstAmount: 0 }
        : { description: "", quantity: 1, rate: 0, amount: 0, isHeading: false };
    
    setFormData({
      ...formData,
      lineItems: [...formData.lineItems, newItem],
    });
  };

  const removeLineItem = (index: number) => {
    const newLineItems = formData.lineItems.filter((_: any, i: number) => i !== index);
    setFormData({ ...formData, lineItems: newLineItems });
  };

  const handleSave = (asDraft: boolean) => {
    const { subtotal, discountAmount, cgstTotal, sgstTotal, total } = calculateTotals();
    
    // Transform line items to match backend schema (name/total instead of description/amount)
    // Ensure all numeric values are properly parsed as numbers
    const transformedLineItems = formData.lineItems.map((item: any) => ({
      name: item.description || "",
      quantity: parseFloat(item.quantity) || 1,
      rate: parseFloat(item.rate) || 0,
      total: parseFloat(item.amount) || 0,
      isHeading: item.isHeading || false,
      ...(isTaxDocument ? {
        hsnSac: item.hsnSac || "",
        cgstPercent: parseFloat(item.cgstPercent) || 9,
        sgstPercent: parseFloat(item.sgstPercent) || 9,
        cgstAmount: parseFloat(item.cgstAmount) || 0,
        sgstAmount: parseFloat(item.sgstAmount) || 0,
      } : {}),
    }));
    
    onSave(
      {
        ...formData,
        // Convert empty strings to null for optional foreign key fields
        customerId: formData.customerId || null,
        eventId: formData.eventId || null,
        // Date is required, ensure it has a value
        date: formData.date || format(new Date(), "yyyy-MM-dd"),
        // Omit expiryDate if empty (don't send null)
        ...(formData.expiryDate ? { expiryDate: formData.expiryDate } : {}),
        lineItems: transformedLineItems,
        isTaxDocument,
        subtotal: subtotal.toFixed(2),
        // For tax documents, explicitly set discount to 0 for data consistency
        discountPercent: isTaxDocument ? "0" : String(formData.discountPercent || 0),
        discountAmount: isTaxDocument ? "0.00" : discountAmount.toFixed(2),
        ...(isTaxDocument ? {
          placeOfSupply: formData.placeOfSupply || "Kerala (32)",
          cgstTotal: cgstTotal.toFixed(2),
          sgstTotal: sgstTotal.toFixed(2),
          taxTotal: (cgstTotal + sgstTotal).toFixed(2),
        } : {}),
        total: total.toFixed(2),
      },
      asDraft
    );
  };

  const { subtotal, discountAmount, cgstTotal, sgstTotal, total } = calculateTotals();
  const selectedCustomer = customers.find((c) => c.id === formData.customerId);
  const selectedEvent = events.find((e) => e.id === formData.eventId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingQuote ? "Edit Quote" : "New Quote"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-red-500">Customer Name*</Label>
                <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                    >
                      {selectedCustomer ? selectedCustomer.name : "Select or add a customer"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0">
                    <Command>
                      <CommandInput placeholder="Search customers..." />
                      <CommandList>
                        <CommandEmpty>No customers found.</CommandEmpty>
                        <CommandGroup>
                          {customers.map((customer) => (
                            <CommandItem
                              key={customer.id}
                              value={customer.name}
                              onSelect={() => {
                                setFormData({ ...formData, customerId: customer.id });
                                setCustomerSearchOpen(false);
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                  <span className="text-sm font-medium text-primary">
                                    {customer.name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <span>{customer.name}</span>
                              </div>
                              {formData.customerId === customer.id && (
                                <Check className="ml-auto h-4 w-4" />
                              )}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                        <CommandGroup>
                          <CommandItem
                            onSelect={() => {
                              setCustomerSearchOpen(false);
                              onNewCustomer();
                            }}
                            className="text-primary"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            New Customer
                          </CommandItem>
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Event</Label>
                <Popover open={eventSearchOpen} onOpenChange={setEventSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between">
                      {selectedEvent ? selectedEvent.title : "Select event (optional)"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0">
                    <Command>
                      <CommandInput placeholder="Search events..." />
                      <CommandList>
                        <CommandEmpty>No events found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            onSelect={() => {
                              setFormData({ ...formData, eventId: "" });
                              setEventSearchOpen(false);
                            }}
                          >
                            <span className="text-muted-foreground">No event</span>
                          </CommandItem>
                          {events.map((event) => (
                            <CommandItem
                              key={event.id}
                              value={event.title}
                              onSelect={() => {
                                setFormData({ ...formData, eventId: event.id });
                                setEventSearchOpen(false);
                              }}
                            >
                              {event.title}
                              {formData.eventId === event.id && (
                                <Check className="ml-auto h-4 w-4" />
                              )}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label className="text-red-500">Quote#*</Label>
                <Input
                  value={formData.number}
                  onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-red-500">Quote Date*</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Subject</Label>
              <Input
                placeholder="Let your customer know what this Quote is for"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Item Table</h3>
                <Button variant="link" size="sm" className="text-primary">
                  Bulk Actions
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr className="text-left text-sm">
                      <th className="p-2 font-medium">ITEM DETAILS</th>
                      {isTaxDocument && <th className="p-2 font-medium text-center w-24">HSN/SAC</th>}
                      <th className="p-2 font-medium text-center w-20">QTY</th>
                      <th className="p-2 font-medium text-right w-24">RATE</th>
                      <th className="p-2 font-medium text-right w-24">AMOUNT</th>
                      {isTaxDocument && (
                        <>
                          <th className="p-2 font-medium text-center w-16">CGST%</th>
                          <th className="p-2 font-medium text-center w-16">SGST%</th>
                          <th className="p-2 font-medium text-right w-20">TAX</th>
                        </>
                      )}
                      <th className="p-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.lineItems.map((item: any, index: number) => (
                      <tr key={index} className="border-t">
                        {item.isHeading ? (
                          <>
                            <td colSpan={isTaxDocument ? 8 : 4} className="p-2">
                              <Input
                                placeholder="Section heading..."
                                value={item.description}
                                onChange={(e) => updateLineItem(index, "description", e.target.value)}
                                className="font-semibold text-primary bg-primary/5"
                              />
                            </td>
                            <td className="p-2 text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => removeLineItem(index)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="p-2">
                              <Input
                                placeholder="Type or click to select an item."
                                value={item.description}
                                onChange={(e) => updateLineItem(index, "description", e.target.value)}
                              />
                            </td>
                            {isTaxDocument && (
                              <td className="p-2">
                                <Input
                                  placeholder="HSN"
                                  className="text-center"
                                  value={item.hsnSac || ""}
                                  onChange={(e) => updateLineItem(index, "hsnSac", e.target.value)}
                                />
                              </td>
                            )}
                            <td className="p-2">
                              <Input
                                type="number"
                                className="text-center"
                                value={item.quantity}
                                onChange={(e) => updateLineItem(index, "quantity", e.target.value)}
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                className="text-right"
                                value={item.rate}
                                onChange={(e) => updateLineItem(index, "rate", e.target.value)}
                              />
                            </td>
                            <td className="p-2 text-right font-medium">
                              {parseFloat(item.amount || 0).toFixed(2)}
                            </td>
                            {isTaxDocument && (
                              <>
                                <td className="p-2">
                                  <Input
                                    type="number"
                                    className="text-center w-16"
                                    value={item.cgstPercent || 9}
                                    onChange={(e) => updateLineItem(index, "cgstPercent", e.target.value)}
                                  />
                                </td>
                                <td className="p-2">
                                  <Input
                                    type="number"
                                    className="text-center w-16"
                                    value={item.sgstPercent || 9}
                                    onChange={(e) => updateLineItem(index, "sgstPercent", e.target.value)}
                                  />
                                </td>
                                <td className="p-2 text-right text-xs text-muted-foreground">
                                  {((parseFloat(item.cgstAmount) || 0) + (parseFloat(item.sgstAmount) || 0)).toFixed(2)}
                                </td>
                              </>
                            )}
                            <td className="p-2 text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => removeLineItem(index)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => addLineItem(false)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add New Row
                </Button>
                <Button variant="outline" size="sm" onClick={() => addLineItem(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Section Heading
                </Button>
              </div>
            </div>

            {isTaxDocument && (
              <div className="space-y-2">
                <Label>Place of Supply</Label>
                <Select value={formData.placeOfSupply || "Kerala (32)"} onValueChange={(v) => setFormData({ ...formData, placeOfSupply: v })}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDIAN_STATES.map((state) => (
                      <SelectItem key={state} value={state}>{state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex justify-end">
              <div className="w-80 space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Sub Total</span>
                  <span className="font-medium">{subtotal.toFixed(2)}</span>
                </div>
                {isTaxDocument ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span>CGST</span>
                      <span className="font-medium">{cgstTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>SGST</span>
                      <span className="font-medium">{sgstTotal.toFixed(2)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between text-sm">
                    <span>Discount</span>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        className="w-16 h-8 text-center"
                        value={formData.discountPercent}
                        onChange={(e) => setFormData({ ...formData, discountPercent: parseFloat(e.target.value) || 0 })}
                      />
                      <span>%</span>
                      <span className="w-24 text-right">{discountAmount.toFixed(2)}</span>
                    </div>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-lg border-t pt-2">
                  <span>Total</span>
                  <span>₹{total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Customer notes..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Terms & Conditions</Label>
              <Textarea
                placeholder="Enter terms and conditions..."
                value={formData.terms}
                onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                rows={4}
              />
            </div>
          </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => handleSave(true)} disabled={isPending}>
            Save as Draft
          </Button>
          <Button onClick={() => handleSave(false)} disabled={isPending}>
            {isPending ? "Saving..." : "Save and Send"}
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface NewCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: any) => void;
  isPending: boolean;
}

function NewCustomerDialog({ open, onOpenChange, onSave, isPending }: NewCustomerDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    billingAddress: "",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Customer</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-red-500">Customer Name*</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter customer name"
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="customer@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+91 XXXXX XXXXX"
            />
          </div>
          <div className="space-y-2">
            <Label>Billing Address</Label>
            <Textarea
              value={formData.billingAddress}
              onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
              placeholder="Enter billing address"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onSave(formData)} disabled={isPending || !formData.name}>
            {isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

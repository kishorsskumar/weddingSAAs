import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
  MapPin,
  GripVertical,
  Copy,
  MessageSquare,
  ExternalLink,
  Eye,
  EyeOff,
  TrendingUp,
  Undo2,
  Redo2
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

// Lead type mapped from sales_deals for the leads dropdown
type Lead = {
  id: string;
  leadCode: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: string;
  status: string;
  address: string | null;
};

// Sales Deal type from the CRM pipeline
type SalesDeal = {
  id: string;
  title: string;
  pipelineId: string | null;
  stageId: string | null;
  value: string | null;
  contactId: string | null;
  ownerId: string | null;
  status: string;
  source: string | null;
  eventType: string | null;
  venue: string | null;
  address: string | null;
  createdAt: string;
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
  serviceChargePercent: string;
  serviceChargeAmount: string;
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
  filterType?: "oakstreet" | "meta_events" | "yepman";
  onDownloadPdf?: (type: "invoice" | "quote" | "receipt" | "delivery-challan", id: string, hideHeader?: boolean) => void;
}

export function ZohoQuotes({ filterType = "oakstreet", onDownloadPdf }: ZohoQuotesProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canViewInternalCosting = user?.role === 'superadmin' || user?.role === 'wedding_planner';
  
  const getDefaultWeddingPlannerName = () => {
    if (!user) return "";
    const name = user.name?.toLowerCase() || "";
    if (name.includes("femina")) return "Femina KM";
    if (name.includes("fida")) return "Fida Fathima";
    return "";
  };
  
  const isCostingComplete = useCallback((quote: any) => {
    if (!canViewInternalCosting) return true;
    const items = (quote.lineItems || []).filter((item: any) => !item.isHeading && (item.name || item.description)?.trim());
    if (items.length === 0) return true;
    return items.every((item: any) => {
      const rate = parseFloat(item.rate || item.total || '0');
      const qty = parseFloat(item.quantity || '0');
      if (rate === 0 || qty === 0) return true;
      return item.costPrice && parseFloat(item.costPrice) > 0;
    });
  }, [canViewInternalCosting]);

  const blockIfCostingIncomplete = useCallback((quote: any) => {
    if (!isCostingComplete(quote)) {
      toast({
        title: "Internal Costing Incomplete",
        description: "Please complete internal costing for all items before downloading, printing, or sharing this estimate.",
        variant: "destructive",
      });
      return true;
    }
    return false;
  }, [isCostingComplete, toast]);

  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Estimate | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [weddingPlannerFilter, setWeddingPlannerFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [isNewCustomerDialogOpen, setIsNewCustomerDialogOpen] = useState(false);
  const [pendingSendEstimateId, setPendingSendEstimateId] = useState<string | null>(null);
  const [pendingSendData, setPendingSendData] = useState<{email?: string; whatsapp?: string; name?: string} | null>(null);
  const [pendingWhatsAppCopy, setPendingWhatsAppCopy] = useState(false);
  const [sendMethodDialogOpen, setSendMethodDialogOpen] = useState(false);

  const { data: estimates = [] } = useQuery<Estimate[]>({
    queryKey: ["/api/estimates"],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  // Fetch sales deals from CRM and map to Lead format for estimates dropdown
  const { data: salesDeals = [] } = useQuery<SalesDeal[]>({
    queryKey: ["/api/sales/deals"],
  });

  // Map sales deals to Lead format for the dropdown
  const leads: Lead[] = useMemo(() => {
    return salesDeals.map((deal, index) => ({
      id: deal.id,
      leadCode: `DEAL-${String(index + 1).padStart(4, '0')}`,
      name: deal.title,
      email: null,
      phone: null,
      company: deal.venue || null,
      source: deal.source || 'pipeline',
      status: deal.status,
    }));
  }, [salesDeals]);

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const { data: nextNumber, refetch: refetchNextNumber } = useQuery<{ number: string }>({
    queryKey: ["/api/estimates/next-number", filterType],
    queryFn: () => fetch(`/api/estimates/next-number?companyBrand=${filterType}`).then(res => res.json()),
    staleTime: 0, // Always consider data stale to get fresh number
  });

  const { data: companySettings } = useQuery<{ defaultTerms?: string | null }>({
    queryKey: ["/api/company-settings"],
  });

  // Get unique wedding planner names from estimates
  const weddingPlannerNames = useMemo(() => {
    const names = estimates
      .map((e) => (e as any).weddingPlannerName)
      .filter((name): name is string => !!name && name.trim() !== "");
    return Array.from(new Set(names)).sort();
  }, [estimates]);

  const filteredQuotes = useMemo(() => {
    let filtered = estimates;
    
    // Filter by company type
    if (filterType === "yepman") {
      // Yepman = Tax documents (GST)
      filtered = estimates.filter((e) => e.isTaxDocument === true);
    } else if (filterType === "meta_events") {
      // Meta Events = non-tax documents with companyBrand = meta_events
      filtered = estimates.filter((e) => !e.isTaxDocument && (e as any).companyBrand === "meta_events");
    } else {
      // Oakstreet = non-tax documents with companyBrand = oakstreet or undefined
      filtered = estimates.filter((e) => !e.isTaxDocument && ((e as any).companyBrand === "oakstreet" || !(e as any).companyBrand));
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((e) => e.status === statusFilter);
    }

    if (weddingPlannerFilter !== "all") {
      filtered = filtered.filter((e) => (e as any).weddingPlannerName === weddingPlannerFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.number.toLowerCase().includes(query) ||
          customers.find((c) => c.id === e.customerId)?.name.toLowerCase().includes(query) ||
          ((e as any).leadName || "").toLowerCase().includes(query)
      );
    }

    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [estimates, filterType, statusFilter, weddingPlannerFilter, searchQuery, customers]);

  const selectedQuote = useMemo(
    () => filteredQuotes.find((q) => q.id === selectedQuoteId),
    [filteredQuotes, selectedQuoteId]
  );

  const createEstimate = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/estimates", data);
      return { estimate: await res.json(), shouldSend: data.status === 'sent' };
    },
    onSuccess: async ({ estimate, shouldSend }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/estimates"] });
      // Invalidate all next-number queries (for all company brands)
      queryClient.invalidateQueries({ queryKey: ["/api/estimates/next-number", "oakstreet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/estimates/next-number", "meta_events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/estimates/next-number", "yepman"] });
      setIsCreateModalOpen(false);
      setEditingQuote(null);
      
      // Send WhatsApp copy to current user if requested
      if (pendingWhatsAppCopy && estimate?.id) {
        try {
          await apiRequest("POST", `/api/estimates/${estimate.id}/send-whatsapp-copy`);
          toast({ title: "WhatsApp Copy Sent", description: "A copy has been sent to your WhatsApp." });
        } catch (err: any) {
          toast({ title: "WhatsApp Failed", description: err.message || "Could not send WhatsApp copy.", variant: "destructive" });
        }
        setPendingWhatsAppCopy(false);
      }
      
      if (shouldSend && estimate?.id) {
        // Store the estimate data for the send dialog
        setPendingSendEstimateId(estimate.id);
        setPendingSendData({
          email: estimate.customerEmail || '',
          whatsapp: estimate.customerWhatsapp || '',
          name: estimate.leadName || 'Customer'
        });
        setSendMethodDialogOpen(true);
        toast({ title: "Quote Created", description: "Now choose how to send it." });
      } else {
        toast({ title: "Quote Created", description: "Quote has been saved as draft." });
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateEstimate = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await apiRequest("PATCH", `/api/estimates/${id}`, data);
      return { id };
    },
    onSuccess: async ({ id }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/estimates"] });
      setIsCreateModalOpen(false);
      setEditingQuote(null);
      
      // Send WhatsApp copy to current user if requested
      if (pendingWhatsAppCopy && id) {
        try {
          await apiRequest("POST", `/api/estimates/${id}/send-whatsapp-copy`);
          toast({ title: "WhatsApp Copy Sent", description: "A copy has been sent to your WhatsApp." });
        } catch (err: any) {
          toast({ title: "WhatsApp Failed", description: err.message || "Could not send WhatsApp copy.", variant: "destructive" });
        }
        setPendingWhatsAppCopy(false);
      }
      
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

  const shareToPortal = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/estimates/${id}/share-to-portal`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/estimates"] });
      toast({ title: "Shared to Portal", description: "Estimate is now visible in the customer's portal under Financials." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to share to portal", variant: "destructive" });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft":
        return "bg-gray-100 text-gray-700";
      case "sent":
        return "bg-blue-100 text-primary";
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
    <div className="h-full flex-1 flex flex-col bg-background min-h-0">
      {/* Full-width header when no panel open */}
      {!selectedQuoteId && (
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

            {weddingPlannerNames.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1 sm:gap-2 h-9 text-xs sm:text-sm">
                    <User className="h-3 w-3 sm:h-4 sm:w-4" />
                    {weddingPlannerFilter === "all" ? "All Planners" : weddingPlannerFilter}
                    <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4" />
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

            <Button
              onClick={() => {
                refetchNextNumber();
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
            <Button
              onClick={() => {
                refetchNextNumber();
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
      )}

      <div className="flex-1 flex min-h-0">
        <div
          className={cn(
            "overflow-auto transition-all duration-300 w-full flex flex-col",
            selectedQuoteId && "hidden md:flex md:border-r md:w-[360px] md:flex-shrink-0"
          )}
        >
          {/* Compact header inside left list when panel is open */}
          {selectedQuoteId && (
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
                    <DropdownMenuItem onClick={() => setStatusFilter("all")}>All Quotes</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setStatusFilter("draft")}>Draft</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStatusFilter("sent")}>Sent</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStatusFilter("accepted")}>Accepted</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStatusFilter("declined")}>Declined</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStatusFilter("converted")}>Converted</DropdownMenuItem>
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
                    refetchNextNumber();
                    setEditingQuote(null);
                    setIsCreateModalOpen(true);
                  }}
                  size="icon"
                  className="bg-primary hover:bg-primary/90 h-7 w-7 rounded-full flex-shrink-0"
                  title="New Estimate"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
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
                      <p className="text-sm font-medium text-foreground truncate">{customer?.name || (quote as any).leadName || "No customer"}</p>
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

          {/* Desktop: Full table when no panel open, compact card list when panel is open */}
          {selectedQuoteId ? (
            <div className="hidden md:block divide-y">
              {filteredQuotes.map((quote) => {
                const customer = getCustomer(quote.customerId);
                const isSelected = selectedQuoteId === quote.id;
                return (
                  <div
                    key={quote.id}
                    className={cn(
                      "px-4 py-3 cursor-pointer transition-colors hover:bg-muted/50",
                      isSelected && "bg-primary/5 border-l-2 border-l-primary"
                    )}
                    onClick={() => setSelectedQuoteId(isSelected ? null : quote.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Checkbox onClick={(e) => e.stopPropagation()} className="flex-shrink-0" />
                        <span className="text-sm font-semibold text-gray-900 truncate">{customer?.name || (quote as any).leadName || "-"}</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-900 flex-shrink-0">
                        ₹{parseFloat(quote.total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 ml-8">
                      <span className="text-xs text-muted-foreground">{quote.number}</span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">{format(new Date(quote.date), "dd/MM/yyyy")}</span>
                    </div>
                    <div className="ml-8 mt-1">
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium uppercase", getStatusColor(quote.status))}>
                        {quote.status}
                      </span>
                    </div>
                  </div>
                );
              })}
              {filteredQuotes.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">No quotes found</div>
              )}
            </div>
          ) : (
            <table className="w-full hidden md:table">
              <thead className="sticky top-0 bg-card z-10 border-b">
                <tr className="text-left text-sm text-muted-foreground">
                  <th className="p-3 w-10">
                    <Checkbox />
                  </th>
                  <th className="p-3 font-medium">DATE</th>
                  <th className="p-3 font-medium">QUOTE NUMBER</th>
                  <th className="p-3 font-medium hidden lg:table-cell">EVENT</th>
                  <th className="p-3 font-medium">CUSTOMER / LEAD</th>
                  <th className="p-3 font-medium text-right">AMOUNT</th>
                  <th className="p-3 font-medium">STATUS</th>
                  <th className="p-3 font-medium text-right">ACTIONS</th>
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
                      <td className="p-3 text-sm font-medium">{customer?.name || (quote as any).leadName || "-"}</td>
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
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-0.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setEditingQuote(quote); setIsCreateModalOpen(true); }} title="Edit">
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()} title="Download PDF">
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                              <DropdownMenuItem onClick={() => { if (!blockIfCostingIncomplete(quote)) onDownloadPdf?.("quote", quote.id, false); }}>
                                With Header
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { if (!blockIfCostingIncomplete(quote)) onDownloadPdf?.("quote", quote.id, true); }}>
                                Without Header
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); deleteEstimate.mutate(quote.id); }} title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredQuotes.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      No quotes found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
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
            onClone={() => {
              // Create a cloned estimate object with new number and reset status
              const clonedQuote: Estimate = {
                ...selectedQuote,
                id: "", // Will be generated on save
                number: nextNumber?.number || "EST-NEW",
                status: "draft",
                createdAt: new Date().toISOString(),
              };
              setEditingQuote(clonedQuote);
              setIsCreateModalOpen(true);
            }}
            onDownloadPdf={(type, id, hideHeader) => {
              if (blockIfCostingIncomplete(selectedQuote)) return;
              onDownloadPdf?.(type, id, hideHeader);
            }}
            onConvert={() => convertToInvoice.mutate(selectedQuote.id)}
            onShareToPortal={() => shareToPortal.mutate(selectedQuote.id)}
          />
        )}
      </div>

      <QuoteFormModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        editingQuote={editingQuote}
        customers={customers}
        leads={leads}
        events={events}
        nextNumber={nextNumber?.number || "QT-001"}
        filterType={filterType}
        defaultTerms={companySettings?.defaultTerms}
        onSave={(data, asDraft, sendWhatsAppCopy) => {
          // Set the WhatsApp copy flag before mutation
          if (sendWhatsAppCopy) {
            setPendingWhatsAppCopy(true);
          }
          // If editingQuote exists but has empty id, it's a clone - treat as new
          if (editingQuote && editingQuote.id) {
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

      {/* Send Method Selection Dialog - shown after "Save and Send" */}
      <Dialog open={sendMethodDialogOpen} onOpenChange={setSendMethodDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send Estimate</DialogTitle>
            <DialogDescription>
              Choose how you'd like to send this estimate to {pendingSendData?.name || 'the customer'}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input
                type="email"
                placeholder="Enter email address"
                value={pendingSendData?.email || ''}
                onChange={(e) => setPendingSendData(prev => ({ ...prev, email: e.target.value }))}
                data-testid="input-send-method-email"
              />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp Number</Label>
              <Input
                type="tel"
                placeholder="Enter WhatsApp number"
                value={pendingSendData?.whatsapp || ''}
                onChange={(e) => setPendingSendData(prev => ({ ...prev, whatsapp: e.target.value }))}
                data-testid="input-send-method-whatsapp"
              />
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setSendMethodDialogOpen(false);
                setPendingSendEstimateId(null);
                setPendingSendData(null);
              }}
            >
              Skip Sending
            </Button>
            <Button
              variant="outline"
              disabled={!pendingSendData?.email}
              onClick={async () => {
                if (!pendingSendEstimateId || !pendingSendData?.email) return;
                try {
                  const res = await fetch(`/api/estimates/${pendingSendEstimateId}/send-email`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: pendingSendData.email }),
                    credentials: 'include'
                  });
                  const data = await res.json();
                  if (res.ok) {
                    toast({ title: 'Success', description: 'Estimate sent via email with PDF attachment' });
                    setSendMethodDialogOpen(false);
                    setPendingSendEstimateId(null);
                    setPendingSendData(null);
                    queryClient.invalidateQueries({ queryKey: ['/api/estimates'] });
                  } else {
                    toast({ title: 'Error', description: data.error || 'Failed to send email', variant: 'destructive' });
                  }
                } catch (error: any) {
                  toast({ title: 'Error', description: error.message || 'Failed to send email', variant: 'destructive' });
                }
              }}
              data-testid="btn-send-via-email"
            >
              <Mail className="h-4 w-4 mr-2" />
              Send via Email
            </Button>
            <Button
              disabled={!pendingSendData?.whatsapp}
              onClick={async () => {
                if (!pendingSendEstimateId || !pendingSendData?.whatsapp) return;
                try {
                  const res = await fetch(`/api/estimates/${pendingSendEstimateId}/send-whatsapp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: pendingSendData.whatsapp }),
                    credentials: 'include'
                  });
                  const data = await res.json();
                  if (res.ok) {
                    toast({ title: 'Success', description: 'Estimate sent via WhatsApp with PDF attachment' });
                    setSendMethodDialogOpen(false);
                    setPendingSendEstimateId(null);
                    setPendingSendData(null);
                    queryClient.invalidateQueries({ queryKey: ['/api/estimates'] });
                  } else {
                    toast({ title: 'Error', description: data.error || 'Failed to send WhatsApp', variant: 'destructive' });
                  }
                } catch (error: any) {
                  toast({ title: 'Error', description: error.message || 'Failed to send WhatsApp', variant: 'destructive' });
                }
              }}
              data-testid="btn-send-via-whatsapp"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Send via WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  onClone: () => void;
  onDownloadPdf?: (type: "invoice" | "quote" | "receipt" | "delivery-challan", id: string, hideHeader?: boolean) => void;
  onConvert?: () => void;
  onShareToPortal?: () => void;
}

function QuoteDetailPanel({
  quote,
  customer,
  event,
  onClose,
  onEdit,
  onDelete,
  onClone,
  onDownloadPdf,
  onConvert,
  onShareToPortal,
}: QuoteDetailPanelProps) {
  const { user } = useAuth();
  const canViewInternalCosting = user?.role === 'superadmin' || user?.role === 'wedding_planner';
  const [activeTab, setActiveTab] = useState("details");
  const [sendEmailDialogOpen, setSendEmailDialogOpen] = useState(false);
  const [sendWhatsAppDialogOpen, setSendWhatsAppDialogOpen] = useState(false);
  const [sendEmail, setSendEmail] = useState((quote as any).customerEmail || "");
  const [sendPhone, setSendPhone] = useState((quote as any).customerWhatsapp || "");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const isCostingIncomplete = canViewInternalCosting && (() => {
    const items = (quote.lineItems || []).filter((item: any) => !item.isHeading && (item.name || item.description)?.trim());
    return items.length > 0 && !items.every((item: any) => {
      const rate = parseFloat(item.rate || item.total || '0');
      const qty = parseFloat(item.quantity || '0');
      if (rate === 0 || qty === 0) return true;
      return item.costPrice && parseFloat(item.costPrice) > 0;
    });
  })();

  const blockAction = () => {
    toast({
      title: "Internal Costing Incomplete",
      description: "Please complete internal costing for all items before downloading, printing, or sharing this estimate.",
      variant: "destructive",
    });
  };

  const handleSendEmail = async () => {
    if (isCostingIncomplete) { blockAction(); return; }
    if (!sendEmail) {
      toast({ title: "Error", description: "Please enter an email address", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/estimates/${quote.id}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: sendEmail }),
        credentials: "include"
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Success", description: "Estimate sent via email" });
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
    if (isCostingIncomplete) { blockAction(); return; }
    if (!sendPhone) {
      toast({ title: "Error", description: "Please enter a phone number", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/estimates/${quote.id}/send-whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: sendPhone }),
        credentials: "include"
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Success", description: "Estimate sent via WhatsApp" });
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

  return (
    <div className="fixed inset-0 md:relative md:inset-auto flex flex-col bg-white md:border-l z-50 md:z-auto overflow-hidden flex-1 min-h-0">
      <div className="flex-shrink-0 bg-white">
        <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50/80">
          <div>
            <p className="text-[11px] text-gray-400 font-medium tracking-wide uppercase">Quote</p>
            <h2 className="text-base font-bold text-gray-900 -mt-0.5">{quote.number}</h2>
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
              <DropdownMenuItem data-testid="btn-send-estimate-email" onClick={() => { if (isCostingIncomplete) { blockAction(); return; } setSendEmailDialogOpen(true); }}>
                <Mail className="h-4 w-4 mr-2" />
                Send via Email
              </DropdownMenuItem>
              <DropdownMenuItem data-testid="btn-send-estimate-whatsapp" onClick={() => { if (isCostingIncomplete) { blockAction(); return; } setSendWhatsAppDialogOpen(true); }}>
                <Phone className="h-4 w-4 mr-2" />
                Send via WhatsApp
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem data-testid="btn-send-whatsapp-copy" onClick={async () => {
                try {
                  setSending(true);
                  await fetch(`/api/estimates/${quote.id}/send-whatsapp-copy`, { method: 'POST', credentials: 'include' });
                  toast({ title: "WhatsApp Copy Sent", description: "A copy has been sent to your WhatsApp." });
                } catch (err: any) {
                  toast({ title: "WhatsApp Failed", description: err.message || "Could not send WhatsApp copy.", variant: "destructive" });
                } finally {
                  setSending(false);
                }
              }}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Send me a WhatsApp copy
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 rounded-md text-xs font-medium border-gray-300 text-gray-700 hover:bg-gray-50 hidden sm:flex">
                <Share2 className="h-3.5 w-3.5 mr-1.5" />
                Share
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => { if (isCostingIncomplete) { blockAction(); return; } onShareToPortal?.(); }}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Share to Customer Portal
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Dialog open={sendEmailDialogOpen} onOpenChange={setSendEmailDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send Estimate via Email</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Recipient Email</Label>
                  <Input 
                    data-testid="input-estimate-email"
                    type="email" 
                    value={sendEmail} 
                    onChange={(e) => setSendEmail(e.target.value)}
                    placeholder="customer@example.com"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  An email with a link to view <strong>{quote.number}</strong> will be sent.
                </p>
              </div>
              <DialogFooter>
                <Button data-testid="btn-cancel-estimate-email" variant="outline" onClick={() => setSendEmailDialogOpen(false)}>Cancel</Button>
                <Button data-testid="btn-submit-estimate-email" onClick={handleSendEmail} disabled={sending}>
                  {sending ? "Sending..." : "Send Email"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={sendWhatsAppDialogOpen} onOpenChange={setSendWhatsAppDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send Estimate via WhatsApp</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Phone Number (with country code)</Label>
                  <Input 
                    data-testid="input-estimate-phone"
                    type="tel" 
                    value={sendPhone} 
                    onChange={(e) => setSendPhone(e.target.value)}
                    placeholder="+919876543210"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  A WhatsApp message with a link to view <strong>{quote.number}</strong> will be sent.
                </p>
              </div>
              <DialogFooter>
                <Button data-testid="btn-cancel-estimate-whatsapp" variant="outline" onClick={() => setSendWhatsAppDialogOpen(false)}>Cancel</Button>
                <Button data-testid="btn-submit-estimate-whatsapp" onClick={handleSendWhatsApp} disabled={sending}>
                  {sending ? "Sending..." : "Send WhatsApp"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 rounded-md text-xs font-medium border-gray-300 text-gray-700 hover:bg-gray-50">
                <Printer className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">PDF/Print</span>
                <ChevronDown className="h-3 w-3 ml-1 text-gray-400" />
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
              <DropdownMenuItem onClick={() => {
                if (isCostingIncomplete) { blockAction(); return; }
                window.open(`/print/quote/${quote.id}`, '_blank');
              }}>
                Print
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 rounded-md text-xs font-medium border-gray-300 text-gray-700 hover:bg-gray-50">
                Convert
                <ChevronDown className="h-3 w-3 ml-1 text-gray-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => { if (isCostingIncomplete) { blockAction(); return; } onConvert?.(); }}>
                Convert to Invoice
              </DropdownMenuItem>
              <DropdownMenuItem>Convert to Sales Order</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onClone}>Clone</DropdownMenuItem>
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

        <div className="flex items-center justify-between px-4 border-b">
          <div className="flex gap-0">
            <button
              onClick={() => setActiveTab("details")}
              className={cn(
                "px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors",
                activeTab === "details" ? "border-[#4b7c29] text-[#4b7c29]" : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              Quote Details
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
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-gray-900">{quote.number}</h3>
                  <span className={cn(
                    "text-[10px] font-semibold uppercase px-2 py-0.5 rounded",
                    getStatusColor(quote.status)
                  )}>
                    {quote.status}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">
                  Total : <span className="text-gray-800 font-medium">₹{parseFloat(quote.total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm py-3 border-t border-b border-gray-100">
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Quote Number</p>
                <p className="font-medium text-gray-900">{quote.number}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Quote Date</p>
                <p className="font-medium text-gray-900">{format(new Date(quote.date), "dd/MM/yyyy")}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Creation Date</p>
                <p className="font-medium text-gray-900">{format(new Date(quote.createdAt), "dd/MM/yyyy")}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-0.5">Salesperson</p>
                <p className="font-medium text-gray-900">{(quote as any).salesperson || "-"}</p>
              </div>
              <div className="col-span-2">
                <p className="text-gray-400 text-xs mb-0.5">Subject</p>
                <p className="font-medium text-gray-900">{quote.subject || "-"}</p>
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
              ) : (quote as any).leadName ? (
                <div className="flex items-center gap-2.5 text-sm">
                  <User className="h-4 w-4 text-gray-400" />
                  <span className="font-medium text-gray-900">{(quote as any).leadName}</span>
                  <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Lead</span>
                </div>
              ) : (
                <p className="text-gray-400 text-sm">No customer assigned</p>
              )}
            </div>

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
                    {quote.lineItems.filter((item: any) => !item.isInternalOnly).map((item: any, index: number) => (
                      <tr key={index} className={cn(
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
                            <td className="px-3 py-2 text-right text-gray-600">₹{parseFloat(item.rate || "0").toLocaleString("en-IN")}</td>
                            <td className="px-3 py-2 text-right font-medium text-gray-900">
                              ₹{parseFloat(item.total || item.amount || "0").toLocaleString("en-IN")}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 space-y-1.5 text-sm">
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">Sub Total</span>
                  <span className="font-medium text-gray-900">₹{parseFloat(quote.subtotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                {parseFloat(quote.discountAmount) > 0 && (
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500">Discount ({quote.discountPercent}%)</span>
                    <span className="text-red-500">-₹{parseFloat(quote.discountAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-t border-gray-200 mt-1">
                  <span className="text-base font-bold text-gray-900">Total</span>
                  <span className="text-base font-bold text-gray-900">₹{parseFloat(quote.total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {canViewInternalCosting && (() => {
                const costingItems = quote.lineItems.filter((item: any) => !item.isHeading && !item.isInternalOnly && item.costPrice > 0);
                const internalOnlyItems = quote.lineItems.filter((item: any) => item.isInternalOnly);
                if (costingItems.length === 0 && internalOnlyItems.length === 0) return null;
                const regularCost = costingItems.reduce((sum: number, item: any) => {
                  return sum + ((parseFloat(item.costPrice) || 0) * (parseFloat(item.quantity) || 1));
                }, 0);
                const internalOnlyCost = internalOnlyItems.reduce((sum: number, item: any) => {
                  return sum + (parseFloat(item.total || item.amount || "0"));
                }, 0);
                const totalCost = regularCost + internalOnlyCost;
                const totalCustomerPrice = costingItems.reduce((sum: number, item: any) => {
                  return sum + (parseFloat(item.total || item.amount || "0"));
                }, 0);
                const totalProfit = totalCustomerPrice - totalCost;
                const overallMargin = totalCost > 0 ? ((totalProfit / totalCost) * 100) : 0;
                
                return (
                  <div className="mt-4 border border-amber-200 rounded-lg bg-amber-50/50 p-3 space-y-2" data-testid="detail-costing-summary">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-3.5 w-3.5 text-amber-700" />
                      <span className="font-semibold text-amber-800 text-xs">Internal Costing</span>
                      <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-800 border-amber-300 py-0">Confidential</Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-gray-500 block">Cost</span>
                        <span className="font-semibold text-red-600">₹{totalCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                        {internalOnlyCost > 0 && (
                          <span className="text-[9px] text-amber-600 block">(incl. ₹{internalOnlyCost.toLocaleString("en-IN")} additional)</span>
                        )}
                      </div>
                      <div>
                        <span className="text-gray-500 block">Price</span>
                        <span className="font-semibold text-gray-900">₹{totalCustomerPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">Profit</span>
                        <span className={cn("font-semibold", totalProfit >= 0 ? "text-green-600" : "text-red-600")}>
                          ₹{totalProfit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">Margin</span>
                        <span className={cn("font-semibold", overallMargin >= 0 ? "text-green-600" : "text-red-600")}>
                          {overallMargin.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    {internalOnlyItems.length > 0 && (
                      <div className="border-t border-amber-200 pt-2 mt-2">
                        <span className="text-[10px] font-semibold text-amber-800 block mb-1">Additional Internal Costs:</span>
                        {internalOnlyItems.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-[10px] text-amber-700">
                            <span>{item.description || "Unnamed cost"}</span>
                            <span>₹{(parseFloat(item.total || item.amount || "0")).toLocaleString("en-IN")}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {quote.notes && (
              <div className="border-t border-gray-100 pt-4">
                <h4 className="text-sm font-bold text-gray-900 mb-2">Notes</h4>
                <p className="text-sm text-gray-600">{quote.notes}</p>
              </div>
            )}

            {quote.terms && (
              <div className="border-t border-gray-100 pt-4">
                <h4 className="text-sm font-bold text-gray-900 mb-2">Terms & Conditions</h4>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{quote.terms}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "activity" && (
          <div className="p-5">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-50 border border-green-200 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-3.5 w-3.5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Quote Created</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {format(new Date(quote.createdAt), "dd MMM yyyy, hh:mm a")}
                  </p>
                </div>
              </div>
              {(quote.status === "sent" || quote.status === "accepted" || quote.status === "converted") && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center flex-shrink-0">
                    <Send className="h-3.5 w-3.5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Quote Sent</p>
                    <p className="text-xs text-gray-400 mt-0.5">Sent to customer</p>
                  </div>
                </div>
              )}
              {(quote.status === "accepted" || quote.status === "converted") && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-50 border border-green-200 flex items-center justify-center flex-shrink-0">
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Quote Accepted</p>
                    <p className="text-xs text-gray-400 mt-0.5">Customer accepted the quote</p>
                  </div>
                </div>
              )}
              {quote.status === "declined" && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-50 border border-red-200 flex items-center justify-center flex-shrink-0">
                    <X className="h-3.5 w-3.5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Quote Declined</p>
                    <p className="text-xs text-gray-400 mt-0.5">Customer declined the quote</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  function getStatusColor(status: string) {
    switch (status) {
      case "draft":
        return "bg-gray-100 text-gray-700";
      case "sent":
        return "bg-blue-100 text-primary";
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
  leads: Lead[];
  events: Event[];
  nextNumber: string;
  filterType: "oakstreet" | "meta_events" | "yepman";
  defaultTerms?: string | null;
  onSave: (data: any, asDraft: boolean, sendWhatsAppCopy?: boolean) => void;
  isPending: boolean;
  onNewCustomer: () => void;
}

function QuoteFormModal({
  open,
  onOpenChange,
  editingQuote,
  customers,
  leads,
  events,
  nextNumber,
  filterType,
  defaultTerms,
  onSave,
  isPending,
  onNewCustomer,
}: QuoteFormModalProps) {
  const isTaxDocument = filterType === "yepman";
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const getDefaultWeddingPlannerName = () => {
    if (!user) return "";
    const name = user.name?.toLowerCase() || "";
    if (name.includes("femina")) return "Femina KM";
    if (name.includes("fida")) return "Fida Fathima";
    return "";
  };
  
  const defaultTermsText = defaultTerms || "1. Any other additional facilities & Services to support the event will be charged at actual\n2. 15% of the total amount to be paid in advance, 40% of the amount to be paid three months before the event, 40% three weeks before the event, and a balance of 5% on the event day.\n3. The venue is to be made available 1 day prior to the setup.\n4. Loading & unloading charges (Labour Union Charges) if any will be actual and have to be born by the client\n5. Any Damage that occurred to our materials by participants will be charged at the actual.\n6. In the unlikely event of cancellation of the function, the company reserves the right to claim 10% of the total amount as cancellation fees.\n7. All items mentioned above are on a rental basis for this event only\n8. 18% GST will be extra.";
  
  const [formData, setFormData] = useState<any>({
    number: "",
    customerId: "",
    leadId: "",
    leadName: "",
    eventId: "",
    date: format(new Date(), "yyyy-MM-dd"),
    subject: "",
    lineItems: isTaxDocument 
      ? [{ description: "", quantity: 1, rate: 0, amount: 0, isHeading: false, hsnSac: "", cgstPercent: 9, sgstPercent: 9, cgstAmount: 0, sgstAmount: 0 }]
      : [{ description: "", quantity: 1, rate: 0, amount: 0, isHeading: false }],
    discountPercent: 0,
    discountAmount: 0,
    discountType: "percent", // "percent" or "amount"
    serviceChargePercent: 12.5, // Default 12.5% service charge
    serviceChargeAmount: 0,
    serviceChargeType: "percent", // "percent" or "amount"
    notes: "",
    terms: "",
    placeOfSupply: "Kerala (32)",
    companyBrand: filterType === "meta_events" ? "meta_events" : "oakstreet", // Set based on filterType
    customerAddress: "", // Billing/event address
    customerEmail: "", // Email address
    customerWhatsapp: "", // WhatsApp number for sending
  });
  const [contactType, setContactType] = useState<"customer" | "lead">("customer");
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [leadSearchOpen, setLeadSearchOpen] = useState(false);
  const [eventSearchOpen, setEventSearchOpen] = useState(false);
  const [isCreatingLead, setIsCreatingLead] = useState(false);
  const [newLeadName, setNewLeadName] = useState("");
  const [newLeadPhone, setNewLeadPhone] = useState("");
  const [newLeadEmail, setNewLeadEmail] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [sendWhatsAppCopy, setSendWhatsAppCopy] = useState(false);
  const canViewInternalCosting = user?.role === 'superadmin' || user?.role === 'wedding_planner';
  const [showInternalCosting, setShowInternalCosting] = useState(canViewInternalCosting);
  const [overallMarginInput, setOverallMarginInput] = useState("40");
  const [targetTotalInput, setTargetTotalInput] = useState("");

  const { data: costTemplates = [] } = useQuery({
    queryKey: ["/api/item-cost-templates"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/item-cost-templates");
      return res.json();
    },
    enabled: canViewInternalCosting,
  });

  // Create lead as a sales deal in the CRM pipeline
  const createLeadMutation = useMutation({
    mutationFn: async (data: { name: string; phone?: string; email?: string }) => {
      // First, get the first pipeline and its first stage
      const pipelinesRes = await apiRequest("GET", "/api/sales/pipelines");
      const pipelines = await pipelinesRes.json();
      const stagesRes = await apiRequest("GET", "/api/sales/stages");
      const stages = await stagesRes.json();
      
      const defaultPipeline = pipelines[0];
      const defaultStage = stages.find((s: any) => s.pipelineId === defaultPipeline?.id);
      
      // Create a sales deal
      const response = await apiRequest("POST", "/api/sales/deals", {
        title: data.name,
        pipelineId: defaultPipeline?.id,
        stageId: defaultStage?.id,
        status: "open",
        source: "estimate_form",
      });
      return response.json();
    },
    onSuccess: (deal: SalesDeal) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales/deals"] });
      updateFormData({ leadId: deal.id, leadName: deal.title, customerId: "" });
      setContactType("lead");
      setIsCreatingLead(false);
      setNewLeadName("");
      setNewLeadPhone("");
      setNewLeadEmail("");
      toast({ title: "Lead created", description: deal.title });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create lead", variant: "destructive" });
    },
  });

  const formInitializedRef = useRef(false);

  const autoFillCostTemplates = useCallback((items: any[], preserveRates = false) => {
    if (!canViewInternalCosting || !costTemplates || costTemplates.length === 0) return items;
    return items.map((item: any) => {
      if (item.isHeading || !item.description?.trim()) return item;
      if (item.costPrice && parseFloat(item.costPrice) > 0) return item;
      const desc = (item.description || "").toLowerCase().trim();
      const match = costTemplates.find((t: any) =>
        t.itemName.toLowerCase().trim() === desc ||
        desc.includes(t.itemName.toLowerCase().trim()) ||
        t.itemName.toLowerCase().trim().includes(desc)
      );
      if (match) {
        if (preserveRates && item.rate && parseFloat(item.rate) > 0) {
          return {
            ...item,
            costPrice: match.costPrice,
            marginPercent: match.defaultMarginPercent,
          };
        }
        const cost = parseFloat(match.costPrice) || 0;
        const margin = parseFloat(match.defaultMarginPercent) || 40;
        const calcRate = cost * (1 + margin / 100);
        const qty = parseFloat(item.quantity) || 1;
        return {
          ...item,
          costPrice: match.costPrice,
          marginPercent: match.defaultMarginPercent,
          rate: Math.round(calcRate * 100) / 100,
          amount: Math.round(qty * calcRate * 100) / 100,
        };
      }
      return { ...item, costPrice: item.costPrice || "", marginPercent: item.marginPercent || "40" };
    });
  }, [canViewInternalCosting, costTemplates]);

  useEffect(() => {
    if (!open) {
      formInitializedRef.current = false;
      return;
    }
    if (formInitializedRef.current) return;
    formInitializedRef.current = true;

    if (editingQuote) {
      const transformedLineItems = editingQuote.lineItems.length > 0 
        ? editingQuote.lineItems.map((item: any) => ({
            description: item.name || item.description || "",
            quantity: item.quantity || 1,
            rate: item.rate || 0,
            amount: item.total || item.amount || 0,
            isHeading: item.isHeading || false,
            ...(item.isInternalOnly ? { isInternalOnly: true } : {}),
            costPrice: item.costPrice ?? undefined,
            marginPercent: item.marginPercent ?? undefined,
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
      
      const savedSCPercent = parseFloat(editingQuote.serviceChargePercent) || 0;
      const savedSCAmount = parseFloat(editingQuote.serviceChargeAmount) || 0;
      const serviceChargeType = savedSCAmount > 0 && savedSCPercent === 0 ? "amount" : "percent";
      
      const savedDiscountPercent = parseFloat(editingQuote.discountPercent) || 0;
      const savedDiscountAmount = parseFloat(editingQuote.discountAmount) || 0;
      const discountType = savedDiscountAmount > 0 && savedDiscountPercent === 0 ? "amount" : "percent";
      
      const hasLead = !!(editingQuote as any).leadId || !!(editingQuote as any).leadName;
      const hasCustomer = !!editingQuote.customerId;
      setContactType(hasLead && !hasCustomer ? "lead" : "customer");
      
      setFormData({
        number: editingQuote.number,
        customerId: editingQuote.customerId || "",
        leadId: (editingQuote as any).leadId || "",
        leadName: (editingQuote as any).leadName || "",
        eventId: editingQuote.eventId || "",
        date: editingQuote.date,
        subject: editingQuote.subject || "",
        weddingPlannerName: (editingQuote as any).weddingPlannerName || "",
        lineItems: autoFillCostTemplates(transformedLineItems, true),
        discountPercent: savedDiscountPercent,
        discountAmount: savedDiscountAmount,
        discountType,
        serviceChargePercent: savedSCPercent,
        serviceChargeAmount: savedSCAmount,
        serviceChargeType,
        notes: editingQuote.notes || "",
        terms: editingQuote.terms || "",
        placeOfSupply: (editingQuote as any).placeOfSupply || "Kerala (32)",
        companyBrand: (editingQuote as any).companyBrand || "oakstreet",
        customerAddress: (editingQuote as any).customerAddress || "",
        customerEmail: (editingQuote as any).customerEmail || "",
        customerWhatsapp: (editingQuote as any).customerWhatsapp || "",
      });
    } else {
      setContactType("customer");
      const defaultItems = isTaxDocument 
        ? [{ description: "", quantity: 1, rate: 0, amount: 0, isHeading: false, hsnSac: "", cgstPercent: 9, sgstPercent: 9, cgstAmount: 0, sgstAmount: 0 }]
        : [{ description: "", quantity: 1, rate: 0, amount: 0, isHeading: false }];
      setFormData({
        number: nextNumber,
        customerId: "",
        leadId: "",
        leadName: "",
        eventId: "",
        date: format(new Date(), "yyyy-MM-dd"),
        subject: "",
        weddingPlannerName: getDefaultWeddingPlannerName(),
        lineItems: autoFillCostTemplates(defaultItems),
        discountPercent: 0,
        discountAmount: 0,
        discountType: "percent",
        serviceChargePercent: 12.5,
        serviceChargeAmount: 0,
        serviceChargeType: "percent",
        notes: "",
        terms: defaultTermsText,
        placeOfSupply: "Kerala (32)",
        companyBrand: filterType === "meta_events" ? "meta_events" : "oakstreet",
        customerAddress: "",
        customerEmail: "",
        customerWhatsapp: "",
      });
    }
    if (canViewInternalCosting) {
      setShowInternalCosting(true);
    }
  }, [open, editingQuote, nextNumber, defaultTermsText, filterType, user]);

  useEffect(() => {
    if (open && formInitializedRef.current && canViewInternalCosting && costTemplates.length > 0) {
      setFormData((prev: any) => {
        const needsAutoFill = prev.lineItems.some((item: any) =>
          !item.isHeading && item.description?.trim() && (!item.costPrice || parseFloat(item.costPrice) <= 0)
        );
        if (!needsAutoFill) return prev;
        return { ...prev, lineItems: autoFillCostTemplates(prev.lineItems, true) };
      });
    }
  }, [costTemplates]);

  const undoHistoryRef = useRef<any[]>([]);
  const undoPointerRef = useRef(0);
  const isUndoingRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const updateUndoButtons = useCallback(() => {
    setCanUndo(undoPointerRef.current > 0);
    setCanRedo(undoPointerRef.current < undoHistoryRef.current.length - 1);
  }, []);

  const saveToUndoHistory = useCallback((state: any) => {
    if (isUndoingRef.current) {
      isUndoingRef.current = false;
      return;
    }
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      const trimmed = undoHistoryRef.current.slice(0, undoPointerRef.current + 1);
      trimmed.push(JSON.parse(JSON.stringify(state)));
      if (trimmed.length > 50) trimmed.shift();
      undoHistoryRef.current = trimmed;
      undoPointerRef.current = trimmed.length - 1;
      updateUndoButtons();
    }, 300);
  }, [updateUndoButtons]);

  useEffect(() => {
    if (open) {
      undoHistoryRef.current = [JSON.parse(JSON.stringify(formData))];
      undoPointerRef.current = 0;
      setCanUndo(false);
      setCanRedo(false);
    } else {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    }
  }, [open]);

  const handleUndo = useCallback(() => {
    if (undoPointerRef.current > 0) {
      undoPointerRef.current -= 1;
      const prevState = undoHistoryRef.current[undoPointerRef.current];
      if (prevState) {
        isUndoingRef.current = true;
        setFormData(JSON.parse(JSON.stringify(prevState)));
        updateUndoButtons();
      }
    }
  }, [updateUndoButtons]);

  const handleRedo = useCallback(() => {
    if (undoPointerRef.current < undoHistoryRef.current.length - 1) {
      undoPointerRef.current += 1;
      const nextState = undoHistoryRef.current[undoPointerRef.current];
      if (nextState) {
        isUndoingRef.current = true;
        setFormData(JSON.parse(JSON.stringify(nextState)));
        updateUndoButtons();
      }
    }
  }, [updateUndoButtons]);

  useEffect(() => {
    if (!open) return;
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
  }, [open, handleUndo, handleRedo]);

  // Helper to update form data with unsaved changes tracking
  const updateFormData = (updates: Partial<typeof formData>) => {
    const newData = { ...formData, ...updates };
    setFormData(newData);
    setHasUnsavedChanges(true);
    saveToUndoHistory(newData);
  };

  const calculateTotals = () => {
    const items = formData.lineItems.filter((item: any) => !item.isHeading && !item.isInternalOnly);
    const subtotal = items.reduce((sum: number, item: any) => sum + (parseFloat(item.amount) || 0), 0);
    
    // Service charge (applies to both standard and tax documents)
    let serviceChargeAmount = 0;
    if (formData.serviceChargeType === "percent") {
      serviceChargeAmount = (subtotal * (formData.serviceChargePercent || 0)) / 100;
    } else {
      serviceChargeAmount = formData.serviceChargeAmount || 0;
    }
    
    // Discount (applied after adding service charge)
    const afterServiceCharge = subtotal + serviceChargeAmount;
    let discountAmount = 0;
    if (formData.discountType === "percent") {
      discountAmount = (afterServiceCharge * (formData.discountPercent || 0)) / 100;
    } else {
      discountAmount = formData.discountAmount || 0;
    }
    
    const afterDiscount = afterServiceCharge - discountAmount;
    
    if (isTaxDocument) {
      // For tax documents, calculate GST on line items
      const cgstTotal = items.reduce((sum: number, item: any) => sum + (parseFloat(item.cgstAmount) || 0), 0);
      const sgstTotal = items.reduce((sum: number, item: any) => sum + (parseFloat(item.sgstAmount) || 0), 0);
      const total = afterDiscount + cgstTotal + sgstTotal;
      return { subtotal, serviceChargeAmount, discountAmount, cgstTotal, sgstTotal, total };
    } else {
      const total = afterDiscount;
      return { subtotal, serviceChargeAmount, discountAmount, cgstTotal: 0, sgstTotal: 0, total };
    }
  };

  const applyOverallMargin = (marginValue: string) => {
    const targetMargin = parseFloat(marginValue);
    if (isNaN(targetMargin) || targetMargin < 0 || targetMargin >= 100) return;

    const costingItems = formData.lineItems.filter((item: any) => !item.isHeading && parseFloat(item.costPrice) > 0);
    const totalCost = costingItems.reduce((sum: number, item: any) => {
      return sum + ((parseFloat(item.costPrice) || 0) * (parseFloat(item.quantity) || 1));
    }, 0);
    if (totalCost <= 0) return;

    const newLineItems = formData.lineItems.map((item: any) => {
      if (item.isHeading) return item;
      const cost = parseFloat(item.costPrice) || 0;
      if (cost > 0) {
        const rate = Math.round(cost * (1 + targetMargin / 100) * 100) / 100;
        const itemMargin = targetMargin;
        const qty = parseFloat(item.quantity) || 0;
        const baseAmount = qty * rate;
        const updated: any = { ...item, marginPercent: String(Math.round(itemMargin * 10) / 10), rate, amount: baseAmount };
        if (isTaxDocument) {
          const cgstPercent = parseFloat(item.cgstPercent) || 0;
          const sgstPercent = parseFloat(item.sgstPercent) || 0;
          updated.cgstAmount = baseAmount * (cgstPercent / 100);
          updated.sgstAmount = baseAmount * (sgstPercent / 100);
        }
        return updated;
      }
      return item;
    });
    setFormData((prev: any) => ({ ...prev, lineItems: newLineItems }));
    setHasUnsavedChanges(true);
  };

  const applyTargetTotal = (totalValue: string) => {
    const targetSubtotal = parseFloat(totalValue);
    if (isNaN(targetSubtotal) || targetSubtotal <= 0) return;

    const nonHeadingItems = formData.lineItems.filter((item: any) => !item.isHeading);
    const currentSubtotal = nonHeadingItems.reduce((sum: number, item: any) => {
      return sum + (parseFloat(item.amount) || 0);
    }, 0);
    if (currentSubtotal <= 0) return;

    const totalCost = nonHeadingItems.reduce((sum: number, item: any) => {
      const cost = parseFloat(item.costPrice) || 0;
      const qty = parseFloat(item.quantity) || 1;
      return sum + (cost * qty);
    }, 0);

    const multiplier = targetSubtotal / currentSubtotal;

    const newLineItems = formData.lineItems.map((item: any) => {
      if (item.isHeading) return item;
      const currentRate = parseFloat(item.rate) || 0;
      if (currentRate > 0) {
        const rate = Math.round(currentRate * multiplier * 100) / 100;
        const cost = parseFloat(item.costPrice) || 0;
        const itemMargin = cost > 0 && rate > 0 ? ((rate - cost) / cost) * 100 : 0;
        const qty = parseFloat(item.quantity) || 0;
        const baseAmount = qty * rate;
        const updated: any = { ...item, rate, amount: baseAmount };
        if (cost > 0) {
          updated.marginPercent = String(Math.round(itemMargin * 10) / 10);
        }
        if (isTaxDocument) {
          const cgstPercent = parseFloat(item.cgstPercent) || 0;
          const sgstPercent = parseFloat(item.sgstPercent) || 0;
          updated.cgstAmount = baseAmount * (cgstPercent / 100);
          updated.sgstAmount = baseAmount * (sgstPercent / 100);
        }
        return updated;
      }
      return item;
    });
    setFormData((prev: any) => ({ ...prev, lineItems: newLineItems }));
    setHasUnsavedChanges(true);
    if (totalCost > 0) {
      const impliedMargin = ((targetSubtotal - totalCost) / totalCost) * 100;
      setOverallMarginInput(String(Math.round(impliedMargin * 10) / 10));
    }
  };

  const updateLineItem = (index: number, field: string, value: any) => {
    const newLineItems = [...formData.lineItems];
    newLineItems[index] = { ...newLineItems[index], [field]: value };

    if (field === "costPrice" || field === "marginPercent") {
      const cost = parseFloat(field === "costPrice" ? value : newLineItems[index].costPrice) || 0;
      const margin = parseFloat(field === "marginPercent" ? value : newLineItems[index].marginPercent) || 0;
      if (cost > 0) {
        const calculatedRate = cost * (1 + margin / 100);
        newLineItems[index].rate = Math.round(calculatedRate * 100) / 100;
        const qty = parseFloat(newLineItems[index].quantity) || 0;
        const baseAmount = qty * newLineItems[index].rate;
        newLineItems[index].amount = baseAmount;
        if (isTaxDocument) {
          const cgstPercent = parseFloat(newLineItems[index].cgstPercent) || 0;
          const sgstPercent = parseFloat(newLineItems[index].sgstPercent) || 0;
          newLineItems[index].cgstAmount = baseAmount * (cgstPercent / 100);
          newLineItems[index].sgstAmount = baseAmount * (sgstPercent / 100);
        }
      }
    } else if (field === "rate" && showInternalCosting) {
      const rate = parseFloat(value) || 0;
      const cost = parseFloat(newLineItems[index].costPrice) || 0;
      if (cost > 0 && rate > 0) {
        const backCalcMargin = ((rate - cost) / cost) * 100;
        newLineItems[index].marginPercent = String(Math.round(backCalcMargin * 10) / 10);
      }
      const qty = parseFloat(newLineItems[index].quantity) || 0;
      const baseAmount = qty * rate;
      newLineItems[index].amount = baseAmount;
      if (isTaxDocument) {
        const cgstPercent = parseFloat(newLineItems[index].cgstPercent) || 0;
        const sgstPercent = parseFloat(newLineItems[index].sgstPercent) || 0;
        newLineItems[index].cgstAmount = baseAmount * (cgstPercent / 100);
        newLineItems[index].sgstAmount = baseAmount * (sgstPercent / 100);
      }
    } else if (field === "quantity" || field === "rate" || field === "cgstPercent" || field === "sgstPercent") {
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

    const newData = { ...formData, lineItems: newLineItems };
    setFormData(newData);
    setHasUnsavedChanges(true);
    saveToUndoHistory(newData);
  };

  const addLineItem = (isHeading = false) => {
    const newItem = isHeading
      ? { description: "", isHeading: true }
      : isTaxDocument
        ? { description: "", quantity: 1, rate: 0, amount: 0, isHeading: false, hsnSac: "", cgstPercent: 9, sgstPercent: 9, cgstAmount: 0, sgstAmount: 0 }
        : { description: "", quantity: 1, rate: 0, amount: 0, isHeading: false };
    
    const newData = { ...formData, lineItems: [...formData.lineItems, newItem] };
    setFormData(newData);
    setHasUnsavedChanges(true);
    saveToUndoHistory(newData);
  };

  const removeLineItem = (index: number) => {
    const newLineItems = formData.lineItems.filter((_: any, i: number) => i !== index);
    const newData = { ...formData, lineItems: newLineItems };
    setFormData(newData);
    setHasUnsavedChanges(true);
    saveToUndoHistory(newData);
  };

  const cloneLineItem = (index: number) => {
    const itemToClone = formData.lineItems[index];
    const clonedItem = { ...itemToClone };
    const newLineItems = [...formData.lineItems];
    newLineItems.splice(index + 1, 0, clonedItem);
    const newData = { ...formData, lineItems: newLineItems };
    setFormData(newData);
    setHasUnsavedChanges(true);
    saveToUndoHistory(newData);
  };

  // Insert a new item at a specific position (after the given index)
  const insertLineItemAt = (afterIndex: number, isHeading = false) => {
    const newItem = isHeading
      ? { description: "", isHeading: true }
      : isTaxDocument
        ? { description: "", quantity: 1, rate: 0, amount: 0, isHeading: false, hsnSac: "", cgstPercent: 9, sgstPercent: 9, cgstAmount: 0, sgstAmount: 0 }
        : { description: "", quantity: 1, rate: 0, amount: 0, isHeading: false };
    
    const newLineItems = [...formData.lineItems];
    newLineItems.splice(afterIndex + 1, 0, newItem);
    const newData = { ...formData, lineItems: newLineItems };
    setFormData(newData);
    setHasUnsavedChanges(true);
    saveToUndoHistory(newData);
  };

  // Handle close with confirmation if there are unsaved changes
  // This intercepts all close attempts (outside click, escape, cancel button)
  const handleCloseRequest = (nextOpen: boolean) => {
    if (nextOpen) {
      // Opening - pass through to parent
      onOpenChange(true);
    } else if (hasUnsavedChanges) {
      // Trying to close with unsaved changes - show confirmation
      setShowCloseConfirm(true);
    } else {
      // Closing with no unsaved changes - allow close
      setHasUnsavedChanges(false);
      onOpenChange(false);
    }
  };

  const confirmClose = () => {
    setShowCloseConfirm(false);
    setHasUnsavedChanges(false);
    onOpenChange(false);
  };

  // Drag and drop state and handlers
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    // Add a slight delay to show the drag visual
    setTimeout(() => {
      (e.target as HTMLElement).style.opacity = '0.5';
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent<HTMLTableRowElement>) => {
    (e.target as HTMLElement).style.opacity = '1';
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragOver = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (index !== draggedIndex) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLTableRowElement>, dropIndex: number) => {
    e.preventDefault();
    const dragIndex = draggedIndex;
    
    if (dragIndex === null || dragIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newLineItems = [...formData.lineItems];
    const [draggedItem] = newLineItems.splice(dragIndex, 1);
    // Adjust dropIndex when dragging downward (after splice, indices shift)
    const adjustedDropIndex = dragIndex < dropIndex ? dropIndex - 1 : dropIndex;
    newLineItems.splice(adjustedDropIndex, 0, draggedItem);
    
    setFormData({ ...formData, lineItems: newLineItems });
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleSave = (asDraft: boolean) => {
    if (canViewInternalCosting && !asDraft) {
      const nonHeadingItems = formData.lineItems.filter((item: any) => !item.isHeading && item.description?.trim());
      const pricedItems = nonHeadingItems.filter((item: any) => {
        const rate = parseFloat(item.rate) || 0;
        const qty = parseFloat(item.quantity) || 0;
        return rate > 0 && qty > 0;
      });
      const missingCost = pricedItems.filter((item: any) => !item.costPrice || parseFloat(item.costPrice) <= 0);
      const missingMargin = pricedItems.filter((item: any) => item.marginPercent === undefined || item.marginPercent === "" || parseFloat(item.marginPercent) < 0);
      if (missingCost.length > 0 || missingMargin.length > 0) {
        const messages = [];
        if (missingCost.length > 0) messages.push(`${missingCost.length} item(s) missing cost price`);
        if (missingMargin.length > 0) messages.push(`${missingMargin.length} item(s) missing margin %`);
        toast({
          title: "Internal Costing Required",
          description: `Please complete internal costing before saving. ${messages.join(", ")}.`,
          variant: "destructive",
        });
        return;
      }
    }
    const { subtotal, serviceChargeAmount, discountAmount, cgstTotal, sgstTotal, total } = calculateTotals();
    
    // Transform line items to match backend schema (name/total instead of description/amount)
    // Ensure all numeric values are properly parsed as numbers
    const transformedLineItems = formData.lineItems.map((item: any) => ({
      name: item.description || "",
      quantity: item.quantity !== undefined && item.quantity !== "" ? parseFloat(item.quantity) || 0 : 1,
      rate: parseFloat(item.rate) || 0,
      total: parseFloat(item.amount) || 0,
      isHeading: item.isHeading || false,
      ...(item.isInternalOnly ? { isInternalOnly: true } : {}),
      ...(item.costPrice !== undefined && item.costPrice !== "" ? { costPrice: parseFloat(item.costPrice) || 0 } : {}),
      ...(item.marginPercent !== undefined && item.marginPercent !== "" ? { marginPercent: parseFloat(item.marginPercent) || 0 } : {}),
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
        customerId: contactType === "customer" ? (formData.customerId || null) : null,
        // Note: leadId references the leads table, but we now use sales_deals
        // Don't save leadId to avoid foreign key constraint errors - just save leadName for display
        leadId: null,
        leadName: contactType === "lead" ? (formData.leadName || null) : null,
        eventId: formData.eventId || null,
        // Date is required, ensure it has a value
        date: formData.date || format(new Date(), "yyyy-MM-dd"),
        // Omit expiryDate if empty (don't send null)
        ...(formData.expiryDate ? { expiryDate: formData.expiryDate } : {}),
        lineItems: transformedLineItems,
        isTaxDocument,
        subtotal: subtotal.toFixed(2),
        // Service charge - store the calculated amount and the user's input percentage (applies to both standard and tax estimates)
        serviceChargePercent: String(formData.serviceChargeType === "percent" ? (formData.serviceChargePercent || 0) : 0),
        serviceChargeAmount: serviceChargeAmount.toFixed(2),
        // Discount - store the calculated amount and the user's input percentage (applies to both standard and tax estimates)
        discountPercent: String(formData.discountType === "percent" ? (formData.discountPercent || 0) : 0),
        discountAmount: discountAmount.toFixed(2),
        ...(isTaxDocument ? {
          placeOfSupply: formData.placeOfSupply || "Kerala (32)",
          cgstTotal: cgstTotal.toFixed(2),
          sgstTotal: sgstTotal.toFixed(2),
          taxTotal: (cgstTotal + sgstTotal).toFixed(2),
        } : {}),
        total: total.toFixed(2),
      },
      asDraft,
      sendWhatsAppCopy
    );
    // Reset the checkbox after save
    setSendWhatsAppCopy(false);
    
    if (canViewInternalCosting && showInternalCosting) {
      const costItems = formData.lineItems
        .filter((item: any) => !item.isHeading && item.description && item.costPrice && parseFloat(item.costPrice) > 0)
        .map((item: any) => ({
          itemName: item.description,
          costPrice: String(item.costPrice),
          marginPercent: String(item.marginPercent || "40"),
        }));
      if (costItems.length > 0) {
        apiRequest("POST", "/api/item-cost-templates/bulk-upsert", { items: costItems })
          .then(() => queryClient.invalidateQueries({ queryKey: ["/api/item-cost-templates"] }))
          .catch(() => {});
      }
    }
  };

  const { subtotal, serviceChargeAmount, discountAmount, cgstTotal, sgstTotal, total } = calculateTotals();
  const selectedCustomer = customers.find((c) => c.id === formData.customerId);
  const selectedLead = leads.find((l) => l.id === formData.leadId);
  const selectedEvent = events.find((e) => e.id === formData.eventId);

  return (
    <>
    <Dialog open={open} onOpenChange={handleCloseRequest}>
      <DialogContent className="max-w-[95vw] w-full h-[95vh] max-h-[95vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-3">
            {editingQuote ? "Edit Quote" : "New Quote"}
            <div className="flex items-center gap-1 ml-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleUndo}
                disabled={!canUndo}
                title="Undo (Ctrl+Z)"
                data-testid="button-undo"
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
                data-testid="button-redo"
              >
                <Redo2 className="h-4 w-4" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1 pr-4">

        <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-red-500">Lead Name*</Label>
                {isCreatingLead ? (
                      <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium">New Lead</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => setIsCreatingLead(false)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <Input
                          placeholder="Lead name *"
                          value={newLeadName}
                          onChange={(e) => setNewLeadName(e.target.value)}
                          className="h-8"
                        />
                        <Input
                          placeholder="Phone (optional)"
                          value={newLeadPhone}
                          onChange={(e) => setNewLeadPhone(e.target.value)}
                          className="h-8"
                        />
                        <Input
                          placeholder="Email (optional)"
                          value={newLeadEmail}
                          onChange={(e) => setNewLeadEmail(e.target.value)}
                          className="h-8"
                        />
                        <Button
                          type="button"
                          size="sm"
                          className="w-full h-8"
                          disabled={!newLeadName.trim() || createLeadMutation.isPending}
                          onClick={() => createLeadMutation.mutate({
                            name: newLeadName.trim(),
                            phone: newLeadPhone.trim() || undefined,
                            email: newLeadEmail.trim() || undefined,
                          })}
                        >
                          {createLeadMutation.isPending ? "Creating..." : "Create Lead"}
                        </Button>
                      </div>
                    ) : (
                      <Popover open={leadSearchOpen} onOpenChange={setLeadSearchOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between"
                          >
                            {selectedCustomer?.name || selectedLead?.name || formData.leadName || "Select or add a lead"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0">
                          <Command>
                            <CommandInput placeholder="Search leads..." />
                            <CommandList>
                              <CommandEmpty>No leads found.</CommandEmpty>
                              {customers.length > 0 && (
                                <CommandGroup heading="Customers">
                                  {customers.map((cust) => (
                                    <CommandItem
                                      key={`cust-${cust.id}`}
                                      value={`customer ${cust.name}`}
                                      onSelect={() => {
                                        updateFormData({ customerId: cust.id, leadId: "", leadName: "" });
                                        setContactType("customer");
                                        setLeadSearchOpen(false);
                                      }}
                                    >
                                      <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                                          <span className="text-sm font-medium text-blue-700">
                                            {cust.name.charAt(0).toUpperCase()}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="block">{cust.name}</span>
                                          <span className="text-xs text-muted-foreground">{cust.customerCode || 'Customer'}</span>
                                        </div>
                                      </div>
                                      {formData.customerId === cust.id && (
                                        <Check className="ml-auto h-4 w-4" />
                                      )}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              )}
                              <CommandGroup heading="Leads / Deals">
                                {leads.map((lead) => (
                                  <CommandItem
                                    key={lead.id}
                                    value={`lead ${lead.name}`}
                                    onSelect={() => {
                                      updateFormData({ leadId: lead.id, leadName: lead.name, customerId: "" });
                                      setContactType("lead");
                                      setLeadSearchOpen(false);
                                    }}
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                                        <span className="text-sm font-medium text-amber-700">
                                          {lead.name.charAt(0).toUpperCase()}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="block">{lead.name}</span>
                                        <span className="text-xs text-muted-foreground">{lead.leadCode}</span>
                                      </div>
                                    </div>
                                    {formData.leadId === lead.id && (
                                      <Check className="ml-auto h-4 w-4" />
                                    )}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                              <CommandGroup>
                                <CommandItem
                                  onSelect={() => {
                                    setLeadSearchOpen(false);
                                    setIsCreatingLead(true);
                                  }}
                                  className="text-primary"
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  New Lead
                                </CommandItem>
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    )}
                {/* Display lead address if a lead is selected and has address */}
                {selectedLead?.address && !formData.customerAddress && (
                  <div className="mt-2 p-3 bg-muted/50 rounded-md">
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <span className="whitespace-pre-wrap">{selectedLead.address}</span>
                    </div>
                  </div>
                )}
                
                {/* Editable Address Field */}
                <div className="mt-3">
                  <Label>Event/Billing Address</Label>
                  <Textarea
                    placeholder="Enter event venue or billing address"
                    value={formData.customerAddress || ""}
                    onChange={(e) => updateFormData({ customerAddress: e.target.value })}
                    className="mt-1"
                    rows={3}
                  />
                </div>
                
                {/* Email Address Field */}
                <div className="mt-3">
                  <Label>Email Address</Label>
                  <Input
                    type="email"
                    placeholder="Enter email address"
                    value={formData.customerEmail || ""}
                    onChange={(e) => updateFormData({ customerEmail: e.target.value })}
                    className="mt-1"
                    data-testid="input-estimate-email"
                  />
                </div>
                
                {/* WhatsApp Number Field */}
                <div className="mt-3">
                  <Label>WhatsApp Number</Label>
                  <Input
                    type="tel"
                    placeholder="Enter WhatsApp number (e.g., +91 9876543210)"
                    value={formData.customerWhatsapp || ""}
                    onChange={(e) => updateFormData({ customerWhatsapp: e.target.value })}
                    className="mt-1"
                    data-testid="input-estimate-whatsapp"
                  />
                </div>
              </div>

              {/* Company Brand Selector - Only for Standard (non-tax) documents */}
              {!isTaxDocument && (
                <div className="space-y-2">
                  <Label>Company</Label>
                  <Select
                    value={formData.companyBrand || "oakstreet"}
                    onValueChange={(value) => updateFormData({ companyBrand: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="oakstreet">Default Company</SelectItem>
                      <SelectItem value="meta_events">Meta Events</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

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
                              updateFormData({ eventId: "" });
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
                                updateFormData({ eventId: event.id });
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
                  onChange={(e) => updateFormData({ number: e.target.value })}
                  disabled={user?.role !== 'superadmin'}
                  className={user?.role !== 'superadmin' ? 'bg-muted cursor-not-allowed' : ''}
                />
                {user?.role !== 'superadmin' && (
                  <p className="text-xs text-muted-foreground">Only Superadmin can change quote numbers</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-red-500">Quote Date*</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => updateFormData({ date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Subject</Label>
              <Input
                placeholder="Let your customer know what this Quote is for"
                value={formData.subject}
                onChange={(e) => updateFormData({ subject: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Wedding Planner</Label>
              <Input
                placeholder="Enter wedding planner name (optional)"
                value={formData.weddingPlannerName || ""}
                onChange={(e) => updateFormData({ weddingPlannerName: e.target.value })}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Item Table</h3>
                <div className="flex items-center gap-2">
                  {canViewInternalCosting && (
                    <div
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-amber-600 text-white"
                      data-testid="toggle-internal-costing"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Internal Costing (Mandatory)
                    </div>
                  )}
                  <Button variant="link" size="sm" className="text-primary">
                    Bulk Actions
                  </Button>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr className="text-left text-sm">
                      <th className="p-2 w-8"></th>
                      <th className="p-2 font-medium">ITEM DETAILS</th>
                      {isTaxDocument && <th className="p-2 font-medium text-center w-24">HSN/SAC</th>}
                      {showInternalCosting && (
                        <>
                          <th className="p-2 font-medium text-right w-36 bg-amber-50 text-amber-800 border-l border-amber-200">COST</th>
                          <th className="p-2 font-medium text-center w-24 bg-amber-50 text-amber-800">MARGIN%</th>
                        </>
                      )}
                      <th className="p-2 font-medium text-center w-20">QTY</th>
                      <th className="p-2 font-medium text-right w-36">RATE</th>
                      <th className="p-2 font-medium text-right w-32">AMOUNT</th>
                      {isTaxDocument && (
                        <>
                          <th className="p-2 font-medium text-center w-16">CGST%</th>
                          <th className="p-2 font-medium text-center w-16">SGST%</th>
                          <th className="p-2 font-medium text-right w-20">TAX</th>
                        </>
                      )}
                      <th className="p-2 w-20"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.lineItems.filter((item: any) => !item.isInternalOnly).map((item: any, origIndex: number) => {
                      const index = formData.lineItems.indexOf(item);
                      return (
                      <tr 
                        key={index} 
                        className={cn(
                          "border-t transition-colors",
                          draggedIndex === index && "opacity-50 bg-muted/30",
                          dragOverIndex === index && "bg-primary/10 border-primary border-t-2"
                        )}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, index)}
                      >
                        {item.isHeading ? (
                          <>
                            <td 
                              className="p-2 cursor-grab active:cursor-grabbing"
                              draggable
                              onDragStart={(e) => handleDragStart(e, index)}
                              onDragEnd={handleDragEnd}
                            >
                              <GripVertical className="h-4 w-4 text-muted-foreground" />
                            </td>
                            <td colSpan={isTaxDocument ? (showInternalCosting ? 10 : 8) : (showInternalCosting ? 6 : 4)} className="p-2">
                              <Textarea
                                placeholder="Section heading..."
                                value={item.description}
                                onChange={(e) => {
                                  updateLineItem(index, "description", e.target.value);
                                  setHasUnsavedChanges(true);
                                }}
                                className="font-semibold text-primary bg-primary/5 min-h-[40px] resize-none whitespace-pre-wrap break-words"
                                rows={1}
                                ref={(el) => {
                                  if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
                                }}
                                onInput={(e) => {
                                  const target = e.target as HTMLTextAreaElement;
                                  target.style.height = 'auto';
                                  target.style.height = target.scrollHeight + 'px';
                                }}
                              />
                            </td>
                            <td className="p-2">
                              <div className="flex items-center gap-1">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48">
                                    <DropdownMenuItem onClick={() => cloneLineItem(index)}>
                                      <Copy className="h-4 w-4 mr-2" />
                                      Clone
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => insertLineItemAt(index, false)}>
                                      <Plus className="h-4 w-4 mr-2" />
                                      Insert New Row
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => insertLineItemAt(index, true)}>
                                      <Plus className="h-4 w-4 mr-2" />
                                      Insert New Header
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                      onClick={() => removeLineItem(index)}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td 
                              className="p-2 cursor-grab active:cursor-grabbing"
                              draggable
                              onDragStart={(e) => handleDragStart(e, index)}
                              onDragEnd={handleDragEnd}
                            >
                              <GripVertical className="h-4 w-4 text-muted-foreground" />
                            </td>
                            <td className="p-2">
                              <Textarea
                                placeholder="Type or click to select an item."
                                value={item.description}
                                onChange={(e) => {
                                  updateLineItem(index, "description", e.target.value);
                                  setHasUnsavedChanges(true);
                                }}
                                className="min-h-[40px] resize-none whitespace-pre-wrap break-words"
                                rows={1}
                                ref={(el) => {
                                  if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
                                }}
                                onInput={(e) => {
                                  const target = e.target as HTMLTextAreaElement;
                                  target.style.height = 'auto';
                                  target.style.height = target.scrollHeight + 'px';
                                }}
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
                            {showInternalCosting && (
                              <>
                                <td className="p-2 bg-amber-50/50 border-l border-amber-200">
                                  <Input
                                    type="number"
                                    placeholder="Cost"
                                    className="text-right w-36 bg-white"
                                    value={item.costPrice ?? ""}
                                    onChange={(e) => updateLineItem(index, "costPrice", e.target.value)}
                                    data-testid={`cost-price-${index}`}
                                  />
                                </td>
                                <td className="p-2 bg-amber-50/50">
                                  <Input
                                    type="number"
                                    placeholder="%"
                                    className="text-center w-24 bg-white"
                                    value={item.marginPercent ?? ""}
                                    onChange={(e) => updateLineItem(index, "marginPercent", e.target.value)}
                                    data-testid={`margin-percent-${index}`}
                                  />
                                </td>
                              </>
                            )}
                            <td className="p-2">
                              <Input
                                type="number"
                                className="text-center"
                                value={item.quantity}
                                onChange={(e) => updateLineItem(index, "quantity", e.target.value)}
                              />
                            </td>
                            <td className="p-2 w-36">
                              <Input
                                type="number"
                                className="text-right w-36"
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
                            <td className="p-2">
                              <div className="flex items-center gap-1">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48">
                                    <DropdownMenuItem onClick={() => cloneLineItem(index)}>
                                      <Copy className="h-4 w-4 mr-2" />
                                      Clone
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => insertLineItemAt(index, false)}>
                                      <Plus className="h-4 w-4 mr-2" />
                                      Insert New Row
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => insertLineItemAt(index, true)}>
                                      <Plus className="h-4 w-4 mr-2" />
                                      Insert New Header
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                      onClick={() => removeLineItem(index)}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Add New Row
                      <ChevronDown className="h-4 w-4 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => addLineItem(false)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Insert New Row
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => addLineItem(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Insert New Header
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {isTaxDocument && (
              <div className="space-y-2">
                <Label>Place of Supply</Label>
                <Select value={formData.placeOfSupply || "Kerala (32)"} onValueChange={(v) => updateFormData({ placeOfSupply: v })}>
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
              <div className="w-96 space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Sub Total</span>
                  <span className="font-medium">₹{subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                {/* Service Charge - available for both standard and tax documents */}
                <div className="flex items-center justify-between text-sm">
                  <span>Service Charge</span>
                  <div className="flex items-center gap-2">
                    <Select 
                      value={formData.serviceChargeType} 
                      onValueChange={(v) => updateFormData({ serviceChargeType: v })}
                    >
                      <SelectTrigger className="w-16 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">%</SelectItem>
                        <SelectItem value="amount">₹</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      className="w-28 h-8 text-right"
                      value={formData.serviceChargeType === "percent" ? formData.serviceChargePercent : formData.serviceChargeAmount}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        if (formData.serviceChargeType === "percent") {
                          updateFormData({ serviceChargePercent: val });
                        } else {
                          updateFormData({ serviceChargeAmount: val });
                        }
                      }}
                    />
                    <span className="w-28 text-right text-green-600">+₹{serviceChargeAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
                {/* Discount - available for both standard and tax documents */}
                <div className="flex items-center justify-between text-sm">
                  <span>Discount</span>
                  <div className="flex items-center gap-2">
                    <Select 
                      value={formData.discountType} 
                      onValueChange={(v) => updateFormData({ discountType: v })}
                    >
                      <SelectTrigger className="w-16 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">%</SelectItem>
                        <SelectItem value="amount">₹</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      className="w-20 h-8 text-right"
                      value={formData.discountType === "percent" ? formData.discountPercent : formData.discountAmount}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        if (formData.discountType === "percent") {
                          updateFormData({ discountPercent: val });
                        } else {
                          updateFormData({ discountAmount: val });
                        }
                      }}
                    />
                    <span className="w-28 text-right text-red-600">-₹{discountAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
                {isTaxDocument && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span>CGST</span>
                      <span className="font-medium">₹{cgstTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>SGST</span>
                      <span className="font-medium">₹{sgstTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between font-semibold text-lg border-t pt-2">
                  <span>Total</span>
                  <span>₹{total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {showInternalCosting && (() => {
              const regularCostItems = formData.lineItems.filter((item: any) => !item.isHeading && !item.isInternalOnly && parseFloat(item.costPrice) > 0);
              const internalOnlyItems = formData.lineItems.filter((item: any) => item.isInternalOnly);
              const regularCost = regularCostItems.reduce((sum: number, item: any) => {
                return sum + ((parseFloat(item.costPrice) || 0) * (parseFloat(item.quantity) || 1));
              }, 0);
              const internalOnlyCost = internalOnlyItems.reduce((sum: number, item: any) => {
                return sum + (parseFloat(item.amount) || 0);
              }, 0);
              const totalCost = regularCost + internalOnlyCost;
              const totalCustomerPrice = regularCostItems.reduce((sum: number, item: any) => {
                return sum + (parseFloat(item.amount) || 0);
              }, 0);
              const totalProfit = totalCustomerPrice - totalCost;
              const overallMargin = totalCost > 0 ? ((totalProfit / totalCost) * 100) : 0;

              const addInternalCostItem = () => {
                const newItem = { description: "", quantity: 1, rate: 0, amount: 0, costPrice: 0, isHeading: false, isInternalOnly: true };
                const newData = { ...formData, lineItems: [...formData.lineItems, newItem] };
                setFormData(newData);
                setHasUnsavedChanges(true);
                saveToUndoHistory(newData);
              };

              const updateInternalItem = (internalIdx: number, field: string, value: any) => {
                const allInternalIndices = formData.lineItems.reduce((acc: number[], item: any, i: number) => {
                  if (item.isInternalOnly) acc.push(i);
                  return acc;
                }, []);
                const realIndex = allInternalIndices[internalIdx];
                if (realIndex === undefined) return;
                const newLineItems = [...formData.lineItems];
                newLineItems[realIndex] = { ...newLineItems[realIndex], [field]: value };
                if (field === "costPrice" || field === "quantity") {
                  const cost = parseFloat(field === "costPrice" ? value : newLineItems[realIndex].costPrice) || 0;
                  const qty = parseFloat(field === "quantity" ? value : newLineItems[realIndex].quantity) || 1;
                  newLineItems[realIndex].amount = cost * qty;
                  newLineItems[realIndex].rate = cost;
                }
                const newData = { ...formData, lineItems: newLineItems };
                setFormData(newData);
                setHasUnsavedChanges(true);
                saveToUndoHistory(newData);
              };

              const removeInternalItem = (internalIdx: number) => {
                const allInternalIndices = formData.lineItems.reduce((acc: number[], item: any, i: number) => {
                  if (item.isInternalOnly) acc.push(i);
                  return acc;
                }, []);
                const realIndex = allInternalIndices[internalIdx];
                if (realIndex === undefined) return;
                const newLineItems = formData.lineItems.filter((_: any, i: number) => i !== realIndex);
                const newData = { ...formData, lineItems: newLineItems };
                setFormData(newData);
                setHasUnsavedChanges(true);
                saveToUndoHistory(newData);
              };
              
              return totalCost > 0 || internalOnlyItems.length > 0 ? (
                <div className="border border-amber-200 rounded-lg bg-amber-50/50 p-4 space-y-2" data-testid="internal-costing-summary">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="h-4 w-4 text-amber-700" />
                    <h4 className="font-semibold text-amber-800 text-sm">Internal Costing Summary</h4>
                    <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800 border-amber-300">Confidential</Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground block">Total Cost</span>
                      <span className="font-semibold text-red-600">₹{totalCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                      {internalOnlyCost > 0 && (
                        <span className="text-[10px] text-amber-600 block">(incl. ₹{internalOnlyCost.toLocaleString("en-IN")} additional)</span>
                      )}
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Customer Price</span>
                      <span className="font-semibold">₹{totalCustomerPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Profit</span>
                      <span className={cn("font-semibold", totalProfit >= 0 ? "text-green-600" : "text-red-600")}>
                        ₹{totalProfit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Overall Margin</span>
                      <span className={cn("font-semibold", overallMargin >= 0 ? "text-green-600" : "text-red-600")}>
                        {overallMargin.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {internalOnlyItems.length > 0 && (
                    <div className="border-t border-amber-200 pt-3 mt-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-amber-800">Additional Internal Costs</span>
                      </div>
                      <div className="space-y-1.5">
                        {internalOnlyItems.map((item: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-2 text-xs" data-testid={`internal-cost-item-${idx}`}>
                            <Input
                              className="flex-1 h-7 text-xs bg-white border-amber-300"
                              placeholder="Cost item description"
                              value={item.description || ""}
                              onChange={(e) => updateInternalItem(idx, "description", e.target.value)}
                            />
                            <Input
                              type="number"
                              className="w-16 h-7 text-xs text-center bg-white border-amber-300"
                              placeholder="Qty"
                              value={item.quantity || 1}
                              onChange={(e) => updateInternalItem(idx, "quantity", e.target.value)}
                            />
                            <span className="text-amber-700">×</span>
                            <div className="flex items-center gap-0.5">
                              <span className="text-amber-700">₹</span>
                              <Input
                                type="number"
                                className="w-24 h-7 text-xs text-right bg-white border-amber-300"
                                placeholder="Cost"
                                value={item.costPrice || ""}
                                onChange={(e) => updateInternalItem(idx, "costPrice", e.target.value)}
                              />
                            </div>
                            <span className="text-amber-700 font-medium w-24 text-right">
                              = ₹{(parseFloat(item.amount) || 0).toLocaleString("en-IN")}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-400 hover:text-red-600"
                              onClick={() => removeInternalItem(idx)}
                              data-testid={`btn-remove-internal-cost-${idx}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border-t border-amber-200 pt-3 mt-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs border-amber-400 text-amber-800 hover:bg-amber-100 mb-3"
                      onClick={addInternalCostItem}
                      data-testid="btn-add-internal-cost"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add Internal Cost Item
                    </Button>
                  </div>

                  <div className="border-t border-amber-200 pt-3 mt-3 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2" data-testid="overall-margin-control">
                      <span className="text-xs text-amber-800 font-medium whitespace-nowrap">Target Margin:</span>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          className="w-20 h-8 text-sm text-center bg-white border-amber-300"
                          value={overallMarginInput}
                          onChange={(e) => setOverallMarginInput(e.target.value)}
                          placeholder="40"
                          data-testid="input-overall-margin"
                        />
                        <span className="text-xs text-amber-700">%</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs px-3 border-amber-400 text-amber-800 hover:bg-amber-100"
                          onClick={() => applyOverallMargin(overallMarginInput)}
                          data-testid="button-apply-overall-margin"
                        >
                          Apply
                        </Button>
                      </div>
                      <span className="text-[11px] text-amber-600 hidden sm:inline">Auto-distributes margin across items</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2" data-testid="target-total-control">
                      <span className="text-xs text-amber-800 font-medium whitespace-nowrap">Target Subtotal:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-amber-700">₹</span>
                        <Input
                          type="number"
                          className="w-32 h-8 text-sm text-right bg-white border-amber-300"
                          value={targetTotalInput}
                          onChange={(e) => setTargetTotalInput(e.target.value)}
                          placeholder="e.g. 300000"
                          data-testid="input-target-total"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs px-3 border-amber-400 text-amber-800 hover:bg-amber-100"
                          onClick={() => applyTargetTotal(targetTotalInput)}
                          data-testid="button-apply-target-total"
                        >
                          Apply
                        </Button>
                      </div>
                      <span className="text-[11px] text-amber-600 hidden sm:inline">Adjusts item rates so subtotal matches this amount</span>
                    </div>
                    <p className="text-[11px] text-amber-600 sm:hidden">Sets margin or budget target. Items remain individually editable.</p>
                  </div>
                </div>
              ) : null;
            })()}

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Customer notes..."
                value={formData.notes}
                onChange={(e) => updateFormData({ notes: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Terms & Conditions</Label>
              <Textarea
                placeholder="Enter terms and conditions..."
                value={formData.terms}
                onChange={(e) => updateFormData({ terms: e.target.value })}
                rows={4}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex-shrink-0 border-t pt-4 mt-4">
          {!editingQuote && (
            <div className="flex items-center gap-2 mr-auto">
              <input
                type="checkbox"
                id="sendWhatsAppCopy"
                checked={sendWhatsAppCopy}
                onChange={(e) => setSendWhatsAppCopy(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="sendWhatsAppCopy" className="text-sm text-muted-foreground cursor-pointer">
                Send me a WhatsApp copy
              </label>
            </div>
          )}
          <Button variant="outline" onClick={() => handleSave(true)} disabled={isPending}>
            Save as Draft
          </Button>
          <Button onClick={() => handleSave(false)} disabled={isPending}>
            {isPending ? "Saving..." : "Save and Send"}
          </Button>
          <Button variant="ghost" onClick={() => handleCloseRequest(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Confirmation dialog for unsaved changes */}
    <Dialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Unsaved Changes</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground">
          You have unsaved changes. Are you sure you want to close without saving?
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowCloseConfirm(false)}>
            Continue Editing
          </Button>
          <Button variant="destructive" onClick={confirmClose}>
            Discard Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
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

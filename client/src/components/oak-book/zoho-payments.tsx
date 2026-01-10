import { useState, useMemo } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
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
  CreditCard,
  Clock,
  User,
  Receipt,
  Banknote,
  Building2,
  Check,
  ChevronsUpDown
} from "lucide-react";

type Payment = {
  id: string;
  number: string;
  customerId: string | null;
  invoiceId: string | null;
  eventId: string | null;
  amount: string;
  date: string;
  paymentMode: string;
  bankId: string | null;
  reference: string | null;
  notes: string | null;
  createdAt: string;
};

type Customer = {
  id: string;
  name: string;
};

type Invoice = {
  id: string;
  number: string;
  total: string;
  balanceDue: string;
};

type Bank = {
  id: string;
  name: string;
};

const PAYMENT_MODES = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
];

export function ZohoPayments() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [modeFilter, setModeFilter] = useState<string>("all");

  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ["/api/customer-payments"],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const { data: banks = [] } = useQuery<Bank[]>({
    queryKey: ["/api/banks"],
  });

  const filteredPayments = useMemo(() => {
    let filtered = payments;

    if (modeFilter !== "all") {
      filtered = filtered.filter((p) => p.paymentMode === modeFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.number.toLowerCase().includes(query) ||
          customers.find((c) => c.id === p.customerId)?.name.toLowerCase().includes(query)
      );
    }

    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [payments, modeFilter, searchQuery, customers]);

  const selectedPayment = useMemo(
    () => payments.find((p) => p.id === selectedPaymentId),
    [payments, selectedPaymentId]
  );

  const createPayment = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/customer-payments", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer-payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/daybook"] });
      queryClient.invalidateQueries({ queryKey: ["/api/banks"] });
      setIsCreateModalOpen(false);
      setEditingPayment(null);
      toast({ title: "Payment Recorded", description: "Payment has been saved and added to daybook." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deletePayment = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/customer-payments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer-payments"] });
      setSelectedPaymentId(null);
      toast({ title: "Payment Deleted", description: "Payment has been deleted." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const getCustomerName = (customerId: string | null) => {
    if (!customerId) return "—";
    return customers.find((c) => c.id === customerId)?.name || "Unknown";
  };

  const getPaymentModeBadge = (mode: string) => {
    const colors: Record<string, string> = {
      cash: "bg-green-50 text-green-700 border-green-200",
      bank_transfer: "bg-blue-50 text-blue-700 border-blue-200",
      cheque: "bg-purple-50 text-purple-700 border-purple-200",
      upi: "bg-orange-50 text-orange-700 border-orange-200",
      card: "bg-pink-50 text-pink-700 border-pink-200",
    };
    const label = PAYMENT_MODES.find((m) => m.value === mode)?.label || mode;
    return (
      <Badge variant="outline" className={cn("font-medium", colors[mode] || "bg-gray-50")}>
        {label}
      </Badge>
    );
  };

  return (
    <div className="flex h-full">
      <div className={cn("flex-1 flex flex-col transition-all duration-300", selectedPayment ? "mr-[480px]" : "")}>
        <div className="flex items-center justify-between p-4 border-b bg-white">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-800">Payments Received</h2>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                  <Filter className="h-4 w-4 mr-2" />
                  {modeFilter === "all" ? "All Modes" : PAYMENT_MODES.find((m) => m.value === modeFilter)?.label}
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setModeFilter("all")}>All Modes</DropdownMenuItem>
                <DropdownMenuSeparator />
                {PAYMENT_MODES.map((mode) => (
                  <DropdownMenuItem key={mode.value} onClick={() => setModeFilter(mode.value)}>
                    {mode.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search payments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64 h-9"
              />
            </div>
            <Button
              onClick={() => {
                setEditingPayment(null);
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
                <th className="p-3 font-medium">PAYMENT#</th>
                <th className="p-3 font-medium">CUSTOMER NAME</th>
                <th className="p-3 font-medium">MODE</th>
                <th className="p-3 font-medium text-right">AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    <CreditCard className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>No payments found</p>
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => (
                  <tr
                    key={payment.id}
                    onClick={() => setSelectedPaymentId(payment.id)}
                    className={cn(
                      "border-b border-gray-100 cursor-pointer hover:bg-blue-50/50 transition-colors",
                      selectedPaymentId === payment.id && "bg-blue-50"
                    )}
                  >
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox />
                    </td>
                    <td className="p-3 text-sm text-gray-700">
                      {format(new Date(payment.date), "dd MMM yyyy")}
                    </td>
                    <td className="p-3">
                      <span className="text-blue-600 hover:underline font-medium">{payment.number}</span>
                    </td>
                    <td className="p-3 text-sm text-gray-700">{getCustomerName(payment.customerId)}</td>
                    <td className="p-3">{getPaymentModeBadge(payment.paymentMode)}</td>
                    <td className="p-3 text-sm text-right font-medium text-green-600">
                      ₹{parseFloat(payment.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3 border-t bg-white text-sm text-gray-500">
          Showing {filteredPayments.length} payment{filteredPayments.length !== 1 ? "s" : ""}
        </div>
      </div>

      {selectedPayment && (
        <PaymentDetailPanel
          payment={selectedPayment}
          customer={customers.find((c) => c.id === selectedPayment.customerId)}
          invoice={invoices.find((i) => i.id === selectedPayment.invoiceId)}
          bank={banks.find((b) => b.id === selectedPayment.bankId)}
          onClose={() => setSelectedPaymentId(null)}
          onDelete={() => deletePayment.mutate(selectedPayment.id)}
        />
      )}

      <PaymentFormModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingPayment(null);
        }}
        customers={customers}
        invoices={invoices}
        banks={banks}
        onSubmit={(data) => createPayment.mutate(data)}
        isSubmitting={createPayment.isPending}
      />
    </div>
  );
}

function PaymentDetailPanel({
  payment,
  customer,
  invoice,
  bank,
  onClose,
  onDelete,
}: {
  payment: Payment;
  customer?: Customer;
  invoice?: Invoice;
  bank?: Bank;
  onClose: () => void;
  onDelete: () => void;
}) {
  const modeLabel = PAYMENT_MODES.find((m) => m.value === payment.paymentMode)?.label || payment.paymentMode;

  return (
    <div className="fixed right-0 top-0 h-full w-[480px] bg-white border-l shadow-lg flex flex-col z-50">
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{payment.number}</h3>
              <p className="text-sm text-gray-500">{customer?.name || "No customer"}</p>
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

      <div className="p-4 bg-green-50 border-b border-green-100">
        <p className="text-xs text-green-600 uppercase font-medium">Amount Received</p>
        <p className="text-2xl font-bold text-green-700">
          ₹{parseFloat(payment.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase mb-1">Payment Date</p>
              <p className="text-sm font-medium">{format(new Date(payment.date), "dd MMM yyyy")}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase mb-1">Payment Mode</p>
              <p className="text-sm font-medium">{modeLabel}</p>
            </div>
          </div>

          {customer && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 uppercase mb-2">Customer</p>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium">{customer.name}</span>
              </div>
            </div>
          )}

          {invoice && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 uppercase mb-2">Applied to Invoice</p>
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium">{invoice.number}</span>
              </div>
            </div>
          )}

          {bank && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 uppercase mb-2">Deposited To</p>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium">{bank.name}</span>
              </div>
            </div>
          )}

          {payment.reference && (
            <div>
              <p className="text-xs text-gray-500 uppercase mb-1">Reference#</p>
              <p className="text-sm text-gray-700">{payment.reference}</p>
            </div>
          )}

          {payment.notes && (
            <div>
              <p className="text-xs text-gray-500 uppercase mb-1">Notes</p>
              <p className="text-sm text-gray-700">{payment.notes}</p>
            </div>
          )}

          <div>
            <p className="text-xs text-gray-500 uppercase mb-2">Created</p>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="h-4 w-4" />
              {payment.createdAt ? format(new Date(payment.createdAt), "dd MMM yyyy 'at' hh:mm a") : "—"}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

function PaymentFormModal({
  isOpen,
  onClose,
  customers,
  invoices,
  banks,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  invoices: Invoice[];
  banks: Bank[];
  onSubmit: (data: any) => void;
  isSubmitting: boolean;
}) {
  const [formData, setFormData] = useState({
    customerId: "",
    invoiceId: "",
    amount: "",
    date: format(new Date(), "yyyy-MM-dd"),
    paymentMode: "bank_transfer",
    bankId: "",
    reference: "",
    notes: "",
  });
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");

  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers;
    const query = customerSearch.toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(query));
  }, [customers, customerSearch]);

  const selectedCustomer = customers.find(c => c.id === formData.customerId);

  const handleSubmit = () => {
    onSubmit(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>Customer *</Label>
            <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={customerSearchOpen}
                  className="w-full justify-between mt-1 font-normal"
                  data-testid="select-customer"
                >
                  {selectedCustomer ? selectedCustomer.name : "Search and select customer..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput 
                    placeholder="Search customers..." 
                    value={customerSearch}
                    onValueChange={setCustomerSearch}
                  />
                  <CommandList>
                    <CommandEmpty>No customer found.</CommandEmpty>
                    <CommandGroup className="max-h-[200px] overflow-y-auto">
                      {filteredCustomers.map((customer) => (
                        <CommandItem
                          key={customer.id}
                          value={customer.id}
                          onSelect={() => {
                            setFormData({ ...formData, customerId: customer.id });
                            setCustomerSearchOpen(false);
                            setCustomerSearch("");
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              formData.customerId === customer.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <User className="mr-2 h-4 w-4 text-muted-foreground" />
                          {customer.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
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
              <Label>Payment Date *</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Payment Mode *</Label>
              <Select
                value={formData.paymentMode}
                onValueChange={(value) => setFormData({ ...formData, paymentMode: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_MODES.map((mode) => (
                    <SelectItem key={mode.value} value={mode.value}>
                      {mode.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Deposit To</Label>
              <Select
                value={formData.bankId}
                onValueChange={(value) => setFormData({ ...formData, bankId: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select bank" />
                </SelectTrigger>
                <SelectContent>
                  {banks.map((bank) => (
                    <SelectItem key={bank.id} value={bank.id}>
                      {bank.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Apply to Invoice</Label>
            <Select
              value={formData.invoiceId}
              onValueChange={(value) => setFormData({ ...formData, invoiceId: value })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select invoice (optional)" />
              </SelectTrigger>
              <SelectContent>
                {invoices.map((invoice) => (
                  <SelectItem key={invoice.id} value={invoice.id}>
                    {invoice.number} - ₹{parseFloat(invoice.balanceDue).toLocaleString("en-IN")} due
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
              placeholder="Transaction ID, cheque number, etc."
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
            disabled={isSubmitting || !formData.customerId || !formData.amount}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  FileText, 
  Receipt, 
  CreditCard, 
  Users, 
  Building2, 
  ShoppingCart,
  Trash2,
  ArrowRight,
  IndianRupee,
  X
} from "lucide-react";

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  gstNumber: string | null;
  billingAddress: string | null;
};

type Vendor = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  gstNumber: string | null;
  category: string | null;
  billingAddress: string | null;
};

type LineItem = {
  name: string;
  description?: string;
  quantity: number;
  rate: number;
  taxRate?: number;
  total: number;
};

type Estimate = {
  id: string;
  number: string;
  customerId: string | null;
  eventId: string | null;
  date: string;
  dueDate: string | null;
  status: string;
  lineItems: LineItem[];
  subtotal: string;
  taxTotal: string;
  total: string;
  notes: string | null;
  terms: string | null;
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
  lineItems: LineItem[];
  subtotal: string;
  taxTotal: string;
  total: string;
  balanceDue: string;
  notes: string | null;
  terms: string | null;
};

type CustomerPayment = {
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
};

type Expense = {
  id: string;
  number: string;
  vendorId: string | null;
  eventId: string | null;
  category: string;
  description: string;
  amount: string;
  taxAmount: string;
  total: string;
  date: string;
  status: string;
  bankId: string | null;
};

type VendorPayment = {
  id: string;
  number: string;
  vendorId: string | null;
  expenseId: string | null;
  eventId: string | null;
  amount: string;
  date: string;
  paymentMode: string;
  bankId: string | null;
  reference: string | null;
  notes: string | null;
};

type Event = {
  id: string;
  title: string;
  customer: string;
  date: string;
};

type Bank = {
  id: string;
  name: string;
  balance: string;
};

const EXPENSE_CATEGORIES = [
  "Catering",
  "Decoration",
  "Photography",
  "Videography",
  "Venue",
  "Entertainment",
  "Travel",
  "Accommodation",
  "Printing",
  "Flowers",
  "Rentals",
  "Staff",
  "Other"
];

const PAYMENT_MODES = [
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "cheque", label: "Cheque" },
  { value: "card", label: "Card" },
];

export default function OakBook() {
  const [activeTab, setActiveTab] = useState("sales");
  const [salesSubTab, setSalesSubTab] = useState("estimates");
  const [purchaseSubTab, setPurchaseSubTab] = useState("vendors");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const { data: estimates = [] } = useQuery<Estimate[]>({
    queryKey: ["/api/estimates"],
  });

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const { data: customerPayments = [] } = useQuery<CustomerPayment[]>({
    queryKey: ["/api/customer-payments"],
  });

  const { data: expenses = [] } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  const { data: vendorPayments = [] } = useQuery<VendorPayment[]>({
    queryKey: ["/api/vendor-payments"],
  });

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const { data: banks = [] } = useQuery<Bank[]>({
    queryKey: ["/api/banks"],
  });

  const getCustomerName = (id: string | null) => {
    if (!id) return "—";
    const customer = customers.find(c => c.id === id);
    return customer?.name || "—";
  };

  const getVendorName = (id: string | null) => {
    if (!id) return "—";
    const vendor = vendors.find(v => v.id === id);
    return vendor?.name || "—";
  };

  const getEventTitle = (id: string | null) => {
    if (!id) return "—";
    const event = events.find(e => e.id === id);
    return event?.title || "—";
  };

  const getBankName = (id: string | null) => {
    if (!id) return "—";
    const bank = banks.find(b => b.id === id);
    return bank?.name || "—";
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(num);
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-gray-100 text-gray-800",
      sent: "bg-blue-100 text-blue-800",
      accepted: "bg-green-100 text-green-800",
      declined: "bg-red-100 text-red-800",
      converted: "bg-purple-100 text-purple-800",
      partial: "bg-yellow-100 text-yellow-800",
      paid: "bg-green-100 text-green-800",
      overdue: "bg-red-100 text-red-800",
      recorded: "bg-gray-100 text-gray-800",
    };
    return <Badge className={colors[status] || "bg-gray-100"}>{status}</Badge>;
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl sm:text-3xl font-bold font-serif text-primary">Oak Book</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="sales" className="gap-2">
            <Receipt className="h-4 w-4" />
            Sales
          </TabsTrigger>
          <TabsTrigger value="purchases" className="gap-2">
            <ShoppingCart className="h-4 w-4" />
            Purchases
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="mt-4">
          <SalesSection 
            subTab={salesSubTab}
            setSubTab={setSalesSubTab}
            customers={customers}
            estimates={estimates}
            invoices={invoices}
            customerPayments={customerPayments}
            events={events}
            banks={banks}
            getCustomerName={getCustomerName}
            getEventTitle={getEventTitle}
            getBankName={getBankName}
            formatCurrency={formatCurrency}
            getStatusBadge={getStatusBadge}
            queryClient={queryClient}
            toast={toast}
          />
        </TabsContent>

        <TabsContent value="purchases" className="mt-4">
          <PurchaseSection
            subTab={purchaseSubTab}
            setSubTab={setPurchaseSubTab}
            vendors={vendors}
            expenses={expenses}
            vendorPayments={vendorPayments}
            events={events}
            banks={banks}
            getVendorName={getVendorName}
            getEventTitle={getEventTitle}
            getBankName={getBankName}
            formatCurrency={formatCurrency}
            getStatusBadge={getStatusBadge}
            queryClient={queryClient}
            toast={toast}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SalesSection({ 
  subTab, 
  setSubTab, 
  customers, 
  estimates, 
  invoices, 
  customerPayments,
  events,
  banks,
  getCustomerName,
  getEventTitle,
  getBankName,
  formatCurrency,
  getStatusBadge,
  queryClient,
  toast,
}: any) {
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [estimateDialogOpen, setEstimateDialogOpen] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  return (
    <div className="space-y-4">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="flex flex-wrap gap-1">
          <TabsTrigger value="customers" className="gap-1 text-xs sm:text-sm">
            <Users className="h-3 w-3 sm:h-4 sm:w-4" />
            Customers
          </TabsTrigger>
          <TabsTrigger value="estimates" className="gap-1 text-xs sm:text-sm">
            <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
            Estimates
          </TabsTrigger>
          <TabsTrigger value="invoices" className="gap-1 text-xs sm:text-sm">
            <Receipt className="h-3 w-3 sm:h-4 sm:w-4" />
            Invoices
          </TabsTrigger>
          <TabsTrigger value="receipts" className="gap-1 text-xs sm:text-sm">
            <CreditCard className="h-3 w-3 sm:h-4 sm:w-4" />
            Receipts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="customers" className="mt-4">
          <CustomersTab 
            customers={customers} 
            dialogOpen={customerDialogOpen}
            setDialogOpen={setCustomerDialogOpen}
            queryClient={queryClient}
            toast={toast}
          />
        </TabsContent>

        <TabsContent value="estimates" className="mt-4">
          <EstimatesTab
            estimates={estimates}
            customers={customers}
            events={events}
            dialogOpen={estimateDialogOpen}
            setDialogOpen={setEstimateDialogOpen}
            getCustomerName={getCustomerName}
            getEventTitle={getEventTitle}
            formatCurrency={formatCurrency}
            getStatusBadge={getStatusBadge}
            queryClient={queryClient}
            toast={toast}
          />
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <InvoicesTab
            invoices={invoices}
            customers={customers}
            events={events}
            dialogOpen={invoiceDialogOpen}
            setDialogOpen={setInvoiceDialogOpen}
            getCustomerName={getCustomerName}
            getEventTitle={getEventTitle}
            formatCurrency={formatCurrency}
            getStatusBadge={getStatusBadge}
            queryClient={queryClient}
            toast={toast}
          />
        </TabsContent>

        <TabsContent value="receipts" className="mt-4">
          <ReceiptsTab
            payments={customerPayments}
            customers={customers}
            invoices={invoices}
            events={events}
            banks={banks}
            dialogOpen={paymentDialogOpen}
            setDialogOpen={setPaymentDialogOpen}
            getCustomerName={getCustomerName}
            getEventTitle={getEventTitle}
            getBankName={getBankName}
            formatCurrency={formatCurrency}
            queryClient={queryClient}
            toast={toast}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PurchaseSection({
  subTab,
  setSubTab,
  vendors,
  expenses,
  vendorPayments,
  events,
  banks,
  getVendorName,
  getEventTitle,
  getBankName,
  formatCurrency,
  getStatusBadge,
  queryClient,
  toast,
}: any) {
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  return (
    <div className="space-y-4">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="flex flex-wrap gap-1">
          <TabsTrigger value="vendors" className="gap-1 text-xs sm:text-sm">
            <Building2 className="h-3 w-3 sm:h-4 sm:w-4" />
            Vendors
          </TabsTrigger>
          <TabsTrigger value="expenses" className="gap-1 text-xs sm:text-sm">
            <ShoppingCart className="h-3 w-3 sm:h-4 sm:w-4" />
            Expenses
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-1 text-xs sm:text-sm">
            <CreditCard className="h-3 w-3 sm:h-4 sm:w-4" />
            Vendor Payments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="vendors" className="mt-4">
          <VendorsTab
            vendors={vendors}
            dialogOpen={vendorDialogOpen}
            setDialogOpen={setVendorDialogOpen}
            queryClient={queryClient}
            toast={toast}
          />
        </TabsContent>

        <TabsContent value="expenses" className="mt-4">
          <ExpensesTab
            expenses={expenses}
            vendors={vendors}
            events={events}
            banks={banks}
            dialogOpen={expenseDialogOpen}
            setDialogOpen={setExpenseDialogOpen}
            getVendorName={getVendorName}
            getEventTitle={getEventTitle}
            getBankName={getBankName}
            formatCurrency={formatCurrency}
            getStatusBadge={getStatusBadge}
            queryClient={queryClient}
            toast={toast}
          />
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <VendorPaymentsTab
            payments={vendorPayments}
            vendors={vendors}
            expenses={expenses}
            events={events}
            banks={banks}
            dialogOpen={paymentDialogOpen}
            setDialogOpen={setPaymentDialogOpen}
            getVendorName={getVendorName}
            getEventTitle={getEventTitle}
            getBankName={getBankName}
            formatCurrency={formatCurrency}
            queryClient={queryClient}
            toast={toast}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CustomersTab({ customers, dialogOpen, setDialogOpen, queryClient, toast }: any) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    gstNumber: "",
    billingAddress: "",
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create customer");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setDialogOpen(false);
      setFormData({ name: "", email: "", phone: "", gstNumber: "", billingAddress: "" });
      toast({ title: "Customer created successfully" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete customer");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: "Customer deleted" });
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Customers</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1">
              <Plus className="h-4 w-4" /> Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Customer</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(formData); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>GST Number</Label>
                <Input value={formData.gstNumber} onChange={(e) => setFormData({...formData, gstNumber: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Billing Address</Label>
                <Textarea value={formData.billingAddress} onChange={(e) => setFormData({...formData, billingAddress: e.target.value})} />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Customer"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {customers.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No customers yet. Add your first customer.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Name</th>
                  <th className="text-left py-2 px-2 hidden sm:table-cell">Email</th>
                  <th className="text-left py-2 px-2 hidden sm:table-cell">Phone</th>
                  <th className="text-left py-2 px-2 hidden md:table-cell">GST</th>
                  <th className="py-2 px-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer: Customer) => (
                  <tr key={customer.id} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-2 font-medium">{customer.name}</td>
                    <td className="py-2 px-2 hidden sm:table-cell">{customer.email || "—"}</td>
                    <td className="py-2 px-2 hidden sm:table-cell">{customer.phone || "—"}</td>
                    <td className="py-2 px-2 hidden md:table-cell">{customer.gstNumber || "—"}</td>
                    <td className="py-2 px-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteMutation.mutate(customer.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function VendorsTab({ vendors, dialogOpen, setDialogOpen, queryClient, toast }: any) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    gstNumber: "",
    category: "",
    billingAddress: "",
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create vendor");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      setDialogOpen(false);
      setFormData({ name: "", email: "", phone: "", gstNumber: "", category: "", billingAddress: "" });
      toast({ title: "Vendor created successfully" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/vendors/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete vendor");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      toast({ title: "Vendor deleted" });
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Vendors</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1">
              <Plus className="h-4 w-4" /> Add Vendor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Vendor</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(formData); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>GST Number</Label>
                  <Input value={formData.gstNumber} onChange={(e) => setFormData({...formData, gstNumber: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Billing Address</Label>
                <Textarea value={formData.billingAddress} onChange={(e) => setFormData({...formData, billingAddress: e.target.value})} />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Vendor"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {vendors.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No vendors yet. Add your first vendor.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Name</th>
                  <th className="text-left py-2 px-2 hidden sm:table-cell">Category</th>
                  <th className="text-left py-2 px-2 hidden sm:table-cell">Phone</th>
                  <th className="text-left py-2 px-2 hidden md:table-cell">GST</th>
                  <th className="py-2 px-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((vendor: Vendor) => (
                  <tr key={vendor.id} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-2 font-medium">{vendor.name}</td>
                    <td className="py-2 px-2 hidden sm:table-cell">{vendor.category || "—"}</td>
                    <td className="py-2 px-2 hidden sm:table-cell">{vendor.phone || "—"}</td>
                    <td className="py-2 px-2 hidden md:table-cell">{vendor.gstNumber || "—"}</td>
                    <td className="py-2 px-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteMutation.mutate(vendor.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EstimatesTab({ estimates, customers, events, dialogOpen, setDialogOpen, getCustomerName, getEventTitle, formatCurrency, getStatusBadge, queryClient, toast }: any) {
  const [formData, setFormData] = useState({
    customerId: "",
    eventId: "",
    date: new Date().toISOString().split('T')[0],
    dueDate: "",
    notes: "",
    terms: "",
  });
  const [lineItems, setLineItems] = useState<LineItem[]>([{ name: "", quantity: 1, rate: 0, taxRate: 0, total: 0 }]);

  const addLineItem = () => {
    setLineItems([...lineItems, { name: "", quantity: 1, rate: 0, taxRate: 0, total: 0 }]);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: string, value: any) => {
    const updated = [...lineItems];
    (updated[index] as any)[field] = value;
    const item = updated[index];
    item.total = item.quantity * item.rate * (1 + (item.taxRate || 0) / 100);
    setLineItems(updated);
  };

  const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
  const taxTotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.rate * (item.taxRate || 0) / 100), 0);
  const total = subtotal + taxTotal;

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const numRes = await fetch("/api/estimates/next-number");
      const { number } = await numRes.json();
      const res = await fetch("/api/estimates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, number }),
      });
      if (!res.ok) throw new Error("Failed to create estimate");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/estimates"] });
      setDialogOpen(false);
      setFormData({ customerId: "", eventId: "", date: new Date().toISOString().split('T')[0], dueDate: "", notes: "", terms: "" });
      setLineItems([{ name: "", quantity: 1, rate: 0, taxRate: 0, total: 0 }]);
      toast({ title: "Estimate created successfully" });
    },
  });

  const convertMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/estimates/${id}/convert`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to convert estimate");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/estimates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Estimate converted to Invoice" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/estimates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete estimate");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/estimates"] });
      toast({ title: "Estimate deleted" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = lineItems.filter(item => item.name && item.rate > 0);
    createMutation.mutate({
      ...formData,
      customerId: formData.customerId || null,
      eventId: formData.eventId || null,
      lineItems: validItems,
      subtotal: subtotal.toString(),
      taxTotal: taxTotal.toString(),
      total: total.toString(),
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Estimates</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1">
              <Plus className="h-4 w-4" /> New Estimate
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Estimate</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Customer</Label>
                  <Select value={formData.customerId} onValueChange={(v) => setFormData({...formData, customerId: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c: Customer) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Event</Label>
                  <Select value={formData.eventId} onValueChange={(v) => setFormData({...formData, eventId: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select event" />
                    </SelectTrigger>
                    <SelectContent>
                      {events.map((e: Event) => (
                        <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label>Valid Until</Label>
                  <Input type="date" value={formData.dueDate} onChange={(e) => setFormData({...formData, dueDate: e.target.value})} />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Line Items</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {lineItems.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-center">
                      <Input 
                        className="col-span-4" 
                        placeholder="Item name" 
                        value={item.name} 
                        onChange={(e) => updateLineItem(index, 'name', e.target.value)} 
                      />
                      <Input 
                        className="col-span-2" 
                        type="number" 
                        placeholder="Qty" 
                        value={item.quantity} 
                        onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)} 
                      />
                      <Input 
                        className="col-span-2" 
                        type="number" 
                        placeholder="Rate" 
                        value={item.rate} 
                        onChange={(e) => updateLineItem(index, 'rate', parseFloat(e.target.value) || 0)} 
                      />
                      <Input 
                        className="col-span-2" 
                        type="number" 
                        placeholder="Tax %" 
                        value={item.taxRate || 0} 
                        onChange={(e) => updateLineItem(index, 'taxRate', parseFloat(e.target.value) || 0)} 
                      />
                      <div className="col-span-1 text-right text-sm font-medium">
                        {formatCurrency(item.total)}
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="col-span-1 h-8 w-8" onClick={() => removeLineItem(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4 space-y-1 text-right">
                <p className="text-sm">Subtotal: {formatCurrency(subtotal)}</p>
                <p className="text-sm">Tax: {formatCurrency(taxTotal)}</p>
                <p className="text-lg font-bold">Total: {formatCurrency(total)}</p>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} />
              </div>

              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Estimate"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {estimates.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No estimates yet. Create your first estimate.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Number</th>
                  <th className="text-left py-2 px-2 hidden sm:table-cell">Customer</th>
                  <th className="text-left py-2 px-2 hidden md:table-cell">Event</th>
                  <th className="text-left py-2 px-2">Date</th>
                  <th className="text-right py-2 px-2">Total</th>
                  <th className="text-center py-2 px-2">Status</th>
                  <th className="py-2 px-2 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {estimates.map((estimate: Estimate) => (
                  <tr key={estimate.id} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-2 font-medium">{estimate.number}</td>
                    <td className="py-2 px-2 hidden sm:table-cell">{getCustomerName(estimate.customerId)}</td>
                    <td className="py-2 px-2 hidden md:table-cell text-xs">{getEventTitle(estimate.eventId)}</td>
                    <td className="py-2 px-2">{format(new Date(estimate.date), "dd/MM/yy")}</td>
                    <td className="py-2 px-2 text-right font-medium">{formatCurrency(estimate.total)}</td>
                    <td className="py-2 px-2 text-center">{getStatusBadge(estimate.status)}</td>
                    <td className="py-2 px-2">
                      <div className="flex gap-1">
                        {estimate.status !== 'converted' && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => convertMutation.mutate(estimate.id)} title="Convert to Invoice">
                            <ArrowRight className="h-4 w-4 text-primary" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteMutation.mutate(estimate.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InvoicesTab({ invoices, customers, events, dialogOpen, setDialogOpen, getCustomerName, getEventTitle, formatCurrency, getStatusBadge, queryClient, toast }: any) {
  const [formData, setFormData] = useState({
    customerId: "",
    eventId: "",
    date: new Date().toISOString().split('T')[0],
    dueDate: "",
    notes: "",
    terms: "",
  });
  const [lineItems, setLineItems] = useState<LineItem[]>([{ name: "", quantity: 1, rate: 0, taxRate: 0, total: 0 }]);

  const addLineItem = () => {
    setLineItems([...lineItems, { name: "", quantity: 1, rate: 0, taxRate: 0, total: 0 }]);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: string, value: any) => {
    const updated = [...lineItems];
    (updated[index] as any)[field] = value;
    const item = updated[index];
    item.total = item.quantity * item.rate * (1 + (item.taxRate || 0) / 100);
    setLineItems(updated);
  };

  const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
  const taxTotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.rate * (item.taxRate || 0) / 100), 0);
  const total = subtotal + taxTotal;

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const numRes = await fetch("/api/invoices/next-number");
      const { number } = await numRes.json();
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, number }),
      });
      if (!res.ok) throw new Error("Failed to create invoice");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setDialogOpen(false);
      setFormData({ customerId: "", eventId: "", date: new Date().toISOString().split('T')[0], dueDate: "", notes: "", terms: "" });
      setLineItems([{ name: "", quantity: 1, rate: 0, taxRate: 0, total: 0 }]);
      toast({ title: "Invoice created successfully" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete invoice");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice deleted" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = lineItems.filter(item => item.name && item.rate > 0);
    createMutation.mutate({
      ...formData,
      customerId: formData.customerId || null,
      eventId: formData.eventId || null,
      lineItems: validItems,
      subtotal: subtotal.toString(),
      taxTotal: taxTotal.toString(),
      total: total.toString(),
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Invoices</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1">
              <Plus className="h-4 w-4" /> New Invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Invoice</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Customer</Label>
                  <Select value={formData.customerId} onValueChange={(v) => setFormData({...formData, customerId: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c: Customer) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Event</Label>
                  <Select value={formData.eventId} onValueChange={(v) => setFormData({...formData, eventId: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select event" />
                    </SelectTrigger>
                    <SelectContent>
                      {events.map((e: Event) => (
                        <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Invoice Date *</Label>
                  <Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input type="date" value={formData.dueDate} onChange={(e) => setFormData({...formData, dueDate: e.target.value})} />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Line Items</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {lineItems.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-center">
                      <Input 
                        className="col-span-4" 
                        placeholder="Item name" 
                        value={item.name} 
                        onChange={(e) => updateLineItem(index, 'name', e.target.value)} 
                      />
                      <Input 
                        className="col-span-2" 
                        type="number" 
                        placeholder="Qty" 
                        value={item.quantity} 
                        onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)} 
                      />
                      <Input 
                        className="col-span-2" 
                        type="number" 
                        placeholder="Rate" 
                        value={item.rate} 
                        onChange={(e) => updateLineItem(index, 'rate', parseFloat(e.target.value) || 0)} 
                      />
                      <Input 
                        className="col-span-2" 
                        type="number" 
                        placeholder="Tax %" 
                        value={item.taxRate || 0} 
                        onChange={(e) => updateLineItem(index, 'taxRate', parseFloat(e.target.value) || 0)} 
                      />
                      <div className="col-span-1 text-right text-sm font-medium">
                        {formatCurrency(item.total)}
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="col-span-1 h-8 w-8" onClick={() => removeLineItem(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4 space-y-1 text-right">
                <p className="text-sm">Subtotal: {formatCurrency(subtotal)}</p>
                <p className="text-sm">Tax: {formatCurrency(taxTotal)}</p>
                <p className="text-lg font-bold">Total: {formatCurrency(total)}</p>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} />
              </div>

              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Invoice"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No invoices yet. Create your first invoice.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Number</th>
                  <th className="text-left py-2 px-2 hidden sm:table-cell">Customer</th>
                  <th className="text-left py-2 px-2">Date</th>
                  <th className="text-right py-2 px-2">Total</th>
                  <th className="text-right py-2 px-2 hidden sm:table-cell">Balance</th>
                  <th className="text-center py-2 px-2">Status</th>
                  <th className="py-2 px-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice: Invoice) => (
                  <tr key={invoice.id} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-2 font-medium">{invoice.number}</td>
                    <td className="py-2 px-2 hidden sm:table-cell">{getCustomerName(invoice.customerId)}</td>
                    <td className="py-2 px-2">{format(new Date(invoice.date), "dd/MM/yy")}</td>
                    <td className="py-2 px-2 text-right font-medium">{formatCurrency(invoice.total)}</td>
                    <td className="py-2 px-2 text-right hidden sm:table-cell text-orange-600">{formatCurrency(invoice.balanceDue)}</td>
                    <td className="py-2 px-2 text-center">{getStatusBadge(invoice.status)}</td>
                    <td className="py-2 px-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteMutation.mutate(invoice.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReceiptsTab({ payments, customers, invoices, events, banks, dialogOpen, setDialogOpen, getCustomerName, getEventTitle, getBankName, formatCurrency, queryClient, toast }: any) {
  const [formData, setFormData] = useState({
    customerId: "",
    invoiceId: "",
    eventId: "",
    amount: "",
    date: new Date().toISOString().split('T')[0],
    paymentMode: "bank_transfer",
    bankId: "",
    reference: "",
    notes: "",
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const numRes = await fetch("/api/customer-payments/next-number");
      const { number } = await numRes.json();
      const res = await fetch("/api/customer-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, number }),
      });
      if (!res.ok) throw new Error("Failed to record payment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer-payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/daybook"] });
      queryClient.invalidateQueries({ queryKey: ["/api/banks"] });
      setDialogOpen(false);
      setFormData({ customerId: "", invoiceId: "", eventId: "", amount: "", date: new Date().toISOString().split('T')[0], paymentMode: "bank_transfer", bankId: "", reference: "", notes: "" });
      toast({ title: "Payment recorded successfully" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/customer-payments/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete payment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer-payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/daybook"] });
      queryClient.invalidateQueries({ queryKey: ["/api/banks"] });
      toast({ title: "Payment deleted" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      ...formData,
      customerId: formData.customerId || null,
      invoiceId: formData.invoiceId || null,
      eventId: formData.eventId || null,
      bankId: formData.bankId || null,
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Payment Receipts</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1">
              <Plus className="h-4 w-4" /> Record Payment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Customer Payment</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Customer</Label>
                  <Select value={formData.customerId} onValueChange={(v) => setFormData({...formData, customerId: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c: Customer) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Invoice</Label>
                  <Select value={formData.invoiceId} onValueChange={(v) => setFormData({...formData, invoiceId: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select invoice" />
                    </SelectTrigger>
                    <SelectContent>
                      {invoices.filter((inv: Invoice) => inv.status !== 'paid').map((inv: Invoice) => (
                        <SelectItem key={inv.id} value={inv.id}>{inv.number} ({formatCurrency(inv.balanceDue)} due)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount *</Label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="number" className="pl-9" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Payment Mode</Label>
                  <Select value={formData.paymentMode} onValueChange={(v) => setFormData({...formData, paymentMode: v})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_MODES.map(mode => (
                        <SelectItem key={mode.value} value={mode.value}>{mode.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Deposit To</Label>
                  <Select value={formData.bankId} onValueChange={(v) => setFormData({...formData, bankId: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select bank" />
                    </SelectTrigger>
                    <SelectContent>
                      {banks.map((bank: Bank) => (
                        <SelectItem key={bank.id} value={bank.id}>{bank.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Reference</Label>
                <Input value={formData.reference} onChange={(e) => setFormData({...formData, reference: e.target.value})} placeholder="Transaction ID, Cheque No, etc." />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Recording..." : "Record Payment"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No payments recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Receipt #</th>
                  <th className="text-left py-2 px-2 hidden sm:table-cell">Customer</th>
                  <th className="text-left py-2 px-2">Date</th>
                  <th className="text-left py-2 px-2 hidden sm:table-cell">Mode</th>
                  <th className="text-right py-2 px-2">Amount</th>
                  <th className="py-2 px-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment: CustomerPayment) => (
                  <tr key={payment.id} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-2 font-medium">{payment.number}</td>
                    <td className="py-2 px-2 hidden sm:table-cell">{getCustomerName(payment.customerId)}</td>
                    <td className="py-2 px-2">{format(new Date(payment.date), "dd/MM/yy")}</td>
                    <td className="py-2 px-2 hidden sm:table-cell capitalize">{payment.paymentMode.replace('_', ' ')}</td>
                    <td className="py-2 px-2 text-right font-medium text-green-600">{formatCurrency(payment.amount)}</td>
                    <td className="py-2 px-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteMutation.mutate(payment.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ExpensesTab({ expenses, vendors, events, banks, dialogOpen, setDialogOpen, getVendorName, getEventTitle, getBankName, formatCurrency, getStatusBadge, queryClient, toast }: any) {
  const [formData, setFormData] = useState({
    vendorId: "",
    eventId: "",
    category: "",
    description: "",
    amount: "",
    taxAmount: "0",
    date: new Date().toISOString().split('T')[0],
    bankId: "",
  });

  const total = (parseFloat(formData.amount) || 0) + (parseFloat(formData.taxAmount) || 0);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const numRes = await fetch("/api/expenses/next-number");
      const { number } = await numRes.json();
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, number }),
      });
      if (!res.ok) throw new Error("Failed to record expense");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/daybook"] });
      queryClient.invalidateQueries({ queryKey: ["/api/banks"] });
      setDialogOpen(false);
      setFormData({ vendorId: "", eventId: "", category: "", description: "", amount: "", taxAmount: "0", date: new Date().toISOString().split('T')[0], bankId: "" });
      toast({ title: "Expense recorded successfully" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete expense");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/daybook"] });
      queryClient.invalidateQueries({ queryKey: ["/api/banks"] });
      toast({ title: "Expense deleted" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      ...formData,
      vendorId: formData.vendorId || null,
      eventId: formData.eventId || null,
      bankId: formData.bankId || null,
      total: total.toString(),
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Expenses</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1">
              <Plus className="h-4 w-4" /> Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Expense</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Vendor</Label>
                  <Select value={formData.vendorId} onValueChange={(v) => setFormData({...formData, vendorId: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors.map((v: Vendor) => (
                        <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Event</Label>
                  <Select value={formData.eventId} onValueChange={(v) => setFormData({...formData, eventId: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select event" />
                    </SelectTrigger>
                    <SelectContent>
                      {events.map((e: Event) => (
                        <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category *</Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description *</Label>
                <Input value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} required />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Amount *</Label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="number" className="pl-9" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Tax</Label>
                  <Input type="number" value={formData.taxAmount} onChange={(e) => setFormData({...formData, taxAmount: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Total</Label>
                  <div className="h-10 flex items-center px-3 bg-muted rounded-md font-medium">{formatCurrency(total)}</div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Paid From (Bank)</Label>
                <Select value={formData.bankId} onValueChange={(v) => setFormData({...formData, bankId: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select bank (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {banks.map((bank: Bank) => (
                      <SelectItem key={bank.id} value={bank.id}>{bank.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">If bank selected, expense will be marked as paid</p>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Recording..." : "Record Expense"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {expenses.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No expenses recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Number</th>
                  <th className="text-left py-2 px-2 hidden sm:table-cell">Vendor</th>
                  <th className="text-left py-2 px-2">Category</th>
                  <th className="text-left py-2 px-2">Date</th>
                  <th className="text-right py-2 px-2">Total</th>
                  <th className="text-center py-2 px-2 hidden sm:table-cell">Status</th>
                  <th className="py-2 px-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense: Expense) => (
                  <tr key={expense.id} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-2 font-medium">{expense.number}</td>
                    <td className="py-2 px-2 hidden sm:table-cell">{getVendorName(expense.vendorId)}</td>
                    <td className="py-2 px-2">{expense.category}</td>
                    <td className="py-2 px-2">{format(new Date(expense.date), "dd/MM/yy")}</td>
                    <td className="py-2 px-2 text-right font-medium text-red-600">{formatCurrency(expense.total)}</td>
                    <td className="py-2 px-2 text-center hidden sm:table-cell">{getStatusBadge(expense.status)}</td>
                    <td className="py-2 px-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteMutation.mutate(expense.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function VendorPaymentsTab({ payments, vendors, expenses, events, banks, dialogOpen, setDialogOpen, getVendorName, getEventTitle, getBankName, formatCurrency, queryClient, toast }: any) {
  const [formData, setFormData] = useState({
    vendorId: "",
    expenseId: "",
    eventId: "",
    amount: "",
    date: new Date().toISOString().split('T')[0],
    paymentMode: "bank_transfer",
    bankId: "",
    reference: "",
    notes: "",
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const numRes = await fetch("/api/vendor-payments/next-number");
      const { number } = await numRes.json();
      const res = await fetch("/api/vendor-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, number }),
      });
      if (!res.ok) throw new Error("Failed to record vendor payment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor-payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/daybook"] });
      queryClient.invalidateQueries({ queryKey: ["/api/banks"] });
      setDialogOpen(false);
      setFormData({ vendorId: "", expenseId: "", eventId: "", amount: "", date: new Date().toISOString().split('T')[0], paymentMode: "bank_transfer", bankId: "", reference: "", notes: "" });
      toast({ title: "Vendor payment recorded successfully" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/vendor-payments/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete vendor payment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor-payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/daybook"] });
      queryClient.invalidateQueries({ queryKey: ["/api/banks"] });
      toast({ title: "Vendor payment deleted" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      ...formData,
      vendorId: formData.vendorId || null,
      expenseId: formData.expenseId || null,
      eventId: formData.eventId || null,
      bankId: formData.bankId || null,
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Vendor Payments</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1">
              <Plus className="h-4 w-4" /> Make Payment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Vendor Payment</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Vendor</Label>
                  <Select value={formData.vendorId} onValueChange={(v) => setFormData({...formData, vendorId: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors.map((v: Vendor) => (
                        <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Against Expense</Label>
                  <Select value={formData.expenseId} onValueChange={(v) => setFormData({...formData, expenseId: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select expense" />
                    </SelectTrigger>
                    <SelectContent>
                      {expenses.filter((exp: Expense) => exp.status === 'recorded').map((exp: Expense) => (
                        <SelectItem key={exp.id} value={exp.id}>{exp.number} - {exp.description} ({formatCurrency(exp.total)})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount *</Label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="number" className="pl-9" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Payment Mode</Label>
                  <Select value={formData.paymentMode} onValueChange={(v) => setFormData({...formData, paymentMode: v})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_MODES.map(mode => (
                        <SelectItem key={mode.value} value={mode.value}>{mode.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Paid From</Label>
                  <Select value={formData.bankId} onValueChange={(v) => setFormData({...formData, bankId: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select bank" />
                    </SelectTrigger>
                    <SelectContent>
                      {banks.map((bank: Bank) => (
                        <SelectItem key={bank.id} value={bank.id}>{bank.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Reference</Label>
                <Input value={formData.reference} onChange={(e) => setFormData({...formData, reference: e.target.value})} placeholder="Transaction ID, Cheque No, etc." />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Recording..." : "Record Payment"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No vendor payments recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Payment #</th>
                  <th className="text-left py-2 px-2 hidden sm:table-cell">Vendor</th>
                  <th className="text-left py-2 px-2">Date</th>
                  <th className="text-left py-2 px-2 hidden sm:table-cell">Mode</th>
                  <th className="text-right py-2 px-2">Amount</th>
                  <th className="py-2 px-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment: VendorPayment) => (
                  <tr key={payment.id} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-2 font-medium">{payment.number}</td>
                    <td className="py-2 px-2 hidden sm:table-cell">{getVendorName(payment.vendorId)}</td>
                    <td className="py-2 px-2">{format(new Date(payment.date), "dd/MM/yy")}</td>
                    <td className="py-2 px-2 hidden sm:table-cell capitalize">{payment.paymentMode.replace('_', ' ')}</td>
                    <td className="py-2 px-2 text-right font-medium text-red-600">{formatCurrency(payment.amount)}</td>
                    <td className="py-2 px-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteMutation.mutate(payment.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

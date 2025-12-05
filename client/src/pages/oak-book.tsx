import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { 
  Plus, 
  FileText, 
  Receipt, 
  CreditCard, 
  Users, 
  Building2, 
  ShoppingCart,
  Trash2,
  Copy,
  ArrowRight,
  IndianRupee,
  X,
  Home,
  Package,
  ChevronDown,
  ChevronRight,
  Settings,
  Edit,
  Eye,
  Calendar,
  Download,
  Share2,
  Loader2
} from "lucide-react";
import logo from "@assets/oakstreet_white_1764858814551.png";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

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
  slNo?: number;
  name: string;
  description?: string;
  quantity: number;
  rate: number;
  taxRate?: number;
  total: number;
  isHeading?: boolean;
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
  weddingPlannerName: string | null;
  customerAddress: string | null;
  lineItems: LineItem[];
  subtotal: string;
  discountPercent: string | null;
  discountAmount: string | null;
  serviceChargePercent: string | null;
  serviceChargeAmount: string | null;
  taxTotal: string;
  total: string;
  totalInWords: string | null;
  notes: string | null;
  terms: string | null;
  thankYouMessage: string | null;
  signature: string | null;
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
  weddingPlannerName: string | null;
  customerAddress: string | null;
  lineItems: LineItem[];
  subtotal: string;
  discountPercent: string | null;
  discountAmount: string | null;
  serviceChargePercent: string | null;
  serviceChargeAmount: string | null;
  taxTotal: string;
  total: string;
  totalInWords: string | null;
  balanceDue: string;
  notes: string | null;
  terms: string | null;
  thankYouMessage: string | null;
  signature: string | null;
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

type CompanySettings = {
  id: string;
  companyName: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo: string | null;
  gstNumber: string | null;
  defaultTerms: string | null;
  defaultThankYouMessage: string | null;
};

const EXPENSE_CATEGORIES = [
  "Catering", "Decoration", "Photography", "Videography", "Venue",
  "Entertainment", "Travel", "Accommodation", "Printing", "Flowers",
  "Rentals", "Staff", "Other"
];

const PAYMENT_MODES = [
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "cheque", label: "Cheque" },
  { value: "card", label: "Card" },
];

const DEFAULT_TERMS = `1. Any other additional facilities & Services to support the event will be charged at actual
2. 15% of the total amount to be paid in advance, 40% of the amount to be paid three months before the event, 40% three weeks before the event, and a balance of 5% on the event day.
3. The venue is to be made available 1 day prior to the setup.
4. Loading & unloading charges (Labour Union Charges) if any will be actual and have to be born by the client
5. Any Damage that occurred to our materials by participants will be charged at the actual.
6. In the unlikely event of cancellation of the function, the company reserves the right to claim 10% of the total amount as cancellation fees.
7. All items mentioned above are on a rental basis for this event only
8. 18% GST will be extra.
9. Public Performance License (PPL), Entertainment License may come additional at actual
10. Genset fuel rates will be at actual.
11. KSEB or electrical charges may come additional at actual.`;

function numberToWords(num: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  if (num === 0) return 'Zero';
  if (num < 0) return 'Negative ' + numberToWords(-num);

  let words = '';

  if (Math.floor(num / 10000000) > 0) {
    words += numberToWords(Math.floor(num / 10000000)) + ' Crore ';
    num %= 10000000;
  }

  if (Math.floor(num / 100000) > 0) {
    words += numberToWords(Math.floor(num / 100000)) + ' Lakh ';
    num %= 100000;
  }

  if (Math.floor(num / 1000) > 0) {
    words += numberToWords(Math.floor(num / 1000)) + ' Thousand ';
    num %= 1000;
  }

  if (Math.floor(num / 100) > 0) {
    words += numberToWords(Math.floor(num / 100)) + ' Hundred ';
    num %= 100;
  }

  if (num > 0) {
    if (num < 20) {
      words += ones[num];
    } else {
      words += tens[Math.floor(num / 10)];
      if (num % 10 > 0) {
        words += ' ' + ones[num % 10];
      }
    }
  }

  return words.trim();
}

function formatIndianCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

async function generatePDF(elementId: string, filename: string): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const element = document.getElementById(elementId);
  if (!element) {
    console.error('PDF generation failed: Element not found with ID:', elementId);
    throw new Error('Element not found: ' + elementId);
  }
  
  console.log('Generating PDF for element:', elementId, 'Element found:', element);
  
  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: true,
      backgroundColor: '#ffffff',
      allowTaint: true,
      foreignObjectRendering: false,
    });
    
    console.log('Canvas created:', canvas.width, 'x', canvas.height);
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    
    const contentHeight = (imgHeight * pdfWidth) / imgWidth;
    
    if (contentHeight <= pdfHeight - 20) {
      const ratio = Math.min((pdfWidth - 20) / imgWidth, (pdfHeight - 20) / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      pdf.addImage(imgData, 'PNG', imgX, 10, imgWidth * ratio, imgHeight * ratio);
    } else {
      const scaledWidth = pdfWidth - 20;
      const scaledHeight = (imgHeight * scaledWidth) / imgWidth;
      let heightLeft = scaledHeight;
      let position = 10;
      let pageNum = 0;
      
      while (heightLeft > 0) {
        if (pageNum > 0) {
          pdf.addPage();
        }
        pdf.addImage(imgData, 'PNG', 10, position - (pageNum * (pdfHeight - 20)), scaledWidth, scaledHeight);
        heightLeft -= (pdfHeight - 20);
        pageNum++;
      }
    }
    
    pdf.save(filename);
    console.log('PDF saved successfully:', filename);
  } catch (error) {
    console.error('PDF generation error:', error);
    throw error;
  }
}

export default function OakBook() {
  const [activeSection, setActiveSection] = useState("home");
  const [salesExpanded, setSalesExpanded] = useState(true);
  const [purchasesExpanded, setPurchasesExpanded] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: customers = [] } = useQuery<Customer[]>({ queryKey: ["/api/customers"] });
  const { data: vendors = [] } = useQuery<Vendor[]>({ queryKey: ["/api/vendors"] });
  const { data: estimates = [] } = useQuery<Estimate[]>({ queryKey: ["/api/estimates"] });
  const { data: invoices = [] } = useQuery<Invoice[]>({ queryKey: ["/api/invoices"] });
  const { data: customerPayments = [] } = useQuery<CustomerPayment[]>({ queryKey: ["/api/customer-payments"] });
  const { data: expenses = [] } = useQuery<Expense[]>({ queryKey: ["/api/expenses"] });
  const { data: vendorPayments = [] } = useQuery<VendorPayment[]>({ queryKey: ["/api/vendor-payments"] });
  const { data: events = [] } = useQuery<Event[]>({ queryKey: ["/api/events"] });
  const { data: banks = [] } = useQuery<Bank[]>({ queryKey: ["/api/banks"] });
  const { data: companySettings } = useQuery<CompanySettings>({ queryKey: ["/api/company-settings"] });

  const getCustomerName = (id: string | null) => customers.find(c => c.id === id)?.name || "—";
  const getVendorName = (id: string | null) => vendors.find(v => v.id === id)?.name || "—";

  const menuItems = [
    { id: "home", label: "Home", icon: Home },
    { id: "items", label: "Items", icon: Package },
  ];

  const salesItems = [
    { id: "customers", label: "Customers" },
    { id: "quotes", label: "Quotes" },
    { id: "invoices", label: "Invoices" },
    { id: "payments-received", label: "Payments Received" },
  ];

  const purchaseItems = [
    { id: "vendors", label: "Vendors" },
    { id: "expenses", label: "Expenses" },
    { id: "vendor-payments", label: "Vendor Payments" },
  ];

  return (
    <div className="flex h-[calc(100vh-4rem)] -m-4 sm:-m-6">
      {/* Sidebar */}
      <div className="w-64 bg-slate-50 border-r flex-shrink-0 hidden md:block">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-lg text-primary">Oak Book</h2>
          <p className="text-xs text-muted-foreground">Accounting & Invoicing</p>
        </div>
        <ScrollArea className="h-[calc(100%-5rem)]">
          <div className="p-2 space-y-1">
            {menuItems.map((item) => (
              <Button
                key={item.id}
                variant={activeSection === item.id ? "secondary" : "ghost"}
                className="w-full justify-start gap-2"
                onClick={() => setActiveSection(item.id)}
                data-testid={`nav-${item.id}`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Button>
            ))}

            {/* Sales Section */}
            <div>
              <Button
                variant="ghost"
                className="w-full justify-between"
                onClick={() => setSalesExpanded(!salesExpanded)}
              >
                <span className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Sales
                </span>
                {salesExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
              {salesExpanded && (
                <div className="ml-6 space-y-1">
                  {salesItems.map((item) => (
                    <Button
                      key={item.id}
                      variant={activeSection === item.id ? "secondary" : "ghost"}
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => setActiveSection(item.id)}
                      data-testid={`nav-${item.id}`}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {/* Purchases Section */}
            <div>
              <Button
                variant="ghost"
                className="w-full justify-between"
                onClick={() => setPurchasesExpanded(!purchasesExpanded)}
              >
                <span className="flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  Purchases
                </span>
                {purchasesExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
              {purchasesExpanded && (
                <div className="ml-6 space-y-1">
                  {purchaseItems.map((item) => (
                    <Button
                      key={item.id}
                      variant={activeSection === item.id ? "secondary" : "ghost"}
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => setActiveSection(item.id)}
                      data-testid={`nav-${item.id}`}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            <Separator className="my-2" />
            <Button
              variant={activeSection === "settings" ? "secondary" : "ghost"}
              className="w-full justify-start gap-2"
              onClick={() => setActiveSection("settings")}
            >
              <Settings className="h-4 w-4" />
              Settings
            </Button>
          </div>
        </ScrollArea>
      </div>

      {/* Mobile Sub-Navigation - Shows when in Sales or Purchases sections */}
      {["customers", "quotes", "invoices", "payments-received"].includes(activeSection) && (
        <div className="md:hidden fixed top-[4rem] left-0 right-0 bg-white border-b z-40 px-2 py-1">
          <ScrollArea className="w-full">
            <div className="flex gap-1 w-max">
              {salesItems.map((item) => (
                <Button
                  key={item.id}
                  variant={activeSection === item.id ? "secondary" : "ghost"}
                  size="sm"
                  className="whitespace-nowrap text-xs"
                  onClick={() => setActiveSection(item.id)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
      {["vendors", "expenses", "vendor-payments"].includes(activeSection) && (
        <div className="md:hidden fixed top-[4rem] left-0 right-0 bg-white border-b z-40 px-2 py-1">
          <ScrollArea className="w-full">
            <div className="flex gap-1 w-max">
              {purchaseItems.map((item) => (
                <Button
                  key={item.id}
                  variant={activeSection === item.id ? "secondary" : "ghost"}
                  size="sm"
                  className="whitespace-nowrap text-xs"
                  onClick={() => setActiveSection(item.id)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Mobile Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-50 p-2">
        <div className="flex justify-around">
          <Button variant={activeSection === "home" ? "secondary" : "ghost"} size="sm" onClick={() => setActiveSection("home")}>
            <Home className="h-4 w-4" />
          </Button>
          <Button variant={["customers", "quotes", "invoices", "payments-received"].includes(activeSection) ? "secondary" : "ghost"} size="sm" onClick={() => setActiveSection("quotes")}>
            <ShoppingCart className="h-4 w-4" />
          </Button>
          <Button variant={["vendors", "expenses", "vendor-payments"].includes(activeSection) ? "secondary" : "ghost"} size="sm" onClick={() => setActiveSection("expenses")}>
            <Receipt className="h-4 w-4" />
          </Button>
          <Button variant={activeSection === "settings" ? "secondary" : "ghost"} size="sm" onClick={() => setActiveSection("settings")}>
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex-1 overflow-auto p-4 md:p-6 pb-20 md:pb-6 ${["customers", "quotes", "invoices", "payments-received", "vendors", "expenses", "vendor-payments"].includes(activeSection) ? "pt-14 md:pt-4" : ""}`}>
        {activeSection === "home" && (
          <HomeSection 
            estimates={estimates} 
            invoices={invoices} 
            customerPayments={customerPayments}
            expenses={expenses}
            customers={customers}
          />
        )}
        {activeSection === "customers" && (
          <CustomersSection customers={customers} queryClient={queryClient} toast={toast} />
        )}
        {activeSection === "quotes" && (
          <QuotesSection 
            estimates={estimates} 
            customers={customers} 
            companySettings={companySettings}
            queryClient={queryClient} 
            toast={toast} 
          />
        )}
        {activeSection === "invoices" && (
          <InvoicesSection 
            invoices={invoices} 
            customers={customers}
            banks={banks}
            companySettings={companySettings}
            queryClient={queryClient} 
            toast={toast} 
          />
        )}
        {activeSection === "payments-received" && (
          <PaymentsReceivedSection 
            payments={customerPayments} 
            customers={customers}
            invoices={invoices}
            banks={banks}
            companySettings={companySettings}
            queryClient={queryClient} 
            toast={toast} 
          />
        )}
        {activeSection === "vendors" && (
          <VendorsSection vendors={vendors} queryClient={queryClient} toast={toast} />
        )}
        {activeSection === "expenses" && (
          <ExpensesSection 
            expenses={expenses} 
            vendors={vendors}
            banks={banks}
            queryClient={queryClient} 
            toast={toast} 
          />
        )}
        {activeSection === "vendor-payments" && (
          <VendorPaymentsSection 
            payments={vendorPayments} 
            vendors={vendors}
            expenses={expenses}
            banks={banks}
            queryClient={queryClient} 
            toast={toast} 
          />
        )}
        {activeSection === "settings" && (
          <SettingsSection companySettings={companySettings} queryClient={queryClient} toast={toast} />
        )}
      </div>
    </div>
  );
}

function HomeSection({ estimates, invoices, customerPayments, expenses, customers }: any) {
  const totalEstimates = estimates.length;
  const totalInvoices = invoices.length;
  const totalPaymentsReceived = customerPayments.reduce((sum: number, p: any) => sum + parseFloat(p.amount || '0'), 0);
  const totalExpenses = expenses.reduce((sum: number, e: any) => sum + parseFloat(e.total || '0'), 0);
  const pendingInvoices = invoices.filter((i: any) => parseFloat(i.balanceDue || '0') > 0).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Welcome to Oak Book</h1>
        <p className="text-muted-foreground">Your accounting and invoicing dashboard</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Quotes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEstimates}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalInvoices}</div>
            <p className="text-xs text-muted-foreground">{pendingInvoices} pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Payments Received</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatIndianCurrency(totalPaymentsReceived)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatIndianCurrency(totalExpenses)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Quotes</CardTitle>
          </CardHeader>
          <CardContent>
            {estimates.slice(0, 5).map((est: Estimate) => (
              <div key={est.id} className="flex justify-between items-center py-2 border-b last:border-0">
                <div>
                  <p className="font-medium">{est.number}</p>
                  <p className="text-sm text-muted-foreground">
                    {est.customerId ? customers.find((c: Customer) => c.id === est.customerId)?.name : 'No customer'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{formatIndianCurrency(parseFloat(est.total))}</p>
                  <Badge variant={est.status === 'accepted' ? 'default' : 'secondary'}>{est.status}</Badge>
                </div>
              </div>
            ))}
            {estimates.length === 0 && (
              <p className="text-center text-muted-foreground py-4">No quotes yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            {invoices.slice(0, 5).map((inv: Invoice) => (
              <div key={inv.id} className="flex justify-between items-center py-2 border-b last:border-0">
                <div>
                  <p className="font-medium">{inv.number}</p>
                  <p className="text-sm text-muted-foreground">
                    {inv.customerId ? customers.find((c: Customer) => c.id === inv.customerId)?.name : 'No customer'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{formatIndianCurrency(parseFloat(inv.total))}</p>
                  <Badge variant={inv.status === 'paid' ? 'default' : 'secondary'}>{inv.status}</Badge>
                </div>
              </div>
            ))}
            {invoices.length === 0 && (
              <p className="text-center text-muted-foreground py-4">No invoices yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CustomersSection({ customers, queryClient, toast }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', gstNumber: '', billingAddress: ''
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create customer');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      setIsOpen(false);
      setFormData({ name: '', email: '', phone: '', gstNumber: '', billingAddress: '' });
      toast({ title: 'Customer created successfully' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete customer');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      toast({ title: 'Customer deleted' });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <h1 className="text-xl sm:text-2xl font-bold">Customers</h1>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-customer" size="sm" className="w-full sm:w-auto"><Plus className="h-4 w-4 mr-2" /> New Customer</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Customer</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name *</Label>
                <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} data-testid="input-customer-name" />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              </div>
              <div>
                <Label>GST Number</Label>
                <Input value={formData.gstNumber} onChange={e => setFormData({...formData, gstNumber: e.target.value})} />
              </div>
              <div>
                <Label>Billing Address</Label>
                <Textarea value={formData.billingAddress} onChange={e => setFormData({...formData, billingAddress: e.target.value})} />
              </div>
              <Button onClick={() => createMutation.mutate(formData)} disabled={!formData.name || createMutation.isPending} className="w-full">
                {createMutation.isPending ? 'Creating...' : 'Create Customer'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Email</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Phone</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer: Customer) => (
                  <tr key={customer.id} className="border-t" data-testid={`row-customer-${customer.id}`}>
                    <td className="p-3">
                      <div className="font-medium">{customer.name}</div>
                      <div className="text-sm text-muted-foreground md:hidden">{customer.email}</div>
                    </td>
                    <td className="p-3 hidden md:table-cell">{customer.email || '—'}</td>
                    <td className="p-3 hidden md:table-cell">{customer.phone || '—'}</td>
                    <td className="p-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(customer.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {customers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-muted-foreground">
                      No customers yet. Click "New Customer" to add one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function QuotesSection({ estimates, customers, companySettings, queryClient, toast }: any) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedEstimate, setSelectedEstimate] = useState<Estimate | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  const cloneMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/estimates/${id}/clone`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to clone');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/estimates'] });
      toast({ title: 'Quote cloned successfully' });
    },
  });

  const convertMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/estimates/${id}/convert-to-invoice`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to convert');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/estimates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      toast({ title: 'Quote converted to invoice successfully' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/estimates/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/estimates'] });
      toast({ title: 'Quote deleted' });
    },
  });

  const handleViewEstimate = (estimate: Estimate) => {
    setSelectedEstimate(estimate);
    setIsEditMode(false);
    setIsViewOpen(true);
  };

  const handleEditEstimate = (estimate: Estimate) => {
    setSelectedEstimate(estimate);
    setIsEditMode(true);
    setIsViewOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <h1 className="text-xl sm:text-2xl font-bold">Quotes</h1>
        <Button onClick={() => setIsCreateOpen(true)} data-testid="button-add-quote" size="sm" className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" /> New Quote
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Quote #</th>
                  <th className="text-left p-3 font-medium">Customer</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Date</th>
                  <th className="text-right p-3 font-medium">Amount</th>
                  <th className="text-center p-3 font-medium">Status</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {estimates.map((estimate: Estimate) => (
                  <tr key={estimate.id} className="border-t hover:bg-muted/30 cursor-pointer" data-testid={`row-quote-${estimate.id}`} onClick={() => handleViewEstimate(estimate)}>
                    <td className="p-3 font-medium">{estimate.number}</td>
                    <td className="p-3">
                      {estimate.customerId ? customers.find((c: Customer) => c.id === estimate.customerId)?.name : '—'}
                    </td>
                    <td className="p-3 hidden md:table-cell">{format(new Date(estimate.date), 'dd/MM/yyyy')}</td>
                    <td className="p-3 text-right font-medium">{formatIndianCurrency(parseFloat(estimate.total))}</td>
                    <td className="p-3 text-center">
                      <Badge variant={estimate.status === 'accepted' ? 'default' : estimate.status === 'converted' ? 'secondary' : 'outline'}>
                        {estimate.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleViewEstimate(estimate)} title="View">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEditEstimate(estimate)} title="Edit">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => cloneMutation.mutate(estimate.id)} title="Clone">
                          <Copy className="h-4 w-4" />
                        </Button>
                        {estimate.status !== 'converted' && (
                          <Button variant="ghost" size="sm" onClick={() => convertMutation.mutate(estimate.id)} title="Convert to Invoice">
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(estimate.id)} title="Delete">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {estimates.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No quotes yet. Click "New Quote" to create one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <CreateQuoteDialog 
        open={isCreateOpen} 
        onOpenChange={setIsCreateOpen}
        customers={customers}
        companySettings={companySettings}
        queryClient={queryClient}
        toast={toast}
      />

      {selectedEstimate && (
        <ViewEditQuoteDialog
          open={isViewOpen}
          onOpenChange={(open: boolean) => {
            setIsViewOpen(open);
            if (!open) {
              setIsEditMode(false);
            }
          }}
          estimate={selectedEstimate}
          customers={customers}
          companySettings={companySettings}
          queryClient={queryClient}
          toast={toast}
          initialEditMode={isEditMode}
          onClone={() => cloneMutation.mutate(selectedEstimate.id)}
          onConvert={() => convertMutation.mutate(selectedEstimate.id)}
        />
      )}
    </div>
  );
}

function CreateQuoteDialog({ open, onOpenChange, customers, companySettings, queryClient, toast }: any) {
  const [customerId, setCustomerId] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [subject, setSubject] = useState('');
  const [weddingPlannerName, setWeddingPlannerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [serviceChargePercent, setServiceChargePercent] = useState(12.5);
  const [notes, setNotes] = useState('Looking forward for your business.');
  const [terms, setTerms] = useState(DEFAULT_TERMS);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');

  const addLineItem = (isHeading: boolean = false) => {
    setLineItems([...lineItems, {
      slNo: isHeading ? undefined : lineItems.filter(i => !i.isHeading).length + 1,
      name: '',
      description: '',
      quantity: isHeading ? 0 : 1,
      rate: 0,
      total: 0,
      isHeading,
    }]);
  };

  const updateLineItem = (index: number, field: string, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'quantity' || field === 'rate') {
      updated[index].total = updated[index].quantity * updated[index].rate;
    }
    setLineItems(updated);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const subtotal = lineItems.filter(i => !i.isHeading).reduce((sum, item) => sum + item.total, 0);
  const discountAmount = subtotal * (discountPercent / 100);
  const afterDiscount = subtotal - discountAmount;
  const serviceChargeAmount = afterDiscount * (serviceChargePercent / 100);
  const total = afterDiscount + serviceChargeAmount;

  const createCustomerMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('Failed to create customer');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      setCustomerId(data.id);
      setIsAddingCustomer(false);
      setNewCustomerName('');
      toast({ title: 'Customer created' });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const numberRes = await fetch('/api/document-sequences/estimate/next');
      const { number } = await numberRes.json();
      
      const res = await fetch('/api/estimates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, number }),
      });
      if (!res.ok) throw new Error('Failed to create quote');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/estimates'] });
      onOpenChange(false);
      resetForm();
      toast({ title: 'Quote created successfully' });
    },
  });

  const resetForm = () => {
    setCustomerId('');
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setSubject('');
    setWeddingPlannerName('');
    setCustomerAddress('');
    setLineItems([]);
    setDiscountPercent(0);
    setServiceChargePercent(12.5);
    setNotes('Looking forward for your business.');
    setTerms(DEFAULT_TERMS);
  };

  const handleSubmit = () => {
    createMutation.mutate({
      customerId: customerId || null,
      date,
      subject,
      weddingPlannerName,
      customerAddress,
      lineItems,
      subtotal: subtotal.toFixed(2),
      discountPercent: discountPercent.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      serviceChargePercent: serviceChargePercent.toFixed(2),
      serviceChargeAmount: serviceChargeAmount.toFixed(2),
      taxTotal: '0',
      total: total.toFixed(2),
      totalInWords: `Indian Rupee ${numberToWords(Math.round(total))} Only`,
      notes,
      terms,
      thankYouMessage: notes,
      status: 'draft',
    });
  };

  const loadTemplate = () => {
    setSubject('Welcome party, Sangeet & Wedding on 14&15th Dec 2025 at Backwater Ripples');
    setLineItems([
      { slNo: undefined, name: 'DAY 1: 13th Dec 2025 - MEHANDI', description: '', quantity: 0, rate: 0, total: 0, isHeading: true },
      { slNo: 1, name: 'Mehandi artist for bride on 13th Dec\n*Plastic wraps\n*Transportation charge: 1000/-', description: '', quantity: 1, rate: 5000, total: 5000, isHeading: false },
      { slNo: 2, name: 'Mehandi artist for mom on 13th Dec\n*Mehandi for 3 people', description: '', quantity: 1, rate: 1500, total: 1500, isHeading: false },
      { slNo: 3, name: 'Coordinator to book Cab at Airport\n*With placard', description: '', quantity: 1, rate: 2000, total: 2000, isHeading: false },
      { slNo: undefined, name: 'GENERAL DECOR', description: '', quantity: 0, rate: 0, total: 0, isHeading: true },
      { slNo: 4, name: 'Flower and props hanging on trees with artificial mariegold & rajasthani umbrellas\n*From 13th Dec onwards', description: '', quantity: 1, rate: 7950, total: 7950, isHeading: false },
      { slNo: undefined, name: 'DAY 2: 14th Dec - WELCOME PARTY DECOR', description: '', quantity: 0, rate: 0, total: 0, isHeading: true },
      { slNo: 5, name: 'Welcome board with artificial white flowers\n*Same board for wedding', description: '', quantity: 1, rate: 4500, total: 4500, isHeading: false },
      { slNo: 6, name: 'Entrance arch with green & orange cloth draping on pillars', description: '', quantity: 1, rate: 7500, total: 7500, isHeading: false },
      { slNo: undefined, name: 'MINI STATIONS', description: '', quantity: 0, rate: 0, total: 0, isHeading: true },
      { slNo: 7, name: 'Chat & tea cart', description: '', quantity: 2, rate: 3500, total: 7000, isHeading: false },
      { slNo: 8, name: 'Mehandi artists for guests (3 artists for 2 hours)\nTime: 03.30 PM to 05.30 PM', description: '', quantity: 6, rate: 1500, total: 9000, isHeading: false },
      { slNo: undefined, name: 'SEATING & FURNITURES FOR MEHANDI', description: '', quantity: 0, rate: 0, total: 0, isHeading: true },
      { slNo: 9, name: 'Tiffany chairs', description: '', quantity: 30, rate: 85, total: 2550, isHeading: false },
      { slNo: 10, name: 'Bench with cushion and bolsters', description: '', quantity: 8, rate: 1550, total: 12400, isHeading: false },
      { slNo: undefined, name: 'SANGEET DECOR', description: '', quantity: 0, rate: 0, total: 0, isHeading: true },
      { slNo: 11, name: 'Board for letters to guest', description: '', quantity: 1, rate: 8200, total: 8200, isHeading: false },
      { slNo: 12, name: 'Entrance arch', description: '', quantity: 1, rate: 14500, total: 14500, isHeading: false },
      { slNo: 13, name: 'Sangeet dance floor print - 24x16ft', description: '', quantity: 1, rate: 9600, total: 9600, isHeading: false },
    ]);
    setServiceChargePercent(12.5);
    toast({ title: 'Template loaded' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Quote</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={loadTemplate}>
              Load Sample Template
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Customer</Label>
              {isAddingCustomer ? (
                <div className="flex gap-2">
                  <Input 
                    placeholder="Customer name" 
                    value={newCustomerName} 
                    onChange={e => setNewCustomerName(e.target.value)} 
                  />
                  <Button size="sm" onClick={() => createCustomerMutation.mutate(newCustomerName)}>Add</Button>
                  <Button size="sm" variant="ghost" onClick={() => setIsAddingCustomer(false)}>Cancel</Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Select value={customerId} onValueChange={setCustomerId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c: Customer) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={() => setIsAddingCustomer(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            <div>
              <Label>Quote Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Wedding Planner Name</Label>
              <Input value={weddingPlannerName} onChange={e => setWeddingPlannerName(e.target.value)} placeholder="Wedding planner name" />
            </div>
            <div>
              <Label>Customer Address</Label>
              <Textarea value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} placeholder="Billing address" rows={2} />
            </div>
          </div>

          <div>
            <Label>Subject (Event Description)</Label>
            <Textarea value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g., Welcome party, Sangeet & Wedding on 14&15th Dec 2025 at Backwater Ripples" rows={2} />
          </div>

          <div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2">
              <Label>Line Items</Label>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => addLineItem(true)} className="text-xs sm:text-sm">
                  + Section
                </Button>
                <Button size="sm" variant="outline" onClick={() => addLineItem(false)} className="text-xs sm:text-sm">
                  + Item
                </Button>
              </div>
            </div>
            
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-2 text-left w-12">Sl No</th>
                    <th className="p-2 text-left">Item & Description</th>
                    <th className="p-2 text-right w-20">Qty</th>
                    <th className="p-2 text-right w-24">Rate</th>
                    <th className="p-2 text-right w-28">Amount</th>
                    <th className="p-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item, index) => (
                    <tr key={index} className={cn("border-t", item.isHeading && "bg-muted/30")}>
                      <td className="p-2">
                        {item.isHeading ? '' : item.slNo}
                      </td>
                      <td className="p-2" colSpan={item.isHeading ? 4 : 1}>
                        <Textarea
                          value={item.name}
                          onChange={e => updateLineItem(index, 'name', e.target.value)}
                          className={cn("min-h-[40px]", item.isHeading && "font-bold bg-transparent border-none")}
                          placeholder={item.isHeading ? "Section heading..." : "Item description..."}
                          rows={1}
                        />
                      </td>
                      {!item.isHeading && (
                        <>
                          <td className="p-2">
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={e => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                              className="text-right"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              value={item.rate}
                              onChange={e => updateLineItem(index, 'rate', parseFloat(e.target.value) || 0)}
                              className="text-right"
                            />
                          </td>
                          <td className="p-2 text-right font-medium">
                            {formatIndianCurrency(item.total)}
                          </td>
                        </>
                      )}
                      <td className="p-2">
                        <Button variant="ghost" size="sm" onClick={() => removeLineItem(index)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {lineItems.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        Add section headers and line items above
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end">
            <div className="w-full sm:w-80 space-y-2">
              <div className="flex justify-between">
                <span>Sub Total</span>
                <span className="font-medium">{formatIndianCurrency(subtotal)}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                <span className="flex items-center gap-2 text-sm">
                  Discount
                  <Input
                    type="number"
                    value={discountPercent}
                    onChange={e => setDiscountPercent(parseFloat(e.target.value) || 0)}
                    className="w-16 h-6 text-right"
                  />
                  %
                </span>
                <span>- {formatIndianCurrency(discountAmount)}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                <span className="flex items-center gap-2 text-sm">
                  Service Charge
                  <Input
                    type="number"
                    value={serviceChargePercent}
                    onChange={e => setServiceChargePercent(parseFloat(e.target.value) || 0)}
                    className="w-16 h-6 text-right"
                  />
                  %
                </span>
                <span>{formatIndianCurrency(serviceChargeAmount)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>{formatIndianCurrency(total)}</span>
              </div>
            </div>
          </div>

          <div>
            <Label>Total in Words</Label>
            <p className="text-sm font-medium mt-1">Indian Rupee {numberToWords(Math.round(total))} Only</p>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>

          <div>
            <Label>Terms & Conditions</Label>
            <Textarea value={terms} onChange={e => setTerms(e.target.value)} rows={6} />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Quote'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ViewEditQuoteDialog({ open, onOpenChange, estimate, customers, companySettings, queryClient, toast, initialEditMode, onClone, onConvert }: any) {
  const [isEditMode, setIsEditMode] = useState(initialEditMode);
  const [customerId, setCustomerId] = useState(estimate.customerId || '');
  const [date, setDate] = useState(estimate.date);
  const [subject, setSubject] = useState(estimate.subject || '');
  const [weddingPlannerName, setWeddingPlannerName] = useState(estimate.weddingPlannerName || '');
  const [customerAddress, setCustomerAddress] = useState(estimate.customerAddress || '');
  const [lineItems, setLineItems] = useState<LineItem[]>(estimate.lineItems || []);
  const [discountPercent, setDiscountPercent] = useState(parseFloat(estimate.discountPercent || '0'));
  const [serviceChargePercent, setServiceChargePercent] = useState(parseFloat(estimate.serviceChargePercent || '12.5'));
  const [notes, setNotes] = useState(estimate.notes || '');
  const [terms, setTerms] = useState(estimate.terms || DEFAULT_TERMS);
  const [status, setStatus] = useState(estimate.status);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);

  const customer = customers.find((c: Customer) => c.id === customerId);

  useEffect(() => {
    setIsEditMode(initialEditMode);
    setCustomerId(estimate.customerId || '');
    setDate(estimate.date);
    setSubject(estimate.subject || '');
    setWeddingPlannerName(estimate.weddingPlannerName || '');
    setCustomerAddress(estimate.customerAddress || '');
    setLineItems(estimate.lineItems || []);
    setDiscountPercent(parseFloat(estimate.discountPercent || '0'));
    setServiceChargePercent(parseFloat(estimate.serviceChargePercent || '12.5'));
    setNotes(estimate.notes || '');
    setTerms(estimate.terms || DEFAULT_TERMS);
    setStatus(estimate.status);
  }, [estimate, initialEditMode]);

  const addLineItem = (isHeading: boolean = false) => {
    setLineItems([...lineItems, {
      slNo: isHeading ? undefined : lineItems.filter(i => !i.isHeading).length + 1,
      name: '',
      description: '',
      quantity: isHeading ? 0 : 1,
      rate: 0,
      total: 0,
      isHeading,
    }]);
  };

  const updateLineItem = (index: number, field: string, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'quantity' || field === 'rate') {
      updated[index].total = updated[index].quantity * updated[index].rate;
    }
    setLineItems(updated);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const subtotal = lineItems.filter(i => !i.isHeading).reduce((sum, item) => sum + item.total, 0);
  const discountAmount = subtotal * (discountPercent / 100);
  const afterDiscount = subtotal - discountAmount;
  const serviceChargeAmount = afterDiscount * (serviceChargePercent / 100);
  const total = afterDiscount + serviceChargeAmount;

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/estimates/${estimate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update quote');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/estimates'] });
      setIsEditMode(false);
      toast({ title: 'Quote updated successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to update quote', variant: 'destructive' });
    },
  });

  const handleSave = () => {
    let itemCounter = 1;
    const reindexedLineItems = lineItems.map(item => ({
      ...item,
      slNo: item.isHeading ? undefined : itemCounter++,
      quantity: Number(item.quantity),
      rate: Number(item.rate),
      total: Number(item.quantity) * Number(item.rate),
    }));

    const calcSubtotal = reindexedLineItems.filter(i => !i.isHeading).reduce((sum, item) => sum + (item.total || 0), 0);
    const calcDiscountAmount = calcSubtotal * (discountPercent / 100);
    const calcAfterDiscount = calcSubtotal - calcDiscountAmount;
    const calcServiceChargeAmount = calcAfterDiscount * (serviceChargePercent / 100);
    const calcTotal = calcAfterDiscount + calcServiceChargeAmount;

    updateMutation.mutate({
      customerId: customerId || null,
      date,
      subject,
      weddingPlannerName,
      customerAddress,
      lineItems: reindexedLineItems,
      subtotal: calcSubtotal.toFixed(2),
      discountPercent: discountPercent.toFixed(2),
      discountAmount: calcDiscountAmount.toFixed(2),
      serviceChargePercent: serviceChargePercent.toFixed(2),
      serviceChargeAmount: calcServiceChargeAmount.toFixed(2),
      taxTotal: '0',
      total: calcTotal.toFixed(2),
      totalInWords: `Indian Rupee ${numberToWords(Math.round(calcTotal))} Only`,
      notes,
      terms,
      status,
    });
  };

  if (isEditMode) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
              <DialogTitle className="text-base sm:text-lg">Edit Quote - {estimate.number}</DialogTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsEditMode(false)} className="text-xs sm:text-sm">
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending} className="text-xs sm:text-sm">
                  {updateMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label>Customer</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
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
              <div>
                <Label>Quote Date</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label className="text-xs sm:text-sm">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="text-xs sm:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="accepted">Accepted</SelectItem>
                    <SelectItem value="declined">Declined</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs sm:text-sm">Wedding Planner</Label>
                <Input value={weddingPlannerName} onChange={e => setWeddingPlannerName(e.target.value)} className="text-xs sm:text-sm" />
              </div>
            </div>

            <div>
              <Label className="text-xs sm:text-sm">Customer Address</Label>
              <Textarea value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} rows={2} className="text-xs sm:text-sm" />
            </div>

            <div>
              <Label className="text-xs sm:text-sm">Subject (Event Description)</Label>
              <Textarea value={subject} onChange={e => setSubject(e.target.value)} rows={2} className="text-xs sm:text-sm" />
            </div>

            <div>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2">
                <Label className="text-xs sm:text-sm">Line Items</Label>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => addLineItem(true)} className="text-xs h-7 px-2">
                    + Section
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => addLineItem(false)} className="text-xs h-7 px-2">
                    + Item
                  </Button>
                </div>
              </div>
              
              <div className="border rounded-lg overflow-x-auto w-full">
                <table className="w-full text-xs sm:text-sm min-w-[450px]">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-2 text-left w-12">Sl No</th>
                      <th className="p-2 text-left">Item & Description</th>
                      <th className="p-2 text-right w-20">Qty</th>
                      <th className="p-2 text-right w-24">Rate</th>
                      <th className="p-2 text-right w-28">Amount</th>
                      <th className="p-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item, index) => (
                      <tr key={index} className={cn("border-t", item.isHeading && "bg-muted/30")}>
                        <td className="p-2">{item.isHeading ? '' : item.slNo}</td>
                        <td className="p-2" colSpan={item.isHeading ? 4 : 1}>
                          <Textarea
                            value={item.name}
                            onChange={e => updateLineItem(index, 'name', e.target.value)}
                            className={cn("min-h-[40px]", item.isHeading && "font-bold")}
                            rows={1}
                          />
                        </td>
                        {!item.isHeading && (
                          <>
                            <td className="p-2">
                              <Input
                                type="number"
                                value={item.quantity}
                                onChange={e => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                                className="text-right"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                value={item.rate}
                                onChange={e => updateLineItem(index, 'rate', parseFloat(e.target.value) || 0)}
                                className="text-right"
                              />
                            </td>
                            <td className="p-2 text-right font-medium">
                              {formatIndianCurrency(item.total)}
                            </td>
                          </>
                        )}
                        <td className="p-2">
                          <Button variant="ghost" size="sm" onClick={() => removeLineItem(index)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="w-full">
              <div className="w-full sm:w-80 sm:ml-auto space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between">
                  <span>Sub Total</span>
                  <span className="font-medium">{formatIndianCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="flex items-center gap-1">
                    Discount
                    <Input
                      type="number"
                      value={discountPercent}
                      onChange={e => setDiscountPercent(parseFloat(e.target.value) || 0)}
                      className="w-12 h-6 text-right text-xs"
                    />
                    %
                  </span>
                  <span>- {formatIndianCurrency(discountAmount)}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="flex items-center gap-1">
                    Service
                    <Input
                      type="number"
                      value={serviceChargePercent}
                      onChange={e => setServiceChargePercent(parseFloat(e.target.value) || 0)}
                      className="w-12 h-6 text-right text-xs"
                    />
                    %
                  </span>
                  <span>{formatIndianCurrency(serviceChargeAmount)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm sm:text-lg font-bold">
                  <span>Total</span>
                  <span>{formatIndianCurrency(total)}</span>
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs sm:text-sm">Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="text-xs sm:text-sm" />
            </div>

            <div>
              <Label className="text-xs sm:text-sm">Terms & Conditions</Label>
              <Textarea value={terms} onChange={e => setTerms(e.target.value)} rows={4} className="text-xs sm:text-sm" />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch(`/api/pdf/quote/${estimate.id}`);
      if (!response.ok) throw new Error('Failed to generate PDF');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Quote-${estimate.number}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: 'PDF downloaded successfully!' });
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      toast({ title: 'Failed to download PDF', description: String(error), variant: 'destructive' });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShareToPortal = async () => {
    setIsSharing(true);
    try {
      const res = await fetch('/api/portal-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType: 'estimate',
          documentId: estimate.id,
          customerId: estimate.customerId,
        }),
      });
      if (!res.ok) throw new Error('Failed to create share link');
      const link = await res.json();
      const portalUrl = `${window.location.origin}/portal/${link.token}`;
      setShareLink(portalUrl);
      await navigator.clipboard.writeText(portalUrl);
      toast({ title: 'Link copied to clipboard!', description: 'Share this link with your customer.' });
    } catch (error) {
      console.error('Failed to share:', error);
      toast({ title: 'Failed to create share link', variant: 'destructive' });
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 pb-4 border-b">
          <div className="flex items-center gap-2">
            <Badge variant={estimate.status === 'accepted' ? 'default' : estimate.status === 'converted' ? 'secondary' : 'outline'}>
              {estimate.status}
            </Badge>
            <span className="font-medium">{estimate.number}</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setIsEditMode(true)} className="text-xs sm:text-sm">
              <Edit className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Edit</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadPDF} disabled={isDownloading} className="text-xs sm:text-sm">
              {isDownloading ? <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" /> : <Download className="h-4 w-4 sm:mr-2" />}
              <span className="hidden sm:inline">{isDownloading ? 'Generating...' : 'PDF'}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleShareToPortal} disabled={isSharing} className="text-xs sm:text-sm">
              {isSharing ? <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" /> : <Share2 className="h-4 w-4 sm:mr-2" />}
              <span className="hidden sm:inline">{isSharing ? 'Creating...' : 'Share'}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={onClone} className="text-xs sm:text-sm">
              <Copy className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Clone</span>
            </Button>
            {estimate.status !== 'converted' && (
              <Button variant="outline" size="sm" onClick={onConvert} className="text-xs sm:text-sm">
                <ArrowRight className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Invoice</span>
              </Button>
            )}
          </div>
        </div>
        
        {shareLink && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between gap-2">
            <div className="flex-1 text-sm truncate">{shareLink}</div>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(shareLink); toast({ title: 'Copied!' }); }}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div id={`quote-preview-${estimate.id}`} className="bg-white p-2 sm:p-6 print:p-0 overflow-x-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
            <div className="flex items-start gap-3 sm:gap-4">
              <img src={logo} alt="Oakstreet Events" className="h-10 sm:h-16 w-auto bg-primary p-1 sm:p-2 rounded" />
              <div className="text-xs sm:text-sm">
                <h1 className="text-base sm:text-xl font-bold">{companySettings?.companyName || 'Oakstreet Events'}</h1>
                <p className="text-muted-foreground whitespace-pre-line hidden sm:block">
                  {companySettings?.address || '2nd Floor, Above Devas Studio\nDeshabhimani press road\nKochi Kerala 682017\nIndia'}
                </p>
                <p>{companySettings?.phone || '7902373354'}</p>
                <p className="hidden sm:block">{companySettings?.email || 'oakstreetevents18@gmail.com'}</p>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <h2 className="text-xl sm:text-3xl font-bold text-primary">Quote</h2>
            </div>
          </div>

          {/* Quote Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 text-xs sm:text-sm">
            <div>
              <p className="text-muted-foreground">Estimate No</p>
              <p className="font-medium">: {estimate.number}</p>
              <p className="text-muted-foreground mt-2">Quote Date</p>
              <p className="font-medium">: {format(new Date(estimate.date), 'dd/MM/yyyy')}</p>
              {estimate.weddingPlannerName && (
                <>
                  <p className="text-muted-foreground mt-2">Wedding Planner</p>
                  <p className="font-medium">: {estimate.weddingPlannerName}</p>
                </>
              )}
            </div>
            <div>
              <p className="text-muted-foreground">Bill To</p>
              <p className="font-medium">{customer?.name || '—'}</p>
              <p className="whitespace-pre-line">{estimate.customerAddress || customer?.billingAddress || ''}</p>
            </div>
          </div>

          {estimate.subject && (
            <div className="mb-6 text-xs sm:text-sm">
              <p className="text-muted-foreground">Subject:</p>
              <p className="font-medium">{estimate.subject}</p>
            </div>
          )}

          {/* Line Items */}
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-xs sm:text-sm border-collapse min-w-[400px]">
              <thead>
                <tr className="border-y">
                  <th className="p-2 text-left w-12">Sl No</th>
                  <th className="p-2 text-left">Item & Description</th>
                  <th className="p-2 text-right w-16">Qty</th>
                  <th className="p-2 text-right w-24">Rate</th>
                  <th className="p-2 text-right w-28">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(estimate.lineItems || []).map((item: LineItem, index: number) => (
                  <tr key={index} className={cn("border-b", item.isHeading && "bg-muted/30 font-bold")}>
                    <td className="p-2">{item.isHeading ? '' : item.slNo}</td>
                    <td className="p-2 whitespace-pre-line" colSpan={item.isHeading ? 4 : 1}>{item.name}</td>
                    {!item.isHeading && (
                      <>
                        <td className="p-2 text-right">{item.quantity.toFixed(2)}</td>
                        <td className="p-2 text-right">{formatIndianCurrency(item.rate)}</td>
                        <td className="p-2 text-right">{formatIndianCurrency(item.total)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex flex-col-reverse sm:flex-row gap-4 text-xs sm:text-sm">
            <div className="flex-1">
              <p className="font-medium">Total In Words</p>
              <p className="italic">{estimate.totalInWords}</p>
              
              {estimate.notes && (
                <div className="mt-4">
                  <p className="font-medium">Notes</p>
                  <p>{estimate.notes}</p>
                </div>
              )}

              {estimate.terms && (
                <div className="mt-4">
                  <p className="font-medium">Terms & Conditions</p>
                  <p className="whitespace-pre-line">{estimate.terms}</p>
                </div>
              )}
            </div>
            <div className="w-full sm:w-64 text-right">
              <div className="flex justify-between py-1">
                <span>Sub Total</span>
                <span>{formatIndianCurrency(parseFloat(estimate.subtotal))}</span>
              </div>
              {parseFloat(estimate.discountAmount || '0') > 0 && (
                <div className="flex justify-between py-1">
                  <span>Discount ({estimate.discountPercent}%)</span>
                  <span>- {formatIndianCurrency(parseFloat(estimate.discountAmount))}</span>
                </div>
              )}
              {parseFloat(estimate.serviceChargeAmount || '0') > 0 && (
                <div className="flex justify-between py-1">
                  <span>Service Charge ({estimate.serviceChargePercent}%)</span>
                  <span>{formatIndianCurrency(parseFloat(estimate.serviceChargeAmount))}</span>
                </div>
              )}
              <div className="flex justify-between py-2 border-t font-bold text-base sm:text-lg">
                <span>Total</span>
                <span>₹{parseFloat(estimate.total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Signature */}
          <div className="mt-8 text-right">
            <p className="text-sm text-muted-foreground">Authorized Signature</p>
            {estimate.signature && (
              <img src={estimate.signature} alt="Signature" className="h-16 ml-auto" />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InvoicesSection({ invoices, customers, banks, queryClient, toast, companySettings }: any) {
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      toast({ title: 'Invoice deleted' });
    },
  });

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsEditMode(false);
    setIsViewOpen(true);
  };

  const handleEditInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsEditMode(true);
    setIsViewOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <h1 className="text-xl sm:text-2xl font-bold">Invoices</h1>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Invoice #</th>
                  <th className="text-left p-3 font-medium">Customer</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Date</th>
                  <th className="text-right p-3 font-medium">Amount</th>
                  <th className="text-right p-3 font-medium">Balance</th>
                  <th className="text-center p-3 font-medium">Status</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice: Invoice) => (
                  <tr key={invoice.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => handleViewInvoice(invoice)}>
                    <td className="p-3 font-medium">{invoice.number}</td>
                    <td className="p-3">
                      {invoice.customerId ? customers.find((c: Customer) => c.id === invoice.customerId)?.name : '—'}
                    </td>
                    <td className="p-3 hidden md:table-cell">{format(new Date(invoice.date), 'dd/MM/yyyy')}</td>
                    <td className="p-3 text-right">{formatIndianCurrency(parseFloat(invoice.total))}</td>
                    <td className="p-3 text-right font-medium">{formatIndianCurrency(parseFloat(invoice.balanceDue))}</td>
                    <td className="p-3 text-center">
                      <Badge variant={invoice.status === 'paid' ? 'default' : parseFloat(invoice.balanceDue) > 0 ? 'destructive' : 'secondary'}>
                        {invoice.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleViewInvoice(invoice)} title="View">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEditInvoice(invoice)} title="Edit">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(invoice.id)} title="Delete">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      No invoices yet. Convert a quote to create an invoice.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {selectedInvoice && (
        <ViewEditInvoiceDialog
          open={isViewOpen}
          onOpenChange={(open: boolean) => {
            setIsViewOpen(open);
            if (!open) {
              setIsEditMode(false);
            }
          }}
          invoice={selectedInvoice}
          customers={customers}
          companySettings={companySettings}
          queryClient={queryClient}
          toast={toast}
          initialEditMode={isEditMode}
        />
      )}
    </div>
  );
}

function ViewEditInvoiceDialog({ open, onOpenChange, invoice, customers, companySettings, queryClient, toast, initialEditMode }: any) {
  const [isEditMode, setIsEditMode] = useState(initialEditMode);
  const [customerId, setCustomerId] = useState(invoice.customerId || '');
  const [date, setDate] = useState(invoice.date);
  const [dueDate, setDueDate] = useState(invoice.dueDate || '');
  const [subject, setSubject] = useState(invoice.subject || '');
  const [weddingPlannerName, setWeddingPlannerName] = useState(invoice.weddingPlannerName || '');
  const [customerAddress, setCustomerAddress] = useState(invoice.customerAddress || '');
  const [lineItems, setLineItems] = useState<LineItem[]>(invoice.lineItems || []);
  const [discountPercent, setDiscountPercent] = useState(parseFloat(invoice.discountPercent || '0'));
  const [serviceChargePercent, setServiceChargePercent] = useState(parseFloat(invoice.serviceChargePercent || '12.5'));
  const [notes, setNotes] = useState(invoice.notes || '');
  const [terms, setTerms] = useState(invoice.terms || DEFAULT_TERMS);
  const [status, setStatus] = useState(invoice.status);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);

  const customer = customers.find((c: Customer) => c.id === customerId);

  useEffect(() => {
    setIsEditMode(initialEditMode);
    setCustomerId(invoice.customerId || '');
    setDate(invoice.date);
    setDueDate(invoice.dueDate || '');
    setSubject(invoice.subject || '');
    setWeddingPlannerName(invoice.weddingPlannerName || '');
    setCustomerAddress(invoice.customerAddress || '');
    setLineItems(invoice.lineItems || []);
    setDiscountPercent(parseFloat(invoice.discountPercent || '0'));
    setServiceChargePercent(parseFloat(invoice.serviceChargePercent || '12.5'));
    setNotes(invoice.notes || '');
    setTerms(invoice.terms || DEFAULT_TERMS);
    setStatus(invoice.status);
  }, [invoice, initialEditMode]);

  const addLineItem = (isHeading: boolean = false) => {
    setLineItems([...lineItems, {
      slNo: isHeading ? undefined : lineItems.filter(i => !i.isHeading).length + 1,
      name: '',
      description: '',
      quantity: isHeading ? 0 : 1,
      rate: 0,
      total: 0,
      isHeading,
    }]);
  };

  const updateLineItem = (index: number, field: string, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'quantity' || field === 'rate') {
      updated[index].total = updated[index].quantity * updated[index].rate;
    }
    setLineItems(updated);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const subtotal = lineItems.filter(i => !i.isHeading).reduce((sum, item) => sum + item.total, 0);
  const discountAmount = subtotal * (discountPercent / 100);
  const afterDiscount = subtotal - discountAmount;
  const serviceChargeAmount = afterDiscount * (serviceChargePercent / 100);
  const total = afterDiscount + serviceChargeAmount;
  const balanceDue = total - (parseFloat(invoice.total) - parseFloat(invoice.balanceDue));

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update invoice');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      setIsEditMode(false);
      toast({ title: 'Invoice updated successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to update invoice', variant: 'destructive' });
    },
  });

  const handleSave = () => {
    let itemCounter = 1;
    const reindexedLineItems = lineItems.map(item => ({
      ...item,
      slNo: item.isHeading ? undefined : itemCounter++,
      quantity: Number(item.quantity),
      rate: Number(item.rate),
      total: Number(item.quantity) * Number(item.rate),
    }));

    const calcSubtotal = reindexedLineItems.filter(i => !i.isHeading).reduce((sum, item) => sum + (item.total || 0), 0);
    const calcDiscountAmount = calcSubtotal * (discountPercent / 100);
    const calcAfterDiscount = calcSubtotal - calcDiscountAmount;
    const calcServiceChargeAmount = calcAfterDiscount * (serviceChargePercent / 100);
    const calcTotal = calcAfterDiscount + calcServiceChargeAmount;
    
    const originalPaid = parseFloat(invoice.total) - parseFloat(invoice.balanceDue);
    const calcBalanceDue = Math.max(0, calcTotal - originalPaid);
    
    const newStatus = calcBalanceDue <= 0 ? 'paid' : 
                      originalPaid > 0 ? 'partial' : 
                      status;

    updateMutation.mutate({
      customerId: customerId || null,
      date,
      dueDate: dueDate || null,
      subject,
      weddingPlannerName,
      customerAddress,
      lineItems: reindexedLineItems,
      subtotal: calcSubtotal.toFixed(2),
      discountPercent: discountPercent.toFixed(2),
      discountAmount: calcDiscountAmount.toFixed(2),
      serviceChargePercent: serviceChargePercent.toFixed(2),
      serviceChargeAmount: calcServiceChargeAmount.toFixed(2),
      taxTotal: '0',
      total: calcTotal.toFixed(2),
      totalInWords: `Indian Rupee ${numberToWords(Math.round(calcTotal))} Only`,
      balanceDue: calcBalanceDue.toFixed(2),
      notes,
      terms,
      status: newStatus,
    });
  };

  if (isEditMode) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
              <DialogTitle className="text-base sm:text-lg">Edit Invoice - {invoice.number}</DialogTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsEditMode(false)} className="text-xs sm:text-sm">
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending} className="text-xs sm:text-sm">
                  {updateMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div>
                <Label className="text-xs sm:text-sm">Customer</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger className="text-xs sm:text-sm">
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c: Customer) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs sm:text-sm">Invoice Date</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="text-xs sm:text-sm" />
              </div>
              <div>
                <Label className="text-xs sm:text-sm">Due Date</Label>
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="text-xs sm:text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label className="text-xs sm:text-sm">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="text-xs sm:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="partial">Partially Paid</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs sm:text-sm">Wedding Planner</Label>
                <Input value={weddingPlannerName} onChange={e => setWeddingPlannerName(e.target.value)} className="text-xs sm:text-sm" />
              </div>
            </div>

            <div>
              <Label className="text-xs sm:text-sm">Customer Address</Label>
              <Textarea value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} rows={2} className="text-xs sm:text-sm" />
            </div>

            <div>
              <Label className="text-xs sm:text-sm">Subject</Label>
              <Textarea value={subject} onChange={e => setSubject(e.target.value)} rows={2} className="text-xs sm:text-sm" />
            </div>

            <div>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2">
                <Label className="text-xs sm:text-sm">Line Items</Label>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => addLineItem(true)} className="text-xs h-7 px-2">
                    + Section
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => addLineItem(false)} className="text-xs h-7 px-2">
                    + Item
                  </Button>
                </div>
              </div>
              
              <div className="border rounded-lg overflow-x-auto w-full">
                <table className="w-full text-xs sm:text-sm min-w-[450px]">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-2 text-left w-12">Sl No</th>
                      <th className="p-2 text-left">Item & Description</th>
                      <th className="p-2 text-right w-20">Qty</th>
                      <th className="p-2 text-right w-24">Rate</th>
                      <th className="p-2 text-right w-28">Amount</th>
                      <th className="p-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item, index) => (
                      <tr key={index} className={cn("border-t", item.isHeading && "bg-muted/30")}>
                        <td className="p-2">{item.isHeading ? '' : item.slNo}</td>
                        <td className="p-2" colSpan={item.isHeading ? 4 : 1}>
                          <Textarea
                            value={item.name}
                            onChange={e => updateLineItem(index, 'name', e.target.value)}
                            className={cn("min-h-[40px]", item.isHeading && "font-bold")}
                            rows={1}
                          />
                        </td>
                        {!item.isHeading && (
                          <>
                            <td className="p-2">
                              <Input
                                type="number"
                                value={item.quantity}
                                onChange={e => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                                className="text-right"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                value={item.rate}
                                onChange={e => updateLineItem(index, 'rate', parseFloat(e.target.value) || 0)}
                                className="text-right"
                              />
                            </td>
                            <td className="p-2 text-right font-medium">
                              {formatIndianCurrency(item.total)}
                            </td>
                          </>
                        )}
                        <td className="p-2">
                          <Button variant="ghost" size="sm" onClick={() => removeLineItem(index)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="w-full">
              <div className="w-full sm:w-80 sm:ml-auto space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between">
                  <span>Sub Total</span>
                  <span className="font-medium">{formatIndianCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="flex items-center gap-1">
                    Discount
                    <Input
                      type="number"
                      value={discountPercent}
                      onChange={e => setDiscountPercent(parseFloat(e.target.value) || 0)}
                      className="w-12 h-6 text-right text-xs"
                    />
                    %
                  </span>
                  <span>- {formatIndianCurrency(discountAmount)}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="flex items-center gap-1">
                    Service
                    <Input
                      type="number"
                      value={serviceChargePercent}
                      onChange={e => setServiceChargePercent(parseFloat(e.target.value) || 0)}
                      className="w-12 h-6 text-right text-xs"
                    />
                    %
                  </span>
                  <span>{formatIndianCurrency(serviceChargeAmount)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm sm:text-lg font-bold">
                  <span>Total</span>
                  <span>{formatIndianCurrency(total)}</span>
                </div>
                <div className="flex justify-between text-destructive font-bold text-sm sm:text-base">
                  <span>Balance Due</span>
                  <span>{formatIndianCurrency(balanceDue > 0 ? balanceDue : 0)}</span>
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs sm:text-sm">Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="text-xs sm:text-sm" />
            </div>

            <div>
              <Label className="text-xs sm:text-sm">Terms & Conditions</Label>
              <Textarea value={terms} onChange={e => setTerms(e.target.value)} rows={4} className="text-xs sm:text-sm" />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch(`/api/pdf/invoice/${invoice.id}`);
      if (!response.ok) throw new Error('Failed to generate PDF');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice-${invoice.number}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: 'PDF downloaded successfully!' });
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      toast({ title: 'Failed to download PDF', description: String(error), variant: 'destructive' });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShareToPortal = async () => {
    setIsSharing(true);
    try {
      const res = await fetch('/api/portal-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType: 'invoice',
          documentId: invoice.id,
          customerId: invoice.customerId,
        }),
      });
      if (!res.ok) throw new Error('Failed to create share link');
      const link = await res.json();
      const portalUrl = `${window.location.origin}/portal/${link.token}`;
      setShareLink(portalUrl);
      await navigator.clipboard.writeText(portalUrl);
      toast({ title: 'Link copied to clipboard!', description: 'Share this link with your customer.' });
    } catch (error) {
      console.error('Failed to share:', error);
      toast({ title: 'Failed to create share link', variant: 'destructive' });
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 pb-4 border-b">
          <div className="flex items-center gap-2">
            <Badge variant={invoice.status === 'paid' ? 'default' : parseFloat(invoice.balanceDue) > 0 ? 'destructive' : 'secondary'}>
              {invoice.status}
            </Badge>
            <span className="font-medium">{invoice.number}</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setIsEditMode(true)} className="text-xs sm:text-sm">
              <Edit className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Edit</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadPDF} disabled={isDownloading} className="text-xs sm:text-sm">
              {isDownloading ? <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" /> : <Download className="h-4 w-4 sm:mr-2" />}
              <span className="hidden sm:inline">{isDownloading ? 'Generating...' : 'PDF'}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleShareToPortal} disabled={isSharing} className="text-xs sm:text-sm">
              {isSharing ? <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" /> : <Share2 className="h-4 w-4 sm:mr-2" />}
              <span className="hidden sm:inline">{isSharing ? 'Creating...' : 'Share'}</span>
            </Button>
          </div>
        </div>

        {shareLink && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between gap-2">
            <div className="flex-1 text-sm truncate">{shareLink}</div>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(shareLink); toast({ title: 'Copied!' }); }}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div id={`invoice-preview-${invoice.id}`} className="bg-white p-2 sm:p-6 print:p-0 overflow-x-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
            <div className="flex items-start gap-3 sm:gap-4">
              <img src={logo} alt="Oakstreet Events" className="h-10 sm:h-16 w-auto bg-primary p-1 sm:p-2 rounded" />
              <div className="text-xs sm:text-sm">
                <h1 className="text-base sm:text-xl font-bold">{companySettings?.companyName || 'Oakstreet Events'}</h1>
                <p className="text-muted-foreground whitespace-pre-line hidden sm:block">
                  {companySettings?.address || '2nd Floor, Above Devas Studio\nDeshabhimani press road\nKochi Kerala 682017\nIndia'}
                </p>
                <p>{companySettings?.phone || '7902373354'}</p>
                <p className="hidden sm:block">{companySettings?.email || 'oakstreetevents18@gmail.com'}</p>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <h2 className="text-xl sm:text-3xl font-bold text-primary">Invoice</h2>
            </div>
          </div>

          {/* Invoice Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 text-xs sm:text-sm">
            <div>
              <p className="text-muted-foreground">Invoice No</p>
              <p className="font-medium">: {invoice.number}</p>
              <p className="text-muted-foreground mt-2">Invoice Date</p>
              <p className="font-medium">: {format(new Date(invoice.date), 'dd/MM/yyyy')}</p>
              {invoice.dueDate && (
                <>
                  <p className="text-muted-foreground mt-2">Due Date</p>
                  <p className="font-medium">: {format(new Date(invoice.dueDate), 'dd/MM/yyyy')}</p>
                </>
              )}
              {invoice.weddingPlannerName && (
                <>
                  <p className="text-muted-foreground mt-2">Wedding Planner</p>
                  <p className="font-medium">: {invoice.weddingPlannerName}</p>
                </>
              )}
            </div>
            <div>
              <p className="text-muted-foreground">Bill To</p>
              <p className="font-medium">{customer?.name || '—'}</p>
              <p className="whitespace-pre-line">{invoice.customerAddress || customer?.billingAddress || ''}</p>
            </div>
          </div>

          {invoice.subject && (
            <div className="mb-6 text-xs sm:text-sm">
              <p className="text-muted-foreground">Subject:</p>
              <p className="font-medium">{invoice.subject}</p>
            </div>
          )}

          {/* Line Items */}
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-xs sm:text-sm border-collapse min-w-[400px]">
              <thead>
                <tr className="border-y">
                  <th className="p-2 text-left w-12">Sl No</th>
                  <th className="p-2 text-left">Item & Description</th>
                  <th className="p-2 text-right w-16">Qty</th>
                  <th className="p-2 text-right w-24">Rate</th>
                  <th className="p-2 text-right w-28">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(invoice.lineItems || []).map((item: LineItem, index: number) => (
                  <tr key={index} className={cn("border-b", item.isHeading && "bg-muted/30 font-bold")}>
                    <td className="p-2">{item.isHeading ? '' : item.slNo}</td>
                    <td className="p-2 whitespace-pre-line" colSpan={item.isHeading ? 4 : 1}>{item.name}</td>
                    {!item.isHeading && (
                      <>
                        <td className="p-2 text-right">{item.quantity.toFixed(2)}</td>
                        <td className="p-2 text-right">{formatIndianCurrency(item.rate)}</td>
                        <td className="p-2 text-right">{formatIndianCurrency(item.total)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex flex-col-reverse sm:flex-row gap-4 text-xs sm:text-sm">
            <div className="flex-1">
              <p className="font-medium">Total In Words</p>
              <p className="italic">{invoice.totalInWords}</p>
              
              {invoice.notes && (
                <div className="mt-4">
                  <p className="font-medium">Notes</p>
                  <p>{invoice.notes}</p>
                </div>
              )}

              {invoice.terms && (
                <div className="mt-4">
                  <p className="font-medium">Terms & Conditions</p>
                  <p className="whitespace-pre-line">{invoice.terms}</p>
                </div>
              )}
            </div>
            <div className="w-full sm:w-64 text-right">
              <div className="flex justify-between py-1">
                <span>Sub Total</span>
                <span>{formatIndianCurrency(parseFloat(invoice.subtotal))}</span>
              </div>
              {parseFloat(invoice.discountAmount || '0') > 0 && (
                <div className="flex justify-between py-1">
                  <span>Discount ({invoice.discountPercent}%)</span>
                  <span>- {formatIndianCurrency(parseFloat(invoice.discountAmount))}</span>
                </div>
              )}
              {parseFloat(invoice.serviceChargeAmount || '0') > 0 && (
                <div className="flex justify-between py-1">
                  <span>Service Charge ({invoice.serviceChargePercent}%)</span>
                  <span>{formatIndianCurrency(parseFloat(invoice.serviceChargeAmount))}</span>
                </div>
              )}
              <div className="flex justify-between py-2 border-t font-bold text-base sm:text-lg">
                <span>Total</span>
                <span>₹{parseFloat(invoice.total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between py-2 border-t font-bold text-destructive text-base sm:text-lg">
                <span>Balance Due</span>
                <span>₹{parseFloat(invoice.balanceDue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Signature */}
          <div className="mt-8 text-right">
            <p className="text-xs sm:text-sm text-muted-foreground">Authorized Signature</p>
            {invoice.signature && (
              <img src={invoice.signature} alt="Signature" className="h-12 sm:h-16 ml-auto" />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PaymentsReceivedSection({ payments, customers, invoices, banks, queryClient, toast, companySettings }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<CustomerPayment | null>(null);
  const [formData, setFormData] = useState({
    customerId: '', invoiceId: '', amount: '', date: format(new Date(), 'yyyy-MM-dd'),
    paymentMode: 'bank_transfer', bankId: '', reference: '', notes: ''
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const numberRes = await fetch('/api/document-sequences/receipt/next');
      const { number } = await numberRes.json();
      
      const res = await fetch('/api/customer-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, number }),
      });
      if (!res.ok) throw new Error('Failed to create payment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customer-payments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/banks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/daybook-entries'] });
      setIsOpen(false);
      toast({ title: 'Payment recorded successfully' });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <h1 className="text-xl sm:text-2xl font-bold">Payments Received</h1>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="w-full sm:w-auto"><Plus className="h-4 w-4 mr-2" /> Record Payment</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Customer Payment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Customer</Label>
                <Select value={formData.customerId} onValueChange={v => setFormData({...formData, customerId: v})}>
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>
                    {customers.map((c: Customer) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Invoice (Optional)</Label>
                <Select value={formData.invoiceId} onValueChange={v => setFormData({...formData, invoiceId: v})}>
                  <SelectTrigger><SelectValue placeholder="Select invoice" /></SelectTrigger>
                  <SelectContent>
                    {invoices.filter((i: Invoice) => parseFloat(i.balanceDue) > 0).map((i: Invoice) => (
                      <SelectItem key={i.id} value={i.id}>{i.number} - {formatIndianCurrency(parseFloat(i.balanceDue))}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Amount</Label>
                  <Input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                </div>
                <div>
                  <Label>Date</Label>
                  <Input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Payment Mode</Label>
                  <Select value={formData.paymentMode} onValueChange={v => setFormData({...formData, paymentMode: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_MODES.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Bank Account</Label>
                  <Select value={formData.bankId} onValueChange={v => setFormData({...formData, bankId: v})}>
                    <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
                    <SelectContent>
                      {banks.map((b: Bank) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Reference</Label>
                <Input value={formData.reference} onChange={e => setFormData({...formData, reference: e.target.value})} />
              </div>
              <Button onClick={() => createMutation.mutate(formData)} disabled={!formData.amount || createMutation.isPending} className="w-full">
                {createMutation.isPending ? 'Recording...' : 'Record Payment'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Receipt #</th>
                  <th className="text-left p-3 font-medium">Customer</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Date</th>
                  <th className="text-right p-3 font-medium">Amount</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Mode</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment: CustomerPayment) => (
                  <tr key={payment.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => { setSelectedPayment(payment); setIsViewOpen(true); }}>
                    <td className="p-3 font-medium">{payment.number}</td>
                    <td className="p-3">
                      {payment.customerId ? customers.find((c: Customer) => c.id === payment.customerId)?.name : '—'}
                    </td>
                    <td className="p-3 hidden md:table-cell">{format(new Date(payment.date), 'dd/MM/yyyy')}</td>
                    <td className="p-3 text-right font-medium text-green-600">{formatIndianCurrency(parseFloat(payment.amount))}</td>
                    <td className="p-3 hidden md:table-cell capitalize">{payment.paymentMode.replace('_', ' ')}</td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      No payments recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {selectedPayment && (
        <ViewPaymentReceiptDialog
          open={isViewOpen}
          onOpenChange={setIsViewOpen}
          payment={selectedPayment}
          customer={customers.find((c: Customer) => c.id === selectedPayment.customerId)}
          invoice={invoices.find((i: Invoice) => i.id === selectedPayment.invoiceId)}
          bank={banks.find((b: Bank) => b.id === selectedPayment.bankId)}
          companySettings={companySettings}
        />
      )}
    </div>
  );
}

function ViewPaymentReceiptDialog({ open, onOpenChange, payment, customer, invoice, bank, companySettings }: any) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const { toast } = useToast();

  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch(`/api/pdf/receipt/${payment.id}`);
      if (!response.ok) throw new Error('Failed to generate PDF');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Receipt-${payment.number}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: 'PDF downloaded successfully!' });
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      toast({ title: 'Failed to download PDF', description: String(error), variant: 'destructive' });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShareToPortal = async () => {
    setIsSharing(true);
    try {
      const res = await fetch('/api/portal-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType: 'payment_receipt',
          documentId: payment.id,
          customerId: payment.customerId,
        }),
      });
      if (!res.ok) throw new Error('Failed to create share link');
      const link = await res.json();
      const portalUrl = `${window.location.origin}/portal/${link.token}`;
      setShareLink(portalUrl);
      await navigator.clipboard.writeText(portalUrl);
      toast({ title: 'Link copied to clipboard!', description: 'Share this link with your customer.' });
    } catch (error) {
      console.error('Failed to share:', error);
      toast({ title: 'Failed to create share link', variant: 'destructive' });
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Toolbar */}
        <div className="flex justify-between items-center mb-4 pb-4 border-b">
          <div className="flex items-center gap-2">
            <Badge variant="default">Payment Receipt</Badge>
            <span className="font-medium">{payment.number}</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleDownloadPDF} disabled={isDownloading}>
              {isDownloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              {isDownloading ? 'Generating...' : 'Download PDF'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleShareToPortal} disabled={isSharing}>
              {isSharing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Share2 className="h-4 w-4 mr-2" />}
              {isSharing ? 'Creating...' : 'Share'}
            </Button>
          </div>
        </div>

        {shareLink && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between gap-2">
            <div className="flex-1 text-sm truncate">{shareLink}</div>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(shareLink); toast({ title: 'Copied!' }); }}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div id={`receipt-preview-${payment.id}`} className="bg-white p-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-start gap-4">
              <img src={logo} alt="Oakstreet Events" className="h-16 w-auto bg-primary p-2 rounded" />
              <div>
                <h1 className="text-xl font-bold">{companySettings?.companyName || 'Oakstreet Events'}</h1>
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {companySettings?.address || '2nd Floor, Above Devas Studio\nDeshabhimani press road\nKochi Kerala 682017\nIndia'}
                </p>
                <p className="text-sm">{companySettings?.phone || '7902373354'}</p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-3xl font-bold text-green-600">Payment Receipt</h2>
            </div>
          </div>

          {/* Receipt Details */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="space-y-2">
              <div>
                <p className="text-sm text-muted-foreground">Receipt No</p>
                <p className="font-medium">{payment.number}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Date</p>
                <p className="font-medium">{format(new Date(payment.date), 'dd/MM/yyyy')}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Payment Mode</p>
                <p className="font-medium capitalize">{payment.paymentMode.replace('_', ' ')}</p>
              </div>
              {payment.reference && (
                <div>
                  <p className="text-sm text-muted-foreground">Reference</p>
                  <p className="font-medium">{payment.reference}</p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-muted-foreground">Received From</p>
                <p className="font-medium">{customer?.name || '—'}</p>
              </div>
              {invoice && (
                <div>
                  <p className="text-sm text-muted-foreground">Against Invoice</p>
                  <p className="font-medium">{invoice.number}</p>
                </div>
              )}
              {bank && (
                <div>
                  <p className="text-sm text-muted-foreground">Deposited To</p>
                  <p className="font-medium">{bank.name}</p>
                </div>
              )}
            </div>
          </div>

          {/* Amount */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6 text-center">
            <p className="text-sm text-muted-foreground mb-2">Amount Received</p>
            <p className="text-4xl font-bold text-green-600">{formatIndianCurrency(parseFloat(payment.amount))}</p>
            <p className="text-sm mt-2 italic">Indian Rupee {numberToWords(Math.round(parseFloat(payment.amount)))} Only</p>
          </div>

          {payment.notes && (
            <div className="mb-6">
              <p className="text-sm text-muted-foreground">Notes</p>
              <p className="text-sm">{payment.notes}</p>
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-between items-end mt-8">
            <div>
              <p className="text-sm text-muted-foreground">Thank you for your payment!</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Authorized Signature</p>
              <div className="h-16 w-32 border-b border-gray-300 mt-8"></div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function VendorsSection({ vendors, queryClient, toast }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', gstNumber: '', category: '', billingAddress: ''
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create vendor');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendors'] });
      setIsOpen(false);
      setFormData({ name: '', email: '', phone: '', gstNumber: '', category: '', billingAddress: '' });
      toast({ title: 'Vendor created successfully' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/vendors/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete vendor');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendors'] });
      toast({ title: 'Vendor deleted' });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <h1 className="text-xl sm:text-2xl font-bold">Vendors</h1>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="w-full sm:w-auto"><Plus className="h-4 w-4 mr-2" /> New Vendor</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Vendor</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name *</Label>
                <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={v => setFormData({...formData, category: v})}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map(c => (
                      <SelectItem key={c} value={c.toLowerCase()}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              </div>
              <Button onClick={() => createMutation.mutate(formData)} disabled={!formData.name || createMutation.isPending} className="w-full">
                {createMutation.isPending ? 'Creating...' : 'Create Vendor'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Category</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Phone</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((vendor: Vendor) => (
                  <tr key={vendor.id} className="border-t">
                    <td className="p-3 font-medium">{vendor.name}</td>
                    <td className="p-3 hidden md:table-cell capitalize">{vendor.category || '—'}</td>
                    <td className="p-3 hidden md:table-cell">{vendor.phone || '—'}</td>
                    <td className="p-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(vendor.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {vendors.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-muted-foreground">
                      No vendors yet. Click "New Vendor" to add one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ExpensesSection({ expenses, vendors, banks, queryClient, toast }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    vendorId: '', category: '', description: '', amount: '', taxAmount: '0',
    date: format(new Date(), 'yyyy-MM-dd'), bankId: ''
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const numberRes = await fetch('/api/document-sequences/expense/next');
      const { number } = await numberRes.json();
      
      const total = parseFloat(data.amount) + parseFloat(data.taxAmount || '0');
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, number, total: total.toString() }),
      });
      if (!res.ok) throw new Error('Failed to create expense');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/expenses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/banks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/daybook-entries'] });
      setIsOpen(false);
      toast({ title: 'Expense recorded successfully' });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <h1 className="text-xl sm:text-2xl font-bold">Expenses</h1>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="w-full sm:w-auto"><Plus className="h-4 w-4 mr-2" /> Record Expense</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Expense</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Vendor</Label>
                <Select value={formData.vendorId} onValueChange={v => setFormData({...formData, vendorId: v})}>
                  <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                  <SelectContent>
                    {vendors.map((v: Vendor) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={v => setFormData({...formData, category: v})}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map(c => (
                      <SelectItem key={c} value={c.toLowerCase()}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Description</Label>
                <Input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Amount</Label>
                  <Input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                </div>
                <div>
                  <Label>Date</Label>
                  <Input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                </div>
              </div>
              <div>
                <Label>Pay From Bank</Label>
                <Select value={formData.bankId} onValueChange={v => setFormData({...formData, bankId: v})}>
                  <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
                  <SelectContent>
                    {banks.map((b: Bank) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => createMutation.mutate(formData)} disabled={!formData.amount || !formData.category || !formData.description || createMutation.isPending} className="w-full">
                {createMutation.isPending ? 'Recording...' : 'Record Expense'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Expense #</th>
                  <th className="text-left p-3 font-medium">Description</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Vendor</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Date</th>
                  <th className="text-right p-3 font-medium">Amount</th>
                  <th className="text-center p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense: Expense) => (
                  <tr key={expense.id} className="border-t">
                    <td className="p-3 font-medium">{expense.number}</td>
                    <td className="p-3">{expense.description}</td>
                    <td className="p-3 hidden md:table-cell">
                      {expense.vendorId ? vendors.find((v: Vendor) => v.id === expense.vendorId)?.name : '—'}
                    </td>
                    <td className="p-3 hidden md:table-cell">{format(new Date(expense.date), 'dd/MM/yyyy')}</td>
                    <td className="p-3 text-right font-medium text-red-600">{formatIndianCurrency(parseFloat(expense.total))}</td>
                    <td className="p-3 text-center">
                      <Badge variant={expense.status === 'paid' ? 'default' : 'secondary'}>{expense.status}</Badge>
                    </td>
                  </tr>
                ))}
                {expenses.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No expenses recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function VendorPaymentsSection({ payments, vendors, expenses, banks, queryClient, toast }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    vendorId: '', expenseId: '', amount: '', date: format(new Date(), 'yyyy-MM-dd'),
    paymentMode: 'bank_transfer', bankId: '', reference: '', notes: ''
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const numberRes = await fetch('/api/document-sequences/vendor_payment/next');
      const { number } = await numberRes.json();
      
      const res = await fetch('/api/vendor-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, number }),
      });
      if (!res.ok) throw new Error('Failed to create payment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendor-payments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/expenses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/banks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/daybook-entries'] });
      setIsOpen(false);
      toast({ title: 'Vendor payment recorded successfully' });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <h1 className="text-xl sm:text-2xl font-bold">Vendor Payments</h1>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="w-full sm:w-auto"><Plus className="h-4 w-4 mr-2" /> Record Payment</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Vendor Payment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Vendor</Label>
                <Select value={formData.vendorId} onValueChange={v => setFormData({...formData, vendorId: v})}>
                  <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                  <SelectContent>
                    {vendors.map((v: Vendor) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Amount</Label>
                  <Input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                </div>
                <div>
                  <Label>Date</Label>
                  <Input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Payment Mode</Label>
                  <Select value={formData.paymentMode} onValueChange={v => setFormData({...formData, paymentMode: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_MODES.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Bank Account</Label>
                  <Select value={formData.bankId} onValueChange={v => setFormData({...formData, bankId: v})}>
                    <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
                    <SelectContent>
                      {banks.map((b: Bank) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Reference</Label>
                <Input value={formData.reference} onChange={e => setFormData({...formData, reference: e.target.value})} />
              </div>
              <Button onClick={() => createMutation.mutate(formData)} disabled={!formData.amount || createMutation.isPending} className="w-full">
                {createMutation.isPending ? 'Recording...' : 'Record Payment'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Payment #</th>
                  <th className="text-left p-3 font-medium">Vendor</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Date</th>
                  <th className="text-right p-3 font-medium">Amount</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Mode</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment: VendorPayment) => (
                  <tr key={payment.id} className="border-t">
                    <td className="p-3 font-medium">{payment.number}</td>
                    <td className="p-3">
                      {payment.vendorId ? vendors.find((v: Vendor) => v.id === payment.vendorId)?.name : '—'}
                    </td>
                    <td className="p-3 hidden md:table-cell">{format(new Date(payment.date), 'dd/MM/yyyy')}</td>
                    <td className="p-3 text-right font-medium text-red-600">{formatIndianCurrency(parseFloat(payment.amount))}</td>
                    <td className="p-3 hidden md:table-cell capitalize">{payment.paymentMode.replace('_', ' ')}</td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      No vendor payments recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsSection({ companySettings, queryClient, toast }: any) {
  const [formData, setFormData] = useState({
    companyName: companySettings?.companyName || 'Oakstreet Events',
    address: companySettings?.address || '',
    phone: companySettings?.phone || '',
    email: companySettings?.email || '',
    website: companySettings?.website || '',
    gstNumber: companySettings?.gstNumber || '',
    defaultTerms: companySettings?.defaultTerms || DEFAULT_TERMS,
    defaultThankYouMessage: companySettings?.defaultThankYouMessage || 'Looking forward for your business.',
  });

  useEffect(() => {
    if (companySettings) {
      setFormData({
        companyName: companySettings.companyName || 'Oakstreet Events',
        address: companySettings.address || '',
        phone: companySettings.phone || '',
        email: companySettings.email || '',
        website: companySettings.website || '',
        gstNumber: companySettings.gstNumber || '',
        defaultTerms: companySettings.defaultTerms || DEFAULT_TERMS,
        defaultThankYouMessage: companySettings.defaultThankYouMessage || 'Looking forward for your business.',
      });
    }
  }, [companySettings]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/company-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update settings');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/company-settings'] });
      toast({ title: 'Settings updated successfully' });
    },
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Company Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Company Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Company Name</Label>
            <Input value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} />
          </div>
          <div>
            <Label>Address</Label>
            <Textarea value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} rows={3} />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Phone</Label>
              <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Website</Label>
              <Input value={formData.website} onChange={e => setFormData({...formData, website: e.target.value})} />
            </div>
            <div>
              <Label>GST Number</Label>
              <Input value={formData.gstNumber} onChange={e => setFormData({...formData, gstNumber: e.target.value})} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Default Templates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Default Thank You Message</Label>
            <Textarea value={formData.defaultThankYouMessage} onChange={e => setFormData({...formData, defaultThankYouMessage: e.target.value})} rows={2} />
          </div>
          <div>
            <Label>Default Terms & Conditions</Label>
            <Textarea value={formData.defaultTerms} onChange={e => setFormData({...formData, defaultTerms: e.target.value})} rows={8} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={() => updateMutation.mutate(formData)} disabled={updateMutation.isPending}>
        {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
      </Button>
    </div>
  );
}

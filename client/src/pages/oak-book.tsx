import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import {
  LayoutDashboard,
  Users,
  Building2,
  Package,
  FileText,
  Receipt,
  CreditCard,
  Wallet,
  FileSpreadsheet,
  Landmark,
  BarChart3,
  Settings,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Eye,
  Download,
  ChevronRight,
  ChevronDown,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Menu,
  X
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from "recharts";

type SidebarSection = {
  id: string;
  label: string;
  icon: any;
  children?: { id: string; label: string }[];
};

const SIDEBAR_SECTIONS: SidebarSection[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "customers", label: "Customers", icon: Users },
  { id: "vendors", label: "Vendors", icon: Building2 },
  { id: "items", label: "Items", icon: Package },
  { 
    id: "sales", 
    label: "Sales", 
    icon: TrendingUp,
    children: [
      { id: "estimates", label: "Estimates" },
      { id: "invoices", label: "Invoices" },
      { id: "payments-received", label: "Payments Received" },
    ]
  },
  { 
    id: "purchases", 
    label: "Purchases", 
    icon: TrendingDown,
    children: [
      { id: "expenses", label: "Expenses" },
      { id: "bills", label: "Bills" },
    ]
  },
  { id: "banking", label: "Banking", icon: Landmark },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];

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

type Item = {
  id: string;
  name: string;
  description: string | null;
  type: string;
  rate: string;
  unit: string | null;
  taxRate: string | null;
  hsnCode: string | null;
  sku: string | null;
  isActive: boolean | null;
};

type Estimate = {
  id: string;
  number: string;
  customerId: string | null;
  date: string;
  status: string;
  total: string;
};

type Invoice = {
  id: string;
  number: string;
  customerId: string | null;
  date: string;
  status: string;
  total: string;
  balanceDue: string;
};

type CustomerPayment = {
  id: string;
  number: string;
  customerId: string | null;
  amount: string;
  date: string;
  paymentMode: string;
};

type Expense = {
  id: string;
  number: string;
  vendorId: string | null;
  category: string;
  description: string;
  total: string;
  date: string;
  status: string;
};

type Bill = {
  id: string;
  number: string;
  vendorId: string | null;
  date: string;
  status: string;
  total: string;
  balanceDue: string;
};

type Bank = {
  id: string;
  name: string;
  accountNumber: string | null;
  balance: string;
};

export default function OakBook() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState("dashboard");
  const [expandedMenus, setExpandedMenus] = useState<string[]>(["sales", "purchases"]);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [vendorModalOpen, setVendorModalOpen] = useState(false);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const { data: itemsList = [] } = useQuery<Item[]>({
    queryKey: ["/api/items"],
  });

  const { data: estimates = [] } = useQuery<Estimate[]>({
    queryKey: ["/api/estimates"],
  });

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const { data: payments = [] } = useQuery<CustomerPayment[]>({
    queryKey: ["/api/customer-payments"],
  });

  const { data: expenses = [] } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  const { data: billsList = [] } = useQuery<Bill[]>({
    queryKey: ["/api/bills"],
  });

  const { data: banks = [] } = useQuery<Bank[]>({
    queryKey: ["/api/banks"],
  });

  const createCustomer = useMutation({
    mutationFn: (data: Partial<Customer>) => apiRequest("POST", "/api/customers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setCustomerModalOpen(false);
      setEditingCustomer(null);
      toast({ title: "Customer created successfully" });
    },
  });

  const updateCustomer = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Customer> }) =>
      apiRequest("PATCH", `/api/customers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setCustomerModalOpen(false);
      setEditingCustomer(null);
      toast({ title: "Customer updated successfully" });
    },
  });

  const deleteCustomer = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/customers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: "Customer deleted" });
    },
  });

  const createVendor = useMutation({
    mutationFn: (data: Partial<Vendor>) => apiRequest("POST", "/api/vendors", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      setVendorModalOpen(false);
      setEditingVendor(null);
      toast({ title: "Vendor created successfully" });
    },
  });

  const updateVendor = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Vendor> }) =>
      apiRequest("PATCH", `/api/vendors/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      setVendorModalOpen(false);
      setEditingVendor(null);
      toast({ title: "Vendor updated successfully" });
    },
  });

  const deleteVendor = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/vendors/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      toast({ title: "Vendor deleted" });
    },
  });

  const createItem = useMutation({
    mutationFn: (data: Partial<Item>) => apiRequest("POST", "/api/items", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      setItemModalOpen(false);
      setEditingItem(null);
      toast({ title: "Item created successfully" });
    },
  });

  const updateItem = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Item> }) =>
      apiRequest("PATCH", `/api/items/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      setItemModalOpen(false);
      setEditingItem(null);
      toast({ title: "Item updated successfully" });
    },
  });

  const deleteItem = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      toast({ title: "Item deleted" });
    },
  });

  const toggleMenu = (menuId: string) => {
    setExpandedMenus((prev) =>
      prev.includes(menuId)
        ? prev.filter((id) => id !== menuId)
        : [...prev, menuId]
    );
  };

  const handleNavClick = (sectionId: string) => {
    setActiveSection(sectionId);
    setMobileMenuOpen(false);
  };

  const totalIncome = useMemo(() => {
    return payments.reduce((sum, p) => sum + parseFloat(p.amount || "0"), 0);
  }, [payments]);

  const totalExpenses = useMemo(() => {
    return expenses.reduce((sum, e) => sum + parseFloat(e.total || "0"), 0);
  }, [expenses]);

  const totalReceivables = useMemo(() => {
    return invoices.reduce((sum, i) => sum + parseFloat(i.balanceDue || "0"), 0);
  }, [invoices]);

  const totalPayables = useMemo(() => {
    return billsList.reduce((sum, b) => sum + parseFloat(b.balanceDue || "0"), 0);
  }, [billsList]);

  const cashFlowData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);
      
      const monthIncome = payments
        .filter((p) => {
          const pDate = new Date(p.date);
          return pDate >= monthStart && pDate <= monthEnd;
        })
        .reduce((sum, p) => sum + parseFloat(p.amount || "0"), 0);
      
      const monthExpense = expenses
        .filter((e) => {
          const eDate = new Date(e.date);
          return eDate >= monthStart && eDate <= monthEnd;
        })
        .reduce((sum, e) => sum + parseFloat(e.total || "0"), 0);
      
      months.push({
        month: format(date, "MMM"),
        income: monthIncome,
        expense: monthExpense,
      });
    }
    return months;
  }, [payments, expenses]);

  const incomeVsExpenseData = [
    { name: "Income", value: totalIncome, color: "#22c55e" },
    { name: "Expenses", value: totalExpenses, color: "#ef4444" },
  ];

  const renderSidebar = () => (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <div className="p-4 border-b border-sidebar-border">
        <h2 className="text-lg font-serif font-semibold text-primary">Oak Book</h2>
        <p className="text-xs text-sidebar-foreground/60">Accounting & Invoicing</p>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {SIDEBAR_SECTIONS.map((section) => (
            <div key={section.id}>
              {section.children ? (
                <>
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-between text-sm font-medium",
                      expandedMenus.includes(section.id) && "bg-sidebar-accent/50"
                    )}
                    onClick={() => toggleMenu(section.id)}
                    data-testid={`nav-${section.id}`}
                  >
                    <span className="flex items-center gap-2">
                      <section.icon className="h-4 w-4" />
                      {section.label}
                    </span>
                    {expandedMenus.includes(section.id) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                  {expandedMenus.includes(section.id) && (
                    <div className="ml-6 space-y-1 mt-1">
                      {section.children.map((child) => (
                        <Button
                          key={child.id}
                          variant="ghost"
                          className={cn(
                            "w-full justify-start text-sm",
                            activeSection === child.id &&
                              "bg-sidebar-accent text-sidebar-accent-foreground"
                          )}
                          onClick={() => handleNavClick(child.id)}
                          data-testid={`nav-${child.id}`}
                        >
                          {child.label}
                        </Button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start gap-2 text-sm font-medium",
                    activeSection === section.id &&
                      "bg-sidebar-accent text-sidebar-accent-foreground"
                  )}
                  onClick={() => handleNavClick(section.id)}
                  data-testid={`nav-${section.id}`}
                >
                  <section.icon className="h-4 w-4" />
                  {section.label}
                </Button>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-serif font-bold text-primary">Dashboard</h1>
        <div className="text-sm text-muted-foreground">
          {format(new Date(), "MMMM yyyy")}
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4 text-green-500" />
              Total Income
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{(totalIncome / 100000).toFixed(2)}L</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ArrowDownRight className="h-4 w-4 text-red-500" />
              Total Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{(totalExpenses / 100000).toFixed(2)}L</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-blue-500" />
              Receivables
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{(totalReceivables / 100000).toFixed(2)}L</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4 text-orange-500" />
              Payables
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{(totalPayables / 100000).toFixed(2)}L</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-serif">Cash Flow</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashFlowData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} />
                  <Tooltip
                    formatter={(value: number) => [`₹${value.toLocaleString("en-IN")}`, ""]}
                  />
                  <Area
                    type="monotone"
                    dataKey="income"
                    stackId="1"
                    stroke="#22c55e"
                    fill="#22c55e"
                    fillOpacity={0.3}
                    name="Income"
                  />
                  <Area
                    type="monotone"
                    dataKey="expense"
                    stackId="2"
                    stroke="#ef4444"
                    fill="#ef4444"
                    fillOpacity={0.3}
                    name="Expenses"
                  />
                  <Legend />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-serif">Income vs Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={incomeVsExpenseData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {incomeVsExpenseData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`₹${value.toLocaleString("en-IN")}`, ""]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-serif">Recent Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invoices.slice(0, 5).map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                >
                  <div>
                    <p className="font-medium text-sm">{invoice.number}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(invoice.date), "dd MMM yyyy")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-sm">₹{parseFloat(invoice.total).toLocaleString("en-IN")}</p>
                    <Badge variant={invoice.status === "paid" ? "default" : "secondary"} className="text-xs">
                      {invoice.status}
                    </Badge>
                  </div>
                </div>
              ))}
              {invoices.length === 0 && (
                <p className="text-center py-4 text-muted-foreground text-sm">No invoices yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-serif">Recent Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {expenses.slice(0, 5).map((expense) => (
                <div
                  key={expense.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                >
                  <div>
                    <p className="font-medium text-sm">{expense.category}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                      {expense.description}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-sm">₹{parseFloat(expense.total).toLocaleString("en-IN")}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(expense.date), "dd MMM")}
                    </p>
                  </div>
                </div>
              ))}
              {expenses.length === 0 && (
                <p className="text-center py-4 text-muted-foreground text-sm">No expenses yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-serif">Bank Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {banks.map((bank) => (
                <div
                  key={bank.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                >
                  <div>
                    <p className="font-medium text-sm">{bank.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {bank.accountNumber ? `****${bank.accountNumber.slice(-4)}` : "N/A"}
                    </p>
                  </div>
                  <p className="font-medium text-sm">₹{parseFloat(bank.balance).toLocaleString("en-IN")}</p>
                </div>
              ))}
              {banks.length === 0 && (
                <p className="text-center py-4 text-muted-foreground text-sm">No bank accounts</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderCustomers = () => {
    const filteredCustomers = customers.filter(
      (c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-serif font-bold text-primary">Customers</h1>
          <Button onClick={() => { setEditingCustomer(null); setCustomerModalOpen(true); }} data-testid="btn-add-customer">
            <Plus className="h-4 w-4 mr-2" />
            Add Customer
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-customers"
            />
          </div>
        </div>

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-4 font-medium text-muted-foreground">Name</th>
                  <th className="text-left p-4 font-medium text-muted-foreground hidden sm:table-cell">Email</th>
                  <th className="text-left p-4 font-medium text-muted-foreground hidden md:table-cell">Phone</th>
                  <th className="text-left p-4 font-medium text-muted-foreground hidden lg:table-cell">GST No.</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="border-b hover:bg-muted/50" data-testid={`row-customer-${customer.id}`}>
                    <td className="p-4 font-medium">{customer.name}</td>
                    <td className="p-4 text-muted-foreground hidden sm:table-cell">{customer.email || "-"}</td>
                    <td className="p-4 text-muted-foreground hidden md:table-cell">{customer.phone || "-"}</td>
                    <td className="p-4 text-muted-foreground hidden lg:table-cell">{customer.gstNumber || "-"}</td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setEditingCustomer(customer); setCustomerModalOpen(true); }}
                          data-testid={`btn-edit-customer-${customer.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteCustomer.mutate(customer.id)}
                          data-testid={`btn-delete-customer-${customer.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredCustomers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      No customers found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  };

  const renderVendors = () => {
    const filteredVendors = vendors.filter(
      (v) =>
        v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-serif font-bold text-primary">Vendors</h1>
          <Button onClick={() => { setEditingVendor(null); setVendorModalOpen(true); }} data-testid="btn-add-vendor">
            <Plus className="h-4 w-4 mr-2" />
            Add Vendor
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search vendors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-vendors"
            />
          </div>
        </div>

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-4 font-medium text-muted-foreground">Name</th>
                  <th className="text-left p-4 font-medium text-muted-foreground hidden sm:table-cell">Category</th>
                  <th className="text-left p-4 font-medium text-muted-foreground hidden md:table-cell">Phone</th>
                  <th className="text-left p-4 font-medium text-muted-foreground hidden lg:table-cell">GST No.</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVendors.map((vendor) => (
                  <tr key={vendor.id} className="border-b hover:bg-muted/50" data-testid={`row-vendor-${vendor.id}`}>
                    <td className="p-4 font-medium">{vendor.name}</td>
                    <td className="p-4 text-muted-foreground hidden sm:table-cell">{vendor.category || "-"}</td>
                    <td className="p-4 text-muted-foreground hidden md:table-cell">{vendor.phone || "-"}</td>
                    <td className="p-4 text-muted-foreground hidden lg:table-cell">{vendor.gstNumber || "-"}</td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setEditingVendor(vendor); setVendorModalOpen(true); }}
                          data-testid={`btn-edit-vendor-${vendor.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteVendor.mutate(vendor.id)}
                          data-testid={`btn-delete-vendor-${vendor.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredVendors.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      No vendors found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  };

  const renderItems = () => {
    const filteredItems = itemsList.filter(
      (i) =>
        i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.sku?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-serif font-bold text-primary">Items</h1>
          <Button onClick={() => { setEditingItem(null); setItemModalOpen(true); }} data-testid="btn-add-item">
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-items"
            />
          </div>
        </div>

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-4 font-medium text-muted-foreground">Name</th>
                  <th className="text-left p-4 font-medium text-muted-foreground hidden sm:table-cell">Type</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">Rate</th>
                  <th className="text-left p-4 font-medium text-muted-foreground hidden md:table-cell">Unit</th>
                  <th className="text-left p-4 font-medium text-muted-foreground hidden lg:table-cell">HSN</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-muted/50" data-testid={`row-item-${item.id}`}>
                    <td className="p-4">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        {item.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="p-4 hidden sm:table-cell">
                      <Badge variant={item.type === "service" ? "secondary" : "outline"}>
                        {item.type}
                      </Badge>
                    </td>
                    <td className="p-4 text-right font-medium">₹{parseFloat(item.rate).toLocaleString("en-IN")}</td>
                    <td className="p-4 text-muted-foreground hidden md:table-cell">{item.unit || "-"}</td>
                    <td className="p-4 text-muted-foreground hidden lg:table-cell">{item.hsnCode || "-"}</td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setEditingItem(item); setItemModalOpen(true); }}
                          data-testid={`btn-edit-item-${item.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteItem.mutate(item.id)}
                          data-testid={`btn-delete-item-${item.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No items found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  };

  const renderEstimates = () => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-serif font-bold text-primary">Estimates</h1>
        <Button data-testid="btn-add-estimate">
          <Plus className="h-4 w-4 mr-2" />
          New Estimate
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-4 font-medium text-muted-foreground">Number</th>
                <th className="text-left p-4 font-medium text-muted-foreground hidden sm:table-cell">Date</th>
                <th className="text-left p-4 font-medium text-muted-foreground hidden md:table-cell">Customer</th>
                <th className="text-right p-4 font-medium text-muted-foreground">Amount</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {estimates.map((estimate) => {
                const customer = customers.find((c) => c.id === estimate.customerId);
                return (
                  <tr key={estimate.id} className="border-b hover:bg-muted/50">
                    <td className="p-4 font-medium">{estimate.number}</td>
                    <td className="p-4 text-muted-foreground hidden sm:table-cell">
                      {format(new Date(estimate.date), "dd MMM yyyy")}
                    </td>
                    <td className="p-4 hidden md:table-cell">{customer?.name || "-"}</td>
                    <td className="p-4 text-right font-medium">
                      ₹{parseFloat(estimate.total).toLocaleString("en-IN")}
                    </td>
                    <td className="p-4">
                      <Badge variant={estimate.status === "accepted" ? "default" : "secondary"}>
                        {estimate.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {estimates.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No estimates found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );

  const renderInvoices = () => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-serif font-bold text-primary">Invoices</h1>
        <Button data-testid="btn-add-invoice">
          <Plus className="h-4 w-4 mr-2" />
          New Invoice
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-4 font-medium text-muted-foreground">Number</th>
                <th className="text-left p-4 font-medium text-muted-foreground hidden sm:table-cell">Date</th>
                <th className="text-left p-4 font-medium text-muted-foreground hidden md:table-cell">Customer</th>
                <th className="text-right p-4 font-medium text-muted-foreground">Amount</th>
                <th className="text-right p-4 font-medium text-muted-foreground hidden lg:table-cell">Balance</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => {
                const customer = customers.find((c) => c.id === invoice.customerId);
                return (
                  <tr key={invoice.id} className="border-b hover:bg-muted/50">
                    <td className="p-4 font-medium">{invoice.number}</td>
                    <td className="p-4 text-muted-foreground hidden sm:table-cell">
                      {format(new Date(invoice.date), "dd MMM yyyy")}
                    </td>
                    <td className="p-4 hidden md:table-cell">{customer?.name || "-"}</td>
                    <td className="p-4 text-right font-medium">
                      ₹{parseFloat(invoice.total).toLocaleString("en-IN")}
                    </td>
                    <td className="p-4 text-right text-muted-foreground hidden lg:table-cell">
                      ₹{parseFloat(invoice.balanceDue).toLocaleString("en-IN")}
                    </td>
                    <td className="p-4">
                      <Badge variant={invoice.status === "paid" ? "default" : "secondary"}>
                        {invoice.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No invoices found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );

  const renderPaymentsReceived = () => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-serif font-bold text-primary">Payments Received</h1>
        <Button data-testid="btn-add-payment">
          <Plus className="h-4 w-4 mr-2" />
          Record Payment
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-4 font-medium text-muted-foreground">Receipt #</th>
                <th className="text-left p-4 font-medium text-muted-foreground hidden sm:table-cell">Date</th>
                <th className="text-left p-4 font-medium text-muted-foreground hidden md:table-cell">Customer</th>
                <th className="text-right p-4 font-medium text-muted-foreground">Amount</th>
                <th className="text-left p-4 font-medium text-muted-foreground hidden lg:table-cell">Mode</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => {
                const customer = customers.find((c) => c.id === payment.customerId);
                return (
                  <tr key={payment.id} className="border-b hover:bg-muted/50">
                    <td className="p-4 font-medium">{payment.number}</td>
                    <td className="p-4 text-muted-foreground hidden sm:table-cell">
                      {format(new Date(payment.date), "dd MMM yyyy")}
                    </td>
                    <td className="p-4 hidden md:table-cell">{customer?.name || "-"}</td>
                    <td className="p-4 text-right font-medium text-green-600">
                      ₹{parseFloat(payment.amount).toLocaleString("en-IN")}
                    </td>
                    <td className="p-4 hidden lg:table-cell">
                      <Badge variant="outline">{payment.paymentMode}</Badge>
                    </td>
                  </tr>
                );
              })}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    No payments recorded
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );

  const renderExpenses = () => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-serif font-bold text-primary">Expenses</h1>
        <Button data-testid="btn-add-expense">
          <Plus className="h-4 w-4 mr-2" />
          Record Expense
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-4 font-medium text-muted-foreground">Number</th>
                <th className="text-left p-4 font-medium text-muted-foreground hidden sm:table-cell">Date</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Category</th>
                <th className="text-left p-4 font-medium text-muted-foreground hidden md:table-cell">Vendor</th>
                <th className="text-right p-4 font-medium text-muted-foreground">Amount</th>
                <th className="text-left p-4 font-medium text-muted-foreground hidden lg:table-cell">Status</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => {
                const vendor = vendors.find((v) => v.id === expense.vendorId);
                return (
                  <tr key={expense.id} className="border-b hover:bg-muted/50">
                    <td className="p-4 font-medium">{expense.number}</td>
                    <td className="p-4 text-muted-foreground hidden sm:table-cell">
                      {format(new Date(expense.date), "dd MMM yyyy")}
                    </td>
                    <td className="p-4">{expense.category}</td>
                    <td className="p-4 hidden md:table-cell">{vendor?.name || "-"}</td>
                    <td className="p-4 text-right font-medium text-red-600">
                      ₹{parseFloat(expense.total).toLocaleString("en-IN")}
                    </td>
                    <td className="p-4 hidden lg:table-cell">
                      <Badge variant={expense.status === "paid" ? "default" : "secondary"}>
                        {expense.status}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No expenses recorded
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );

  const renderBills = () => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-serif font-bold text-primary">Bills</h1>
        <Button data-testid="btn-add-bill">
          <Plus className="h-4 w-4 mr-2" />
          Add Bill
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-4 font-medium text-muted-foreground">Number</th>
                <th className="text-left p-4 font-medium text-muted-foreground hidden sm:table-cell">Date</th>
                <th className="text-left p-4 font-medium text-muted-foreground hidden md:table-cell">Vendor</th>
                <th className="text-right p-4 font-medium text-muted-foreground">Amount</th>
                <th className="text-right p-4 font-medium text-muted-foreground hidden lg:table-cell">Balance</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {billsList.map((bill) => {
                const vendor = vendors.find((v) => v.id === bill.vendorId);
                return (
                  <tr key={bill.id} className="border-b hover:bg-muted/50">
                    <td className="p-4 font-medium">{bill.number}</td>
                    <td className="p-4 text-muted-foreground hidden sm:table-cell">
                      {format(new Date(bill.date), "dd MMM yyyy")}
                    </td>
                    <td className="p-4 hidden md:table-cell">{vendor?.name || "-"}</td>
                    <td className="p-4 text-right font-medium">
                      ₹{parseFloat(bill.total).toLocaleString("en-IN")}
                    </td>
                    <td className="p-4 text-right text-muted-foreground hidden lg:table-cell">
                      ₹{parseFloat(bill.balanceDue).toLocaleString("en-IN")}
                    </td>
                    <td className="p-4">
                      <Badge variant={bill.status === "paid" ? "default" : "secondary"}>
                        {bill.status}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
              {billsList.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No bills found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );

  const renderBanking = () => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-serif font-bold text-primary">Banking</h1>
        <Button data-testid="btn-add-bank">
          <Plus className="h-4 w-4 mr-2" />
          Add Bank Account
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {banks.map((bank) => (
          <Card key={bank.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{bank.name}</CardTitle>
                <Landmark className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                {bank.accountNumber ? `****${bank.accountNumber.slice(-4)}` : "Account"}
              </p>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">₹{parseFloat(bank.balance).toLocaleString("en-IN")}</p>
              <p className="text-sm text-muted-foreground">Current Balance</p>
            </CardContent>
          </Card>
        ))}
        {banks.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="p-8 text-center text-muted-foreground">
              No bank accounts configured
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );

  const renderReports = () => {
    const profitLoss = totalIncome - totalExpenses;
    
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-serif font-bold text-primary">Reports</h1>

        <Tabs defaultValue="profit-loss">
          <TabsList>
            <TabsTrigger value="profit-loss">Profit & Loss</TabsTrigger>
            <TabsTrigger value="sales-summary">Sales Summary</TabsTrigger>
            <TabsTrigger value="tax-summary">Tax Summary</TabsTrigger>
          </TabsList>

          <TabsContent value="profit-loss" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Profit & Loss Statement</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                    <span className="font-medium">Total Income</span>
                    <span className="text-lg font-bold text-green-600">
                      ₹{totalIncome.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                    <span className="font-medium">Total Expenses</span>
                    <span className="text-lg font-bold text-red-600">
                      ₹{totalExpenses.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="border-t pt-4">
                    <div className={cn(
                      "flex justify-between items-center p-3 rounded-lg",
                      profitLoss >= 0 ? "bg-green-100 dark:bg-green-950/30" : "bg-red-100 dark:bg-red-950/30"
                    )}>
                      <span className="font-semibold text-lg">Net {profitLoss >= 0 ? "Profit" : "Loss"}</span>
                      <span className={cn(
                        "text-xl font-bold",
                        profitLoss >= 0 ? "text-green-600" : "text-red-600"
                      )}>
                        ₹{Math.abs(profitLoss).toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sales-summary" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Sales Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                  <div className="p-4 bg-muted/30 rounded-lg text-center">
                    <p className="text-3xl font-bold">{estimates.length}</p>
                    <p className="text-sm text-muted-foreground">Estimates</p>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg text-center">
                    <p className="text-3xl font-bold">{invoices.length}</p>
                    <p className="text-sm text-muted-foreground">Invoices</p>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg text-center">
                    <p className="text-3xl font-bold">{payments.length}</p>
                    <p className="text-sm text-muted-foreground">Payments</p>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg text-center">
                    <p className="text-3xl font-bold">{customers.length}</p>
                    <p className="text-sm text-muted-foreground">Customers</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tax-summary" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Tax Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-center text-muted-foreground py-8">
                  Tax calculations will be available when GST is configured in Settings
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  };

  const renderSettings = () => (
    <div className="space-y-6">
      <h1 className="text-2xl font-serif font-bold text-primary">Settings</h1>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Company Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              <div>
                <Label>Company Name</Label>
                <Input placeholder="Oakstreet Events" />
              </div>
              <div>
                <Label>GST Number</Label>
                <Input placeholder="Enter GST Number" />
              </div>
              <div className="md:col-span-2">
                <Label>Address</Label>
                <Textarea placeholder="Enter company address" />
              </div>
              <div>
                <Label>Phone</Label>
                <Input placeholder="Phone number" />
              </div>
              <div>
                <Label>Email</Label>
                <Input placeholder="Email address" type="email" />
              </div>
            </div>
            <Button>Save Changes</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invoice Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              <div>
                <Label>Invoice Prefix</Label>
                <Input placeholder="INV-" />
              </div>
              <div>
                <Label>Estimate Prefix</Label>
                <Input placeholder="QT-" />
              </div>
              <div className="md:col-span-2">
                <Label>Default Terms & Conditions</Label>
                <Textarea placeholder="Enter default terms" />
              </div>
            </div>
            <Button>Save Changes</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case "dashboard":
        return renderDashboard();
      case "customers":
        return renderCustomers();
      case "vendors":
        return renderVendors();
      case "items":
        return renderItems();
      case "estimates":
        return renderEstimates();
      case "invoices":
        return renderInvoices();
      case "payments-received":
        return renderPaymentsReceived();
      case "expenses":
        return renderExpenses();
      case "bills":
        return renderBills();
      case "banking":
        return renderBanking();
      case "reports":
        return renderReports();
      case "settings":
        return renderSettings();
      default:
        return renderDashboard();
    }
  };

  const CustomerModal = () => {
    const [formData, setFormData] = useState<Partial<Customer>>(
      editingCustomer || { name: "", email: "", phone: "", gstNumber: "", billingAddress: "" }
    );
    const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

    const validate = () => {
      const newErrors: { name?: string; email?: string } = {};
      if (!formData.name?.trim()) {
        newErrors.name = "Name is required";
      }
      if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = "Invalid email format";
      }
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = () => {
      if (!validate()) {
        toast({ title: "Please fix the errors", variant: "destructive" });
        return;
      }
      if (editingCustomer) {
        updateCustomer.mutate({ id: editingCustomer.id, data: formData });
      } else {
        createCustomer.mutate(formData);
      }
    };

    return (
      <Dialog open={customerModalOpen} onOpenChange={setCustomerModalOpen}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? "Edit Customer" : "Add Customer"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={formData.name || ""}
                onChange={(e) => { setFormData({ ...formData, name: e.target.value }); setErrors({ ...errors, name: undefined }); }}
                placeholder="Customer name"
                className={errors.name ? "border-red-500" : ""}
                data-testid="input-customer-name"
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>
            <div>
              <Label>Email</Label>
              <Input
                value={formData.email || ""}
                onChange={(e) => { setFormData({ ...formData, email: e.target.value }); setErrors({ ...errors, email: undefined }); }}
                placeholder="Email address"
                type="email"
                className={errors.email ? "border-red-500" : ""}
                data-testid="input-customer-email"
              />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={formData.phone || ""}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Phone number"
                data-testid="input-customer-phone"
              />
            </div>
            <div>
              <Label>GST Number</Label>
              <Input
                value={formData.gstNumber || ""}
                onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value })}
                placeholder="GST Number"
                data-testid="input-customer-gst"
              />
            </div>
            <div>
              <Label>Billing Address</Label>
              <Textarea
                value={formData.billingAddress || ""}
                onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
                placeholder="Billing address"
                data-testid="input-customer-address"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomerModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} data-testid="btn-save-customer">
              {editingCustomer ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  const VendorModal = () => {
    const [formData, setFormData] = useState<Partial<Vendor>>(
      editingVendor || { name: "", email: "", phone: "", gstNumber: "", category: "", billingAddress: "" }
    );
    const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

    const validate = () => {
      const newErrors: { name?: string; email?: string } = {};
      if (!formData.name?.trim()) {
        newErrors.name = "Name is required";
      }
      if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = "Invalid email format";
      }
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = () => {
      if (!validate()) {
        toast({ title: "Please fix the errors", variant: "destructive" });
        return;
      }
      if (editingVendor) {
        updateVendor.mutate({ id: editingVendor.id, data: formData });
      } else {
        createVendor.mutate(formData);
      }
    };

    return (
      <Dialog open={vendorModalOpen} onOpenChange={setVendorModalOpen}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{editingVendor ? "Edit Vendor" : "Add Vendor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={formData.name || ""}
                onChange={(e) => { setFormData({ ...formData, name: e.target.value }); setErrors({ ...errors, name: undefined }); }}
                placeholder="Vendor name"
                className={errors.name ? "border-red-500" : ""}
                data-testid="input-vendor-name"
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>
            <div>
              <Label>Category</Label>
              <Input
                value={formData.category || ""}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="e.g., Catering, Decoration"
                data-testid="input-vendor-category"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                value={formData.email || ""}
                onChange={(e) => { setFormData({ ...formData, email: e.target.value }); setErrors({ ...errors, email: undefined }); }}
                placeholder="Email address"
                type="email"
                className={errors.email ? "border-red-500" : ""}
                data-testid="input-vendor-email"
              />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={formData.phone || ""}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Phone number"
                data-testid="input-vendor-phone"
              />
            </div>
            <div>
              <Label>GST Number</Label>
              <Input
                value={formData.gstNumber || ""}
                onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value })}
                placeholder="GST Number"
                data-testid="input-vendor-gst"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVendorModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} data-testid="btn-save-vendor">
              {editingVendor ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  const ItemModal = () => {
    const [formData, setFormData] = useState<Partial<Item>>(
      editingItem || { name: "", description: "", type: "service", rate: "0", unit: "Nos", taxRate: "0", hsnCode: "", sku: "" }
    );
    const [errors, setErrors] = useState<{ name?: string; rate?: string }>({});

    const validate = () => {
      const newErrors: { name?: string; rate?: string } = {};
      if (!formData.name?.trim()) {
        newErrors.name = "Name is required";
      }
      if (formData.rate && isNaN(parseFloat(formData.rate))) {
        newErrors.rate = "Rate must be a valid number";
      }
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = () => {
      if (!validate()) {
        toast({ title: "Please fix the errors", variant: "destructive" });
        return;
      }
      if (editingItem) {
        updateItem.mutate({ id: editingItem.id, data: formData });
      } else {
        createItem.mutate(formData);
      }
    };

    return (
      <Dialog open={itemModalOpen} onOpenChange={setItemModalOpen}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Item" : "Add Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={formData.name || ""}
                onChange={(e) => { setFormData({ ...formData, name: e.target.value }); setErrors({ ...errors, name: undefined }); }}
                placeholder="Item name"
                className={errors.name ? "border-red-500" : ""}
                data-testid="input-item-name"
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Item description"
                data-testid="input-item-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type</Label>
                <Select
                  value={formData.type || "service"}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger data-testid="select-item-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="service">Service</SelectItem>
                    <SelectItem value="product">Product</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Unit</Label>
                <Input
                  value={formData.unit || ""}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  placeholder="Nos, Hours, etc."
                  data-testid="input-item-unit"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Rate (₹)</Label>
                <Input
                  value={formData.rate || ""}
                  onChange={(e) => { setFormData({ ...formData, rate: e.target.value }); setErrors({ ...errors, rate: undefined }); }}
                  placeholder="0.00"
                  type="number"
                  className={errors.rate ? "border-red-500" : ""}
                  data-testid="input-item-rate"
                />
                {errors.rate && <p className="text-xs text-red-500 mt-1">{errors.rate}</p>}
              </div>
              <div>
                <Label>Tax Rate (%)</Label>
                <Input
                  value={formData.taxRate || ""}
                  onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
                  placeholder="0"
                  type="number"
                  data-testid="input-item-tax"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>HSN/SAC Code</Label>
                <Input
                  value={formData.hsnCode || ""}
                  onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value })}
                  placeholder="HSN Code"
                  data-testid="input-item-hsn"
                />
              </div>
              <div>
                <Label>SKU</Label>
                <Input
                  value={formData.sku || ""}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="SKU"
                  data-testid="input-item-sku"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} data-testid="btn-save-item">
              {editingItem ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)] overflow-hidden">
      <div className="md:hidden flex items-center justify-between p-3 border-b bg-card">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          data-testid="btn-mobile-menu"
          className="flex items-center gap-2"
        >
          <Menu className="h-4 w-4" />
          <span>Menu</span>
        </Button>
        <span className="text-sm font-medium text-muted-foreground capitalize">
          {activeSection.replace("-", " ")}
        </span>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}>
          <div className="fixed inset-y-0 left-0 w-72 bg-background shadow-lg border-r" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <span className="font-semibold">Oak Book</span>
              <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            {renderSidebar()}
          </div>
        </div>
      )}

      <div className="hidden md:block w-64 border-r flex-shrink-0 bg-card">
        {renderSidebar()}
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {renderContent()}
      </div>

      <CustomerModal />
      <VendorModal />
      <ItemModal />
    </div>
  );
}

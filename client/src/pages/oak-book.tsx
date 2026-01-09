import { useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/context/auth-context";
import { ZohoQuotes } from "@/components/oak-book/zoho-quotes";
import { ZohoInvoices } from "@/components/oak-book/zoho-invoices";
import { ZohoCustomers } from "@/components/oak-book/zoho-customers";
import { ZohoVendors } from "@/components/oak-book/zoho-vendors";
import { ZohoPayments } from "@/components/oak-book/zoho-payments";
import { ZohoExpenses } from "@/components/oak-book/zoho-expenses";
import { ZohoBills } from "@/components/oak-book/zoho-bills";
import { ZohoDeliveryChallans } from "@/components/oak-book/zoho-delivery-challans";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
  X,
  UserPlus,
  Send,
  Printer,
  MoreHorizontal,
  ArrowLeft,
  Home,
  PanelLeftClose,
  PanelLeft
} from "lucide-react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
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

type SidebarChild = {
  id: string;
  label: string;
  children?: { id: string; label: string }[];
};

type SidebarSection = {
  id: string;
  label: string;
  icon: any;
  children?: SidebarChild[];
};

const SIDEBAR_SECTIONS: SidebarSection[] = [
  { id: "customers", label: "Customers", icon: Users },
  { 
    id: "sales", 
    label: "Sales", 
    icon: TrendingUp,
    children: [
      { 
        id: "estimates", 
        label: "Estimates",
        children: [
          { id: "standard-estimates", label: "Standard" },
          { id: "tax-estimates", label: "Tax" },
        ]
      },
      { 
        id: "invoices", 
        label: "Invoices",
        children: [
          { id: "standard-invoices", label: "Standard" },
          { id: "tax-invoices", label: "Tax" },
        ]
      },
      { id: "payments-received", label: "Payments Received" },
      { id: "delivery-challans", label: "Delivery Challan" },
    ]
  },
  { 
    id: "vendor-management", 
    label: "Vendor Management", 
    icon: Building2,
    children: [
      { id: "pending-vendor-payments", label: "Pending Vendor Payments" },
    ]
  },
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
  weddingPlannerId: string | null;
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

type PendingVendorPayment = {
  id: string;
  requestCode: string;
  employeeId: string;
  employeeName: string;
  employeePhone: string;
  vendorName: string;
  amount: string;
  description: string | null;
  eventId: string | null;
  eventName: string | null;
  status: string;
  createdAt: string;
  paidAt: string | null;
  daybookEntryId: string | null;
};

type Bank = {
  id: string;
  name: string;
  accountNumber: string | null;
  balance: string;
};

type User = {
  id: string;
  name: string;
  role: string;
};

type DeliveryChallanItem = {
  description: string;
  hsnCode: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
};

type DeliveryChallan = {
  id: string;
  challanNumber: string;
  challanDate: string;
  challanType: string;
  vehicleNumber: string | null;
  deliverTo: string;
  deliveryAddress: string;
  placeOfSupply: string | null;
  items: DeliveryChallanItem[];
  subTotal: string;
  cgstRate: string | null;
  cgstAmount: string | null;
  sgstRate: string | null;
  sgstAmount: string | null;
  rounding: string | null;
  totalAmount: string;
  totalInWords: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
};

export default function OakBook() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [activeSection, setActiveSection] = useState("customers");
  const [expandedMenus, setExpandedMenus] = useState<string[]>(["sales", "vendor-management"]);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<"quote" | "invoice" | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<{ type: string; id: string; data: any } | null>(null);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
    
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [vendorModalOpen, setVendorModalOpen] = useState(false);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [estimateModalOpen, setEstimateModalOpen] = useState(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [billModalOpen, setBillModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewType, setPreviewType] = useState<"invoice" | "quote" | "receipt" | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editingEstimate, setEditingEstimate] = useState<Estimate | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [editingPayment, setEditingPayment] = useState<CustomerPayment | null>(null);
  const [deliveryChallanModalOpen, setDeliveryChallanModalOpen] = useState(false);
  const [editingDeliveryChallan, setEditingDeliveryChallan] = useState<DeliveryChallan | null>(null);

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

  const { data: pendingVendorPayments = [] } = useQuery<PendingVendorPayment[]>({
    queryKey: ["/api/pending-vendor-payments"],
  });

  const { data: deliveryChallans = [] } = useQuery<DeliveryChallan[]>({
    queryKey: ["/api/delivery-challans"],
  });

  const { data: companySettings } = useQuery<any>({
    queryKey: ["/api/company-settings"],
  });

  // Query users for wedding planner selection (admin/superadmin only)
  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: user?.role === 'superadmin' || user?.role === 'admin',
  });
  const weddingPlanners = allUsers.filter(u => u.role === 'wedding_planner');

  const updateCompanySettings = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/company-settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company-settings"] });
      toast({ title: "Settings saved successfully" });
    },
    onError: () => {
      toast({ title: "Failed to save settings", variant: "destructive" });
    },
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

  const createInvoice = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/invoices", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setInvoiceModalOpen(false);
      setEditingInvoice(null);
      toast({ title: "Invoice created successfully" });
    },
  });

  const updateInvoice = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/invoices/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setInvoiceModalOpen(false);
      setEditingInvoice(null);
      toast({ title: "Invoice updated successfully" });
    },
  });

  const deleteInvoice = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/invoices/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice deleted" });
    },
  });

  const createEstimate = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/estimates", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/estimates"] });
      setEstimateModalOpen(false);
      setEditingEstimate(null);
      toast({ title: "Estimate created successfully" });
    },
  });

  const updateEstimate = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/estimates/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/estimates"] });
      setEstimateModalOpen(false);
      setEditingEstimate(null);
      toast({ title: "Estimate updated successfully" });
    },
  });

  const deleteEstimate = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/estimates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/estimates"] });
      toast({ title: "Estimate deleted" });
    },
  });

  const createExpense = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/expenses", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      setExpenseModalOpen(false);
      setEditingExpense(null);
      toast({ title: "Expense recorded successfully" });
    },
  });

  const updateExpense = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/expenses/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      setExpenseModalOpen(false);
      setEditingExpense(null);
      toast({ title: "Expense updated successfully" });
    },
  });

  const deleteExpense = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({ title: "Expense deleted" });
    },
  });

  const createBill = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/bills", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      setBillModalOpen(false);
      setEditingBill(null);
      toast({ title: "Bill created successfully" });
    },
  });

  const updateBill = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/bills/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      setBillModalOpen(false);
      setEditingBill(null);
      toast({ title: "Bill updated successfully" });
    },
  });

  const deleteBill = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/bills/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      toast({ title: "Bill deleted" });
    },
  });

  const createPayment = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/customer-payments", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer-payments"] });
      setPaymentModalOpen(false);
      setEditingPayment(null);
      toast({ title: "Payment recorded successfully" });
    },
  });

  const updatePayment = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/customer-payments/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer-payments"] });
      setPaymentModalOpen(false);
      setEditingPayment(null);
      toast({ title: "Payment updated successfully" });
    },
  });

  const deletePayment = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/customer-payments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer-payments"] });
      toast({ title: "Payment deleted" });
    },
  });

  const deletePendingVendorPayment = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/pending-vendor-payments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pending-vendor-payments"] });
      toast({ title: "Pending vendor payment deleted" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to delete", 
        description: error?.message || "Only superadmins can delete vendor payments",
        variant: "destructive" 
      });
    },
  });

  const createDeliveryChallan = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/delivery-challans", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/delivery-challans"] });
      setDeliveryChallanModalOpen(false);
      setEditingDeliveryChallan(null);
      toast({ title: "Delivery Challan created successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to create", 
        description: error?.message || "Error creating delivery challan",
        variant: "destructive" 
      });
    },
  });

  const updateDeliveryChallan = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/delivery-challans/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/delivery-challans"] });
      setDeliveryChallanModalOpen(false);
      setEditingDeliveryChallan(null);
      toast({ title: "Delivery Challan updated successfully" });
    },
  });

  const deleteDeliveryChallan = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/delivery-challans/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/delivery-challans"] });
      toast({ title: "Delivery Challan deleted" });
    },
  });

  const handlePreview = (type: "invoice" | "quote" | "receipt", id: string) => {
    setPreviewType(type);
    setPreviewId(id);
    setPreviewModalOpen(true);
  };

  const handleSelectDocument = (type: "quote" | "invoice", id: string) => {
    setSelectedDocType(type);
    setSelectedDocId(id);
    if (isMobile) {
      setMobilePreviewOpen(true);
    }
  };

  const clearSelectedDocument = () => {
    setSelectedDocType(null);
    setSelectedDocId(null);
    setMobilePreviewOpen(false);
  };

  const handleDownloadPdf = async (type: "invoice" | "quote" | "receipt" | "delivery-challan", id: string, hideHeader: boolean = false) => {
    try {
      toast({ title: "Generating PDF...", description: "Please wait" });
      
      let docNumber = 'document';
      if (type === 'quote') {
        const estimate = estimates.find(e => e.id === id);
        docNumber = estimate?.number || 'estimate';
      } else if (type === 'invoice') {
        const invoice = invoices.find(i => i.id === id);
        docNumber = invoice?.number || 'invoice';
      } else if (type === 'receipt') {
        const payment = payments.find(p => p.id === id);
        docNumber = payment?.number || 'receipt';
      } else if (type === 'delivery-challan') {
        const challan = deliveryChallans.find(c => c.id === id);
        docNumber = challan?.challanNumber || 'delivery-challan';
      }

      const printUrl = `/print/${type}/${id}${hideHeader ? '?noHeader=true' : ''}`;
      
      // Create hidden iframe to render the React print page
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.left = '-9999px';
      iframe.style.top = '0';
      iframe.style.width = '794px';
      iframe.style.height = '1123px';
      iframe.style.border = 'none';
      iframe.style.backgroundColor = '#ffffff';
      document.body.appendChild(iframe);
      
      iframe.src = printUrl;
      
      // Wait for iframe to load and React to render
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout waiting for document to load'));
        }, 15000);
        
        iframe.onload = () => {
          // Wait for React to render the content
          const checkReady = setInterval(() => {
            try {
              const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
              const docElement = iframeDoc?.querySelector('.document');
              if (docElement) {
                clearInterval(checkReady);
                clearTimeout(timeout);
                // Extra delay to ensure all styles and images are loaded
                setTimeout(resolve, 1000);
              }
            } catch (e) {
              // Cross-origin issues - continue waiting
            }
          }, 200);
        };
        
        iframe.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Failed to load document'));
        };
      });
      
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      const docElement = iframeDoc?.querySelector('.document') as HTMLElement;
      
      if (!docElement) {
        throw new Error('Document element not found');
      }
      
      const canvas = await html2canvas(docElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: 794,
        windowWidth: 794,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      const pageHeight = pdf.internal.pageSize.getHeight();

      if (pdfHeight <= pageHeight) {
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      } else {
        let yPos = 0;
        let remainingHeight = pdfHeight;
        
        while (remainingHeight > 0) {
          if (yPos > 0) pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, -yPos, pdfWidth, pdfHeight);
          yPos += pageHeight;
          remainingHeight -= pageHeight;
        }
      }

      pdf.save(`${docNumber}.pdf`);
      document.body.removeChild(iframe);
      toast({ title: "PDF downloaded!" });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({ 
        title: "Download failed", 
        description: "Opening print dialog instead...",
        variant: "destructive" 
      });
      window.open(`/print/${type}/${id}`, '_blank');
    }
  };

  const handleCloneInvoice = (invoice: Invoice) => {
    const clonedData = {
      ...invoice,
      id: undefined,
      number: `INV-${Date.now()}`,
      date: format(new Date(), "yyyy-MM-dd"),
      status: "draft",
    };
    setEditingInvoice(null);
    createInvoice.mutate(clonedData);
  };

  const handleCloneEstimate = (estimate: Estimate) => {
    const clonedData = {
      ...estimate,
      id: undefined,
      number: `EST-${Date.now()}`,
      date: format(new Date(), "yyyy-MM-dd"),
      status: "draft",
    };
    setEditingEstimate(null);
    createEstimate.mutate(clonedData);
  };

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
    clearSelectedDocument();
    setSelectedRecord(null);
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
        <Link href="/" className="flex items-center gap-2 text-sidebar-foreground/80 hover:text-primary transition-colors mb-3">
          <LayoutDashboard className="h-4 w-4" />
          <span className="text-sm font-medium">Dashboard</span>
        </Link>
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
                        <div key={child.id}>
                          {child.children ? (
                            <>
                              <Button
                                variant="ghost"
                                className={cn(
                                  "w-full justify-between text-sm",
                                  expandedMenus.includes(child.id) && "bg-sidebar-accent/30"
                                )}
                                onClick={() => toggleMenu(child.id)}
                                data-testid={`nav-${child.id}`}
                              >
                                {child.label}
                                {expandedMenus.includes(child.id) ? (
                                  <ChevronDown className="h-3 w-3" />
                                ) : (
                                  <ChevronRight className="h-3 w-3" />
                                )}
                              </Button>
                              {expandedMenus.includes(child.id) && (
                                <div className="ml-4 space-y-1 mt-1">
                                  {child.children.map((subChild) => (
                                    <Button
                                      key={subChild.id}
                                      variant="ghost"
                                      size="sm"
                                      className={cn(
                                        "w-full justify-start text-xs h-7",
                                        activeSection === subChild.id &&
                                          "bg-sidebar-accent text-sidebar-accent-foreground"
                                      )}
                                      onClick={() => handleNavClick(subChild.id)}
                                      data-testid={`nav-${subChild.id}`}
                                    >
                                      {subChild.label}
                                    </Button>
                                  ))}
                                </div>
                              )}
                            </>
                          ) : (
                            <Button
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
                          )}
                        </div>
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
                  <tr 
                    key={customer.id} 
                    className={cn(
                      "border-b hover:bg-muted/50 cursor-pointer transition-colors",
                      selectedRecord?.type === "customer" && selectedRecord.id === customer.id && "bg-primary/10"
                    )}
                    onClick={() => setSelectedRecord({ type: "customer", id: customer.id, data: customer })}
                    data-testid={`row-customer-${customer.id}`}
                  >
                    <td className="p-4 font-medium">{customer.name}</td>
                    <td className="p-4 text-muted-foreground hidden sm:table-cell">{customer.email || "-"}</td>
                    <td className="p-4 text-muted-foreground hidden md:table-cell">{customer.phone || "-"}</td>
                    <td className="p-4 text-muted-foreground hidden lg:table-cell">{customer.gstNumber || "-"}</td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => { e.stopPropagation(); setEditingCustomer(customer); setCustomerModalOpen(true); }}
                          data-testid={`btn-edit-customer-${customer.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => { e.stopPropagation(); deleteCustomer.mutate(customer.id); }}
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

  const renderEstimates = (filterType: "standard" | "tax" = "standard") => {
    const filteredEstimates = filterType === "tax" 
      ? estimates.filter((e: any) => e.isTaxDocument === true)
      : estimates.filter((e: any) => !e.isTaxDocument);
    const title = filterType === "tax" ? "Tax Estimates (GST)" : "Standard Estimates";
    
    const renderEstimateRow = (estimate: any) => {
      const customer = customers.find((c) => c.id === estimate.customerId);
      const isSelected = selectedRecord?.type === "estimate" && selectedRecord.id === estimate.id;
      return (
        <tr 
          key={estimate.id} 
          className={cn(
            "border-b cursor-pointer transition-colors",
            isSelected ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-muted/50"
          )}
          onClick={() => { handleSelectDocument("quote", estimate.id); setSelectedRecord({ type: "estimate", id: estimate.id, data: estimate }); }}
        >
          <td className="p-3 font-medium text-sm">{estimate.number}</td>
          <td className="p-3 text-muted-foreground text-sm hidden sm:table-cell">
            {format(new Date(estimate.date), "dd MMM")}
          </td>
          <td className="p-3 text-sm hidden md:table-cell truncate max-w-[120px]">{customer?.name || "-"}</td>
          <td className="p-3 text-right font-medium text-sm">
            ₹{parseFloat(estimate.total).toLocaleString("en-IN")}
          </td>
          <td className="p-3">
            <Badge variant={estimate.status === "accepted" ? "default" : "secondary"} className="text-xs">
              {estimate.status}
            </Badge>
          </td>
          <td className="p-3 text-right">
            <div className="flex justify-end gap-0.5">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setEditingEstimate(estimate); setEstimateModalOpen(true); }} title="Edit">
                <Edit className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleCloneEstimate(estimate); }} title="Clone">
                <FileText className="h-3.5 w-3.5" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()} title="Download PDF">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onClick={() => handleDownloadPdf("quote", estimate.id, false)}>
                    With Header
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDownloadPdf("quote", estimate.id, true)}>
                    Without Header
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); deleteEstimate.mutate(estimate.id); }} title="Delete">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </td>
        </tr>
      );
    };
    
    return (
    <div className="h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <h1 className={cn("text-2xl font-serif font-bold", filterType === "tax" ? "text-primary" : "text-foreground")}>{title}</h1>
        <Button onClick={() => { setEditingEstimate(null); setEstimateModalOpen(true); }} data-testid="btn-add-estimate">
          <Plus className="h-4 w-4 mr-2" />
          New Estimate
        </Button>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
        {/* List Panel */}
        <div className={cn(
          "flex-shrink-0 overflow-auto",
          selectedDocType === "quote" && selectedDocId && !isMobile ? "lg:w-[40%] xl:w-[35%]" : "w-full"
        )}>
          <Card>
            <div className={cn("p-3 border-b", filterType === "tax" ? "bg-primary/10" : "bg-muted/30")}>
              <h3 className={cn("font-semibold text-sm", filterType === "tax" && "text-primary")}>{title} ({filteredEstimates.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-card z-10">
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium text-muted-foreground text-sm">Number</th>
                    <th className="text-left p-3 font-medium text-muted-foreground text-sm hidden sm:table-cell">Date</th>
                    <th className="text-left p-3 font-medium text-muted-foreground text-sm hidden md:table-cell">Customer</th>
                    <th className="text-right p-3 font-medium text-muted-foreground text-sm">Amount</th>
                    <th className="text-left p-3 font-medium text-muted-foreground text-sm">Status</th>
                    <th className="text-right p-3 font-medium text-muted-foreground text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEstimates.map(renderEstimateRow)}
                  {filteredEstimates.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-muted-foreground text-sm">
                        No {filterType === "tax" ? "tax" : "standard"} estimates
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Preview Panel - Desktop */}
        {selectedDocType === "quote" && selectedDocId && !isMobile && (
          <div className="hidden lg:flex flex-1 flex-col min-h-0">
            <Card className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between p-3 border-b bg-muted/30">
                <span className="font-medium text-sm">Preview</span>
                <div className="flex gap-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => handleDownloadPdf("quote", selectedDocId, false)}>
                        With Header
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDownloadPdf("quote", selectedDocId, true)}>
                        Without Header
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={clearSelectedDocument}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                <iframe
                  src={`/print/quote/${selectedDocId}`}
                  className="w-full h-full border-0"
                  title="Document Preview"
                />
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Mobile Preview Sheet */}
      <Sheet open={mobilePreviewOpen && selectedDocType === "quote"} onOpenChange={(open) => !open && clearSelectedDocument()}>
        <SheetContent side="bottom" className="h-[90vh] p-0">
          <SheetHeader className="p-4 border-b">
            <div className="flex items-center justify-between">
              <SheetTitle>Estimate Preview</SheetTitle>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => selectedDocId && handleDownloadPdf("quote", selectedDocId, false)}>
                    With Header
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => selectedDocId && handleDownloadPdf("quote", selectedDocId, true)}>
                    Without Header
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </SheetHeader>
          {selectedDocId && (
            <iframe
              src={`/print/quote/${selectedDocId}`}
              className="w-full h-[calc(100%-60px)] border-0"
              title="Document Preview"
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
  };

  const renderInvoices = (filterType: "standard" | "tax" = "standard") => {
    const filteredInvoices = filterType === "tax" 
      ? invoices.filter((i: any) => i.isTaxDocument === true)
      : invoices.filter((i: any) => !i.isTaxDocument);
    const title = filterType === "tax" ? "Tax Invoices (GST)" : "Standard Invoices";
    
    const renderInvoiceRow = (invoice: any) => {
      const customer = customers.find((c) => c.id === invoice.customerId);
      const isSelected = selectedRecord?.type === "invoice" && selectedRecord.id === invoice.id;
      return (
        <tr 
          key={invoice.id} 
          className={cn(
            "border-b cursor-pointer transition-colors",
            isSelected ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-muted/50"
          )}
          onClick={() => { handleSelectDocument("invoice", invoice.id); setSelectedRecord({ type: "invoice", id: invoice.id, data: invoice }); }}
        >
          <td className="p-3 font-medium text-sm">{invoice.number}</td>
          <td className="p-3 text-muted-foreground text-sm hidden sm:table-cell">
            {format(new Date(invoice.date), "dd MMM")}
          </td>
          <td className="p-3 text-sm hidden md:table-cell truncate max-w-[120px]">{customer?.name || "-"}</td>
          <td className="p-3 text-right font-medium text-sm">
            ₹{parseFloat(invoice.total).toLocaleString("en-IN")}
          </td>
          <td className="p-3">
            <Badge variant={invoice.status === "paid" ? "default" : "secondary"} className="text-xs">
              {invoice.status}
            </Badge>
          </td>
          <td className="p-3 text-right">
            <div className="flex justify-end gap-0.5">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setEditingInvoice(invoice); setInvoiceModalOpen(true); }} title="Edit">
                <Edit className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleCloneInvoice(invoice); }} title="Clone">
                <FileText className="h-3.5 w-3.5" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()} title="Download PDF">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onClick={() => handleDownloadPdf("invoice", invoice.id, false)}>
                    With Header
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDownloadPdf("invoice", invoice.id, true)}>
                    Without Header
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); deleteInvoice.mutate(invoice.id); }} title="Delete">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </td>
        </tr>
      );
    };
    
    return (
    <div className="h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <h1 className={cn("text-2xl font-serif font-bold", filterType === "tax" ? "text-primary" : "text-foreground")}>{title}</h1>
        <Button onClick={() => { setEditingInvoice(null); setInvoiceModalOpen(true); }} data-testid="btn-add-invoice">
          <Plus className="h-4 w-4 mr-2" />
          New Invoice
        </Button>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
        {/* List Panel */}
        <div className={cn(
          "flex-shrink-0 overflow-auto",
          selectedDocType === "invoice" && selectedDocId && !isMobile ? "lg:w-[40%] xl:w-[35%]" : "w-full"
        )}>
          <Card>
            <div className={cn("p-3 border-b", filterType === "tax" ? "bg-primary/10" : "bg-muted/30")}>
              <h3 className={cn("font-semibold text-sm", filterType === "tax" && "text-primary")}>{title} ({filteredInvoices.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-card z-10">
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium text-muted-foreground text-sm">Number</th>
                    <th className="text-left p-3 font-medium text-muted-foreground text-sm hidden sm:table-cell">Date</th>
                    <th className="text-left p-3 font-medium text-muted-foreground text-sm hidden md:table-cell">Customer</th>
                    <th className="text-right p-3 font-medium text-muted-foreground text-sm">Amount</th>
                    <th className="text-left p-3 font-medium text-muted-foreground text-sm">Status</th>
                    <th className="text-right p-3 font-medium text-muted-foreground text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map(renderInvoiceRow)}
                  {filteredInvoices.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-muted-foreground text-sm">
                        No {filterType === "tax" ? "tax" : "standard"} invoices
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Preview Panel - Desktop */}
        {selectedDocType === "invoice" && selectedDocId && !isMobile && (
          <div className="hidden lg:flex flex-1 flex-col min-h-0">
            <Card className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between p-3 border-b bg-muted/30">
                <span className="font-medium text-sm">Preview</span>
                <div className="flex gap-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => handleDownloadPdf("invoice", selectedDocId, false)}>
                        With Header
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDownloadPdf("invoice", selectedDocId, true)}>
                        Without Header
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={clearSelectedDocument}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                <iframe
                  src={`/print/invoice/${selectedDocId}`}
                  className="w-full h-full border-0"
                  title="Document Preview"
                />
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Mobile Preview Sheet */}
      <Sheet open={mobilePreviewOpen && selectedDocType === "invoice"} onOpenChange={(open) => !open && clearSelectedDocument()}>
        <SheetContent side="bottom" className="h-[90vh] p-0">
          <SheetHeader className="p-4 border-b">
            <div className="flex items-center justify-between">
              <SheetTitle>Invoice Preview</SheetTitle>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => selectedDocId && handleDownloadPdf("invoice", selectedDocId, false)}>
                    With Header
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => selectedDocId && handleDownloadPdf("invoice", selectedDocId, true)}>
                    Without Header
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </SheetHeader>
          {selectedDocId && (
            <iframe
              src={`/print/invoice/${selectedDocId}`}
              className="w-full h-[calc(100%-60px)] border-0"
              title="Document Preview"
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
  };

  const renderPaymentsReceived = () => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-serif font-bold text-primary">Payments Received</h1>
        <Button onClick={() => { setEditingPayment(null); setPaymentModalOpen(true); }} data-testid="btn-add-payment">
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
                <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => {
                const customer = customers.find((c) => c.id === payment.customerId);
                const isSelected = selectedRecord?.type === "payment" && selectedRecord.id === payment.id;
                return (
                  <tr 
                    key={payment.id} 
                    className={cn(
                      "border-b cursor-pointer transition-colors",
                      isSelected ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-muted/50"
                    )}
                    onClick={() => setSelectedRecord({ type: "payment", id: payment.id, data: payment })}
                  >
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
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handlePreview("receipt", payment.id); }} title="Preview">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditingPayment(payment); setPaymentModalOpen(true); }} title="Edit">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()} title="Download PDF">
                              <Download className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onClick={() => handleDownloadPdf("receipt", payment.id, false)}>
                              With Header
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownloadPdf("receipt", payment.id, true)}>
                              Without Header
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); deletePayment.mutate(payment.id); }} title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
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

  const renderDeliveryChallans = () => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-serif font-bold text-primary">Delivery Challans</h1>
        <Button onClick={() => { setEditingDeliveryChallan(null); setDeliveryChallanModalOpen(true); }} data-testid="btn-add-dc">
          <Plus className="h-4 w-4 mr-2" />
          New Delivery Challan
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-4 font-medium text-muted-foreground">Challan #</th>
                <th className="text-left p-4 font-medium text-muted-foreground hidden sm:table-cell">Date</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Deliver To</th>
                <th className="text-left p-4 font-medium text-muted-foreground hidden md:table-cell">Type</th>
                <th className="text-left p-4 font-medium text-muted-foreground hidden lg:table-cell">Vehicle</th>
                <th className="text-right p-4 font-medium text-muted-foreground">Amount</th>
                <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {deliveryChallans.map((challan) => {
                const isSelected = selectedRecord?.type === "delivery-challan" && selectedRecord.id === challan.id;
                return (
                  <tr 
                    key={challan.id} 
                    className={cn(
                      "border-b cursor-pointer transition-colors",
                      isSelected ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-muted/50"
                    )}
                    onClick={() => setSelectedRecord({ type: "delivery-challan", id: challan.id, data: challan })}
                    data-testid={`row-dc-${challan.id}`}
                  >
                    <td className="p-4 font-medium text-primary">{challan.challanNumber}</td>
                    <td className="p-4 text-muted-foreground hidden sm:table-cell">
                      {format(new Date(challan.challanDate), "dd MMM yyyy")}
                    </td>
                    <td className="p-4">{challan.deliverTo}</td>
                    <td className="p-4 hidden md:table-cell">
                      <Badge variant="outline">{challan.challanType}</Badge>
                    </td>
                    <td className="p-4 hidden lg:table-cell text-muted-foreground">
                      {challan.vehicleNumber || "-"}
                    </td>
                    <td className="p-4 text-right font-medium">
                      ₹{parseFloat(challan.totalAmount).toLocaleString("en-IN")}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-1">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()} title="Download PDF">
                              <Download className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleDownloadPdf("delivery-challan", challan.id, false)}>
                              Download PDF (with header)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownloadPdf("delivery-challan", challan.id, true)}>
                              Download PDF (plain)
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button variant="ghost" size="icon" onClick={(e) => { 
                          e.stopPropagation(); 
                          window.open(`/print/delivery-challan/${challan.id}`, '_blank');
                        }} title="View PDF">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={(e) => { 
                          e.stopPropagation(); 
                          setEditingDeliveryChallan(challan); 
                          setDeliveryChallanModalOpen(true); 
                        }} title="Edit">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={(e) => { 
                          e.stopPropagation(); 
                          if (confirm('Are you sure you want to delete this delivery challan?')) {
                            deleteDeliveryChallan.mutate(challan.id); 
                          }
                        }} title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {deliveryChallans.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No delivery challans created yet
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
        <Button onClick={() => { setEditingExpense(null); setExpenseModalOpen(true); }} data-testid="btn-add-expense">
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
                <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
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
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingExpense(expense); setExpenseModalOpen(true); }} title="Edit">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteExpense.mutate(expense.id)} title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
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
        <Button onClick={() => { setEditingBill(null); setBillModalOpen(true); }} data-testid="btn-add-bill">
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
                <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
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
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingBill(bill); setBillModalOpen(true); }} title="Edit">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteBill.mutate(bill.id)} title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {billsList.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
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

  const renderPendingVendorPayments = () => {
    const pendingPayments = pendingVendorPayments.filter(p => p.status === 'pending');
    const paidPayments = pendingVendorPayments.filter(p => p.status === 'paid');
    
    const totalPending = pendingPayments.reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0);
    
    return (
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">Pending Vendor Payments</h2>
            <p className="text-sm text-muted-foreground">Vendor payments awaiting processing via WhatsApp</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold text-orange-600">{pendingPayments.length}</p>
                </div>
                <Wallet className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Pending Amount</p>
                  <p className="text-2xl font-bold text-orange-600">₹{totalPending.toLocaleString('en-IN')}</p>
                </div>
                <IndianRupee className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Paid</p>
                  <p className="text-2xl font-bold text-green-600">{paidPayments.length}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-orange-500" />
              Pending Payments ({pendingPayments.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingPayments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No pending vendor payments. Payments submitted via WhatsApp will appear here.
              </p>
            ) : (
              <div className="space-y-3">
                {pendingPayments.map((payment) => {
                  const isSelected = selectedRecord?.type === "vendor-payment" && selectedRecord.id === payment.id;
                  return (
                  <div
                    key={payment.id}
                    className={cn(
                      "flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors",
                      isSelected ? "bg-primary/10 border-primary/30" : "hover:bg-muted/30"
                    )}
                    onClick={() => setSelectedRecord({ type: "vendor-payment", id: payment.id, data: payment })}
                    data-testid={`pending-vendor-payment-${payment.id}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-orange-600 border-orange-600">
                          {payment.requestCode}
                        </Badge>
                        <span className="font-medium">{payment.vendorName}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        By {payment.employeeName} • {payment.eventName || 'No event assigned'}
                      </p>
                      {payment.description && (
                        <p className="text-sm text-muted-foreground">{payment.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Submitted: {format(new Date(payment.createdAt), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                    <div className="mt-2 sm:mt-0 flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-xl font-bold text-orange-600">
                          ₹{parseFloat(payment.amount).toLocaleString('en-IN')}
                        </p>
                        <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                          Pending
                        </Badge>
                      </div>
                      {user?.role === 'superadmin' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            if (confirm(`Delete vendor payment ${payment.requestCode} for ${payment.vendorName}?`)) {
                              deletePendingVendorPayment.mutate(payment.id);
                            }
                          }}
                          data-testid={`delete-vendor-payment-${payment.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {paidPayments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                Recently Paid ({paidPayments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {paidPayments.slice(0, 10).map((payment) => (
                  <div
                    key={payment.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg bg-green-50/50"
                    data-testid={`paid-vendor-payment-${payment.id}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          {payment.requestCode}
                        </Badge>
                        <span className="font-medium">{payment.vendorName}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Paid for: {payment.eventName || 'General'}
                      </p>
                      {payment.paidAt && (
                        <p className="text-xs text-muted-foreground">
                          Paid: {format(new Date(payment.paidAt), 'MMM d, yyyy h:mm a')}
                        </p>
                      )}
                    </div>
                    <div className="mt-2 sm:mt-0 text-right">
                      <p className="text-xl font-bold text-green-600">
                        ₹{parseFloat(payment.amount).toLocaleString('en-IN')}
                      </p>
                      <Badge className="bg-green-100 text-green-700">
                        Paid
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderSettings = () => (
    <SettingsSection 
      companySettings={companySettings} 
      updateCompanySettings={updateCompanySettings}
    />
  );

  const renderContent = () => {
    switch (activeSection) {
      case "customers":
        return <ZohoCustomers />;
      case "vendors":
        return <ZohoVendors />;
      case "estimates":
      case "standard-estimates":
        return (
          <ZohoQuotes 
            filterType="standard" 
            onDownloadPdf={handleDownloadPdf}
          />
        );
      case "tax-estimates":
        return (
          <ZohoQuotes 
            filterType="tax" 
            onDownloadPdf={handleDownloadPdf}
          />
        );
      case "invoices":
      case "standard-invoices":
        return (
          <ZohoInvoices 
            filterType="standard" 
            onDownloadPdf={handleDownloadPdf}
          />
        );
      case "tax-invoices":
        return (
          <ZohoInvoices 
            filterType="tax" 
            onDownloadPdf={handleDownloadPdf}
          />
        );
      case "payments-received":
        return <ZohoPayments />;
      case "expenses":
        return <ZohoExpenses />;
      case "bills":
        return <ZohoBills />;
      case "delivery-challans":
        return <ZohoDeliveryChallans />;
      case "reports":
        return renderReports();
      case "pending-vendor-payments":
        return renderPendingVendorPayments();
      case "settings":
        return renderSettings();
      default:
        return renderCustomers();
    }
  };

  const CustomerModal = () => {
    const isAdmin = user?.role === 'superadmin' || user?.role === 'admin';
    const isWeddingPlanner = user?.role === 'wedding_planner';
    
    const [formData, setFormData] = useState<Partial<Customer>>(() => {
      if (editingCustomer) return editingCustomer;
      // Auto-assign wedding planner ID for wedding_planner role
      return { 
        name: "", email: "", phone: "", gstNumber: "", billingAddress: "",
        weddingPlannerId: isWeddingPlanner ? user?.id : null
      };
    });
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
      // Auto-assign wedding planner if wedding_planner role and not editing
      const submitData = { 
        ...formData,
        weddingPlannerId: isWeddingPlanner && !editingCustomer ? user?.id : formData.weddingPlannerId
      };
      if (editingCustomer) {
        updateCustomer.mutate({ id: editingCustomer.id, data: submitData });
      } else {
        createCustomer.mutate(submitData);
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
            {isAdmin && weddingPlanners.length > 0 && (
              <div>
                <Label>Assigned Wedding Planner</Label>
                <Select 
                  value={formData.weddingPlannerId || "none"} 
                  onValueChange={(v) => setFormData({ ...formData, weddingPlannerId: v === "none" ? null : v })}
                >
                  <SelectTrigger data-testid="select-wedding-planner">
                    <SelectValue placeholder="Select wedding planner (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No planner assigned</SelectItem>
                    {weddingPlanners.map((planner) => (
                      <SelectItem key={planner.id} value={planner.id}>
                        {planner.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Assign this customer to a wedding planner for access control
                </p>
              </div>
            )}
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

  const renderPreviewPanel = () => {
    if (!selectedRecord) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-6">
          <FileText className="h-16 w-16 mb-4 opacity-30" />
          <p className="text-lg font-medium">No item selected</p>
          <p className="text-sm text-center mt-2">Select an item from the list to view details</p>
        </div>
      );
    }

    if (selectedRecord.type === "customer") {
      const customer = selectedRecord.data as Customer;
      return (
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between p-4 border-b bg-muted/30">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon" 
                className="md:hidden h-8 w-8"
                onClick={() => setSelectedRecord(null)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h3 className="font-semibold text-lg">{customer.name}</h3>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => { setEditingCustomer(customer); setCustomerModalOpen(true); }}>
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => deleteCustomer.mutate(customer.id)} className="text-red-600">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <p className="text-sm">{customer.email || "-"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Phone</Label>
                  <p className="text-sm">{customer.phone || "-"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">GST Number</Label>
                  <p className="text-sm">{customer.gstNumber || "-"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Billing Address</Label>
                  <p className="text-sm">{customer.billingAddress || "-"}</p>
                </div>
              </div>
              <div className="pt-4 border-t">
                <h4 className="font-medium mb-3">Related Documents</h4>
                <div className="space-y-2">
                  <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => { setActiveSection("standard-estimates"); setEditingEstimate(null); setEstimateModalOpen(true); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Estimate
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => { setActiveSection("standard-invoices"); setEditingInvoice(null); setInvoiceModalOpen(true); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Invoice
                  </Button>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      );
    }

    if (selectedRecord.type === "estimate") {
      const estimate = selectedRecord.data as Estimate;
      const customer = customers.find(c => c.id === estimate.customerId);
      return (
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between p-4 border-b bg-muted/30">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon" 
                className="md:hidden h-8 w-8"
                onClick={() => setSelectedRecord(null)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h3 className="font-semibold">{estimate.number}</h3>
                <Badge variant={estimate.status === "sent" ? "default" : "secondary"} className="mt-1">
                  {estimate.status}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => { setEditingEstimate(estimate as any); setEstimateModalOpen(true); }}>
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setPreviewType("quote"); setPreviewId(estimate.id); setPreviewModalOpen(true); }}>
                <Eye className="h-4 w-4 mr-1" />
                View
              </Button>
            </div>
          </div>
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              <div>
                <p className="text-3xl font-bold text-green-600">₹{parseFloat(estimate.total).toLocaleString('en-IN')}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Customer</Label>
                  <p className="text-sm font-medium">{customer?.name || "-"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Date</Label>
                  <p className="text-sm">{format(new Date(estimate.date), "dd MMM yyyy")}</p>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      );
    }

    if (selectedRecord.type === "invoice") {
      const invoice = selectedRecord.data as Invoice;
      const customer = customers.find(c => c.id === invoice.customerId);
      return (
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between p-4 border-b bg-muted/30">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon" 
                className="md:hidden h-8 w-8"
                onClick={() => setSelectedRecord(null)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h3 className="font-semibold">{invoice.number}</h3>
                <Badge variant={invoice.status === "paid" ? "default" : "secondary"} className="mt-1">
                  {invoice.status}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => { setEditingInvoice(invoice as any); setInvoiceModalOpen(true); }}>
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setPreviewType("invoice"); setPreviewId(invoice.id); setPreviewModalOpen(true); }}>
                <Eye className="h-4 w-4 mr-1" />
                View
              </Button>
            </div>
          </div>
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              <div>
                <p className="text-3xl font-bold text-green-600">₹{parseFloat(invoice.total).toLocaleString('en-IN')}</p>
                {parseFloat(invoice.balanceDue) > 0 && (
                  <p className="text-sm text-orange-500 mt-1">Balance Due: ₹{parseFloat(invoice.balanceDue).toLocaleString('en-IN')}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Customer</Label>
                  <p className="text-sm font-medium">{customer?.name || "-"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Date</Label>
                  <p className="text-sm">{format(new Date(invoice.date), "dd MMM yyyy")}</p>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      );
    }

    if (selectedRecord.type === "payment") {
      const payment = selectedRecord.data as CustomerPayment;
      const customer = customers.find(c => c.id === payment.customerId);
      return (
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between p-4 border-b bg-muted/30">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon" 
                className="md:hidden h-8 w-8"
                onClick={() => setSelectedRecord(null)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h3 className="font-semibold">{payment.number}</h3>
                <Badge className="bg-green-100 text-green-700 mt-1">Paid</Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => { setEditingPayment(payment); setPaymentModalOpen(true); }}>
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
            </div>
          </div>
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              <div>
                <p className="text-3xl font-bold text-green-600">₹{parseFloat(payment.amount).toLocaleString('en-IN')}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Customer</Label>
                  <p className="text-sm font-medium">{customer?.name || "-"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Date</Label>
                  <p className="text-sm">{format(new Date(payment.date), "dd MMM yyyy")}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Payment Mode</Label>
                  <p className="text-sm capitalize">{payment.paymentMode}</p>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      );
    }

    if (selectedRecord.type === "vendor-payment") {
      const vp = selectedRecord.data as PendingVendorPayment;
      return (
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between p-4 border-b bg-muted/30">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon" 
                className="md:hidden h-8 w-8"
                onClick={() => setSelectedRecord(null)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h3 className="font-semibold">{vp.requestCode}</h3>
                <Badge variant={vp.status === "paid" ? "default" : vp.status === "pending" ? "secondary" : "destructive"} className="mt-1">
                  {vp.status}
                </Badge>
              </div>
            </div>
          </div>
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              <div>
                <p className="text-3xl font-bold">₹{parseFloat(vp.amount).toLocaleString('en-IN')}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Vendor</Label>
                  <p className="text-sm font-medium">{vp.vendorName}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Requested By</Label>
                  <p className="text-sm">{vp.employeeName}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Event</Label>
                  <p className="text-sm">{vp.eventName || "-"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Date</Label>
                  <p className="text-sm">{format(new Date(vp.createdAt), "dd MMM yyyy")}</p>
                </div>
                {vp.description && (
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Description</Label>
                    <p className="text-sm">{vp.description}</p>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Mobile Header */}
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

      {/* Mobile Menu Overlay */}
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

      {/* Desktop 3-Panel Layout */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left Panel - Navigation */}
          <ResizablePanel 
            defaultSize={leftPanelCollapsed ? 4 : 18} 
            minSize={4} 
            maxSize={25}
            className="bg-sidebar"
          >
            <div className="flex flex-col h-full">
              <div className={cn(
                "flex items-center border-b border-sidebar-border p-3",
                leftPanelCollapsed ? "justify-center" : "justify-between"
              )}>
                {!leftPanelCollapsed && (
                  <div>
                    <h2 className="text-lg font-serif font-semibold text-primary">Oak Book</h2>
                    <p className="text-xs text-sidebar-foreground/60">Accounting</p>
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-sidebar-foreground/60"
                  onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
                >
                  {leftPanelCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                </Button>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  <Link href="/">
                    <Button
                      variant="ghost"
                      className={cn(
                        "w-full gap-2 text-sidebar-foreground/70 hover:text-sidebar-foreground",
                        leftPanelCollapsed ? "justify-center px-2" : "justify-start"
                      )}
                      size="sm"
                    >
                      <Home className="h-4 w-4 flex-shrink-0" />
                      {!leftPanelCollapsed && <span>Dashboard</span>}
                    </Button>
                  </Link>
                  {SIDEBAR_SECTIONS.map((section) => (
                    <div key={section.id}>
                      {section.children ? (
                        <>
                          <Button
                            variant="ghost"
                            className={cn(
                              "w-full text-sm font-medium text-sidebar-foreground hover:text-sidebar-foreground",
                              leftPanelCollapsed ? "justify-center px-2" : "justify-between",
                              expandedMenus.includes(section.id) && "bg-sidebar-accent/50"
                            )}
                            onClick={() => leftPanelCollapsed ? setLeftPanelCollapsed(false) : toggleMenu(section.id)}
                            data-testid={`nav-${section.id}`}
                          >
                            <span className={cn("flex items-center gap-2", leftPanelCollapsed && "justify-center")}>
                              <section.icon className="h-4 w-4 flex-shrink-0" />
                              {!leftPanelCollapsed && section.label}
                            </span>
                            {!leftPanelCollapsed && (
                              expandedMenus.includes(section.id) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )
                            )}
                          </Button>
                          {!leftPanelCollapsed && expandedMenus.includes(section.id) && (
                            <div className="ml-6 space-y-1 mt-1">
                              {section.children.map((child) => (
                                <div key={child.id}>
                                  {child.children ? (
                                    <>
                                      <Button
                                        variant="ghost"
                                        className={cn(
                                          "w-full justify-between text-sm text-sidebar-foreground hover:text-sidebar-foreground",
                                          expandedMenus.includes(child.id) && "bg-sidebar-accent/30"
                                        )}
                                        onClick={() => toggleMenu(child.id)}
                                        data-testid={`nav-${child.id}`}
                                      >
                                        {child.label}
                                        {expandedMenus.includes(child.id) ? (
                                          <ChevronDown className="h-3 w-3" />
                                        ) : (
                                          <ChevronRight className="h-3 w-3" />
                                        )}
                                      </Button>
                                      {expandedMenus.includes(child.id) && (
                                        <div className="ml-4 space-y-1 mt-1">
                                          {child.children.map((subChild) => (
                                            <Button
                                              key={subChild.id}
                                              variant="ghost"
                                              size="sm"
                                              className={cn(
                                                "w-full justify-start text-xs h-7 text-sidebar-foreground/90 hover:text-sidebar-foreground",
                                                activeSection === subChild.id &&
                                                  "bg-sidebar-accent text-sidebar-accent-foreground"
                                              )}
                                              onClick={() => { handleNavClick(subChild.id); setSelectedRecord(null); }}
                                              data-testid={`nav-${subChild.id}`}
                                            >
                                              {subChild.label}
                                            </Button>
                                          ))}
                                        </div>
                                      )}
                                    </>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      className={cn(
                                        "w-full justify-start text-sm text-sidebar-foreground/90 hover:text-sidebar-foreground",
                                        activeSection === child.id &&
                                          "bg-sidebar-accent text-sidebar-accent-foreground"
                                      )}
                                      onClick={() => { handleNavClick(child.id); setSelectedRecord(null); }}
                                      data-testid={`nav-${child.id}`}
                                    >
                                      {child.label}
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <Button
                          variant="ghost"
                          className={cn(
                            "w-full gap-2 text-sm font-medium text-sidebar-foreground hover:text-sidebar-foreground",
                            leftPanelCollapsed ? "justify-center px-2" : "justify-start",
                            activeSection === section.id &&
                              "bg-sidebar-accent text-sidebar-accent-foreground"
                          )}
                          onClick={() => { handleNavClick(section.id); setSelectedRecord(null); }}
                          data-testid={`nav-${section.id}`}
                        >
                          <section.icon className="h-4 w-4 flex-shrink-0" />
                          {!leftPanelCollapsed && section.label}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Middle Panel - List View */}
          <ResizablePanel defaultSize={42} minSize={30}>
            <div className="h-full overflow-auto p-4">
              {renderContent()}
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right Panel - Preview */}
          <ResizablePanel defaultSize={40} minSize={25}>
            <div className="h-full border-l bg-card">
              {renderPreviewPanel()}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Mobile Content */}
      <div className="md:hidden flex-1 overflow-auto p-4">
        {selectedRecord ? renderPreviewPanel() : renderContent()}
      </div>

      <CustomerModal />
      <VendorModal />
      <ItemModal />
      
      {/* Invoice Modal */}
      <Dialog open={invoiceModalOpen} onOpenChange={setInvoiceModalOpen}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editingInvoice ? "Edit Invoice" : "New Invoice"}</DialogTitle>
          </DialogHeader>
          <InvoiceForm 
            invoice={editingInvoice}
            customers={customers}
            onSubmit={(data) => {
              if (editingInvoice) {
                updateInvoice.mutate({ id: editingInvoice.id, data });
              } else {
                createInvoice.mutate(data);
              }
            }}
            onCancel={() => setInvoiceModalOpen(false)}
            onCreateCustomer={() => { setEditingCustomer(null); setCustomerModalOpen(true); }}
          />
        </DialogContent>
      </Dialog>

      {/* Estimate Modal */}
      <Dialog open={estimateModalOpen} onOpenChange={setEstimateModalOpen}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editingEstimate ? "Edit Estimate" : "New Estimate"}</DialogTitle>
          </DialogHeader>
          <EstimateForm 
            estimate={editingEstimate}
            customers={customers}
            onSubmit={(data) => {
              if (editingEstimate) {
                updateEstimate.mutate({ id: editingEstimate.id, data });
              } else {
                createEstimate.mutate(data);
              }
            }}
            onCancel={() => setEstimateModalOpen(false)}
            onCreateCustomer={() => { setEditingCustomer(null); setCustomerModalOpen(true); }}
          />
        </DialogContent>
      </Dialog>

      {/* Payment Modal */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="w-[95vw] max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPayment ? "Edit Payment" : "Record Payment"}</DialogTitle>
          </DialogHeader>
          <PaymentForm 
            payment={editingPayment}
            customers={customers}
            invoices={invoices}
            onSubmit={(data) => {
              if (editingPayment) {
                updatePayment.mutate({ id: editingPayment.id, data });
              } else {
                createPayment.mutate(data);
              }
            }}
            onCancel={() => setPaymentModalOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Expense Modal */}
      <Dialog open={expenseModalOpen} onOpenChange={setExpenseModalOpen}>
        <DialogContent className="w-[95vw] max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingExpense ? "Edit Expense" : "Record Expense"}</DialogTitle>
          </DialogHeader>
          <ExpenseForm 
            expense={editingExpense}
            vendors={vendors}
            onSubmit={(data) => {
              if (editingExpense) {
                updateExpense.mutate({ id: editingExpense.id, data });
              } else {
                createExpense.mutate(data);
              }
            }}
            onCancel={() => setExpenseModalOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Bill Modal */}
      <Dialog open={billModalOpen} onOpenChange={setBillModalOpen}>
        <DialogContent className="w-[95vw] max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingBill ? "Edit Bill" : "Add Bill"}</DialogTitle>
          </DialogHeader>
          <BillForm 
            bill={editingBill}
            vendors={vendors}
            onSubmit={(data) => {
              if (editingBill) {
                updateBill.mutate({ id: editingBill.id, data });
              } else {
                createBill.mutate(data);
              }
            }}
            onCancel={() => setBillModalOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delivery Challan Modal */}
      <DeliveryChallanModal 
        open={deliveryChallanModalOpen}
        onOpenChange={setDeliveryChallanModalOpen}
        challan={editingDeliveryChallan}
        onSubmit={(data) => {
          if (editingDeliveryChallan) {
            updateDeliveryChallan.mutate({ id: editingDeliveryChallan.id, data });
          } else {
            createDeliveryChallan.mutate(data);
          }
        }}
        companySettings={companySettings}
      />

      {/* Preview Modal */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Document Preview</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => previewType && previewId && handleDownloadPdf(previewType, previewId, false)}>
                    With Header
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => previewType && previewId && handleDownloadPdf(previewType, previewId, true)}>
                    Without Header
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </DialogTitle>
          </DialogHeader>
          {previewType && previewId && (
            <iframe 
              src={`/print/${previewType}/${previewId}`}
              className="w-full h-[70vh] border rounded"
              title="Document Preview"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface LineItem {
  name: string;
  description?: string;
  hsnSac?: string;
  quantity: number;
  rate: number;
  total: number;
  taxRate?: number;
  cgstPercent?: number;
  cgstAmount?: number;
  sgstPercent?: number;
  sgstAmount?: number;
  isHeading?: boolean;
  slNo?: number;
}

function InvoiceForm({ invoice, customers, onSubmit, onCancel, onCreateCustomer }: { 
  invoice: Invoice | null; 
  customers: Customer[]; 
  onSubmit: (data: any) => void; 
  onCancel: () => void;
  onCreateCustomer: () => void;
}) {
  const [formData, setFormData] = useState({
    number: invoice?.number || `INV-${Date.now().toString().slice(-6)}`,
    customerId: invoice?.customerId || "",
    date: invoice?.date || format(new Date(), "yyyy-MM-dd"),
    status: invoice?.status || "draft",
    subject: (invoice as any)?.subject || "",
    customerAddress: (invoice as any)?.customerAddress || "",
    weddingPlannerName: (invoice as any)?.weddingPlannerName || "",
    serviceChargePercent: (invoice as any)?.serviceChargePercent || "12.5",
    discountPercent: (invoice as any)?.discountPercent || "0",
    notes: (invoice as any)?.notes || "Looking forward for your business.",
    terms: (invoice as any)?.terms || "1. Any other additional facilities & Services to support the event will be charged at actual\n2. 15% of the total amount to be paid in advance, 40% of the amount to be paid three months before the event, 40% three weeks before the event, and a balance of 5% on the event day.\n3. The venue is to be made available 1 day prior to the setup.\n4. Loading & unloading charges (Labour Union Charges) if any will be actual and have to be born by the client\n5. Any Damage that occurred to our materials by participants will be charged at the actual.\n6. In the unlikely event of cancellation of the function, the company reserves the right to claim 10% of the total amount as cancellation fees.\n7. All items mentioned above are on a rental basis for this event only\n8. 18% GST will be extra.",
    thankYouMessage: (invoice as any)?.thankYouMessage || "Looking forward for your business.",
    isTaxDocument: (invoice as any)?.isTaxDocument || false,
    placeOfSupply: (invoice as any)?.placeOfSupply || "Kerala (32)",
  });
  const [validationError, setValidationError] = useState<string | null>(null);

  const [lineItems, setLineItems] = useState<LineItem[]>(
    (invoice as any)?.lineItems || [{ name: "", quantity: 1, rate: 0, total: 0, isHeading: false, hsnSac: "", cgstPercent: 9, sgstPercent: 9, cgstAmount: 0, sgstAmount: 0 }]
  );

  // Recalculate tax amounts when document type changes or on load
  useEffect(() => {
    if (formData.isTaxDocument) {
      setLineItems(prev => prev.map(item => {
        if (item.isHeading) return item;
        const baseAmount = item.quantity * item.rate;
        return {
          ...item,
          cgstPercent: item.cgstPercent ?? 9,
          sgstPercent: item.sgstPercent ?? 9,
          cgstAmount: baseAmount * ((item.cgstPercent ?? 9) / 100),
          sgstAmount: baseAmount * ((item.sgstPercent ?? 9) / 100),
        };
      }));
    }
  }, [formData.isTaxDocument]);

  const addItem = () => {
    if (formData.isTaxDocument) {
      setLineItems([...lineItems, { name: "", quantity: 1, rate: 0, total: 0, isHeading: false, hsnSac: "", cgstPercent: 9, sgstPercent: 9, cgstAmount: 0, sgstAmount: 0 }]);
    } else {
      setLineItems([...lineItems, { name: "", quantity: 1, rate: 0, total: 0, isHeading: false }]);
    }
  };

  const addHeader = () => {
    setLineItems([...lineItems, { name: "", quantity: 0, rate: 0, total: 0, isHeading: true }]);
  };

  const removeItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof LineItem, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'quantity' || field === 'rate' || field === 'cgstPercent' || field === 'sgstPercent') {
      const baseAmount = updated[index].quantity * updated[index].rate;
      updated[index].total = baseAmount;
      if (formData.isTaxDocument) {
        updated[index].cgstAmount = baseAmount * ((updated[index].cgstPercent || 0) / 100);
        updated[index].sgstAmount = baseAmount * ((updated[index].sgstPercent || 0) / 100);
      }
    }
    setLineItems(updated);
  };

  const calculateTotals = () => {
    const items = lineItems.filter(i => !i.isHeading);
    const subtotal = items.reduce((sum, item) => sum + (item.total || 0), 0);
    
    if (formData.isTaxDocument) {
      const cgstTotal = items.reduce((sum, item) => sum + (item.cgstAmount || 0), 0);
      const sgstTotal = items.reduce((sum, item) => sum + (item.sgstAmount || 0), 0);
      const total = subtotal + cgstTotal + sgstTotal;
      return { subtotal, discountAmount: 0, serviceChargeAmount: 0, cgstTotal, sgstTotal, total };
    } else {
      const discountAmount = subtotal * (parseFloat(formData.discountPercent) || 0) / 100;
      const afterDiscount = subtotal - discountAmount;
      const serviceChargeAmount = afterDiscount * (parseFloat(formData.serviceChargePercent) || 0) / 100;
      const total = afterDiscount + serviceChargeAmount;
      return { subtotal, discountAmount, serviceChargeAmount, cgstTotal: 0, sgstTotal: 0, total };
    }
  };

  const totals = calculateTotals();

  const handleSubmit = () => {
    if (!formData.weddingPlannerName.trim()) {
      setValidationError("Wedding Planner Name is required");
      return;
    }
    
    // HSN code validation for tax documents
    if (formData.isTaxDocument) {
      const itemsWithoutHsn = lineItems.filter(item => !item.isHeading && !((item as any).hsnSac || '').trim());
      if (itemsWithoutHsn.length > 0) {
        setValidationError("HSN/SAC code is required for all items in Tax Invoice");
        return;
      }
    }
    setValidationError(null);

    let slNo = 0;
    const numberedItems = lineItems.map(item => {
      if (item.isHeading) {
        return { ...item, slNo: undefined };
      }
      slNo++;
      return { ...item, slNo };
    });

    onSubmit({
      ...formData,
      lineItems: numberedItems,
      subtotal: totals.subtotal.toFixed(2),
      discountAmount: totals.discountAmount.toFixed(2),
      serviceChargeAmount: totals.serviceChargeAmount.toFixed(2),
      cgstTotal: (totals.cgstTotal || 0).toFixed(2),
      sgstTotal: (totals.sgstTotal || 0).toFixed(2),
      total: totals.total.toFixed(2),
      balanceDue: totals.total.toFixed(2),
      taxTotal: formData.isTaxDocument ? ((totals.cgstTotal || 0) + (totals.sgstTotal || 0)).toFixed(2) : "0.00",
    });
  };

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
      {validationError && (
        <div className="bg-destructive/10 text-destructive text-sm p-2 rounded-md">{validationError}</div>
      )}
      {/* Document Type Selection */}
      <div className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg border">
        <Label className="text-xs font-semibold">Document Type:</Label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="invDocType" checked={!formData.isTaxDocument} onChange={() => setFormData({ ...formData, isTaxDocument: false })} className="w-4 h-4" />
            <span className="text-sm">Standard Invoice</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="invDocType" checked={formData.isTaxDocument} onChange={() => setFormData({ ...formData, isTaxDocument: true })} className="w-4 h-4" />
            <span className="text-sm font-medium text-primary">Tax Invoice (GST)</span>
          </label>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <Label className="text-xs">Invoice Number</Label>
          <Input value={formData.number} onChange={(e) => setFormData({ ...formData, number: e.target.value })} className="h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Date</Label>
          <Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {formData.isTaxDocument && (
          <div>
            <Label className="text-xs">Place of Supply</Label>
            <Select value={formData.placeOfSupply} onValueChange={(v) => setFormData({ ...formData, placeOfSupply: v })}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-60">
                {INDIAN_STATES.map((state) => <SelectItem key={state} value={state}>{state}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Customer</Label>
          <div className="flex gap-1">
            <Select value={formData.customerId || ""} onValueChange={(v) => setFormData({ ...formData, customerId: v })}>
              <SelectTrigger className="h-8 text-sm flex-1"><SelectValue placeholder="Select customer" /></SelectTrigger>
              <SelectContent>
                {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="sm" onClick={onCreateCustomer} className="h-8 px-2" title="Create Customer">
              <UserPlus className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div>
          <Label className="text-xs">Wedding Planner Name <span className="text-destructive">*</span></Label>
          <Input value={formData.weddingPlannerName} onChange={(e) => setFormData({ ...formData, weddingPlannerName: e.target.value })} placeholder="Required" className="h-8 text-sm" />
        </div>
      </div>

      <div>
        <Label className="text-xs">Customer Address</Label>
        <Textarea value={formData.customerAddress} onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })} rows={2} className="text-sm" />
      </div>

      <div>
        <Label className="text-xs">Subject</Label>
        <Input value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} placeholder="e.g., Welcome party, Sangeet & Wedding on 14&15th Dec 2025" className="h-8 text-sm" />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs font-semibold">Line Items</Label>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={addHeader} className="h-7 text-xs">
              <Plus className="w-3 h-3 mr-1" /> Header
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={addItem} className="h-7 text-xs">
              <Plus className="w-3 h-3 mr-1" /> Item
            </Button>
          </div>
        </div>

        <div className="border rounded-md overflow-hidden overflow-x-auto">
          {formData.isTaxDocument ? (
            <div className="bg-muted px-2 py-1 grid gap-1 text-xs font-medium" style={{ gridTemplateColumns: '3fr 1fr 1fr 1fr 0.7fr 0.7fr 0.7fr 0.7fr 1fr 40px', minWidth: '900px' }}>
              <div>Item & Description</div>
              <div>HSN/SAC</div>
              <div className="text-right">Qty</div>
              <div className="text-right">Rate</div>
              <div className="text-center">CGST%</div>
              <div className="text-right">CGST</div>
              <div className="text-center">SGST%</div>
              <div className="text-right">SGST</div>
              <div className="text-right">Amount</div>
              <div></div>
            </div>
          ) : (
            <div className="bg-muted px-2 py-1 grid grid-cols-12 gap-1 text-xs font-medium">
              <div className="col-span-5">Item & Description</div>
              <div className="col-span-2 text-right">Qty</div>
              <div className="col-span-2 text-right">Rate</div>
              <div className="col-span-2 text-right">Amount</div>
              <div className="col-span-1"></div>
            </div>
          )}

          {lineItems.map((item, index) => (
            formData.isTaxDocument ? (
              <div key={index} className={cn("px-2 py-1 border-t grid gap-1 items-start", item.isHeading && "bg-amber-50")} style={{ gridTemplateColumns: '3fr 1fr 1fr 1fr 0.7fr 0.7fr 0.7fr 0.7fr 1fr 40px', minWidth: '900px' }}>
                {item.isHeading ? (
                  <>
                    <div style={{ gridColumn: 'span 9' }}>
                      <Input value={item.name} onChange={(e) => updateItem(index, 'name', e.target.value)} placeholder="Section heading" className="h-7 text-xs font-bold uppercase" />
                    </div>
                    <div className="flex justify-center">
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)} className="h-6 w-6"><Trash2 className="w-3 h-3 text-destructive" /></Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <Input value={item.name} onChange={(e) => updateItem(index, 'name', e.target.value)} placeholder="Item name" className="h-7 text-xs mb-1" />
                      <Textarea value={item.description || ""} onChange={(e) => updateItem(index, 'description', e.target.value)} placeholder="Description" rows={1} className="text-xs min-h-[28px]" />
                    </div>
                    <div><Input value={item.hsnSac || ""} onChange={(e) => updateItem(index, 'hsnSac', e.target.value)} placeholder="HSN" className="h-7 text-xs" /></div>
                    <div><Input type="number" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)} className="h-7 text-xs text-right" min="0" step="0.01" /></div>
                    <div><Input type="number" value={item.rate} onChange={(e) => updateItem(index, 'rate', parseFloat(e.target.value) || 0)} className="h-7 text-xs text-right" min="0" step="0.01" /></div>
                    <div><Input type="number" value={item.cgstPercent || 0} onChange={(e) => updateItem(index, 'cgstPercent', parseFloat(e.target.value) || 0)} className="h-7 text-xs text-center" min="0" max="50" step="0.5" /></div>
                    <div className="text-right text-xs pt-2">₹{(item.cgstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                    <div><Input type="number" value={item.sgstPercent || 0} onChange={(e) => updateItem(index, 'sgstPercent', parseFloat(e.target.value) || 0)} className="h-7 text-xs text-center" min="0" max="50" step="0.5" /></div>
                    <div className="text-right text-xs pt-2">₹{(item.sgstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                    <div className="text-right text-xs pt-2 font-medium">₹{item.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                    <div className="flex justify-center"><Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)} className="h-6 w-6"><Trash2 className="w-3 h-3 text-destructive" /></Button></div>
                  </>
                )}
              </div>
            ) : (
              <div key={index} className={cn("px-2 py-1 border-t grid grid-cols-12 gap-1 items-start", item.isHeading && "bg-amber-50")}>
                {item.isHeading ? (
                  <>
                    <div className="col-span-11">
                      <Input
                        value={item.name}
                        onChange={(e) => updateItem(index, 'name', e.target.value)}
                        placeholder="Section heading (e.g., MEHANDI ARTIST)"
                        className="h-7 text-xs font-bold uppercase"
                      />
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)} className="h-6 w-6">
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="col-span-5">
                      <Input
                        value={item.name}
                        onChange={(e) => updateItem(index, 'name', e.target.value)}
                        placeholder="Item name"
                        className="h-7 text-xs mb-1"
                      />
                      <Textarea
                        value={item.description || ""}
                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                        placeholder="Description (optional)"
                        rows={1}
                        className="text-xs min-h-[28px]"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                        className="h-7 text-xs text-right"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        value={item.rate}
                        onChange={(e) => updateItem(index, 'rate', parseFloat(e.target.value) || 0)}
                        className="h-7 text-xs text-right"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div className="col-span-2 text-right text-xs pt-2 font-medium">
                      ₹{item.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)} className="h-6 w-6">
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <div className="w-64 space-y-1 text-sm">
          <div className="flex justify-between">
            <span>Sub Total</span>
            <span>₹{totals.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          {formData.isTaxDocument ? (
            <>
              <div className="flex justify-between">
                <span>CGST</span>
                <span>₹{(totals.cgstTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span>SGST</span>
                <span>₹{(totals.sgstTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between items-center gap-2">
                <span>Discount (%)</span>
                <Input
                  type="number"
                  value={formData.discountPercent}
                  onChange={(e) => setFormData({ ...formData, discountPercent: e.target.value })}
                  className="h-6 w-16 text-xs text-right"
                  min="0"
                  max="100"
                />
                <span className="text-destructive">-₹{totals.discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span>Service Charge (%)</span>
                <Input
                  type="number"
                  value={formData.serviceChargePercent}
                  onChange={(e) => setFormData({ ...formData, serviceChargePercent: e.target.value })}
                  className="h-6 w-16 text-xs text-right"
                  min="0"
                />
                <span>₹{totals.serviceChargeAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </>
          )}
          <div className="flex justify-between font-bold text-base border-t pt-1">
            <span>Total</span>
            <span>₹{totals.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Notes</Label>
          <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} className="text-xs" />
        </div>
        <div>
          <Label className="text-xs">Terms & Conditions</Label>
          <Textarea value={formData.terms} onChange={(e) => setFormData({ ...formData, terms: e.target.value })} rows={3} className="text-xs" />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSubmit}>{invoice ? "Update Invoice" : "Create Invoice"}</Button>
      </DialogFooter>
    </div>
  );
}

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

function EstimateForm({ estimate, customers, onSubmit, onCancel, onCreateCustomer }: { 
  estimate: Estimate | null; 
  customers: Customer[]; 
  onSubmit: (data: any) => void; 
  onCancel: () => void;
  onCreateCustomer: () => void;
}) {
  const [formData, setFormData] = useState({
    number: estimate?.number || `EST-${Date.now().toString().slice(-6)}`,
    customerId: estimate?.customerId || "",
    date: estimate?.date || format(new Date(), "yyyy-MM-dd"),
    status: estimate?.status || "draft",
    subject: (estimate as any)?.subject || "",
    customerAddress: (estimate as any)?.customerAddress || "",
    weddingPlannerName: (estimate as any)?.weddingPlannerName || "",
    serviceChargePercent: (estimate as any)?.serviceChargePercent || "12.5",
    discountPercent: (estimate as any)?.discountPercent || "0",
    notes: (estimate as any)?.notes || "Looking forward for your business.",
    terms: (estimate as any)?.terms || "1. Any other additional facilities & Services to support the event will be charged at actual\n2. 15% of the total amount to be paid in advance, 40% of the amount to be paid three months before the event, 40% three weeks before the event, and a balance of 5% on the event day.\n3. The venue is to be made available 1 day prior to the setup.\n4. Loading & unloading charges (Labour Union Charges) if any will be actual and have to be born by the client\n5. Any Damage that occurred to our materials by participants will be charged at the actual.\n6. In the unlikely event of cancellation of the function, the company reserves the right to claim 10% of the total amount as cancellation fees.\n7. All items mentioned above are on a rental basis for this event only\n8. 18% GST will be extra.",
    thankYouMessage: (estimate as any)?.thankYouMessage || "Looking forward for your business.",
    isTaxDocument: (estimate as any)?.isTaxDocument || false,
    placeOfSupply: (estimate as any)?.placeOfSupply || "Kerala (32)",
  });
  const [validationError, setValidationError] = useState<string | null>(null);

  const [lineItems, setLineItems] = useState<LineItem[]>(
    (estimate as any)?.lineItems || [{ name: "", quantity: 1, rate: 0, total: 0, isHeading: false, hsnSac: "", cgstPercent: 9, sgstPercent: 9, cgstAmount: 0, sgstAmount: 0 }]
  );

  // Recalculate tax amounts when document type changes or on load
  useEffect(() => {
    if (formData.isTaxDocument) {
      setLineItems(prev => prev.map(item => {
        if (item.isHeading) return item;
        const baseAmount = item.quantity * item.rate;
        return {
          ...item,
          cgstPercent: item.cgstPercent ?? 9,
          sgstPercent: item.sgstPercent ?? 9,
          cgstAmount: baseAmount * ((item.cgstPercent ?? 9) / 100),
          sgstAmount: baseAmount * ((item.sgstPercent ?? 9) / 100),
        };
      }));
    }
  }, [formData.isTaxDocument]);

  const addItem = () => {
    if (formData.isTaxDocument) {
      setLineItems([...lineItems, { name: "", quantity: 1, rate: 0, total: 0, isHeading: false, hsnSac: "", cgstPercent: 9, sgstPercent: 9, cgstAmount: 0, sgstAmount: 0 }]);
    } else {
      setLineItems([...lineItems, { name: "", quantity: 1, rate: 0, total: 0, isHeading: false }]);
    }
  };

  const addHeader = () => {
    setLineItems([...lineItems, { name: "", quantity: 0, rate: 0, total: 0, isHeading: true }]);
  };

  const removeItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof LineItem, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'quantity' || field === 'rate' || field === 'cgstPercent' || field === 'sgstPercent') {
      const baseAmount = updated[index].quantity * updated[index].rate;
      updated[index].total = baseAmount;
      if (formData.isTaxDocument) {
        updated[index].cgstAmount = baseAmount * ((updated[index].cgstPercent || 0) / 100);
        updated[index].sgstAmount = baseAmount * ((updated[index].sgstPercent || 0) / 100);
      }
    }
    setLineItems(updated);
  };

  const calculateTotals = () => {
    const items = lineItems.filter(i => !i.isHeading);
    const subtotal = items.reduce((sum, item) => sum + (item.total || 0), 0);
    
    if (formData.isTaxDocument) {
      const cgstTotal = items.reduce((sum, item) => sum + (item.cgstAmount || 0), 0);
      const sgstTotal = items.reduce((sum, item) => sum + (item.sgstAmount || 0), 0);
      const total = subtotal + cgstTotal + sgstTotal;
      return { subtotal, discountAmount: 0, serviceChargeAmount: 0, cgstTotal, sgstTotal, total };
    } else {
      const discountAmount = subtotal * (parseFloat(formData.discountPercent) || 0) / 100;
      const afterDiscount = subtotal - discountAmount;
      const serviceChargeAmount = afterDiscount * (parseFloat(formData.serviceChargePercent) || 0) / 100;
      const total = afterDiscount + serviceChargeAmount;
      return { subtotal, discountAmount, serviceChargeAmount, cgstTotal: 0, sgstTotal: 0, total };
    }
  };

  const totals = calculateTotals();

  const handleSubmit = () => {
    if (!formData.weddingPlannerName.trim()) {
      setValidationError("Wedding Planner Name is required");
      return;
    }
    
    // HSN code validation for tax documents
    if (formData.isTaxDocument) {
      const itemsWithoutHsn = lineItems.filter(item => !item.isHeading && !((item as any).hsnSac || '').trim());
      if (itemsWithoutHsn.length > 0) {
        setValidationError("HSN/SAC code is required for all items in Tax Estimate");
        return;
      }
    }
    setValidationError(null);

    let slNo = 0;
    const numberedItems = lineItems.map(item => {
      if (item.isHeading) {
        return { ...item, slNo: undefined };
      }
      slNo++;
      return { ...item, slNo };
    });

    onSubmit({
      ...formData,
      lineItems: numberedItems,
      subtotal: totals.subtotal.toFixed(2),
      discountAmount: totals.discountAmount.toFixed(2),
      serviceChargeAmount: totals.serviceChargeAmount.toFixed(2),
      cgstTotal: (totals.cgstTotal || 0).toFixed(2),
      sgstTotal: (totals.sgstTotal || 0).toFixed(2),
      total: totals.total.toFixed(2),
      taxTotal: formData.isTaxDocument ? ((totals.cgstTotal || 0) + (totals.sgstTotal || 0)).toFixed(2) : "0.00",
    });
  };

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
      {validationError && (
        <div className="bg-destructive/10 text-destructive text-sm p-2 rounded-md">{validationError}</div>
      )}
      {/* Document Type Selection */}
      <div className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg border">
        <Label className="text-xs font-semibold">Document Type:</Label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="radio" 
              name="docType" 
              checked={!formData.isTaxDocument} 
              onChange={() => setFormData({ ...formData, isTaxDocument: false })}
              className="w-4 h-4"
            />
            <span className="text-sm">Standard Estimate</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="radio" 
              name="docType" 
              checked={formData.isTaxDocument} 
              onChange={() => setFormData({ ...formData, isTaxDocument: true })}
              className="w-4 h-4"
            />
            <span className="text-sm font-medium text-primary">Tax Estimate (GST)</span>
          </label>
        </div>
      </div>

      {/* Basic Info */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <Label className="text-xs">Estimate Number</Label>
          <Input value={formData.number} onChange={(e) => setFormData({ ...formData, number: e.target.value })} className="h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Date</Label>
          <Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="declined">Declined</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {formData.isTaxDocument && (
          <div>
            <Label className="text-xs">Place of Supply</Label>
            <Select value={formData.placeOfSupply} onValueChange={(v) => setFormData({ ...formData, placeOfSupply: v })}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-60">
                {INDIAN_STATES.map((state) => <SelectItem key={state} value={state}>{state}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Customer & Address */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Customer</Label>
          <div className="flex gap-1">
            <Select value={formData.customerId || ""} onValueChange={(v) => setFormData({ ...formData, customerId: v })}>
              <SelectTrigger className="h-8 text-sm flex-1"><SelectValue placeholder="Select customer" /></SelectTrigger>
              <SelectContent>
                {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="sm" onClick={onCreateCustomer} className="h-8 px-2" title="Create Customer">
              <UserPlus className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div>
          <Label className="text-xs">Wedding Planner Name <span className="text-destructive">*</span></Label>
          <Input value={formData.weddingPlannerName} onChange={(e) => setFormData({ ...formData, weddingPlannerName: e.target.value })} placeholder="Required" className="h-8 text-sm" />
        </div>
      </div>

      <div>
        <Label className="text-xs">Customer Address</Label>
        <Textarea value={formData.customerAddress} onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })} rows={2} className="text-sm" />
      </div>

      <div>
        <Label className="text-xs">Subject</Label>
        <Input value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} placeholder="e.g., Welcome party, Sangeet & Wedding on 14&15th Dec 2025" className="h-8 text-sm" />
      </div>

      {/* Line Items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs font-semibold">Line Items</Label>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={addHeader} className="h-7 text-xs">
              <Plus className="w-3 h-3 mr-1" /> Header
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={addItem} className="h-7 text-xs">
              <Plus className="w-3 h-3 mr-1" /> Item
            </Button>
          </div>
        </div>

        {formData.isTaxDocument ? (
          /* Tax Estimate Line Items Table */
          <div className="border rounded-md overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted">
                <tr>
                  <th className="px-2 py-1 text-left w-1/4">Item & Description</th>
                  <th className="px-2 py-1 text-left w-20">HSN/SAC</th>
                  <th className="px-2 py-1 text-right w-16">Qty</th>
                  <th className="px-2 py-1 text-right w-20">Rate</th>
                  <th className="px-2 py-1 text-center w-16">CGST%</th>
                  <th className="px-2 py-1 text-right w-20">CGST</th>
                  <th className="px-2 py-1 text-center w-16">SGST%</th>
                  <th className="px-2 py-1 text-right w-20">SGST</th>
                  <th className="px-2 py-1 text-right w-24">Amount</th>
                  <th className="px-2 py-1 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, index) => (
                  <tr key={index} className={cn("border-t", item.isHeading && "bg-amber-50")}>
                    {item.isHeading ? (
                      <>
                        <td colSpan={9} className="px-2 py-1">
                          <Input value={item.name} onChange={(e) => updateItem(index, 'name', e.target.value)} placeholder="Section heading" className="h-7 text-xs font-bold uppercase" />
                        </td>
                        <td className="px-1 py-1">
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)} className="h-6 w-6"><Trash2 className="w-3 h-3 text-destructive" /></Button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-2 py-1"><Input value={item.name} onChange={(e) => updateItem(index, 'name', e.target.value)} placeholder="Item" className="h-7 text-xs" /></td>
                        <td className="px-2 py-1"><Input value={(item as any).hsnSac || ""} onChange={(e) => updateItem(index, 'hsnSac' as any, e.target.value)} placeholder="998596" className="h-7 text-xs" /></td>
                        <td className="px-2 py-1"><Input type="number" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)} className="h-7 text-xs text-right" min="0" step="0.01" /></td>
                        <td className="px-2 py-1"><Input type="number" value={item.rate} onChange={(e) => updateItem(index, 'rate', parseFloat(e.target.value) || 0)} className="h-7 text-xs text-right" min="0" /></td>
                        <td className="px-2 py-1"><Input type="number" value={(item as any).cgstPercent || 9} onChange={(e) => updateItem(index, 'cgstPercent' as any, parseFloat(e.target.value) || 0)} className="h-7 text-xs text-center" min="0" max="28" /></td>
                        <td className="px-2 py-1 text-right">₹{((item as any).cgstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="px-2 py-1"><Input type="number" value={(item as any).sgstPercent || 9} onChange={(e) => updateItem(index, 'sgstPercent' as any, parseFloat(e.target.value) || 0)} className="h-7 text-xs text-center" min="0" max="28" /></td>
                        <td className="px-2 py-1 text-right">₹{((item as any).sgstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="px-2 py-1 text-right font-medium">₹{item.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="px-1 py-1"><Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)} className="h-6 w-6"><Trash2 className="w-3 h-3 text-destructive" /></Button></td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Standard Estimate Line Items Table */
          <div className="border rounded-md overflow-hidden">
            <div className="bg-muted px-2 py-1 grid grid-cols-12 gap-1 text-xs font-medium">
              <div className="col-span-5">Item & Description</div>
              <div className="col-span-2 text-right">Qty</div>
              <div className="col-span-2 text-right">Rate</div>
              <div className="col-span-2 text-right">Amount</div>
              <div className="col-span-1"></div>
            </div>

            {lineItems.map((item, index) => (
              <div key={index} className={cn("px-2 py-1 border-t grid grid-cols-12 gap-1 items-start", item.isHeading && "bg-amber-50")}>
                {item.isHeading ? (
                  <>
                    <div className="col-span-11">
                      <Input value={item.name} onChange={(e) => updateItem(index, 'name', e.target.value)} placeholder="Section heading (e.g., MEHANDI ARTIST)" className="h-7 text-xs font-bold uppercase" />
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)} className="h-6 w-6"><Trash2 className="w-3 h-3 text-destructive" /></Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="col-span-5">
                      <Input value={item.name} onChange={(e) => updateItem(index, 'name', e.target.value)} placeholder="Item name" className="h-7 text-xs mb-1" />
                      <Textarea value={item.description || ""} onChange={(e) => updateItem(index, 'description', e.target.value)} placeholder="Description (optional)" rows={1} className="text-xs min-h-[28px]" />
                    </div>
                    <div className="col-span-2">
                      <Input type="number" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)} className="h-7 text-xs text-right" min="0" step="0.01" />
                    </div>
                    <div className="col-span-2">
                      <Input type="number" value={item.rate} onChange={(e) => updateItem(index, 'rate', parseFloat(e.target.value) || 0)} className="h-7 text-xs text-right" min="0" step="0.01" />
                    </div>
                    <div className="col-span-2 text-right text-xs pt-2 font-medium">₹{item.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                    <div className="col-span-1 flex justify-center">
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)} className="h-6 w-6"><Trash2 className="w-3 h-3 text-destructive" /></Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-72 space-y-1 text-sm">
          <div className="flex justify-between">
            <span>Sub Total</span>
            <span>₹{totals.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          {formData.isTaxDocument ? (
            <>
              <div className="flex justify-between">
                <span>CGST</span>
                <span>₹{(totals.cgstTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span>SGST</span>
                <span>₹{(totals.sgstTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between items-center gap-2">
                <span>Discount (%)</span>
                <Input type="number" value={formData.discountPercent} onChange={(e) => setFormData({ ...formData, discountPercent: e.target.value })} className="h-6 w-16 text-xs text-right" min="0" max="100" />
                <span className="text-destructive">-₹{totals.discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span>Service Charge (%)</span>
                <Input type="number" value={formData.serviceChargePercent} onChange={(e) => setFormData({ ...formData, serviceChargePercent: e.target.value })} className="h-6 w-16 text-xs text-right" min="0" />
                <span>₹{totals.serviceChargeAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </>
          )}
          <div className="flex justify-between font-bold text-base border-t pt-1">
            <span>Total</span>
            <span>₹{totals.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {/* Notes & Terms */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Notes</Label>
          <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} className="text-xs" />
        </div>
        <div>
          <Label className="text-xs">Terms & Conditions</Label>
          <Textarea value={formData.terms} onChange={(e) => setFormData({ ...formData, terms: e.target.value })} rows={3} className="text-xs" />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSubmit}>{estimate ? "Update Estimate" : "Create Estimate"}</Button>
      </DialogFooter>
    </div>
  );
}

function PaymentForm({ payment, customers, invoices, onSubmit, onCancel }: { 
  payment: CustomerPayment | null; 
  customers: Customer[]; 
  invoices: Invoice[];
  onSubmit: (data: any) => void; 
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    number: payment?.number || `REC-${Date.now().toString().slice(-6)}`,
    customerId: payment?.customerId || "",
    date: payment?.date || format(new Date(), "yyyy-MM-dd"),
    amount: payment?.amount || "0",
    paymentMode: payment?.paymentMode || "cash",
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Receipt Number</Label>
          <Input value={formData.number} onChange={(e) => setFormData({ ...formData, number: e.target.value })} />
        </div>
        <div>
          <Label>Date</Label>
          <Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
        </div>
      </div>
      <div>
        <Label>Customer</Label>
        <Select value={formData.customerId || ""} onValueChange={(v) => setFormData({ ...formData, customerId: v })}>
          <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
          <SelectContent>
            {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Amount (₹)</Label>
          <Input type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} />
        </div>
        <div>
          <Label>Payment Mode</Label>
          <Select value={formData.paymentMode} onValueChange={(v) => setFormData({ ...formData, paymentMode: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
              <SelectItem value="upi">UPI</SelectItem>
              <SelectItem value="cheque">Cheque</SelectItem>
              <SelectItem value="card">Card</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSubmit(formData)}>{payment ? "Update" : "Record"}</Button>
      </DialogFooter>
    </div>
  );
}

function ExpenseForm({ expense, vendors, onSubmit, onCancel }: { 
  expense: Expense | null; 
  vendors: Vendor[]; 
  onSubmit: (data: any) => void; 
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    number: expense?.number || `EXP-${Date.now().toString().slice(-6)}`,
    vendorId: expense?.vendorId || "",
    date: expense?.date || format(new Date(), "yyyy-MM-dd"),
    category: expense?.category || "",
    description: expense?.description || "",
    total: expense?.total || "0",
    status: expense?.status || "pending",
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Expense Number</Label>
          <Input value={formData.number} onChange={(e) => setFormData({ ...formData, number: e.target.value })} />
        </div>
        <div>
          <Label>Date</Label>
          <Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
        </div>
      </div>
      <div>
        <Label>Vendor</Label>
        <Select value={formData.vendorId || ""} onValueChange={(v) => setFormData({ ...formData, vendorId: v })}>
          <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
          <SelectContent>
            {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Category</Label>
          <Input value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} placeholder="e.g., Travel, Office" />
        </div>
        <div>
          <Label>Amount (₹)</Label>
          <Input type="number" value={formData.total} onChange={(e) => setFormData({ ...formData, total: e.target.value })} />
        </div>
      </div>
      <div>
        <Label>Description</Label>
        <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
      </div>
      <div>
        <Label>Status</Label>
        <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSubmit(formData)}>{expense ? "Update" : "Record"}</Button>
      </DialogFooter>
    </div>
  );
}

function BillForm({ bill, vendors, onSubmit, onCancel }: { 
  bill: Bill | null; 
  vendors: Vendor[]; 
  onSubmit: (data: any) => void; 
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    number: bill?.number || `BILL-${Date.now().toString().slice(-6)}`,
    vendorId: bill?.vendorId || "",
    date: bill?.date || format(new Date(), "yyyy-MM-dd"),
    total: bill?.total || "0",
    balanceDue: bill?.balanceDue || "0",
    status: bill?.status || "pending",
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Bill Number</Label>
          <Input value={formData.number} onChange={(e) => setFormData({ ...formData, number: e.target.value })} />
        </div>
        <div>
          <Label>Date</Label>
          <Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
        </div>
      </div>
      <div>
        <Label>Vendor</Label>
        <Select value={formData.vendorId || ""} onValueChange={(v) => setFormData({ ...formData, vendorId: v })}>
          <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
          <SelectContent>
            {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Total Amount (₹)</Label>
          <Input type="number" value={formData.total} onChange={(e) => setFormData({ ...formData, total: e.target.value, balanceDue: e.target.value })} />
        </div>
        <div>
          <Label>Status</Label>
          <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSubmit(formData)}>{bill ? "Update" : "Create"}</Button>
      </DialogFooter>
    </div>
  );
}

function SettingsSection({ companySettings, updateCompanySettings }: { companySettings: any; updateCompanySettings: any }) {
  const [settingsForm, setSettingsForm] = useState({
    companyName: companySettings?.companyName || 'Oakstreet Events',
    address: companySettings?.address || '',
    phone: companySettings?.phone || '',
    email: companySettings?.email || '',
    website: companySettings?.website || '',
    gstNumber: companySettings?.gstNumber || '',
    panNumber: companySettings?.panNumber || '',
    placeOfSupply: companySettings?.placeOfSupply || 'Kerala (32)',
    bankName: companySettings?.bankName || '',
    bankAccountNumber: companySettings?.bankAccountNumber || '',
    bankIfscCode: companySettings?.bankIfscCode || '',
    bankBranch: companySettings?.bankBranch || '',
    defaultTerms: companySettings?.defaultTerms || '',
    defaultThankYouMessage: companySettings?.defaultThankYouMessage || 'Looking forward for your business.',
  });

  useEffect(() => {
    if (companySettings) {
      setSettingsForm({
        companyName: companySettings.companyName || 'Oakstreet Events',
        address: companySettings.address || '',
        phone: companySettings.phone || '',
        email: companySettings.email || '',
        website: companySettings.website || '',
        gstNumber: companySettings.gstNumber || '',
        panNumber: companySettings.panNumber || '',
        placeOfSupply: companySettings.placeOfSupply || 'Kerala (32)',
        bankName: companySettings.bankName || '',
        bankAccountNumber: companySettings.bankAccountNumber || '',
        bankIfscCode: companySettings.bankIfscCode || '',
        bankBranch: companySettings.bankBranch || '',
        defaultTerms: companySettings.defaultTerms || '',
        defaultThankYouMessage: companySettings.defaultThankYouMessage || 'Looking forward for your business.',
      });
    }
  }, [companySettings]);

  const handleSaveSettings = () => {
    updateCompanySettings.mutate(settingsForm);
  };

  const indianStates = [
    'Andhra Pradesh (37)', 'Arunachal Pradesh (12)', 'Assam (18)', 'Bihar (10)', 'Chhattisgarh (22)',
    'Goa (30)', 'Gujarat (24)', 'Haryana (06)', 'Himachal Pradesh (02)', 'Jharkhand (20)',
    'Karnataka (29)', 'Kerala (32)', 'Madhya Pradesh (23)', 'Maharashtra (27)', 'Manipur (14)',
    'Meghalaya (17)', 'Mizoram (15)', 'Nagaland (13)', 'Odisha (21)', 'Punjab (03)',
    'Rajasthan (08)', 'Sikkim (11)', 'Tamil Nadu (33)', 'Telangana (36)', 'Tripura (16)',
    'Uttar Pradesh (09)', 'Uttarakhand (05)', 'West Bengal (19)', 'Delhi (07)'
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-serif font-bold text-primary">Settings</h1>

      <Tabs defaultValue="company" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-4 h-auto">
          <TabsTrigger value="company" className="text-xs sm:text-sm">Company</TabsTrigger>
          <TabsTrigger value="tax" className="text-xs sm:text-sm">Tax & GST</TabsTrigger>
          <TabsTrigger value="bank" className="text-xs sm:text-sm">Bank</TabsTrigger>
          <TabsTrigger value="documents" className="text-xs sm:text-sm">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                <div>
                  <Label>Company Name *</Label>
                  <Input 
                    value={settingsForm.companyName} 
                    onChange={(e) => setSettingsForm({...settingsForm, companyName: e.target.value})}
                    placeholder="Oakstreet Events" 
                  />
                </div>
                <div>
                  <Label>Website</Label>
                  <Input 
                    value={settingsForm.website} 
                    onChange={(e) => setSettingsForm({...settingsForm, website: e.target.value})}
                    placeholder="www.oakstreetevents.com" 
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Address</Label>
                  <Textarea 
                    value={settingsForm.address} 
                    onChange={(e) => setSettingsForm({...settingsForm, address: e.target.value})}
                    placeholder="Enter company address (will appear on invoices)" 
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input 
                    value={settingsForm.phone} 
                    onChange={(e) => setSettingsForm({...settingsForm, phone: e.target.value})}
                    placeholder="Phone number" 
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input 
                    value={settingsForm.email} 
                    onChange={(e) => setSettingsForm({...settingsForm, email: e.target.value})}
                    placeholder="Email address" 
                    type="email" 
                  />
                </div>
              </div>
              <Button onClick={handleSaveSettings} disabled={updateCompanySettings.isPending}>
                {updateCompanySettings.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tax" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>GST & Tax Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                <div>
                  <Label>GSTIN</Label>
                  <Input 
                    value={settingsForm.gstNumber} 
                    onChange={(e) => setSettingsForm({...settingsForm, gstNumber: e.target.value.toUpperCase()})}
                    placeholder="e.g., 32AAACU3566G1Z8" 
                    className="uppercase"
                  />
                  <p className="text-xs text-muted-foreground mt-1">15-digit GST Identification Number</p>
                </div>
                <div>
                  <Label>PAN Number</Label>
                  <Input 
                    value={settingsForm.panNumber} 
                    onChange={(e) => setSettingsForm({...settingsForm, panNumber: e.target.value.toUpperCase()})}
                    placeholder="e.g., AAACU3566G" 
                    className="uppercase"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Place of Supply (Default)</Label>
                  <Select 
                    value={settingsForm.placeOfSupply} 
                    onValueChange={(v) => setSettingsForm({...settingsForm, placeOfSupply: v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {indianStates.map((state) => (
                        <SelectItem key={state} value={state}>{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">This will appear on invoices and estimates</p>
                </div>
              </div>
              <Button onClick={handleSaveSettings} disabled={updateCompanySettings.isPending}>
                {updateCompanySettings.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bank" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Bank Details (for Invoices)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">These details will appear on your invoices for customer payments.</p>
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                <div>
                  <Label>Bank Name</Label>
                  <Input 
                    value={settingsForm.bankName} 
                    onChange={(e) => setSettingsForm({...settingsForm, bankName: e.target.value})}
                    placeholder="e.g., State Bank of India" 
                  />
                </div>
                <div>
                  <Label>Account Number</Label>
                  <Input 
                    value={settingsForm.bankAccountNumber} 
                    onChange={(e) => setSettingsForm({...settingsForm, bankAccountNumber: e.target.value})}
                    placeholder="Account number" 
                  />
                </div>
                <div>
                  <Label>IFSC Code</Label>
                  <Input 
                    value={settingsForm.bankIfscCode} 
                    onChange={(e) => setSettingsForm({...settingsForm, bankIfscCode: e.target.value.toUpperCase()})}
                    placeholder="e.g., SBIN0001234" 
                    className="uppercase"
                  />
                </div>
                <div>
                  <Label>Branch</Label>
                  <Input 
                    value={settingsForm.bankBranch} 
                    onChange={(e) => setSettingsForm({...settingsForm, bankBranch: e.target.value})}
                    placeholder="Branch name" 
                  />
                </div>
              </div>
              <Button onClick={handleSaveSettings} disabled={updateCompanySettings.isPending}>
                {updateCompanySettings.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Document Defaults</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div>
                  <Label>Default Terms & Conditions</Label>
                  <Textarea 
                    value={settingsForm.defaultTerms} 
                    onChange={(e) => setSettingsForm({...settingsForm, defaultTerms: e.target.value})}
                    placeholder="Enter default terms that will appear on estimates and invoices" 
                    rows={4}
                  />
                </div>
                <div>
                  <Label>Thank You Message</Label>
                  <Textarea 
                    value={settingsForm.defaultThankYouMessage} 
                    onChange={(e) => setSettingsForm({...settingsForm, defaultThankYouMessage: e.target.value})}
                    placeholder="Thank you message for documents" 
                    rows={2}
                  />
                </div>
              </div>
              <Button onClick={handleSaveSettings} disabled={updateCompanySettings.isPending}>
                {updateCompanySettings.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function numberToWords(num: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  if (num === 0) return 'Zero';
  if (num < 20) return ones[num];
  if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? '-' + ones[num % 10] : '');
  if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + numberToWords(num % 100) : '');
  if (num < 100000) return numberToWords(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 ? ' ' + numberToWords(num % 1000) : '');
  if (num < 10000000) return numberToWords(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 ? ' ' + numberToWords(num % 100000) : '');
  return numberToWords(Math.floor(num / 10000000)) + ' Crore' + (num % 10000000 ? ' ' + numberToWords(num % 10000000) : '');
}

function DeliveryChallanModal({ 
  open, 
  onOpenChange, 
  challan, 
  onSubmit,
  companySettings
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  challan: DeliveryChallan | null;
  onSubmit: (data: any) => void;
  companySettings: any;
}) {
  const [formData, setFormData] = useState({
    challanDate: challan?.challanDate || format(new Date(), "yyyy-MM-dd"),
    challanType: challan?.challanType || "Job Work",
    vehicleNumber: challan?.vehicleNumber || "",
    deliverTo: challan?.deliverTo || "",
    deliveryAddress: challan?.deliveryAddress || "",
    placeOfSupply: challan?.placeOfSupply || "Kerala (32)",
    cgstRate: challan?.cgstRate || "9",
    sgstRate: challan?.sgstRate || "9",
    notes: challan?.notes || "",
  });
  
  const [items, setItems] = useState<{ description: string; hsnCode: string; quantity: number; unit: string; rate: number; amount: number }[]>(
    challan?.items && Array.isArray(challan.items) ? challan.items : [{ description: "Stage Decor Items", hsnCode: "44219160", quantity: 1, unit: "nos", rate: 0, amount: 0 }]
  );

  useEffect(() => {
    if (challan) {
      setFormData({
        challanDate: challan.challanDate || format(new Date(), "yyyy-MM-dd"),
        challanType: challan.challanType || "Job Work",
        vehicleNumber: challan.vehicleNumber || "",
        deliverTo: challan.deliverTo || "",
        deliveryAddress: challan.deliveryAddress || "",
        placeOfSupply: challan.placeOfSupply || "Kerala (32)",
        cgstRate: challan.cgstRate || "9",
        sgstRate: challan.sgstRate || "9",
        notes: challan.notes || "",
      });
      setItems(challan.items && Array.isArray(challan.items) ? challan.items : [{ description: "Stage Decor Items", hsnCode: "44219160", quantity: 1, unit: "nos", rate: 0, amount: 0 }]);
    } else {
      setFormData({
        challanDate: format(new Date(), "yyyy-MM-dd"),
        challanType: "Job Work",
        vehicleNumber: "",
        deliverTo: "",
        deliveryAddress: "",
        placeOfSupply: "Kerala (32)",
        cgstRate: "9",
        sgstRate: "9",
        notes: "",
      });
      setItems([{ description: "Stage Decor Items", hsnCode: "44219160", quantity: 1, unit: "nos", rate: 0, amount: 0 }]);
    }
  }, [challan, open]);

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    if (field === 'quantity' || field === 'rate') {
      newItems[index].amount = newItems[index].quantity * newItems[index].rate;
    }
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { description: "", hsnCode: "", quantity: 1, unit: "nos", rate: 0, amount: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const subTotal = items.reduce((sum, item) => sum + item.amount, 0);
  const cgstRate = parseFloat(formData.cgstRate) || 0;
  const sgstRate = parseFloat(formData.sgstRate) || 0;
  const cgstAmount = subTotal * cgstRate / 100;
  const sgstAmount = subTotal * sgstRate / 100;
  const totalBeforeRounding = subTotal + cgstAmount + sgstAmount;
  const roundedTotal = Math.round(totalBeforeRounding);
  const rounding = roundedTotal - totalBeforeRounding;
  const totalInWords = `Indian Rupee ${numberToWords(roundedTotal)} Only`;

  const handleSubmit = () => {
    if (!formData.deliverTo.trim()) {
      alert("Please enter the recipient name");
      return;
    }
    if (!formData.deliveryAddress.trim()) {
      alert("Please enter the delivery address");
      return;
    }
    
    onSubmit({
      ...formData,
      items,
      subTotal: subTotal.toFixed(2),
      cgstAmount: cgstAmount.toFixed(2),
      sgstAmount: sgstAmount.toFixed(2),
      rounding: rounding.toFixed(2),
      totalAmount: roundedTotal.toFixed(2),
      totalInWords,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{challan ? "Edit Delivery Challan" : "New Delivery Challan"}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Challan Date *</Label>
              <Input
                type="date"
                value={formData.challanDate}
                onChange={(e) => setFormData({ ...formData, challanDate: e.target.value })}
                data-testid="input-dc-date"
              />
            </div>
            <div>
              <Label>Challan Type</Label>
              <Select value={formData.challanType} onValueChange={(v) => setFormData({ ...formData, challanType: v })}>
                <SelectTrigger data-testid="select-dc-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Job Work">Job Work</SelectItem>
                  <SelectItem value="Supply">Supply</SelectItem>
                  <SelectItem value="Return">Return</SelectItem>
                  <SelectItem value="Others">Others</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Vehicle Number</Label>
              <Input
                value={formData.vehicleNumber}
                onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value.toUpperCase() })}
                placeholder="e.g., KL 10 AB 1234"
                data-testid="input-dc-vehicle"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Deliver To *</Label>
              <Input
                value={formData.deliverTo}
                onChange={(e) => setFormData({ ...formData, deliverTo: e.target.value })}
                placeholder="Recipient name/company"
                data-testid="input-dc-deliver-to"
              />
            </div>
            <div>
              <Label>Place of Supply</Label>
              <Input
                value={formData.placeOfSupply}
                onChange={(e) => setFormData({ ...formData, placeOfSupply: e.target.value })}
                placeholder="e.g., Kerala (32)"
                data-testid="input-dc-place-supply"
              />
            </div>
          </div>

          <div>
            <Label>Delivery Address *</Label>
            <Textarea
              value={formData.deliveryAddress}
              onChange={(e) => setFormData({ ...formData, deliveryAddress: e.target.value })}
              placeholder="Full delivery address"
              rows={3}
              data-testid="input-dc-address"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-base font-medium">Items</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" /> Add Item
              </Button>
            </div>
            
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2">#</th>
                    <th className="text-left p-2">Description</th>
                    <th className="text-left p-2 hidden md:table-cell">HSN/SAC</th>
                    <th className="text-right p-2">Qty</th>
                    <th className="text-left p-2 hidden sm:table-cell">Unit</th>
                    <th className="text-right p-2">Rate</th>
                    <th className="text-right p-2">Amount</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={index} className="border-t">
                      <td className="p-2 text-muted-foreground">{index + 1}</td>
                      <td className="p-2">
                        <Input
                          value={item.description}
                          onChange={(e) => updateItem(index, 'description', e.target.value)}
                          placeholder="Item description"
                          className="h-8"
                        />
                      </td>
                      <td className="p-2 hidden md:table-cell">
                        <Input
                          value={item.hsnCode}
                          onChange={(e) => updateItem(index, 'hsnCode', e.target.value)}
                          placeholder="HSN"
                          className="h-8 w-24"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                          className="h-8 w-16 text-right"
                        />
                      </td>
                      <td className="p-2 hidden sm:table-cell">
                        <Input
                          value={item.unit}
                          onChange={(e) => updateItem(index, 'unit', e.target.value)}
                          className="h-8 w-16"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          value={item.rate}
                          onChange={(e) => updateItem(index, 'rate', parseFloat(e.target.value) || 0)}
                          className="h-8 w-24 text-right"
                        />
                      </td>
                      <td className="p-2 text-right font-medium">
                        ₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => removeItem(index)}
                          disabled={items.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end">
            <div className="w-full max-w-xs space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Sub Total:</span>
                <span>₹{subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span>CGST</span>
                <Input
                  type="number"
                  value={formData.cgstRate}
                  onChange={(e) => setFormData({ ...formData, cgstRate: e.target.value })}
                  className="h-7 w-14 text-right text-xs"
                />
                <span>%</span>
                <span>₹{cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span>SGST</span>
                <Input
                  type="number"
                  value={formData.sgstRate}
                  onChange={(e) => setFormData({ ...formData, sgstRate: e.target.value })}
                  className="h-7 w-14 text-right text-xs"
                />
                <span>%</span>
                <span>₹{sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Rounding:</span>
                <span>₹{rounding.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>Total:</span>
                <span>₹{roundedTotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {totalInWords}
              </div>
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>{challan ? "Update Challan" : "Create Challan"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

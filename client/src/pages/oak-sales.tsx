import React, { useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { apiRequest } from "@/lib/queryClient";
import { format, differenceInDays } from "date-fns";
import { useAuth } from "@/context/auth-context";
import {
  LayoutDashboard,
  Target,
  Users,
  Building2,
  CheckSquare,
  Phone,
  Calendar,
  Settings,
  Workflow,
  BarChart3,
  Plus,
  Search,
  Filter,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  DollarSign,
  Clock,
  ArrowLeft,
  GripVertical,
  Edit,
  Trash2,
  X,
  MoreHorizontal,
  Menu,
  FileText,
  ListTodo,
  CheckCircle2,
  Loader2,
  CalendarDays,
  Eye,
  EyeOff,
  Lightbulb,
  Image,
  Link2,
  Music,
  MessageSquare,
  Receipt,
  UserPlus,
  Pencil,
  Save,
  MessageCircle,
  ChevronsUpDown,
  Check,
} from "lucide-react";
import { ZohoQuotes } from "@/components/oak-book/zoho-quotes";
import type { 
  SalesPipeline, 
  SalesStage, 
  SalesDeal, 
  SalesContact, 
  SalesCompany, 
  SalesActivity,
  SalesTarget,
  SalesAutomation,
  User
} from "@shared/schema";

type Section = 'dashboard' | 'pipeline' | 'contacts' | 'companies' | 'activities' | 'pipeline-setup' | 'automations' | 'reports' | 'settings' | 'estimates' | 'portal-leads' | 'vendor-costs';

const formatCurrency = (amount: string | number | null) => {
  if (!amount) return '₹0';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(num);
};

const getIndianFiscalYear = (date: Date = new Date()): string => {
  const month = date.getMonth();
  const year = date.getFullYear();
  if (month >= 3) {
    return `FY${year}-${(year + 1).toString().slice(-2)}`;
  }
  return `FY${year - 1}-${year.toString().slice(-2)}`;
};

export default function OakSales() {
  const getInitialSection = (): Section => {
    const params = new URLSearchParams(window.location.search);
    const section = params.get('section');
    if (section && ['dashboard', 'pipeline', 'contacts', 'companies', 'activities', 'pipeline-setup', 'automations', 'reports', 'settings', 'estimates', 'portal-leads'].includes(section)) {
      return section as Section;
    }
    const saved = localStorage.getItem('oak_sales_active_section');
    if (saved && ['dashboard', 'pipeline', 'contacts', 'companies', 'activities', 'pipeline-setup', 'automations', 'reports', 'settings', 'estimates', 'portal-leads'].includes(saved)) {
      return saved as Section;
    }
    return 'dashboard';
  };
  
  const [activeSection, setActiveSectionState] = useState<Section>(getInitialSection);
  const setActiveSection = (section: Section) => {
    localStorage.setItem('oak_sales_active_section', section);
    setActiveSectionState(section);
  };
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarManuallyToggled, setSidebarManuallyToggled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [autoOpenNewDeal, setAutoOpenNewDeal] = useState(false);
  
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('section', activeSection);
    window.history.replaceState({}, '', url.toString());
  }, [activeSection]);

  // Auto-collapse sidebar when viewing Pipeline for more kanban space
  useEffect(() => {
    if (!sidebarManuallyToggled) {
      setSidebarCollapsed(activeSection === 'pipeline');
    }
  }, [activeSection, sidebarManuallyToggled]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(() => {
    return localStorage.getItem('oak_sales_selected_pipeline') || null;
  });
  const persistPipelineId = (id: string) => {
    localStorage.setItem('oak_sales_selected_pipeline', id);
    setSelectedPipelineId(id);
  };
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const { data: pipelines = [] } = useQuery<SalesPipeline[]>({
    queryKey: ['/api/sales/pipelines'],
  });

  const { data: stages = [] } = useQuery<SalesStage[]>({
    queryKey: ['/api/sales/stages'],
  });

  const { data: deals = [] } = useQuery<SalesDeal[]>({
    queryKey: ['/api/sales/deals'],
  });

  const { data: contacts = [] } = useQuery<SalesContact[]>({
    queryKey: ['/api/sales/contacts'],
  });

  const { data: companies = [] } = useQuery<SalesCompany[]>({
    queryKey: ['/api/sales/companies'],
  });

  const { data: activities = [] } = useQuery<SalesActivity[]>({
    queryKey: ['/api/sales/activities'],
  });

  const { data: estimateValuesMap = {} } = useQuery<Record<string, { total: string; estimateNumber: string; estimateId: string }>>({
    queryKey: ['/api/sales/deals/estimate-values'],
    queryFn: async () => {
      const res = await fetch('/api/sales/deals/estimate-values', { credentials: 'include' });
      if (!res.ok) return {};
      return res.json();
    },
  });

  const { data: targets = [] } = useQuery<SalesTarget[]>({
    queryKey: ['/api/sales/targets'],
  });

  const { data: automations = [] } = useQuery<SalesAutomation[]>({
    queryKey: ['/api/sales/automations'],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  const isSuperAdmin = user?.role === 'superadmin' || user?.role === 'admin';
  const isWeddingPlanner = user?.role === 'wedding_planner';
  const weddingPlanners = users.filter(u => u.role === 'wedding_planner');
  
  const wpPipelineIds = useMemo(() => {
    if (!isWeddingPlanner || !user?.name) return new Set<string>();
    const firstName = user.name.split(' ')[0].toLowerCase();
    return new Set(
      pipelines
        .filter(p => p.name.toLowerCase().includes(firstName))
        .map(p => p.id)
    );
  }, [pipelines, isWeddingPlanner, user?.name]);

  const filteredDeals = useMemo(() => {
    if (isWeddingPlanner && user?.id) {
      return deals.filter(d => 
        d.ownerId === user.id || 
        (!d.ownerId && wpPipelineIds.has(d.pipelineId))
      );
    }
    return deals;
  }, [deals, isWeddingPlanner, user?.id, wpPipelineIds]);

  const handleDownloadPdf = async (type: "invoice" | "quote" | "receipt" | "delivery-challan", id: string, hideHeader: boolean = false) => {
    try {
      toast({ title: "Generating PDF...", description: "Please wait" });

      const res = await apiRequest("GET", `/api/print-data/${type}/${id}`);
      if (!res.ok) throw new Error('Failed to fetch document data');
      const printData = await res.json();

      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '794px';
      container.style.backgroundColor = '#ffffff';
      container.style.zIndex = '-1';
      document.body.appendChild(container);

      const { createRoot } = await import('react-dom/client');
      const { default: PrintDocument } = await import('@/pages/print-document');
      const React = await import('react');

      const root = createRoot(container);
      root.render(
        React.createElement(PrintDocument, { injectedData: printData, injectedType: type })
      );

      await new Promise<void>((resolve) => {
        const check = setInterval(() => {
          const docEl = container.querySelector('.document');
          if (docEl) { clearInterval(check); setTimeout(resolve, 1500); }
        }, 200);
        setTimeout(() => { clearInterval(check); resolve(); }, 10000);
      });

      const docElement = container.querySelector('.document') as HTMLElement;
      if (!docElement) {
        root.unmount();
        document.body.removeChild(container);
        throw new Error('Document element not found');
      }

      const html2canvas = (await import('html2canvas')).default;
      const { default: jsPDF } = await import('jspdf');

      const canvas = await html2canvas(docElement, {
        scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff', width: 794, windowWidth: 794,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      const pageHeight = pdf.internal.pageSize.getHeight();

      if (pdfHeight <= pageHeight) {
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      } else {
        let yPos = 0;
        let remaining = pdfHeight;
        while (remaining > 0) {
          if (yPos > 0) pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, -yPos, pdfWidth, pdfHeight);
          yPos += pageHeight;
          remaining -= pageHeight;
        }
      }

      const docNumber = printData.estimate?.number || printData.invoice?.number || printData.payment?.number || 'document';
      pdf.save(`${docNumber}.pdf`);
      root.unmount();
      document.body.removeChild(container);
      toast({ title: "PDF downloaded!" });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({ title: "Download failed", description: String(error), variant: "destructive" });
    }
  };
  
  // Filter pipelines based on user role - wedding planners only see their own pipeline
  const filteredPipelines = useMemo(() => {
    if (isSuperAdmin) {
      return pipelines; // Superadmin/admin sees all pipelines
    }
    if (isWeddingPlanner && user?.name) {
      // Wedding planner sees only their pipeline (matching their first name)
      const firstName = user.name.split(' ')[0].toLowerCase();
      return pipelines.filter(p => 
        p.name.toLowerCase().includes(firstName)
      );
    }
    return pipelines;
  }, [pipelines, isSuperAdmin, isWeddingPlanner, user?.name]);

  const filteredContacts = useMemo(() => {
    if (isSuperAdmin) {
      return contacts;
    }
    if (isWeddingPlanner && user?.id) {
      const contactIdsFromDeals = new Set(filteredDeals.map(d => d.contactId).filter(Boolean));
      return contacts.filter(c => c.ownerId === user.id || contactIdsFromDeals.has(c.id));
    }
    if (user?.id) {
      return contacts.filter(c => c.ownerId === user.id);
    }
    return contacts;
  }, [contacts, isSuperAdmin, isWeddingPlanner, user?.id, filteredDeals]);

  useEffect(() => {
    // Reset selectedPipelineId if it's not in the filtered list or if no selection exists
    const isCurrentSelectionValid = selectedPipelineId && 
      filteredPipelines.some(p => p.id === selectedPipelineId);
    
    if (filteredPipelines.length > 0 && !isCurrentSelectionValid) {
      persistPipelineId(filteredPipelines[0].id);
    } else if (filteredPipelines.length === 0) {
      setSelectedPipelineId(null);
      localStorage.removeItem('oak_sales_selected_pipeline');
    }
  }, [filteredPipelines, selectedPipelineId]);

  const sidebarItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'portal-leads', label: 'Portal Leads', icon: Users },
    { id: 'pipeline', label: 'Leads Pipeline', icon: Target },
    { id: 'contacts', label: 'Leads', icon: Users },
    { id: 'estimates', label: 'Estimates', icon: FileText },
    { id: 'vendor-costs', label: 'Vendor Costs', icon: Receipt },
    { id: 'pipeline-setup', label: 'Pipeline Setup', icon: Workflow },
    { id: 'automations', label: 'Automations', icon: Settings },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const SidebarContent = ({ onNavClick }: { onNavClick?: () => void }) => (
    <>
      <div className="p-4 border-b">
        <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-3">
          <LayoutDashboard className="w-4 h-4" />
          <span className="text-sm font-medium">Dashboard</span>
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
            <Target className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-semibold text-sm">Oak Sales</h1>
            <p className="text-xs text-muted-foreground">CRM</p>
          </div>
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        <nav className="p-2 space-y-0.5">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveSection(item.id as Section);
                onNavClick?.();
              }}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors ${
                activeSection === item.id
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
              data-testid={`nav-${item.id}`}
            >
              <item.icon className={`w-4 h-4 shrink-0 ${activeSection === item.id ? 'text-primary' : ''}`} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </ScrollArea>
    </>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar - Zoho Bigin style */}
      {!isMobile && (
        <aside className={`${sidebarCollapsed ? 'w-16' : 'w-56'} bg-white border-r border-border transition-all duration-200 flex flex-col`}>
          <div className="p-3 border-b border-border">
            <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-2">
              <LayoutDashboard className="w-4 h-4" />
              {!sidebarCollapsed && <span className="text-xs font-medium">Dashboard</span>}
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
                <Target className="w-4 h-4 text-primary-foreground" />
              </div>
              {!sidebarCollapsed && (
                <div>
                  <h1 className="font-semibold text-sm">Oak Sales</h1>
                  <p className="text-xs text-muted-foreground">CRM</p>
                </div>
              )}
            </div>
          </div>
          
          <ScrollArea className="flex-1">
            <nav className="p-2 space-y-0.5">
              {sidebarItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id as Section)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors ${
                    activeSection === item.id
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                  data-testid={`nav-${item.id}`}
                >
                  <item.icon className={`w-4 h-4 shrink-0 ${activeSection === item.id ? 'text-primary' : ''}`} />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </button>
              ))}
            </nav>
          </ScrollArea>

          <div className="p-2 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSidebarManuallyToggled(true);
                setSidebarCollapsed(!sidebarCollapsed);
              }}
              className="w-full justify-center h-8"
            >
              <ChevronRight className={`w-4 h-4 transition-transform ${sidebarCollapsed ? '' : 'rotate-180'}`} />
            </Button>
          </div>
        </aside>
      )}

      {/* Main Content */}
      <main className={cn("flex-1 min-h-0", (activeSection === 'estimates' || activeSection === 'pipeline') ? "overflow-hidden" : "overflow-auto")}>
        {/* Mobile Header */}
        {isMobile && (
          <div className="sticky top-0 z-40 bg-card border-b p-3 flex items-center gap-3">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="button-mobile-menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0 flex flex-col">
                <SidebarContent onNavClick={() => setMobileMenuOpen(false)} />
              </SheetContent>
            </Sheet>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
                <Target className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold">Oak Sales</span>
            </div>
          </div>
        )}
        {/* Pipeline section uses full height, others use padding */}
        {activeSection === 'pipeline' ? (
          <div className="h-full flex flex-col">
            <PipelineSection
              pipelines={filteredPipelines}
              stages={stages}
              deals={filteredDeals}
              contacts={contacts}
              companies={companies}
              selectedPipelineId={selectedPipelineId}
              setSelectedPipelineId={persistPipelineId}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              isSuperAdmin={isSuperAdmin}
              autoOpenNewDeal={autoOpenNewDeal}
              onAutoOpenNewDealHandled={() => setAutoOpenNewDeal(false)}
              weddingPlanners={weddingPlanners}
              estimateValuesMap={estimateValuesMap}
            />
          </div>
        ) : (
          <div className="p-4 sm:p-6">
            {activeSection === 'dashboard' && (
              <DashboardSection
                deals={filteredDeals}
                contacts={contacts}
                companies={companies}
                activities={activities}
                stages={stages}
                targets={targets}
                users={users}
                weddingPlanners={weddingPlanners}
                isSuperAdmin={isSuperAdmin}
                currentUser={user}
                estimateValuesMap={estimateValuesMap}
                onNewDeal={() => {
                  setAutoOpenNewDeal(true);
                  setActiveSection('pipeline');
                }}
              />
            )}
            {activeSection === 'contacts' && (
              <LeadsSection
                deals={filteredDeals}
                contacts={contacts}
                companies={companies}
                users={users}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                isSuperAdmin={isSuperAdmin}
                currentUser={user}
              />
            )}
            {activeSection === 'pipeline-setup' && (
              <PipelineSetupSection
                pipelines={filteredPipelines}
                stages={stages}
              />
            )}
            {activeSection === 'automations' && (
              <AutomationsSection automations={automations} />
            )}
            {activeSection === 'reports' && (
              <ReportsSection
                deals={filteredDeals}
                stages={stages}
                contacts={contacts}
                activities={activities}
              />
            )}
            {activeSection === 'settings' && (
              <SettingsSection
                targets={targets}
                weddingPlanners={weddingPlanners}
                isSuperAdmin={isSuperAdmin}
              />
            )}
            {activeSection === 'estimates' && (
              <div className="h-full flex flex-col">
                <Tabs defaultValue="oakstreet" className="w-full flex-shrink-0">
                  <TabsList className="mx-4 mt-2">
                    <TabsTrigger value="oakstreet">Oak</TabsTrigger>
                    <TabsTrigger value="meta_events">Meta</TabsTrigger>
                    <TabsTrigger value="yepman">Yep</TabsTrigger>
                  </TabsList>
                  <TabsContent value="oakstreet" className="mt-0 h-[calc(100vh-110px)]">
                    <ZohoQuotes filterType="oakstreet" onDownloadPdf={handleDownloadPdf} />
                  </TabsContent>
                  <TabsContent value="meta_events" className="mt-0 h-[calc(100vh-110px)]">
                    <ZohoQuotes filterType="meta_events" onDownloadPdf={handleDownloadPdf} />
                  </TabsContent>
                  <TabsContent value="yepman" className="mt-0 h-[calc(100vh-110px)]">
                    <ZohoQuotes filterType="yepman" onDownloadPdf={handleDownloadPdf} />
                  </TabsContent>
                </Tabs>
              </div>
            )}
            {activeSection === 'portal-leads' && (
              <PortalLeadsSection isSuperAdmin={isSuperAdmin} currentUser={user} />
            )}
            {activeSection === 'vendor-costs' && (
              <VendorCostsSection isSuperAdmin={isSuperAdmin} currentUser={user} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// Portal Leads Section for Phase 2
function PortalLeadsSection({ isSuperAdmin, currentUser }: { isSuperAdmin: boolean; currentUser: User | null }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isLoading: authLoading } = useAuth();
  const isWeddingPlanner = currentUser?.role === 'wedding_planner';
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedLeadForShare, setSelectedLeadForShare] = useState<any>(null);
  const [selectedEstimateId, setSelectedEstimateId] = useState<string>('');
  const [estimateUrl, setEstimateUrl] = useState<string>('');
  const [uploadingEstimate, setUploadingEstimate] = useState(false);
  const [uploadedEstimateName, setUploadedEstimateName] = useState<string>('');
  const [selectedPresentationId, setSelectedPresentationId] = useState<string>('');
  const [presentationUrl, setPresentationUrl] = useState<string>('');
  const [contractUrl, setContractUrl] = useState<string>('');
  const [uploadingPresentation, setUploadingPresentation] = useState(false);
  const [uploadingContract, setUploadingContract] = useState(false);
  const [uploadedPresentationName, setUploadedPresentationName] = useState<string>('');
  const [estimateComboOpen, setEstimateComboOpen] = useState(false);
  const [presentationComboOpen, setPresentationComboOpen] = useState(false);
  const [uploadedContractName, setUploadedContractName] = useState<string>('');
  const [estimateObjectPath, setEstimateObjectPath] = useState<string>('');
  const [presentationObjectPath, setPresentationObjectPath] = useState<string>('');
  const [timelineDialogOpen, setTimelineDialogOpen] = useState(false);
  const [selectedLeadForTimeline, setSelectedLeadForTimeline] = useState<any>(null);
  const [timelineItems, setTimelineItems] = useState<{ phase: number; phaseName: string; title: string; description: string; date: string; status: string }[]>([
    { phase: 1, phaseName: 'Initial', title: 'Enquiry Received', description: 'Your enquiry has been received', date: '', status: 'completed' },
    { phase: 2, phaseName: 'Planning', title: 'Proposal Sent', description: 'Design proposal and estimate shared', date: '', status: 'upcoming' },
    { phase: 3, phaseName: 'Booking', title: 'Booking Confirmed', description: 'Contract signed and advance received', date: '', status: 'upcoming' },
    { phase: 4, phaseName: 'Preparation', title: 'Vendor Coordination', description: 'All vendors confirmed and timeline finalized', date: '', status: 'upcoming' },
    { phase: 5, phaseName: 'Rehearsal', title: 'Final Walkthrough', description: 'Venue walkthrough and final checks', date: '', status: 'upcoming' },
    { phase: 6, phaseName: 'Event Day', title: 'Your Special Day', description: 'The celebration begins!', date: '', status: 'upcoming' },
    { phase: 7, phaseName: 'Memories', title: 'Post-Event', description: 'Photos delivery and feedback', date: '', status: 'upcoming' },
  ]);
  
  // Milestone management state
  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false);
  const [selectedLeadForMilestone, setSelectedLeadForMilestone] = useState<any>(null);
  const [milestoneEventDate, setMilestoneEventDate] = useState<string>('');
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());

  // Event flow management state
  const [eventFlowDialogOpen, setEventFlowDialogOpen] = useState(false);
  const [selectedLeadForEventFlow, setSelectedLeadForEventFlow] = useState<any>(null);
  const [newEventFlow, setNewEventFlow] = useState<{
    eventName: string;
    eventDate: string;
    eventTime: string;
    venue: string;
    venueAddress: string;
    description: string;
  }>({ eventName: '', eventDate: '', eventTime: '', venue: '', venueAddress: '', description: '' });
  const [newFlowItem, setNewFlowItem] = useState<{
    title: string;
    description: string;
    startTime: string;
    endTime: string;
    category: string;
    notes: string;
  }>({ title: '', description: '', startTime: '', endTime: '', category: 'ceremony', notes: '' });
  const [editingEventFlow, setEditingEventFlow] = useState<any>(null);
  const [addingItemToFlow, setAddingItemToFlow] = useState<string | null>(null);
  const [editingFlowItem, setEditingFlowItem] = useState<any>(null);
  const [editFlowItemData, setEditFlowItemData] = useState<{
    title: string;
    description: string;
    startTime: string;
    endTime: string;
    category: string;
    notes: string;
  }>({ title: '', description: '', startTime: '', endTime: '', category: 'ceremony', notes: '' });

  // Financial milestones management state
  const [financialDialogOpen, setFinancialDialogOpen] = useState(false);
  const [selectedLeadForFinancials, setSelectedLeadForFinancials] = useState<any>(null);
  const [financialTotalAmount, setFinancialTotalAmount] = useState<string>('');
  const [financialEventDate, setFinancialEventDate] = useState<string>('');
  const [confirmPaymentDialog, setConfirmPaymentDialog] = useState<{ open: boolean; milestone: any | null }>({ open: false, milestone: null });
  const [paymentDetails, setPaymentDetails] = useState<{ paidAmount: string; paymentMethod: string; paymentReference: string; notes: string; paidDate: string }>({ paidAmount: '', paymentMethod: 'bank_transfer', paymentReference: '', notes: '', paidDate: format(new Date(), 'yyyy-MM-dd') });
  const [isEditingPayment, setIsEditingPayment] = useState(false);

  // Portal lead edit/delete state (superadmin only)
  const [editLeadDialog, setEditLeadDialog] = useState<{ open: boolean; lead: any | null }>({ open: false, lead: null });
  const [editLeadData, setEditLeadData] = useState<{ name: string; email: string; phone: string; eventType: string; eventDate: string; venue: string; guestCount: string; notes: string; assignedPlannerId: string }>({ name: '', email: '', phone: '', eventType: '', eventDate: '', venue: '', guestCount: '', notes: '', assignedPlannerId: '' });
  const [deleteLeadDialog, setDeleteLeadDialog] = useState<{ open: boolean; lead: any | null }>({ open: false, lead: null });
  const [clientInputsDialog, setClientInputsDialog] = useState<{ open: boolean; lead: any | null }>({ open: false, lead: null });
  const [leadDetailDialog, setLeadDetailDialog] = useState<{ open: boolean; lead: any | null }>({ open: false, lead: null });
  const [contactsDialog, setContactsDialog] = useState<{ open: boolean; lead: any | null }>({ open: false, lead: null });
  const [newContact, setNewContact] = useState({ name: '', phone: '', email: '', relation: '' });
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editContactData, setEditContactData] = useState({ name: '', phone: '', email: '', relation: '' });
  
  // Date filter state
  const [dateFilterFrom, setDateFilterFrom] = useState('');
  const [dateFilterTo, setDateFilterTo] = useState('');
  const [searchLeadQuery, setSearchLeadQuery] = useState('');
  const [leadStatusFilter, setLeadStatusFilter] = useState<'all' | 'prospective' | 'confirmed'>('all');

  // Add client manually state
  const [addClientDialog, setAddClientDialog] = useState(false);
  const [addClientData, setAddClientData] = useState<{ name: string; email: string; phone: string; eventType: string; eventDate: string; venue: string; guestCount: string; notes: string; assignedPlannerId: string }>({ name: '', email: '', phone: '', eventType: '', eventDate: '', venue: '', guestCount: '', notes: '', assignedPlannerId: '' });
  const [newClientPortalUrl, setNewClientPortalUrl] = useState<string | null>(null);

  // Convert to Customer state
  const [convertDialog, setConvertDialog] = useState<{ open: boolean; lead: any | null }>({ open: false, lead: null });
  const [convertData, setConvertData] = useState<{
    name: string; phone: string; email: string; billingAddress: string; state: string; country: string; gstNumber: string;
    weddingPlannerId: string; createEvent: boolean; eventTitle: string; eventVenue: string;
  }>({ name: '', phone: '', email: '', billingAddress: '', state: '', country: 'India', gstNumber: '', weddingPlannerId: '', createEvent: true, eventTitle: '', eventVenue: '' });

  const { data: portalLeadsData = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/admin/portal-leads'],
  });

  const { data: weddingPlanners = [], isLoading: plannersLoading, error: plannersError, refetch: refetchPlanners } = useQuery<{ id: string; name: string; email: string }[]>({
    queryKey: ['/api/admin/wedding-planners'],
    queryFn: async () => {
      const res = await fetch('/api/admin/wedding-planners', { credentials: 'include' });
      if (res.status === 401) {
        // Session not ready yet, return empty - will retry on next mount
        console.log('[WeddingPlanners] 401 - session not ready');
        return [];
      }
      if (!res.ok) {
        throw new Error('Failed to fetch wedding planners');
      }
      return res.json();
    },
    enabled: !authLoading && isSuperAdmin && !!currentUser,
    staleTime: 10000, // Shorter stale time to refetch more often
    retry: 1,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const { data: availableDocs } = useQuery<{
    estimates: { id: string; estimateNumber: string; title: string; customerName: string; total: string; date: string }[];
    presentations: { id: string; title: string; createdAt: string }[];
    currentSharedEstimateId: string | null;
    currentSharedPresentationId: string | null;
    currentContractUrl: string | null;
  }>({
    queryKey: ['/api/admin/portal-leads', selectedLeadForShare?.id, 'available-documents'],
    queryFn: async () => {
      if (!selectedLeadForShare?.id) return { estimates: [], presentations: [], currentSharedEstimateId: null, currentSharedPresentationId: null, currentContractUrl: null };
      const res = await fetch(`/api/admin/portal-leads/${selectedLeadForShare.id}/available-documents`, { credentials: 'include' });
      return res.json();
    },
    enabled: !!selectedLeadForShare?.id,
  });

  const assignPlannerMutation = useMutation({
    mutationFn: async ({ leadId, plannerId }: { leadId: string; plannerId: string }) => {
      return apiRequest('POST', `/api/admin/portal-leads/${leadId}/assign`, { plannerId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/portal-leads'] });
      toast({ title: 'Wedding planner assigned', description: 'Customer has been notified via WhatsApp' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to assign planner', description: error.message, variant: 'destructive' });
    }
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ leadId, phase }: { leadId: string; phase: string }) => {
      return apiRequest('PUT', `/api/admin/portal-leads/${leadId}/stage`, { phase });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/portal-leads'] });
      toast({ title: 'Stage updated' });
    }
  });

  const toggleRsvpMutation = useMutation({
    mutationFn: async ({ leadId, enabled }: { leadId: string; enabled: boolean }) => {
      return apiRequest('PUT', `/api/admin/portal-leads/${leadId}/rsvp-toggle`, { enabled });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/portal-leads'] });
      toast({ title: variables.enabled ? 'RSVP service enabled' : 'RSVP service disabled', description: variables.enabled ? 'Client can now see RSVP tab in their portal' : 'RSVP tab hidden from client portal' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to update RSVP service', description: error.message, variant: 'destructive' });
    }
  });

  // Edit portal lead mutation (superadmin only)
  const editLeadMutation = useMutation({
    mutationFn: async ({ leadId, data }: { leadId: string; data: any }) => {
      return apiRequest('PUT', `/api/admin/portal-leads/${leadId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/portal-leads'] });
      setEditLeadDialog({ open: false, lead: null });
      toast({ title: 'Lead updated successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to update lead', description: error.message, variant: 'destructive' });
    }
  });

  // Convert portal lead to customer mutation
  const convertToCustomerMutation = useMutation({
    mutationFn: async ({ leadId, data }: { leadId: string; data: any }) => {
      return apiRequest('POST', `/api/admin/portal-leads/${leadId}/convert-to-customer`, data);
    },
    onSuccess: async (response: any) => {
      const result = await response.json();
      queryClient.invalidateQueries({ queryKey: ['/api/admin/portal-leads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      setConvertDialog({ open: false, lead: null });
      toast({
        title: 'Lead converted to customer',
        description: `Customer code: ${result.customerCode}${result.event ? ' | Event created' : ''}`,
      });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to convert lead', description: error.message, variant: 'destructive' });
    }
  });

  // Delete portal lead mutation (superadmin only)
  const deleteLeadMutation = useMutation({
    mutationFn: async (leadId: string) => {
      return apiRequest('DELETE', `/api/admin/portal-leads/${leadId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/portal-leads'] });
      setDeleteLeadDialog({ open: false, lead: null });
      toast({ title: 'Lead deleted successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to delete lead', description: error.message, variant: 'destructive' });
    }
  });

  const { data: leadContacts = [], refetch: refetchContacts } = useQuery({
    queryKey: ['/api/portal-leads', contactsDialog.lead?.id, 'contacts'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/portal-leads/${contactsDialog.lead?.id}/contacts`);
      return await res.json();
    },
    enabled: !!contactsDialog.lead?.id && contactsDialog.open,
  });

  const addContactMutation = useMutation({
    mutationFn: async ({ leadId, data }: { leadId: string; data: any }) => {
      const res = await apiRequest('POST', `/api/portal-leads/${leadId}/contacts`, data);
      return await res.json();
    },
    onSuccess: () => {
      refetchContacts();
      setNewContact({ name: '', phone: '', email: '', relation: '' });
      toast({ title: 'Contact added successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to add contact', description: error.message, variant: 'destructive' });
    }
  });

  const updateContactMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest('PATCH', `/api/portal-lead-contacts/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      refetchContacts();
      setEditingContactId(null);
      toast({ title: 'Contact updated' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to update contact', description: error.message, variant: 'destructive' });
    }
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/portal-lead-contacts/${id}`);
    },
    onSuccess: () => {
      refetchContacts();
      toast({ title: 'Contact removed' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to remove contact', description: error.message, variant: 'destructive' });
    }
  });

  const createClientMutation = useMutation({
    mutationFn: async (data: typeof addClientData) => {
      const res = await apiRequest('POST', '/api/admin/portal-leads', data);
      return await res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/portal-leads'] });
      setNewClientPortalUrl(window.location.origin + data.portalUrl);
      toast({ title: 'Client created successfully', description: 'Portal access link is ready to share' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to create client', description: error.message, variant: 'destructive' });
    }
  });

  const shareDocsMutation = useMutation({
    mutationFn: async ({ leadId, estimateId, estimateUrl, estimateObjectPath, presentationId, presentationUrl, presentationObjectPath, contractUrl }: { 
      leadId: string; 
      estimateId?: string;
      estimateUrl?: string;
      estimateObjectPath?: string;
      presentationId?: string; 
      presentationUrl?: string;
      presentationObjectPath?: string;
      contractUrl?: string;
    }) => {
      return apiRequest('POST', `/api/admin/portal-leads/${leadId}/share-documents`, { 
        estimateId: estimateId || undefined,
        estimateUrl: estimateUrl || undefined,
        estimateObjectPath: estimateObjectPath || undefined,
        presentationId: presentationId || undefined, 
        presentationUrl: presentationUrl || undefined,
        presentationObjectPath: presentationObjectPath || undefined,
        contractUrl: contractUrl || undefined 
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/portal-leads'] });
      setShareDialogOpen(false);
      setSelectedLeadForShare(null);
      setSelectedEstimateId('');
      setEstimateUrl('');
      setUploadedEstimateName('');
      setEstimateObjectPath('');
      setSelectedPresentationId('');
      setPresentationUrl('');
      setUploadedPresentationName('');
      setPresentationObjectPath('');
      setContractUrl('');
      setUploadedContractName('');
      toast({ 
        title: 'Documents shared!', 
        description: `Portal link: ${window.location.origin}${data.portalUrl}` 
      });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to share documents', description: error.message, variant: 'destructive' });
    }
  });

  const pushTimelineMutation = useMutation({
    mutationFn: async ({ leadId, timeline }: { leadId: string; timeline: any[] }) => {
      return apiRequest('POST', `/api/admin/portal-timeline/${leadId}`, { timeline });
    },
    onSuccess: () => {
      setTimelineDialogOpen(false);
      setSelectedLeadForTimeline(null);
      toast({ 
        title: 'Timeline pushed!', 
        description: 'Client can now view their event timeline in the portal' 
      });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to push timeline', description: error.message, variant: 'destructive' });
    }
  });

  const openTimelineDialog = (lead: any) => {
    setSelectedLeadForTimeline(lead);
    setTimelineDialogOpen(true);
  };

  const handlePushTimeline = () => {
    if (!selectedLeadForTimeline) return;
    pushTimelineMutation.mutate({
      leadId: selectedLeadForTimeline.id,
      timeline: timelineItems.map((item, idx) => ({ ...item, sortOrder: idx }))
    });
  };

  const updateTimelineItem = (index: number, field: string, value: string) => {
    const newItems = [...timelineItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setTimelineItems(newItems);
  };

  const openShareDialog = (lead: any) => {
    setSelectedLeadForShare(lead);
    setSelectedEstimateId(lead.sharedEstimateId || '');
    setSelectedPresentationId(lead.sharedPresentationId || '');
    setPresentationUrl(lead.sharedPresentationUrl || '');
    setContractUrl(lead.sharedContractUrl || '');
    setUploadedPresentationName('');
    setUploadedContractName('');
    setShareDialogOpen(true);
  };

  // Milestone management queries and mutations
  const { data: milestonesData, refetch: refetchMilestones } = useQuery({
    queryKey: ['/api/admin/milestones', selectedLeadForMilestone?.id],
    queryFn: async () => {
      if (!selectedLeadForMilestone?.id) return null;
      const res = await fetch(`/api/admin/milestones/${selectedLeadForMilestone.id}`, { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!selectedLeadForMilestone?.id && milestoneDialogOpen
  });

  const initializeMilestonesMutation = useMutation({
    mutationFn: async ({ leadId, eventDate }: { leadId: string; eventDate: string }) => {
      return apiRequest('POST', `/api/admin/milestones/${leadId}/initialize`, { eventDate });
    },
    onSuccess: () => {
      refetchMilestones();
      queryClient.invalidateQueries({ queryKey: ['/api/admin/portal-leads'] });
      toast({ title: 'Milestones initialized!', description: 'Project timeline has been created' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to initialize milestones', description: error.message, variant: 'destructive' });
    }
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: string; updates: any }) => {
      return apiRequest('PATCH', `/api/admin/milestones/tasks/${taskId}`, updates);
    },
    onSuccess: () => {
      refetchMilestones();
    },
    onError: (error: any) => {
      toast({ title: 'Failed to update task', description: error.message, variant: 'destructive' });
    }
  });

  const updatePhaseMutation = useMutation({
    mutationFn: async ({ phaseId, updates }: { phaseId: string; updates: any }) => {
      return apiRequest('PATCH', `/api/admin/milestones/phases/${phaseId}`, updates);
    },
    onSuccess: () => {
      refetchMilestones();
    },
    onError: (error: any) => {
      toast({ title: 'Failed to update phase', description: error.message, variant: 'destructive' });
    }
  });

  const addTaskMutation = useMutation({
    mutationFn: async ({ phaseId, taskName }: { phaseId: string; taskName: string }) => {
      return apiRequest('POST', `/api/admin/milestones/phases/${phaseId}/tasks`, { taskName });
    },
    onSuccess: () => {
      refetchMilestones();
      toast({ title: 'Task added' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to add task', description: error.message, variant: 'destructive' });
    }
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return apiRequest('DELETE', `/api/admin/milestones/tasks/${taskId}`);
    },
    onSuccess: () => {
      refetchMilestones();
    },
    onError: (error: any) => {
      toast({ title: 'Failed to delete task', description: error.message, variant: 'destructive' });
    }
  });

  // Event Flow management queries and mutations
  const { data: eventFlowsData, refetch: refetchEventFlows } = useQuery<{ eventFlows: any[] }>({
    queryKey: ['/api/admin/event-flows', selectedLeadForEventFlow?.id],
    queryFn: async () => {
      if (!selectedLeadForEventFlow?.id) return { eventFlows: [] };
      const res = await fetch(`/api/admin/event-flows/${selectedLeadForEventFlow.id}`, { credentials: 'include' });
      if (!res.ok) return { eventFlows: [] };
      return res.json();
    },
    enabled: !!selectedLeadForEventFlow?.id && eventFlowDialogOpen
  });

  const createEventFlowMutation = useMutation({
    mutationFn: async ({ leadId, data }: { leadId: string; data: typeof newEventFlow }) => {
      return apiRequest('POST', `/api/admin/event-flows/${leadId}`, data);
    },
    onSuccess: () => {
      refetchEventFlows();
      setNewEventFlow({ eventName: '', eventDate: '', eventTime: '', venue: '', venueAddress: '', description: '' });
      toast({ title: 'Event flow created!' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to create event flow', description: error.message, variant: 'destructive' });
    }
  });

  const updateEventFlowMutation = useMutation({
    mutationFn: async ({ flowId, data }: { flowId: string; data: Partial<typeof newEventFlow> }) => {
      return apiRequest('PATCH', `/api/admin/event-flows/${flowId}`, data);
    },
    onSuccess: () => {
      refetchEventFlows();
      setEditingEventFlow(null);
      toast({ title: 'Event flow updated!' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to update event flow', description: error.message, variant: 'destructive' });
    }
  });

  const publishEventFlowMutation = useMutation({
    mutationFn: async ({ flowId, isPublished }: { flowId: string; isPublished: boolean }) => {
      return apiRequest('PATCH', `/api/admin/event-flows/${flowId}/publish`, { isPublished });
    },
    onSuccess: () => {
      refetchEventFlows();
      toast({ title: 'Event flow visibility updated!' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to update visibility', description: error.message, variant: 'destructive' });
    }
  });

  const deleteEventFlowMutation = useMutation({
    mutationFn: async (flowId: string) => {
      return apiRequest('DELETE', `/api/admin/event-flows/${flowId}`);
    },
    onSuccess: () => {
      refetchEventFlows();
      toast({ title: 'Event flow deleted!' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to delete event flow', description: error.message, variant: 'destructive' });
    }
  });

  const addFlowItemMutation = useMutation({
    mutationFn: async ({ flowId, data }: { flowId: string; data: typeof newFlowItem }) => {
      return apiRequest('POST', `/api/admin/event-flows/${flowId}/items`, data);
    },
    onSuccess: () => {
      refetchEventFlows();
      setNewFlowItem({ title: '', description: '', startTime: '', endTime: '', category: 'ceremony', notes: '' });
      setAddingItemToFlow(null);
      toast({ title: 'Timeline item added!' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to add item', description: error.message, variant: 'destructive' });
    }
  });

  const deleteFlowItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      return apiRequest('DELETE', `/api/admin/event-flow-items/${itemId}`);
    },
    onSuccess: () => {
      refetchEventFlows();
      toast({ title: 'Item deleted!' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to delete item', description: error.message, variant: 'destructive' });
    }
  });

  const updateFlowItemMutation = useMutation({
    mutationFn: async ({ itemId, data }: { itemId: string; data: typeof editFlowItemData }) => {
      return apiRequest('PATCH', `/api/admin/event-flow-items/${itemId}`, data);
    },
    onSuccess: () => {
      refetchEventFlows();
      setEditingFlowItem(null);
      toast({ title: 'Item updated!' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to update item', description: error.message, variant: 'destructive' });
    }
  });

  const loadDefaultTemplateMutation = useMutation({
    mutationFn: async (flowId: string) => {
      return apiRequest('POST', `/api/admin/event-flows/${flowId}/load-template`);
    },
    onSuccess: () => {
      refetchEventFlows();
      toast({ title: 'Default template loaded!' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to load template', description: error.message, variant: 'destructive' });
    }
  });

  // Financial milestones management queries and mutations
  const { data: financialMilestonesAdminData, refetch: refetchFinancialMilestones } = useQuery<{
    milestones: any[];
    summary: { totalAmount: number; paidAmount: number; pendingAmount: number; totalMilestones: number; completedMilestones: number };
  }>({
    queryKey: ['/api/admin/financial-milestones', selectedLeadForFinancials?.id],
    queryFn: async () => {
      if (!selectedLeadForFinancials?.id) return { milestones: [], summary: { totalAmount: 0, paidAmount: 0, pendingAmount: 0, totalMilestones: 0, completedMilestones: 0 } };
      const res = await fetch(`/api/admin/financial-milestones/${selectedLeadForFinancials.id}`, { credentials: 'include' });
      if (!res.ok) return { milestones: [], summary: { totalAmount: 0, paidAmount: 0, pendingAmount: 0, totalMilestones: 0, completedMilestones: 0 } };
      return res.json();
    },
    enabled: !!selectedLeadForFinancials?.id && financialDialogOpen
  });

  // Pre-fill total amount from existing milestones
  React.useEffect(() => {
    if (financialMilestonesAdminData?.summary?.totalAmount && financialMilestonesAdminData.summary.totalAmount > 0) {
      setFinancialTotalAmount(financialMilestonesAdminData.summary.totalAmount.toString());
    } else {
      setFinancialTotalAmount('');
    }
  }, [financialMilestonesAdminData?.summary?.totalAmount]);

  // Client creative inputs query
  const { data: clientInputsData = [], refetch: refetchClientInputs, isLoading: clientInputsLoading } = useQuery<any[]>({
    queryKey: ['/api/admin/client-inputs', clientInputsDialog.lead?.id],
    queryFn: async () => {
      if (!clientInputsDialog.lead?.id) return [];
      const res = await fetch(`/api/admin/client-inputs/${clientInputsDialog.lead.id}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!clientInputsDialog.lead?.id && clientInputsDialog.open
  });

  const initializeFinancialMilestonesMutation = useMutation({
    mutationFn: async ({ leadId, totalAmount, eventDate }: { leadId: string; totalAmount: string; eventDate: string }) => {
      return apiRequest('POST', `/api/admin/financial-milestones/${leadId}/initialize`, { totalAmount, eventDate });
    },
    onSuccess: () => {
      refetchFinancialMilestones();
      toast({ title: 'Payment milestones initialized!', description: '15%-40%-40%-5% structure applied' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to initialize milestones', description: error.message, variant: 'destructive' });
    }
  });

  const confirmPaymentMutation = useMutation({
    mutationFn: async ({ milestoneId, data, isEditMode }: { milestoneId: string; data: typeof paymentDetails; isEditMode?: boolean }) => {
      return apiRequest('PATCH', `/api/admin/financial-milestones/${milestoneId}/confirm-payment`, { ...data, isEditMode: !!isEditMode });
    },
    onSuccess: () => {
      refetchFinancialMilestones();
      setConfirmPaymentDialog({ open: false, milestone: null });
      setPaymentDetails({ paidAmount: '', paymentMethod: 'bank_transfer', paymentReference: '', notes: '', paidDate: format(new Date(), 'yyyy-MM-dd') });
      setIsEditingPayment(false);
      toast({ title: 'Payment confirmed!' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to confirm payment', description: error.message, variant: 'destructive' });
    }
  });

  // Edit milestone state
  const [editMilestoneDialog, setEditMilestoneDialog] = useState<{ open: boolean; milestone: any | null }>({ open: false, milestone: null });
  const [editMilestoneData, setEditMilestoneData] = useState<{ milestoneName: string; percentage: string; amount: string; dueDate: string; dueDescription: string }>({ milestoneName: '', percentage: '', amount: '', dueDate: '', dueDescription: '' });

  const editMilestoneMutation = useMutation({
    mutationFn: async ({ milestoneId, data }: { milestoneId: string; data: typeof editMilestoneData }) => {
      return apiRequest('PATCH', `/api/admin/financial-milestones/${milestoneId}`, { ...data, adjustRemaining: true });
    },
    onSuccess: () => {
      refetchFinancialMilestones();
      setEditMilestoneDialog({ open: false, milestone: null });
      toast({ title: 'Milestone updated!' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to update milestone', description: error.message, variant: 'destructive' });
    }
  });

  const openEditMilestoneDialog = (milestone: any) => {
    const cleanAmount = String(milestone.amount || '').replace(/,/g, '');
    const cleanPercentage = String(milestone.percentage || '').replace(/,/g, '');
    setEditMilestoneData({
      milestoneName: milestone.milestoneName || '',
      percentage: cleanPercentage,
      amount: cleanAmount,
      dueDate: milestone.dueDate || '',
      dueDescription: milestone.dueDescription || ''
    });
    setEditMilestoneDialog({ open: true, milestone });
  };

  const openEventFlowDialog = (lead: any) => {
    setSelectedLeadForEventFlow(lead);
    setEventFlowDialogOpen(true);
  };

  const openFinancialDialog = (lead: any) => {
    setSelectedLeadForFinancials(lead);
    setFinancialEventDate(lead.eventDate || '');
    setFinancialDialogOpen(true);
  };

  const openMilestoneDialog = (lead: any) => {
    setSelectedLeadForMilestone(lead);
    setMilestoneEventDate(lead.eventDate || '');
    setExpandedPhases(new Set());
    setMilestoneDialogOpen(true);
  };

  const togglePhaseExpanded = (phaseId: string) => {
    const newSet = new Set(expandedPhases);
    if (newSet.has(phaseId)) {
      newSet.delete(phaseId);
    } else {
      newSet.add(phaseId);
    }
    setExpandedPhases(newSet);
  };

  const getPhaseStatus = (phase: any) => {
    if (!phase.tasks || phase.tasks.length === 0) return 'upcoming';
    const completed = phase.tasks.filter((t: any) => t.isCompleted).length;
    if (completed === phase.tasks.length) return 'completed';
    if (completed > 0) return 'in_progress';
    if (phase.tasks.some((t: any) => t.status === 'action_required')) return 'action_required';
    return 'upcoming';
  };

  const getDateFromEventDate = (eventDate: string, daysOffset: number) => {
    if (!eventDate) return '';
    const date = new Date(eventDate);
    date.setDate(date.getDate() + daysOffset);
    return format(date, 'MMM d, yyyy');
  };

  const handleDocumentUpload = async (file: File, type: 'presentation' | 'contract' | 'estimate') => {
    const setUploading = type === 'presentation' ? setUploadingPresentation : type === 'contract' ? setUploadingContract : setUploadingEstimate;
    const setUrl = type === 'presentation' ? setPresentationUrl : type === 'contract' ? setContractUrl : setEstimateUrl;
    const setName = type === 'presentation' ? setUploadedPresentationName : type === 'contract' ? setUploadedContractName : setUploadedEstimateName;
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('document', file);
      
      const response = await fetch('/api/portal/documents/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }
      
      const result = await response.json();
      setUrl(result.url);
      setName(file.name);
      if (type === 'presentation') {
        setSelectedPresentationId('');
        if (result.objectPath) setPresentationObjectPath(result.objectPath);
      }
      if (type === 'estimate') {
        setSelectedEstimateId('');
        if (result.objectPath) setEstimateObjectPath(result.objectPath);
      }
      toast({ title: 'File uploaded successfully' });
    } catch (error: any) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleShareDocuments = () => {
    if (!selectedLeadForShare) return;
    if (!selectedEstimateId && !estimateUrl && !selectedPresentationId && !presentationUrl && !contractUrl) {
      toast({ title: 'Select at least one document', variant: 'destructive' });
      return;
    }
    shareDocsMutation.mutate({
      leadId: selectedLeadForShare.id,
      estimateId: selectedEstimateId || undefined,
      estimateUrl: estimateUrl || undefined,
      estimateObjectPath: estimateObjectPath || undefined,
      presentationId: selectedPresentationId || undefined,
      presentationUrl: presentationUrl || undefined,
      presentationObjectPath: presentationObjectPath || undefined,
      contractUrl: contractUrl || undefined,
    });
  };

  const phaseLabels: Record<string, { label: string; color: string }> = {
    'submitted': { label: 'New Lead', color: 'bg-blue-100 text-blue-800' },
    'assigned': { label: 'Assigned', color: 'bg-yellow-100 text-yellow-800' },
    'contacted': { label: 'Contacted', color: 'bg-purple-100 text-purple-800' },
    'documents_shared': { label: 'Documents Shared', color: 'bg-orange-100 text-orange-800' },
    'confirmed': { label: 'Confirmed', color: 'bg-green-100 text-green-800' },
    'active': { label: 'Active', color: 'bg-emerald-100 text-emerald-800' }
  };

  const confirmedPhases = ['confirmed', 'active'];
  
  const leadCounts = useMemo(() => {
    const all = portalLeadsData.length;
    const confirmed = portalLeadsData.filter((l: any) => confirmedPhases.includes(l.phase)).length;
    const prospective = all - confirmed;
    return { all, confirmed, prospective };
  }, [portalLeadsData]);

  const displayedLeads = useMemo(() => {
    let filtered = [...portalLeadsData];
    if (leadStatusFilter === 'confirmed') {
      filtered = filtered.filter((lead: any) => confirmedPhases.includes(lead.phase));
    } else if (leadStatusFilter === 'prospective') {
      filtered = filtered.filter((lead: any) => !confirmedPhases.includes(lead.phase));
    }
    if (searchLeadQuery.trim()) {
      const q = searchLeadQuery.toLowerCase();
      filtered = filtered.filter((lead: any) =>
        (lead.name || '').toLowerCase().includes(q) ||
        (lead.phone || '').toLowerCase().includes(q) ||
        (lead.email || '').toLowerCase().includes(q) ||
        (lead.assignedPlannerName || '').toLowerCase().includes(q)
      );
    }
    if (dateFilterFrom) {
      const from = new Date(dateFilterFrom);
      from.setHours(0, 0, 0, 0);
      filtered = filtered.filter((lead: any) => {
        const d = lead.createdAt ? new Date(lead.createdAt) : null;
        return d && d >= from;
      });
    }
    if (dateFilterTo) {
      const to = new Date(dateFilterTo);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter((lead: any) => {
        const d = lead.createdAt ? new Date(lead.createdAt) : null;
        return d && d <= to;
      });
    }
    return filtered;
  }, [portalLeadsData, searchLeadQuery, dateFilterFrom, dateFilterTo, leadStatusFilter]);

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading portal leads...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Portal Leads</h2>
          <p className="text-sm text-muted-foreground">Leads submitted via client portal</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{displayedLeads.length} of {portalLeadsData.length} leads</Badge>
          {(isSuperAdmin || isWeddingPlanner) && (
            <Button 
              size="sm" 
              onClick={() => {
                setAddClientData({ name: '', email: '', phone: '', eventType: '', eventDate: '', venue: '', guestCount: '', notes: '', assignedPlannerId: '' });
                setNewClientPortalUrl(null);
                setAddClientDialog(true);
              }}
              data-testid="button-add-portal-client"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Client
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 border-b pb-1">
        <button
          onClick={() => setLeadStatusFilter('all')}
          className={cn(
            "px-4 py-2 text-sm font-medium rounded-t-md transition-colors",
            leadStatusFilter === 'all' ? "bg-[#4b7c29] text-white" : "text-muted-foreground hover:bg-gray-100"
          )}
          data-testid="filter-all-leads"
        >
          All ({leadCounts.all})
        </button>
        <button
          onClick={() => setLeadStatusFilter('prospective')}
          className={cn(
            "px-4 py-2 text-sm font-medium rounded-t-md transition-colors",
            leadStatusFilter === 'prospective' ? "bg-blue-600 text-white" : "text-muted-foreground hover:bg-gray-100"
          )}
          data-testid="filter-prospective-leads"
        >
          Prospective ({leadCounts.prospective})
        </button>
        <button
          onClick={() => setLeadStatusFilter('confirmed')}
          className={cn(
            "px-4 py-2 text-sm font-medium rounded-t-md transition-colors",
            leadStatusFilter === 'confirmed' ? "bg-green-600 text-white" : "text-muted-foreground hover:bg-gray-100"
          )}
          data-testid="filter-confirmed-leads"
        >
          Confirmed ({leadCounts.confirmed})
        </button>
      </div>

      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, phone, email, or planner..."
                  value={searchLeadQuery}
                  onChange={(e) => setSearchLeadQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-leads"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">From</Label>
                <Input
                  type="date"
                  value={dateFilterFrom}
                  onChange={(e) => setDateFilterFrom(e.target.value)}
                  className="w-[140px] h-9 text-sm"
                  data-testid="input-date-from"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">To</Label>
                <Input
                  type="date"
                  value={dateFilterTo}
                  onChange={(e) => setDateFilterTo(e.target.value)}
                  className="w-[140px] h-9 text-sm"
                  data-testid="input-date-to"
                />
              </div>
              {(dateFilterFrom || dateFilterTo || searchLeadQuery) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setDateFilterFrom(''); setDateFilterTo(''); setSearchLeadQuery(''); }}
                  className="h-9 px-2"
                  data-testid="button-clear-filters"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {displayedLeads.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            {portalLeadsData.length === 0 ? (
              <>
                <p>No portal leads yet</p>
                <p className="text-sm mt-2">Leads from the client portal will appear here</p>
              </>
            ) : (
              <>
                <p>No leads match your filters</p>
                <p className="text-sm mt-2">Try adjusting the date range or search query</p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {displayedLeads.map((lead: any) => (
            <Card 
              key={lead.id} 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setLeadDetailDialog({ open: true, lead })}
              data-testid={`portal-lead-card-${lead.id}`}
            >
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-lg">{lead.name}</h3>
                      <Badge className={phaseLabels[lead.phase]?.color || 'bg-gray-100'}>
                        {phaseLabels[lead.phase]?.label || lead.phase}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5" />
                        <span>{lead.phone}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span>📧</span>
                        <span>{lead.email}</span>
                      </div>
                      {lead.eventDate && (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{format(new Date(lead.eventDate), 'PPP')}</span>
                        </div>
                      )}
                      {lead.venue && (
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5" />
                          <span>{lead.venue}</span>
                        </div>
                      )}
                    </div>

                    {lead.eventType && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">Event:</span>
                        <span className="capitalize">{lead.eventType.replace('_', ' ')}</span>
                        {lead.guestCount && <span className="text-muted-foreground">({lead.guestCount} guests)</span>}
                      </div>
                    )}

                    {lead.servicesRequired && lead.servicesRequired.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {lead.servicesRequired.slice(0, 5).map((service: string, i: number) => (
                          <Badge key={i} variant="secondary" className="text-xs">{service}</Badge>
                        ))}
                        {lead.servicesRequired.length > 5 && (
                          <Badge variant="secondary" className="text-xs">+{lead.servicesRequired.length - 5}</Badge>
                        )}
                      </div>
                    )}

                    {lead.assignedPlannerName && (
                      <div className="flex items-center gap-3 text-sm mt-2 pt-2 border-t bg-green-50/50 -mx-4 px-4 py-2 rounded-b-lg">
                        <div className="h-7 w-7 rounded-full bg-[#4b7c29] text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
                          {lead.assignedPlannerName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-medium text-[#4b7c29]">{lead.assignedPlannerName}</span>
                          <span className="text-muted-foreground ml-1.5 text-xs">Wedding Planner</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 sm:w-48" onClick={(e) => e.stopPropagation()}>
                    {isSuperAdmin && !lead.assignedPlannerId && (
                      <Select 
                        onValueChange={(value) => assignPlannerMutation.mutate({ leadId: lead.id, plannerId: value })}
                        onOpenChange={(open) => {
                          if (open && weddingPlanners.length === 0) {
                            refetchPlanners();
                          }
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Assign Planner" />
                        </SelectTrigger>
                        <SelectContent>
                          {authLoading || plannersLoading ? (
                            <div className="py-2 px-3 text-sm text-muted-foreground">Loading planners...</div>
                          ) : plannersError ? (
                            <div className="py-2 px-3 text-sm text-destructive">
                              Error loading planners. Close and reopen to retry.
                            </div>
                          ) : weddingPlanners && weddingPlanners.length > 0 ? (
                            weddingPlanners.map((planner) => (
                              <SelectItem key={planner.id} value={planner.id}>
                                {planner.name}
                              </SelectItem>
                            ))
                          ) : (
                            <div className="py-2 px-3 text-sm text-muted-foreground">
                              No wedding planners found. Close and reopen to refresh.
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                    )}

                    {lead.assignedPlannerId && (
                      <Select 
                        value={lead.phase}
                        onValueChange={(value) => updateStageMutation.mutate({ leadId: lead.id, phase: value })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="assigned">Assigned</SelectItem>
                          <SelectItem value="contacted">Contacted</SelectItem>
                          <SelectItem value="documents_shared">Documents Shared</SelectItem>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                        </SelectContent>
                      </Select>
                    )}

                    {lead.assignedPlannerId && !confirmedPhases.includes(lead.phase) && (
                      <Button
                        size="sm"
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => updateStageMutation.mutate({ leadId: lead.id, phase: 'confirmed' })}
                        data-testid={`button-confirm-lead-${lead.id}`}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Mark as Confirmed
                      </Button>
                    )}

                    {lead.assignedPlannerId && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => openShareDialog(lead)}
                      >
                        <FileText className="w-4 h-4 mr-1" />
                        Share Documents
                      </Button>
                    )}

                    {lead.assignedPlannerId && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => openMilestoneDialog(lead)}
                          data-testid={`button-manage-milestones-${lead.id}`}
                        >
                          <Target className="w-4 h-4 mr-1" />
                          Manage Milestones
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full border-[#4b7c29] text-[#4b7c29] hover:bg-green-50"
                          onClick={() => openEventFlowDialog(lead)}
                          data-testid={`button-event-flow-${lead.id}`}
                        >
                          <CalendarDays className="w-4 h-4 mr-1" />
                          Event Flow
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full border-amber-500 text-amber-600 hover:bg-amber-50"
                          onClick={() => openFinancialDialog(lead)}
                          data-testid={`button-payment-milestones-${lead.id}`}
                        >
                          <DollarSign className="w-4 h-4 mr-1" />
                          Payment Milestones
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => openTimelineDialog(lead)}
                        >
                          <ListTodo className="w-4 h-4 mr-1" />
                          Push Timeline
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full border-blue-400 text-blue-600 hover:bg-blue-50"
                          onClick={() => {
                            setContactsDialog({ open: true, lead });
                            setNewContact({ name: '', phone: '', email: '', relation: '' });
                            setEditingContactId(null);
                          }}
                          data-testid={`button-manage-contacts-${lead.id}`}
                        >
                          <UserPlus className="w-4 h-4 mr-1" />
                          Manage Contacts
                        </Button>
                        {(currentUser?.role === 'superadmin' || currentUser?.role === 'admin' || currentUser?.role === 'wedding_planner') && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full border-[#4b7c29] text-[#4b7c29] hover:bg-green-50"
                            onClick={() => window.open(`/portal-preview/${lead.id}`, '_blank')}
                            data-testid={`button-preview-portal-${lead.id}`}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Preview Client Portal
                          </Button>
                        )}
                        {lead.portalToken && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => {
                              const portalLink = `${window.location.origin}/client-portal/${lead.portalToken}`;
                              navigator.clipboard.writeText(portalLink);
                              toast({ title: 'Portal link copied!', description: 'You can now share this link with the client' });
                            }}
                            data-testid={`button-copy-portal-link-${lead.id}`}
                          >
                            <Link2 className="w-4 h-4 mr-1" />
                            Copy Portal Link
                          </Button>
                        )}
                        {currentUser?.role === 'superadmin' && (
                          <Button
                            variant={lead.rsvpEnabled ? "default" : "outline"}
                            size="sm"
                            className={`w-full ${lead.rsvpEnabled ? 'bg-[#4b7c29] hover:bg-[#3d6622] text-white' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                            onClick={() => toggleRsvpMutation.mutate({ leadId: lead.id, enabled: !lead.rsvpEnabled })}
                            data-testid={`button-rsvp-toggle-${lead.id}`}
                          >
                            <Users className="w-4 h-4 mr-1" />
                            {lead.rsvpEnabled ? 'RSVP Enabled' : 'Enable RSVP'}
                          </Button>
                        )}
                        {lead.convertedCustomerId ? (
                          <Badge className="bg-green-100 text-green-800 w-full justify-center" data-testid={`badge-converted-${lead.id}`}>
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Converted to Customer
                          </Badge>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-[#4b7c29] hover:text-[#3d6622] hover:bg-green-50 border-[#4b7c29]/30"
                            onClick={() => {
                              setConvertData({
                                name: lead.name || '',
                                phone: lead.phone || '',
                                email: lead.email || '',
                                billingAddress: lead.address || '',
                                state: '',
                                country: 'India',
                                gstNumber: '',
                                weddingPlannerId: lead.assignedPlannerId || '',
                                createEvent: !!lead.eventDate,
                                eventTitle: `${lead.name} - ${lead.eventType || 'Event'}`,
                                eventVenue: lead.venue || '',
                              });
                              setConvertDialog({ open: true, lead });
                            }}
                            data-testid={`button-convert-customer-${lead.id}`}
                          >
                            <UserPlus className="w-4 h-4 mr-1" />
                            Convert to Customer
                          </Button>
                        )}
                      </>
                    )}

                    {lead.clientApprovalStatus && lead.clientApprovalStatus !== 'pending' && (
                      <Badge className={
                        lead.clientApprovalStatus === 'approved' ? 'bg-green-100 text-green-800' :
                        lead.clientApprovalStatus === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }>
                        {lead.clientApprovalStatus === 'approved' ? '✓ Client Approved' :
                         lead.clientApprovalStatus === 'rejected' ? '✗ Rejected' :
                         '⟳ Revision Requested'}
                      </Badge>
                    )}

                    <div className="text-xs text-muted-foreground">
                      Submitted: {format(new Date(lead.createdAt), 'MMM d, yyyy')}
                    </div>

                    {/* Edit/Delete buttons for superadmin */}
                    {currentUser?.role === 'superadmin' && (
                      <div className="flex gap-2 mt-2 pt-2 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            setEditLeadData({
                              name: lead.name || '',
                              email: lead.email || '',
                              phone: lead.phone || '',
                              eventType: lead.eventType || '',
                              eventDate: lead.eventDate ? format(new Date(lead.eventDate), 'yyyy-MM-dd') : '',
                              venue: lead.venue || '',
                              guestCount: lead.guestCount?.toString() || '',
                              notes: lead.notes || '',
                              assignedPlannerId: lead.assignedPlannerId || ''
                            });
                            setEditLeadDialog({ open: true, lead });
                          }}
                          data-testid={`button-edit-lead-${lead.id}`}
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                          onClick={() => setDeleteLeadDialog({ open: true, lead })}
                          data-testid={`button-delete-lead-${lead.id}`}
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Delete
                        </Button>
                      </div>
                    )}
                    {/* View Client Inputs Button - visible to all */}
                    {lead.otpVerified && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-2 text-[#4b7c29] hover:text-[#3d6622] hover:bg-green-50 border-[#4b7c29]/30"
                        onClick={() => setClientInputsDialog({ open: true, lead })}
                        data-testid={`button-view-inputs-${lead.id}`}
                      >
                        <Lightbulb className="w-3 h-3 mr-1" />
                        View Client Inputs
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Portal Lead Dialog */}
      <Dialog open={editLeadDialog.open} onOpenChange={(open) => setEditLeadDialog({ open, lead: open ? editLeadDialog.lead : null })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Portal Lead</DialogTitle>
            <DialogDescription>
              Update the details for {editLeadDialog.lead?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={editLeadData.name}
                  onChange={(e) => setEditLeadData({ ...editLeadData, name: e.target.value })}
                  placeholder="Client name"
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={editLeadData.phone}
                  onChange={(e) => setEditLeadData({ ...editLeadData, phone: e.target.value })}
                  placeholder="Phone number"
                />
              </div>
            </div>
            <div>
              <Label>Email</Label>
              <Input
                value={editLeadData.email}
                onChange={(e) => setEditLeadData({ ...editLeadData, email: e.target.value })}
                placeholder="Email address"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Event Type</Label>
                <Select value={editLeadData.eventType} onValueChange={(val) => setEditLeadData({ ...editLeadData, eventType: val })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hindu_wedding">Hindu Wedding</SelectItem>
                    <SelectItem value="christian_wedding">Christian Wedding</SelectItem>
                    <SelectItem value="muslim_wedding">Muslim Wedding</SelectItem>
                    <SelectItem value="engagement">Engagement</SelectItem>
                    <SelectItem value="birthday">Birthday</SelectItem>
                    <SelectItem value="corporate">Corporate Event</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Event Date</Label>
                <Input
                  type="date"
                  value={editLeadData.eventDate}
                  onChange={(e) => setEditLeadData({ ...editLeadData, eventDate: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Venue</Label>
                <Input
                  value={editLeadData.venue}
                  onChange={(e) => setEditLeadData({ ...editLeadData, venue: e.target.value })}
                  placeholder="Venue name"
                />
              </div>
              <div>
                <Label>Guest Count</Label>
                <Input
                  type="number"
                  value={editLeadData.guestCount}
                  onChange={(e) => setEditLeadData({ ...editLeadData, guestCount: e.target.value })}
                  placeholder="Number of guests"
                />
              </div>
            </div>
            <div>
              <Label>Wedding Planner</Label>
              <Select value={editLeadData.assignedPlannerId} onValueChange={(val) => setEditLeadData({ ...editLeadData, assignedPlannerId: val })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select wedding planner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Not Assigned</SelectItem>
                  {weddingPlanners.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={editLeadData.notes}
                onChange={(e) => setEditLeadData({ ...editLeadData, notes: e.target.value })}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLeadDialog({ open: false, lead: null })}>
              Cancel
            </Button>
            <Button
              className="bg-[#4b7c29] hover:bg-[#3d6621]"
              disabled={editLeadMutation.isPending}
              onClick={() => {
                if (!editLeadDialog.lead) return;
                const plannerName = editLeadData.assignedPlannerId && editLeadData.assignedPlannerId !== 'unassigned'
                  ? weddingPlanners.find((p: any) => p.id === editLeadData.assignedPlannerId)?.name || ''
                  : '';
                editLeadMutation.mutate({
                  leadId: editLeadDialog.lead.id,
                  data: {
                    ...editLeadData,
                    assignedPlannerId: editLeadData.assignedPlannerId === 'unassigned' ? null : editLeadData.assignedPlannerId,
                    assignedPlannerName: plannerName
                  }
                });
              }}
            >
              {editLeadMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Portal Lead Confirmation Dialog */}
      <Dialog open={deleteLeadDialog.open} onOpenChange={(open) => setDeleteLeadDialog({ open, lead: open ? deleteLeadDialog.lead : null })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Portal Lead</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteLeadDialog.lead?.name}</strong>? This action cannot be undone and will remove all associated data including milestones and phases.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteLeadDialog({ open: false, lead: null })}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteLeadMutation.isPending}
              onClick={() => {
                if (!deleteLeadDialog.lead) return;
                deleteLeadMutation.mutate(deleteLeadDialog.lead.id);
              }}
            >
              {deleteLeadMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Delete Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to Customer Dialog */}
      <Dialog open={convertDialog.open} onOpenChange={(open) => setConvertDialog({ open, lead: open ? convertDialog.lead : null })}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#4b7c29]">Convert to Customer</DialogTitle>
            <DialogDescription>
              Create a customer record from <strong>{convertDialog.lead?.name}</strong>'s portal lead details. You can also create an event at the same time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Customer Name *</Label>
                <Input
                  value={convertData.name}
                  onChange={(e) => setConvertData({ ...convertData, name: e.target.value })}
                  placeholder="Customer name"
                  data-testid="input-convert-name"
                />
              </div>
              <div>
                <Label>Phone *</Label>
                <Input
                  value={convertData.phone}
                  onChange={(e) => setConvertData({ ...convertData, phone: e.target.value })}
                  placeholder="Phone number"
                  data-testid="input-convert-phone"
                />
              </div>
            </div>
            <div>
              <Label>Email</Label>
              <Input
                value={convertData.email}
                onChange={(e) => setConvertData({ ...convertData, email: e.target.value })}
                placeholder="Email address"
                data-testid="input-convert-email"
              />
            </div>
            <div>
              <Label>Billing Address</Label>
              <Input
                value={convertData.billingAddress}
                onChange={(e) => setConvertData({ ...convertData, billingAddress: e.target.value })}
                placeholder="Billing address"
                data-testid="input-convert-address"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>State</Label>
                <Input
                  value={convertData.state}
                  onChange={(e) => setConvertData({ ...convertData, state: e.target.value })}
                  placeholder="State"
                  data-testid="input-convert-state"
                />
              </div>
              <div>
                <Label>Country</Label>
                <Input
                  value={convertData.country}
                  onChange={(e) => setConvertData({ ...convertData, country: e.target.value })}
                  placeholder="Country"
                  data-testid="input-convert-country"
                />
              </div>
            </div>
            <div>
              <Label>GST Number</Label>
              <Input
                value={convertData.gstNumber}
                onChange={(e) => setConvertData({ ...convertData, gstNumber: e.target.value })}
                placeholder="GST number (optional)"
                data-testid="input-convert-gst"
              />
            </div>
            <div>
              <Label>Wedding Planner</Label>
              <Select value={convertData.weddingPlannerId} onValueChange={(val) => setConvertData({ ...convertData, weddingPlannerId: val })}>
                <SelectTrigger data-testid="select-convert-planner">
                  <SelectValue placeholder="Select wedding planner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not Assigned</SelectItem>
                  {weddingPlanners.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Also create an event?</Label>
                <Button
                  variant={convertData.createEvent ? "default" : "outline"}
                  size="sm"
                  className={convertData.createEvent ? 'bg-[#4b7c29] hover:bg-[#3d6622]' : ''}
                  onClick={() => setConvertData({ ...convertData, createEvent: !convertData.createEvent })}
                  data-testid="button-toggle-create-event"
                >
                  {convertData.createEvent ? 'Yes' : 'No'}
                </Button>
              </div>

              {convertData.createEvent && (
                <div className="space-y-3 p-3 border rounded-lg bg-gray-50">
                  <div>
                    <Label>Event Title</Label>
                    <Input
                      value={convertData.eventTitle}
                      onChange={(e) => setConvertData({ ...convertData, eventTitle: e.target.value })}
                      placeholder="Event title"
                      data-testid="input-convert-event-title"
                    />
                  </div>
                  <div>
                    <Label>Event Venue</Label>
                    <Input
                      value={convertData.eventVenue}
                      onChange={(e) => setConvertData({ ...convertData, eventVenue: e.target.value })}
                      placeholder="Venue name"
                      data-testid="input-convert-event-venue"
                    />
                  </div>
                  {convertDialog.lead?.eventDate && (
                    <div className="text-sm text-muted-foreground">
                      Event Date: {format(new Date(convertDialog.lead.eventDate), 'MMM d, yyyy')}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertDialog({ open: false, lead: null })} data-testid="button-cancel-convert">
              Cancel
            </Button>
            <Button
              className="bg-[#4b7c29] hover:bg-[#3d6621]"
              disabled={convertToCustomerMutation.isPending || !convertData.name}
              onClick={() => {
                if (!convertDialog.lead) return;
                convertToCustomerMutation.mutate({
                  leadId: convertDialog.lead.id,
                  data: {
                    ...convertData,
                    weddingPlannerId: convertData.weddingPlannerId === 'none' ? null : convertData.weddingPlannerId,
                  }
                });
              }}
              data-testid="button-confirm-convert"
            >
              {convertToCustomerMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
              Convert to Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Client Dialog */}
      <Dialog open={addClientDialog} onOpenChange={(open) => {
        setAddClientDialog(open);
        if (!open) setNewClientPortalUrl(null);
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Portal Client</DialogTitle>
            <DialogDescription>
              Manually add a client and give them access to the client portal
            </DialogDescription>
          </DialogHeader>
          
          {newClientPortalUrl ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-800 font-medium mb-2">
                  <CheckCircle2 className="w-5 h-5" />
                  Client Created Successfully
                </div>
                <p className="text-sm text-green-700 mb-3">Share this link with the client to give them portal access:</p>
                <div className="flex gap-2">
                  <Input 
                    value={newClientPortalUrl} 
                    readOnly 
                    className="flex-1 bg-white text-sm"
                    data-testid="input-portal-url"
                  />
                  <Button 
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(newClientPortalUrl);
                      toast({ title: 'Link copied to clipboard' });
                    }}
                    data-testid="button-copy-portal-url"
                  >
                    Copy
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => {
                  setAddClientDialog(false);
                  setNewClientPortalUrl(null);
                  setAddClientData({ name: '', email: '', phone: '', eventType: '', eventDate: '', venue: '', guestCount: '', notes: '', assignedPlannerId: '' });
                }}>
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Client Name *</Label>
                  <Input
                    value={addClientData.name}
                    onChange={(e) => setAddClientData({ ...addClientData, name: e.target.value })}
                    placeholder="Full name"
                    data-testid="input-client-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone *</Label>
                  <Input
                    value={addClientData.phone}
                    onChange={(e) => setAddClientData({ ...addClientData, phone: e.target.value })}
                    placeholder="+91 9876543210"
                    data-testid="input-client-phone"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={addClientData.email}
                  onChange={(e) => setAddClientData({ ...addClientData, email: e.target.value })}
                  placeholder="client@email.com"
                  data-testid="input-client-email"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Event Type</Label>
                  <Select value={addClientData.eventType} onValueChange={(val) => setAddClientData({ ...addClientData, eventType: val })}>
                    <SelectTrigger data-testid="select-event-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wedding">Wedding</SelectItem>
                      <SelectItem value="engagement">Engagement</SelectItem>
                      <SelectItem value="reception">Reception</SelectItem>
                      <SelectItem value="corporate">Corporate</SelectItem>
                      <SelectItem value="birthday">Birthday</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Event Date</Label>
                  <Input
                    type="date"
                    value={addClientData.eventDate}
                    onChange={(e) => setAddClientData({ ...addClientData, eventDate: e.target.value })}
                    data-testid="input-event-date"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Venue</Label>
                  <Input
                    value={addClientData.venue}
                    onChange={(e) => setAddClientData({ ...addClientData, venue: e.target.value })}
                    placeholder="Venue name"
                    data-testid="input-venue"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Guest Count</Label>
                  <Input
                    type="number"
                    value={addClientData.guestCount}
                    onChange={(e) => setAddClientData({ ...addClientData, guestCount: e.target.value })}
                    placeholder="Expected guests"
                    data-testid="input-guest-count"
                  />
                </div>
              </div>
              
              {isSuperAdmin && (
              <div className="space-y-2">
                <Label>Assign Wedding Planner</Label>
                <Select value={addClientData.assignedPlannerId} onValueChange={(val) => setAddClientData({ ...addClientData, assignedPlannerId: val })}>
                  <SelectTrigger data-testid="select-planner">
                    <SelectValue placeholder="Select planner (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {weddingPlanners.map((planner) => (
                      <SelectItem key={planner.id} value={planner.id}>{planner.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              )}
              
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={addClientData.notes}
                  onChange={(e) => setAddClientData({ ...addClientData, notes: e.target.value })}
                  placeholder="Additional notes about the client..."
                  rows={2}
                  data-testid="input-notes"
                />
              </div>
              
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setAddClientDialog(false)}>
                  Cancel
                </Button>
                <Button
                  disabled={createClientMutation.isPending || !addClientData.name || !addClientData.email || !addClientData.phone}
                  onClick={() => createClientMutation.mutate(addClientData)}
                  data-testid="button-create-client"
                >
                  {createClientMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-1" />}
                  Create & Get Portal Link
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Client Creative Inputs Dialog */}
      <Dialog open={clientInputsDialog.open} onOpenChange={(open) => setClientInputsDialog({ open, lead: open ? clientInputsDialog.lead : null })}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-[#4b7c29]" />
              Client Creative Inputs
            </DialogTitle>
            <DialogDescription>
              Ideas, preferences, and inspiration shared by {clientInputsDialog.lead?.name}
            </DialogDescription>
          </DialogHeader>
          
          {clientInputsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[#4b7c29]" />
            </div>
          ) : clientInputsData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Lightbulb className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No inputs shared yet</p>
              <p className="text-sm">The client hasn't added any creative inputs yet.</p>
            </div>
          ) : (
            <div className="space-y-4 py-4" data-testid="client-inputs-list">
              {clientInputsData.map((input: any) => (
                <div key={input.id} className="border rounded-lg p-4 bg-gray-50" data-testid={`client-input-card-${input.id}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      {input.inputType === 'image' || input.inputType === 'photo' ? (
                        <Image className="w-5 h-5 text-[#4b7c29]" />
                      ) : input.inputType === 'link' || input.inputType === 'pinterest' ? (
                        <Link2 className="w-5 h-5 text-[#4b7c29]" />
                      ) : input.inputType === 'audio' || input.inputType === 'music' ? (
                        <Music className="w-5 h-5 text-[#4b7c29]" />
                      ) : (
                        <MessageSquare className="w-5 h-5 text-[#4b7c29]" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm capitalize" data-testid={`input-type-${input.id}`}>{input.category || input.inputType || 'General'}</span>
                        <span className="text-xs text-gray-400" data-testid={`input-date-${input.id}`}>
                          {input.createdAt ? format(new Date(input.createdAt), 'dd MMM yyyy') : ''}
                        </span>
                      </div>
                      {input.title && <p className="font-medium text-gray-800" data-testid={`input-title-${input.id}`}>{input.title}</p>}
                      {input.description && <p className="text-sm text-gray-600 mt-1" data-testid={`input-description-${input.id}`}>{input.description}</p>}
                      {input.url && (
                        <a 
                          href={input.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-[#4b7c29] hover:underline mt-1 block truncate"
                          data-testid={`input-url-${input.id}`}
                        >
                          {input.url}
                        </a>
                      )}
                      {input.imageUrl && (
                        <img 
                          src={input.imageUrl} 
                          alt={input.title || 'Client input'} 
                          className="mt-2 rounded-md max-h-48 object-cover"
                          data-testid={`input-image-${input.id}`}
                        />
                      )}
                      {input.notes && (
                        <p className="text-sm text-gray-500 mt-2 italic" data-testid={`input-notes-${input.id}`}>"{input.notes}"</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setClientInputsDialog({ open: false, lead: null })} data-testid="button-close-inputs-dialog">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lead Detail Popup Dialog */}
      <Dialog open={leadDetailDialog.open} onOpenChange={(open) => setLeadDetailDialog({ open, lead: open ? leadDetailDialog.lead : null })}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#4b7c29]" />
              {leadDetailDialog.lead?.name}
            </DialogTitle>
            <DialogDescription>
              Complete lead information and inquiry details
            </DialogDescription>
          </DialogHeader>
          
          {leadDetailDialog.lead && (
            <div className="space-y-6 py-4">
              {/* Contact Information */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-[#4b7c29] uppercase tracking-wide">Contact Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4">
                  <div>
                    <Label className="text-xs text-gray-500">Phone</Label>
                    <p className="font-medium">{leadDetailDialog.lead.phone || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">WhatsApp</Label>
                    <p className="font-medium">{leadDetailDialog.lead.whatsappNumber || leadDetailDialog.lead.phone || '-'}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs text-gray-500">Email</Label>
                    <p className="font-medium">{leadDetailDialog.lead.email || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Event Details */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-[#4b7c29] uppercase tracking-wide">Event Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4">
                  <div>
                    <Label className="text-xs text-gray-500">Event Type</Label>
                    <p className="font-medium capitalize">{leadDetailDialog.lead.eventType?.replace('_', ' ') || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Event Date</Label>
                    <p className="font-medium">{leadDetailDialog.lead.eventDate ? format(new Date(leadDetailDialog.lead.eventDate), 'PPP') : '-'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Venue</Label>
                    <p className="font-medium">{leadDetailDialog.lead.venue || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Guest Count</Label>
                    <p className="font-medium">{leadDetailDialog.lead.guestCount || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Budget */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-[#4b7c29] uppercase tracking-wide">Budget</h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="font-medium text-lg">{leadDetailDialog.lead.budgetRange || 'Not specified'}</p>
                </div>
              </div>

              {/* Services Required */}
              {leadDetailDialog.lead.servicesRequired && leadDetailDialog.lead.servicesRequired.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm text-[#4b7c29] uppercase tracking-wide">Services Required</h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex flex-wrap gap-2">
                      {leadDetailDialog.lead.servicesRequired.map((service: string, i: number) => (
                        <Badge key={i} variant="secondary" className="bg-white border border-[#4b7c29]/30 text-[#4b7c29]">
                          {service}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Additional Notes */}
              {leadDetailDialog.lead.additionalNotes && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm text-[#4b7c29] uppercase tracking-wide">Additional Notes</h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-700 whitespace-pre-wrap">{leadDetailDialog.lead.additionalNotes}</p>
                  </div>
                </div>
              )}

              {/* Reference URLs */}
              {leadDetailDialog.lead.referenceUrls && leadDetailDialog.lead.referenceUrls.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm text-[#4b7c29] uppercase tracking-wide">Reference Links</h4>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    {leadDetailDialog.lead.referenceUrls.map((url: string, i: number) => (
                      <a 
                        key={i}
                        href={url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[#4b7c29] hover:underline block truncate text-sm"
                      >
                        <Link2 className="w-3 h-3 inline mr-1" />
                        {url}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Assignment Status */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-[#4b7c29] uppercase tracking-wide">Status</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4">
                  <div>
                    <Label className="text-xs text-gray-500">Stage</Label>
                    <Badge className={phaseLabels[leadDetailDialog.lead.phase]?.color || 'bg-gray-100'}>
                      {phaseLabels[leadDetailDialog.lead.phase]?.label || leadDetailDialog.lead.phase}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Assigned Planner</Label>
                    <p className="font-medium text-[#4b7c29]">{leadDetailDialog.lead.assignedPlannerName || 'Not assigned'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">OTP Verified</Label>
                    <p className="font-medium">{leadDetailDialog.lead.otpVerified ? 'Yes' : 'No'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Submitted</Label>
                    <p className="font-medium">{leadDetailDialog.lead.createdAt ? format(new Date(leadDetailDialog.lead.createdAt), 'PPP') : '-'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {leadDetailDialog.lead?.otpVerified && (
              <Button 
                variant="outline" 
                className="text-[#4b7c29] border-[#4b7c29]/30"
                onClick={() => {
                  setLeadDetailDialog({ open: false, lead: null });
                  setClientInputsDialog({ open: true, lead: leadDetailDialog.lead });
                }}
              >
                <Lightbulb className="w-4 h-4 mr-1" />
                View Creative Inputs
              </Button>
            )}
            <Button variant="outline" onClick={() => setLeadDetailDialog({ open: false, lead: null })}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Contacts Dialog */}
      <Dialog open={contactsDialog.open} onOpenChange={(open) => setContactsDialog({ open, lead: open ? contactsDialog.lead : null })}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Manage Contacts - {contactsDialog.lead?.name}
            </DialogTitle>
            <DialogDescription>
              Add family members or other contacts for this client's portal
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Primary Contact */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-[#4b7c29] text-white text-xs">Primary</Badge>
                <span className="font-semibold text-sm">{contactsDialog.lead?.name}</span>
              </div>
              <div className="text-xs text-gray-600 space-y-0.5">
                {contactsDialog.lead?.phone && <p>{contactsDialog.lead.phone}</p>}
                {contactsDialog.lead?.email && <p>{contactsDialog.lead.email}</p>}
              </div>
            </div>

            {/* Existing Contacts */}
            {(leadContacts as any[]).length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Additional Contacts</h4>
                {(leadContacts as any[]).map((contact: any) => (
                  <div key={contact.id} className="border rounded-lg p-3" data-testid={`contact-card-${contact.id}`}>
                    {editingContactId === contact.id ? (
                      <div className="space-y-2">
                        <Input
                          placeholder="Name"
                          value={editContactData.name}
                          onChange={(e) => setEditContactData(d => ({ ...d, name: e.target.value }))}
                          data-testid={`input-edit-contact-name-${contact.id}`}
                        />
                        <Input
                          placeholder="Phone"
                          value={editContactData.phone}
                          onChange={(e) => setEditContactData(d => ({ ...d, phone: e.target.value }))}
                          data-testid={`input-edit-contact-phone-${contact.id}`}
                        />
                        <Input
                          placeholder="Email"
                          value={editContactData.email}
                          onChange={(e) => setEditContactData(d => ({ ...d, email: e.target.value }))}
                          data-testid={`input-edit-contact-email-${contact.id}`}
                        />
                        <Input
                          placeholder="Relation (e.g., Bride's Father)"
                          value={editContactData.relation}
                          onChange={(e) => setEditContactData(d => ({ ...d, relation: e.target.value }))}
                          data-testid={`input-edit-contact-relation-${contact.id}`}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-[#4b7c29] hover:bg-[#3d6622]"
                            onClick={() => updateContactMutation.mutate({ id: contact.id, data: editContactData })}
                            disabled={!editContactData.name || updateContactMutation.isPending}
                            data-testid={`button-save-contact-${contact.id}`}
                          >
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingContactId(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{contact.name}</span>
                            {contact.relation && (
                              <Badge variant="secondary" className="text-xs">{contact.relation}</Badge>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                            {contact.phone && <p>{contact.phone}</p>}
                            {contact.email && <p>{contact.email}</p>}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-gray-400 hover:text-blue-600"
                            onClick={() => {
                              setEditingContactId(contact.id);
                              setEditContactData({
                                name: contact.name || '',
                                phone: contact.phone || '',
                                email: contact.email || '',
                                relation: contact.relation || '',
                              });
                            }}
                            data-testid={`button-edit-contact-${contact.id}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-gray-400 hover:text-red-600"
                            onClick={() => deleteContactMutation.mutate(contact.id)}
                            data-testid={`button-delete-contact-${contact.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add New Contact */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Add New Contact</h4>
              <div className="space-y-2">
                <Input
                  placeholder="Name *"
                  value={newContact.name}
                  onChange={(e) => setNewContact(c => ({ ...c, name: e.target.value }))}
                  data-testid="input-new-contact-name"
                />
                <Input
                  placeholder="Phone"
                  value={newContact.phone}
                  onChange={(e) => setNewContact(c => ({ ...c, phone: e.target.value }))}
                  data-testid="input-new-contact-phone"
                />
                <Input
                  placeholder="Email"
                  value={newContact.email}
                  onChange={(e) => setNewContact(c => ({ ...c, email: e.target.value }))}
                  data-testid="input-new-contact-email"
                />
                <Input
                  placeholder="Relation (e.g., Bride's Father, Groom's Mother)"
                  value={newContact.relation}
                  onChange={(e) => setNewContact(c => ({ ...c, relation: e.target.value }))}
                  data-testid="input-new-contact-relation"
                />
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  onClick={() => {
                    if (!newContact.name || !contactsDialog.lead?.id) return;
                    addContactMutation.mutate({ leadId: contactsDialog.lead.id, data: newContact });
                  }}
                  disabled={!newContact.name || addContactMutation.isPending}
                  data-testid="button-add-contact"
                >
                  <UserPlus className="w-4 h-4 mr-1" />
                  Add Contact
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setContactsDialog({ open: false, lead: null })}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Share Documents with Client</DialogTitle>
            <DialogDescription>
              Select documents to share with {selectedLeadForShare?.name}. They will receive a link to view and approve these documents.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-medium">Estimate</Label>
              <p className="text-xs text-muted-foreground mb-2">Select from system, upload file, or paste a URL</p>
              <Popover open={estimateComboOpen} onOpenChange={setEstimateComboOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={estimateComboOpen} className="w-full justify-between font-normal">
                    {selectedEstimateId
                      ? (() => {
                          const est = availableDocs?.estimates?.find((e: any) => e.id === selectedEstimateId);
                          return est ? `${est.estimateNumber} - ${est.customerName || est.title}` : 'Select an estimate...';
                        })()
                      : 'Select an estimate...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search estimates..." />
                    <CommandList>
                      <CommandEmpty>No estimates found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem onSelect={() => { setSelectedEstimateId(''); setEstimateComboOpen(false); }}>
                          <Check className={`mr-2 h-4 w-4 ${!selectedEstimateId ? 'opacity-100' : 'opacity-0'}`} />
                          None
                        </CommandItem>
                        {availableDocs?.estimates?.map((est: any) => (
                          <CommandItem key={est.id} value={`${est.estimateNumber} ${est.customerName || est.title}`} onSelect={() => { setSelectedEstimateId(est.id); setEstimateUrl(''); setUploadedEstimateName(''); setEstimateComboOpen(false); }}>
                            <Check className={`mr-2 h-4 w-4 ${selectedEstimateId === est.id ? 'opacity-100' : 'opacity-0'}`} />
                            {est.estimateNumber} - {est.customerName || est.title} (₹{parseFloat(est.total || '0').toLocaleString('en-IN')})
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <div className="flex items-center gap-2 my-2">
                <div className="flex-1 border-t" />
                <span className="text-xs text-muted-foreground">OR UPLOAD</span>
                <div className="flex-1 border-t" />
              </div>
              <div className="flex gap-2">
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
                  className="flex-1"
                  disabled={uploadingEstimate}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleDocumentUpload(file, 'estimate');
                  }}
                />
                {uploadingEstimate && <span className="text-xs text-muted-foreground self-center">Uploading...</span>}
              </div>
              {uploadedEstimateName && (
                <p className="text-xs text-green-600 mt-1">Uploaded: {uploadedEstimateName}</p>
              )}
              <div className="flex items-center gap-2 my-2">
                <div className="flex-1 border-t" />
                <span className="text-xs text-muted-foreground">OR URL</span>
                <div className="flex-1 border-t" />
              </div>
              <Input
                placeholder="https://... (PDF, Google Sheets, etc.)"
                value={uploadedEstimateName ? '' : estimateUrl}
                disabled={!!uploadedEstimateName}
                onChange={(e) => { setEstimateUrl(e.target.value); if (e.target.value) { setSelectedEstimateId(""); setUploadedEstimateName(""); } }}
              />
            </div>

            <div>
              <Label className="text-sm font-medium">Presentation</Label>
              <p className="text-xs text-muted-foreground mb-2">Select from system, upload file, or paste a URL</p>
              <Popover open={presentationComboOpen} onOpenChange={setPresentationComboOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={presentationComboOpen} className="w-full justify-between font-normal">
                    {selectedPresentationId
                      ? (() => {
                          const pres = availableDocs?.presentations?.find((p: any) => p.id === selectedPresentationId);
                          return pres ? pres.title : 'Select a presentation...';
                        })()
                      : 'Select a presentation...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search presentations..." />
                    <CommandList>
                      <CommandEmpty>No presentations found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem onSelect={() => { setSelectedPresentationId(''); setPresentationComboOpen(false); }}>
                          <Check className={`mr-2 h-4 w-4 ${!selectedPresentationId ? 'opacity-100' : 'opacity-0'}`} />
                          None
                        </CommandItem>
                        {availableDocs?.presentations?.map((pres: any) => (
                          <CommandItem key={pres.id} value={pres.title} onSelect={() => { setSelectedPresentationId(pres.id); setPresentationUrl(''); setUploadedPresentationName(''); setPresentationComboOpen(false); }}>
                            <Check className={`mr-2 h-4 w-4 ${selectedPresentationId === pres.id ? 'opacity-100' : 'opacity-0'}`} />
                            {pres.title}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <div className="flex items-center gap-2 my-2">
                <div className="flex-1 border-t" />
                <span className="text-xs text-muted-foreground">OR UPLOAD</span>
                <div className="flex-1 border-t" />
              </div>
              <div className="flex gap-2">
                <Input
                  type="file"
                  accept=".pdf,.ppt,.pptx,.doc,.docx,image/*"
                  className="flex-1"
                  disabled={uploadingPresentation}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleDocumentUpload(file, 'presentation');
                  }}
                />
                {uploadingPresentation && <span className="text-xs text-muted-foreground self-center">Uploading...</span>}
              </div>
              {uploadedPresentationName && (
                <p className="text-xs text-green-600 mt-1">Uploaded: {uploadedPresentationName}</p>
              )}
              <div className="flex items-center gap-2 my-2">
                <div className="flex-1 border-t" />
                <span className="text-xs text-muted-foreground">OR URL</span>
                <div className="flex-1 border-t" />
              </div>
              <Input
                placeholder="https://... (PDF, PPT, Google Slides URL)"
                value={uploadedPresentationName ? '' : presentationUrl}
                disabled={!!uploadedPresentationName}
                onChange={(e) => { setPresentationUrl(e.target.value); if (e.target.value) { setSelectedPresentationId(""); setUploadedPresentationName(""); } }}
              />
            </div>

            <div>
              <Label className="text-sm font-medium">Contract</Label>
              <p className="text-xs text-muted-foreground mb-2">Upload file or paste a URL</p>
              <div className="flex gap-2">
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx,image/*"
                  className="flex-1"
                  disabled={uploadingContract}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleDocumentUpload(file, 'contract');
                  }}
                />
                {uploadingContract && <span className="text-xs text-muted-foreground self-center">Uploading...</span>}
              </div>
              {uploadedContractName && (
                <p className="text-xs text-green-600 mt-1">Uploaded: {uploadedContractName}</p>
              )}
              <div className="flex items-center gap-2 my-2">
                <div className="flex-1 border-t" />
                <span className="text-xs text-muted-foreground">OR URL</span>
                <div className="flex-1 border-t" />
              </div>
              <Input
                placeholder="https://... (PDF, Google Docs, etc.)"
                value={uploadedContractName ? '' : contractUrl}
                disabled={!!uploadedContractName}
                onChange={(e) => { setContractUrl(e.target.value); if (e.target.value) setUploadedContractName(""); }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleShareDocuments}
              disabled={shareDocsMutation.isPending}
              className="bg-[#4b7c29] hover:bg-[#4b7c29]/90"
            >
              {shareDocsMutation.isPending ? 'Sharing...' : 'Share with Client'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={timelineDialogOpen} onOpenChange={setTimelineDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListTodo className="w-5 h-5 text-blue-600" />
              Push Timeline to Client Portal
            </DialogTitle>
            <DialogDescription>
              Customize and push the event timeline to {selectedLeadForTimeline?.name}'s portal. They will see animated milestones.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {timelineItems.map((item, index) => (
              <div key={index} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    item.status === 'completed' ? 'bg-green-100 text-green-600' :
                    item.status === 'in_progress' ? 'bg-blue-100 text-blue-600' :
                    'bg-gray-200 text-gray-500'
                  }`}>
                    {item.status === 'completed' ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <span className="font-bold text-sm">{item.phase}</span>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <Input
                        value={item.title}
                        onChange={(e) => updateTimelineItem(index, 'title', e.target.value)}
                        placeholder="Title"
                        className="flex-1"
                      />
                      <Select 
                        value={item.status} 
                        onValueChange={(val) => updateTimelineItem(index, 'status', val)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="upcoming">Upcoming</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      value={item.description}
                      onChange={(e) => updateTimelineItem(index, 'description', e.target.value)}
                      placeholder="Description"
                    />
                    <Input
                      type="date"
                      value={item.date}
                      onChange={(e) => updateTimelineItem(index, 'date', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTimelineDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handlePushTimeline}
              disabled={pushTimelineMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {pushTimelineMutation.isPending ? 'Pushing...' : 'Push to Portal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Milestone Management Dialog */}
      <Dialog open={milestoneDialogOpen} onOpenChange={setMilestoneDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-[#4b7c29]" />
              Project Milestones - {selectedLeadForMilestone?.name}
            </DialogTitle>
            <DialogDescription>
              Manage project phases and tasks. Set the event date to auto-calculate all milestone deadlines.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-6">
            {/* Event Date & Initialize Section */}
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-lg border">
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[200px]">
                  <Label className="text-sm font-medium">Event Date (D-0)</Label>
                  <Input
                    type="date"
                    value={milestoneEventDate}
                    onChange={(e) => setMilestoneEventDate(e.target.value)}
                    className="mt-1"
                    data-testid="input-event-date"
                  />
                </div>
                <Button
                  onClick={() => {
                    if (!selectedLeadForMilestone || !milestoneEventDate) return;
                    initializeMilestonesMutation.mutate({
                      leadId: selectedLeadForMilestone.id,
                      eventDate: milestoneEventDate
                    });
                  }}
                  disabled={!milestoneEventDate || initializeMilestonesMutation.isPending}
                  className="bg-[#4b7c29] hover:bg-[#3d6621]"
                  data-testid="button-initialize-milestones"
                >
                  {initializeMilestonesMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  {milestonesData?.phases?.length > 0 ? 'Reset Milestones' : 'Initialize Milestones'}
                </Button>
              </div>
              
              {milestonesData?.progress && (
                <div className="mt-4">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Overall Progress</span>
                    <span>{milestonesData.progress.completed}/{milestonesData.progress.total} tasks ({milestonesData.progress.percentage}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-[#4b7c29] h-2 rounded-full transition-all duration-500" 
                      style={{ width: `${milestonesData.progress.percentage}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Phases and Tasks */}
            {milestonesData?.phases?.length > 0 ? (
              <div className="space-y-3">
                {milestonesData.phases.map((phase: any) => {
                  const phaseStatus = getPhaseStatus(phase);
                  const isExpanded = expandedPhases.has(phase.id);
                  const phaseTasks = phase.tasks || [];
                  const completedTasks = phaseTasks.filter((t: any) => t.isCompleted).length;
                  const phaseProgress = phaseTasks.length > 0 ? Math.round((completedTasks / phaseTasks.length) * 100) : 0;
                  
                  return (
                    <div key={phase.id} className="border rounded-lg overflow-hidden">
                      {/* Phase Header */}
                      <div 
                        className={`p-4 cursor-pointer transition-colors ${
                          phaseStatus === 'completed' ? 'bg-green-50 border-l-4 border-l-green-500' :
                          phaseStatus === 'in_progress' ? 'bg-blue-50 border-l-4 border-l-blue-500' :
                          phaseStatus === 'action_required' ? 'bg-red-50 border-l-4 border-l-red-500' :
                          'bg-gray-50 border-l-4 border-l-gray-300'
                        }`}
                        onClick={() => togglePhaseExpanded(phase.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronDown className="w-5 h-5 text-gray-500" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-gray-500" />
                            )}
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-700">Phase {phase.phaseNumber}:</span>
                              <span className="font-medium">{phase.phaseName}</span>
                            </div>
                            <Badge className={
                              phaseStatus === 'completed' ? 'bg-green-100 text-green-800' :
                              phaseStatus === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                              phaseStatus === 'action_required' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-600'
                            }>
                              {phaseStatus === 'completed' ? 'Completed' :
                               phaseStatus === 'in_progress' ? 'In Progress' :
                               phaseStatus === 'action_required' ? 'Action Required' :
                               'Upcoming'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-500">
                              {milestoneEventDate && (
                                <>D{phase.daysBeforeStart >= 0 ? '+' : ''}{phase.daysBeforeStart} to D{phase.daysBeforeEnd >= 0 ? '+' : ''}{phase.daysBeforeEnd}</>
                              )}
                            </span>
                            <div className="w-24 bg-gray-200 rounded-full h-1.5">
                              <div 
                                className={`h-1.5 rounded-full ${phaseStatus === 'completed' ? 'bg-green-500' : 'bg-blue-500'}`}
                                style={{ width: `${phaseProgress}%` }}
                              />
                            </div>
                            <span className="text-sm text-gray-600 min-w-[40px]">{completedTasks}/{phaseTasks.length}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Tasks */}
                      {isExpanded && (
                        <div className="bg-white p-4 space-y-2">
                          {phaseTasks.map((task: any, idx: number) => (
                            <div 
                              key={task.id} 
                              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                                task.isCompleted ? 'bg-green-50 border-green-200' : 
                                task.status === 'action_required' ? 'bg-red-50 border-red-200' :
                                'bg-gray-50 border-gray-200 hover:bg-gray-100'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={task.isCompleted}
                                onChange={(e) => {
                                  updateTaskMutation.mutate({
                                    taskId: task.id,
                                    updates: { isCompleted: e.target.checked }
                                  });
                                }}
                                className="w-5 h-5 rounded border-gray-300 text-[#4b7c29] focus:ring-[#4b7c29]"
                                data-testid={`checkbox-task-${task.id}`}
                              />
                              <div className="flex-1">
                                <span className={task.isCompleted ? 'line-through text-gray-500' : ''}>
                                  {task.taskName}
                                </span>
                              </div>
                              {task.dueDate && (
                                <span className="text-xs text-gray-500">
                                  {format(new Date(task.dueDate), 'MMM d')}
                                </span>
                              )}
                              {task.isCompleted && task.completedAt && (
                                <span className="text-xs text-green-600">
                                  ✓ {format(new Date(task.completedAt), 'MMM d')}
                                </span>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteTaskMutation.mutate(task.id)}
                                className="h-8 w-8 p-0 text-gray-400 hover:text-red-500"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                          
                          {/* Add Task Button */}
                          <div className="pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full border-dashed"
                              onClick={() => {
                                const taskName = prompt('Enter task name:');
                                if (taskName) {
                                  addTaskMutation.mutate({ phaseId: phase.id, taskName });
                                }
                              }}
                            >
                              <Plus className="w-4 h-4 mr-1" /> Add Task
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed">
                <Target className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">No Milestones Yet</h3>
                <p className="text-gray-500 mb-4">Set an event date and initialize milestones to create a project timeline.</p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setMilestoneDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Event Flow Management Dialog */}
      <Dialog open={eventFlowDialogOpen} onOpenChange={setEventFlowDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-[#4b7c29]" />
              Event Flow - {selectedLeadForEventFlow?.name}
            </DialogTitle>
            <DialogDescription>
              Create multiple events (Wedding, Haldi, Sangeet) with timeline items for each. Published events will appear in client's portal.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-6">
            {/* Add New Event Flow Form */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200">
              <h3 className="font-semibold text-[#4b7c29] mb-3 flex items-center gap-2">
                <Plus className="w-4 h-4" /> Add New Event
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">Event Name *</Label>
                  <Input
                    placeholder="e.g., Wedding Ceremony, Haldi, Sangeet"
                    value={newEventFlow.eventName}
                    onChange={(e) => setNewEventFlow(prev => ({ ...prev, eventName: e.target.value }))}
                    className="mt-1"
                    data-testid="input-event-flow-name"
                  />
                </div>
                <div>
                  <Label className="text-sm">Event Date *</Label>
                  <Input
                    type="date"
                    value={newEventFlow.eventDate}
                    onChange={(e) => setNewEventFlow(prev => ({ ...prev, eventDate: e.target.value }))}
                    className="mt-1"
                    data-testid="input-event-flow-date"
                  />
                </div>
                <div>
                  <Label className="text-sm">Start Time</Label>
                  <Input
                    type="time"
                    value={newEventFlow.eventTime}
                    onChange={(e) => setNewEventFlow(prev => ({ ...prev, eventTime: e.target.value }))}
                    className="mt-1"
                    data-testid="input-event-flow-time"
                  />
                </div>
                <div>
                  <Label className="text-sm">Venue *</Label>
                  <Input
                    placeholder="e.g., Grand Ballroom"
                    value={newEventFlow.venue}
                    onChange={(e) => setNewEventFlow(prev => ({ ...prev, venue: e.target.value }))}
                    className="mt-1"
                    data-testid="input-event-flow-venue"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-sm">Venue Address</Label>
                  <Input
                    placeholder="Full address of the venue"
                    value={newEventFlow.venueAddress}
                    onChange={(e) => setNewEventFlow(prev => ({ ...prev, venueAddress: e.target.value }))}
                    className="mt-1"
                    data-testid="input-event-flow-address"
                  />
                </div>
              </div>
              <Button
                className="mt-3 bg-[#4b7c29] hover:bg-[#3d6621]"
                disabled={!newEventFlow.eventName || !newEventFlow.eventDate || !newEventFlow.venue || createEventFlowMutation.isPending}
                onClick={() => {
                  if (!selectedLeadForEventFlow) return;
                  createEventFlowMutation.mutate({ leadId: selectedLeadForEventFlow.id, data: newEventFlow });
                }}
                data-testid="button-create-event-flow"
              >
                {createEventFlowMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                Add Event
              </Button>
            </div>

            {/* Event Flows List */}
            {eventFlowsData?.eventFlows && eventFlowsData.eventFlows.length > 0 ? (
              <div className="space-y-4">
                {eventFlowsData.eventFlows.map((flow: any) => (
                  <div key={flow.id} className={`border rounded-lg overflow-hidden ${flow.isPublished ? 'ring-2 ring-green-200' : ''}`}>
                    {/* Event Header */}
                    <div className="bg-gray-50 p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#4b7c29] flex items-center justify-center text-white font-bold">
                          {flow.eventName?.charAt(0)?.toUpperCase() || 'E'}
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-800">{flow.eventName}</h4>
                          <p className="text-sm text-gray-500">
                            {flow.eventDate ? format(new Date(flow.eventDate), 'MMM d, yyyy') : 'No date'} 
                            {flow.eventTime ? ` at ${flow.eventTime}` : ''} • {flow.venue || 'No venue'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={flow.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}>
                          {flow.isPublished ? 'Published' : 'Draft'}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => publishEventFlowMutation.mutate({ flowId: flow.id, isPublished: !flow.isPublished })}
                          className={flow.isPublished ? 'text-amber-600 border-amber-200' : 'text-green-600 border-green-200'}
                        >
                          {flow.isPublished ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
                          {flow.isPublished ? 'Unpublish' : 'Publish'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteEventFlowMutation.mutate(flow.id)}
                          className="text-red-600 border-red-200 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Timeline Items */}
                    <div className="p-4 space-y-2">
                      {flow.items && flow.items.length > 0 ? (
                        flow.items.map((item: any) => (
                          editingFlowItem?.id === item.id ? (
                            /* Inline Edit Form */
                            <div key={item.id} className="border-2 border-[#4b7c29] rounded-lg p-4 bg-green-50/30 space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label className="text-sm">Activity Title *</Label>
                                  <Input
                                    value={editFlowItemData.title}
                                    onChange={(e) => setEditFlowItemData(prev => ({ ...prev, title: e.target.value }))}
                                    className="mt-1"
                                    data-testid={`input-edit-item-title-${item.id}`}
                                  />
                                </div>
                                <div>
                                  <Label className="text-sm">Category</Label>
                                  <Select 
                                    value={editFlowItemData.category} 
                                    onValueChange={(val) => setEditFlowItemData(prev => ({ ...prev, category: val }))}
                                  >
                                    <SelectTrigger className="mt-1" data-testid={`select-edit-item-category-${item.id}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="ceremony">Ceremony</SelectItem>
                                      <SelectItem value="entertainment">Entertainment</SelectItem>
                                      <SelectItem value="food">Food & Drinks</SelectItem>
                                      <SelectItem value="photo">Photo/Video</SelectItem>
                                      <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label className="text-sm">Start Time</Label>
                                  <Input
                                    type="time"
                                    value={editFlowItemData.startTime}
                                    onChange={(e) => setEditFlowItemData(prev => ({ ...prev, startTime: e.target.value }))}
                                    className="mt-1"
                                    data-testid={`input-edit-item-start-${item.id}`}
                                  />
                                </div>
                                <div>
                                  <Label className="text-sm">End Time</Label>
                                  <Input
                                    type="time"
                                    value={editFlowItemData.endTime}
                                    onChange={(e) => setEditFlowItemData(prev => ({ ...prev, endTime: e.target.value }))}
                                    className="mt-1"
                                    data-testid={`input-edit-item-end-${item.id}`}
                                  />
                                </div>
                                <div className="col-span-2">
                                  <Label className="text-sm">Description</Label>
                                  <Input
                                    value={editFlowItemData.description}
                                    onChange={(e) => setEditFlowItemData(prev => ({ ...prev, description: e.target.value }))}
                                    className="mt-1"
                                    placeholder="Brief description"
                                    data-testid={`input-edit-item-desc-${item.id}`}
                                  />
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  className="bg-[#4b7c29] hover:bg-[#3d6621]"
                                  disabled={!editFlowItemData.title || updateFlowItemMutation.isPending}
                                  onClick={() => updateFlowItemMutation.mutate({ itemId: item.id, data: editFlowItemData })}
                                  data-testid={`button-save-item-${item.id}`}
                                >
                                  {updateFlowItemMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                                  Save
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setEditingFlowItem(null)}
                                  data-testid={`button-cancel-edit-${item.id}`}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            /* Normal Item Display */
                            <div key={item.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border hover:border-[#4b7c29] transition-colors">
                              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                                <Clock className="w-4 h-4 text-[#4b7c29]" />
                              </div>
                              <div className="flex-1">
                                <span className="font-medium">{item.title}</span>
                                {item.description && <p className="text-sm text-gray-500">{item.description}</p>}
                              </div>
                              <span className="text-sm text-gray-500">
                                {item.startTime} {item.endTime ? `- ${item.endTime}` : ''}
                              </span>
                              <Badge variant="outline" className="capitalize">{item.category}</Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditFlowItemData({
                                    title: item.title || '',
                                    description: item.description || '',
                                    startTime: item.startTime || '',
                                    endTime: item.endTime || '',
                                    category: item.category || 'ceremony',
                                    notes: item.notes || ''
                                  });
                                  setEditingFlowItem(item);
                                }}
                                className="h-8 w-8 p-0 text-gray-400 hover:text-[#4b7c29]"
                                data-testid={`button-edit-item-${item.id}`}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteFlowItemMutation.mutate(item.id)}
                                className="h-8 w-8 p-0 text-gray-400 hover:text-red-500"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          )
                        ))
                      ) : (
                        <div className="text-center py-4 space-y-3">
                          <p className="text-sm text-gray-400">No timeline items yet</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-[#4b7c29] text-[#4b7c29] hover:bg-green-50"
                            onClick={() => loadDefaultTemplateMutation.mutate(flow.id)}
                            disabled={loadDefaultTemplateMutation.isPending}
                            data-testid={`button-load-template-${flow.id}`}
                          >
                            {loadDefaultTemplateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                            Load Default Wedding Template
                          </Button>
                        </div>
                      )}
                      
                      {/* Add Item Form */}
                      {addingItemToFlow === flow.id ? (
                        <div className="border-2 border-dashed border-green-300 rounded-lg p-4 bg-green-50/50 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-sm">Activity Title *</Label>
                              <Input
                                placeholder="e.g., Bride's Entry"
                                value={newFlowItem.title}
                                onChange={(e) => setNewFlowItem(prev => ({ ...prev, title: e.target.value }))}
                                className="mt-1"
                                data-testid="input-flow-item-title"
                              />
                            </div>
                            <div>
                              <Label className="text-sm">Category</Label>
                              <Select 
                                value={newFlowItem.category} 
                                onValueChange={(val) => setNewFlowItem(prev => ({ ...prev, category: val }))}
                              >
                                <SelectTrigger className="mt-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="ceremony">Ceremony</SelectItem>
                                  <SelectItem value="entertainment">Entertainment</SelectItem>
                                  <SelectItem value="food">Food & Drinks</SelectItem>
                                  <SelectItem value="photo">Photo/Video</SelectItem>
                                  <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-sm">Start Time</Label>
                              <Input
                                type="time"
                                value={newFlowItem.startTime}
                                onChange={(e) => setNewFlowItem(prev => ({ ...prev, startTime: e.target.value }))}
                                className="mt-1"
                                data-testid="input-flow-item-start"
                              />
                            </div>
                            <div>
                              <Label className="text-sm">End Time</Label>
                              <Input
                                type="time"
                                value={newFlowItem.endTime}
                                onChange={(e) => setNewFlowItem(prev => ({ ...prev, endTime: e.target.value }))}
                                className="mt-1"
                                data-testid="input-flow-item-end"
                              />
                            </div>
                            <div className="col-span-2">
                              <Label className="text-sm">Description</Label>
                              <Input
                                placeholder="Brief description of this activity"
                                value={newFlowItem.description}
                                onChange={(e) => setNewFlowItem(prev => ({ ...prev, description: e.target.value }))}
                                className="mt-1"
                                data-testid="input-flow-item-desc"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="bg-[#4b7c29] hover:bg-[#3d6621]"
                              disabled={!newFlowItem.title || addFlowItemMutation.isPending}
                              onClick={() => addFlowItemMutation.mutate({ flowId: flow.id, data: newFlowItem })}
                              data-testid="button-add-flow-item"
                            >
                              {addFlowItemMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                              Add Item
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setAddingItemToFlow(null);
                                setNewFlowItem({ title: '', description: '', startTime: '', endTime: '', category: 'ceremony', notes: '' });
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full border-dashed"
                          onClick={() => setAddingItemToFlow(flow.id)}
                          data-testid={`button-add-item-${flow.id}`}
                        >
                          <Plus className="w-4 h-4 mr-1" /> Add Timeline Item
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed">
                <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">No Event Flows Yet</h3>
                <p className="text-gray-500">Add events like Wedding, Haldi, or Sangeet above to create a multi-event flow.</p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEventFlowDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Financial Milestones Management Dialog */}
      <Dialog open={financialDialogOpen} onOpenChange={setFinancialDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-[#4b7c29]" />
              Payment Milestones - {selectedLeadForFinancials?.name}
            </DialogTitle>
            <DialogDescription>
              Set up payment structure (15%-40%-40%-5%) and confirm payments as they are received.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-6">
            {/* Initialize Section */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200">
              <h3 className="font-semibold text-[#4b7c29] mb-3">Set Up Payment Structure</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">Total Contract Value (₹)</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 500000"
                    value={financialTotalAmount}
                    onChange={(e) => setFinancialTotalAmount(e.target.value)}
                    className="mt-1"
                    data-testid="input-financial-total"
                  />
                </div>
                <div>
                  <Label className="text-sm">Event Date</Label>
                  <Input
                    type="date"
                    value={financialEventDate}
                    onChange={(e) => setFinancialEventDate(e.target.value)}
                    className="mt-1"
                    data-testid="input-financial-date"
                  />
                </div>
              </div>
              <div className="mt-3 p-3 bg-white/50 rounded border text-sm text-gray-600">
                <p className="font-medium mb-1">Payment Structure Preview:</p>
                <ul className="grid grid-cols-2 gap-2">
                  <li>• Advance (15%): ₹{financialTotalAmount ? (parseFloat(financialTotalAmount) * 0.15).toLocaleString('en-IN') : '0'}</li>
                  <li>• 2 Months Before (40%): ₹{financialTotalAmount ? (parseFloat(financialTotalAmount) * 0.40).toLocaleString('en-IN') : '0'}</li>
                  <li>• 2 Weeks Before (40%): ₹{financialTotalAmount ? (parseFloat(financialTotalAmount) * 0.40).toLocaleString('en-IN') : '0'}</li>
                  <li>• Event Day (5%): ₹{financialTotalAmount ? (parseFloat(financialTotalAmount) * 0.05).toLocaleString('en-IN') : '0'}</li>
                </ul>
              </div>
              <Button
                className="mt-3 bg-[#4b7c29] hover:bg-[#3d6621]"
                disabled={!financialTotalAmount || !financialEventDate || initializeFinancialMilestonesMutation.isPending}
                onClick={() => {
                  if (!selectedLeadForFinancials) return;
                  initializeFinancialMilestonesMutation.mutate({
                    leadId: selectedLeadForFinancials.id,
                    totalAmount: financialTotalAmount,
                    eventDate: financialEventDate
                  });
                }}
                data-testid="button-initialize-financial"
              >
                {initializeFinancialMilestonesMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {financialMilestonesAdminData?.milestones?.length ? 'Reset Payment Milestones' : 'Initialize Payment Milestones'}
              </Button>
            </div>

            {/* Summary Cards */}
            {financialMilestonesAdminData?.summary && financialMilestonesAdminData.summary.totalAmount > 0 && (
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-gray-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-gray-500">Total</p>
                  <p className="text-xl font-bold text-gray-800">₹{financialMilestonesAdminData.summary.totalAmount.toLocaleString('en-IN')}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-gray-500">Received</p>
                  <p className="text-xl font-bold text-green-600">₹{financialMilestonesAdminData.summary.paidAmount.toLocaleString('en-IN')}</p>
                </div>
                <div className="bg-amber-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-gray-500">Pending</p>
                  <p className="text-xl font-bold text-amber-600">₹{financialMilestonesAdminData.summary.pendingAmount.toLocaleString('en-IN')}</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-gray-500">Progress</p>
                  <p className="text-xl font-bold text-blue-600">{financialMilestonesAdminData.summary.completedMilestones}/{financialMilestonesAdminData.summary.totalMilestones}</p>
                </div>
              </div>
            )}

            {/* Milestones List */}
            {financialMilestonesAdminData?.milestones && financialMilestonesAdminData.milestones.length > 0 ? (
              <div className="space-y-3">
                {financialMilestonesAdminData.milestones.map((milestone: any) => {
                  const milestoneAmt = parseFloat(milestone.amount || '0');
                  const paidAmt = parseFloat(milestone.paidAmount || '0');
                  const isPartiallyPaid = !milestone.isPaid && paidAmt > 0 && paidAmt < milestoneAmt;
                  const balanceAmt = milestoneAmt - paidAmt;

                  return (
                  <div 
                    key={milestone.id} 
                    className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                      milestone.isPaid ? 'bg-green-50 border-green-200' : isPartiallyPaid ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200 hover:border-[#4b7c29]'
                    }`}
                    data-testid={`admin-milestone-${milestone.id}`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      milestone.isPaid ? 'bg-green-500 text-white' : isPartiallyPaid ? 'bg-amber-500 text-white' : 'bg-gray-100 border-2 border-gray-300 text-gray-500'
                    }`}>
                      {milestone.isPaid ? <CheckCircle2 className="w-5 h-5" /> : <span className="text-sm font-bold">{parseFloat(milestone.percentage).toFixed(0)}%</span>}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">{milestone.milestoneName}</h4>
                      <p className="text-sm text-gray-500">{milestone.dueDescription}</p>
                      {milestone.dueDate && !milestone.isPaid && !isPartiallyPaid && (
                        <p className="text-xs text-gray-400">Due: {format(new Date(milestone.dueDate), 'MMM d, yyyy')}</p>
                      )}
                      {milestone.isPaid && milestone.paidAt && (
                        <p className="text-xs text-green-600">Paid on {format(new Date(milestone.paidAt), 'MMM d, yyyy')}</p>
                      )}
                      {isPartiallyPaid && milestone.paidAt && (
                        <p className="text-xs text-amber-600">Partial payment on {format(new Date(milestone.paidAt), 'MMM d, yyyy')}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${milestone.isPaid ? 'text-green-600' : isPartiallyPaid ? 'text-amber-600' : 'text-gray-800'}`}>
                        ₹{milestoneAmt.toLocaleString('en-IN')}
                      </p>
                      {isPartiallyPaid && (
                        <div className="text-xs mt-0.5 space-y-0.5">
                          <p className="text-green-600">Received: ₹{paidAmt.toLocaleString('en-IN')}</p>
                          <p className="text-red-500 font-medium">Balance: ₹{balanceAmt.toLocaleString('en-IN')}</p>
                        </div>
                      )}
                    </div>
                    {milestone.isPaid ? (
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-100 text-green-700">Paid</Badge>
                        {currentUser?.role === 'superadmin' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditMilestoneDialog(milestone)}
                              data-testid={`button-edit-paid-milestone-${milestone.id}`}
                              title="Edit milestone details"
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-700 border-green-300"
                              onClick={() => {
                                setPaymentDetails({
                                  paidAmount: milestone.paidAmount || milestone.amount || '',
                                  paymentMethod: milestone.paymentMethod || 'bank_transfer',
                                  paymentReference: milestone.paymentReference || '',
                                  notes: milestone.notes || '',
                                  paidDate: milestone.paidAt ? format(new Date(milestone.paidAt), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
                                });
                                setIsEditingPayment(true);
                                setConfirmPaymentDialog({ open: true, milestone });
                              }}
                              data-testid={`button-edit-payment-${milestone.id}`}
                              title="Edit payment details"
                            >
                              <DollarSign className="w-3 h-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    ) : isPartiallyPaid ? (
                      <div className="flex items-center gap-2">
                        <Badge className="bg-amber-100 text-amber-700">Partial</Badge>
                        <Button
                          size="sm"
                          className="bg-amber-500 hover:bg-amber-600 text-white"
                          onClick={() => {
                            setPaymentDetails({ paidAmount: balanceAmt.toFixed(2), paymentMethod: 'bank_transfer', paymentReference: '', notes: '', paidDate: format(new Date(), 'yyyy-MM-dd') });
                            setIsEditingPayment(false);
                            setConfirmPaymentDialog({ open: true, milestone });
                          }}
                          data-testid={`button-add-payment-${milestone.id}`}
                        >
                          Add Payment
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditMilestoneDialog(milestone)}
                          data-testid={`button-edit-${milestone.id}`}
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          className="bg-[#4b7c29] hover:bg-[#3d6621]"
                          onClick={() => {
                            setPaymentDetails({ paidAmount: milestone.amount || '', paymentMethod: 'bank_transfer', paymentReference: '', notes: '', paidDate: format(new Date(), 'yyyy-MM-dd') });
                            setIsEditingPayment(false);
                            setConfirmPaymentDialog({ open: true, milestone });
                          }}
                          data-testid={`button-confirm-${milestone.id}`}
                        >
                          Confirm Payment
                        </Button>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed">
                <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">No Payment Milestones</h3>
                <p className="text-gray-500">Enter total amount and event date above to initialize payment milestones.</p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setFinancialDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Payment Dialog */}
      <Dialog open={confirmPaymentDialog.open} onOpenChange={(open) => {
        setConfirmPaymentDialog({ open, milestone: open ? confirmPaymentDialog.milestone : null });
        if (!open) setIsEditingPayment(false);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isEditingPayment ? 'Edit Payment' : 'Confirm Payment'}</DialogTitle>
            <DialogDescription>
              {isEditingPayment ? 'Update payment details for' : 'Record payment for'}: {confirmPaymentDialog.milestone?.milestoneName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {confirmPaymentDialog.milestone && parseFloat(confirmPaymentDialog.milestone.paidAmount || '0') > 0 && !isEditingPayment && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                <p className="font-medium text-amber-800">Previous payments recorded</p>
                <p className="text-amber-700">Already paid: ₹{parseFloat(confirmPaymentDialog.milestone.paidAmount || '0').toLocaleString('en-IN')}</p>
                <p className="text-amber-700">Milestone total: ₹{parseFloat(confirmPaymentDialog.milestone.amount || '0').toLocaleString('en-IN')}</p>
                <p className="text-amber-900 font-medium">Balance remaining: ₹{(parseFloat(confirmPaymentDialog.milestone.amount || '0') - parseFloat(confirmPaymentDialog.milestone.paidAmount || '0')).toLocaleString('en-IN')}</p>
              </div>
            )}
            <div>
              <Label>{isEditingPayment ? 'Total Amount Paid (₹)' : 'Amount Received (₹)'}</Label>
              <Input
                type="number"
                value={paymentDetails.paidAmount}
                onChange={(e) => setPaymentDetails(prev => ({ ...prev, paidAmount: e.target.value }))}
                className="mt-1"
                data-testid="input-paid-amount"
              />
              {!isEditingPayment && confirmPaymentDialog.milestone && (
                <p className="text-xs text-gray-500 mt-1">This amount will be added to any previous payments</p>
              )}
            </div>
            <div>
              <Label>Payment Date</Label>
              <Input
                type="date"
                value={paymentDetails.paidDate}
                onChange={(e) => setPaymentDetails(prev => ({ ...prev, paidDate: e.target.value }))}
                className="mt-1"
                data-testid="input-paid-date"
              />
            </div>
            <div>
              <Label>Payment Method</Label>
              <Select 
                value={paymentDetails.paymentMethod} 
                onValueChange={(val) => setPaymentDetails(prev => ({ ...prev, paymentMethod: val }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reference / Transaction ID</Label>
              <Input
                value={paymentDetails.paymentReference}
                onChange={(e) => setPaymentDetails(prev => ({ ...prev, paymentReference: e.target.value }))}
                placeholder="e.g., TXN123456"
                className="mt-1"
                data-testid="input-payment-ref"
              />
            </div>
            <div>
              <Label>Notes (Optional)</Label>
              <Input
                value={paymentDetails.notes}
                onChange={(e) => setPaymentDetails(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Any additional notes"
                className="mt-1"
                data-testid="input-payment-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setConfirmPaymentDialog({ open: false, milestone: null });
              setIsEditingPayment(false);
            }}>
              Cancel
            </Button>
            <Button
              className="bg-[#4b7c29] hover:bg-[#3d6621]"
              disabled={!paymentDetails.paidAmount || confirmPaymentMutation.isPending}
              onClick={() => {
                if (!confirmPaymentDialog.milestone) return;
                confirmPaymentMutation.mutate({ milestoneId: confirmPaymentDialog.milestone.id, data: paymentDetails, isEditMode: isEditingPayment });
              }}
              data-testid="button-confirm-payment-submit"
            >
              {confirmPaymentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {isEditingPayment ? 'Update Payment' : 'Confirm Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Milestone Dialog */}
      <Dialog open={editMilestoneDialog.open} onOpenChange={(open) => setEditMilestoneDialog({ open, milestone: editMilestoneDialog.milestone })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Payment Milestone</DialogTitle>
            <DialogDescription>
              Update milestone details: {editMilestoneDialog.milestone?.milestoneName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Milestone Name</Label>
              <Input
                value={editMilestoneData.milestoneName}
                onChange={(e) => setEditMilestoneData(prev => ({ ...prev, milestoneName: e.target.value }))}
                placeholder="e.g., Advance Payment"
                data-testid="input-edit-milestone-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Percentage (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editMilestoneData.percentage}
                  onChange={(e) => {
                    const pct = e.target.value;
                    const totalAmt = financialMilestonesAdminData?.summary?.totalAmount || 0;
                    const calculatedAmount = totalAmt > 0 && pct && !isNaN(parseFloat(pct)) ? Math.round((parseFloat(pct) / 100) * totalAmt).toString() : '';
                    setEditMilestoneData(prev => ({ ...prev, percentage: pct, amount: calculatedAmount || prev.amount }));
                  }}
                  placeholder="e.g., 15"
                  data-testid="input-edit-milestone-percentage"
                />
              </div>
              <div>
                <Label>Amount (₹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editMilestoneData.amount}
                  onChange={(e) => {
                    const amt = e.target.value;
                    const totalAmt = financialMilestonesAdminData?.summary?.totalAmount || 0;
                    const calculatedPct = totalAmt > 0 && amt && !isNaN(parseFloat(amt)) ? ((parseFloat(amt) / totalAmt) * 100).toFixed(2) : '';
                    setEditMilestoneData(prev => ({ ...prev, amount: amt, percentage: calculatedPct || prev.percentage }));
                  }}
                  placeholder="e.g., 15000"
                  data-testid="input-edit-milestone-amount"
                />
              </div>
            </div>
            <div>
              <Label>Due Date</Label>
              <Input
                type="date"
                value={editMilestoneData.dueDate}
                onChange={(e) => setEditMilestoneData(prev => ({ ...prev, dueDate: e.target.value }))}
                data-testid="input-edit-milestone-date"
              />
            </div>
            <div>
              <Label>Due Description</Label>
              <Input
                value={editMilestoneData.dueDescription}
                onChange={(e) => setEditMilestoneData(prev => ({ ...prev, dueDescription: e.target.value }))}
                placeholder="e.g., On booking confirmation"
                data-testid="input-edit-milestone-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMilestoneDialog({ open: false, milestone: null })}>
              Cancel
            </Button>
            <Button
              className="bg-[#4b7c29] hover:bg-[#3d6621]"
              disabled={editMilestoneMutation.isPending}
              onClick={() => {
                if (!editMilestoneDialog.milestone) return;
                editMilestoneMutation.mutate({ milestoneId: editMilestoneDialog.milestone.id, data: editMilestoneData });
              }}
              data-testid="button-edit-milestone-submit"
            >
              {editMilestoneMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DashboardSection({ 
  deals, 
  contacts, 
  companies, 
  activities, 
  stages, 
  targets,
  users,
  weddingPlanners,
  isSuperAdmin,
  currentUser,
  estimateValuesMap,
  onNewDeal
}: { 
  deals: SalesDeal[]; 
  contacts: SalesContact[]; 
  companies: SalesCompany[]; 
  activities: SalesActivity[];
  stages: SalesStage[];
  targets: SalesTarget[];
  users: User[];
  weddingPlanners: User[];
  isSuperAdmin: boolean;
  currentUser: User | null;
  estimateValuesMap: Record<string, { total: string; estimateNumber: string; estimateId: string }>;
  onNewDeal?: () => void;
}) {
  const isWeddingPlanner = currentUser?.role === 'wedding_planner';
  
  const filteredDeals = deals;
  
  // Filter activities for wedding planners
  const filteredActivities = useMemo(() => {
    if (isWeddingPlanner && currentUser) {
      // Get deal IDs owned by this wedding planner
      const myDealIds = new Set(filteredDeals.map(d => d.id));
      return activities.filter(a => a.dealId && myDealIds.has(a.dealId));
    }
    return activities;
  }, [activities, isWeddingPlanner, currentUser, filteredDeals]);

  const openDeals = filteredDeals.filter(d => d.status === 'open');
  const wonDeals = filteredDeals.filter(d => d.status === 'won');
  const getDealValue = (d: SalesDeal) => parseFloat(estimateValuesMap[d.id]?.total || d.value || '0');
  const totalPipelineValue = openDeals.reduce((sum, d) => sum + getDealValue(d), 0);
  const totalWonValue = wonDeals.reduce((sum, d) => sum + getDealValue(d), 0);
  const pendingActivities = filteredActivities.filter(a => a.status === 'pending');
  const currentFY = getIndianFiscalYear();

  const dealsByStage = useMemo(() => {
    const stageMap = new Map<string, { name: string; count: number; value: number; color: string; order: number }>();
    
    stages.forEach(stage => {
      const existing = stageMap.get(stage.name);
      // Use filteredDeals instead of deals for wedding planner filtering
      const stageDeals = filteredDeals.filter(d => d.stageId === stage.id);
      const count = stageDeals.length;
      const value = stageDeals.reduce((sum, d) => sum + getDealValue(d), 0);
      
      if (existing) {
        existing.count += count;
        existing.value += value;
      } else {
        stageMap.set(stage.name, {
          name: stage.name,
          count,
          value,
          color: stage.color,
          order: stage.order
        });
      }
    });
    
    return Array.from(stageMap.values()).sort((a, b) => a.order - b.order);
  }, [stages, filteredDeals, estimateValuesMap]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{isWeddingPlanner ? 'My Dashboard' : 'Dashboard'}</h1>
          <p className="text-muted-foreground">{currentFY} Overview{isWeddingPlanner ? ` - ${currentUser?.name}` : ''}</p>
        </div>
        <Button data-testid="button-new-deal" onClick={onNewDeal}>
          <Plus className="w-4 h-4 mr-2" />
          New Deal
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-3 sm:pt-6 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="p-2 sm:p-3 bg-blue-100 rounded-lg">
                <Target className="w-4 h-4 sm:w-6 sm:h-6 text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">{isWeddingPlanner ? 'My Open Deals' : 'Open Deals'}</p>
                <p className="text-lg sm:text-2xl font-bold truncate">{openDeals.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:pt-6 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="p-2 sm:p-3 bg-green-100 rounded-lg shrink-0">
                <DollarSign className="w-4 h-4 sm:w-6 sm:h-6 text-green-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">{isWeddingPlanner ? 'My Pipeline' : 'Pipeline'}</p>
                <p className="text-lg sm:text-2xl font-bold truncate">{formatCurrency(totalPipelineValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:pt-6 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="p-2 sm:p-3 bg-primary/10 rounded-lg shrink-0">
                <TrendingUp className="w-4 h-4 sm:w-6 sm:h-6 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">{isWeddingPlanner ? 'My Won Value' : 'Won Value'}</p>
                <p className="text-lg sm:text-2xl font-bold truncate">{formatCurrency(totalWonValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:pt-6 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="p-2 sm:p-3 bg-purple-100 rounded-lg shrink-0">
                <Clock className="w-4 h-4 sm:w-6 sm:h-6 text-purple-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">{isWeddingPlanner ? 'My Tasks' : 'Tasks'}</p>
                <p className="text-lg sm:text-2xl font-bold truncate">{pendingActivities.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{isWeddingPlanner ? 'My Deals by Stage' : 'Deals by Stage'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dealsByStage.map((stage, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: stage.color || '#6B7280' }}
                  />
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">{stage.name}</span>
                      <span className="text-sm text-muted-foreground">{stage.count} deals</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all"
                        style={{ 
                          width: `${Math.min(100, (stage.count / Math.max(filteredDeals.length, 1)) * 100)}%`,
                          backgroundColor: stage.color || '#6B7280'
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-medium w-24 text-right">
                    {formatCurrency(stage.value)}
                  </span>
                </div>
              ))}
              {dealsByStage.length === 0 && (
                <p className="text-center text-muted-foreground py-4">No stages configured</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{isWeddingPlanner ? 'My Leads Analytics' : 'Leads Analytics'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Leads by Source */}
              <div>
                <h4 className="text-sm font-medium mb-2">By Source</h4>
                <div className="grid grid-cols-3 gap-2">
                  {['Direct', 'Reference', 'SMM'].map(source => {
                    const count = filteredDeals.filter(d => (d as any).leadSource === source).length;
                    return (
                      <div key={source} className="p-2 bg-muted/50 rounded-lg text-center">
                        <p className="text-lg font-bold">{count}</p>
                        <p className="text-xs text-muted-foreground">{source}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Leads by Wedding Planner - only for superadmin */}
              {isSuperAdmin && weddingPlanners.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">By Planner</h4>
                  <div className="space-y-2">
                    {weddingPlanners.map(planner => {
                      const count = filteredDeals.filter(d => d.ownerId === planner.id).length;
                      const total = filteredDeals.length || 1;
                      return (
                        <div key={planner.id} className="flex items-center gap-2">
                          <div className="flex-1">
                            <div className="flex justify-between text-xs mb-1">
                              <span>{planner.name}</span>
                              <span>{count} leads</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${(count / total) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* This Month's Leads */}
              <div>
                <h4 className="text-sm font-medium mb-2">This Month</h4>
                <div className="grid grid-cols-2 gap-2">
                  {(() => {
                    const now = new Date();
                    const thisMonth = filteredDeals.filter(d => {
                      const created = new Date(d.createdAt);
                      return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
                    });
                    const lastMonth = filteredDeals.filter(d => {
                      const created = new Date(d.createdAt);
                      const lastM = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                      return created.getMonth() === lastM.getMonth() && created.getFullYear() === lastM.getFullYear();
                    });
                    return (
                      <>
                        <div className="p-2 bg-primary/10 rounded-lg text-center">
                          <p className="text-lg font-bold text-primary">{thisMonth.length}</p>
                          <p className="text-xs text-muted-foreground">This Month</p>
                        </div>
                        <div className="p-2 bg-muted/50 rounded-lg text-center">
                          <p className="text-lg font-bold">{lastMonth.length}</p>
                          <p className="text-xs text-muted-foreground">Last Month</p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Wedding Planner Monthly Target vs Actual (Super Admin only) */}
      {isSuperAdmin && weddingPlanners.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Monthly Sales Performance</CardTitle>
            <CardDescription>Target vs Actual (confirmed bookings by event date)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {weddingPlanners.map(planner => {
                const currentMonth = new Date().getMonth();
                const currentYear = new Date().getFullYear();
                const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                const currentMonthName = monthNames[currentMonth];
                
                const monthTarget = targets.find(t => 
                  t.userId === planner.id && 
                  t.fiscalYear === currentFY && 
                  t.month === currentMonthName
                );
                
                const plannerDealsThisMonth = deals.filter(d => {
                  if (d.ownerId !== planner.id) return false;
                  if (!d.eventDate) return false;
                  if (!d.advancePaymentReceived) return false;
                  const eventDate = new Date(d.eventDate);
                  return eventDate.getMonth() === currentMonth && eventDate.getFullYear() === currentYear;
                });
                
                const actual = plannerDealsThisMonth.reduce((sum, d) => sum + parseFloat(d.value || '0'), 0);
                const targetAmount = monthTarget ? parseFloat(monthTarget.targetAmount) : 0;
                const progress = targetAmount > 0 ? (actual / targetAmount) * 100 : 0;
                const isAchieved = actual >= targetAmount && targetAmount > 0;
                const eventCount = plannerDealsThisMonth.length;

                return (
                  <div key={planner.id} className="p-4 border rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <span className="font-medium">{planner.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">({eventCount} events in {currentMonthName})</span>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold ${isAchieved ? 'text-green-600' : targetAmount > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                            {formatCurrency(actual)}
                          </span>
                          <span className="text-muted-foreground">/</span>
                          <span className="text-sm text-muted-foreground">
                            {targetAmount > 0 ? formatCurrency(targetAmount) : 'No target'}
                          </span>
                          {isAchieved && <TrendingUp className="w-4 h-4 text-green-600" />}
                        </div>
                      </div>
                    </div>
                    {targetAmount > 0 && (
                      <>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${isAchieved ? 'bg-green-500' : 'bg-amber-500'}`}
                            style={{ width: `${Math.min(100, progress)}%` }}
                          />
                        </div>
                        <p className={`text-xs mt-1 ${isAchieved ? 'text-green-600' : 'text-amber-600'}`}>
                          {progress.toFixed(0)}% {isAchieved ? '- Target Achieved!' : 'of target'}
                        </p>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Wedding Planner's Own Performance (for wedding planners only) */}
      {!isSuperAdmin && currentUser && currentUser.role === 'wedding_planner' && (
        <Card>
          <CardHeader>
            <CardTitle>My Monthly Performance</CardTitle>
            <CardDescription>Target vs Actual (confirmed bookings by event date)</CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              const currentMonth = new Date().getMonth();
              const currentYear = new Date().getFullYear();
              const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
              const currentMonthName = monthNames[currentMonth];
              
              const myTarget = targets.find(t => 
                t.userId === currentUser.id && 
                t.fiscalYear === currentFY && 
                t.month === currentMonthName
              );
              
              const myDealsThisMonth = deals.filter(d => {
                if (d.ownerId !== currentUser.id) return false;
                if (!d.eventDate) return false;
                if (!d.advancePaymentReceived) return false;
                const eventDate = new Date(d.eventDate);
                return eventDate.getMonth() === currentMonth && eventDate.getFullYear() === currentYear;
              });
              
              const actual = myDealsThisMonth.reduce((sum, d) => sum + parseFloat(d.value || '0'), 0);
              const targetAmount = myTarget ? parseFloat(myTarget.targetAmount) : 0;
              const progress = targetAmount > 0 ? (actual / targetAmount) * 100 : 0;
              const isAchieved = actual >= targetAmount && targetAmount > 0;
              const eventCount = myDealsThisMonth.length;

              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold">{currentMonthName}</p>
                      <p className="text-sm text-muted-foreground">{eventCount} events booked</p>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${isAchieved ? 'text-green-600' : targetAmount > 0 ? 'text-amber-600' : 'text-primary'}`}>
                        {formatCurrency(actual)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {targetAmount > 0 ? `Target: ${formatCurrency(targetAmount)}` : 'No target set'}
                      </p>
                    </div>
                  </div>
                  
                  {targetAmount > 0 && (
                    <>
                      <div className="h-4 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${isAchieved ? 'bg-green-500' : 'bg-amber-500'}`}
                          style={{ width: `${Math.min(100, progress)}%` }}
                        />
                      </div>
                      <div className={`text-center font-medium ${isAchieved ? 'text-green-600' : 'text-amber-600'}`}>
                        {progress.toFixed(0)}% {isAchieved ? '- Target Achieved!' : 'of target achieved'}
                      </div>
                    </>
                  )}
                  
                  {isAchieved && (
                    <div className="flex items-center justify-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                      <TrendingUp className="w-5 h-5 text-green-600" />
                      <span className="text-green-700 font-medium">Great job! You've exceeded your target!</span>
                    </div>
                  )}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PipelineSection({
  pipelines,
  stages,
  deals,
  contacts,
  companies,
  selectedPipelineId,
  setSelectedPipelineId,
  searchQuery,
  setSearchQuery,
  isSuperAdmin,
  autoOpenNewDeal,
  onAutoOpenNewDealHandled,
  weddingPlanners: wpList,
  estimateValuesMap,
}: {
  pipelines: SalesPipeline[];
  stages: SalesStage[];
  deals: SalesDeal[];
  contacts: SalesContact[];
  companies: SalesCompany[];
  selectedPipelineId: string | null;
  setSelectedPipelineId: (id: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isSuperAdmin: boolean;
  autoOpenNewDeal?: boolean;
  onAutoOpenNewDealHandled?: () => void;
  weddingPlanners: User[];
  estimateValuesMap: Record<string, { total: string; estimateNumber: string; estimateId: string }>;
}) {
  const getDealValue = (d: SalesDeal) => parseFloat(estimateValuesMap[d.id]?.total || d.value || '0');
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [selectedOwnerId, setSelectedOwnerId] = useState('');

  useEffect(() => {
    if (autoOpenNewDeal) {
      setIsAddLeadOpen(true);
      onAutoOpenNewDealHandled?.();
    }
  }, [autoOpenNewDeal, onAutoOpenNewDealHandled]);
  const [isAddPipelineOpen, setIsAddPipelineOpen] = useState(false);
  const [isEditPipelineOpen, setIsEditPipelineOpen] = useState(false);
  const [isDeletePipelineOpen, setIsDeletePipelineOpen] = useState(false);
  const [editPipelineName, setEditPipelineName] = useState('');
  const [selectedDeal, setSelectedDeal] = useState<SalesDeal | null>(null);
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
  const [advancePaymentConfirm, setAdvancePaymentConfirm] = useState<{ dealId: string; stageId: string; dealTitle: string } | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<{ startDate: string; endDate: string }>({ startDate: '', endDate: '' });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const selectedPipeline = pipelines.find(p => p.id === selectedPipelineId);
  
  const createPipelineMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      return apiRequest('POST', '/api/sales/pipelines', data);
    },
    onSuccess: (newPipeline: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales/pipelines'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sales/stages'] });
      setIsAddPipelineOpen(false);
      setSelectedPipelineId(newPipeline.id);
      toast({ title: 'Pipeline created with default stages' });
    },
  });
  
  const updatePipelineMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      return apiRequest('PATCH', `/api/sales/pipelines/${id}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales/pipelines'] });
      setIsEditPipelineOpen(false);
      toast({ title: 'Pipeline updated successfully' });
    },
  });
  
  const deletePipelineMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/sales/pipelines/${id}`);
    },
    onSuccess: (_data, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales/pipelines'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sales/stages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sales/deals'] });
      setIsDeletePipelineOpen(false);
      const remainingPipelines = pipelines.filter(p => p.id !== deletedId);
      setSelectedPipelineId(remainingPipelines[0]?.id || '');
      toast({ title: 'Pipeline deleted successfully' });
    },
  });
  
  const handleAddPipeline = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createPipelineMutation.mutate({
      name: formData.get('name') as string,
    });
  };
  
  const handleEditPipeline = () => {
    if (selectedPipelineId && editPipelineName.trim()) {
      updatePipelineMutation.mutate({ id: selectedPipelineId, name: editPipelineName.trim() });
    }
  };
  
  const handleDeletePipeline = () => {
    if (selectedPipelineId) {
      deletePipelineMutation.mutate(selectedPipelineId);
    }
  };
  
  const openEditDialog = () => {
    setEditPipelineName(selectedPipeline?.name || '');
    setIsEditPipelineOpen(true);
  };

  const pipelineStages = stages
    .filter(s => s.pipelineId === selectedPipelineId)
    .sort((a, b) => a.order - b.order);

  const filteredDeals = deals.filter(d => {
    if (d.pipelineId !== selectedPipelineId) return false;
    if (searchQuery && !d.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (dateFilter.startDate || dateFilter.endDate) {
      const createdDate = d.createdAt ? new Date(d.createdAt) : null;
      if (!createdDate) return false;
      if (dateFilter.startDate) {
        const startDate = new Date(dateFilter.startDate);
        startDate.setHours(0, 0, 0, 0);
        if (createdDate < startDate) return false;
      }
      if (dateFilter.endDate) {
        const endDate = new Date(dateFilter.endDate);
        endDate.setHours(23, 59, 59, 999);
        if (createdDate > endDate) return false;
      }
    }
    return true;
  });
  
  const hasActiveFilters = dateFilter.startDate || dateFilter.endDate;
  
  const clearFilters = () => {
    setDateFilter({ startDate: '', endDate: '' });
    setFilterOpen(false);
  };

  const updateDealMutation = useMutation({
    mutationFn: async ({ id, stageId }: { id: string; stageId: string }) => {
      const response = await fetch(`/api/sales/deals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ stageId }),
      });
      if (!response.ok) {
        throw new Error(`Failed to update deal: ${response.status}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales/deals'] });
    },
    onError: (error) => {
      toast({ title: 'Failed to move deal', description: String(error), variant: 'destructive' });
    },
  });

  const createDealMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/sales/deals', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales/deals'] });
      setIsAddLeadOpen(false);
      toast({ title: 'Lead created successfully' });
    },
  });

  const handleDragStart = (e: React.DragEvent, dealId: string) => {
    setDraggedDealId(dealId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    if (draggedDealId) {
      // Check if target stage is "Advance Received" 
      const targetStage = stages.find(s => s.id === stageId);
      const stageName = targetStage?.name?.toLowerCase() || '';
      const isAdvanceReceivedStage = stageName.includes('advance received') || stageName.includes('advance payment');
      
      // Check if deal is already in advance received state
      const currentDeal = deals.find(d => d.id === draggedDealId);
      const alreadyAdvanceReceived = currentDeal?.advancePaymentReceived === true;
      
      if (isAdvanceReceivedStage && !alreadyAdvanceReceived) {
        // Show confirmation popup
        setAdvancePaymentConfirm({
          dealId: draggedDealId,
          stageId,
          dealTitle: currentDeal?.title || 'This lead'
        });
        setDraggedDealId(null);
      } else {
        updateDealMutation.mutate({ id: draggedDealId, stageId });
        setDraggedDealId(null);
      }
    }
  };

  const handleConfirmAdvancePayment = () => {
    if (advancePaymentConfirm) {
      updateDealMutation.mutate(
        { 
          id: advancePaymentConfirm.dealId, 
          stageId: advancePaymentConfirm.stageId 
        },
        {
          onSuccess: () => {
            toast({ 
              title: 'Advance Payment Marked as Received',
              description: 'Accountant has been notified to create the customer record.'
            });
          }
        }
      );
      setAdvancePaymentConfirm(null);
    }
  };

  const handleAddLead = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const firstStage = pipelineStages[0];
    if (!firstStage || !selectedPipelineId) return;

    const phone = formData.get('phone') as string;
    if (!phone) {
      alert('Contact Number is required');
      return;
    }
    
    createDealMutation.mutate({
      title: formData.get('title'),
      phone: phone,
      value: formData.get('value') || '0',
      pipelineId: selectedPipelineId,
      stageId: firstStage.id,
      contactId: null,
      companyId: formData.get('companyId') || null,
      eventType: formData.get('eventType') || null,
      expectedCloseDate: formData.get('expectedCloseDate') || null,
      address: formData.get('address') || null,
      notes: formData.get('notes') || null,
      leadSource: formData.get('leadSource') || null,
      ownerId: selectedOwnerId || null,
    });
    setSelectedOwnerId('');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header - fixed height */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 sm:p-6 pb-2">
        <div className="flex items-center justify-between sm:block">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Leads Pipeline</h1>
            <p className="text-sm text-muted-foreground">Manage your sales pipeline</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedPipelineId || ''} onValueChange={setSelectedPipelineId}>
            <SelectTrigger className="w-[200px]" data-testid="select-pipeline">
              <SelectValue placeholder="Select Pipeline" />
            </SelectTrigger>
            <SelectContent>
              {pipelines.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isSuperAdmin && selectedPipelineId && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="button-pipeline-menu">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={openEditDialog} data-testid="menu-edit-pipeline">
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Pipeline
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setIsDeletePipelineOpen(true)} 
                  className="text-destructive"
                  data-testid="menu-delete-pipeline"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Pipeline
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Dialog open={isEditPipelineOpen} onOpenChange={setIsEditPipelineOpen}>
            <DialogContent className="max-w-[95vw] sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Pipeline</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-pipeline-name">Pipeline Name *</Label>
                  <Input 
                    id="edit-pipeline-name" 
                    value={editPipelineName} 
                    onChange={(e) => setEditPipelineName(e.target.value)}
                    placeholder="Enter pipeline name" 
                    data-testid="input-edit-pipeline-name" 
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsEditPipelineOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleEditPipeline} data-testid="button-save-pipeline">
                    Save Changes
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={isDeletePipelineOpen} onOpenChange={setIsDeletePipelineOpen}>
            <DialogContent className="max-w-[95vw] sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Delete Pipeline</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  Are you sure you want to delete "{selectedPipeline?.name}"? This will also delete all stages and leads in this pipeline. This action cannot be undone.
                </p>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDeletePipelineOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={handleDeletePipeline} data-testid="button-confirm-delete-pipeline">
                    Delete Pipeline
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          {/* Advance Payment Confirmation Dialog */}
          <Dialog open={!!advancePaymentConfirm} onOpenChange={(open) => !open && setAdvancePaymentConfirm(null)}>
            <DialogContent className="max-w-[95vw] sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Confirm Advance Payment Received
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <p className="text-sm font-medium mb-2">You are marking advance payment as received for:</p>
                  <p className="text-lg font-semibold text-primary">{advancePaymentConfirm?.dealTitle}</p>
                </div>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>• The accountant will be notified to create a customer record</p>
                  <p>• This action will update the lead status</p>
                  <p>• Customer creation requires additional details from the accountant</p>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setAdvancePaymentConfirm(null)}>
                    Cancel
                  </Button>
                  <Button onClick={handleConfirmAdvancePayment} data-testid="button-confirm-advance-payment">
                    Confirm Payment Received
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={isAddPipelineOpen} onOpenChange={setIsAddPipelineOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-new-pipeline">
                <Plus className="w-4 h-4 mr-2" />
                New Pipeline
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Pipeline</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddPipeline} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pipeline-name">Pipeline Name *</Label>
                  <Input id="pipeline-name" name="name" required placeholder="e.g., Wedding Events" data-testid="input-pipeline-name" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Default stages will be created: Lead, Awaiting Response, Contacted, Prospective, Proposal, Negotiation, Advance Received, Closed Won, Closed Lost
                </p>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsAddPipelineOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" data-testid="button-create-pipeline">
                    Create Pipeline
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          <Dialog open={isAddLeadOpen} onOpenChange={setIsAddLeadOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-lead">
                <Plus className="w-4 h-4 mr-2" />
                Add Lead
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Add New Lead</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddLead} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Lead Title *</Label>
                  <Input id="title" name="title" required data-testid="input-lead-title" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="value">Value (₹)</Label>
                    <Input id="value" name="value" type="number" data-testid="input-deal-value" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="eventType">Event Type</Label>
                    <Select name="eventType">
                      <SelectTrigger data-testid="select-event-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="wedding">Wedding</SelectItem>
                        <SelectItem value="corporate">Corporate</SelectItem>
                        <SelectItem value="birthday">Birthday</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Contact Number *</Label>
                    <Input id="phone" name="phone" type="tel" required placeholder="+91 9876543210" data-testid="input-lead-phone" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyId">Company</Label>
                    <Select name="companyId">
                      <SelectTrigger data-testid="select-company">
                        <SelectValue placeholder="Select company" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="expectedCloseDate">Expected Close Date</Label>
                    <Input id="expectedCloseDate" name="expectedCloseDate" type="date" data-testid="input-expected-close" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="leadSource">Lead Source *</Label>
                    <Select name="leadSource" required>
                      <SelectTrigger data-testid="select-lead-source">
                        <SelectValue placeholder="Select source" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Direct">Direct</SelectItem>
                        <SelectItem value="Reference">Reference</SelectItem>
                        <SelectItem value="SMM">SMM</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Assign Wedding Planner</Label>
                  <Select value={selectedOwnerId} onValueChange={setSelectedOwnerId}>
                    <SelectTrigger data-testid="select-lead-planner">
                      <SelectValue placeholder="Select planner" />
                    </SelectTrigger>
                    <SelectContent>
                      {wpList.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea id="address" name="address" placeholder="Enter billing/event address" data-testid="input-deal-address" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" name="notes" data-testid="input-deal-notes" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsAddLeadOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" data-testid="button-save-lead">
                    Create Lead
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search - fixed height */}
      <div className="flex items-center gap-4 px-4 sm:px-6 py-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search deals..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-deals"
          />
        </div>
        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className={hasActiveFilters ? 'border-primary bg-primary/5' : ''} data-testid="button-filter">
              <Filter className="w-4 h-4" />
              {hasActiveFilters && <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72" align="end">
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-sm mb-2">Filter by Received Date</h4>
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs">From</Label>
                    <Input
                      type="date"
                      value={dateFilter.startDate}
                      onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
                      className="text-sm"
                      data-testid="input-filter-start-date"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">To</Label>
                    <Input
                      type="date"
                      value={dateFilter.endDate}
                      onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
                      className="text-sm"
                      data-testid="input-filter-end-date"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-between">
                <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
                  Clear
                </Button>
                <Button size="sm" onClick={() => setFilterOpen(false)} data-testid="button-apply-filters">
                  Apply
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Kanban Board - compact view with sticky headers */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden px-4 sm:px-6">
        <div className="flex gap-2 h-full pb-2">
          {pipelineStages.map(stage => {
            const stageDeals = filteredDeals.filter(d => d.stageId === stage.id);
            const stageValue = stageDeals.reduce((sum, d) => sum + getDealValue(d), 0);

            return (
              <div
                key={stage.id}
                className="w-48 lg:w-56 flex-shrink-0 flex flex-col h-full"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage.id)}
              >
                {/* Sticky stage header */}
                <div className="bg-card rounded-t-md border border-b-0 sticky top-0 z-10">
                  <div className="flex items-center gap-1.5 px-2 py-1.5">
                    <div 
                      className="w-2 h-2 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: stage.color || '#6B7280' }}
                    />
                    <h3 className="font-medium text-xs text-foreground truncate">{stage.name}</h3>
                    <span className="text-[10px] text-muted-foreground bg-muted px-1 py-0.5 rounded ml-auto flex-shrink-0">
                      {stageDeals.length}
                    </span>
                  </div>
                  <div className="px-2 pb-1.5 text-[10px] text-muted-foreground">
                    {formatCurrency(stageValue)}
                  </div>
                </div>
                
                {/* Scrollable deals area */}
                <div className="flex-1 bg-muted/20 border border-t-0 rounded-b-md overflow-y-auto min-h-0">
                  <div className="p-1.5 space-y-1.5">
                    {stageDeals.map(deal => {
                      const contact = contacts.find(c => c.id === deal.contactId);
                      return (
                        <div
                          key={deal.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, deal.id)}
                          onClick={() => setSelectedDeal(deal)}
                          className="bg-white px-2 py-1.5 rounded border border-border cursor-move hover:shadow-sm transition-shadow group"
                          data-testid={`deal-card-${deal.id}`}
                        >
                          <div className="flex items-center gap-1">
                            <GripVertical className="w-3 h-3 text-muted-foreground/30 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <h4 className="font-medium text-xs text-foreground truncate flex-1">{deal.title}</h4>
                            {deal.createdAt && (() => {
                              const days = differenceInDays(new Date(), new Date(deal.createdAt));
                              const color = days <= 7 ? 'bg-green-100 text-green-700' : days <= 30 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
                              return (
                                <span className={`text-[8px] px-1 py-0.5 rounded font-medium flex-shrink-0 ${color}`} data-testid={`deal-aging-${deal.id}`}>
                                  {days}d
                                </span>
                              );
                            })()}
                          </div>
                          <div className="flex items-center justify-between mt-0.5">
                            <p className="text-primary font-semibold text-xs">
                              {estimateValuesMap[deal.id]
                                ? formatCurrency(estimateValuesMap[deal.id].total)
                                : formatCurrency(deal.value)}
                            </p>
                            {deal.eventType && (
                              <span className="text-[9px] px-1 py-0.5 bg-muted rounded text-muted-foreground">
                                {deal.eventType}
                              </span>
                            )}
                          </div>
                          {estimateValuesMap[deal.id] && (
                            <p className="text-[9px] text-muted-foreground mt-0.5">
                              Est: {estimateValuesMap[deal.id].estimateNumber}
                            </p>
                          )}
                          {(contact || deal.phone) && (
                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate flex items-center gap-1">
                              {contact?.firstName || ''}
                              {(contact?.phone || deal.phone) && (
                                <a
                                  href={`tel:${contact?.phone || deal.phone}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center gap-0.5 text-primary hover:underline"
                                >
                                  <Phone className="w-2.5 h-2.5" />
                                  {contact?.phone || deal.phone}
                                </a>
                              )}
                            </p>
                          )}
                        </div>
                      );
                    })}
                    {stageDeals.length === 0 && (
                      <div className="text-center py-4 text-muted-foreground text-[10px]">
                        No deals in this stage
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {pipelineStages.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p>No stages configured for this pipeline.</p>
              <p className="text-sm">Go to Pipeline Setup to add stages.</p>
            </div>
          )}
        </div>
      </div>

      {/* Deal Detail Panel */}
      {selectedDeal && (
        <DealDetailPanel
          deal={selectedDeal}
          contacts={contacts}
          companies={companies}
          stages={pipelineStages}
          onClose={() => setSelectedDeal(null)}
          estimateValuesMap={estimateValuesMap}
          weddingPlanners={wpList}
        />
      )}
    </div>
  );
}

function DealDetailPanel({
  deal,
  contacts,
  companies,
  stages,
  onClose,
  estimateValuesMap,
  weddingPlanners,
}: {
  deal: SalesDeal;
  contacts: SalesContact[];
  companies: SalesCompany[];
  stages: SalesStage[];
  onClose: () => void;
  estimateValuesMap: Record<string, { total: string; estimateNumber: string; estimateId: string }>;
  weddingPlanners: User[];
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isCallLogOpen, setIsCallLogOpen] = useState(false);
  const [isOpenWithDialogOpen, setIsOpenWithDialogOpen] = useState(false);
  const [phoneToCall, setPhoneToCall] = useState('');
  const [showCallHistory, setShowCallHistory] = useState(false);
  const [callOutcome, setCallOutcome] = useState('connected');
  const [callNotes, setCallNotes] = useState('');
  const [callDuration, setCallDuration] = useState('0');
  const [editForm, setEditForm] = useState({
    title: deal.title,
    value: deal.value?.toString() || '0',
    phone: (deal as any).phone || '',
    whatsapp: (deal as any).whatsapp || '',
    eventType: deal.eventType || '',
    eventDate: deal.eventDate || '',
    expectedCloseDate: deal.expectedCloseDate || '',
    venue: deal.venue || '',
    address: (deal as any).address || '',
    leadSource: (deal as any).leadSource || '',
    companyId: deal.companyId || '',
    ownerId: deal.ownerId || '',
    notes: deal.notes || '',
    status: deal.status || 'open',
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch call logs for this deal
  const { data: dealActivities = [] } = useQuery<SalesActivity[]>({
    queryKey: ['/api/sales/activities'],
  });
  
  const callLogs = dealActivities.filter(a => a.dealId === deal.id && a.type === 'call');

  const contact = contacts.find(c => c.id === deal.contactId);
  const company = companies.find(c => c.id === deal.companyId);
  
  const contactedStage = stages.find(s => 
    s.name.toLowerCase().includes('contacted') && s.pipelineId === deal.pipelineId
  );

  const updateDealMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('PATCH', `/api/sales/deals/${deal.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales/deals'] });
      setIsEditing(false);
      toast({ title: 'Deal updated successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to update deal', variant: 'destructive' });
    },
  });

  const deleteDealMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('DELETE', `/api/sales/deals/${deal.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales/deals'] });
      onClose();
      toast({ title: 'Deal deleted successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to delete deal', variant: 'destructive' });
    },
  });

  const { user: currentLoggedUser } = useAuth();
  
  const logCallMutation = useMutation({
    mutationFn: async (data: { outcome: string; notes: string; duration: string; moveToContacted: boolean }) => {
      const durationText = data.duration && data.duration !== '0' ? ` Duration: ${data.duration} min.` : '';
      const activity = await apiRequest('POST', '/api/sales/activities', {
        type: 'call',
        subject: `Call - ${data.outcome}${durationText}`,
        description: data.notes || `Called ${contact?.firstName || 'contact'}. Outcome: ${data.outcome}.${durationText}`,
        dealId: deal.id,
        contactId: deal.contactId,
        ownerId: currentLoggedUser?.id || deal.ownerId,
        status: 'completed',
        priority: 'medium',
      });
      
      if (data.moveToContacted && contactedStage) {
        await apiRequest('PATCH', `/api/sales/deals/${deal.id}`, { stageId: contactedStage.id });
      }
      
      return activity;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales/deals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sales/activities'] });
      setIsCallLogOpen(false);
      setCallOutcome('connected');
      setCallNotes('');
      setCallDuration('0');
      toast({ title: 'Call logged successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to log call', variant: 'destructive' });
    },
  });

  const handleMakeCall = (phoneNumber: string) => {
    if (!phoneNumber) return;
    setPhoneToCall(phoneNumber);
    setIsOpenWithDialogOpen(true);
  };

  const handleOpenWithPhone = () => {
    if (!phoneToCall) return;
    window.open(`tel:${phoneToCall}`, '_self');
    setIsOpenWithDialogOpen(false);
    setIsCallLogOpen(true);
  };

  const handleOpenWithWhatsApp = () => {
    if (!phoneToCall) return;
    // Format phone number for WhatsApp (remove spaces, dashes, and leading +)
    let formattedPhone = phoneToCall.replace(/[\s\-\(\)]/g, '');
    // If it starts with 0, replace with country code (assuming India +91)
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '91' + formattedPhone.substring(1);
    }
    // Remove leading + if present
    if (formattedPhone.startsWith('+')) {
      formattedPhone = formattedPhone.substring(1);
    }
    // If no country code, assume India (+91)
    if (formattedPhone.length === 10) {
      formattedPhone = '91' + formattedPhone;
    }
    window.open(`https://wa.me/${formattedPhone}`, '_blank');
    setIsOpenWithDialogOpen(false);
    setIsCallLogOpen(true);
  };

  const handleLogCall = () => {
    const currentStage = stages.find(s => s.id === deal.stageId && s.pipelineId === deal.pipelineId);
    const currentStageOrder = currentStage?.order ?? 0;
    const contactedStageOrder = contactedStage?.order ?? 999;
    const isAlreadyPastContacted = currentStageOrder >= contactedStageOrder;
    
    logCallMutation.mutate({
      outcome: callOutcome,
      notes: callNotes,
      duration: callDuration,
      moveToContacted: !isAlreadyPastContacted && callOutcome === 'connected' && !!contactedStage,
    });
  };

  const handleSave = () => {
    updateDealMutation.mutate({
      title: editForm.title,
      value: parseFloat(editForm.value) || 0,
      phone: editForm.phone || null,
      whatsapp: editForm.whatsapp || null,
      eventType: editForm.eventType || null,
      eventDate: editForm.eventDate || null,
      expectedCloseDate: editForm.expectedCloseDate || null,
      venue: editForm.venue || null,
      address: editForm.address || null,
      leadSource: editForm.leadSource || null,
      companyId: editForm.companyId || null,
      ownerId: editForm.ownerId || null,
      notes: editForm.notes || null,
      status: editForm.status,
    });
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this lead?')) {
      deleteDealMutation.mutate();
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-card border-l shadow-xl z-50">
      <div className="h-full flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">{isEditing ? 'Edit Deal' : 'Deal Details'}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1 p-4">
          {isEditing ? (
            <div className="space-y-4">
              <div>
                <Label>Lead Title *</Label>
                <Input
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  data-testid="input-deal-title"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Value (₹)</Label>
                  <Input
                    type="number"
                    value={editForm.value}
                    onChange={(e) => setEditForm({ ...editForm, value: e.target.value })}
                    data-testid="input-deal-value"
                  />
                </div>
                <div>
                  <Label>Event Type</Label>
                  <Select
                    value={editForm.eventType}
                    onValueChange={(value) => setEditForm({ ...editForm, eventType: value })}
                  >
                    <SelectTrigger data-testid="select-deal-event-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wedding">Wedding</SelectItem>
                      <SelectItem value="corporate">Corporate</SelectItem>
                      <SelectItem value="birthday">Birthday</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Contact Number</Label>
                  <Input
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder="+91 9876543210"
                    data-testid="input-deal-phone"
                  />
                </div>
                <div>
                  <Label>WhatsApp Number</Label>
                  <Input
                    value={editForm.whatsapp}
                    onChange={(e) => setEditForm({ ...editForm, whatsapp: e.target.value })}
                    placeholder="+91 9876543210"
                    data-testid="input-deal-whatsapp"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Event Date</Label>
                  <Input
                    type="date"
                    value={editForm.eventDate}
                    onChange={(e) => setEditForm({ ...editForm, eventDate: e.target.value })}
                    data-testid="input-deal-event-date"
                  />
                </div>
                <div>
                  <Label>Expected Close Date</Label>
                  <Input
                    type="date"
                    value={editForm.expectedCloseDate}
                    onChange={(e) => setEditForm({ ...editForm, expectedCloseDate: e.target.value })}
                    data-testid="input-deal-expected-close"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Lead Source</Label>
                  <Select
                    value={editForm.leadSource}
                    onValueChange={(value) => setEditForm({ ...editForm, leadSource: value })}
                  >
                    <SelectTrigger data-testid="select-deal-lead-source">
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Direct">Direct</SelectItem>
                      <SelectItem value="Reference">Reference</SelectItem>
                      <SelectItem value="SMM">SMM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Company</Label>
                  <Select
                    value={editForm.companyId}
                    onValueChange={(value) => setEditForm({ ...editForm, companyId: value })}
                  >
                    <SelectTrigger data-testid="select-deal-company">
                      <SelectValue placeholder="Select company" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Venue</Label>
                <Input
                  value={editForm.venue}
                  onChange={(e) => setEditForm({ ...editForm, venue: e.target.value })}
                  data-testid="input-deal-venue"
                />
              </div>
              <div>
                <Label>Assign Wedding Planner</Label>
                <Select
                  value={editForm.ownerId}
                  onValueChange={(value) => setEditForm({ ...editForm, ownerId: value })}
                >
                  <SelectTrigger data-testid="select-deal-planner">
                    <SelectValue placeholder="Select planner" />
                  </SelectTrigger>
                  <SelectContent>
                    {weddingPlanners.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Address</Label>
                <Textarea
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  placeholder="Enter billing/event address"
                  rows={2}
                  data-testid="input-deal-address"
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(value) => setEditForm({ ...editForm, status: value })}
                >
                  <SelectTrigger data-testid="select-deal-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="won">Won</SelectItem>
                    <SelectItem value="lost">Lost</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  rows={3}
                  data-testid="input-deal-notes"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold">{deal.title}</h3>
                <p className="text-2xl font-bold text-primary mt-1">
                  {estimateValuesMap[deal.id]
                    ? formatCurrency(estimateValuesMap[deal.id].total)
                    : formatCurrency(deal.value)}
                </p>
                {estimateValuesMap[deal.id] && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    From Estimate: {estimateValuesMap[deal.id].estimateNumber}
                  </p>
                )}
              </div>

              <Separator />

              <div className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge className="mt-1">{deal.status}</Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Event Type</Label>
                  <p className="font-medium">{deal.eventType || 'Not specified'}</p>
                </div>
                {deal.eventDate && (
                  <div>
                    <Label className="text-muted-foreground">Event Date</Label>
                    <p className="font-medium">{format(new Date(deal.eventDate), 'MMM d, yyyy')}</p>
                  </div>
                )}
                {deal.venue && (
                  <div>
                    <Label className="text-muted-foreground">Venue</Label>
                    <p className="font-medium">{deal.venue}</p>
                  </div>
                )}
                {deal.expectedCloseDate && (
                  <div>
                    <Label className="text-muted-foreground">Expected Close Date</Label>
                    <p className="font-medium">{format(new Date(deal.expectedCloseDate), 'MMM d, yyyy')}</p>
                  </div>
                )}
                {(deal as any).leadSource && (
                  <div>
                    <Label className="text-muted-foreground">Lead Source</Label>
                    <p className="font-medium">{(deal as any).leadSource}</p>
                  </div>
                )}
                {(deal as any).address && (
                  <div>
                    <Label className="text-muted-foreground">Address</Label>
                    <p className="font-medium text-sm">{(deal as any).address}</p>
                  </div>
                )}
                {deal.ownerId && (
                  <div>
                    <Label className="text-muted-foreground">Wedding Planner</Label>
                    <p className="font-medium">{weddingPlanners.find(p => p.id === deal.ownerId)?.name || 'Unknown'}</p>
                  </div>
                )}
                {(contact || deal.phone || (deal as any).whatsapp) && (
                  <div>
                    <Label className="text-muted-foreground">Contact</Label>
                    {contact && <p className="font-medium">{contact.firstName} {contact.lastName}</p>}
                    {(contact?.phone || contact?.mobile || deal.phone) && (
                      <div className="flex items-center gap-2 mt-1">
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="h-8 gap-1 text-green-600 border-green-200 hover:bg-green-50"
                          onClick={() => handleMakeCall(contact?.phone || contact?.mobile || deal.phone || '')}
                          data-testid="button-call-contact"
                        >
                          <Phone className="w-3 h-3" />
                          {contact?.phone || contact?.mobile || deal.phone}
                        </Button>
                      </div>
                    )}
                    {(deal as any).whatsapp && (
                      <div className="flex items-center gap-2 mt-1">
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="h-8 gap-1 text-green-600 border-green-200 hover:bg-green-50"
                          onClick={() => window.open(`https://wa.me/${(deal as any).whatsapp.replace(/[^0-9]/g, '')}`, '_blank')}
                          data-testid="button-whatsapp-contact"
                        >
                          <MessageCircle className="w-3 h-3" />
                          WhatsApp: {(deal as any).whatsapp}
                        </Button>
                      </div>
                    )}
                    {contact?.email && <p className="text-sm text-muted-foreground mt-1">{contact.email}</p>}
                  </div>
                )}
                {company && (
                  <div>
                    <Label className="text-muted-foreground">Company</Label>
                    <p className="font-medium">{company.name}</p>
                  </div>
                )}
                {deal.notes && (
                  <div>
                    <Label className="text-muted-foreground">Notes</Label>
                    <p className="text-sm mt-1">{deal.notes}</p>
                  </div>
                )}

                {/* Call History Section */}
                <Separator />
                <div>
                  <button
                    onClick={() => setShowCallHistory(!showCallHistory)}
                    className="flex items-center justify-between w-full py-2 hover:bg-muted/50 rounded-lg px-2 -mx-2 transition-colors"
                    data-testid="button-toggle-call-history"
                  >
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-green-100 rounded-full">
                        <Phone className="w-4 h-4 text-green-600" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-sm">Call History</p>
                        <p className="text-xs text-muted-foreground">
                          {callLogs.length} call{callLogs.length !== 1 ? 's' : ''} logged
                        </p>
                      </div>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showCallHistory ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {showCallHistory && (
                    <div className="mt-2 space-y-2">
                      {callLogs.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No calls logged yet
                        </p>
                      ) : (
                        callLogs.map((call) => (
                          <div 
                            key={call.id} 
                            className="p-3 bg-muted/50 rounded-lg border"
                            data-testid={`call-log-${call.id}`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <Phone className="w-3 h-3 text-green-600" />
                                <span className="text-sm font-medium">{call.subject}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {call.createdAt ? format(new Date(call.createdAt), 'MMM d, h:mm a') : ''}
                              </span>
                            </div>
                            {call.description && (
                              <p className="text-xs text-muted-foreground mt-1 ml-5">
                                {call.description}
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </ScrollArea>
        <div className="p-4 border-t flex gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" className="flex-1" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button 
                className="flex-1" 
                onClick={handleSave}
                disabled={updateDealMutation.isPending}
                data-testid="button-save-deal"
              >
                {updateDealMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" className="flex-1" onClick={() => setIsEditing(true)} data-testid="button-edit-deal">
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <Button 
                variant="destructive" 
                size="icon" 
                onClick={handleDelete}
                disabled={deleteDealMutation.isPending}
                data-testid="button-delete-deal"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Open With Dialog - Choose Phone or WhatsApp */}
      <Dialog open={isOpenWithDialogOpen} onOpenChange={setIsOpenWithDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-center">Open with</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center gap-4 py-4">
            <button
              onClick={handleOpenWithPhone}
              className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-muted transition-colors"
              data-testid="button-open-with-phone"
            >
              <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
                <Phone className="w-7 h-7 text-blue-600" />
              </div>
              <span className="text-xs font-medium">Phone</span>
            </button>
            <button
              onClick={handleOpenWithWhatsApp}
              className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-muted transition-colors"
              data-testid="button-open-with-whatsapp"
            >
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-7 h-7 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </div>
              <span className="text-xs font-medium">WhatsApp</span>
            </button>
            <button
              onClick={() => {
                if (!phoneToCall) return;
                let formattedPhone = phoneToCall.replace(/[\s\-\(\)]/g, '');
                if (formattedPhone.startsWith('0')) formattedPhone = '91' + formattedPhone.substring(1);
                if (formattedPhone.startsWith('+')) formattedPhone = formattedPhone.substring(1);
                if (formattedPhone.length === 10) formattedPhone = '91' + formattedPhone;
                window.open(`https://api.whatsapp.com/send?phone=${formattedPhone}`, '_blank');
                setIsOpenWithDialogOpen(false);
                setIsCallLogOpen(true);
              }}
              className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-muted transition-colors"
              data-testid="button-open-with-wa-business"
            >
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                <svg className="w-7 h-7 text-emerald-700" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </div>
              <span className="text-xs font-medium">WA Business</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Call Logging Dialog */}
      <Dialog open={isCallLogOpen} onOpenChange={setIsCallLogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-primary" />
              Log Call
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Log call to "<span className="font-semibold text-foreground">{contact?.firstName} {contact?.lastName}</span>"
            </p>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Call Outcome</Label>
              <Select value={callOutcome} onValueChange={setCallOutcome}>
                <SelectTrigger data-testid="select-call-outcome">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="connected">Connected</SelectItem>
                  <SelectItem value="no_answer">No Answer</SelectItem>
                  <SelectItem value="busy">Busy</SelectItem>
                  <SelectItem value="left_voicemail">Left Voicemail</SelectItem>
                  <SelectItem value="wrong_number">Wrong Number</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Call Duration (minutes)</Label>
              <Select value={callDuration} onValueChange={setCallDuration}>
                <SelectTrigger data-testid="select-call-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Not specified</SelectItem>
                  <SelectItem value="1">1 min</SelectItem>
                  <SelectItem value="2">2 min</SelectItem>
                  <SelectItem value="5">5 min</SelectItem>
                  <SelectItem value="10">10 min</SelectItem>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={callNotes}
                onChange={(e) => setCallNotes(e.target.value)}
                placeholder="Brief notes about the call..."
                rows={3}
                data-testid="input-call-notes"
              />
            </div>
            {callOutcome === 'connected' && contactedStage && (() => {
              const currentStage = stages.find(s => s.id === deal.stageId && s.pipelineId === deal.pipelineId);
              const currentStageOrder = currentStage?.order ?? 0;
              const contactedStageOrder = contactedStage?.order ?? 999;
              return currentStageOrder < contactedStageOrder;
            })() && (
              <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                This lead will be moved to "Contacted" stage
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setIsCallLogOpen(false)}>
                Skip
              </Button>
              <Button 
                className="flex-1" 
                onClick={handleLogCall}
                disabled={logCallMutation.isPending}
                data-testid="button-log-call"
              >
                {logCallMutation.isPending ? 'Saving...' : 'Log Call'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface UnifiedLead {
  id: string;
  name: string;
  phone: string;
  email: string;
  eventType: string;
  eventDate: string | null;
  plannerName: string;
  createdAt: string;
  source: 'portal' | 'normal';
  sourceLabel: string;
  status: string;
}

function LeadsSection({
  deals,
  contacts,
  companies,
  users,
  searchQuery,
  setSearchQuery,
  isSuperAdmin,
  currentUser,
}: {
  deals: SalesDeal[];
  contacts: SalesContact[];
  companies: SalesCompany[];
  users: User[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isSuperAdmin: boolean;
  currentUser: User | null;
}) {
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});
  const [leadDateFrom, setLeadDateFrom] = useState('');
  const [leadDateTo, setLeadDateTo] = useState('');
  const [editingLead, setEditingLead] = useState<UnifiedLead | null>(null);
  const [editFormData, setEditFormData] = useState<{ name: string; phone: string; whatsapp: string; email: string; value: string; eventType: string; eventDate: string; expectedCloseDate: string; venue: string; address: string; leadSource: string; companyId: string; ownerId: string; notes: string }>({ name: '', phone: '', whatsapp: '', email: '', value: '0', eventType: '', eventDate: '', expectedCloseDate: '', venue: '', address: '', leadSource: '', companyId: '', ownerId: '', notes: '' });
  const [deletingLead, setDeletingLead] = useState<UnifiedLead | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isWeddingPlanner = currentUser?.role === 'wedding_planner';

  const updateDealMutation = useMutation({
    mutationFn: async ({ dealId, data }: { dealId: string; data: any }) => {
      return apiRequest('PATCH', `/api/sales/deals/${dealId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales/deals'] });
      setEditingLead(null);
      toast({ title: 'Lead updated successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to update lead', description: error.message, variant: 'destructive' });
    },
  });

  const deleteDealMutation = useMutation({
    mutationFn: async (dealId: string) => {
      return apiRequest('DELETE', `/api/sales/deals/${dealId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales/deals'] });
      setDeletingLead(null);
      toast({ title: 'Lead deleted successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to delete lead', description: error.message, variant: 'destructive' });
    },
  });

  const handleEditLead = (lead: UnifiedLead) => {
    const rawId = lead.id.replace('deal-', '').replace('portal-', '');
    const deal = deals.find(d => d.id === rawId);
    const contact = deal?.contactId ? contacts.find(c => c.id === deal.contactId) : null;
    setEditFormData({
      name: lead.name,
      phone: deal?.phone || lead.phone || contact?.phone || '',
      whatsapp: (deal as any)?.whatsapp || '',
      email: lead.email || contact?.email || '',
      value: String(deal?.value || 0),
      eventType: (deal as any)?.eventType || lead.eventType || '',
      eventDate: (deal as any)?.eventDate || lead.eventDate || '',
      expectedCloseDate: deal?.expectedCloseDate || '',
      venue: (deal as any)?.venue || '',
      address: (deal as any)?.address || '',
      leadSource: (deal as any)?.leadSource || '',
      companyId: deal?.companyId || '',
      ownerId: deal?.ownerId || '',
      notes: deal?.notes || '',
    });
    setEditingLead(lead);
  };

  const handleSaveEdit = () => {
    if (!editingLead) return;
    if (editingLead.source === 'normal' && editingLead.id.startsWith('deal-')) {
      const dealId = editingLead.id.replace('deal-', '');
      updateDealMutation.mutate({
        dealId,
        data: {
          title: editFormData.name,
          value: parseFloat(editFormData.value) || 0,
          phone: editFormData.phone || null,
          whatsapp: editFormData.whatsapp || null,
          eventType: editFormData.eventType || null,
          eventDate: editFormData.eventDate || null,
          expectedCloseDate: editFormData.expectedCloseDate || null,
          venue: editFormData.venue || null,
          address: editFormData.address || null,
          leadSource: editFormData.leadSource || null,
          companyId: editFormData.companyId || null,
          ownerId: editFormData.ownerId || null,
          notes: editFormData.notes || null,
        }
      });
    }
  };

  const handleDeleteLead = () => {
    if (!deletingLead) return;
    if (deletingLead.source === 'normal' && deletingLead.id.startsWith('deal-')) {
      const dealId = deletingLead.id.replace('deal-', '');
      deleteDealMutation.mutate(dealId);
    }
  };

  const assignDealMutation = useMutation({
    mutationFn: async ({ dealId, ownerId }: { dealId: string; ownerId: string }) => {
      return apiRequest('PATCH', `/api/sales/deals/${dealId}`, { ownerId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales/deals'] });
      toast({ title: 'Lead assigned successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to assign lead', description: error.message, variant: 'destructive' });
    },
  });

  const { data: portalLeadsData = [] } = useQuery<any[]>({
    queryKey: ['/api/admin/portal-leads'],
    enabled: isSuperAdmin || isWeddingPlanner,
  });

  const allWeddingPlanners = [
    { name: 'Fida Fathima', searchTerms: ['fida'] },
    { name: 'Femina KM', searchTerms: ['femina'] },
  ];
  
  const weddingPlanners = isWeddingPlanner 
    ? allWeddingPlanners.filter(p => 
        p.searchTerms.some(term => currentUser?.name?.toLowerCase().includes(term))
      )
    : allWeddingPlanners;

  const allUnifiedLeads: UnifiedLead[] = useMemo(() => {
    const normalLeads: UnifiedLead[] = deals.map(deal => {
      const contact = contacts.find(c => c.id === deal.contactId);
      const owner = users.find(u => u.id === deal.ownerId);
      return {
        id: `deal-${deal.id}`,
        name: contact ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim() : (deal.title || 'Unknown'),
        phone: contact?.phone || contact?.mobile || '',
        email: contact?.email || '',
        eventType: (deal as any).eventType || 'Wedding',
        eventDate: (deal as any).eventDate || null,
        plannerName: owner?.name || 'Unassigned',
        createdAt: deal.createdAt || new Date().toISOString(),
        source: 'normal' as const,
        sourceLabel: 'Sales Lead',
        status: deal.status || 'open',
      };
    });

    const portalLeads: UnifiedLead[] = portalLeadsData.map((lead: any) => ({
      id: `portal-${lead.id}`,
      name: lead.name || 'Unknown',
      phone: lead.phone || '',
      email: lead.email || '',
      eventType: lead.eventType || 'Wedding',
      eventDate: lead.eventDate || null,
      plannerName: lead.assignedPlannerName || 'Unassigned',
      createdAt: lead.createdAt || new Date().toISOString(),
      source: 'portal' as const,
      sourceLabel: 'Portal Lead',
      status: lead.currentPhase || 'submitted',
    }));

    return [...normalLeads, ...portalLeads].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [deals, contacts, users, portalLeadsData]);

  const filteredLeads = useMemo(() => {
    let result = allUnifiedLeads;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(lead =>
        lead.name.toLowerCase().includes(query) ||
        lead.phone.includes(query) ||
        lead.email.toLowerCase().includes(query) ||
        lead.plannerName.toLowerCase().includes(query) ||
        lead.eventType.toLowerCase().includes(query)
      );
    }
    if (leadDateFrom) {
      const from = new Date(leadDateFrom);
      from.setHours(0, 0, 0, 0);
      result = result.filter(lead => {
        const d = lead.createdAt ? new Date(lead.createdAt) : null;
        return d && d >= from;
      });
    }
    if (leadDateTo) {
      const to = new Date(leadDateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter(lead => {
        const d = lead.createdAt ? new Date(lead.createdAt) : null;
        return d && d <= to;
      });
    }
    if (isWeddingPlanner && currentUser) {
      result = result.filter(lead => {
        const plannerLower = lead.plannerName.toLowerCase();
        return allWeddingPlanners.some(p =>
          p.searchTerms.some(term => currentUser.name?.toLowerCase().includes(term)) &&
          p.searchTerms.some(term => plannerLower.includes(term))
        ) || lead.plannerName === currentUser.name;
      });
    }
    return result;
  }, [allUnifiedLeads, searchQuery, leadDateFrom, leadDateTo, isWeddingPlanner, currentUser]);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const isFilteringToday = leadDateFrom === todayStr && leadDateTo === todayStr;

  const leadsForSummary = useMemo(() => {
    if (isWeddingPlanner && currentUser) {
      return allUnifiedLeads.filter(lead => {
        const plannerLower = lead.plannerName.toLowerCase();
        return allWeddingPlanners.some(p =>
          p.searchTerms.some(term => currentUser.name?.toLowerCase().includes(term)) &&
          p.searchTerms.some(term => plannerLower.includes(term))
        ) || lead.plannerName === currentUser.name;
      });
    }
    return allUnifiedLeads;
  }, [allUnifiedLeads, isWeddingPlanner, currentUser]);

  const todayLeads = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    return leadsForSummary.filter(lead => {
      const d = new Date(lead.createdAt);
      return d >= todayStart && d <= todayEnd;
    });
  }, [leadsForSummary]);

  const handleTodayFilter = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    setLeadDateFrom(today);
    setLeadDateTo(today);
  };

  const handleThisWeekFilter = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const start = new Date(now);
    start.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    setLeadDateFrom(format(start, 'yyyy-MM-dd'));
    setLeadDateTo(format(now, 'yyyy-MM-dd'));
  };

  const handleThisMonthFilter = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    setLeadDateFrom(format(start, 'yyyy-MM-dd'));
    setLeadDateTo(format(now, 'yyyy-MM-dd'));
  };

  const getLeadsByPlanner = (plannerName: string, searchTerms: string[]) => {
    return filteredLeads.filter(lead => {
      const pName = lead.plannerName.toLowerCase();
      return searchTerms.some(term => pName.includes(term)) || pName === plannerName.toLowerCase();
    });
  };

  const groupByMonth = (leads: UnifiedLead[]) => {
    const groups: Record<string, UnifiedLead[]> = {};
    leads.forEach(lead => {
      const date = new Date(lead.createdAt);
      const monthKey = format(date, 'MMMM yyyy');
      if (!groups[monthKey]) groups[monthKey] = [];
      groups[monthKey].push(lead);
    });
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      return new Date(groups[b][0]?.createdAt || 0).getTime() - new Date(groups[a][0]?.createdAt || 0).getTime();
    });
    return sortedKeys.map(key => ({ month: key, leads: groups[key] }));
  };

  const toggleMonth = (plannerName: string, month: string) => {
    const key = `${plannerName}-${month}`;
    setExpandedMonths(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const unassignedLeads = filteredLeads.filter(lead => {
    const pName = lead.plannerName.toLowerCase();
    return pName === 'unassigned' || !allWeddingPlanners.some(p => p.searchTerms.some(term => pName.includes(term)));
  });

  const portalCount = filteredLeads.filter(l => l.source === 'portal').length;
  const normalCount = filteredLeads.filter(l => l.source === 'normal').length;

  const wpUsers = users.filter(u => u.role === 'wedding_planner');

  const handleAssignLead = (lead: UnifiedLead, plannerId: string) => {
    if (lead.source === 'normal' && lead.id.startsWith('deal-')) {
      const dealId = lead.id.replace('deal-', '');
      assignDealMutation.mutate({ dealId, ownerId: plannerId });
    } else if (lead.source === 'portal' && lead.id.startsWith('portal-')) {
      const portalLeadId = lead.id.replace('portal-', '');
      assignPortalLeadMutation.mutate({ leadId: portalLeadId, plannerId });
    }
  };

  const assignPortalLeadMutation = useMutation({
    mutationFn: async ({ leadId, plannerId }: { leadId: string; plannerId: string }) => {
      return apiRequest('POST', `/api/admin/portal-leads/${leadId}/assign`, { plannerId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/portal-leads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sales/deals'] });
      toast({ title: 'Lead assigned successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to assign lead', description: error.message, variant: 'destructive' });
    },
  });

  const isLeadUnassigned = (lead: UnifiedLead) => {
    const pName = lead.plannerName.toLowerCase();
    return pName === 'unassigned' || !allWeddingPlanners.some(p => p.searchTerms.some(term => pName.includes(term)));
  };

  const renderLeadRow = (lead: UnifiedLead) => (
    <div
      key={lead.id}
      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/30 transition-colors"
      data-testid={`lead-${lead.id}`}
    >
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white flex-shrink-0",
        lead.source === 'portal' ? 'bg-blue-500' : 'bg-[#4b7c29]'
      )}>
        {lead.name?.[0]?.toUpperCase() || '?'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="font-medium text-sm truncate">{lead.name}</p>
          <Badge variant="outline" className={cn(
            "text-[10px] px-1.5 py-0 h-4 flex-shrink-0",
            lead.source === 'portal' ? 'border-blue-300 text-blue-600' : 'border-green-300 text-green-700'
          )}>
            {lead.source === 'portal' ? 'Portal' : 'Sales'}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {lead.phone || lead.email || 'No contact info'}
        </p>
      </div>
      <div className="text-right flex-shrink-0 flex items-center gap-2">
        <div className="hidden sm:block">
          <p className="text-xs text-muted-foreground">{lead.eventType}</p>
          {lead.eventDate && (
            <p className="text-xs text-primary">
              {format(new Date(lead.eventDate), 'MMM d, yyyy')}
            </p>
          )}
          <p className="text-[10px] text-muted-foreground">
            {format(new Date(lead.createdAt), 'MMM d, h:mm a')}
          </p>
        </div>
        {isSuperAdmin && isLeadUnassigned(lead) ? (
          <Select onValueChange={(val) => handleAssignLead(lead, val)} data-testid={`select-assign-${lead.id}`}>
            <SelectTrigger className="h-7 w-[120px] text-[10px] border-amber-300 text-amber-700 bg-amber-50">
              <SelectValue placeholder="Assign to..." />
            </SelectTrigger>
            <SelectContent>
              {wpUsers.map(wp => (
                <SelectItem key={wp.id} value={wp.id} className="text-xs">{wp.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-xs text-[#4b7c29] font-medium">{lead.plannerName}</p>
        )}
        {(isSuperAdmin || isWeddingPlanner) && lead.source === 'normal' && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`menu-lead-${lead.id}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleEditLead(lead)} data-testid={`edit-lead-${lead.id}`}>
                <Pencil className="w-3.5 h-3.5 mr-2" />
                Edit
              </DropdownMenuItem>
              {isSuperAdmin && (
                <DropdownMenuItem onClick={() => setDeletingLead(lead)} className="text-red-600" data-testid={`delete-lead-${lead.id}`}>
                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-leads-title">{isWeddingPlanner ? 'My Leads' : 'All Leads'}</h1>
          <p className="text-sm text-muted-foreground">
            Both portal and sales leads combined
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="cursor-pointer hover:border-[#4b7c29]/40 transition-colors" onClick={handleTodayFilter} data-testid="card-today-leads">
          <CardContent className="p-3">
            <p className="text-2xl font-bold text-[#4b7c29]">{todayLeads.length}</p>
            <p className="text-xs text-muted-foreground">Received Today</p>
          </CardContent>
        </Card>
        <Card data-testid="card-total-leads">
          <CardContent className="p-3">
            <p className="text-2xl font-bold">{filteredLeads.length}</p>
            <p className="text-xs text-muted-foreground">
              {leadDateFrom || leadDateTo ? 'In Selected Range' : 'Total Leads'}
            </p>
          </CardContent>
        </Card>
        <Card data-testid="card-portal-leads-count">
          <CardContent className="p-3">
            <p className="text-2xl font-bold text-blue-600">{portalCount}</p>
            <p className="text-xs text-muted-foreground">Portal Leads</p>
          </CardContent>
        </Card>
        <Card data-testid="card-sales-leads-count">
          <CardContent className="p-3">
            <p className="text-2xl font-bold text-green-700">{normalCount}</p>
            <p className="text-xs text-muted-foreground">Sales Leads</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Date Filter */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, phone, email, or planner..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-leads"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">From</Label>
                  <Input
                    type="date"
                    value={leadDateFrom}
                    onChange={(e) => setLeadDateFrom(e.target.value)}
                    className="w-[140px] h-9 text-sm"
                    data-testid="input-lead-date-from"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">To</Label>
                  <Input
                    type="date"
                    value={leadDateTo}
                    onChange={(e) => setLeadDateTo(e.target.value)}
                    className="w-[140px] h-9 text-sm"
                    data-testid="input-lead-date-to"
                  />
                </div>
                {(leadDateFrom || leadDateTo || searchQuery) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setLeadDateFrom(''); setLeadDateTo(''); setSearchQuery(''); }}
                    className="h-9 px-2"
                    data-testid="button-clear-lead-filters"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Quick:</span>
              <Button
                variant={isFilteringToday ? "default" : "outline"}
                size="sm"
                className={cn("h-7 text-xs", isFilteringToday && "bg-[#4b7c29] hover:bg-[#3d6622]")}
                onClick={handleTodayFilter}
                data-testid="button-filter-today"
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={handleThisWeekFilter}
                data-testid="button-filter-week"
              >
                This Week
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={handleThisMonthFilter}
                data-testid="button-filter-month"
              >
                This Month
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leads by Wedding Planner */}
      <div className="space-y-4">
        {weddingPlanners.map(planner => {
          const plannerLeads = getLeadsByPlanner(planner.name, planner.searchTerms);
          const monthlyGroups = groupByMonth(plannerLeads);

          return (
            <Card key={planner.name}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#4b7c29]/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-[#4b7c29]" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{planner.name}</CardTitle>
                    <CardDescription>
                      {plannerLeads.length} leads
                      {plannerLeads.length > 0 && (
                        <span className="ml-1">
                          ({plannerLeads.filter(l => l.source === 'portal').length} portal, {plannerLeads.filter(l => l.source === 'normal').length} sales)
                        </span>
                      )}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {monthlyGroups.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No leads found</p>
                ) : (
                  <div className="space-y-2">
                    {monthlyGroups.map(({ month, leads }) => {
                      const isExpanded = expandedMonths[`${planner.name}-${month}`] !== false;
                      return (
                        <div key={month} className="border rounded-lg">
                          <button
                            onClick={() => toggleMonth(planner.name, month)}
                            className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                            data-testid={`toggle-month-${planner.name}-${month}`}
                          >
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium">{month}</span>
                              <Badge variant="secondary" className="text-xs">{leads.length}</Badge>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                          
                          {isExpanded && (
                            <div className="border-t px-2 py-1 space-y-0.5">
                              {leads.map(lead => renderLeadRow(lead))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {!isWeddingPlanner && unassignedLeads.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <Users className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-lg">Unassigned</CardTitle>
                  <CardDescription>{unassignedLeads.length} leads</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {groupByMonth(unassignedLeads).map(({ month, leads }) => {
                  const isExpanded = expandedMonths[`Unassigned-${month}`] !== false;
                  return (
                    <div key={month} className="border rounded-lg">
                      <button
                        onClick={() => toggleMonth('Unassigned', month)}
                        className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{month}</span>
                          <Badge variant="secondary" className="text-xs">{leads.length}</Badge>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {isExpanded && (
                        <div className="border-t px-2 py-1 space-y-0.5">
                          {leads.map(lead => renderLeadRow(lead))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={!!editingLead} onOpenChange={(open) => !open && setEditingLead(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Lead Name *</Label>
              <Input
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                data-testid="input-edit-lead-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Value (₹)</Label>
                <Input
                  type="number"
                  value={editFormData.value}
                  onChange={(e) => setEditFormData({ ...editFormData, value: e.target.value })}
                  data-testid="input-edit-lead-value"
                />
              </div>
              <div className="space-y-2">
                <Label>Event Type</Label>
                <Select value={editFormData.eventType} onValueChange={(val) => setEditFormData({ ...editFormData, eventType: val })}>
                  <SelectTrigger data-testid="select-edit-event-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wedding">Wedding</SelectItem>
                    <SelectItem value="corporate">Corporate</SelectItem>
                    <SelectItem value="birthday">Birthday</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Contact Number</Label>
                <Input
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  placeholder="+91 9876543210"
                  data-testid="input-edit-lead-phone"
                />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp Number</Label>
                <Input
                  value={editFormData.whatsapp}
                  onChange={(e) => setEditFormData({ ...editFormData, whatsapp: e.target.value })}
                  placeholder="+91 9876543210"
                  data-testid="input-edit-lead-whatsapp"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Event Date</Label>
                <Input
                  type="date"
                  value={editFormData.eventDate}
                  onChange={(e) => setEditFormData({ ...editFormData, eventDate: e.target.value })}
                  data-testid="input-edit-event-date"
                />
              </div>
              <div className="space-y-2">
                <Label>Expected Close Date</Label>
                <Input
                  type="date"
                  value={editFormData.expectedCloseDate}
                  onChange={(e) => setEditFormData({ ...editFormData, expectedCloseDate: e.target.value })}
                  data-testid="input-edit-expected-close"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Lead Source</Label>
                <Select value={editFormData.leadSource} onValueChange={(val) => setEditFormData({ ...editFormData, leadSource: val })}>
                  <SelectTrigger data-testid="select-edit-lead-source">
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Direct">Direct</SelectItem>
                    <SelectItem value="Reference">Reference</SelectItem>
                    <SelectItem value="SMM">SMM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Company</Label>
                <Select value={editFormData.companyId} onValueChange={(val) => setEditFormData({ ...editFormData, companyId: val })}>
                  <SelectTrigger data-testid="select-edit-company">
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Venue</Label>
              <Input
                value={editFormData.venue}
                onChange={(e) => setEditFormData({ ...editFormData, venue: e.target.value })}
                placeholder="Event venue"
                data-testid="input-edit-lead-venue"
              />
            </div>
            <div className="space-y-2">
              <Label>Assign Wedding Planner</Label>
              <Select value={editFormData.ownerId} onValueChange={(val) => setEditFormData({ ...editFormData, ownerId: val })}>
                <SelectTrigger data-testid="select-edit-planner">
                  <SelectValue placeholder="Select planner" />
                </SelectTrigger>
                <SelectContent>
                  {wpUsers.map(wp => (
                    <SelectItem key={wp.id} value={wp.id} className="text-xs">{wp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea
                value={editFormData.address}
                onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                placeholder="Billing/event address"
                rows={2}
                data-testid="input-edit-lead-address"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={editFormData.notes}
                onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                rows={2}
                data-testid="input-edit-lead-notes"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingLead(null)}>Cancel</Button>
              <Button onClick={handleSaveEdit} disabled={updateDealMutation.isPending} data-testid="button-save-edit-lead">
                {updateDealMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingLead} onOpenChange={(open) => !open && setDeletingLead(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lead</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingLead?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteLead} className="bg-red-600 hover:bg-red-700" data-testid="button-confirm-delete-lead">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CompaniesSection({
  companies,
  searchQuery,
  setSearchQuery,
}: {
  companies: SalesCompany[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createCompanyMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/sales/companies', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales/companies'] });
      setIsAddOpen(false);
      toast({ title: 'Company created successfully' });
    },
  });

  const filteredCompanies = companies.filter(c => {
    if (!searchQuery) return true;
    return c.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleAddCompany = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createCompanyMutation.mutate({
      name: formData.get('name'),
      industry: formData.get('industry'),
      website: formData.get('website'),
      phone: formData.get('phone'),
      email: formData.get('email'),
      address: formData.get('address'),
      city: formData.get('city'),
      state: formData.get('state'),
      country: formData.get('country'),
      notes: formData.get('notes'),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center justify-between sm:block">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Companies</h1>
            <p className="text-sm text-muted-foreground">{companies.length} companies</p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-company" size="sm" className="sm:hidden">
                <Plus className="w-4 h-4" />
              </Button>
            </DialogTrigger>
          </Dialog>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-company-desktop" className="hidden sm:flex">
              <Plus className="w-4 h-4 mr-2" />
              Add Company
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New Company</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddCompany} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Company Name *</Label>
                <Input id="name" name="name" required data-testid="input-company-name" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="industry">Industry</Label>
                  <Select name="industry">
                    <SelectTrigger>
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Event Planning">Event Planning</SelectItem>
                      <SelectItem value="Hospitality">Hospitality</SelectItem>
                      <SelectItem value="Corporate">Corporate</SelectItem>
                      <SelectItem value="Entertainment">Entertainment</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input id="website" name="website" data-testid="input-website" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" name="address" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" name="city" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input id="state" name="state" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input id="country" name="country" defaultValue="India" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" data-testid="button-save-company">
                  Create Company
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative w-full sm:flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search companies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-companies"
          />
        </div>
      </div>

      {/* Companies Grid */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {filteredCompanies.map(company => (
          <Card key={company.id} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{company.name}</h3>
                  {company.industry && (
                    <Badge variant="secondary" className="mt-1">{company.industry}</Badge>
                  )}
                  {company.city && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {company.city}{company.state ? `, ${company.state}` : ''}
                    </p>
                  )}
                  {company.phone && (
                    <p className="text-sm text-muted-foreground">{company.phone}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filteredCompanies.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No companies found
          </div>
        )}
      </div>
    </div>
  );
}

function ActivitiesSection({
  activities,
  deals,
  contacts,
}: {
  activities: SalesActivity[];
  deals: SalesDeal[];
  contacts: SalesContact[];
}) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [activityType, setActivityType] = useState<'task' | 'call' | 'meeting'>('task');
  const [activeTab, setActiveTab] = useState('all');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createActivityMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/sales/activities', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales/activities'] });
      setIsAddOpen(false);
      toast({ title: 'Activity created successfully' });
    },
  });

  const updateActivityMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest('PATCH', `/api/sales/activities/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales/activities'] });
    },
  });

  const filteredActivities = activities.filter(a => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return a.status === 'pending';
    if (activeTab === 'completed') return a.status === 'completed';
    return a.type === activeTab;
  });

  const handleAddActivity = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createActivityMutation.mutate({
      type: activityType,
      subject: formData.get('subject'),
      description: formData.get('description'),
      dueDate: formData.get('dueDate'),
      dueTime: formData.get('dueTime'),
      priority: formData.get('priority'),
      dealId: formData.get('dealId') || null,
      contactId: formData.get('contactId') || null,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Activities</h1>
          <p className="text-muted-foreground">Tasks, Calls & Meetings</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-activity">
              <Plus className="w-4 h-4 mr-2" />
              Add Activity
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New Activity</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddActivity} className="space-y-4">
              <Tabs value={activityType} onValueChange={(v) => setActivityType(v as any)}>
                <TabsList className="w-full">
                  <TabsTrigger value="task" className="flex-1">
                    <CheckSquare className="w-4 h-4 mr-2" />
                    Task
                  </TabsTrigger>
                  <TabsTrigger value="call" className="flex-1">
                    <Phone className="w-4 h-4 mr-2" />
                    Call
                  </TabsTrigger>
                  <TabsTrigger value="meeting" className="flex-1">
                    <Calendar className="w-4 h-4 mr-2" />
                    Meeting
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject *</Label>
                <Input id="subject" name="subject" required data-testid="input-activity-subject" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input id="dueDate" name="dueDate" type="date" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueTime">Time</Label>
                  <Input id="dueTime" name="dueTime" type="time" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select name="priority" defaultValue="medium">
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dealId">Related Deal</Label>
                  <Select name="dealId">
                    <SelectTrigger>
                      <SelectValue placeholder="Select deal" />
                    </SelectTrigger>
                    <SelectContent>
                      {deals.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactId">Related Contact</Label>
                <Select name="contactId">
                  <SelectTrigger>
                    <SelectValue placeholder="Select contact" />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.firstName} {c.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" data-testid="button-save-activity">
                  Create Activity
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="task">Tasks</TabsTrigger>
          <TabsTrigger value="call">Calls</TabsTrigger>
          <TabsTrigger value="meeting">Meetings</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Activities List */}
      <div className="space-y-3">
        {filteredActivities.map(activity => {
          const deal = deals.find(d => d.id === activity.dealId);
          const contact = contacts.find(c => c.id === activity.contactId);
          return (
            <Card key={activity.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg ${
                    activity.type === 'task' ? 'bg-blue-100' :
                    activity.type === 'call' ? 'bg-green-100' : 'bg-purple-100'
                  }`}>
                    {activity.type === 'task' ? <CheckSquare className="w-5 h-5 text-blue-600" /> :
                     activity.type === 'call' ? <Phone className="w-5 h-5 text-green-600" /> :
                     <Calendar className="w-5 h-5 text-purple-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium">{activity.subject}</h3>
                      <Badge variant={
                        activity.priority === 'high' ? 'destructive' :
                        activity.priority === 'low' ? 'secondary' : 'default'
                      }>
                        {activity.priority}
                      </Badge>
                    </div>
                    {activity.description && (
                      <p className="text-sm text-muted-foreground mt-1">{activity.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      {activity.dueDate && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {format(new Date(activity.dueDate), 'MMM d, yyyy')}
                          {activity.dueTime && ` at ${activity.dueTime}`}
                        </span>
                      )}
                      {deal && <span>Deal: {deal.title}</span>}
                      {contact && <span>Contact: {contact.firstName}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {activity.status === 'pending' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateActivityMutation.mutate({ id: activity.id, status: 'completed' })}
                      >
                        Mark Done
                      </Button>
                    ) : (
                      <Badge variant="default">Completed</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filteredActivities.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No activities found
          </div>
        )}
      </div>
    </div>
  );
}

function PipelineSetupSection({
  pipelines,
  stages,
}: {
  pipelines: SalesPipeline[];
  stages: SalesStage[];
}) {
  const [isAddPipelineOpen, setIsAddPipelineOpen] = useState(false);
  const [isAddStageOpen, setIsAddStageOpen] = useState(false);
  const [selectedPipeline, setSelectedPipeline] = useState<SalesPipeline | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createPipelineMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/sales/pipelines', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales/pipelines'] });
      setIsAddPipelineOpen(false);
      toast({ title: 'Pipeline created successfully' });
    },
  });

  const createStageMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/sales/stages', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales/stages'] });
      setIsAddStageOpen(false);
      toast({ title: 'Stage created successfully' });
    },
  });

  const handleAddPipeline = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createPipelineMutation.mutate({
      name: formData.get('name'),
      description: formData.get('description'),
    });
  };

  const handleAddStage = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedPipeline) return;
    const formData = new FormData(e.currentTarget);
    const pipelineStages = stages.filter(s => s.pipelineId === selectedPipeline.id);
    createStageMutation.mutate({
      pipelineId: selectedPipeline.id,
      name: formData.get('name'),
      order: pipelineStages.length + 1,
      color: formData.get('color') || '#6B7280',
      probability: parseInt(formData.get('probability') as string) || 0,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Pipeline Setup</h1>
          <p className="text-muted-foreground">Configure your sales pipelines and stages</p>
        </div>
        <Dialog open={isAddPipelineOpen} onOpenChange={setIsAddPipelineOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-pipeline">
              <Plus className="w-4 h-4 mr-2" />
              Add Pipeline
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Pipeline</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddPipeline} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Pipeline Name *</Label>
                <Input id="name" name="name" required placeholder="e.g., Bookings FY2025-26" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsAddPipelineOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Pipeline</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pipelines */}
      <div className="space-y-6">
        {pipelines.map(pipeline => {
          const pipelineStages = stages
            .filter(s => s.pipelineId === pipeline.id)
            .sort((a, b) => a.order - b.order);
          
          return (
            <Card key={pipeline.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{pipeline.name}</CardTitle>
                  {pipeline.description && (
                    <CardDescription>{pipeline.description}</CardDescription>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedPipeline(pipeline);
                    setIsAddStageOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Stage
                </Button>
              </CardHeader>
              <CardContent>
                {pipelineStages.length > 0 ? (
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {pipelineStages.map((stage, i) => (
                      <div key={stage.id} className="flex items-center gap-2">
                        <div 
                          className="px-4 py-2 rounded-lg border flex items-center gap-2 min-w-max"
                          style={{ borderColor: stage.color || '#6B7280' }}
                        >
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: stage.color || '#6B7280' }}
                          />
                          <span className="font-medium text-sm">{stage.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {stage.probability}%
                          </span>
                        </div>
                        {i < pipelineStages.length - 1 && (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No stages configured</p>
                )}
              </CardContent>
            </Card>
          );
        })}
        {pipelines.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Workflow className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">No Pipelines Yet</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Create your first pipeline to start managing deals
              </p>
              <Button onClick={() => setIsAddPipelineOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Pipeline
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Stage Dialog */}
      <Dialog open={isAddStageOpen} onOpenChange={setIsAddStageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Stage to {selectedPipeline?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddStage} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="stageName">Stage Name *</Label>
              <Input id="stageName" name="name" required placeholder="e.g., Lead, Proposal, Won" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="color">Color</Label>
                <Input id="color" name="color" type="color" defaultValue="#6B7280" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="probability">Win Probability (%)</Label>
                <Input id="probability" name="probability" type="number" min="0" max="100" defaultValue="0" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsAddStageOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Add Stage</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AutomationsSection({ automations }: { automations: SalesAutomation[] }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Automations</h1>
          <p className="text-muted-foreground">Automate your sales workflows</p>
        </div>
        <Button data-testid="button-add-automation">
          <Plus className="w-4 h-4 mr-2" />
          Add Automation
        </Button>
      </div>

      {automations.length > 0 ? (
        <div className="grid gap-4">
          {automations.map(automation => (
            <Card key={automation.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Workflow className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">{automation.name}</h3>
                      {automation.description && (
                        <p className="text-sm text-muted-foreground">{automation.description}</p>
                      )}
                    </div>
                  </div>
                  <Badge variant={automation.isActive ? 'default' : 'secondary'}>
                    {automation.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Workflow className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">No Automations Yet</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Create automations to streamline your sales process
            </p>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Automation
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ReportsSection({
  deals,
  stages,
  contacts,
  activities,
}: {
  deals: SalesDeal[];
  stages: SalesStage[];
  contacts: SalesContact[];
  activities: SalesActivity[];
}) {
  const currentFY = getIndianFiscalYear();
  const wonDeals = deals.filter(d => d.status === 'won');
  const openDeals = deals.filter(d => d.status === 'open');
  const lostDeals = deals.filter(d => d.status === 'lost');
  
  const totalWonValue = wonDeals.reduce((sum, d) => sum + parseFloat(d.value || '0'), 0);
  const totalOpenValue = openDeals.reduce((sum, d) => sum + parseFloat(d.value || '0'), 0);
  const winRate = deals.length > 0 ? (wonDeals.length / deals.length * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-muted-foreground">{currentFY} Sales Analytics</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Deals</p>
            <p className="text-3xl font-bold">{deals.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Won Deals</p>
            <p className="text-3xl font-bold text-green-600">{wonDeals.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Win Rate</p>
            <p className="text-3xl font-bold">{winRate.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Revenue</p>
            <p className="text-3xl font-bold text-primary">{formatCurrency(totalWonValue)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Deal Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-4 h-4 rounded bg-green-500" />
                <span className="flex-1">Won</span>
                <span className="font-medium">{wonDeals.length} deals</span>
                <span className="text-muted-foreground w-24 text-right">
                  {formatCurrency(totalWonValue)}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-4 h-4 rounded bg-blue-500" />
                <span className="flex-1">Open</span>
                <span className="font-medium">{openDeals.length} deals</span>
                <span className="text-muted-foreground w-24 text-right">
                  {formatCurrency(totalOpenValue)}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-4 h-4 rounded bg-red-500" />
                <span className="flex-1">Lost</span>
                <span className="font-medium">{lostDeals.length} deals</span>
                <span className="text-muted-foreground w-24 text-right">-</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <CheckSquare className="w-5 h-5 text-blue-600" />
                <span className="flex-1">Tasks</span>
                <span className="font-medium">
                  {activities.filter(a => a.type === 'task').length}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <Phone className="w-5 h-5 text-green-600" />
                <span className="flex-1">Calls</span>
                <span className="font-medium">
                  {activities.filter(a => a.type === 'call').length}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <Calendar className="w-5 h-5 text-purple-600" />
                <span className="flex-1">Meetings</span>
                <span className="font-medium">
                  {activities.filter(a => a.type === 'meeting').length}
                </span>
              </div>
              <Separator />
              <div className="flex items-center gap-4">
                <span className="flex-1 font-medium">Completion Rate</span>
                <span className="font-medium">
                  {activities.length > 0 
                    ? (activities.filter(a => a.status === 'completed').length / activities.length * 100).toFixed(0) 
                    : 0}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SettingsSection({
  targets,
  weddingPlanners,
  isSuperAdmin,
}: {
  targets: SalesTarget[];
  weddingPlanners: User[];
  isSuperAdmin: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentFY = getIndianFiscalYear();
  const [selectedFY, setSelectedFY] = useState(currentFY);
  const [isSaving, setIsSaving] = useState(false);

  const FY_MONTHS = [
    'April', 'May', 'June', 'July', 'August', 'September',
    'October', 'November', 'December', 'January', 'February', 'March'
  ];

  const FY_OPTIONS = ['FY2024-25', 'FY2025-26', 'FY2026-27', 'FY2027-28'];

  type GridValues = Record<string, Record<string, { amount: string; deals: string }>>;

  const buildGridValues = (): GridValues => {
    const grid: GridValues = {};
    FY_MONTHS.forEach(month => {
      grid[month] = {};
      weddingPlanners.forEach(p => {
        const existing = targets.find(t => t.userId === p.id && t.fiscalYear === selectedFY && t.month === month);
        grid[month][p.id] = {
          amount: existing ? String(existing.targetAmount || '') : '',
          deals: existing?.targetDeals ? String(existing.targetDeals) : '',
        };
      });
    });
    return grid;
  };

  const [gridValues, setGridValues] = useState<GridValues>(buildGridValues);

  React.useEffect(() => {
    setGridValues(buildGridValues());
  }, [selectedFY, targets, weddingPlanners]);

  const updateCell = (month: string, plannerId: string, field: 'amount' | 'deals', value: string) => {
    setGridValues(prev => ({
      ...prev,
      [month]: {
        ...prev[month],
        [plannerId]: {
          ...prev[month][plannerId],
          [field]: value,
        },
      },
    }));
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    let savedCount = 0;
    let errorCount = 0;
    
    try {
      for (const month of FY_MONTHS) {
        for (const planner of weddingPlanners) {
          const cell = gridValues[month]?.[planner.id];
          if (!cell?.amount && !cell?.deals) continue;
          
          const existing = targets.find(t => t.userId === planner.id && t.fiscalYear === selectedFY && t.month === month);
          
          try {
            if (existing) {
              await apiRequest('PATCH', `/api/sales/targets/${existing.id}`, {
                targetAmount: cell.amount || '0',
                targetDeals: cell.deals ? parseInt(cell.deals) : null,
              });
            } else if (cell.amount) {
              await apiRequest('POST', '/api/sales/targets', {
                userId: planner.id,
                fiscalYear: selectedFY,
                month,
                targetAmount: cell.amount,
                targetDeals: cell.deals ? parseInt(cell.deals) : null,
              });
            }
            savedCount++;
          } catch {
            errorCount++;
          }
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/sales/targets'] });
      toast({ title: `${savedCount} target${savedCount !== 1 ? 's' : ''} saved successfully${errorCount > 0 ? ` (${errorCount} failed)` : ''}` });
    } finally {
      setIsSaving(false);
    }
  };

  const getPlannerTotal = (plannerId: string): number => {
    return FY_MONTHS.reduce((sum, month) => {
      const val = parseFloat(gridValues[month]?.[plannerId]?.amount || '0');
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure Oak Sales preferences</p>
      </div>

      {isSuperAdmin && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle>Wedding Planner Targets</CardTitle>
                <CardDescription>Set monthly sales targets for each wedding planner</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select value={selectedFY} onValueChange={setSelectedFY}>
                  <SelectTrigger className="w-[140px]" data-testid="select-target-fy">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FY_OPTIONS.map(fy => (
                      <SelectItem key={fy} value={fy}>{fy}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleSaveAll} disabled={isSaving} data-testid="button-save-all-targets">
                  {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save All
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {weddingPlanners.length > 0 ? (
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="w-full text-sm border-collapse min-w-[600px]">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left py-3 px-3 font-semibold text-gray-600 sticky left-0 bg-muted/50 min-w-[100px]">Month</th>
                      {weddingPlanners.map(p => (
                        <th key={p.id} colSpan={2} className="text-center py-3 px-2 font-semibold text-gray-700 border-l">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs text-primary font-bold">
                              {p.name[0]}
                            </div>
                            {p.name}
                          </div>
                        </th>
                      ))}
                    </tr>
                    <tr className="border-b bg-muted/30">
                      <th className="sticky left-0 bg-muted/30"></th>
                      {weddingPlanners.map(p => (
                        <React.Fragment key={`sub-${p.id}`}>
                          <th className="text-center py-1.5 px-2 text-xs font-medium text-gray-500 border-l">Amount (₹)</th>
                          <th className="text-center py-1.5 px-2 text-xs font-medium text-gray-500">Deals</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {FY_MONTHS.map((month, idx) => {
                      const currentMonth = new Date().toLocaleString('en', { month: 'long' });
                      const isCurrentMonth = month === currentMonth && selectedFY === currentFY;
                      return (
                        <tr key={month} className={`border-b hover:bg-muted/20 ${isCurrentMonth ? 'bg-primary/5 font-medium' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                          <td className={`py-2 px-3 font-medium text-gray-700 sticky left-0 ${isCurrentMonth ? 'bg-primary/5 text-primary' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                            {month.substring(0, 3)}
                            {isCurrentMonth && <span className="ml-1 text-[10px] text-primary/70">(now)</span>}
                          </td>
                          {weddingPlanners.map(p => (
                            <React.Fragment key={`${month}-${p.id}`}>
                              <td className="py-1 px-1 border-l">
                                <Input
                                  type="number"
                                  value={gridValues[month]?.[p.id]?.amount || ''}
                                  onChange={(e) => updateCell(month, p.id, 'amount', e.target.value)}
                                  placeholder="0"
                                  className="h-8 text-sm text-right border-gray-200 focus:border-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  data-testid={`input-target-amount-${month}-${p.id}`}
                                />
                              </td>
                              <td className="py-1 px-1">
                                <Input
                                  type="number"
                                  value={gridValues[month]?.[p.id]?.deals || ''}
                                  onChange={(e) => updateCell(month, p.id, 'deals', e.target.value)}
                                  placeholder="0"
                                  className="h-8 text-sm text-right w-16 border-gray-200 focus:border-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  data-testid={`input-target-deals-${month}-${p.id}`}
                                />
                              </td>
                            </React.Fragment>
                          ))}
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 border-gray-300 bg-muted/50 font-semibold">
                      <td className="py-2.5 px-3 text-gray-700 sticky left-0 bg-muted/50">Total</td>
                      {weddingPlanners.map(p => {
                        const totalAmount = getPlannerTotal(p.id);
                        const totalDeals = FY_MONTHS.reduce((sum, month) => {
                          const val = parseInt(gridValues[month]?.[p.id]?.deals || '0');
                          return sum + (isNaN(val) ? 0 : val);
                        }, 0);
                        return (
                          <React.Fragment key={`total-${p.id}`}>
                            <td className="py-2.5 px-2 text-right text-primary border-l">{formatCurrency(totalAmount)}</td>
                            <td className="py-2.5 px-2 text-right text-gray-600">{totalDeals || '-'}</td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No wedding planners found. Add users with the "Wedding Planner" role to set targets.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Currency</p>
              <p className="text-sm text-muted-foreground">Default currency for deals</p>
            </div>
            <Badge>INR (₹)</Badge>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Fiscal Year</p>
              <p className="text-sm text-muted-foreground">Current fiscal year (April - March)</p>
            </div>
            <Badge variant="secondary">{currentFY}</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Vendor Costs Section - Event-wise vendor cost tracking for P&L
function VendorCostsSection({ isSuperAdmin, currentUser }: { isSuperAdmin: boolean; currentUser: User | null }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventSelectorOpen, setEventSelectorOpen] = useState(false);
  const [eventSearchQuery, setEventSearchQuery] = useState('');
  const [addVendorOpen, setAddVendorOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<any>(null);
  const [vendorForm, setVendorForm] = useState({
    vendorName: '',
    serviceDescription: '',
    estimatedAmount: '',
    actualAmount: '',
    paymentStatus: 'pending',
    paymentDate: '',
    paymentReference: '',
    notes: ''
  });

  const canEdit = currentUser?.role === 'superadmin' || currentUser?.role === 'accountant';

  const { data: events = [] } = useQuery<any[]>({
    queryKey: ['/api/events'],
  });

  const { data: vendorCosts = [] } = useQuery<any[]>({
    queryKey: ['/api/events/vendor-costs', selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const res = await fetch(`/api/events/${selectedEventId}/vendor-costs`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedEventId,
  });

  const vendorCostsMutation = useMutation({
    mutationFn: async (data: { action: 'create' | 'update' | 'delete'; costId?: string; payload?: any }) => {
      if (!selectedEventId) throw new Error('No event selected');
      if (data.action === 'create') {
        const res = await fetch(`/api/events/${selectedEventId}/vendor-costs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data.payload)
        });
        if (!res.ok) throw new Error('Failed to create vendor cost');
        return res.json();
      } else if (data.action === 'update') {
        const res = await fetch(`/api/events/${selectedEventId}/vendor-costs/${data.costId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data.payload)
        });
        if (!res.ok) throw new Error('Failed to update vendor cost');
        return res.json();
      } else {
        const res = await fetch(`/api/events/${selectedEventId}/vendor-costs/${data.costId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete vendor cost');
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events/vendor-costs', selectedEventId] });
      setAddVendorOpen(false);
      setEditingVendor(null);
      setVendorForm({ vendorName: '', serviceDescription: '', estimatedAmount: '', actualAmount: '', paymentStatus: 'pending', paymentDate: '', paymentReference: '', notes: '' });
      toast({ title: 'Success', description: 'Vendor cost updated' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update vendor cost', variant: 'destructive' });
    }
  });

  const selectedEvent = events.find((e: any) => e.id === selectedEventId);
  const totalEstimated = vendorCosts.reduce((sum: number, c: any) => sum + parseFloat(c.estimatedAmount || '0'), 0);
  const totalActual = vendorCosts.reduce((sum: number, c: any) => sum + parseFloat(c.actualAmount || '0'), 0);

  const filteredEvents = events.filter((event: any) => {
    if (!eventSearchQuery) return true;
    const searchLower = eventSearchQuery.toLowerCase();
    return (
      event.title?.toLowerCase().includes(searchLower) ||
      event.customer?.toLowerCase().includes(searchLower) ||
      event.venue?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Vendor Costs</h2>
          <p className="text-sm text-muted-foreground">Track vendor estimates and actual payments for event P&L</p>
        </div>
      </div>

      {/* Event Selector - Searchable Combobox */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Select Event</CardTitle>
        </CardHeader>
        <CardContent>
          <Popover open={eventSelectorOpen} onOpenChange={setEventSelectorOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={eventSelectorOpen}
                className="w-full justify-between h-10 font-normal"
                data-testid="select-vendor-event"
              >
                {selectedEvent
                  ? `${selectedEvent.title} - ${selectedEvent.customer || 'N/A'}`
                  : "Search and select an event..."}
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start" style={{ width: 'var(--radix-popover-trigger-width)' }}>
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="Search events by name, customer, or venue..."
                  value={eventSearchQuery}
                  onValueChange={setEventSearchQuery}
                />
                <CommandList>
                  <CommandEmpty>No events found.</CommandEmpty>
                  <CommandGroup>
                    <ScrollArea className="h-[300px]">
                      {filteredEvents.map((event: any) => (
                        <CommandItem
                          key={event.id}
                          value={event.id}
                          onSelect={() => {
                            setSelectedEventId(event.id);
                            setEventSelectorOpen(false);
                            setEventSearchQuery('');
                          }}
                          className="cursor-pointer"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{event.title}</span>
                            <span className="text-xs text-muted-foreground">
                              {event.customer} • {format(new Date(event.date), 'dd MMM yyyy')}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </ScrollArea>
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>

      {selectedEventId && selectedEvent && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-sm text-muted-foreground">Sales Value</p>
                <p className="text-xl font-bold text-primary">₹{parseFloat(selectedEvent.salesValue || '0').toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-sm text-muted-foreground">Total Estimated</p>
                <p className="text-xl font-bold text-blue-600">₹{totalEstimated.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-sm text-muted-foreground">Total Actual</p>
                <p className="text-xl font-bold text-green-600">₹{totalActual.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-sm text-muted-foreground">Profit (P&L)</p>
                <p className={`text-xl font-bold ${parseFloat(selectedEvent.salesValue || '0') - totalActual >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  ₹{(parseFloat(selectedEvent.salesValue || '0') - totalActual).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Vendor Costs Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Vendor Costs ({vendorCosts.length})</CardTitle>
              {canEdit && (
                <Button size="sm" onClick={() => setAddVendorOpen(true)} data-testid="button-add-vendor-cost">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Vendor
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {vendorCosts.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No vendor costs added for this event yet</p>
              ) : (
                <div className="space-y-3">
                  {vendorCosts.map((vc: any) => (
                    <div key={vc.id} className="p-4 border rounded-lg bg-gray-50" data-testid={`vendor-cost-row-${vc.id}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium">{vc.vendorName}</p>
                            {vc.paymentStatus === 'paid' ? (
                              <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Paid
                              </span>
                            ) : vc.paymentStatus === 'partial' ? (
                              <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">Partial</span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full flex items-center gap-1">
                                <Clock className="h-3 w-3" /> Pending
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{vc.serviceDescription}</p>
                          <div className="flex gap-6 mt-2 text-sm">
                            <span>Estimated: <strong>₹{parseFloat(vc.estimatedAmount || '0').toLocaleString()}</strong></span>
                            <span>Actual: <strong className={vc.actualAmount ? '' : 'text-gray-400'}>₹{parseFloat(vc.actualAmount || '0').toLocaleString()}</strong></span>
                          </div>
                          {vc.paymentDate && (
                            <p className="text-xs text-gray-500 mt-1">Paid on: {format(new Date(vc.paymentDate), 'dd MMM yyyy')}</p>
                          )}
                          {vc.paymentReference && (
                            <p className="text-xs text-gray-500">Ref: {vc.paymentReference}</p>
                          )}
                        </div>
                        {canEdit && (
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingVendor(vc);
                                setVendorForm({
                                  vendorName: vc.vendorName,
                                  serviceDescription: vc.serviceDescription,
                                  estimatedAmount: vc.estimatedAmount || '',
                                  actualAmount: vc.actualAmount || '',
                                  paymentStatus: vc.paymentStatus,
                                  paymentDate: vc.paymentDate || '',
                                  paymentReference: vc.paymentReference || '',
                                  notes: vc.notes || ''
                                });
                              }}
                              data-testid={`edit-vendor-cost-${vc.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {isSuperAdmin && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => {
                                  if (confirm('Delete this vendor cost?')) {
                                    vendorCostsMutation.mutate({ action: 'delete', costId: vc.id });
                                  }
                                }}
                                data-testid={`delete-vendor-cost-${vc.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add/Edit Vendor Dialog */}
          {canEdit && (addVendorOpen || editingVendor) && (
            <Card className="border-2 border-[#4b7c29]/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{editingVendor ? 'Edit Vendor Cost' : 'Add Vendor Cost'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Vendor Name</Label>
                    <Input
                      value={vendorForm.vendorName}
                      onChange={(e) => setVendorForm({ ...vendorForm, vendorName: e.target.value })}
                      placeholder="Vendor name"
                      data-testid="input-vendor-name"
                    />
                  </div>
                  <div>
                    <Label>Service/Item</Label>
                    <Input
                      value={vendorForm.serviceDescription}
                      onChange={(e) => setVendorForm({ ...vendorForm, serviceDescription: e.target.value })}
                      placeholder="What they provide"
                      data-testid="input-vendor-service"
                    />
                  </div>
                  <div>
                    <Label>Estimated Amount (₹)</Label>
                    <Input
                      type="number"
                      value={vendorForm.estimatedAmount}
                      onChange={(e) => setVendorForm({ ...vendorForm, estimatedAmount: e.target.value })}
                      placeholder="0"
                      data-testid="input-vendor-estimated"
                    />
                  </div>
                  <div>
                    <Label>Actual Amount (₹)</Label>
                    <Input
                      type="number"
                      value={vendorForm.actualAmount}
                      onChange={(e) => setVendorForm({ ...vendorForm, actualAmount: e.target.value })}
                      placeholder="0"
                      data-testid="input-vendor-actual"
                    />
                  </div>
                  <div>
                    <Label>Payment Status</Label>
                    <Select value={vendorForm.paymentStatus} onValueChange={(v) => setVendorForm({ ...vendorForm, paymentStatus: v })}>
                      <SelectTrigger data-testid="select-vendor-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="partial">Partial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Payment Date</Label>
                    <Input
                      type="date"
                      value={vendorForm.paymentDate}
                      onChange={(e) => setVendorForm({ ...vendorForm, paymentDate: e.target.value })}
                      data-testid="input-vendor-payment-date"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Payment Reference (UTR/Bank Ref)</Label>
                    <Input
                      value={vendorForm.paymentReference}
                      onChange={(e) => setVendorForm({ ...vendorForm, paymentReference: e.target.value })}
                      placeholder="Bank reference or UTR number"
                      data-testid="input-vendor-reference"
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setAddVendorOpen(false);
                      setEditingVendor(null);
                      setVendorForm({ vendorName: '', serviceDescription: '', estimatedAmount: '', actualAmount: '', paymentStatus: 'pending', paymentDate: '', paymentReference: '', notes: '' });
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 bg-[#4b7c29] hover:bg-[#3d6622]"
                    disabled={!vendorForm.vendorName || !vendorForm.serviceDescription || vendorCostsMutation.isPending}
                    onClick={() => {
                      if (editingVendor) {
                        vendorCostsMutation.mutate({ action: 'update', costId: editingVendor.id, payload: vendorForm });
                      } else {
                        vendorCostsMutation.mutate({ action: 'create', payload: vendorForm });
                      }
                    }}
                    data-testid="button-save-vendor-cost"
                  >
                    {vendorCostsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : editingVendor ? 'Update' : 'Add Vendor'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

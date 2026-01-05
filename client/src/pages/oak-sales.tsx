import { useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
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
} from "lucide-react";
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

type Section = 'dashboard' | 'pipeline' | 'contacts' | 'companies' | 'activities' | 'pipeline-setup' | 'automations' | 'reports' | 'settings';

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
  const [activeSection, setActiveSection] = useState<Section>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
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

  useEffect(() => {
    if (filteredPipelines.length > 0 && !selectedPipelineId) {
      setSelectedPipelineId(filteredPipelines[0].id);
    }
  }, [filteredPipelines, selectedPipelineId]);

  const sidebarItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'pipeline', label: 'Leads Pipeline', icon: Target },
    { id: 'contacts', label: 'Contacts', icon: Users },
    { id: 'companies', label: 'Companies', icon: Building2 },
    { id: 'activities', label: 'Activities', icon: CheckSquare },
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
          <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
            <Target className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-lg">Oak Sales</h1>
            <p className="text-xs text-muted-foreground">CRM</p>
          </div>
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        <nav className="p-2 space-y-1">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveSection(item.id as Section);
                onNavClick?.();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                activeSection === item.id
                  ? 'bg-amber-500/10 text-amber-600 font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
              data-testid={`nav-${item.id}`}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </ScrollArea>
    </>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <aside className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-card border-r transition-all duration-300 flex flex-col`}>
          <div className="p-4 border-b">
            <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-3">
              <LayoutDashboard className="w-4 h-4" />
              {!sidebarCollapsed && <span className="text-sm font-medium">Dashboard</span>}
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
              {!sidebarCollapsed && (
                <div>
                  <h1 className="font-semibold text-lg">Oak Sales</h1>
                  <p className="text-xs text-muted-foreground">CRM</p>
                </div>
              )}
            </div>
          </div>
          
          <ScrollArea className="flex-1">
            <nav className="p-2 space-y-1">
              {sidebarItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id as Section)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    activeSection === item.id
                      ? 'bg-amber-500/10 text-amber-600 font-medium'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                  data-testid={`nav-${item.id}`}
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </button>
              ))}
            </nav>
          </ScrollArea>

          <div className="p-4 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-full justify-center"
            >
              <ChevronRight className={`w-4 h-4 transition-transform ${sidebarCollapsed ? '' : 'rotate-180'}`} />
            </Button>
          </div>
        </aside>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
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
              <div className="w-7 h-7 bg-amber-500 rounded-lg flex items-center justify-center">
                <Target className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold">Oak Sales</span>
            </div>
          </div>
        )}
        <div className="p-4 sm:p-6">
          {activeSection === 'dashboard' && (
            <DashboardSection
              deals={deals}
              contacts={contacts}
              companies={companies}
              activities={activities}
              stages={stages}
              targets={targets}
              users={users}
              weddingPlanners={weddingPlanners}
              isSuperAdmin={isSuperAdmin}
            />
          )}
          {activeSection === 'pipeline' && (
            <PipelineSection
              pipelines={filteredPipelines}
              stages={stages}
              deals={deals}
              contacts={contacts}
              companies={companies}
              selectedPipelineId={selectedPipelineId}
              setSelectedPipelineId={setSelectedPipelineId}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              isSuperAdmin={isSuperAdmin}
            />
          )}
          {activeSection === 'contacts' && (
            <ContactsSection
              contacts={contacts}
              companies={companies}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
            />
          )}
          {activeSection === 'companies' && (
            <CompaniesSection
              companies={companies}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
            />
          )}
          {activeSection === 'activities' && (
            <ActivitiesSection
              activities={activities}
              deals={deals}
              contacts={contacts}
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
              deals={deals}
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
        </div>
      </main>
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
  isSuperAdmin
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
}) {
  const openDeals = deals.filter(d => d.status === 'open');
  const wonDeals = deals.filter(d => d.status === 'won');
  const totalPipelineValue = openDeals.reduce((sum, d) => sum + parseFloat(d.value || '0'), 0);
  const totalWonValue = wonDeals.reduce((sum, d) => sum + parseFloat(d.value || '0'), 0);
  const pendingActivities = activities.filter(a => a.status === 'pending');
  const currentFY = getIndianFiscalYear();

  const dealsByStage = stages.map(stage => ({
    name: stage.name,
    count: deals.filter(d => d.stageId === stage.id).length,
    value: deals.filter(d => d.stageId === stage.id).reduce((sum, d) => sum + parseFloat(d.value || '0'), 0),
    color: stage.color,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">{currentFY} Overview</p>
        </div>
        <Button data-testid="button-new-deal">
          <Plus className="w-4 h-4 mr-2" />
          New Deal
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Target className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Open Deals</p>
                <p className="text-2xl font-bold">{openDeals.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pipeline Value</p>
                <p className="text-2xl font-bold">{formatCurrency(totalPipelineValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Won Value</p>
                <p className="text-2xl font-bold">{formatCurrency(totalWonValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Clock className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Tasks</p>
                <p className="text-2xl font-bold">{pendingActivities.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Deals by Stage</CardTitle>
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
                          width: `${Math.min(100, (stage.count / Math.max(deals.length, 1)) * 100)}%`,
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
            <CardTitle>Recent Activities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activities.slice(0, 5).map(activity => (
                <div key={activity.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className={`p-2 rounded-lg ${
                    activity.type === 'task' ? 'bg-blue-100' :
                    activity.type === 'call' ? 'bg-green-100' : 'bg-purple-100'
                  }`}>
                    {activity.type === 'task' ? <CheckSquare className="w-4 h-4 text-blue-600" /> :
                     activity.type === 'call' ? <Phone className="w-4 h-4 text-green-600" /> :
                     <Calendar className="w-4 h-4 text-purple-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{activity.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {activity.dueDate ? format(new Date(activity.dueDate), 'MMM d, yyyy') : 'No due date'}
                    </p>
                  </div>
                  <Badge variant={activity.status === 'completed' ? 'default' : 'secondary'}>
                    {activity.status}
                  </Badge>
                </div>
              ))}
              {activities.length === 0 && (
                <p className="text-center text-muted-foreground py-4">No activities yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Wedding Planner Targets (Super Admin only) */}
      {isSuperAdmin && weddingPlanners.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Wedding Planner Performance</CardTitle>
            <CardDescription>{currentFY} Targets & Achievement</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {weddingPlanners.map(planner => {
                const plannerTarget = targets.find(t => t.userId === planner.id && t.fiscalYear === currentFY);
                const plannerDeals = deals.filter(d => d.ownerId === planner.id && d.status === 'won');
                const achieved = plannerDeals.reduce((sum, d) => sum + parseFloat(d.value || '0'), 0);
                const targetAmount = plannerTarget ? parseFloat(plannerTarget.targetAmount) : 0;
                const progress = targetAmount > 0 ? Math.min(100, (achieved / targetAmount) * 100) : 0;

                return (
                  <div key={planner.id} className="p-4 border rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">{planner.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {formatCurrency(achieved)} / {formatCurrency(targetAmount)}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-amber-500 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {progress.toFixed(1)}% of target achieved
                    </p>
                  </div>
                );
              })}
            </div>
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
}) {
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [isAddPipelineOpen, setIsAddPipelineOpen] = useState(false);
  const [isEditPipelineOpen, setIsEditPipelineOpen] = useState(false);
  const [isDeletePipelineOpen, setIsDeletePipelineOpen] = useState(false);
  const [editPipelineName, setEditPipelineName] = useState('');
  const [selectedDeal, setSelectedDeal] = useState<SalesDeal | null>(null);
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
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
    if (!searchQuery) return true;
    return d.title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const updateDealMutation = useMutation({
    mutationFn: async ({ id, stageId }: { id: string; stageId: string }) => {
      return apiRequest('PATCH', `/api/sales/deals/${id}`, { stageId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales/deals'] });
      toast({ title: 'Deal moved successfully' });
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
      updateDealMutation.mutate({ id: draggedDealId, stageId });
      setDraggedDealId(null);
    }
  };

  const handleAddLead = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const firstStage = pipelineStages[0];
    if (!firstStage || !selectedPipelineId) return;

    createDealMutation.mutate({
      title: formData.get('title'),
      value: formData.get('value') || '0',
      pipelineId: selectedPipelineId,
      stageId: firstStage.id,
      contactId: formData.get('contactId') || null,
      companyId: formData.get('companyId') || null,
      eventType: formData.get('eventType') || null,
      expectedCloseDate: formData.get('expectedCloseDate') || null,
      notes: formData.get('notes') || null,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Leads Pipeline</h1>
          <p className="text-muted-foreground">Manage your sales pipeline</p>
        </div>
        <div className="flex items-center gap-2">
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
                    <Label htmlFor="contactId">Contact</Label>
                    <Select name="contactId">
                      <SelectTrigger data-testid="select-contact">
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
                <div className="space-y-2">
                  <Label htmlFor="expectedCloseDate">Expected Close Date</Label>
                  <Input id="expectedCloseDate" name="expectedCloseDate" type="date" data-testid="input-expected-close" />
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

      {/* Search */}
      <div className="flex items-center gap-4">
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
        <Button variant="outline" size="icon">
          <Filter className="w-4 h-4" />
        </Button>
      </div>

      {/* Kanban Board */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {pipelineStages.map(stage => {
            const stageDeals = filteredDeals.filter(d => d.stageId === stage.id);
            const stageValue = stageDeals.reduce((sum, d) => sum + parseFloat(d.value || '0'), 0);

            return (
              <div
                key={stage.id}
                className="w-72 flex-shrink-0"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage.id)}
              >
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: stage.color || '#6B7280' }}
                      />
                      <h3 className="font-medium text-sm">{stage.name}</h3>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {stageDeals.length}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    {formatCurrency(stageValue)}
                  </p>
                  
                  <div className="space-y-2 min-h-[200px]">
                    {stageDeals.map(deal => {
                      const contact = contacts.find(c => c.id === deal.contactId);
                      return (
                        <div
                          key={deal.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, deal.id)}
                          onClick={() => setSelectedDeal(deal)}
                          className="bg-card p-3 rounded-lg border cursor-move hover:shadow-md transition-shadow"
                          data-testid={`deal-card-${deal.id}`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <GripVertical className="w-4 h-4 text-muted-foreground" />
                            <Badge variant="outline" className="text-xs">
                              {deal.eventType || 'Event'}
                            </Badge>
                          </div>
                          <h4 className="font-medium text-sm mb-1">{deal.title}</h4>
                          <p className="text-amber-600 font-semibold text-sm">
                            {formatCurrency(deal.value)}
                          </p>
                          {contact && (
                            <p className="text-xs text-muted-foreground mt-2">
                              {contact.firstName} {contact.lastName}
                            </p>
                          )}
                        </div>
                      );
                    })}
                    {stageDeals.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        This stage is empty
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
          onClose={() => setSelectedDeal(null)}
        />
      )}
    </div>
  );
}

function DealDetailPanel({
  deal,
  contacts,
  companies,
  onClose,
}: {
  deal: SalesDeal;
  contacts: SalesContact[];
  companies: SalesCompany[];
  onClose: () => void;
}) {
  const contact = contacts.find(c => c.id === deal.contactId);
  const company = companies.find(c => c.id === deal.companyId);

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-card border-l shadow-xl z-50">
      <div className="h-full flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">Deal Details</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold">{deal.title}</h3>
              <p className="text-2xl font-bold text-amber-600 mt-1">
                {formatCurrency(deal.value)}
              </p>
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
              {contact && (
                <div>
                  <Label className="text-muted-foreground">Contact</Label>
                  <p className="font-medium">{contact.firstName} {contact.lastName}</p>
                  {contact.email && <p className="text-sm text-muted-foreground">{contact.email}</p>}
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
            </div>
          </div>
        </ScrollArea>
        <div className="p-4 border-t flex gap-2">
          <Button variant="outline" className="flex-1">
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <Button variant="destructive" size="icon">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function ContactsSection({
  contacts,
  companies,
  searchQuery,
  setSearchQuery,
}: {
  contacts: SalesContact[];
  companies: SalesCompany[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createContactMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/sales/contacts', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales/contacts'] });
      setIsAddOpen(false);
      toast({ title: 'Contact created successfully' });
    },
  });

  const filteredContacts = contacts.filter(c => {
    if (!searchQuery) return true;
    const fullName = `${c.firstName} ${c.lastName || ''}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase()) ||
           c.email?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleAddContact = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createContactMutation.mutate({
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      mobile: formData.get('mobile'),
      companyId: formData.get('companyId') || null,
      title: formData.get('title'),
      source: formData.get('source'),
      notes: formData.get('notes'),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Contacts</h1>
          <p className="text-muted-foreground">{contacts.length} contacts</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-contact">
              <Plus className="w-4 h-4 mr-2" />
              Add Contact
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New Contact</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddContact} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input id="firstName" name="firstName" required data-testid="input-first-name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" name="lastName" data-testid="input-last-name" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" data-testid="input-email" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" data-testid="input-phone" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mobile">Mobile</Label>
                  <Input id="mobile" name="mobile" data-testid="input-mobile" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyId">Company</Label>
                  <Select name="companyId">
                    <SelectTrigger>
                      <SelectValue placeholder="Select company" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Job Title</Label>
                  <Input id="title" name="title" data-testid="input-title" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="source">Source</Label>
                <Select name="source">
                  <SelectTrigger>
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Website">Website</SelectItem>
                    <SelectItem value="Referral">Referral</SelectItem>
                    <SelectItem value="Social Media">Social Media</SelectItem>
                    <SelectItem value="Cold Call">Cold Call</SelectItem>
                    <SelectItem value="Event">Event</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" data-testid="button-save-contact">
                  Create Contact
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-contacts"
          />
        </div>
      </div>

      {/* Contacts Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredContacts.map(contact => {
          const company = companies.find(c => c.id === contact.companyId);
          return (
            <Card key={contact.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                    <span className="text-amber-600 font-semibold">
                      {contact.firstName[0]}{contact.lastName?.[0] || ''}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">
                      {contact.firstName} {contact.lastName}
                    </h3>
                    {contact.title && (
                      <p className="text-sm text-muted-foreground">{contact.title}</p>
                    )}
                    {company && (
                      <p className="text-sm text-muted-foreground">{company.name}</p>
                    )}
                    {contact.email && (
                      <p className="text-sm text-blue-600 truncate mt-1">{contact.email}</p>
                    )}
                    {contact.phone && (
                      <p className="text-sm text-muted-foreground">{contact.phone}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filteredContacts.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No contacts found
          </div>
        )}
      </div>
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Companies</h1>
          <p className="text-muted-foreground">{companies.length} companies</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-company">
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
        <div className="relative flex-1 max-w-sm">
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
            <p className="text-3xl font-bold text-amber-600">{formatCurrency(totalWonValue)}</p>
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
  const [isSetTargetOpen, setIsSetTargetOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentFY = getIndianFiscalYear();

  const createTargetMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/sales/targets', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales/targets'] });
      setIsSetTargetOpen(false);
      toast({ title: 'Target set successfully' });
    },
  });

  const updateTargetMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: any }) => {
      return apiRequest('PATCH', `/api/sales/targets/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales/targets'] });
      toast({ title: 'Target updated successfully' });
    },
  });

  const handleSetTarget = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const userId = formData.get('userId') as string;
    const fiscalYear = formData.get('fiscalYear') as string;
    
    const existingTarget = targets.find(t => t.userId === userId && t.fiscalYear === fiscalYear);
    
    if (existingTarget) {
      updateTargetMutation.mutate({
        id: existingTarget.id,
        targetAmount: formData.get('targetAmount'),
        targetDeals: parseInt(formData.get('targetDeals') as string) || null,
        notes: formData.get('notes'),
      });
    } else {
      createTargetMutation.mutate({
        userId,
        fiscalYear,
        targetAmount: formData.get('targetAmount'),
        targetDeals: parseInt(formData.get('targetDeals') as string) || null,
        notes: formData.get('notes'),
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure Oak Sales preferences</p>
      </div>

      {/* Target Settings (Super Admin) */}
      {isSuperAdmin && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Wedding Planner Targets</CardTitle>
              <CardDescription>Set sales targets for each wedding planner</CardDescription>
            </div>
            <Dialog open={isSetTargetOpen} onOpenChange={setIsSetTargetOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-set-target">
                  <Target className="w-4 h-4 mr-2" />
                  Set Target
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Set Sales Target</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSetTarget} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="userId">Wedding Planner *</Label>
                    <Select name="userId" required>
                      <SelectTrigger data-testid="select-planner">
                        <SelectValue placeholder="Select planner" />
                      </SelectTrigger>
                      <SelectContent>
                        {weddingPlanners.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fiscalYear">Fiscal Year *</Label>
                    <Select name="fiscalYear" defaultValue={currentFY}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select year" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FY2024-25">FY2024-25</SelectItem>
                        <SelectItem value="FY2025-26">FY2025-26</SelectItem>
                        <SelectItem value="FY2026-27">FY2026-27</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="targetAmount">Target Amount (₹) *</Label>
                      <Input 
                        id="targetAmount" 
                        name="targetAmount" 
                        type="number" 
                        required 
                        placeholder="1000000"
                        data-testid="input-target-amount"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="targetDeals">Target Deals</Label>
                      <Input 
                        id="targetDeals" 
                        name="targetDeals" 
                        type="number"
                        placeholder="10"
                        data-testid="input-target-deals"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea id="notes" name="notes" />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsSetTargetOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" data-testid="button-save-target">
                      Save Target
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {weddingPlanners.length > 0 ? (
              <div className="divide-y">
                {weddingPlanners.map(planner => {
                  const plannerTarget = targets.find(t => t.userId === planner.id && t.fiscalYear === currentFY);
                  return (
                    <div key={planner.id} className="py-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                          <span className="text-amber-600 font-semibold">
                            {planner.name[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{planner.name}</p>
                          <p className="text-sm text-muted-foreground">{planner.email}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        {plannerTarget ? (
                          <>
                            <p className="font-semibold text-amber-600">
                              {formatCurrency(plannerTarget.targetAmount)}
                            </p>
                            {plannerTarget.targetDeals && (
                              <p className="text-sm text-muted-foreground">
                                {plannerTarget.targetDeals} deals
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="text-muted-foreground text-sm">No target set</p>
                        )}
                      </div>
                    </div>
                  );
                })}
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

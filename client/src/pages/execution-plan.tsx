import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import {
  ClipboardList,
  Package,
  Activity,
  Users,
  Warehouse,
  Truck,
  ShoppingCart,
  Printer,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  ChevronLeft,
  Search,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  FileText,
  Download,
  Copy,
  Save
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Event = {
  id: string;
  title: string;
  customer: string;
  type: string;
  date: string;
  venue: string | null;
};

type ExecutionPlan = {
  id: string;
  eventId: string | null;
  title: string;
  description: string | null;
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type Employee = {
  id: string;
  name: string;
  department: string;
};

type InventoryItem = {
  id: string;
  name: string;
  category: string;
  quantity: number;
};

type Vendor = {
  id: string;
  name: string;
  category: string;
};

const SECTION_TABS = [
  { id: "checklist", label: "Checklist", icon: ClipboardList },
  { id: "items", label: "Item List", icon: Package },
  { id: "activities", label: "Production Plan", icon: Activity },
  { id: "manpower", label: "Manpower", icon: Users },
  { id: "godown-items", label: "Godown Items", icon: Warehouse },
  { id: "rentals", label: "Rentals", icon: Truck },
  { id: "purchases", label: "Purchases", icon: ShoppingCart },
  { id: "prints", label: "Prints", icon: Printer },
];

export default function ExecutionPlanPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("checklist");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newPlanTitle, setNewPlanTitle] = useState("");
  const [newPlanEventId, setNewPlanEventId] = useState<string>("");
  const [newPlanDescription, setNewPlanDescription] = useState("");
  const [eventSearchOpen, setEventSearchOpen] = useState(false);
  const [eventSearchQuery, setEventSearchQuery] = useState("");

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const { data: plans = [] } = useQuery<ExecutionPlan[]>({
    queryKey: ["/api/execution-plans"],
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const { data: inventory = [] } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory"],
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const selectedPlan = plans.find(p => p.id === selectedPlanId);
  const selectedEvent = selectedPlan?.eventId ? events.find(e => e.id === selectedPlan.eventId) : null;

  const filteredEvents = events.filter(event =>
    (event.customer || "").toLowerCase().includes(eventSearchQuery.toLowerCase()) ||
    (event.title || "").toLowerCase().includes(eventSearchQuery.toLowerCase()) ||
    (event.type || "").toLowerCase().includes(eventSearchQuery.toLowerCase()) ||
    (event.venue || "").toLowerCase().includes(eventSearchQuery.toLowerCase())
  );

  const createPlanMutation = useMutation({
    mutationFn: async (data: { title: string; eventId: string | null; description: string | null }) => {
      const res = await fetch("/api/execution-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create plan");
      return res.json();
    },
    onSuccess: (newPlan) => {
      queryClient.invalidateQueries({ queryKey: ["/api/execution-plans"] });
      setSelectedPlanId(newPlan.id);
      setIsCreateDialogOpen(false);
      setNewPlanTitle("");
      setNewPlanEventId("");
      setNewPlanDescription("");
      toast({ title: "Plan created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create plan", variant: "destructive" });
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/execution-plans/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete plan");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/execution-plans"] });
      setSelectedPlanId(null);
      toast({ title: "Plan deleted" });
    },
  });

  const handleCreatePlan = () => {
    if (!newPlanTitle.trim()) {
      toast({ title: "Please enter a plan title", variant: "destructive" });
      return;
    }
    createPlanMutation.mutate({
      title: newPlanTitle.trim(),
      eventId: newPlanEventId || null,
      description: newPlanDescription || null,
    });
  };

  if (selectedPlan) {
    return (
      <div className="h-full flex flex-col">
        <div className="border-b bg-card">
          <div className="flex items-center gap-4 p-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedPlanId(null)}
              data-testid="button-back-to-plans"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-semibold">{selectedPlan.title}</h1>
              {selectedEvent && (
                <p className="text-sm text-muted-foreground">
                  {selectedEvent.customer} - {selectedEvent.type} ({selectedEvent.date ? format(new Date(selectedEvent.date), "MMM d, yyyy") : "No date"})
                </p>
              )}
            </div>
            <Badge variant={selectedPlan.status === "active" ? "default" : "secondary"}>
              {selectedPlan.status}
            </Badge>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="px-4 flex-1 flex flex-col">
            <TabsList className="grid grid-cols-8 w-full max-w-4xl">
              {SECTION_TABS.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="text-xs px-2"
                  data-testid={`tab-${tab.id}`}
                >
                  <tab.icon className="h-3.5 w-3.5 mr-1 hidden sm:block" />
                  <span className="truncate">{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="flex-1 overflow-auto p-4">
              <TabsContent value="checklist" className="m-0 h-full">
                <ChecklistSection planId={selectedPlan.id} employees={employees} eventTitle={selectedEvent ? `${selectedEvent.customer} - ${selectedEvent.type}` : selectedPlan.title} />
              </TabsContent>
              <TabsContent value="items" className="m-0 h-full">
                <ItemListSection planId={selectedPlan.id} inventory={inventory} />
              </TabsContent>
              <TabsContent value="activities" className="m-0 h-full">
                <ActivitiesSection planId={selectedPlan.id} employees={employees} />
              </TabsContent>
              <TabsContent value="manpower" className="m-0 h-full">
                <ManpowerSection planId={selectedPlan.id} employees={employees} />
              </TabsContent>
              <TabsContent value="godown-items" className="m-0 h-full">
                <GodownItemsSection planId={selectedPlan.id} inventory={inventory} />
              </TabsContent>
              <TabsContent value="rentals" className="m-0 h-full">
                <RentalsSection planId={selectedPlan.id} vendors={vendors} />
              </TabsContent>
              <TabsContent value="purchases" className="m-0 h-full">
                <PurchasesSection planId={selectedPlan.id} vendors={vendors} />
              </TabsContent>
              <TabsContent value="prints" className="m-0 h-full">
                <PrintsSection planId={selectedPlan.id} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Event Execution Plans</h1>
          <p className="text-muted-foreground">
            Manage production checklists, item lists, manpower, and more for your events
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-plan">
              <Plus className="h-4 w-4 mr-2" />
              New Plan
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Execution Plan</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Plan Title *</Label>
                <Input
                  value={newPlanTitle}
                  onChange={(e) => setNewPlanTitle(e.target.value)}
                  placeholder="e.g., Wedding Production Plan"
                  data-testid="input-plan-title"
                />
              </div>
              <div className="space-y-2">
                <Label>Link to Event (Optional)</Label>
                <Popover open={eventSearchOpen} onOpenChange={setEventSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                      data-testid="button-select-event"
                    >
                      {newPlanEventId
                        ? events.find(e => e.id === newPlanEventId)?.title || "Select event..."
                        : "Select event..."}
                      <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput
                        placeholder="Search events..."
                        value={eventSearchQuery}
                        onValueChange={setEventSearchQuery}
                      />
                      <CommandList>
                        <CommandEmpty>No events found.</CommandEmpty>
                        <CommandGroup>
                          {filteredEvents.slice(0, 10).map((event) => (
                            <CommandItem
                              key={event.id}
                              value={event.id}
                              onSelect={() => {
                                setNewPlanEventId(event.id);
                                setEventSearchOpen(false);
                              }}
                            >
                              <div className="flex flex-col">
                                <span className="font-medium">{event.title}</span>
                                <span className="text-xs text-muted-foreground">
                                  {event.customer} - {event.date ? format(new Date(event.date), "MMM d, yyyy") : "No date"}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={newPlanDescription}
                  onChange={(e) => setNewPlanDescription(e.target.value)}
                  placeholder="Optional notes about this plan..."
                  rows={3}
                  data-testid="input-plan-description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreatePlan} disabled={createPlanMutation.isPending}>
                Create Plan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => {
          const event = plan.eventId ? events.find(e => e.id === plan.eventId) : null;
          return (
            <Card
              key={plan.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedPlanId(plan.id)}
              data-testid={`card-plan-${plan.id}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{plan.title}</CardTitle>
                  <Badge variant={plan.status === "active" ? "default" : "secondary"}>
                    {plan.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {event && (
                  <div className="text-sm text-muted-foreground mb-2">
                    <div className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      {event.customer}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {event.date ? format(new Date(event.date), "MMM d, yyyy") : "No date"}
                    </div>
                  </div>
                )}
                {plan.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {plan.description}
                  </p>
                )}
                <div className="text-xs text-muted-foreground mt-3">
                  Created {format(new Date(plan.createdAt), "MMM d, yyyy")}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {plans.length === 0 && (
          <Card className="col-span-full p-8 text-center">
            <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No execution plans yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first execution plan to start organizing your event production
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Plan
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}

const CHECKLIST_TEMPLATE = [
  { isSection: true, itemDescription: "COMMON LIGHTING & FLOATING DECOR" },
  { slNo: 1, itemDescription: "Mirchi lights for 2 days", quantity: 1 },
  { slNo: 2, itemDescription: "Green MH - 30no.s for 2 days", quantity: 1 },
  { slNo: 3, itemDescription: "Pillar to pillar decor with Mariegold hangings and drapes", quantity: 10 },
  { slNo: 4, itemDescription: "Event itinerary board", quantity: 1 },
  { isSection: true, itemDescription: "HALDI (COURTYARD)" },
  { slNo: 5, itemDescription: "Welcome board - Option 1 (as per design)", quantity: 1 },
  { slNo: 6, itemDescription: "Petal station (petals on table)", quantity: 1 },
  { slNo: 7, itemDescription: "Theme props with fresh flowers - Option 2", quantity: 8 },
  { slNo: 8, itemDescription: "Tender coconut cart with decoration", quantity: 1 },
  { slNo: 9, itemDescription: "Tender coconuts", quantity: 50 },
  { slNo: 10, itemDescription: "Tree decor : Mariegold - 100pcs (10ft each)", quantity: 1 },
  { isSection: true, itemDescription: "HALDI STAGE" },
  { slNo: 11, itemDescription: "Haldi stage - Option 1 (as per design fresh & artificial flower mix)", quantity: 1 },
  { slNo: 12, itemDescription: "Platform & platform masking with flex", quantity: 1 },
  { isSection: true, itemDescription: "SEATING" },
  { slNo: 13, itemDescription: "Tent - 10x10ft", quantity: 4 },
  { slNo: 14, itemDescription: "Bench with cushion", quantity: 8 },
  { slNo: 15, itemDescription: "Cylinder cushion seats", quantity: 16 },
  { slNo: 16, itemDescription: "Chair Bow - Organza material", quantity: 30 },
  { isSection: true, itemDescription: "ENTERTAINMENTS FOR HALDI" },
  { slNo: 17, itemDescription: "Emcee", quantity: 1 },
  { slNo: 18, itemDescription: "DJ with Sound", quantity: 1 },
  { slNo: 19, itemDescription: "Karaoke setup", quantity: 1 },
];

function ChecklistSection({ planId, employees, eventTitle }: { planId: string; employees: Employee[]; eventTitle?: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<{ itemDescription: string; quantity: number; vendorName: string }>({ itemDescription: "", quantity: 1, vendorName: "" });
  const [newItem, setNewItem] = useState({ 
    itemDescription: "", 
    quantity: 1, 
    vendorName: "",
    sectionLabel: ""
  });
  const [newSection, setNewSection] = useState("");

  const { data: items = [] } = useQuery({
    queryKey: [`/api/execution-plans/${planId}/checklist`],
  });

  const { data: allPlans = [] } = useQuery({
    queryKey: ['/api/execution-plans'],
  });

  const addItemMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/execution-plans/${planId}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to add item");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/execution-plans/${planId}/checklist`] });
      setIsAddingItem(false);
      setIsAddingSection(false);
      setNewItem({ itemDescription: "", quantity: 1, vendorName: "", sectionLabel: "" });
      setNewSection("");
      toast({ title: "Item added" });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/execution-plan-checklist/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update item");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/execution-plans/${planId}/checklist`] });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/execution-plan-checklist/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete item");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/execution-plans/${planId}/checklist`] });
      toast({ title: "Item deleted" });
    },
  });

  const handleAddItem = () => {
    const maxSlNo = (items as any[]).filter(i => !i.isSection).reduce((max, i) => Math.max(max, i.slNo || 0), 0);
    addItemMutation.mutate({
      ...newItem,
      slNo: maxSlNo + 1,
      isSection: false,
      sortOrder: (items as any[]).length
    });
  };

  const handleAddSection = () => {
    addItemMutation.mutate({
      itemDescription: newSection,
      isSection: true,
      sortOrder: (items as any[]).length
    });
  };

  const loadTemplateMutation = useMutation({
    mutationFn: async () => {
      let sortOrder = (items as any[]).length;
      const templateItems = CHECKLIST_TEMPLATE.map((item, index) => ({
        ...item,
        isSection: item.isSection || false,
        isChecked: false,
        sortOrder: sortOrder + index
      }));
      const res = await fetch(`/api/execution-plans/${planId}/checklist/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: templateItems }),
      });
      if (!res.ok) throw new Error("Failed to load template");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/execution-plans/${planId}/checklist`] });
      setShowTemplateDialog(false);
      toast({ title: "Template loaded successfully", description: `${data.count} items added` });
    },
    onError: () => {
      toast({ title: "Failed to load template", variant: "destructive" });
    }
  });

  const handleLoadTemplate = () => {
    loadTemplateMutation.mutate();
  };

  const cloneFromPlanMutation = useMutation({
    mutationFn: async (sourcePlanId: string) => {
      const sourceRes = await fetch(`/api/execution-plans/${sourcePlanId}/checklist`);
      if (!sourceRes.ok) throw new Error("Failed to fetch source checklist");
      const sourceItems = await sourceRes.json();
      
      if (sourceItems.length === 0) throw new Error("Source checklist is empty");
      
      let sortOrder = (items as any[]).length;
      let slNoCounter = (items as any[]).filter((i: any) => !i.isSection).length;
      const clonedItems = sourceItems.map((item: any, index: number) => {
        const isSection = item.isSection || false;
        if (!isSection) {
          slNoCounter++;
        }
        return {
          itemDescription: item.itemDescription,
          quantity: item.quantity || 1,
          vendorName: item.vendorName || "",
          isSection: isSection,
          slNo: isSection ? null : slNoCounter,
          isChecked: false,
          sortOrder: sortOrder + index
        };
      });
      
      const res = await fetch(`/api/execution-plans/${planId}/checklist/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: clonedItems }),
      });
      if (!res.ok) throw new Error("Failed to clone checklist");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/execution-plans/${planId}/checklist`] });
      setShowCloneDialog(false);
      toast({ title: "Checklist cloned successfully", description: `${data.count} items copied` });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to clone checklist", variant: "destructive" });
    }
  });

  const startEditing = (item: any) => {
    setEditingId(item.id);
    setEditingData({
      itemDescription: item.itemDescription || "",
      quantity: item.quantity || 1,
      vendorName: item.vendorName || ""
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingData({ itemDescription: "", quantity: 1, vendorName: "" });
  };

  const saveEditing = (item: any) => {
    updateItemMutation.mutate({
      id: item.id,
      data: {
        ...editingData,
        sectionLabel: item.sectionLabel,
        isSection: item.isSection,
        sortOrder: item.sortOrder,
        slNo: item.slNo
      }
    }, {
      onSuccess: () => {
        setEditingId(null);
        setEditingData({ itemDescription: "", quantity: 1, vendorName: "" });
        toast({ title: "Item updated" });
      }
    });
  };

  const toggleStatus = (item: any) => {
    updateItemMutation.mutate({ 
      id: item.id, 
      data: { isChecked: !item.isChecked } 
    });
  };

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const { jsPDF } = await import("jspdf");
      await import("jspdf-autotable");
      
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Header with gradient effect
      doc.setFillColor(139, 90, 43); // Oak brown
      doc.rect(0, 0, pageWidth, 35, "F");
      
      // Company name
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("OAK & GOLD", 14, 18);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Event Management", 14, 25);
      
      // Title
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.text("PRODUCTION CHECKLIST", pageWidth - 14, 18, { align: "right" });
      if (eventTitle) {
        doc.setFontSize(10);
        doc.text(eventTitle, pageWidth - 14, 25, { align: "right" });
      }
      
      // Date
      doc.setFontSize(8);
      doc.text(`Generated: ${format(new Date(), "PPP")}`, pageWidth - 14, 32, { align: "right" });
      
      // Table data
      const sortedItems = (items as any[]).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      const tableData: any[] = [];
      
      sortedItems.forEach((item: any) => {
        if (item.isSection) {
          tableData.push([{ content: item.itemDescription, colSpan: 5, styles: { fillColor: [139, 90, 43], textColor: [255, 255, 255], fontStyle: "bold", halign: "left" } }]);
        } else {
          tableData.push([
            item.slNo || "",
            item.itemDescription || "",
            item.quantity || "",
            item.vendorName || "-",
            item.isChecked ? "✓ Completed" : "○ Pending"
          ]);
        }
      });
      
      (doc as any).autoTable({
        startY: 42,
        head: [["Sl No", "Item & Description", "Qty", "Vendor", "Status"]],
        body: tableData,
        theme: "grid",
        headStyles: { fillColor: [51, 51, 51], textColor: [255, 255, 255], fontStyle: "bold" },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 15, halign: "center" },
          1: { cellWidth: "auto" },
          2: { cellWidth: 15, halign: "center" },
          3: { cellWidth: 35 },
          4: { cellWidth: 30, halign: "center" }
        },
        alternateRowStyles: { fillColor: [248, 248, 248] },
        didParseCell: function(data: any) {
          if (data.section === "body" && data.column.index === 4) {
            if (data.cell.raw === "✓ Completed") {
              data.cell.styles.textColor = [34, 139, 34];
              data.cell.styles.fontStyle = "bold";
            } else {
              data.cell.styles.textColor = [200, 150, 50];
            }
          }
        }
      });
      
      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: "center" });
      }
      
      doc.save(`Checklist_${eventTitle || "Production"}_${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast({ title: "PDF downloaded successfully" });
    } catch (error) {
      toast({ title: "Failed to generate PDF", variant: "destructive" });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const sortedItems = (items as any[]).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  const filteredItems = filter === "all" 
    ? sortedItems 
    : sortedItems.filter(item => item.isSection || (filter === "completed" ? item.isChecked : !item.isChecked));
  
  const totalItems = sortedItems.filter(i => !i.isSection).length;
  const completedItems = sortedItems.filter(i => !i.isSection && i.isChecked).length;
  const pendingItems = totalItems - completedItems;
  const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Header with Logo and Actions */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-xl p-4 border border-amber-200/50 dark:border-amber-800/30">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center text-white font-bold text-lg shadow-lg">
              O&G
            </div>
            <div>
              <h2 className="text-xl font-bold text-amber-900 dark:text-amber-100">Production Checklist</h2>
              <p className="text-sm text-amber-700 dark:text-amber-300">Oak & Gold Event Management</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => setShowTemplateDialog(true)}
              className="border-amber-300 hover:bg-amber-100"
              data-testid="button-load-template"
            >
              <FileText className="h-4 w-4 mr-1" />
              Load Template
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => setShowCloneDialog(true)}
              className="border-amber-300 hover:bg-amber-100"
              data-testid="button-clone-checklist"
            >
              <Copy className="h-4 w-4 mr-1" />
              Clone From Plan
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf || sortedItems.length === 0}
              className="border-amber-300 hover:bg-amber-100"
              data-testid="button-download-pdf"
            >
              <Download className="h-4 w-4 mr-1" />
              {isGeneratingPdf ? "Generating..." : "Download PDF"}
            </Button>
          </div>
        </div>
        
        {/* Progress Bar */}
        {totalItems > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-amber-800 dark:text-amber-200 font-medium">Progress</span>
              <span className="text-amber-700 dark:text-amber-300">{completedItems} of {totalItems} completed ({progressPercent}%)</span>
            </div>
            <div className="h-2 bg-amber-200 dark:bg-amber-900 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Action Bar */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
            className="text-xs"
          >
            All ({totalItems})
          </Button>
          <Button
            size="sm"
            variant={filter === "pending" ? "default" : "outline"}
            onClick={() => setFilter("pending")}
            className={cn("text-xs", filter === "pending" && "bg-amber-600 hover:bg-amber-700")}
          >
            <Clock className="h-3 w-3 mr-1" />
            Pending ({pendingItems})
          </Button>
          <Button
            size="sm"
            variant={filter === "completed" ? "default" : "outline"}
            onClick={() => setFilter("completed")}
            className={cn("text-xs", filter === "completed" && "bg-green-600 hover:bg-green-700")}
          >
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Completed ({completedItems})
          </Button>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setIsAddingSection(true)} data-testid="button-add-section">
            <Plus className="h-4 w-4 mr-1" />
            Section
          </Button>
          <Button size="sm" onClick={() => setIsAddingItem(true)} data-testid="button-add-checklist">
            <Plus className="h-4 w-4 mr-1" />
            Item
          </Button>
        </div>
      </div>

      {/* Template Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Load Checklist Template</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground mb-4">
              This will add a pre-made template with common wedding/event items to your checklist. 
              Existing items will not be affected.
            </p>
            <div className="bg-muted/50 rounded-lg p-3 max-h-48 overflow-y-auto text-sm">
              <p className="font-semibold mb-2">Template includes:</p>
              <ul className="space-y-1">
                <li>• Common Lighting & Floating Decor (4 items)</li>
                <li>• Haldi Courtyard Setup (6 items)</li>
                <li>• Haldi Stage (2 items)</li>
                <li>• Seating Arrangements (4 items)</li>
                <li>• Entertainment Setup (3 items)</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>Cancel</Button>
            <Button onClick={handleLoadTemplate} disabled={loadTemplateMutation.isPending}>
              {loadTemplateMutation.isPending ? "Loading..." : "Load Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clone Dialog */}
      <Dialog open={showCloneDialog} onOpenChange={setShowCloneDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Clone Checklist from Another Plan</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground mb-4">
              Select an execution plan to copy its checklist items to this plan. All items will be copied with status reset to Pending.
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {(allPlans as any[]).filter(p => p.id !== planId).map((plan: any) => (
                <Button
                  key={plan.id}
                  variant="outline"
                  className="w-full justify-start text-left h-auto py-3"
                  onClick={() => cloneFromPlanMutation.mutate(plan.id)}
                  disabled={cloneFromPlanMutation.isPending}
                  data-testid={`clone-plan-${plan.id}`}
                >
                  <div>
                    <div className="font-medium">{plan.title}</div>
                    <div className="text-xs text-muted-foreground">
                      Created {format(new Date(plan.createdAt), "MMM d, yyyy")}
                    </div>
                  </div>
                </Button>
              ))}
              {(allPlans as any[]).filter(p => p.id !== planId).length === 0 && (
                <p className="text-center text-muted-foreground py-4">No other execution plans available to clone from</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloneDialog(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isAddingSection && (
        <Card className="p-4 border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
          <div className="space-y-3">
            <Label className="font-semibold">Section Header</Label>
            <Input
              placeholder="e.g., COMMON LIGHTING & DECOR, 21st Nov - HALDI"
              value={newSection}
              onChange={(e) => setNewSection(e.target.value)}
              className="border-amber-300"
              data-testid="input-section-name"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setIsAddingSection(false); setNewSection(""); }}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleAddSection} disabled={!newSection.trim()}>
                Add Section
              </Button>
            </div>
          </div>
        </Card>
      )}

      {isAddingItem && (
        <Card className="p-4 border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <Label className="font-semibold">Item Description *</Label>
              <Input
                placeholder="e.g., Mirchi lights for 2 days"
                value={newItem.itemDescription}
                onChange={(e) => setNewItem({ ...newItem, itemDescription: e.target.value })}
                data-testid="input-checklist-description"
              />
            </div>
            <div>
              <Label className="font-semibold">Quantity</Label>
              <Input
                type="number"
                min={1}
                value={newItem.quantity}
                onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                data-testid="input-checklist-quantity"
              />
            </div>
            <div>
              <Label className="font-semibold">Vendor</Label>
              <Input
                placeholder="Vendor name"
                value={newItem.vendorName}
                onChange={(e) => setNewItem({ ...newItem, vendorName: e.target.value })}
                data-testid="input-checklist-vendor"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" size="sm" onClick={() => { setIsAddingItem(false); setNewItem({ itemDescription: "", quantity: 1, vendorName: "", sectionLabel: "" }); }}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleAddItem} disabled={!newItem.itemDescription.trim()}>
              Add Item
            </Button>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900">
              <TableHead className="w-16 font-bold">Sl No</TableHead>
              <TableHead className="font-bold">Item & Description</TableHead>
              <TableHead className="w-20 text-center font-bold">Qty</TableHead>
              <TableHead className="w-36 font-bold">Vendor</TableHead>
              <TableHead className="w-32 text-center font-bold">Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  <div className="flex flex-col items-center">
                    <div className="h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
                      <ClipboardList className="h-8 w-8 text-amber-600" />
                    </div>
                    <h3 className="font-semibold text-lg mb-1">No checklist items yet</h3>
                    <p className="text-sm mb-4">Load a template or add items manually to get started</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setShowTemplateDialog(true)}>
                        <FileText className="h-4 w-4 mr-1" />
                        Load Template
                      </Button>
                      <Button size="sm" onClick={() => setIsAddingItem(true)}>
                        <Plus className="h-4 w-4 mr-1" />
                        Add Item
                      </Button>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item: any, index: number) => (
                item.isSection ? (
                  <TableRow key={item.id} className="bg-gradient-to-r from-amber-100 to-amber-50 dark:from-amber-900/40 dark:to-amber-900/20 hover:from-amber-150" data-testid={`checklist-section-${item.id}`}>
                    <TableCell colSpan={6} className="py-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-800 dark:text-amber-200 uppercase tracking-wide text-sm">
                          {item.itemDescription}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                          onClick={() => deleteItemMutation.mutate(item.id)}
                          data-testid={`button-delete-section-${item.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : editingId === item.id ? (
                  <TableRow 
                    key={item.id} 
                    className="bg-blue-50/70 dark:bg-blue-950/30"
                    data-testid={`checklist-item-editing-${item.id}`}
                  >
                    <TableCell className="font-semibold text-center text-slate-600 dark:text-slate-400">{item.slNo}</TableCell>
                    <TableCell>
                      <Input
                        value={editingData.itemDescription}
                        onChange={(e) => setEditingData({ ...editingData, itemDescription: e.target.value })}
                        className="h-8 text-sm"
                        data-testid={`input-edit-description-${item.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        value={editingData.quantity}
                        onChange={(e) => setEditingData({ ...editingData, quantity: parseInt(e.target.value) || 1 })}
                        className="h-8 text-sm w-16"
                        data-testid={`input-edit-quantity-${item.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={editingData.vendorName}
                        onChange={(e) => setEditingData({ ...editingData, vendorName: e.target.value })}
                        placeholder="Vendor"
                        className="h-8 text-sm"
                        data-testid={`input-edit-vendor-${item.id}`}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-1">
                        <Button
                          size="icon"
                          className="h-7 w-7 bg-green-600 hover:bg-green-700"
                          onClick={() => saveEditing(item)}
                          data-testid={`button-save-edit-${item.id}`}
                        >
                          <Save className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          onClick={cancelEditing}
                          data-testid={`button-cancel-edit-${item.id}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                ) : (
                  <TableRow 
                    key={item.id} 
                    className={cn(
                      "transition-colors group",
                      item.isChecked 
                        ? "bg-green-50/70 dark:bg-green-950/30" 
                        : index % 2 === 0 ? "bg-white dark:bg-slate-950" : "bg-slate-50/50 dark:bg-slate-900/50"
                    )}
                    data-testid={`checklist-item-${item.id}`}
                  >
                    <TableCell className="font-semibold text-center text-slate-600 dark:text-slate-400">{item.slNo}</TableCell>
                    <TableCell 
                      className={cn("font-medium cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded", item.isChecked && "line-through text-muted-foreground")}
                      onClick={() => startEditing(item)}
                      data-testid={`cell-description-${item.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{item.itemDescription}</span>
                        <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-50 ml-2" />
                      </div>
                    </TableCell>
                    <TableCell 
                      className="text-center font-medium cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded"
                      onClick={() => startEditing(item)}
                    >
                      {item.quantity}
                    </TableCell>
                    <TableCell 
                      className="text-sm text-muted-foreground cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded"
                      onClick={() => startEditing(item)}
                    >
                      {item.vendorName || "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant={item.isChecked ? "default" : "outline"}
                        size="sm"
                        className={cn(
                          "w-28 text-xs font-medium shadow-sm",
                          item.isChecked 
                            ? "bg-green-600 hover:bg-green-700 text-white" 
                            : "border-amber-400 text-amber-700 hover:bg-amber-50 hover:border-amber-500"
                        )}
                        onClick={() => toggleStatus(item)}
                        data-testid={`button-status-${item.id}`}
                      >
                        {item.isChecked ? (
                          <><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Completed</>
                        ) : (
                          <><Clock className="h-3.5 w-3.5 mr-1" /> Pending</>
                        )}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                        onClick={() => deleteItemMutation.mutate(item.id)}
                        data-testid={`button-delete-checklist-${item.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function ItemListSection({ planId, inventory }: { planId: string; inventory: InventoryItem[] }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItem, setNewItem] = useState({ itemName: "", quantity: 1, category: "" });

  const { data: items = [] } = useQuery({
    queryKey: [`/api/execution-plans/${planId}/items`],
  });

  const addItemMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/execution-plans/${planId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to add item");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/execution-plans/${planId}/items`] });
      setIsAddingItem(false);
      setNewItem({ itemName: "", quantity: 1, category: "" });
      toast({ title: "Item added" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/execution-plan-items/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete item");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/execution-plans/${planId}/items`] });
      toast({ title: "Item deleted" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Item List</h2>
        <Button size="sm" onClick={() => setIsAddingItem(true)} data-testid="button-add-item">
          <Plus className="h-4 w-4 mr-1" />
          Add Item
        </Button>
      </div>

      {isAddingItem && (
        <Card className="p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              placeholder="Item name"
              value={newItem.itemName}
              onChange={(e) => setNewItem({ ...newItem, itemName: e.target.value })}
              data-testid="input-item-name"
            />
            <Input
              type="number"
              placeholder="Qty"
              value={newItem.quantity}
              onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })}
              data-testid="input-item-quantity"
            />
            <Input
              placeholder="Category"
              value={newItem.category}
              onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
              data-testid="input-item-category"
            />
          </div>
          <div className="flex gap-2 mt-3 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setIsAddingItem(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => addItemMutation.mutate(newItem)} disabled={!newItem.itemName}>
              Add
            </Button>
          </div>
        </Card>
      )}

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-medium">Item</th>
              <th className="px-4 py-2 text-left text-sm font-medium">Category</th>
              <th className="px-4 py-2 text-center text-sm font-medium">Qty</th>
              <th className="px-4 py-2 text-center text-sm font-medium w-20">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(items as any[]).map((item: any) => (
              <tr key={item.id} data-testid={`row-item-${item.id}`}>
                <td className="px-4 py-2">{item.itemName}</td>
                <td className="px-4 py-2 text-muted-foreground">{item.category || "-"}</td>
                <td className="px-4 py-2 text-center">{item.quantity}</td>
                <td className="px-4 py-2 text-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => deleteItemMutation.mutate(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(items as any[]).length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>No items yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ActivitiesSection({ planId, employees }: { planId: string; employees: Employee[] }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItem, setNewItem] = useState({ activity: "", startTime: "", endTime: "", assignedTo: "" });

  const { data: items = [] } = useQuery({
    queryKey: [`/api/execution-plans/${planId}/activities`],
  });

  const addItemMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/execution-plans/${planId}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to add");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/execution-plans/${planId}/activities`] });
      setIsAddingItem(false);
      setNewItem({ activity: "", startTime: "", endTime: "", assignedTo: "" });
      toast({ title: "Activity added" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/execution-plan-activities/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/execution-plans/${planId}/activities`] });
      toast({ title: "Activity deleted" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Production Plan / Activities</h2>
        <Button size="sm" onClick={() => setIsAddingItem(true)} data-testid="button-add-activity">
          <Plus className="h-4 w-4 mr-1" />
          Add Activity
        </Button>
      </div>

      {isAddingItem && (
        <Card className="p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              placeholder="Activity description"
              value={newItem.activity}
              onChange={(e) => setNewItem({ ...newItem, activity: e.target.value })}
              className="sm:col-span-2"
              data-testid="input-activity-desc"
            />
            <Input
              type="time"
              placeholder="Start time"
              value={newItem.startTime}
              onChange={(e) => setNewItem({ ...newItem, startTime: e.target.value })}
              data-testid="input-activity-start"
            />
            <Input
              type="time"
              placeholder="End time"
              value={newItem.endTime}
              onChange={(e) => setNewItem({ ...newItem, endTime: e.target.value })}
              data-testid="input-activity-end"
            />
          </div>
          <div className="flex gap-2 mt-3 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setIsAddingItem(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => addItemMutation.mutate(newItem)} disabled={!newItem.activity}>
              Add
            </Button>
          </div>
        </Card>
      )}

      <div className="space-y-2">
        {(items as any[]).map((item: any) => (
          <Card key={item.id} className="p-3" data-testid={`activity-${item.id}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{item.activity}</p>
                <p className="text-sm text-muted-foreground">
                  {item.startTime && item.endTime ? `${item.startTime} - ${item.endTime}` : "No time set"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => deleteItemMutation.mutate(item.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
        {(items as any[]).length === 0 && !isAddingItem && (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>No activities yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ManpowerSection({ planId, employees }: { planId: string; employees: Employee[] }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItem, setNewItem] = useState({ role: "", quantity: 1, employeeId: "", notes: "" });

  const { data: items = [] } = useQuery({
    queryKey: [`/api/execution-plans/${planId}/manpower`],
  });

  const addItemMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/execution-plans/${planId}/manpower`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to add");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/execution-plans/${planId}/manpower`] });
      setIsAddingItem(false);
      setNewItem({ role: "", quantity: 1, employeeId: "", notes: "" });
      toast({ title: "Manpower added" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/execution-plan-manpower/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/execution-plans/${planId}/manpower`] });
      toast({ title: "Item deleted" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Manpower</h2>
        <Button size="sm" onClick={() => setIsAddingItem(true)} data-testid="button-add-manpower">
          <Plus className="h-4 w-4 mr-1" />
          Add Manpower
        </Button>
      </div>

      {isAddingItem && (
        <Card className="p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              placeholder="Role (e.g., Setup Crew)"
              value={newItem.role}
              onChange={(e) => setNewItem({ ...newItem, role: e.target.value })}
              data-testid="input-manpower-role"
            />
            <Input
              type="number"
              placeholder="Count"
              value={newItem.quantity}
              onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })}
              data-testid="input-manpower-count"
            />
            <Select value={newItem.employeeId} onValueChange={(v) => setNewItem({ ...newItem, employeeId: v })}>
              <SelectTrigger data-testid="select-manpower-employee">
                <SelectValue placeholder="Assign employee..." />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 mt-3 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setIsAddingItem(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => addItemMutation.mutate(newItem)} disabled={!newItem.role}>
              Add
            </Button>
          </div>
        </Card>
      )}

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-medium">Role</th>
              <th className="px-4 py-2 text-center text-sm font-medium">Count</th>
              <th className="px-4 py-2 text-left text-sm font-medium">Assigned To</th>
              <th className="px-4 py-2 text-center text-sm font-medium w-20">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(items as any[]).map((item: any) => (
              <tr key={item.id} data-testid={`row-manpower-${item.id}`}>
                <td className="px-4 py-2">{item.role}</td>
                <td className="px-4 py-2 text-center">{item.quantity}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {employees.find(e => e.id === item.employeeId)?.name || "-"}
                </td>
                <td className="px-4 py-2 text-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => deleteItemMutation.mutate(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(items as any[]).length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>No manpower assigned yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

function GodownItemsSection({ planId, inventory }: { planId: string; inventory: InventoryItem[] }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItem, setNewItem] = useState({ itemName: "", quantity: 1, inventoryId: "" });

  const { data: items = [] } = useQuery({
    queryKey: [`/api/execution-plans/${planId}/godown-items`],
  });

  const addItemMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/execution-plans/${planId}/godown-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to add");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/execution-plans/${planId}/godown-items`] });
      setIsAddingItem(false);
      setNewItem({ itemName: "", quantity: 1, inventoryId: "" });
      toast({ title: "Godown item added" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/execution-plan-godown-items/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/execution-plans/${planId}/godown-items`] });
      toast({ title: "Item deleted" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Godown Items (From Inventory)</h2>
        <Button size="sm" onClick={() => setIsAddingItem(true)} data-testid="button-add-godown">
          <Plus className="h-4 w-4 mr-1" />
          Add Item
        </Button>
      </div>

      {isAddingItem && (
        <Card className="p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Select value={newItem.inventoryId} onValueChange={(v) => {
              const inv = inventory.find(i => i.id === v);
              setNewItem({ ...newItem, inventoryId: v, itemName: inv?.name || "" });
            }}>
              <SelectTrigger className="sm:col-span-2" data-testid="select-godown-item">
                <SelectValue placeholder="Select inventory item..." />
              </SelectTrigger>
              <SelectContent>
                {inventory.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name} ({item.quantity} available)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="Qty"
              value={newItem.quantity}
              onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })}
              data-testid="input-godown-qty"
            />
          </div>
          <div className="flex gap-2 mt-3 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setIsAddingItem(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => addItemMutation.mutate(newItem)} disabled={!newItem.inventoryId}>
              Add
            </Button>
          </div>
        </Card>
      )}

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-medium">Item</th>
              <th className="px-4 py-2 text-center text-sm font-medium">Qty</th>
              <th className="px-4 py-2 text-left text-sm font-medium">Status</th>
              <th className="px-4 py-2 text-center text-sm font-medium w-20">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(items as any[]).map((item: any) => (
              <tr key={item.id} data-testid={`row-godown-${item.id}`}>
                <td className="px-4 py-2">{item.itemName}</td>
                <td className="px-4 py-2 text-center">{item.quantity}</td>
                <td className="px-4 py-2">
                  <Badge variant={item.status === "dispatched" ? "default" : "secondary"}>
                    {item.status || "pending"}
                  </Badge>
                </td>
                <td className="px-4 py-2 text-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => deleteItemMutation.mutate(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(items as any[]).length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Warehouse className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>No godown items yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

function RentalsSection({ planId, vendors }: { planId: string; vendors: Vendor[] }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItem, setNewItem] = useState({ itemName: "", quantity: 1, vendorId: "", rate: 0 });

  const { data: items = [] } = useQuery({
    queryKey: [`/api/execution-plans/${planId}/rentals`],
  });

  const addItemMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/execution-plans/${planId}/rentals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to add");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/execution-plans/${planId}/rentals`] });
      setIsAddingItem(false);
      setNewItem({ itemName: "", quantity: 1, vendorId: "", rate: 0 });
      toast({ title: "Rental added" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/execution-plan-rentals/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/execution-plans/${planId}/rentals`] });
      toast({ title: "Rental deleted" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Rentals</h2>
        <Button size="sm" onClick={() => setIsAddingItem(true)} data-testid="button-add-rental">
          <Plus className="h-4 w-4 mr-1" />
          Add Rental
        </Button>
      </div>

      {isAddingItem && (
        <Card className="p-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <Input
              placeholder="Item name"
              value={newItem.itemName}
              onChange={(e) => setNewItem({ ...newItem, itemName: e.target.value })}
              className="sm:col-span-2"
              data-testid="input-rental-name"
            />
            <Input
              type="number"
              placeholder="Qty"
              value={newItem.quantity}
              onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })}
              data-testid="input-rental-qty"
            />
            <Input
              type="number"
              placeholder="Rate"
              value={newItem.rate || ""}
              onChange={(e) => setNewItem({ ...newItem, rate: Number(e.target.value) })}
              data-testid="input-rental-rate"
            />
          </div>
          <div className="flex gap-2 mt-3 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setIsAddingItem(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => addItemMutation.mutate(newItem)} disabled={!newItem.itemName}>
              Add
            </Button>
          </div>
        </Card>
      )}

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-medium">Item</th>
              <th className="px-4 py-2 text-center text-sm font-medium">Qty</th>
              <th className="px-4 py-2 text-right text-sm font-medium">Rate</th>
              <th className="px-4 py-2 text-right text-sm font-medium">Total</th>
              <th className="px-4 py-2 text-center text-sm font-medium w-20">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(items as any[]).map((item: any) => (
              <tr key={item.id} data-testid={`row-rental-${item.id}`}>
                <td className="px-4 py-2">{item.itemName}</td>
                <td className="px-4 py-2 text-center">{item.quantity}</td>
                <td className="px-4 py-2 text-right">₹{item.rate || 0}</td>
                <td className="px-4 py-2 text-right font-medium">₹{(item.quantity || 0) * (item.rate || 0)}</td>
                <td className="px-4 py-2 text-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => deleteItemMutation.mutate(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(items as any[]).length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Truck className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>No rentals yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PurchasesSection({ planId, vendors }: { planId: string; vendors: Vendor[] }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItem, setNewItem] = useState({ itemName: "", quantity: 1, vendorId: "", estimatedCost: 0 });

  const { data: items = [] } = useQuery({
    queryKey: [`/api/execution-plans/${planId}/purchases`],
  });

  const addItemMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/execution-plans/${planId}/purchases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to add");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/execution-plans/${planId}/purchases`] });
      setIsAddingItem(false);
      setNewItem({ itemName: "", quantity: 1, vendorId: "", estimatedCost: 0 });
      toast({ title: "Purchase added" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/execution-plan-purchases/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/execution-plans/${planId}/purchases`] });
      toast({ title: "Purchase deleted" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Purchases</h2>
        <Button size="sm" onClick={() => setIsAddingItem(true)} data-testid="button-add-purchase">
          <Plus className="h-4 w-4 mr-1" />
          Add Purchase
        </Button>
      </div>

      {isAddingItem && (
        <Card className="p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              placeholder="Item name"
              value={newItem.itemName}
              onChange={(e) => setNewItem({ ...newItem, itemName: e.target.value })}
              data-testid="input-purchase-name"
            />
            <Input
              type="number"
              placeholder="Qty"
              value={newItem.quantity}
              onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })}
              data-testid="input-purchase-qty"
            />
            <Input
              type="number"
              placeholder="Est. Cost"
              value={newItem.estimatedCost || ""}
              onChange={(e) => setNewItem({ ...newItem, estimatedCost: Number(e.target.value) })}
              data-testid="input-purchase-cost"
            />
          </div>
          <div className="flex gap-2 mt-3 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setIsAddingItem(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => addItemMutation.mutate(newItem)} disabled={!newItem.itemName}>
              Add
            </Button>
          </div>
        </Card>
      )}

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-medium">Item</th>
              <th className="px-4 py-2 text-center text-sm font-medium">Qty</th>
              <th className="px-4 py-2 text-right text-sm font-medium">Est. Cost</th>
              <th className="px-4 py-2 text-left text-sm font-medium">Status</th>
              <th className="px-4 py-2 text-center text-sm font-medium w-20">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(items as any[]).map((item: any) => (
              <tr key={item.id} data-testid={`row-purchase-${item.id}`}>
                <td className="px-4 py-2">{item.itemName}</td>
                <td className="px-4 py-2 text-center">{item.quantity}</td>
                <td className="px-4 py-2 text-right">₹{item.estimatedCost || 0}</td>
                <td className="px-4 py-2">
                  <Badge variant={item.status === "purchased" ? "default" : "secondary"}>
                    {item.status || "pending"}
                  </Badge>
                </td>
                <td className="px-4 py-2 text-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => deleteItemMutation.mutate(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(items as any[]).length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>No purchases yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PrintsSection({ planId }: { planId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItem, setNewItem] = useState({ printType: "", description: "", quantity: 1, size: "" });

  const { data: items = [] } = useQuery({
    queryKey: [`/api/execution-plans/${planId}/prints`],
  });

  const addItemMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/execution-plans/${planId}/prints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to add");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/execution-plans/${planId}/prints`] });
      setIsAddingItem(false);
      setNewItem({ printType: "", description: "", quantity: 1, size: "" });
      toast({ title: "Print item added" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/execution-plan-prints/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/execution-plans/${planId}/prints`] });
      toast({ title: "Print item deleted" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Prints</h2>
        <Button size="sm" onClick={() => setIsAddingItem(true)} data-testid="button-add-print">
          <Plus className="h-4 w-4 mr-1" />
          Add Print
        </Button>
      </div>

      {isAddingItem && (
        <Card className="p-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <Input
              placeholder="Print type (e.g., Banner)"
              value={newItem.printType}
              onChange={(e) => setNewItem({ ...newItem, printType: e.target.value })}
              data-testid="input-print-type"
            />
            <Input
              placeholder="Description"
              value={newItem.description}
              onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
              data-testid="input-print-desc"
            />
            <Input
              placeholder="Size (e.g., 6x3 ft)"
              value={newItem.size}
              onChange={(e) => setNewItem({ ...newItem, size: e.target.value })}
              data-testid="input-print-size"
            />
            <Input
              type="number"
              placeholder="Qty"
              value={newItem.quantity}
              onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })}
              data-testid="input-print-qty"
            />
          </div>
          <div className="flex gap-2 mt-3 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setIsAddingItem(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => addItemMutation.mutate(newItem)} disabled={!newItem.printType}>
              Add
            </Button>
          </div>
        </Card>
      )}

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-medium">Type</th>
              <th className="px-4 py-2 text-left text-sm font-medium">Description</th>
              <th className="px-4 py-2 text-left text-sm font-medium">Size</th>
              <th className="px-4 py-2 text-center text-sm font-medium">Qty</th>
              <th className="px-4 py-2 text-left text-sm font-medium">Status</th>
              <th className="px-4 py-2 text-center text-sm font-medium w-20">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(items as any[]).map((item: any) => (
              <tr key={item.id} data-testid={`row-print-${item.id}`}>
                <td className="px-4 py-2">{item.printType}</td>
                <td className="px-4 py-2 text-muted-foreground">{item.description || "-"}</td>
                <td className="px-4 py-2">{item.size || "-"}</td>
                <td className="px-4 py-2 text-center">{item.quantity}</td>
                <td className="px-4 py-2">
                  <Badge variant={item.status === "printed" ? "default" : "secondary"}>
                    {item.status || "pending"}
                  </Badge>
                </td>
                <td className="px-4 py-2 text-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => deleteItemMutation.mutate(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(items as any[]).length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Printer className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>No print items yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

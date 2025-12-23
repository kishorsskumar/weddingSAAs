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
  User
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
                <ChecklistSection planId={selectedPlan.id} employees={employees} />
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

function ChecklistSection({ planId, employees }: { planId: string; employees: Employee[] }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItem, setNewItem] = useState({ task: "", assignedTo: "", dueDate: "" });

  const { data: items = [] } = useQuery({
    queryKey: [`/api/execution-plans/${planId}/checklist`],
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
      setNewItem({ task: "", assignedTo: "", dueDate: "" });
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

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Checklist</h2>
        <Button size="sm" onClick={() => setIsAddingItem(true)} data-testid="button-add-checklist">
          <Plus className="h-4 w-4 mr-1" />
          Add Item
        </Button>
      </div>

      {isAddingItem && (
        <Card className="p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Input
                placeholder="Task description"
                value={newItem.task}
                onChange={(e) => setNewItem({ ...newItem, task: e.target.value })}
                data-testid="input-checklist-task"
              />
            </div>
            <Select value={newItem.assignedTo} onValueChange={(v) => setNewItem({ ...newItem, assignedTo: v })}>
              <SelectTrigger data-testid="select-checklist-assignee">
                <SelectValue placeholder="Assign to..." />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 mt-3">
            <Input
              type="date"
              value={newItem.dueDate}
              onChange={(e) => setNewItem({ ...newItem, dueDate: e.target.value })}
              className="w-40"
              data-testid="input-checklist-duedate"
            />
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAddingItem(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => addItemMutation.mutate(newItem)}
              disabled={!newItem.task}
            >
              Add
            </Button>
          </div>
        </Card>
      )}

      <div className="space-y-2">
        {(items as any[]).map((item: any) => (
          <div
            key={item.id}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg border bg-card",
              item.isCompleted && "bg-muted/50"
            )}
            data-testid={`checklist-item-${item.id}`}
          >
            <Checkbox
              checked={item.isCompleted}
              onCheckedChange={(checked) =>
                updateItemMutation.mutate({ id: item.id, data: { isCompleted: checked } })
              }
              data-testid={`checkbox-checklist-${item.id}`}
            />
            <div className="flex-1 min-w-0">
              <p className={cn("font-medium", item.isCompleted && "line-through text-muted-foreground")}>
                {item.task}
              </p>
              <div className="flex gap-4 text-xs text-muted-foreground">
                {item.assignedToId && (
                  <span>{employees.find(e => e.id === item.assignedToId)?.name}</span>
                )}
                {item.dueDate && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(new Date(item.dueDate), "MMM d")}
                  </span>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => deleteItemMutation.mutate(item.id)}
              data-testid={`button-delete-checklist-${item.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}

        {(items as any[]).length === 0 && !isAddingItem && (
          <div className="text-center py-8 text-muted-foreground">
            <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>No checklist items yet</p>
          </div>
        )}
      </div>
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

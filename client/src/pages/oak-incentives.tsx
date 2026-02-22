import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/context/auth-context";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Banknote,
  Target,
  LayoutDashboard,
  Calendar,
  Users,
  Award,
  TrendingUp,
  Loader2,
  ArrowLeft,
  ChevronsUpDown,
  Check,
  Search,
} from "lucide-react";

const formatCurrency = (amount: string | number | null) => {
  if (!amount) return "₹0";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(num);
};

const getCurrentFY = (): string => {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  if (month >= 3) {
    return `FY${year}-${(year + 1).toString().slice(-2)}`;
  }
  return `FY${year - 1}-${year.toString().slice(-2)}`;
};

const getFYOptions = () => {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return [
    `FY${year + 1}-${(year + 2).toString().slice(-2)}`,
    `FY${year}-${(year + 1).toString().slice(-2)}`,
    `FY${year - 1}-${year.toString().slice(-2)}`,
  ];
};

const MONTHS = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  verified: "bg-purple-100 text-purple-800",
  paid: "bg-emerald-100 text-emerald-800",
  active: "bg-blue-100 text-blue-800",
  achieved: "bg-green-100 text-green-800",
  missed: "bg-red-100 text-red-800",
};

function EmployeeCombobox({ users, value, onSelect }: { users: any[]; value: string; onSelect: (val: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selectedUser = users.find((u: any) => String(u.id) === value);

  const filtered = useMemo(() => {
    if (!search) return users;
    const q = search.toLowerCase();
    return users.filter((u: any) => {
      const label = `${u.name || ''} ${u.role || ''}`.toLowerCase();
      return label.includes(q);
    });
  }, [users, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          data-testid="select-employee"
        >
          {selectedUser ? selectedUser.name : "Select employee..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="flex items-center border-b px-3 py-2">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <input
            className="flex h-8 w-full rounded-md bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Search employees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-employee"
          />
        </div>
        <ScrollArea className="max-h-[250px]">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No employees found.</p>
          ) : (
            <div className="p-1">
              {filtered.map((u: any) => (
                <button
                  key={u.id}
                  className={`relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground ${String(u.id) === value ? 'bg-accent' : ''}`}
                  onClick={() => { onSelect(String(u.id)); setOpen(false); setSearch(""); }}
                  data-testid={`option-employee-${u.id}`}
                >
                  {String(u.id) === value && <Check className="mr-2 h-4 w-4 text-primary" />}
                  <span className={String(u.id) === value ? '' : 'ml-6'}>
                    {u.name}
                    <span className="ml-2 text-xs text-muted-foreground capitalize">({u.role})</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function EventCombobox({ events, value, onSelect }: { events: any[]; value: string; onSelect: (val: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selectedEvent = events.find((e: any) => String(e.id) === value);

  const filtered = useMemo(() => {
    if (!search) return events;
    const q = search.toLowerCase();
    return events.filter((e: any) => {
      const label = `${e.title || ''} ${e.date || ''}`.toLowerCase();
      return label.includes(q);
    });
  }, [events, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          data-testid="select-event"
        >
          {selectedEvent ? `${selectedEvent.title || 'Untitled'} - ${selectedEvent.date || ''}` : "Select event..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="flex items-center border-b px-3 py-2">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <input
            className="flex h-8 w-full rounded-md bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Search events..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-event"
          />
        </div>
        <ScrollArea className="max-h-[250px]">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No events found.</p>
          ) : (
            <div className="p-1">
              {filtered.map((e: any) => (
                <button
                  key={e.id}
                  className={`relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground ${String(e.id) === value ? 'bg-accent' : ''}`}
                  onClick={() => { onSelect(String(e.id)); setOpen(false); setSearch(""); }}
                  data-testid={`option-event-${e.id}`}
                >
                  {String(e.id) === value && <Check className="mr-2 h-4 w-4 text-primary" />}
                  <span className={String(e.id) === value ? '' : 'ml-6'}>
                    {e.title || 'Untitled'} - {e.date || ''}
                  </span>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export default function OakIncentives() {
  const { user } = useAuth();
  const [activeTab, setActiveTabState] = useState(() => {
    const saved = localStorage.getItem('oak_incentives_active_tab');
    if (saved && ['event', 'monthly', 'kpi', 'overview'].includes(saved)) return saved;
    return 'event';
  });
  const setActiveTab = (tab: string) => {
    localStorage.setItem('oak_incentives_active_tab', tab);
    setActiveTabState(tab);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-40 bg-card border-b px-4 py-3 flex items-center gap-3">
        <Link href="/">
          <Button variant="ghost" size="icon" data-testid="button-back-dashboard">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Award className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-semibold text-sm">Oak Incentives</h1>
            <p className="text-xs text-muted-foreground">Manage incentives & KPIs</p>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4" data-testid="tabs-incentives">
            <TabsTrigger value="event" data-testid="tab-event">Event</TabsTrigger>
            <TabsTrigger value="monthly" data-testid="tab-monthly">Monthly / Bonus</TabsTrigger>
            <TabsTrigger value="kpi" data-testid="tab-kpi">Yearly KPI</TabsTrigger>
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          </TabsList>

          <TabsContent value="event">
            <EventIncentivesTab />
          </TabsContent>
          <TabsContent value="monthly">
            <MonthlyBonusTab />
          </TabsContent>
          <TabsContent value="kpi">
            <YearlyKPITab />
          </TabsContent>
          <TabsContent value="overview">
            <OverviewTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function EventIncentivesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [fiscalYear, setFiscalYear] = useState(getCurrentFY());
  const [createOpen, setCreateOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignIncentiveId, setAssignIncentiveId] = useState<string | null>(null);
  const [newEventId, setNewEventId] = useState("");
  const [newEmployeeId, setNewEmployeeId] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newCriteria, setNewCriteria] = useState<string[]>(["", "", ""]);
  const [assignEmployeeId, setAssignEmployeeId] = useState("");
  const [assignAmount, setAssignAmount] = useState("");
  const [assignNotes, setAssignNotes] = useState("");
  const [assignTasks, setAssignTasks] = useState<{ title: string; isRequired: boolean }[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskRequired, setNewTaskRequired] = useState(false);

  const { data: allEvents = [] } = useQuery<any[]>({ queryKey: ["/api/events"] });
  const { data: users = [] } = useQuery<any[]>({ queryKey: ["/api/users"] });

  const events = useMemo(() => {
    const fyMatch = fiscalYear.match(/FY(\d{4})-(\d{2})/);
    if (!fyMatch) return allEvents;
    const startYear = parseInt(fyMatch[1]);
    const fyStartStr = `${startYear}-04-01`;
    const fyEndStr = `${startYear + 1}-03-31`;
    return allEvents.filter((e: any) => {
      if (!e.date) return false;
      const dateStr = e.date.split('T')[0];
      return dateStr >= fyStartStr && dateStr <= fyEndStr;
    }).sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));
  }, [allEvents, fiscalYear]);
  const { data: incentives = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/incentives", { type: "event", fiscalYear }],
    queryFn: async () => {
      const res = await fetch(`/api/incentives?type=event&fiscalYear=${fiscalYear}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const selectedEvent = events.find((e: any) => String(e.id) === newEventId);
      const title = selectedEvent ? selectedEvent.title : "Event Incentive";
      await apiRequest("POST", "/api/event-incentives", {
        title,
        eventId: newEventId,
        employeeId: newEmployeeId,
        amount: parseFloat(newAmount),
        criteria: newCriteria.filter(c => c.trim()),
        fiscalYear,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incentives"] });
      setCreateOpen(false);
      setNewEventId("");
      setNewEmployeeId("");
      setNewAmount("");
      setNewCriteria(["", "", ""]);
      toast({ title: "Event incentive created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/incentives/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incentives"] });
      toast({ title: "Incentive deleted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/incentive-assignments", {
        incentiveId: assignIncentiveId,
        employeeId: assignEmployeeId,
        amount: parseFloat(assignAmount),
        tasks: assignTasks,
        notes: assignNotes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incentives"] });
      setAssignOpen(false);
      resetAssignForm();
      toast({ title: "Employee assigned" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const resetAssignForm = () => {
    setAssignEmployeeId("");
    setAssignAmount("");
    setAssignNotes("");
    setAssignTasks([]);
    setNewTaskTitle("");
    setNewTaskRequired(false);
  };

  const addTask = () => {
    if (!newTaskTitle.trim()) return;
    setAssignTasks([...assignTasks, { title: newTaskTitle.trim(), isRequired: newTaskRequired }]);
    setNewTaskTitle("");
    setNewTaskRequired(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Event Incentives</h2>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={fiscalYear} onValueChange={setFiscalYear}>
            <SelectTrigger className="w-[140px]" data-testid="select-fy-event">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getFYOptions().map(fy => <SelectItem key={fy} value={fy}>{fy}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => setCreateOpen(true)} data-testid="button-create-event-incentive">
            <Plus className="w-4 h-4 mr-1" /> Create
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : incentives.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No event incentives found for {fiscalYear}</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {incentives.map((inc: any) => (
            <IncentiveCard
              key={inc.id}
              incentive={inc}
              events={events}
              users={users}
              expanded={expandedId === inc.id}
              onToggle={() => setExpandedId(expandedId === inc.id ? null : inc.id)}
              onDelete={() => deleteMutation.mutate(inc.id)}
              onAssign={() => { setAssignIncentiveId(inc.id); setAssignAmount(String(inc.amount || "")); setAssignOpen(true); }}
            />
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto" data-testid="dialog-create-event-incentive">
          <DialogHeader>
            <DialogTitle>Create Event Incentive</DialogTitle>
            <DialogDescription>Assign an incentive to an employee for a specific event</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select Event</Label>
              <EventCombobox
                events={events}
                value={newEventId}
                onSelect={setNewEventId}
              />
            </div>
            <div>
              <Label>Employee Name</Label>
              <EmployeeCombobox
                users={users}
                value={newEmployeeId}
                onSelect={setNewEmployeeId}
              />
            </div>
            <div>
              <Label>Incentive Value (₹)</Label>
              <Input type="number" value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="5000" data-testid="input-incentive-amount" />
            </div>

            <Separator />

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Incentive Criteria</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNewCriteria([...newCriteria, ""])}
                  data-testid="button-add-criteria"
                >
                  <Plus className="w-3 h-3 mr-1" /> Add Criteria
                </Button>
              </div>
              <div className="space-y-2">
                {newCriteria.map((criterion, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-5 shrink-0">{idx + 1}.</span>
                    <Input
                      value={criterion}
                      onChange={e => {
                        const updated = [...newCriteria];
                        updated[idx] = e.target.value;
                        setNewCriteria(updated);
                      }}
                      placeholder={`Criteria ${idx + 1}`}
                      className="flex-1"
                      data-testid={`input-criteria-${idx}`}
                    />
                    {newCriteria.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setNewCriteria(newCriteria.filter((_, i) => i !== idx))}
                        data-testid={`button-remove-criteria-${idx}`}
                      >
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} data-testid="button-cancel-create">Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!newAmount || !newEventId || !newEmployeeId || createMutation.isPending} data-testid="button-submit-create">
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AssignDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        users={users}
        employeeId={assignEmployeeId}
        setEmployeeId={setAssignEmployeeId}
        amount={assignAmount}
        setAmount={setAssignAmount}
        notes={assignNotes}
        setNotes={setAssignNotes}
        tasks={assignTasks}
        setTasks={setAssignTasks}
        newTaskTitle={newTaskTitle}
        setNewTaskTitle={setNewTaskTitle}
        newTaskRequired={newTaskRequired}
        setNewTaskRequired={setNewTaskRequired}
        addTask={addTask}
        onSubmit={() => assignMutation.mutate()}
        isPending={assignMutation.isPending}
      />
    </div>
  );
}

function MonthlyBonusTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [fiscalYear, setFiscalYear] = useState(getCurrentFY());
  const [incentiveType, setIncentiveType] = useState<"monthly" | "bonus">("monthly");
  const [createOpen, setCreateOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignIncentiveId, setAssignIncentiveId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newMonth, setNewMonth] = useState("");
  const [assignEmployeeId, setAssignEmployeeId] = useState("");
  const [assignAmount, setAssignAmount] = useState("");
  const [assignNotes, setAssignNotes] = useState("");
  const [assignTasks, setAssignTasks] = useState<{ title: string; isRequired: boolean }[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskRequired, setNewTaskRequired] = useState(false);

  const { data: users = [] } = useQuery<any[]>({ queryKey: ["/api/users"] });
  const { data: incentives = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/incentives", { type: incentiveType, fiscalYear }],
    queryFn: async () => {
      const res = await fetch(`/api/incentives?type=${incentiveType}&fiscalYear=${fiscalYear}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/incentives", {
        title: newTitle,
        type: incentiveType,
        amount: parseFloat(newAmount),
        fiscalYear,
        month: incentiveType === "monthly" ? newMonth : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incentives"] });
      setCreateOpen(false);
      setNewTitle("");
      setNewAmount("");
      setNewMonth("");
      toast({ title: `${incentiveType === "monthly" ? "Monthly" : "Bonus"} incentive created` });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/incentives/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incentives"] });
      toast({ title: "Incentive deleted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/incentive-assignments", {
        incentiveId: assignIncentiveId,
        employeeId: assignEmployeeId,
        amount: parseFloat(assignAmount),
        tasks: assignTasks,
        notes: assignNotes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incentives"] });
      setAssignOpen(false);
      setAssignEmployeeId("");
      setAssignAmount("");
      setAssignNotes("");
      setAssignTasks([]);
      toast({ title: "Employee assigned" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const addTask = () => {
    if (!newTaskTitle.trim()) return;
    setAssignTasks([...assignTasks, { title: newTaskTitle.trim(), isRequired: newTaskRequired }]);
    setNewTaskTitle("");
    setNewTaskRequired(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Banknote className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Monthly / Bonus Incentives</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={incentiveType} onValueChange={(v: "monthly" | "bonus") => setIncentiveType(v)}>
            <SelectTrigger className="w-[120px]" data-testid="select-type-monthly">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="bonus">Bonus</SelectItem>
            </SelectContent>
          </Select>
          <Select value={fiscalYear} onValueChange={setFiscalYear}>
            <SelectTrigger className="w-[140px]" data-testid="select-fy-monthly">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getFYOptions().map(fy => <SelectItem key={fy} value={fy}>{fy}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => setCreateOpen(true)} data-testid="button-create-monthly-incentive">
            <Plus className="w-4 h-4 mr-1" /> Create
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : incentives.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No {incentiveType} incentives found for {fiscalYear}</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {incentives.map((inc: any) => (
            <IncentiveCard
              key={inc.id}
              incentive={inc}
              events={[]}
              users={users}
              expanded={expandedId === inc.id}
              onToggle={() => setExpandedId(expandedId === inc.id ? null : inc.id)}
              onDelete={() => deleteMutation.mutate(inc.id)}
              onAssign={() => { setAssignIncentiveId(inc.id); setAssignAmount(String(inc.amount || "")); setAssignOpen(true); }}
            />
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent data-testid="dialog-create-monthly-incentive">
          <DialogHeader>
            <DialogTitle>Create {incentiveType === "monthly" ? "Monthly" : "Bonus"} Incentive</DialogTitle>
            <DialogDescription>Create a new {incentiveType} incentive</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Incentive Title</Label>
              <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="e.g. Performance Bonus" data-testid="input-monthly-title" />
            </div>
            <div>
              <Label>Default Amount (₹)</Label>
              <Input type="number" value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="5000" data-testid="input-monthly-amount" />
            </div>
            {incentiveType === "monthly" && (
              <div>
                <Label>Month</Label>
                <Select value={newMonth} onValueChange={setNewMonth}>
                  <SelectTrigger data-testid="select-month"><SelectValue placeholder="Select month" /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} data-testid="button-cancel-monthly">Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!newTitle || !newAmount || (incentiveType === "monthly" && !newMonth) || createMutation.isPending} data-testid="button-submit-monthly">
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AssignDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        users={users}
        employeeId={assignEmployeeId}
        setEmployeeId={setAssignEmployeeId}
        amount={assignAmount}
        setAmount={setAssignAmount}
        notes={assignNotes}
        setNotes={setAssignNotes}
        tasks={assignTasks}
        setTasks={setAssignTasks}
        newTaskTitle={newTaskTitle}
        setNewTaskTitle={setNewTaskTitle}
        newTaskRequired={newTaskRequired}
        setNewTaskRequired={setNewTaskRequired}
        addTask={addTask}
        onSubmit={() => assignMutation.mutate()}
        isPending={assignMutation.isPending}
      />
    </div>
  );
}

function YearlyKPITab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [fiscalYear, setFiscalYear] = useState(getCurrentFY());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTargetValue, setNewTargetValue] = useState("");
  const [newUnit, setNewUnit] = useState("number");
  const [newWeight, setNewWeight] = useState("");
  const [editingKpi, setEditingKpi] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const { data: users = [] } = useQuery<any[]>({ queryKey: ["/api/users"] });
  const { data: kpiTargets = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/kpi-targets", { employeeId: selectedEmployeeId, fiscalYear }],
    queryFn: async () => {
      const params = new URLSearchParams({ fiscalYear });
      if (selectedEmployeeId) params.set("employeeId", selectedEmployeeId);
      const res = await fetch(`/api/kpi-targets?${params.toString()}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/kpi-targets", {
        employeeId: selectedEmployeeId,
        fiscalYear,
        title: newTitle,
        targetValue: parseFloat(newTargetValue),
        unit: newUnit,
        weight: parseFloat(newWeight),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kpi-targets"] });
      setCreateOpen(false);
      setNewTitle("");
      setNewTargetValue("");
      setNewUnit("number");
      setNewWeight("");
      toast({ title: "KPI target created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, currentValue, status }: { id: string; currentValue?: number; status?: string }) => {
      const body: any = {};
      if (currentValue !== undefined) body.currentValue = currentValue;
      if (status) body.status = status;
      await apiRequest("PATCH", `/api/kpi-targets/${id}`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kpi-targets"] });
      setEditingKpi(null);
      toast({ title: "KPI updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/kpi-targets/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kpi-targets"] });
      toast({ title: "KPI target deleted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const getProgressPercent = (current: number, target: number) => {
    if (!target) return 0;
    return Math.min(100, Math.round((current / target) * 100));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Yearly KPI Targets</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
            <SelectTrigger className="w-[160px]" data-testid="select-employee-kpi">
              <SelectValue placeholder="All employees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {users.map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fiscalYear} onValueChange={setFiscalYear}>
            <SelectTrigger className="w-[140px]" data-testid="select-fy-kpi">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getFYOptions().map(fy => <SelectItem key={fy} value={fy}>{fy}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => setCreateOpen(true)} disabled={!selectedEmployeeId || selectedEmployeeId === "all"} data-testid="button-create-kpi">
            <Plus className="w-4 h-4 mr-1" /> Add KPI
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : kpiTargets.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No KPI targets found. Select an employee and create targets.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {kpiTargets.map((kpi: any) => {
            const employee = users.find((u: any) => String(u.id) === String(kpi.employeeId));
            const currentVal = parseFloat(kpi.currentValue || "0");
            const targetVal = parseFloat(kpi.targetValue || "1");
            const progress = getProgressPercent(currentVal, targetVal);
            const unitLabel = kpi.unit === "currency" ? "₹" : kpi.unit === "percentage" ? "%" : "";

            return (
              <Card key={kpi.id} data-testid={`card-kpi-${kpi.id}`}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{kpi.title}</h3>
                        <Badge className={STATUS_COLORS[kpi.status] || ""}>{kpi.status}</Badge>
                      </div>
                      {employee && <p className="text-sm text-muted-foreground">{employee.name}</p>}
                      <p className="text-xs text-muted-foreground">Weight: {kpi.weight}%</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" onClick={() => updateMutation.mutate({ id: kpi.id, status: "achieved" })} data-testid={`button-kpi-achieved-${kpi.id}`}>
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Achieved
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => updateMutation.mutate({ id: kpi.id, status: "missed" })} data-testid={`button-kpi-missed-${kpi.id}`}>
                        Missed
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(kpi.id)} data-testid={`button-delete-kpi-${kpi.id}`}>
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress: {unitLabel}{currentVal} / {unitLabel}{targetVal}</span>
                      <span className="font-medium">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" data-testid={`progress-kpi-${kpi.id}`} />
                    <div className="flex items-center gap-2 mt-2">
                      {editingKpi === kpi.id ? (
                        <>
                          <Input
                            type="number"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            className="w-32 h-8"
                            placeholder="Current value"
                            data-testid={`input-kpi-value-${kpi.id}`}
                          />
                          <Button size="sm" onClick={() => updateMutation.mutate({ id: kpi.id, currentValue: parseFloat(editValue) })} data-testid={`button-save-kpi-${kpi.id}`}>
                            Save
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setEditingKpi(null)}>Cancel</Button>
                        </>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => { setEditingKpi(kpi.id); setEditValue(String(currentVal)); }} data-testid={`button-edit-kpi-${kpi.id}`}>
                          Update Value
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent data-testid="dialog-create-kpi">
          <DialogHeader>
            <DialogTitle>Add KPI Target</DialogTitle>
            <DialogDescription>Set a new KPI target for the selected employee</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>KPI Title</Label>
              <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="e.g. Revenue Target" data-testid="input-kpi-title" />
            </div>
            <div>
              <Label>Target Value</Label>
              <Input type="number" value={newTargetValue} onChange={e => setNewTargetValue(e.target.value)} placeholder="100" data-testid="input-kpi-target" />
            </div>
            <div>
              <Label>Unit</Label>
              <Select value={newUnit} onValueChange={setNewUnit}>
                <SelectTrigger data-testid="select-kpi-unit"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="percentage">Percentage</SelectItem>
                  <SelectItem value="currency">Currency (₹)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Weight (%)</Label>
              <Input type="number" value={newWeight} onChange={e => setNewWeight(e.target.value)} placeholder="25" data-testid="input-kpi-weight" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} data-testid="button-cancel-kpi">Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!newTitle || !newTargetValue || !newWeight || createMutation.isPending} data-testid="button-submit-kpi">
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OverviewTab() {
  const [fiscalYear, setFiscalYear] = useState(getCurrentFY());

  const { data: allIncentives = [], isLoading: loadingIncentives } = useQuery<any[]>({
    queryKey: ["/api/incentives", { fiscalYear }],
    queryFn: async () => {
      const res = await fetch(`/api/incentives?fiscalYear=${fiscalYear}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: kpiTargets = [] } = useQuery<any[]>({
    queryKey: ["/api/kpi-targets", { fiscalYear }],
    queryFn: async () => {
      const res = await fetch(`/api/kpi-targets?fiscalYear=${fiscalYear}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: users = [] } = useQuery<any[]>({ queryKey: ["/api/users"] });

  const stats = useMemo(() => {
    let totalIncentives = allIncentives.length;
    let totalAllocated = 0;
    let pendingCount = 0;
    let pendingAmount = 0;
    let verifiedAmount = 0;
    let paidAmount = 0;
    const employeeSummary: Record<string, { name: string; total: number; pending: number; paid: number }> = {};

    allIncentives.forEach((inc: any) => {
      const assignments = inc.assignments || [];
      assignments.forEach((a: any) => {
        const amt = parseFloat(a.amount || "0");
        totalAllocated += amt;

        const empId = String(a.employeeId);
        if (!employeeSummary[empId]) {
          const emp = users.find((u: any) => String(u.id) === empId);
          employeeSummary[empId] = { name: emp?.name || `Employee #${empId}`, total: 0, pending: 0, paid: 0 };
        }
        employeeSummary[empId].total += amt;

        if (a.status === "pending" || a.status === "in_progress") {
          pendingCount++;
          pendingAmount += amt;
          employeeSummary[empId].pending += amt;
        } else if (a.status === "verified") {
          verifiedAmount += amt;
        } else if (a.status === "paid") {
          paidAmount += amt;
          employeeSummary[empId].paid += amt;
        }
      });
    });

    return { totalIncentives, totalAllocated, pendingCount, pendingAmount, verifiedAmount, paidAmount, employeeSummary };
  }, [allIncentives, users]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Overview</h2>
        </div>
        <Select value={fiscalYear} onValueChange={setFiscalYear}>
          <SelectTrigger className="w-[140px]" data-testid="select-fy-overview">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {getFYOptions().map(fy => <SelectItem key={fy} value={fy}>{fy}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loadingIncentives ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card data-testid="card-total-incentives">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Award className="w-4 h-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Total Incentives</span>
                </div>
                <p className="text-2xl font-bold" data-testid="text-total-incentives">{stats.totalIncentives}</p>
              </CardContent>
            </Card>
            <Card data-testid="card-total-allocated">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Banknote className="w-4 h-4 text-blue-500" />
                  <span className="text-sm text-muted-foreground">Total Allocated</span>
                </div>
                <p className="text-2xl font-bold" data-testid="text-total-allocated">{formatCurrency(stats.totalAllocated)}</p>
              </CardContent>
            </Card>
            <Card data-testid="card-pending-payouts">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm text-muted-foreground">Pending Payouts</span>
                </div>
                <p className="text-2xl font-bold" data-testid="text-pending-count">{stats.pendingCount}</p>
                <p className="text-sm text-muted-foreground">{formatCurrency(stats.pendingAmount)}</p>
              </CardContent>
            </Card>
            <Card data-testid="card-paid-amount">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-muted-foreground">Paid</span>
                </div>
                <p className="text-2xl font-bold" data-testid="text-paid-amount">{formatCurrency(stats.paidAmount)}</p>
                <p className="text-sm text-muted-foreground">Verified: {formatCurrency(stats.verifiedAmount)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4" /> Per-Employee Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(stats.employeeSummary).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No assignments found</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(stats.employeeSummary).map(([empId, data]) => (
                    <div key={empId} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg" data-testid={`summary-employee-${empId}`}>
                      <div>
                        <p className="font-medium">{data.name}</p>
                        <p className="text-sm text-muted-foreground">Total: {formatCurrency(data.total)}</p>
                      </div>
                      <div className="flex gap-3 mt-2 sm:mt-0">
                        <Badge variant="outline" className="bg-yellow-50">Pending: {formatCurrency(data.pending)}</Badge>
                        <Badge variant="outline" className="bg-green-50">Paid: {formatCurrency(data.paid)}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {kpiTargets.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="w-4 h-4" /> KPI Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-4 text-sm text-muted-foreground font-medium border-b pb-2">
                    <span>Target</span>
                    <span>Employee</span>
                    <span>Status</span>
                  </div>
                  {kpiTargets.map((kpi: any) => {
                    const emp = users.find((u: any) => String(u.id) === String(kpi.employeeId));
                    return (
                      <div key={kpi.id} className="grid grid-cols-3 gap-4 text-sm py-2 border-b last:border-0" data-testid={`kpi-summary-${kpi.id}`}>
                        <span>{kpi.title}</span>
                        <span>{emp?.name || "-"}</span>
                        <Badge className={STATUS_COLORS[kpi.status] || ""}>{kpi.status}</Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function IncentiveCard({
  incentive,
  events,
  users,
  expanded,
  onToggle,
  onDelete,
  onAssign,
}: {
  incentive: any;
  events: any[];
  users: any[];
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onAssign: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const event = events.find((e: any) => String(e.id) === String(incentive.eventId));
  const assignments = incentive.assignments || [];

  const { data: incentiveDetail } = useQuery<any>({
    queryKey: ["/api/incentives", incentive.id],
    queryFn: async () => {
      const res = await fetch(`/api/incentives/${incentive.id}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: expanded,
  });

  const detailAssignments = incentiveDetail?.assignments || assignments;

  const updateAssignmentMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/incentive-assignments/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incentives"] });
      toast({ title: "Assignment updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteAssignmentMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/incentive-assignments/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incentives"] });
      toast({ title: "Assignment removed" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, isCompleted, verified }: { id: string; isCompleted?: boolean; verified?: boolean }) => {
      const body: any = {};
      if (isCompleted !== undefined) body.isCompleted = isCompleted;
      if (verified !== undefined) body.verified = verified;
      await apiRequest("PATCH", `/api/incentive-tasks/${id}`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incentives"] });
      toast({ title: "Task updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/incentive-tasks/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incentives"] });
      toast({ title: "Task deleted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <Card data-testid={`card-incentive-${incentive.id}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between cursor-pointer" onClick={onToggle} data-testid={`toggle-incentive-${incentive.id}`}>
          <div className="flex items-center gap-3">
            {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            <div>
              <h3 className="font-medium">{incentive.title}</h3>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {event && <span>{event.clientName || event.name}</span>}
                {incentive.month && <span>• {incentive.month}</span>}
                <span>• {formatCurrency(incentive.amount)}</span>
                <Badge variant="outline" className="text-xs">{detailAssignments.length} assigned</Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <Button variant="outline" size="sm" onClick={onAssign} data-testid={`button-assign-${incentive.id}`}>
              <Users className="w-3 h-3 mr-1" /> Assign
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete} data-testid={`button-delete-incentive-${incentive.id}`}>
              <Trash2 className="w-3 h-3 text-destructive" />
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 space-y-3 border-t pt-3">
            {detailAssignments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No employees assigned yet</p>
            ) : (
              detailAssignments.map((assignment: any) => {
                const employee = users.find((u: any) => String(u.id) === String(assignment.employeeId));
                const tasks = assignment.tasks || [];
                return (
                  <div key={assignment.id} className="border rounded-lg p-3 space-y-2" data-testid={`assignment-${assignment.id}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{employee?.name || `Employee #${assignment.employeeId}`}</p>
                        <p className="text-sm text-muted-foreground">{formatCurrency(assignment.amount)}</p>
                        {assignment.notes && <p className="text-xs text-muted-foreground italic">{assignment.notes}</p>}
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge className={STATUS_COLORS[assignment.status] || ""} data-testid={`badge-status-${assignment.id}`}>{assignment.status}</Badge>
                        {assignment.status !== "verified" && assignment.status !== "paid" && (
                          <Button variant="outline" size="sm" onClick={() => updateAssignmentMutation.mutate({ id: assignment.id, status: "verified" })} data-testid={`button-verify-${assignment.id}`}>
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Verify
                          </Button>
                        )}
                        {assignment.status === "verified" && (
                          <Button variant="outline" size="sm" onClick={() => updateAssignmentMutation.mutate({ id: assignment.id, status: "paid" })} data-testid={`button-pay-${assignment.id}`}>
                            <Banknote className="w-3 h-3 mr-1" /> Pay
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => deleteAssignmentMutation.mutate(assignment.id)} data-testid={`button-delete-assignment-${assignment.id}`}>
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    {tasks.length > 0 && (
                      <div className="ml-4 space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Tasks</p>
                        {tasks.map((task: any) => (
                          <div key={task.id} className="flex items-center justify-between text-sm p-1.5 rounded bg-muted/50" data-testid={`task-${task.id}`}>
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={task.isCompleted}
                                onCheckedChange={(checked) => updateTaskMutation.mutate({ id: task.id, isCompleted: !!checked })}
                                data-testid={`checkbox-task-${task.id}`}
                              />
                              <span className={task.isCompleted ? "line-through text-muted-foreground" : ""}>{task.title}</span>
                              {task.isRequired && <Badge variant="outline" className="text-xs">Required</Badge>}
                              {task.verified && <Badge className="bg-purple-100 text-purple-800 text-xs">Verified</Badge>}
                            </div>
                            <div className="flex items-center gap-1">
                              {task.isCompleted && !task.verified && (
                                <Button variant="ghost" size="sm" onClick={() => updateTaskMutation.mutate({ id: task.id, verified: true })} data-testid={`button-verify-task-${task.id}`}>
                                  <CheckCircle2 className="w-3 h-3" />
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" onClick={() => deleteTaskMutation.mutate(task.id)} data-testid={`button-delete-task-${task.id}`}>
                                <Trash2 className="w-3 h-3 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AssignDialog({
  open,
  onOpenChange,
  users,
  employeeId,
  setEmployeeId,
  amount,
  setAmount,
  notes,
  setNotes,
  tasks,
  setTasks,
  newTaskTitle,
  setNewTaskTitle,
  newTaskRequired,
  setNewTaskRequired,
  addTask,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: any[];
  employeeId: string;
  setEmployeeId: (v: string) => void;
  amount: string;
  setAmount: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  tasks: { title: string; isRequired: boolean }[];
  setTasks: (v: { title: string; isRequired: boolean }[]) => void;
  newTaskTitle: string;
  setNewTaskTitle: (v: string) => void;
  newTaskRequired: boolean;
  setNewTaskRequired: (v: boolean) => void;
  addTask: () => void;
  onSubmit: () => void;
  isPending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-assign-employee">
        <DialogHeader>
          <DialogTitle>Assign Employee</DialogTitle>
          <DialogDescription>Assign an employee to this incentive with optional tasks</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          <div>
            <Label>Employee</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger data-testid="select-assign-employee"><SelectValue placeholder="Select employee" /></SelectTrigger>
              <SelectContent>
                {users.map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Amount (₹)</Label>
            <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="5000" data-testid="input-assign-amount" />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..." rows={2} data-testid="input-assign-notes" />
          </div>

          <Separator />

          <div>
            <Label className="mb-2 block">Tasks</Label>
            {tasks.length > 0 && (
              <div className="space-y-1 mb-2">
                {tasks.map((t, i) => (
                  <div key={i} className="flex items-center justify-between text-sm p-2 rounded bg-muted/50">
                    <div className="flex items-center gap-2">
                      <span>{t.title}</span>
                      {t.isRequired && <Badge variant="outline" className="text-xs">Required</Badge>}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setTasks(tasks.filter((_, j) => j !== i))} data-testid={`button-remove-task-${i}`}>
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Input
                value={newTaskTitle}
                onChange={e => setNewTaskTitle(e.target.value)}
                placeholder="Task title"
                className="flex-1"
                data-testid="input-new-task-title"
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTask(); } }}
              />
              <div className="flex items-center gap-1">
                <Checkbox checked={newTaskRequired} onCheckedChange={(c) => setNewTaskRequired(!!c)} data-testid="checkbox-task-required" />
                <span className="text-xs">Req</span>
              </div>
              <Button variant="outline" size="sm" onClick={addTask} data-testid="button-add-task">
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-assign">Cancel</Button>
          <Button onClick={onSubmit} disabled={!employeeId || !amount || isPending} data-testid="button-submit-assign">
            {isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

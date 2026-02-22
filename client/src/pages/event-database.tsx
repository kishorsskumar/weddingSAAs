import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import type { Event } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, Download, Upload, Trash2, Loader2, Plus, X, Calendar, MapPin, User, DollarSign, Edit, ChevronRight, ChevronLeft, Users, UserCheck, UserX, HelpCircle, UtensilsCrossed, Star, MessageCircle, ThumbsUp, ThumbsDown, Receipt, ChevronDown, ChevronUp, CheckCircle, Clock, Image as ImageIcon, Check, ChevronsUpDown } from "lucide-react";
import { useForm } from "react-hook-form";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function EventDatabase() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPlanner, setSelectedPlanner] = useState<string>("all");
  const now = new Date();
  const currentFYStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const defaultFY = `FY ${currentFYStart}-${(currentFYStart + 1).toString().slice(-2)}`;
  const [selectedYear, setSelectedYear] = useState<string>(defaultFY);
  const [selectedQuarter, setSelectedQuarter] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>(now.getMonth().toString());
  const [selectedCalendarYear, setSelectedCalendarYear] = useState<number>(now.getFullYear());
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isPanelEditing, setIsPanelEditing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const isSuperadmin = user?.role === 'superadmin';
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const canEditEvents = user?.role === 'superadmin' || user?.role === 'wedding_planner';

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ['/api/events'],
    queryFn: async () => {
      const res = await fetch('/api/events');
      if (!res.ok) throw new Error('Failed to fetch events');
      return res.json();
    },
    placeholderData: keepPreviousData,
  });

  const selectedEvent = useMemo(() => {
    return events.find(e => e.id === selectedEventId) || null;
  }, [events, selectedEventId]);

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Event> }) => {
      const res = await fetch(`/api/events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update event');
      return res.json();
    },
    onSuccess: (updatedEvent) => {
      queryClient.setQueryData<Event[]>(['/api/events'], (old) => 
        old?.map(e => e.id === updatedEvent.id ? updatedEvent : e) || []
      );
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update event", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/events/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete event');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      setSelectedEventId(null);
      toast({ title: "Success", description: "Event deleted successfully" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Omit<Event, 'id' | 'createdAt'>) => {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create event');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      setIsAddEventOpen(false);
      toast({ title: "Success", description: "Event created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create event", variant: "destructive" });
    },
  });

  const handleDelete = (id: string, title: string) => {
    if (confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
      deleteMutation.mutate(id);
    }
  };

  const getFinancialYear = (date: Date) => {
    const month = date.getMonth();
    const year = date.getFullYear();
    if (month >= 3) {
      return `FY ${year}-${(year + 1).toString().slice(-2)}`;
    }
    return `FY ${year - 1}-${year.toString().slice(-2)}`;
  };

  const getQuarter = (date: Date) => {
    const month = date.getMonth();
    if (month >= 3 && month <= 5) return "Q1";
    if (month >= 6 && month <= 8) return "Q2";
    if (month >= 9 && month <= 11) return "Q3";
    return "Q4";
  };

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    events.forEach(e => {
      const date = new Date(e.date);
      years.add(getFinancialYear(date));
    });
    return Array.from(years).sort();
  }, [events]);

  const availablePlanners = useMemo(() => {
    return Array.from(new Set(events.map(e => (e.planner || '').trim()).filter(Boolean))).sort();
  }, [events]);

  const months = [
    { value: "0", label: "January" },
    { value: "1", label: "February" },
    { value: "2", label: "March" },
    { value: "3", label: "April" },
    { value: "4", label: "May" },
    { value: "5", label: "June" },
    { value: "6", label: "July" },
    { value: "7", label: "August" },
    { value: "8", label: "September" },
    { value: "9", label: "October" },
    { value: "10", label: "November" },
    { value: "11", label: "December" },
  ];

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (selectedMonth === "all") {
      setSelectedMonth(now.getMonth().toString());
      setSelectedCalendarYear(now.getFullYear());
      return;
    }
    let monthNum = parseInt(selectedMonth);
    let year = selectedCalendarYear;
    if (direction === 'next') {
      monthNum++;
      if (monthNum > 11) { monthNum = 0; year++; }
    } else {
      monthNum--;
      if (monthNum < 0) { monthNum = 11; year--; }
    }
    setSelectedMonth(monthNum.toString());
    setSelectedCalendarYear(year);
    setSelectedQuarter("all");
  };

  const currentMonthLabel = selectedMonth !== "all"
    ? `${months[parseInt(selectedMonth)].label} ${selectedCalendarYear}`
    : "All Months";

  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      const eventDate = new Date(event.date);
      const matchesSearch = event.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            event.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPlanner = selectedPlanner === "all" || (event.planner || '').trim() === selectedPlanner;
      const matchesYear = selectedYear === "all" || getFinancialYear(eventDate) === selectedYear;
      const matchesQuarter = selectedQuarter === "all" || getQuarter(eventDate) === selectedQuarter;
      const matchesMonth = selectedMonth === "all" || (eventDate.getMonth().toString() === selectedMonth && eventDate.getFullYear() === selectedCalendarYear);
      return matchesSearch && matchesPlanner && matchesYear && matchesQuarter && matchesMonth;
    });
  }, [events, searchTerm, selectedPlanner, selectedYear, selectedQuarter, selectedMonth, selectedCalendarYear]);

  const eventSummary = useMemo(() => {
    let totalSales = 0;
    let totalCost = 0;
    filteredEvents.forEach(event => {
      totalSales += Number(event.salesValue) || 0;
      totalCost += Number(event.cost) || 0;
    });
    const profit = totalSales - totalCost;
    const profitMargin = totalSales > 0 ? (profit / totalSales) * 100 : 0;
    return { totalSales, totalCost, profit, profitMargin };
  }, [filteredEvents]);

  const formatCurrency = (value: number) => {
    return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatCompact = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
    return `₹${value.toLocaleString('en-IN')}`;
  };

  const generateEventId = (event: Event) => {
    const date = new Date(event.date);
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString('en', { month: 'short' }).toUpperCase();
    return `${event.customer.substring(0, 3).toUpperCase()}-${event.venue.substring(0, 3).toUpperCase()}-${day}${month}`;
  };

  const handleExport = () => {
    const headers = ['Wedding Planner', 'Client Name', 'Event Code', 'Date', 'Event Type', 'Venue', 'Sales Value', 'Payment Received', 'Balance', 'Total Cost', 'Profit', 'Profit %'];
    
    const csvRows = filteredEvents.map(event => {
      const salesValue = Number(event.salesValue) || 0;
      const paymentReceived = Number(event.paymentReceived) || 0;
      const cost = Number(event.cost) || 0;
      const balance = salesValue - paymentReceived;
      const profit = salesValue - cost;
      const profitPercent = salesValue > 0 ? ((profit / salesValue) * 100).toFixed(2) : '0';
      
      return [
        event.planner,
        event.customer,
        event.eventCode || generateEventId(event),
        event.date,
        event.type,
        event.venue,
        salesValue,
        paymentReceived,
        balance,
        cost,
        profit,
        profitPercent
      ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(',');
    });
    
    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `events_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Export Successful",
      description: `Exported ${filteredEvents.length} events to CSV file.`,
    });
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsImporting(true);
    
    try {
      const text = await file.text();
      const lines = text.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
      
      const eventsData: any[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length < 5) continue;
        
        const eventData: any = {};
        headers.forEach((header, index) => {
          const value = values[index]?.trim() || '';
          if (header.includes('date')) eventData.date = value;
          else if (header.includes('planner')) eventData.planner = value;
          else if (header.includes('customer') || header.includes('client')) eventData.customer = value;
          else if (header.includes('type')) eventData.type = value;
          else if (header.includes('venue')) eventData.venue = value;
          else if (header.includes('sales')) eventData.salesValue = parseFloat(value.replace(/[^0-9.]/g, '')) || 0;
          else if (header.includes('payment') || header.includes('received')) eventData.paymentReceived = parseFloat(value.replace(/[^0-9.]/g, '')) || 0;
          else if (header.includes('cost')) eventData.cost = parseFloat(value.replace(/[^0-9.]/g, '')) || 0;
        });
        
        if (eventData.date && eventData.customer) {
          eventsData.push(eventData);
        }
      }
      
      for (const eventData of eventsData) {
        const title = `${eventData.customer?.toUpperCase().replace(/\s+/g, '-').substring(0, 15)}-${(eventData.venue || 'TBD').toUpperCase().replace(/\s+/g, '-').substring(0, 10)}`;
        
        await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            date: eventData.date,
            type: eventData.type || 'Other',
            planner: eventData.planner || 'TBD',
            customer: eventData.customer,
            venue: eventData.venue || 'TBD',
            salesValue: eventData.salesValue?.toString() || '0',
            paymentReceived: eventData.paymentReceived?.toString() || '0',
            cost: eventData.cost?.toString() || '0',
          }),
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      
      toast({
        title: "Import Successful",
        description: `Imported ${eventsData.length} events from CSV file.`,
      });
    } catch (error) {
      toast({
        title: "Import Failed",
        description: "Failed to import events. Please check the CSV format.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim().replace(/^"|"$/g, ''));
    return result;
  };

  const AddEventForm = ({ onClose }: { onClose: () => void }) => {
    const { register, handleSubmit, watch, formState: { errors } } = useForm({
      defaultValues: {
        title: '',
        date: new Date().toISOString().split('T')[0],
        time: '',
        type: 'wedding',
        planner: '',
        customer: '',
        venue: '',
        salesValue: '0',
        paymentReceived: '0',
        cost: '0',
      }
    });
    
    const salesValue = watch("salesValue");
    const cost = watch("cost");
    const paymentReceived = watch("paymentReceived");
    const profit = (Number(salesValue) || 0) - (Number(cost) || 0);
    const profitPercent = salesValue && Number(salesValue) > 0 ? ((profit / Number(salesValue)) * 100).toFixed(2) : "0";
    const balance = (Number(salesValue) || 0) - (Number(paymentReceived) || 0);

    const onSubmit = (data: any) => {
      createMutation.mutate({
        ...data,
        salesValue: data.salesValue?.toString() || '0',
        paymentReceived: data.paymentReceived?.toString() || '0',
        cost: data.cost?.toString() || '0',
      });
    };

    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Event Title <span className="text-destructive">*</span></Label>
            <Input {...register("title", { required: "Title is required" })} placeholder="e.g., John & Jane Wedding" data-testid="input-event-title" />
            {errors.title && <span className="text-xs text-destructive">{errors.title.message}</span>}
          </div>
          <div className="space-y-2">
            <Label>Customer Name <span className="text-destructive">*</span></Label>
            <Input {...register("customer", { required: "Customer name is required" })} placeholder="e.g., John Smith" data-testid="input-event-customer" />
            {errors.customer && <span className="text-xs text-destructive">{errors.customer.message}</span>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Event Date <span className="text-destructive">*</span></Label>
            <Input type="date" {...register("date", { required: "Date is required" })} data-testid="input-event-date" />
            {errors.date && <span className="text-xs text-destructive">{errors.date.message}</span>}
          </div>
          <div className="space-y-2">
            <Label>Event Time</Label>
            <Input type="time" {...register("time")} data-testid="input-event-time" />
          </div>
          <div className="space-y-2">
            <Label>Event Type <span className="text-destructive">*</span></Label>
            <select {...register("type", { required: "Type is required" })} className="w-full h-10 px-3 rounded-md border border-input bg-background" data-testid="select-event-type">
              <option value="wedding">Wedding</option>
              <option value="corporate">Corporate</option>
              <option value="birthday">Birthday</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Wedding Planner <span className="text-destructive">*</span></Label>
            <Input {...register("planner", { required: "Planner is required" })} placeholder="e.g., Sarah Johnson" data-testid="input-event-planner" />
            {errors.planner && <span className="text-xs text-destructive">{errors.planner.message}</span>}
          </div>
          <div className="space-y-2">
            <Label>Venue <span className="text-destructive">*</span></Label>
            <Input {...register("venue", { required: "Venue is required" })} placeholder="e.g., Grand Ballroom" data-testid="input-event-venue" />
            {errors.venue && <span className="text-xs text-destructive">{errors.venue.message}</span>}
          </div>
        </div>

        <div className="border-t pt-4 mt-4">
          <h4 className="font-medium mb-3">Financial Details</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Sales Value (₹)</Label>
              <Input type="number" {...register("salesValue")} placeholder="0" data-testid="input-event-sales" />
            </div>
            <div className="space-y-2">
              <Label>Payment Received (₹)</Label>
              <Input type="number" {...register("paymentReceived")} placeholder="0" data-testid="input-event-payment" />
            </div>
            <div className="space-y-2">
              <Label>Estimated Cost (₹)</Label>
              <Input type="number" {...register("cost")} placeholder="0" data-testid="input-event-cost" />
            </div>
          </div>
        </div>
        
        <div className="bg-muted p-3 sm:p-4 rounded-lg grid grid-cols-3 gap-4 text-center">
          <div>
            <span className="text-xs sm:text-sm text-muted-foreground">Balance</span>
            <div className="text-base sm:text-lg font-bold text-orange-600">₹{balance.toLocaleString()}</div>
          </div>
          <div>
            <span className="text-xs sm:text-sm text-muted-foreground">Est. Profit</span>
            <div className="text-base sm:text-lg font-bold text-primary">₹{profit.toLocaleString()}</div>
          </div>
          <div>
            <span className="text-xs sm:text-sm text-muted-foreground">Margin</span>
            <div className="text-base sm:text-lg font-bold text-primary">{profitPercent}%</div>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={createMutation.isPending} data-testid="button-create-event">
            {createMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</> : 'Create Event'}
          </Button>
        </div>
      </form>
    );
  };

  interface RsvpStats {
    total: number;
    confirmed: number;
    declined: number;
    maybe: number;
    pending: number;
    totalAttendees: number;
    vegetarian: number;
    nonVegetarian: number;
  }

  const EventDetailPanel = ({ event, panelIsEditing, setPanelIsEditing }: { event: Event; panelIsEditing: boolean; setPanelIsEditing: (v: boolean) => void }) => {
    const { register, handleSubmit, watch, reset } = useForm<Event>({ 
      defaultValues: event,
      values: event 
    });
    
    const { data: rsvpStats } = useQuery<RsvpStats>({
      queryKey: ['/api/rsvp-stats', event.id],
      queryFn: async () => {
        const res = await fetch(`/api/rsvp-stats/${event.id}`);
        if (!res.ok) return null;
        return res.json();
      },
    });
    
    const { data: eventFeedback } = useQuery<{
      overallRating: number;
      planningRating: number;
      executionRating: number;
      communicationRating: number;
      decorRating: number;
      comments: string;
      suggestions: string;
      wouldRecommend: boolean;
      testimonial: string;
      clientName: string;
      createdAt: string;
    } | null>({
      queryKey: ['/api/events/feedback', event.id],
      queryFn: async () => {
        const res = await fetch(`/api/events/${event.id}/feedback`);
        if (!res.ok) return null;
        return res.json();
      },
      enabled: isSuperadmin,
    });

    const [vendorCostsExpanded, setVendorCostsExpanded] = useState(true);
    const [addVendorOpen, setAddVendorOpen] = useState(false);
    const [editingVendor, setEditingVendor] = useState<any>(null);
    const panelScrollRef = useRef<HTMLDivElement>(null);
    const pendingScrollTarget = useRef<string | null>(null);
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
    const canManageVendorCosts = user?.role === 'superadmin' || user?.role === 'accountant';

    const [vendorComboOpen, setVendorComboOpen] = useState(false);
    const [vendorSearch, setVendorSearch] = useState('');
    const [addingNewVendor, setAddingNewVendor] = useState(false);
    const [newVendorName, setNewVendorName] = useState('');

    const { data: masterVendors = [] } = useQuery<any[]>({
      queryKey: ['/api/vendors'],
      queryFn: async () => {
        const res = await fetch('/api/vendors');
        if (!res.ok) return [];
        return res.json();
      },
    });

    const addMasterVendorMutation = useMutation({
      mutationFn: async (name: string) => {
        const res = await fetch('/api/vendors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        });
        if (!res.ok) throw new Error('Failed to create vendor');
        return res.json();
      },
      onSuccess: (vendor: any) => {
        queryClient.invalidateQueries({ queryKey: ['/api/vendors'] });
        setVendorForm({ ...vendorForm, vendorName: vendor.name });
        setAddingNewVendor(false);
        setNewVendorName('');
        setVendorComboOpen(false);
        toast({ title: 'Vendor added to master list' });
      },
      onError: (err: any) => {
        toast({ title: 'Failed to add vendor', description: err.message, variant: 'destructive' });
      }
    });

    const { data: vendorCosts = [] } = useQuery<any[]>({
      queryKey: ['/api/events/vendor-costs', event.id],
      queryFn: async () => {
        const res = await fetch(`/api/events/${event.id}/vendor-costs`);
        if (!res.ok) return [];
        return res.json();
      },
      placeholderData: keepPreviousData,
    });

    useEffect(() => {
      if (pendingScrollTarget.current) {
        const testId = pendingScrollTarget.current;
        const doScroll = () => {
          const vp = panelScrollRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
          if (!vp) return;
          const target = panelScrollRef.current?.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null;
          if (target) {
            const vpRect = vp.getBoundingClientRect();
            const targetRect = target.getBoundingClientRect();
            vp.scrollTop = targetRect.top - vpRect.top + vp.scrollTop - vpRect.height / 3;
            pendingScrollTarget.current = null;
          }
        };
        requestAnimationFrame(doScroll);
        const t = setTimeout(doScroll, 100);
        return () => clearTimeout(t);
      }
    }, [vendorCosts]);

    const vendorCostsMutation = useMutation({
      mutationFn: async (data: { action: 'create' | 'update' | 'delete'; costId?: string; payload?: any }) => {
        if (data.action === 'create') {
          const res = await fetch(`/api/events/${event.id}/vendor-costs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data.payload)
          });
          if (!res.ok) throw new Error('Failed to create vendor cost');
          return res.json();
        } else if (data.action === 'update') {
          const res = await fetch(`/api/events/${event.id}/vendor-costs/${data.costId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data.payload)
          });
          if (!res.ok) throw new Error('Failed to update vendor cost');
          return res.json();
        } else {
          const res = await fetch(`/api/events/${event.id}/vendor-costs/${data.costId}`, { method: 'DELETE' });
          if (!res.ok) throw new Error('Failed to delete vendor cost');
          return res.json();
        }
      },
      onSuccess: (_data, variables) => {
        const emptyForm = { vendorName: '', serviceDescription: '', estimatedAmount: '', actualAmount: '', paymentStatus: 'pending', paymentDate: '', paymentReference: '', notes: '' };

        pendingScrollTarget.current = variables.action === 'update'
          ? `vendor-cost-${variables.costId}`
          : 'toggle-vendor-costs';

        if (variables.action === 'delete' || variables.action === 'update') {
          setEditingVendor(null);
        }
        setVendorForm(emptyForm);

        queryClient.invalidateQueries({ queryKey: ['/api/events/vendor-costs', event.id] });

        toast({ title: 'Success', description: variables.action === 'delete' ? 'Vendor cost deleted' : variables.action === 'update' ? 'Vendor cost updated' : 'Vendor cost added — ready for next entry' });
      },
      onError: () => {
        toast({ title: 'Error', description: 'Failed to update vendor cost', variant: 'destructive' });
      }
    });

    const totalEstimated = vendorCosts.reduce((sum: number, c: any) => sum + parseFloat(c.estimatedAmount || '0'), 0);
    const totalActual = vendorCosts.reduce((sum: number, c: any) => sum + parseFloat(c.actualAmount || '0'), 0);
    
    const salesValue = watch("salesValue");
    const cost = watch("cost");
    const paymentReceived = watch("paymentReceived");
    const profit = (Number(salesValue) || 0) - (Number(cost) || 0);
    const profitPercent = salesValue && Number(salesValue) > 0 ? ((profit / Number(salesValue)) * 100).toFixed(2) : "0";
    const balance = (Number(salesValue) || 0) - (Number(paymentReceived) || 0);
    const isProfitable = profit >= 0;

    const onSubmit = (data: Event) => {
      updateMutation.mutate({ 
        id: event.id, 
        data: {
          ...data,
          salesValue: data.salesValue?.toString() || '0',
          paymentReceived: data.paymentReceived?.toString() || '0',
          cost: data.cost?.toString() || '0',
        }
      }, {
        onSuccess: () => {
          setPanelIsEditing(false);
          toast({ title: "Success", description: "Event details saved" });
        }
      });
    };

    const handleCancel = () => {
      reset(event);
      setPanelIsEditing(false);
    };

    return (
      <div className="h-full flex flex-col bg-white">
        <div className="flex items-center justify-between p-4 pr-14 md:pr-16 border-b">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-lg">Event Details</h2>
            {canEditEvents && !panelIsEditing && (
              <Button variant="ghost" size="sm" onClick={() => setPanelIsEditing(true)} data-testid="button-edit-event">
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={() => { setPanelIsEditing(false); setSelectedEventId(null); }} data-testid="button-close-panel">
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <ScrollArea className="flex-1" ref={panelScrollRef}>
          <form onSubmit={handleSubmit(onSubmit)} className={cn("p-4 space-y-6", panelIsEditing && "max-w-4xl mx-auto p-6")}>
            <div className={cn("space-y-4", panelIsEditing && "grid grid-cols-1 md:grid-cols-2 gap-4 space-y-0")}>
              <div className={cn("flex items-start gap-3 p-3 bg-primary/5 rounded-lg", panelIsEditing && "md:col-span-2")}>
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  {event.eventCode ? (
                    <>
                      <p className="text-xs text-muted-foreground">Event Code</p>
                      <p className="font-medium font-mono text-primary">{event.eventCode}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground">Event ID</p>
                      <p className="font-medium">{generateEventId(event)}</p>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Event Title</Label>
                {panelIsEditing ? (
                  <Input {...register("title")} data-testid="input-edit-title" />
                ) : (
                  <p className="text-sm font-medium p-2 bg-muted rounded">{event.title}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Customer Name</Label>
                {panelIsEditing ? (
                  <Input {...register("customer")} data-testid="input-edit-customer" />
                ) : (
                  <p className="text-sm font-medium p-2 bg-muted rounded">{event.customer}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Event Date</Label>
                  {panelIsEditing ? (
                    <Input type="date" {...register("date")} data-testid="input-edit-date" />
                  ) : (
                    <p className="text-sm font-medium p-2 bg-muted rounded">
                      {format(new Date(event.date), 'dd MMM yyyy')}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Event Type</Label>
                  {panelIsEditing ? (
                    <select {...register("type")} className="w-full h-10 px-3 rounded-md border border-input bg-background" data-testid="select-edit-type">
                      <option value="wedding">Wedding</option>
                      <option value="corporate">Corporate</option>
                      <option value="birthday">Birthday</option>
                      <option value="other">Other</option>
                    </select>
                  ) : (
                    <p className="text-sm font-medium p-2 bg-muted rounded capitalize">{event.type}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Wedding Planner</Label>
                {panelIsEditing ? (
                  <Input {...register("planner")} data-testid="input-edit-planner" />
                ) : (
                  <p className="text-sm font-medium p-2 bg-muted rounded">{event.planner}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Venue</Label>
                {panelIsEditing ? (
                  <Input {...register("venue")} data-testid="input-edit-venue" />
                ) : (
                  <p className="text-sm font-medium p-2 bg-muted rounded">{event.venue}</p>
                )}
              </div>
            </div>

            <div className={cn("border-t pt-4", panelIsEditing && "md:col-span-2")}>
              <h4 className="font-medium mb-4 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Financial Details
              </h4>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Sales Value (₹)</Label>
                    {panelIsEditing ? (
                      <Input type="number" {...register("salesValue")} data-testid="input-edit-sales" />
                    ) : (
                      <p className="text-sm font-medium p-2 bg-muted rounded">{formatCurrency(Number(event.salesValue) || 0)}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Payment Received (₹)</Label>
                    {panelIsEditing ? (
                      <Input type="number" {...register("paymentReceived")} data-testid="input-edit-payment" />
                    ) : (
                      <p className="text-sm font-medium p-2 bg-muted rounded">{formatCurrency(Number(event.paymentReceived) || 0)}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Total Cost (₹)</Label>
                    {panelIsEditing ? (
                      <Input type="number" {...register("cost")} data-testid="input-edit-cost" />
                    ) : (
                      <p className="text-sm font-medium p-2 bg-muted rounded">{formatCurrency(Number(event.cost) || 0)}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Balance (₹)</Label>
                    <p className={cn("text-sm font-medium p-2 rounded", balance > 0 ? "bg-orange-50 text-orange-600" : "bg-green-50 text-green-600")}>
                      {formatCurrency(balance)}
                    </p>
                  </div>
                </div>

                <div className="bg-muted p-4 rounded-lg grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Estimated Profit</p>
                    <p className={cn("text-xl font-bold", isProfitable ? "text-green-600" : "text-red-600")}>
                      {formatCurrency(profit)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Profit Margin</p>
                    <p className={cn("text-xl font-bold", isProfitable ? "text-green-600" : "text-red-600")}>
                      {profitPercent}%
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* RSVP Stats Section */}
            {rsvpStats && rsvpStats.total > 0 && (
              <div className={cn("border-t pt-4", panelIsEditing && "md:col-span-2")}>
                <h4 className="font-medium mb-4 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  RSVP Summary
                </h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-muted/50 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">Invited</p>
                    <p className="text-xl font-bold">{rsvpStats.total}</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg text-center">
                    <p className="text-xs text-green-600 flex items-center justify-center gap-1">
                      <UserCheck className="h-3 w-3" />
                      Confirmed
                    </p>
                    <p className="text-xl font-bold text-green-700">{rsvpStats.confirmed}</p>
                  </div>
                  <div className="p-3 bg-red-50 rounded-lg text-center">
                    <p className="text-xs text-red-600 flex items-center justify-center gap-1">
                      <UserX className="h-3 w-3" />
                      Declined
                    </p>
                    <p className="text-xl font-bold text-red-700">{rsvpStats.declined}</p>
                  </div>
                  <div className="p-3 bg-yellow-50 rounded-lg text-center">
                    <p className="text-xs text-yellow-600 flex items-center justify-center gap-1">
                      <HelpCircle className="h-3 w-3" />
                      Pending
                    </p>
                    <p className="text-xl font-bold text-yellow-700">{rsvpStats.pending}</p>
                  </div>
                </div>

                <div className="mt-3 p-3 bg-primary/5 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">Expected Attendees</span>
                    <span className="text-lg font-bold text-primary">{rsvpStats.totalAttendees}</span>
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <UtensilsCrossed className="h-3 w-3" />
                      Veg: {rsvpStats.vegetarian}
                    </span>
                    <span className="flex items-center gap-1">
                      <UtensilsCrossed className="h-3 w-3" />
                      Non-Veg: {rsvpStats.nonVegetarian}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Client Feedback Section - Superadmin Only */}
            {isSuperadmin && eventFeedback && (
              <div className="space-y-3 p-4 bg-[#4b7c29]/5 rounded-lg border border-[#4b7c29]/20">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-[#4b7c29]" />
                  <h3 className="font-semibold text-[#3d6622]">Client Feedback</h3>
                </div>
                
                {eventFeedback.clientName && (
                  <p className="text-xs text-gray-500">From: {eventFeedback.clientName}</p>
                )}
                
                {/* Star Ratings */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Overall</span>
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} className={`h-3.5 w-3.5 ${s <= (eventFeedback.overallRating || 0) ? 'fill-[#4b7c29] text-[#4b7c29]' : 'text-gray-300'}`} />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Planning</span>
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} className={`h-3.5 w-3.5 ${s <= (eventFeedback.planningRating || 0) ? 'fill-[#4b7c29] text-[#4b7c29]' : 'text-gray-300'}`} />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Execution</span>
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} className={`h-3.5 w-3.5 ${s <= (eventFeedback.executionRating || 0) ? 'fill-[#4b7c29] text-[#4b7c29]' : 'text-gray-300'}`} />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Communication</span>
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} className={`h-3.5 w-3.5 ${s <= (eventFeedback.communicationRating || 0) ? 'fill-[#4b7c29] text-[#4b7c29]' : 'text-gray-300'}`} />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between col-span-2">
                    <span className="text-gray-600">Decor & Design</span>
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} className={`h-3.5 w-3.5 ${s <= (eventFeedback.decorRating || 0) ? 'fill-[#4b7c29] text-[#4b7c29]' : 'text-gray-300'}`} />
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* Would Recommend */}
                <div className="flex items-center gap-2 pt-2 border-t border-[#4b7c29]/10">
                  {eventFeedback.wouldRecommend ? (
                    <span className="flex items-center gap-1 text-sm text-green-600 font-medium">
                      <ThumbsUp className="h-4 w-4" /> Would recommend
                    </span>
                  ) : eventFeedback.wouldRecommend === false ? (
                    <span className="flex items-center gap-1 text-sm text-gray-500">
                      <ThumbsDown className="h-4 w-4" /> Would not recommend
                    </span>
                  ) : null}
                </div>
                
                {/* Comments */}
                {eventFeedback.comments && (
                  <div className="pt-2 border-t border-[#4b7c29]/10">
                    <p className="text-xs font-medium text-gray-500 mb-1">What made it special:</p>
                    <p className="text-sm text-gray-700 bg-white p-2 rounded border">{eventFeedback.comments}</p>
                  </div>
                )}
                
                {/* Suggestions */}
                {eventFeedback.suggestions && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Suggestions:</p>
                    <p className="text-sm text-gray-700 bg-white p-2 rounded border">{eventFeedback.suggestions}</p>
                  </div>
                )}
                
                {/* Testimonial */}
                {eventFeedback.testimonial && (
                  <div className="pt-2 border-t border-[#4b7c29]/10">
                    <p className="text-xs font-medium text-[#4b7c29] mb-1">Testimonial:</p>
                    <p className="text-sm text-gray-800 italic bg-white p-2 rounded border border-[#4b7c29]/20">"{eventFeedback.testimonial}"</p>
                  </div>
                )}
              </div>
            )}

            {/* Vendor Costs Section - Superadmin & Accountant */}
            {(isSuperadmin || user?.role === 'accountant') && (
              <div className={cn("border-t pt-4", panelIsEditing && "md:col-span-2")}>
                <div 
                  className="flex items-center justify-between cursor-pointer mb-3"
                  onClick={() => setVendorCostsExpanded(!vendorCostsExpanded)}
                  data-testid="toggle-vendor-costs"
                >
                  <h4 className="font-medium flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-[#4b7c29]" />
                    Vendor Costs ({vendorCosts.length})
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      Est: ₹{totalEstimated.toLocaleString()} | Act: ₹{totalActual.toLocaleString()}
                    </span>
                    {vendorCostsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </div>

                {vendorCostsExpanded && (
                  <div className="space-y-3">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-3 gap-2 text-center text-sm">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <p className="text-xs text-blue-600">Estimated</p>
                        <p className="font-bold text-blue-700">₹{totalEstimated.toLocaleString()}</p>
                      </div>
                      <div className="p-2 bg-green-50 rounded-lg">
                        <p className="text-xs text-green-600">Actual</p>
                        <p className="font-bold text-green-700">₹{totalActual.toLocaleString()}</p>
                      </div>
                      <div className={`p-2 rounded-lg ${totalEstimated >= totalActual ? 'bg-emerald-50' : 'bg-red-50'}`}>
                        <p className="text-xs text-gray-600">Variance</p>
                        <p className={`font-bold ${totalEstimated >= totalActual ? 'text-emerald-700' : 'text-red-700'}`}>
                          ₹{Math.abs(totalEstimated - totalActual).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Vendor List */}
                    {vendorCosts.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">No vendor costs added yet</p>
                    ) : (
                      <div className="space-y-2">
                        {vendorCosts.map((vc: any) => (
                          <div key={vc.id}>
                            {editingVendor?.id === vc.id ? (
                              <div className="p-3 border-2 border-[#4b7c29]/30 rounded-lg bg-[#4b7c29]/5" data-testid={`vendor-cost-edit-${vc.id}`}>
                                <h5 className="font-medium text-sm mb-3">Edit Vendor Cost</h5>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="col-span-2">
                                    <Label className="text-xs">Vendor Name</Label>
                                    <Popover open={vendorComboOpen} onOpenChange={setVendorComboOpen}>
                                      <PopoverTrigger asChild>
                                        <Button
                                          variant="outline"
                                          role="combobox"
                                          aria-expanded={vendorComboOpen}
                                          className="w-full justify-between h-8 text-sm font-normal"
                                          data-testid="input-vendor-name"
                                        >
                                          {vendorForm.vendorName || <span className="text-muted-foreground">Search vendors...</span>}
                                          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-[280px] p-0" align="start">
                                        {addingNewVendor ? (
                                          <div className="p-3 space-y-2">
                                            <Label className="text-xs font-medium">New Vendor Name</Label>
                                            <Input
                                              value={newVendorName}
                                              onChange={(e) => setNewVendorName(e.target.value)}
                                              placeholder="Enter vendor name"
                                              className="h-8 text-sm"
                                              autoFocus
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter' && newVendorName.trim()) {
                                                  addMasterVendorMutation.mutate(newVendorName.trim());
                                                }
                                              }}
                                            />
                                            <div className="flex gap-2">
                                              <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => { setAddingNewVendor(false); setNewVendorName(''); }}>Cancel</Button>
                                              <Button size="sm" className="flex-1 h-7 text-xs bg-[#4b7c29] hover:bg-[#3d6622]" disabled={!newVendorName.trim() || addMasterVendorMutation.isPending} onClick={() => addMasterVendorMutation.mutate(newVendorName.trim())}>
                                                {addMasterVendorMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Add'}
                                              </Button>
                                            </div>
                                          </div>
                                        ) : (
                                          <Command>
                                            <CommandInput placeholder="Search vendors..." value={vendorSearch} onValueChange={setVendorSearch} />
                                            <CommandList>
                                              <CommandEmpty>No vendors found.</CommandEmpty>
                                              <CommandGroup>
                                                {masterVendors.map((v: any) => (
                                                  <CommandItem
                                                    key={v.id}
                                                    value={v.name}
                                                    onSelect={() => {
                                                      setVendorForm({ ...vendorForm, vendorName: v.name });
                                                      setVendorComboOpen(false);
                                                      setVendorSearch('');
                                                    }}
                                                  >
                                                    <Check className={cn("mr-2 h-3 w-3", vendorForm.vendorName === v.name ? "opacity-100" : "opacity-0")} />
                                                    {v.name}
                                                    {v.category && <span className="ml-auto text-xs text-muted-foreground">{v.category}</span>}
                                                  </CommandItem>
                                                ))}
                                              </CommandGroup>
                                              <CommandGroup>
                                                <CommandItem onSelect={() => { setAddingNewVendor(true); setNewVendorName(vendorSearch); }} className="text-[#4b7c29]">
                                                  <Plus className="mr-2 h-3 w-3" />
                                                  Add New Vendor{vendorSearch ? `: "${vendorSearch}"` : ''}
                                                </CommandItem>
                                              </CommandGroup>
                                            </CommandList>
                                          </Command>
                                        )}
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                  <div>
                                    <Label className="text-xs">Service/Item</Label>
                                    <Input
                                      value={vendorForm.serviceDescription}
                                      onChange={(e) => setVendorForm({ ...vendorForm, serviceDescription: e.target.value })}
                                      placeholder="What they provide"
                                      className="h-8 text-sm"
                                      data-testid="input-vendor-service"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Estimated (₹)</Label>
                                    <Input
                                      type="number"
                                      value={vendorForm.estimatedAmount}
                                      onChange={(e) => setVendorForm({ ...vendorForm, estimatedAmount: e.target.value })}
                                      placeholder="0"
                                      className="h-8 text-sm"
                                      data-testid="input-vendor-estimated"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Actual (₹)</Label>
                                    <Input
                                      type="number"
                                      value={vendorForm.actualAmount}
                                      onChange={(e) => setVendorForm({ ...vendorForm, actualAmount: e.target.value })}
                                      placeholder="0"
                                      className="h-8 text-sm"
                                      data-testid="input-vendor-actual"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Status</Label>
                                    <Select value={vendorForm.paymentStatus} onValueChange={(v) => setVendorForm({ ...vendorForm, paymentStatus: v })}>
                                      <SelectTrigger className="h-8 text-sm" data-testid="select-vendor-status">
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
                                    <Label className="text-xs">Payment Date</Label>
                                    <Input
                                      type="date"
                                      value={vendorForm.paymentDate}
                                      onChange={(e) => setVendorForm({ ...vendorForm, paymentDate: e.target.value })}
                                      className="h-8 text-sm"
                                      data-testid="input-vendor-payment-date"
                                    />
                                  </div>
                                  <div className="col-span-2">
                                    <Label className="text-xs">Payment Reference</Label>
                                    <Input
                                      value={vendorForm.paymentReference}
                                      onChange={(e) => setVendorForm({ ...vendorForm, paymentReference: e.target.value })}
                                      placeholder="Bank ref / UTR"
                                      className="h-8 text-sm"
                                      data-testid="input-vendor-reference"
                                    />
                                  </div>
                                </div>
                                <div className="flex gap-2 mt-3">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => {
                                      setEditingVendor(null);
                                      setVendorForm({ vendorName: '', serviceDescription: '', estimatedAmount: '', actualAmount: '', paymentStatus: 'pending', paymentDate: '', paymentReference: '', notes: '' });
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="flex-1 bg-[#4b7c29] hover:bg-[#3d6622]"
                                    disabled={!vendorForm.vendorName || !vendorForm.serviceDescription || vendorCostsMutation.isPending}
                                    onClick={() => {
                                      vendorCostsMutation.mutate({ action: 'update', costId: editingVendor.id, payload: vendorForm });
                                    }}
                                    data-testid="button-save-vendor"
                                  >
                                    {vendorCostsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update'}
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="p-3 border rounded-lg bg-white" data-testid={`vendor-cost-${vc.id}`}>
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <p className="font-medium text-sm">{vc.vendorName}</p>
                                      {vc.paymentStatus === 'paid' ? (
                                        <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded flex items-center gap-1">
                                          <CheckCircle className="h-3 w-3" /> Paid
                                        </span>
                                      ) : (
                                        <span className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded flex items-center gap-1">
                                          <Clock className="h-3 w-3" /> Pending
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-gray-500">{vc.serviceDescription}</p>
                                    <div className="flex gap-4 mt-1 text-xs">
                                      <span>Est: ₹{parseFloat(vc.estimatedAmount || '0').toLocaleString()}</span>
                                      <span className={vc.actualAmount ? 'font-medium' : 'text-gray-400'}>
                                        Act: ₹{parseFloat(vc.actualAmount || '0').toLocaleString()}
                                      </span>
                                    </div>
                                  </div>
                                  {canManageVendorCosts && (
                                    <div className="flex gap-1">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0"
                                        onClick={() => {
                                          setAddVendorOpen(false);
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
                                        data-testid={`edit-vendor-${vc.id}`}
                                      >
                                        <Edit className="h-3.5 w-3.5" />
                                      </Button>
                                      {isSuperadmin && (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                                          onClick={() => {
                                            if (confirm('Delete this vendor cost?')) {
                                              vendorCostsMutation.mutate({ action: 'delete', costId: vc.id });
                                            }
                                          }}
                                          data-testid={`delete-vendor-${vc.id}`}
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add New Vendor Form (at bottom) */}
                    {canManageVendorCosts && addVendorOpen && !editingVendor && (
                      <div className="p-3 border-2 border-[#4b7c29]/30 rounded-lg bg-[#4b7c29]/5">
                        <h5 className="font-medium text-sm mb-3">Add Vendor Cost</h5>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="col-span-2">
                            <Label className="text-xs">Vendor Name</Label>
                            <Popover open={vendorComboOpen} onOpenChange={setVendorComboOpen}>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={vendorComboOpen}
                                  className="w-full justify-between h-8 text-sm font-normal"
                                  data-testid="input-vendor-name-add"
                                >
                                  {vendorForm.vendorName || <span className="text-muted-foreground">Search vendors...</span>}
                                  <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[280px] p-0" align="start">
                                {addingNewVendor ? (
                                  <div className="p-3 space-y-2">
                                    <Label className="text-xs font-medium">New Vendor Name</Label>
                                    <Input
                                      value={newVendorName}
                                      onChange={(e) => setNewVendorName(e.target.value)}
                                      placeholder="Enter vendor name"
                                      className="h-8 text-sm"
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && newVendorName.trim()) {
                                          addMasterVendorMutation.mutate(newVendorName.trim());
                                        }
                                      }}
                                    />
                                    <div className="flex gap-2">
                                      <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => { setAddingNewVendor(false); setNewVendorName(''); }}>Cancel</Button>
                                      <Button size="sm" className="flex-1 h-7 text-xs bg-[#4b7c29] hover:bg-[#3d6622]" disabled={!newVendorName.trim() || addMasterVendorMutation.isPending} onClick={() => addMasterVendorMutation.mutate(newVendorName.trim())}>
                                        {addMasterVendorMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Add'}
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <Command>
                                    <CommandInput placeholder="Search vendors..." value={vendorSearch} onValueChange={setVendorSearch} />
                                    <CommandList>
                                      <CommandEmpty>No vendors found.</CommandEmpty>
                                      <CommandGroup>
                                        {masterVendors.map((v: any) => (
                                          <CommandItem
                                            key={v.id}
                                            value={v.name}
                                            onSelect={() => {
                                              setVendorForm({ ...vendorForm, vendorName: v.name });
                                              setVendorComboOpen(false);
                                              setVendorSearch('');
                                            }}
                                          >
                                            <Check className={cn("mr-2 h-3 w-3", vendorForm.vendorName === v.name ? "opacity-100" : "opacity-0")} />
                                            {v.name}
                                            {v.category && <span className="ml-auto text-xs text-muted-foreground">{v.category}</span>}
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                      <CommandGroup>
                                        <CommandItem onSelect={() => { setAddingNewVendor(true); setNewVendorName(vendorSearch); }} className="text-[#4b7c29]">
                                          <Plus className="mr-2 h-3 w-3" />
                                          Add New Vendor{vendorSearch ? `: "${vendorSearch}"` : ''}
                                        </CommandItem>
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                )}
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div>
                            <Label className="text-xs">Service/Item</Label>
                            <Input
                              value={vendorForm.serviceDescription}
                              onChange={(e) => setVendorForm({ ...vendorForm, serviceDescription: e.target.value })}
                              placeholder="What they provide"
                              className="h-8 text-sm"
                              data-testid="input-vendor-service"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Estimated (₹)</Label>
                            <Input
                              type="number"
                              value={vendorForm.estimatedAmount}
                              onChange={(e) => setVendorForm({ ...vendorForm, estimatedAmount: e.target.value })}
                              placeholder="0"
                              className="h-8 text-sm"
                              data-testid="input-vendor-estimated"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Actual (₹)</Label>
                            <Input
                              type="number"
                              value={vendorForm.actualAmount}
                              onChange={(e) => setVendorForm({ ...vendorForm, actualAmount: e.target.value })}
                              placeholder="0"
                              className="h-8 text-sm"
                              data-testid="input-vendor-actual"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Status</Label>
                            <Select value={vendorForm.paymentStatus} onValueChange={(v) => setVendorForm({ ...vendorForm, paymentStatus: v })}>
                              <SelectTrigger className="h-8 text-sm" data-testid="select-vendor-status">
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
                            <Label className="text-xs">Payment Date</Label>
                            <Input
                              type="date"
                              value={vendorForm.paymentDate}
                              onChange={(e) => setVendorForm({ ...vendorForm, paymentDate: e.target.value })}
                              className="h-8 text-sm"
                              data-testid="input-vendor-payment-date"
                            />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Payment Reference</Label>
                            <Input
                              value={vendorForm.paymentReference}
                              onChange={(e) => setVendorForm({ ...vendorForm, paymentReference: e.target.value })}
                              placeholder="Bank ref / UTR"
                              className="h-8 text-sm"
                              data-testid="input-vendor-reference"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              setAddVendorOpen(false);
                              setVendorForm({ vendorName: '', serviceDescription: '', estimatedAmount: '', actualAmount: '', paymentStatus: 'pending', paymentDate: '', paymentReference: '', notes: '' });
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="flex-1 bg-[#4b7c29] hover:bg-[#3d6622]"
                            disabled={!vendorForm.vendorName || !vendorForm.serviceDescription || vendorCostsMutation.isPending}
                            onClick={() => {
                              vendorCostsMutation.mutate({ action: 'create', payload: vendorForm });
                            }}
                            data-testid="button-save-vendor"
                          >
                            {vendorCostsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
                          </Button>
                        </div>
                      </div>
                    )}

                    {canManageVendorCosts && !addVendorOpen && !editingVendor && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full border-dashed border-[#4b7c29]/50 text-[#4b7c29]"
                        onClick={() => setAddVendorOpen(true)}
                        data-testid="button-add-vendor-cost"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Vendor Cost
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {panelIsEditing && (
              <div className="flex gap-2 pt-4 border-t md:col-span-2">
                <Button type="button" variant="outline" className="flex-1" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={updateMutation.isPending} data-testid="button-save-event">
                  {updateMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : 'Save Changes'}
                </Button>
              </div>
            )}

            {canEditEvents && !panelIsEditing && (
              <div className="pt-4 border-t">
                <Button 
                  type="button"
                  variant="destructive" 
                  className="w-full"
                  onClick={() => handleDelete(event.id, event.title)}
                  data-testid="button-delete-event"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Event
                </Button>
              </div>
            )}
          </form>
        </ScrollArea>
      </div>
    );
  };

  return (
    <div className="flex h-full">
      <div className={cn("flex-1 flex flex-col transition-all duration-300", selectedEvent ? "lg:mr-[420px]" : "")}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 border-b bg-white gap-3">
          <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-4">
            <h1 className="text-lg font-semibold">Event Database</h1>
            <Dialog open={isAddEventOpen} onOpenChange={setIsAddEventOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="sm:hidden" data-testid="button-add-event-mobile">
                  <Plus className="h-4 w-4 mr-1" />
                  New
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
                <DialogHeader>
                  <DialogTitle>Add New Event</DialogTitle>
                </DialogHeader>
                <AddEventForm onClose={() => setIsAddEventOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search events..."
                className="pl-9 w-full sm:w-48 lg:w-64 h-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search"
              />
            </div>
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv"
              onChange={handleImport}
              className="hidden"
              data-testid="input-import-file"
            />
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="hidden sm:flex"
              data-testid="button-import"
            >
              {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <span className="ml-1 hidden lg:inline">{isImporting ? 'Importing...' : 'Import'}</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleExport}
              className="hidden sm:flex"
              data-testid="button-export"
            >
              <Download className="h-4 w-4" />
              <span className="ml-1 hidden lg:inline">Export</span>
            </Button>
            <Dialog open={isAddEventOpen} onOpenChange={setIsAddEventOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="hidden sm:flex" data-testid="button-add-event">
                  <Plus className="h-4 w-4 mr-1" />
                  New Event
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>
        </div>

        <div className="p-3 sm:p-4 border-b bg-white space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Select value={selectedYear} onValueChange={(val) => { setSelectedYear(val); if (val !== "all") { setSelectedMonth("all"); setSelectedQuarter("all"); } }}>
              <SelectTrigger className="h-9 text-sm" data-testid="select-year">
                <SelectValue placeholder="Select FY" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {availableYears.map(year => (
                  <SelectItem key={year} value={year}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedQuarter} onValueChange={(val) => { setSelectedQuarter(val); if (val !== "all") { setSelectedMonth("all"); } }}>
              <SelectTrigger className="h-9 text-sm" data-testid="select-quarter">
                <SelectValue placeholder="All Quarters" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Quarters</SelectItem>
                <SelectItem value="Q1">Q1 (Apr-Jun)</SelectItem>
                <SelectItem value="Q2">Q2 (Jul-Sep)</SelectItem>
                <SelectItem value="Q3">Q3 (Oct-Dec)</SelectItem>
                <SelectItem value="Q4">Q4 (Jan-Mar)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedPlanner} onValueChange={setSelectedPlanner}>
              <SelectTrigger className="h-9 text-sm" data-testid="select-planner">
                <SelectValue placeholder="All Planners" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Planners</SelectItem>
                {availablePlanners.map(planner => (
                  <SelectItem key={planner} value={planner}>{planner}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateMonth('prev')} data-testid="button-prev-month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <button
              onClick={() => {
                if (selectedMonth !== "all") {
                  setSelectedMonth("all");
                } else {
                  setSelectedMonth(now.getMonth().toString());
                  setSelectedCalendarYear(now.getFullYear());
                }
              }}
              className="text-sm font-semibold text-[#4b7c29] hover:underline cursor-pointer"
              data-testid="button-toggle-all-months"
            >
              {currentMonthLabel}
            </button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateMonth('next')} data-testid="button-next-month">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            <div className="bg-green-50 border border-green-200 rounded-lg p-1.5 sm:p-2 text-center">
              <p className="text-[9px] sm:text-[10px] text-green-600 font-medium uppercase tracking-wide">Sales</p>
              <p className="text-xs sm:text-sm font-bold text-green-800" data-testid="text-total-sales">{formatCompact(eventSummary.totalSales)}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-1.5 sm:p-2 text-center">
              <p className="text-[9px] sm:text-[10px] text-red-600 font-medium uppercase tracking-wide">Expenses</p>
              <p className="text-xs sm:text-sm font-bold text-red-800" data-testid="text-total-expenses">{formatCompact(eventSummary.totalCost)}</p>
            </div>
            <div className={cn("border rounded-lg p-1.5 sm:p-2 text-center", eventSummary.profit >= 0 ? "bg-blue-50 border-blue-200" : "bg-amber-50 border-amber-200")}>
              <p className={cn("text-[9px] sm:text-[10px] font-medium uppercase tracking-wide", eventSummary.profit >= 0 ? "text-blue-600" : "text-amber-600")}>Profit ({eventSummary.profitMargin.toFixed(1)}%)</p>
              <p className={cn("text-xs sm:text-sm font-bold", eventSummary.profit >= 0 ? "text-blue-800" : "text-amber-800")} data-testid="text-profit-margin">{formatCompact(eventSummary.profit)}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block"></span> Upcoming</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-gray-400 inline-block"></span> Completed</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block"></span> Cancelled</span>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 sm:p-4">
            <p className="text-sm text-muted-foreground mb-3">{filteredEvents.length} events found</p>
            <div className="space-y-2">
              {filteredEvents.map((event) => {
                const salesValue = Number(event.salesValue) || 0;
                const paymentReceived = Number(event.paymentReceived) || 0;
                const cost = Number(event.cost) || 0;
                const balance = salesValue - paymentReceived;
                const profit = salesValue - cost;
                const isProfitable = profit >= 0;
                const isSelected = selectedEventId === event.id;
                const eventDate = new Date(event.date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isCancelled = (event as any).status === 'cancelled';
                const isCompleted = (event as any).status === 'completed' || eventDate < today;
                const isUpcoming = !isCancelled && !isCompleted;
                
                return (
                  <div
                    key={event.id}
                    onClick={() => setSelectedEventId(event.id)}
                    className={cn(
                      "p-3 sm:p-4 rounded-lg border cursor-pointer transition-all hover:shadow-sm relative",
                      isSelected ? "border-primary bg-primary/5 shadow-sm" : "bg-white hover:border-gray-300",
                      isCancelled && "opacity-60"
                    )}
                    data-testid={`card-event-${event.id}`}
                  >
                    <div className={cn(
                      "absolute left-0 top-0 bottom-0 w-1 rounded-l-lg",
                      isCancelled ? "bg-red-400" : isCompleted ? "bg-gray-400" : "bg-green-500"
                    )} />
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={cn("font-medium text-sm truncate", isCompleted && !isCancelled && "text-gray-500")}>{event.customer}</h3>
                          {event.eventCode ? (
                            <span className="text-xs font-mono text-primary/70">{event.eventCode}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">{generateEventId(event)}</span>
                          )}
                          {isCancelled && (
                            <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">Cancelled</span>
                          )}
                          {isCompleted && !isCancelled && (
                            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">Completed</span>
                          )}
                          {isUpcoming && (
                            <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-medium">Upcoming</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(event.date), 'dd MMM yyyy')}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {event.venue}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {event.planner}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold">{formatCurrency(salesValue)}</p>
                        <p className={cn("text-xs font-medium", isProfitable ? "text-green-600" : "text-red-600")}>
                          {isProfitable ? "+" : ""}{formatCurrency(profit)}
                        </p>
                      </div>
                      <ChevronRight className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform", isSelected && "rotate-90")} />
                    </div>
                  </div>
                );
              })}
              {filteredEvents.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No events found</p>
                  <p className="text-sm mt-1">Try adjusting your filters or add a new event</p>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>

      {selectedEvent && (
        <>
          <div 
            className="fixed inset-0 bg-black/20 z-40 lg:hidden"
            onClick={() => setSelectedEventId(null)}
          />
          <div className={cn(
            "fixed top-0 right-0 h-full bg-white border-l shadow-lg z-50 lg:z-0 transition-all duration-300",
            isPanelEditing ? "w-full inset-0" : "w-full sm:w-[420px]"
          )}>
            <EventDetailPanel event={selectedEvent} panelIsEditing={isPanelEditing} setPanelIsEditing={setIsPanelEditing} />
          </div>
        </>
      )}
    </div>
  );
}

import { useState, useMemo, useRef } from "react";
import type { Event } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Download, Upload, Trash2, Loader2, Plus, X, Calendar, MapPin, User, DollarSign, Edit, ChevronRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function EventDatabase() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPlanner, setSelectedPlanner] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedQuarter, setSelectedQuarter] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const isSuperadmin = user?.role === 'superadmin';
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ['/api/events'],
    queryFn: async () => {
      const res = await fetch('/api/events');
      if (!res.ok) throw new Error('Failed to fetch events');
      return res.json();
    },
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
    onSuccess: () => {
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
    return Array.from(new Set(events.map(e => e.planner))).sort();
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

  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      const eventDate = new Date(event.date);
      const matchesSearch = event.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            event.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPlanner = selectedPlanner === "all" || event.planner === selectedPlanner;
      const matchesYear = selectedYear === "all" || getFinancialYear(eventDate) === selectedYear;
      const matchesQuarter = selectedQuarter === "all" || getQuarter(eventDate) === selectedQuarter;
      const matchesMonth = selectedMonth === "all" || eventDate.getMonth().toString() === selectedMonth;
      return matchesSearch && matchesPlanner && matchesYear && matchesQuarter && matchesMonth;
    });
  }, [events, searchTerm, selectedPlanner, selectedYear, selectedQuarter, selectedMonth]);

  const formatCurrency = (value: number) => {
    return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const generateEventId = (event: Event) => {
    const date = new Date(event.date);
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString('en', { month: 'short' }).toUpperCase();
    return `${event.customer.substring(0, 3).toUpperCase()}-${event.venue.substring(0, 3).toUpperCase()}-${day}${month}`;
  };

  const handleExport = () => {
    const headers = ['Wedding Planner', 'Client Name', 'Event ID', 'Date', 'Event Type', 'Venue', 'Sales Value', 'Payment Received', 'Balance', 'Total Cost', 'Profit', 'Profit %'];
    
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
        generateEventId(event),
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

  const EventDetailPanel = ({ event }: { event: Event }) => {
    const [panelIsEditing, setPanelIsEditing] = useState(false);
    const { register, handleSubmit, watch, reset } = useForm<Event>({ 
      defaultValues: event,
      values: event 
    });
    
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
            {isSuperadmin && !panelIsEditing && (
              <Button variant="ghost" size="sm" onClick={() => setPanelIsEditing(true)} data-testid="button-edit-event">
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={() => setSelectedEventId(null)} data-testid="button-close-panel">
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <ScrollArea className="flex-1">
          <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Event ID</p>
                  <p className="font-medium">{generateEventId(event)}</p>
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

            <div className="border-t pt-4">
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

            {panelIsEditing && (
              <div className="flex gap-2 pt-4 border-t">
                <Button type="button" variant="outline" className="flex-1" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={updateMutation.isPending} data-testid="button-save-event">
                  {updateMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : 'Save Changes'}
                </Button>
              </div>
            )}

            {isSuperadmin && !panelIsEditing && (
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

        <div className="p-3 sm:p-4 border-b bg-white">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="h-9 text-sm" data-testid="select-year">
                <SelectValue placeholder="All Years" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {availableYears.map(year => (
                  <SelectItem key={year} value={year}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
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
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="h-9 text-sm" data-testid="select-month">
                <SelectValue placeholder="All Months" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {months.map(month => (
                  <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                ))}
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
                
                return (
                  <div
                    key={event.id}
                    onClick={() => setSelectedEventId(event.id)}
                    className={cn(
                      "p-3 sm:p-4 rounded-lg border cursor-pointer transition-all hover:shadow-sm",
                      isSelected ? "border-primary bg-primary/5 shadow-sm" : "bg-white hover:border-gray-300"
                    )}
                    data-testid={`card-event-${event.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-sm truncate">{event.customer}</h3>
                          <span className="text-xs text-muted-foreground">{generateEventId(event)}</span>
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
          <div className="fixed top-0 right-0 w-full sm:w-[420px] h-full bg-white border-l shadow-lg z-50 lg:z-0">
            <EventDetailPanel event={selectedEvent} />
          </div>
        </>
      )}
    </div>
  );
}

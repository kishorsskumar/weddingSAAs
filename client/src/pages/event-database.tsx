import { useState, useMemo, useRef } from "react";
import type { Event } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Download, Upload, Trash2, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";

export default function EventDatabase() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPlanner, setSelectedPlanner] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedQuarter, setSelectedQuarter] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ['/api/events'],
    queryFn: async () => {
      const res = await fetch('/api/events');
      if (!res.ok) throw new Error('Failed to fetch events');
      return res.json();
    },
  });

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
      setEditingEvent(null);
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

  const yearFilteredEvents = useMemo(() => {
    if (selectedYear === "all") return events;
    return events.filter(event => {
      const eventDate = new Date(event.date);
      return getFinancialYear(eventDate) === selectedYear;
    });
  }, [events, selectedYear]);

  const calculateTotals = (eventList: Event[]) => {
    const salesValue = eventList.reduce((sum, e) => sum + Number(e.salesValue || 0), 0);
    const paymentReceived = eventList.reduce((sum, e) => sum + Number(e.paymentReceived || 0), 0);
    const actualCost = eventList.reduce((sum, e) => sum + Number(e.cost || 0), 0);
    const balance = salesValue - paymentReceived;
    const profit = salesValue - actualCost;
    const profitPercent = salesValue > 0 ? ((profit / salesValue) * 100) : 0;
    return { salesValue, paymentReceived, balance, actualCost, profit, profitPercent };
  };

  const fyTotals = calculateTotals(yearFilteredEvents);
  const filteredTotals = calculateTotals(filteredEvents);

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

  const EditEventForm = ({ event, onClose }: { event: Event; onClose: () => void }) => {
    const { register, handleSubmit, watch } = useForm<Event>({ defaultValues: event });
    
    const salesValue = watch("salesValue");
    const cost = watch("cost");
    const paymentReceived = watch("paymentReceived");
    const profit = (Number(salesValue) || 0) - (Number(cost) || 0);
    const profitPercent = salesValue ? ((profit / Number(salesValue)) * 100).toFixed(2) : "0";
    const balance = (Number(salesValue) || 0) - (Number(paymentReceived) || 0);

    const onSubmit = (data: Event) => {
      updateMutation.mutate({ id: event.id, data });
    };

    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
           <div className="space-y-2">
            <Label>Sales Value</Label>
            <Input type="number" {...register("salesValue")} />
          </div>
          <div className="space-y-2">
            <Label>Cost</Label>
            <Input type="number" {...register("cost")} />
          </div>
          <div className="space-y-2">
            <Label>Payment Received</Label>
            <Input type="number" {...register("paymentReceived")} />
          </div>
          <div className="space-y-2">
            <Label>Balance</Label>
            <Input disabled value={balance.toString()} />
          </div>
        </div>
        
        <div className="bg-muted p-3 sm:p-4 rounded-lg flex justify-between items-center">
            <div>
                <span className="text-xs sm:text-sm text-muted-foreground">Est. Profit</span>
                <div className="text-lg sm:text-xl font-bold text-primary">₹{profit.toLocaleString()}</div>
            </div>
             <div className="text-right">
                <span className="text-xs sm:text-sm text-muted-foreground">Margin</span>
                <div className="text-lg sm:text-xl font-bold text-primary">{profitPercent}%</div>
            </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
            <Label>Wedding Planner</Label>
            <Input {...register("planner")} />
          </div>
           <div className="space-y-2">
            <Label>Venue</Label>
            <Input {...register("venue")} />
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
          {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </form>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      <div className="flex flex-col gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold font-serif text-primary">Event Database</h1>
          <p className="text-sm text-muted-foreground">Track financials and details for all events</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2 text-xs sm:text-sm flex-1 sm:flex-none">
            <Upload className="h-4 w-4" /> <span className="hidden sm:inline">Import</span>
          </Button>
          <Button variant="outline" className="gap-2 text-xs sm:text-sm flex-1 sm:flex-none">
            <Download className="h-4 w-4" /> <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by customer name..."
          className="pl-10 bg-card border"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          data-testid="input-search"
        />
      </div>

      <Card className="bg-card">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Financial Year</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="text-sm" data-testid="select-year">
                  <SelectValue placeholder="All Years" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {availableYears.map(year => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Quarter</Label>
              <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
                <SelectTrigger className="text-sm" data-testid="select-quarter">
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
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Month</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="text-sm" data-testid="select-month">
                  <SelectValue placeholder="All Months" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Months</SelectItem>
                  {months.map(month => (
                    <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Wedding Planner</Label>
              <Select value={selectedPlanner} onValueChange={setSelectedPlanner}>
                <SelectTrigger className="text-sm" data-testid="select-planner">
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
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-purple-500 text-base font-medium">
              Selected FY Total {selectedYear === "all" ? "(All)" : `(${selectedYear})`}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sales Value:</span>
              <span className="font-medium">{formatCurrency(fyTotals.salesValue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment Received:</span>
              <span className="font-medium">{formatCurrency(fyTotals.paymentReceived)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Balance Payment:</span>
              <span className="font-medium">{formatCurrency(fyTotals.balance)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Actual Cost:</span>
              <span className="font-medium">{formatCurrency(fyTotals.actualCost)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Profit:</span>
              <span className="font-medium text-purple-500">{formatCurrency(fyTotals.profit)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Profit %:</span>
              <span className="font-medium text-purple-500">{fyTotals.profitPercent.toFixed(2)}%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-green-500 text-base font-medium">Filtered Total</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sales Value:</span>
              <span className="font-medium">{formatCurrency(filteredTotals.salesValue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment Received:</span>
              <span className="font-medium">{formatCurrency(filteredTotals.paymentReceived)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Balance Payment:</span>
              <span className="font-medium">{formatCurrency(filteredTotals.balance)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Actual Cost:</span>
              <span className="font-medium">{formatCurrency(filteredTotals.actualCost)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Profit:</span>
              <span className="font-medium text-green-500">{formatCurrency(filteredTotals.profit)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Profit %:</span>
              <span className="font-medium text-green-500">{filteredTotals.profitPercent.toFixed(2)}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-lg font-serif">All Events ({filteredEvents.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="min-w-[900px] px-4 sm:px-0">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs font-semibold">Wedding Planner</TableHead>
                      <TableHead className="text-xs font-semibold">Client Name</TableHead>
                      <TableHead className="text-xs font-semibold">Event ID</TableHead>
                      <TableHead className="text-xs font-semibold">Venue</TableHead>
                      <TableHead className="text-right text-xs font-semibold">Sales Value</TableHead>
                      <TableHead className="text-right text-xs font-semibold">Payment Received</TableHead>
                      <TableHead className="text-right text-xs font-semibold">Balance</TableHead>
                      <TableHead className="text-right text-xs font-semibold">Total Cost</TableHead>
                      <TableHead className="text-right text-xs font-semibold">Profit</TableHead>
                      <TableHead className="text-right text-xs font-semibold">Profit %</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEvents.map((event) => {
                        const salesValue = Number(event.salesValue) || 0;
                        const paymentReceived = Number(event.paymentReceived) || 0;
                        const cost = Number(event.cost) || 0;
                        const balance = salesValue - paymentReceived;
                        const profit = salesValue - cost;
                        const profitPercent = salesValue > 0 ? ((profit / salesValue) * 100) : 0;
                        const isProfitable = profit >= 0;
                        
                        return (
                        <TableRow key={event.id} className="hover:bg-muted/30">
                            <TableCell className="text-xs">{event.planner}</TableCell>
                            <TableCell className="text-xs font-medium">{event.customer}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{generateEventId(event)}</TableCell>
                            <TableCell className="text-xs">{event.venue}</TableCell>
                            <TableCell className="text-right text-xs">{formatCurrency(salesValue)}</TableCell>
                            <TableCell className="text-right text-xs">{formatCurrency(paymentReceived)}</TableCell>
                            <TableCell className={cn("text-right text-xs font-medium", balance > 0 ? "text-amber-600" : "text-green-600")}>
                              {formatCurrency(balance)}
                            </TableCell>
                            <TableCell className="text-right text-xs">{formatCurrency(cost)}</TableCell>
                            <TableCell className={cn("text-right text-xs font-medium", isProfitable ? "text-green-600" : "text-red-600")}>
                              {formatCurrency(profit)}
                            </TableCell>
                            <TableCell className={cn("text-right text-xs font-medium", isProfitable ? "text-green-600" : "text-red-600")}>
                              {profitPercent.toFixed(2)}%
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-1">
                                  <Dialog open={editingEvent?.id === event.id} onOpenChange={(open) => !open && setEditingEvent(null)}>
                                      <DialogTrigger asChild>
                                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setEditingEvent(event)} data-testid={`button-edit-${event.id}`}>Edit</Button>
                                      </DialogTrigger>
                                      <DialogContent className="max-w-[95vw] sm:max-w-lg">
                                          <DialogHeader>
                                              <DialogTitle>Edit Event Financials</DialogTitle>
                                          </DialogHeader>
                                          <EditEventForm event={event} onClose={() => setEditingEvent(null)} />
                                      </DialogContent>
                                  </Dialog>
                                  {isAdmin && (
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                      onClick={() => handleDelete(event.id, event.title)}
                                      data-testid={`button-delete-${event.id}`}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </div>
                            </TableCell>
                        </TableRow>
                        );
                    })}
                    {filteredEvents.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-8 text-muted-foreground text-sm">
                          No events found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

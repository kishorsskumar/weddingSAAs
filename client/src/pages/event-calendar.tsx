import { useState, Component, ErrorInfo, ReactNode } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, setMonth, setYear } from "date-fns";
import type { Event } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Plus, X, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('EventCalendar Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-center p-4">
          <p className="text-red-500 mb-2 font-semibold">Something went wrong loading the calendar</p>
          <p className="text-sm text-muted-foreground mb-4">{this.state.error?.message}</p>
          <Button onClick={() => window.location.reload()}>Reload Page</Button>
        </div>
      );
    }
    return this.props.children;
  }
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const YEARS = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 2 + i);

function EventCalendarContent() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const canAddEvents = user?.role === 'superadmin' || user?.role === 'accountant';
  const canEditEvents = user?.role === 'superadmin' || user?.role === 'accountant';

  const { data: events = [], isLoading, error } = useQuery<Event[]>({
    queryKey: ['/api/events'],
    queryFn: async () => {
      const res = await fetch('/api/events', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch events');
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Event>) => {
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
      setIsDialogOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/events/${id}`, { 
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Failed to delete event');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      setSelectedDay(null);
    },
    onError: (error) => {
      console.error('Delete failed:', error);
      alert('Failed to delete event: ' + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Event> }) => {
      const res = await fetch(`/api/events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to update event');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      setEditingEvent(null);
      toast({ title: 'Event updated successfully' });
    },
    onError: (error) => {
      toast({ title: 'Failed to update event', description: error.message, variant: 'destructive' });
    },
  });

  const handleDelete = (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete "${title}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3 text-muted-foreground">Loading calendar...</span>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-red-500 mb-2">Failed to load calendar</p>
        <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
      </div>
    );
  }

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  const getDayBackgroundStyle = (eventCount: number, isCurrentMonth: boolean): React.CSSProperties => {
    if (!isCurrentMonth) return {};
    if (eventCount >= 3) return { backgroundColor: '#EAC4C4' };
    if (eventCount === 2) return { backgroundColor: '#FFF5CC' };
    return {};
  };

  const getDayBackgroundColor = (eventCount: number, isCurrentMonth: boolean) => {
    if (!isCurrentMonth) return "bg-muted/20";
    return "";
  };

  const AddEventForm = () => {
    const { register, handleSubmit, watch } = useForm<Partial<Event>>();
    
    const customer = watch("customer") || "";
    const venue = watch("venue") || "";
    const date = watch("date") || "";
    
    const generateEventId = () => {
      const firstName = customer.split(' ')[0] || "";
      const venueShort = venue.split(' ')[0] || "";
      const dateFormatted = date ? format(new Date(date), "ddMMM") : "";
      if (firstName && venueShort && dateFormatted) {
        return `${firstName}-${venueShort}-${dateFormatted}`.toUpperCase();
      }
      return "";
    };
    
    const eventId = generateEventId();
    
    const onSubmit = (data: any) => {
      createMutation.mutate({
        ...data,
        title: eventId || (data.customer + ' - ' + data.type),
        salesValue: '0',
        paymentReceived: '0',
        cost: '0',
      });
    };

    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {eventId && (
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Event ID</p>
            <p className="text-base sm:text-lg font-bold text-primary font-mono">{eventId}</p>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="customer">Customer Name</Label>
          <Input id="customer" {...register("customer")} required placeholder="e.g. Rahul Sharma" data-testid="input-customer" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="date">Event Date</Label>
            <Input id="date" type="date" {...register("date")} required data-testid="input-date" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="time">Event Time</Label>
            <Input id="time" type="time" {...register("time")} data-testid="input-time" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">Type of Event</Label>
            <Input id="type" {...register("type")} required placeholder="e.g. Wedding" data-testid="input-type" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="venue">Venue</Label>
          <Input id="venue" {...register("venue")} required placeholder="e.g. Grand Oak Hall" data-testid="input-venue" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="planner">Wedding Planner</Label>
          <Input id="planner" {...register("planner")} required placeholder="e.g. Sarah Jenkins" data-testid="input-planner" />
        </div>
        <Button type="submit" className="w-full" disabled={createMutation.isPending}>
          {createMutation.isPending ? 'Creating...' : 'Create Event'}
        </Button>
      </form>
    );
  };

  const EditEventForm = ({ event }: { event: Event }) => {
    const { register, handleSubmit } = useForm({
      defaultValues: {
        customer: event.customer || '',
        date: event.date || '',
        time: event.time || '',
        type: event.type || '',
        venue: event.venue || '',
        planner: event.planner || '',
        salesValue: event.salesValue || '0',
        paymentReceived: event.paymentReceived || '0',
        cost: event.cost || '0',
      },
    });

    const onSubmit = (data: any) => {
      const customer = data.customer || '';
      const venue = data.venue || '';
      const dateStr = data.date || '';
      let title = event.title;
      if (customer && venue && dateStr) {
        const firstName = customer.split(' ')[0];
        const venueShort = venue.split(' ')[0];
        const dateFormatted = format(new Date(dateStr), "ddMMM");
        title = `${firstName}-${venueShort}-${dateFormatted}`.toUpperCase();
      }
      updateMutation.mutate({ id: event.id, data: { ...data, title } });
    };

    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Event Code</p>
          <p className="text-sm font-bold font-mono">{event.eventCode || event.id}</p>
        </div>
        <div className="space-y-2">
          <Label>Customer Name</Label>
          <Input {...register("customer")} required data-testid="input-edit-customer" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Event Date</Label>
            <Input type="date" {...register("date")} required data-testid="input-edit-date" />
          </div>
          <div className="space-y-2">
            <Label>Event Time</Label>
            <Input type="time" {...register("time")} data-testid="input-edit-time" />
          </div>
          <div className="space-y-2">
            <Label>Type of Event</Label>
            <Input {...register("type")} required data-testid="input-edit-type" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Venue</Label>
          <Input {...register("venue")} required data-testid="input-edit-venue" />
        </div>
        <div className="space-y-2">
          <Label>Wedding Planner</Label>
          <Input {...register("planner")} required data-testid="input-edit-planner" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Sales Value</Label>
            <Input {...register("salesValue")} data-testid="input-edit-sales" />
          </div>
          <div className="space-y-2">
            <Label>Payment Received</Label>
            <Input {...register("paymentReceived")} data-testid="input-edit-payment" />
          </div>
          <div className="space-y-2">
            <Label>Cost</Label>
            <Input {...register("cost")} data-testid="input-edit-cost" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => setEditingEvent(null)}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    );
  };

  const selectedDayEvents = selectedDay ? events.filter((e) => isSameDay(new Date(e.date), selectedDay)) : [];

  return (
    <div className="space-y-4 sm:space-y-6 h-full flex flex-col px-2 sm:px-0">
      <motion.div 
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <h1 className="text-xl sm:text-3xl font-bold font-serif text-primary">Event Calendar</h1>
          <div className="flex items-center gap-1 bg-card border rounded-md p-1 w-fit">
            <Button variant="outline" size="sm" onClick={prevMonth} className="h-10 w-10 sm:h-9 sm:w-9 p-0">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Select
              value={currentDate.getMonth().toString()}
              onValueChange={(value) => setCurrentDate(setMonth(currentDate, parseInt(value)))}
            >
              <SelectTrigger className="w-[110px] sm:w-[130px] h-9 border-0 bg-transparent font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((month, index) => (
                  <SelectItem key={month} value={index.toString()}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={currentDate.getFullYear().toString()}
              onValueChange={(value) => setCurrentDate(setYear(currentDate, parseInt(value)))}
            >
              <SelectTrigger className="w-[80px] h-9 border-0 bg-transparent font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={nextMonth} className="h-10 w-10 sm:h-9 sm:w-9 p-0">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
        {canAddEvents && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button className="gap-2 w-full sm:w-auto" data-testid="button-add-event">
                  <Plus className="h-4 w-4" /> New Event
                </Button>
              </motion.div>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Add New Event</DialogTitle>
              </DialogHeader>
              <AddEventForm />
            </DialogContent>
          </Dialog>
        )}
      </motion.div>

      <motion.div 
        className="flex items-center gap-2 text-xs flex-wrap"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
      >
        <span className="text-muted-foreground">Legend:</span>
        <motion.span 
          className="px-2 py-1 rounded bg-green-100 border border-green-200 text-green-800"
          whileHover={{ scale: 1.05 }}
        >
          Booking
        </motion.span>
        <motion.span 
          className="px-2 py-1 rounded border border-yellow-400" 
          style={{ backgroundColor: '#FFF5CC' }}
          whileHover={{ scale: 1.05 }}
        >
          2 Events
        </motion.span>
        <motion.span 
          className="px-2 py-1 rounded border border-red-300" 
          style={{ backgroundColor: '#EAC4C4' }}
          whileHover={{ scale: 1.05 }}
        >
          3+ Events
        </motion.span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        <Card className="flex-1 overflow-hidden flex flex-col shadow-md border-border/50">
          <div className="grid grid-cols-7 border-b bg-muted/30">
            {["S", "M", "T", "W", "T", "F", "S"].map((day, idx) => (
              <motion.div 
                key={idx} 
                className="p-2 sm:p-4 text-center text-xs sm:text-sm font-medium text-muted-foreground"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + idx * 0.03 }}
              >
                <span className="sm:hidden">{day}</span>
                <span className="hidden sm:inline">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][idx]}</span>
              </motion.div>
            ))}
          </div>
        <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-y-auto">
          {calendarDays.map((day) => {
            const dayEvents = events.filter((e) => isSameDay(new Date(e.date), day));
            const eventCount = dayEvents.length;
            const isCurrentMonth = isSameMonth(day, currentDate);
            
            return (
              <div
                key={day.toString()}
                onClick={() => setSelectedDay(day)}
                style={getDayBackgroundStyle(eventCount, isCurrentMonth)}
                className={cn(
                  "min-h-[60px] sm:min-h-[100px] border-b border-r p-1 sm:p-2 transition-colors cursor-pointer",
                  getDayBackgroundColor(eventCount, isCurrentMonth),
                  !isCurrentMonth && "text-muted-foreground/50",
                  isSameDay(day, new Date()) && "ring-2 ring-primary ring-inset",
                  selectedDay && isSameDay(day, selectedDay) && "ring-2 ring-primary"
                )}
              >
                <div className="flex justify-between items-start">
                  <span
                    className={cn(
                      "text-xs sm:text-sm font-medium h-5 w-5 sm:h-7 sm:w-7 flex items-center justify-center rounded-full",
                      isSameDay(day, new Date())
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  {eventCount > 0 && (
                    <span className="text-[10px] sm:text-xs bg-primary/20 text-primary px-1 rounded font-medium">
                      {eventCount}
                    </span>
                  )}
                </div>
                <div className="mt-1 space-y-0.5 hidden sm:block">
                  {dayEvents.slice(0, 2).map((event) => (
                    <div
                      key={event.id}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-800 border border-green-200 truncate group flex items-center justify-between"
                    >
                      <span className="truncate font-medium">{event.title}</span>
                      {canEditEvents && (
                        <button
                          onClick={(e) => handleDelete(e, event.id, event.title)}
                          className="opacity-0 group-hover:opacity-100 hover:text-red-600 transition-opacity ml-1 flex-shrink-0"
                          data-testid={`button-delete-calendar-${event.id}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                  {eventCount > 2 && (
                    <div className="text-[10px] text-muted-foreground">+{eventCount - 2} more</div>
                  )}
                </div>
                <div className="mt-1 sm:hidden">
                  {eventCount > 0 && (
                    <div className="w-2 h-2 rounded-full bg-green-500 mx-auto"></div>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        </Card>
      </motion.div>

      <Dialog open={!!selectedDay && !editingEvent} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedDay && format(selectedDay, "EEEE, MMMM d, yyyy")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {selectedDayEvents.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No events scheduled</p>
            ) : (
              selectedDayEvents.map((event) => (
                <div
                  key={event.id}
                  className="p-3 rounded-lg bg-green-50 border border-green-200 space-y-1"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-green-900">{event.title}</h4>
                    {canEditEvents && (
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-primary hover:text-primary hover:bg-primary/10"
                          onClick={(e) => { e.stopPropagation(); setEditingEvent(event); }}
                          data-testid={`button-edit-event-${event.id}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={(e) => handleDelete(e, event.id, event.title)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-green-800 space-y-0.5">
                    <p><span className="font-medium">Customer:</span> {event.customer}</p>
                    <p><span className="font-medium">Type:</span> {event.type}</p>
                    <p><span className="font-medium">Venue:</span> {event.venue}</p>
                    <p><span className="font-medium">Planner:</span> {event.planner}</p>
                    {event.time && <p><span className="font-medium">Time:</span> {event.time}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingEvent} onOpenChange={(open) => { if (!open) setEditingEvent(null); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
          </DialogHeader>
          {editingEvent && <EditEventForm event={editingEvent} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function EventCalendarPage() {
  return (
    <ErrorBoundary>
      <EventCalendarContent />
    </ErrorBoundary>
  );
}

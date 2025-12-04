import { useState } from "react";
import type { Event } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Download, Upload, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";

export default function EventDatabase() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPlanner, setSelectedPlanner] = useState<string>("all");
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();
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

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          event.customer.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPlanner = selectedPlanner === "all" || event.planner === selectedPlanner;
    return matchesSearch && matchesPlanner;
  });

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

      <Card>
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:gap-4">
            <CardTitle className="text-lg font-serif">All Events</CardTitle>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  className="pl-8 text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  data-testid="input-search"
                />
              </div>
              <Select value={selectedPlanner} onValueChange={setSelectedPlanner}>
                <SelectTrigger className="w-full sm:w-[160px] text-sm">
                  <SelectValue placeholder="Filter Planner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Planners</SelectItem>
                  {Array.from(new Set(events.map(e => e.planner))).map(planner => (
                    <SelectItem key={planner} value={planner}>{planner}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="min-w-[600px] px-4 sm:px-0">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs sm:text-sm">Event</TableHead>
                      <TableHead className="text-xs sm:text-sm">Date</TableHead>
                      <TableHead className="text-xs sm:text-sm hidden md:table-cell">Planner</TableHead>
                      <TableHead className="text-right text-xs sm:text-sm">Sales</TableHead>
                      <TableHead className="text-right text-xs sm:text-sm">Profit</TableHead>
                      <TableHead className="text-right text-xs sm:text-sm">Status</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEvents.map((event) => {
                        const profit = Number(event.salesValue) - Number(event.cost);
                        const isProfitable = profit > 0;
                        const balance = Number(event.salesValue) - Number(event.paymentReceived);
                        
                        return (
                        <TableRow key={event.id}>
                            <TableCell className="font-medium">
                                <div className="text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none">{event.title}</div>
                                <div className="text-[10px] sm:text-xs text-muted-foreground truncate">{event.customer}</div>
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm">{new Date(event.date).toLocaleDateString()}</TableCell>
                            <TableCell className="text-xs sm:text-sm hidden md:table-cell">{event.planner}</TableCell>
                            <TableCell className="text-right text-xs sm:text-sm">₹{Number(event.salesValue).toLocaleString()}</TableCell>
                            <TableCell className={cn("text-right font-medium text-xs sm:text-sm", isProfitable ? "text-green-600" : "text-red-600")}>
                                ₹{profit.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right">
                                 <span className={cn(
                                    "px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs",
                                    balance <= 0 ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                                 )}>
                                    {balance <= 0 ? "Paid" : "Due"}
                                 </span>
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-1">
                                  <Dialog open={editingEvent?.id === event.id} onOpenChange={(open) => !open && setEditingEvent(null)}>
                                      <DialogTrigger asChild>
                                          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setEditingEvent(event)} data-testid={`button-edit-${event.id}`}>Edit</Button>
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
                                      className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                      onClick={() => handleDelete(event.id, event.title)}
                                      data-testid={`button-delete-${event.id}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                            </TableCell>
                        </TableRow>
                        );
                    })}
                    {filteredEvents.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
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

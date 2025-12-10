import { useState, useMemo } from "react";
import type { Event, EventMilestone } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, ChevronLeft, Pencil, Trash2, RefreshCw, CheckCircle2, Clock, AlertTriangle, Calendar, MapPin, User } from "lucide-react";
import { format, parseISO, isBefore, startOfDay } from "date-fns";
import { useForm } from "react-hook-form";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { Link } from "wouter";

interface PendingMilestone extends EventMilestone {
  event?: Event;
}

export default function EventMilestones() {
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [addingToPhase, setAddingToPhase] = useState<number | null>(null);
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

  // Fetch pending milestones - server filters by role
  const { data: pendingMilestones = [], isLoading: pendingLoading } = useQuery<PendingMilestone[]>({
    queryKey: ['/api/milestones/pending-by-planner'],
    queryFn: async () => {
      const res = await fetch('/api/milestones/pending-by-planner');
      if (!res.ok) throw new Error('Failed to fetch pending milestones');
      return res.json();
    },
  });

  const { data: milestones = [], isLoading: milestonesLoading } = useQuery<EventMilestone[]>({
    queryKey: ['/api/milestones', selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const res = await fetch(`/api/milestones?eventId=${selectedEventId}`);
      if (!res.ok) throw new Error('Failed to fetch milestones');
      return res.json();
    },
    enabled: !!selectedEventId,
  });

  const selectedEvent = events.find(e => e.id === selectedEventId);

  // Group pending milestones by event
  const eventsWithPendingTasks = useMemo(() => {
    const eventMap = new Map<string, { event: Event; milestones: PendingMilestone[]; overdueCount: number }>();
    const today = startOfDay(new Date());
    
    pendingMilestones.forEach(milestone => {
      if (!milestone.event) return;
      const eventId = milestone.eventId;
      
      if (!eventMap.has(eventId)) {
        eventMap.set(eventId, { 
          event: milestone.event, 
          milestones: [], 
          overdueCount: 0 
        });
      }
      
      const entry = eventMap.get(eventId)!;
      entry.milestones.push(milestone);
      
      if (isBefore(parseISO(milestone.date), today)) {
        entry.overdueCount++;
      }
    });
    
    // Sort by overdue count (descending), then by event date (ascending)
    return Array.from(eventMap.values()).sort((a, b) => {
      if (b.overdueCount !== a.overdueCount) {
        return b.overdueCount - a.overdueCount;
      }
      return new Date(a.event.date).getTime() - new Date(b.event.date).getTime();
    });
  }, [pendingMilestones]);

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [events]);

  const groupedMilestones = useMemo(() => {
    const groups: Record<number, { phaseName: string; milestones: EventMilestone[] }> = {};
    for (let i = 1; i <= 7; i++) {
      const phaseMilestones = milestones.filter(m => m.phase === i);
      if (phaseMilestones.length > 0) {
        groups[i] = {
          phaseName: phaseMilestones[0].phaseName,
          milestones: phaseMilestones.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
        };
      } else {
        const phaseNames: Record<number, string> = {
          1: 'Event Kickoff',
          2: 'Design',
          3: 'Procurement & Production',
          4: 'Logistics & Coordination',
          5: 'Event Week',
          6: 'Event Day',
          7: 'Packup & Closure',
        };
        groups[i] = { phaseName: phaseNames[i], milestones: [] };
      }
    }
    return groups;
  }, [milestones]);

  const generateMilestonesMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const res = await fetch(`/api/milestones/generate/${eventId}`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to generate milestones');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/milestones', selectedEventId] });
    },
  });

  const createMilestoneMutation = useMutation({
    mutationFn: async (data: Partial<EventMilestone>) => {
      const res = await fetch('/api/milestones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create milestone');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/milestones', selectedEventId] });
      setAddingToPhase(null);
    },
  });

  const updateMilestoneMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EventMilestone> }) => {
      const res = await fetch(`/api/milestones/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update milestone');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/milestones', selectedEventId] });
      queryClient.invalidateQueries({ queryKey: ['/api/milestones/pending-by-planner'] });
    },
  });

  const deleteMilestoneMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/milestones/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete milestone');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/milestones', selectedEventId] });
    },
  });

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'dd/MM/yyyy');
    } catch {
      return dateStr;
    }
  };

  const AddMilestoneForm = ({ phase, phaseName }: { phase: number; phaseName: string }) => {
    const { register, handleSubmit, reset } = useForm<{ name: string; date: string; time: string }>();

    const onSubmit = (data: any) => {
      createMilestoneMutation.mutate({
        eventId: selectedEventId,
        phase,
        phaseName,
        name: data.name,
        date: data.date,
        time: data.time || null,
        status: 'pending',
      });
      reset();
    };

    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label>Milestone Name</Label>
          <Input {...register("name")} required placeholder="e.g. Client meeting" data-testid="input-milestone-name" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Date</Label>
            <Input type="date" {...register("date")} required data-testid="input-milestone-date" />
          </div>
          <div className="space-y-2">
            <Label>Time (Optional)</Label>
            <Input {...register("time")} placeholder="e.g. 2:00 pm" data-testid="input-milestone-time" />
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={createMilestoneMutation.isPending} data-testid="button-add-milestone">
          {createMilestoneMutation.isPending ? 'Adding...' : 'Add Milestone'}
        </Button>
      </form>
    );
  };

  const MilestoneRow = ({ milestone }: { milestone: EventMilestone }) => {
    return (
      <div className="flex items-center justify-between py-3 px-4 border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={cn(
            "w-2 h-2 rounded-full flex-shrink-0",
            milestone.status === 'completed' ? "bg-green-500" : "bg-slate-500"
          )} />
          <span className="text-sm truncate">{milestone.name}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {formatDate(milestone.date)}{milestone.time ? `, ${milestone.time}` : ''}
          </span>
          <Select
            value={milestone.status}
            onValueChange={(value) => updateMilestoneMutation.mutate({ id: milestone.id, data: { status: value as any } })}
          >
            <SelectTrigger className={cn(
              "w-[120px] h-8 text-xs",
              milestone.status === 'completed' 
                ? "bg-green-900/30 border-green-700 text-green-400" 
                : "bg-red-900/30 border-red-700 text-red-400"
            )} data-testid={`select-status-${milestone.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          {isAdmin && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => {
                if (confirm('Delete this milestone?')) {
                  deleteMilestoneMutation.mutate(milestone.id);
                }
              }}
              data-testid={`button-delete-milestone-${milestone.id}`}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold font-serif text-primary">Oak Event Milestones</h1>
          <p className="text-sm text-muted-foreground">Track event planning progress</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedEventId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedEventId("")}
              className="gap-2"
              data-testid="button-back-to-dashboard"
            >
              <ChevronLeft className="h-4 w-4" />
              All Events
            </Button>
          )}
          <Select value={selectedEventId} onValueChange={setSelectedEventId}>
            <SelectTrigger className="w-[250px]" data-testid="select-event">
              <SelectValue placeholder="Select an event" />
            </SelectTrigger>
            <SelectContent>
              {sortedEvents.map((event) => (
                <SelectItem key={event.id} value={event.id}>
                  {event.customer} - {formatDate(event.date)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isAdmin && selectedEventId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateMilestonesMutation.mutate(selectedEventId)}
              disabled={generateMilestonesMutation.isPending}
              className="gap-2"
              data-testid="button-regenerate-milestones"
            >
              <RefreshCw className={cn("h-4 w-4", generateMilestonesMutation.isPending && "animate-spin")} />
              {generateMilestonesMutation.isPending ? 'Generating...' : 'Regenerate'}
            </Button>
          )}
        </div>
      </div>

      {!selectedEventId ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Events with Pending Tasks
            </h2>
            <span className="text-sm text-muted-foreground">
              {eventsWithPendingTasks.length} events with pending milestones
            </span>
          </div>
          
          {pendingLoading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">Loading pending tasks...</p>
              </CardContent>
            </Card>
          ) : eventsWithPendingTasks.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <p className="text-muted-foreground">All tasks are completed! No pending milestones.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {eventsWithPendingTasks.map(({ event, milestones: eventMilestones, overdueCount }) => {
                const today = startOfDay(new Date());
                const upcomingMilestones = eventMilestones
                  .filter(m => !isBefore(parseISO(m.date), today))
                  .slice(0, 3);
                const overdueMilestones = eventMilestones
                  .filter(m => isBefore(parseISO(m.date), today))
                  .slice(0, 3);
                
                return (
                  <Card 
                    key={event.id} 
                    className={cn(
                      "cursor-pointer hover:border-primary/50 transition-all",
                      overdueCount > 0 && "border-red-500/50 bg-red-950/10"
                    )}
                    onClick={() => setSelectedEventId(event.id)}
                    data-testid={`card-event-pending-${event.id}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base line-clamp-1">
                          {event.customer}
                        </CardTitle>
                        {overdueCount > 0 && (
                          <Badge variant="destructive" className="shrink-0">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {overdueCount} Overdue
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(event.date)}
                        </span>
                        {event.venue && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {event.venue}
                          </span>
                        )}
                        {event.planner && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {event.planner}
                          </span>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Pending Tasks</span>
                          <span className="font-medium">{eventMilestones.length}</span>
                        </div>
                        
                        {overdueMilestones.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-red-400">Overdue:</p>
                            {overdueMilestones.map(m => (
                              <div key={m.id} className="flex items-center gap-2 text-xs text-red-300/80">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                                <span className="truncate flex-1">{m.name}</span>
                                <span className="text-red-400/60 shrink-0">{formatDate(m.date)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {upcomingMilestones.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-amber-400">Upcoming:</p>
                            {upcomingMilestones.map(m => (
                              <div key={m.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                <span className="truncate flex-1">{m.name}</span>
                                <span className="text-muted-foreground/60 shrink-0">{formatDate(m.date)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {eventMilestones.length > 6 && (
                          <p className="text-xs text-muted-foreground text-center pt-1">
                            +{eventMilestones.length - 6} more tasks...
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ) : milestonesLoading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Loading milestones...</p>
          </CardContent>
        </Card>
      ) : milestones.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <p className="text-muted-foreground">No milestones found for this event</p>
            {isAdmin && (
              <Button onClick={() => generateMilestonesMutation.mutate(selectedEventId)} data-testid="button-generate-milestones">
                Generate Default Milestones
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {selectedEvent && (
            <Card className="bg-slate-900/50 border-slate-700">
              <CardContent className="py-4">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Pencil className="h-4 w-4 text-primary" />
                    <span className="font-medium">{selectedEvent.customer}</span>
                  </div>
                  <span className="text-muted-foreground">|</span>
                  <span className="text-muted-foreground">{selectedEvent.venue}</span>
                  <span className="text-muted-foreground">|</span>
                  <span className="text-muted-foreground">{formatDate(selectedEvent.date)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {[1, 2, 3, 4, 5, 6, 7].map((phase) => {
            const phaseData = groupedMilestones[phase];
            const completedCount = phaseData.milestones.filter(m => m.status === 'completed').length;
            const totalCount = phaseData.milestones.length;

            return (
              <Card key={phase} className="bg-slate-900/30 border-slate-700/50 overflow-hidden">
                <CardHeader className="py-3 px-4 bg-slate-800/50 border-b border-slate-700/50">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-amber-400 flex items-center gap-2">
                      Phase {phase} - {phaseData.phaseName}
                      {totalCount > 0 && (
                        <span className="text-xs text-muted-foreground font-normal">
                          ({completedCount}/{totalCount})
                        </span>
                      )}
                    </CardTitle>
                    {isAdmin && (
                      <Dialog open={addingToPhase === phase} onOpenChange={(open) => !open && setAddingToPhase(null)}>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-xs text-muted-foreground hover:text-white"
                            onClick={() => setAddingToPhase(phase)}
                            data-testid={`button-add-to-phase-${phase}`}
                          >
                            <Plus className="h-3 w-3" /> Add
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-[95vw] sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>Add Milestone to Phase {phase}</DialogTitle>
                          </DialogHeader>
                          <AddMilestoneForm phase={phase} phaseName={phaseData.phaseName} />
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {phaseData.milestones.length === 0 ? (
                    <div className="py-4 text-center text-muted-foreground text-sm">
                      No milestones in this phase
                    </div>
                  ) : (
                    phaseData.milestones.map((milestone) => (
                      <MilestoneRow key={milestone.id} milestone={milestone} />
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useState, useMemo } from "react";
import type { Event, EventMilestone } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, ChevronLeft, Pencil, Trash2, RefreshCw, CheckCircle2, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useForm } from "react-hook-form";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { Link } from "wouter";

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
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Select an event to view its milestones</p>
          </CardContent>
        </Card>
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

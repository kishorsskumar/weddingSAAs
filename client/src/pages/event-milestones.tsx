import { useState, useMemo } from "react";
import type { Event, EventMilestone } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, ChevronLeft, Pencil, Trash2, RefreshCw, CheckCircle2, Clock, AlertTriangle, Calendar, MapPin, User, ChevronDown, ChevronUp, Rocket, Palette, ShoppingCart, Truck, CalendarDays, PartyPopper, PackageCheck } from "lucide-react";
import { format, parseISO, isBefore, startOfDay } from "date-fns";
import { useForm } from "react-hook-form";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

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

  // Phase icons and colors
  const phaseConfig: Record<number, { icon: any; color: string; bgColor: string }> = {
    1: { icon: Rocket, color: 'text-blue-400', bgColor: 'bg-blue-500' },
    2: { icon: Palette, color: 'text-purple-400', bgColor: 'bg-purple-500' },
    3: { icon: ShoppingCart, color: 'text-amber-400', bgColor: 'bg-amber-500' },
    4: { icon: Truck, color: 'text-teal-400', bgColor: 'bg-teal-500' },
    5: { icon: CalendarDays, color: 'text-pink-400', bgColor: 'bg-pink-500' },
    6: { icon: PartyPopper, color: 'text-green-400', bgColor: 'bg-green-500' },
    7: { icon: PackageCheck, color: 'text-indigo-400', bgColor: 'bg-indigo-500' },
  };

  // Visual Flow Diagram Component
  const MilestoneFlowDiagram = () => {
    const [expandedPhase, setExpandedPhase] = useState<number | null>(null);
    
    const phases = [1, 2, 3, 4, 5, 6, 7];
    
    const getPhaseStats = (phase: number) => {
      const phaseData = groupedMilestones[phase];
      const total = phaseData.milestones.length;
      const completed = phaseData.milestones.filter(m => m.status === 'completed').length;
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
      const isComplete = total > 0 && completed === total;
      const hasOverdue = phaseData.milestones.some(m => 
        m.status !== 'completed' && isBefore(parseISO(m.date), startOfDay(new Date()))
      );
      return { total, completed, progress, isComplete, hasOverdue, phaseName: phaseData.phaseName };
    };

    // Calculate overall progress
    const overallProgress = useMemo(() => {
      const allMilestones = Object.values(groupedMilestones).flatMap(p => p.milestones);
      const total = allMilestones.length;
      const completed = allMilestones.filter(m => m.status === 'completed').length;
      return total > 0 ? Math.round((completed / total) * 100) : 0;
    }, [groupedMilestones]);

    return (
      <div className="space-y-6">
        {/* Overall Progress Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-green-900/30 via-emerald-900/20 to-green-900/30 rounded-2xl p-6 border border-green-700/30"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Project Progress</h3>
              <p className="text-sm text-muted-foreground">{selectedEvent?.customer} - {selectedEvent?.venue}</p>
            </div>
            <div className="text-right">
              <motion.div 
                className="text-4xl font-bold text-green-400"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
              >
                {overallProgress}%
              </motion.div>
              <p className="text-xs text-muted-foreground">Complete</p>
            </div>
          </div>
          <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-gradient-to-r from-green-600 to-emerald-400 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${overallProgress}%` }}
              transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
            />
          </div>
        </motion.div>

        {/* S-Curve Flow Diagram */}
        <div className="relative py-8">
          {/* Flow Path Background */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
            <defs>
              <linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#6b9937" stopOpacity="0.3" />
                <stop offset="50%" stopColor="#22c55e" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#6b9937" stopOpacity="0.3" />
              </linearGradient>
            </defs>
          </svg>

          {/* Phase Cards in S-Curve Layout */}
          <div className="space-y-4">
            {/* Row 1: Phases 1-3 (left to right) */}
            <motion.div 
              className="grid grid-cols-3 gap-4"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              {phases.slice(0, 3).map((phase, idx) => {
                const stats = getPhaseStats(phase);
                const config = phaseConfig[phase];
                const Icon = config.icon;
                
                return (
                  <motion.div
                    key={phase}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    whileHover={{ scale: 1.02, y: -4 }}
                    onClick={() => setExpandedPhase(expandedPhase === phase ? null : phase)}
                    className={cn(
                      "relative cursor-pointer rounded-xl p-4 border-2 transition-all duration-300",
                      stats.isComplete 
                        ? "bg-green-900/30 border-green-500/50 shadow-lg shadow-green-500/20" 
                        : stats.hasOverdue
                        ? "bg-red-900/20 border-red-500/50"
                        : "bg-slate-900/50 border-slate-700/50 hover:border-slate-600",
                      expandedPhase === phase && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                    )}
                    data-testid={`phase-card-${phase}`}
                  >
                    {/* Connector Arrow */}
                    {idx < 2 && (
                      <div className="absolute -right-4 top-1/2 -translate-y-1/2 z-10">
                        <motion.div 
                          className={cn(
                            "w-8 h-1 rounded",
                            stats.isComplete ? "bg-green-500" : "bg-slate-600"
                          )}
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ delay: 0.5 + idx * 0.1 }}
                        />
                      </div>
                    )}
                    
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center",
                        stats.isComplete ? "bg-green-500/20" : "bg-slate-800"
                      )}>
                        <Icon className={cn("w-6 h-6", stats.isComplete ? "text-green-400" : config.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-muted-foreground">Phase {phase}</span>
                          {stats.isComplete && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", stiffness: 500 }}
                            >
                              <CheckCircle2 className="w-4 h-4 text-green-400" />
                            </motion.div>
                          )}
                          {stats.hasOverdue && (
                            <AlertTriangle className="w-4 h-4 text-red-400 animate-pulse" />
                          )}
                        </div>
                        <h4 className="text-sm font-semibold truncate">{stats.phaseName}</h4>
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                            <span>{stats.completed}/{stats.total} tasks</span>
                            <span>{stats.progress}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <motion.div 
                              className={cn(
                                "h-full rounded-full",
                                stats.isComplete ? "bg-green-500" : stats.hasOverdue ? "bg-red-500" : "bg-amber-500"
                              )}
                              initial={{ width: 0 }}
                              animate={{ width: `${stats.progress}%` }}
                              transition={{ duration: 0.8, delay: 0.2 + idx * 0.1 }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Expand indicator */}
                    <div className="absolute bottom-2 right-2">
                      {expandedPhase === phase ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>

            {/* Expanded Phase Details for Row 1 */}
            <AnimatePresence>
              {expandedPhase && expandedPhase <= 3 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <PhaseDetails phase={expandedPhase} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Curved Connector */}
            <div className="flex justify-end pr-8">
              <motion.div 
                className="w-1 h-8 bg-gradient-to-b from-slate-600 to-slate-700 rounded-full"
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: 0.6 }}
              />
            </div>

            {/* Row 2: Phases 4-5 (right to left) */}
            <motion.div 
              className="grid grid-cols-3 gap-4"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <div /> {/* Empty space */}
              {phases.slice(3, 5).reverse().map((phase, idx) => {
                const stats = getPhaseStats(phase);
                const config = phaseConfig[phase];
                const Icon = config.icon;
                
                return (
                  <motion.div
                    key={phase}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + idx * 0.1 }}
                    whileHover={{ scale: 1.02, y: -4 }}
                    onClick={() => setExpandedPhase(expandedPhase === phase ? null : phase)}
                    className={cn(
                      "relative cursor-pointer rounded-xl p-4 border-2 transition-all duration-300",
                      stats.isComplete 
                        ? "bg-green-900/30 border-green-500/50 shadow-lg shadow-green-500/20" 
                        : stats.hasOverdue
                        ? "bg-red-900/20 border-red-500/50"
                        : "bg-slate-900/50 border-slate-700/50 hover:border-slate-600",
                      expandedPhase === phase && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                    )}
                    data-testid={`phase-card-${phase}`}
                  >
                    {/* Connector Arrow */}
                    {idx === 0 && (
                      <div className="absolute -left-4 top-1/2 -translate-y-1/2 z-10">
                        <motion.div 
                          className={cn(
                            "w-8 h-1 rounded",
                            stats.isComplete ? "bg-green-500" : "bg-slate-600"
                          )}
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ delay: 0.7 }}
                        />
                      </div>
                    )}
                    
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center",
                        stats.isComplete ? "bg-green-500/20" : "bg-slate-800"
                      )}>
                        <Icon className={cn("w-6 h-6", stats.isComplete ? "text-green-400" : config.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-muted-foreground">Phase {phase}</span>
                          {stats.isComplete && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", stiffness: 500 }}
                            >
                              <CheckCircle2 className="w-4 h-4 text-green-400" />
                            </motion.div>
                          )}
                          {stats.hasOverdue && (
                            <AlertTriangle className="w-4 h-4 text-red-400 animate-pulse" />
                          )}
                        </div>
                        <h4 className="text-sm font-semibold truncate">{stats.phaseName}</h4>
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                            <span>{stats.completed}/{stats.total} tasks</span>
                            <span>{stats.progress}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <motion.div 
                              className={cn(
                                "h-full rounded-full",
                                stats.isComplete ? "bg-green-500" : stats.hasOverdue ? "bg-red-500" : "bg-amber-500"
                              )}
                              initial={{ width: 0 }}
                              animate={{ width: `${stats.progress}%` }}
                              transition={{ duration: 0.8, delay: 0.5 + idx * 0.1 }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="absolute bottom-2 right-2">
                      {expandedPhase === phase ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>

            {/* Expanded Phase Details for Row 2 */}
            <AnimatePresence>
              {expandedPhase && expandedPhase >= 4 && expandedPhase <= 5 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <PhaseDetails phase={expandedPhase} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Curved Connector */}
            <div className="flex justify-start pl-8">
              <motion.div 
                className="w-1 h-8 bg-gradient-to-b from-slate-700 to-slate-600 rounded-full"
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: 0.8 }}
              />
            </div>

            {/* Row 3: Phases 6-7 (left to right) */}
            <motion.div 
              className="grid grid-cols-3 gap-4"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
            >
              {phases.slice(5, 7).map((phase, idx) => {
                const stats = getPhaseStats(phase);
                const config = phaseConfig[phase];
                const Icon = config.icon;
                
                return (
                  <motion.div
                    key={phase}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 + idx * 0.1 }}
                    whileHover={{ scale: 1.02, y: -4 }}
                    onClick={() => setExpandedPhase(expandedPhase === phase ? null : phase)}
                    className={cn(
                      "relative cursor-pointer rounded-xl p-4 border-2 transition-all duration-300",
                      stats.isComplete 
                        ? "bg-green-900/30 border-green-500/50 shadow-lg shadow-green-500/20" 
                        : stats.hasOverdue
                        ? "bg-red-900/20 border-red-500/50"
                        : "bg-slate-900/50 border-slate-700/50 hover:border-slate-600",
                      expandedPhase === phase && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                    )}
                    data-testid={`phase-card-${phase}`}
                  >
                    {/* Connector Arrow */}
                    {idx === 0 && (
                      <div className="absolute -right-4 top-1/2 -translate-y-1/2 z-10">
                        <motion.div 
                          className={cn(
                            "w-8 h-1 rounded",
                            stats.isComplete ? "bg-green-500" : "bg-slate-600"
                          )}
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ delay: 0.9 }}
                        />
                      </div>
                    )}
                    
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center",
                        stats.isComplete ? "bg-green-500/20" : "bg-slate-800"
                      )}>
                        <Icon className={cn("w-6 h-6", stats.isComplete ? "text-green-400" : config.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-muted-foreground">Phase {phase}</span>
                          {stats.isComplete && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", stiffness: 500 }}
                            >
                              <CheckCircle2 className="w-4 h-4 text-green-400" />
                            </motion.div>
                          )}
                          {stats.hasOverdue && (
                            <AlertTriangle className="w-4 h-4 text-red-400 animate-pulse" />
                          )}
                        </div>
                        <h4 className="text-sm font-semibold truncate">{stats.phaseName}</h4>
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                            <span>{stats.completed}/{stats.total} tasks</span>
                            <span>{stats.progress}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <motion.div 
                              className={cn(
                                "h-full rounded-full",
                                stats.isComplete ? "bg-green-500" : stats.hasOverdue ? "bg-red-500" : "bg-amber-500"
                              )}
                              initial={{ width: 0 }}
                              animate={{ width: `${stats.progress}%` }}
                              transition={{ duration: 0.8, delay: 0.8 + idx * 0.1 }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="absolute bottom-2 right-2">
                      {expandedPhase === phase ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </motion.div>
                );
              })}
              <div /> {/* Empty space */}
            </motion.div>

            {/* Expanded Phase Details for Row 3 */}
            <AnimatePresence>
              {expandedPhase && expandedPhase >= 6 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <PhaseDetails phase={expandedPhase} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Legend */}
        <motion.div 
          className="flex items-center justify-center gap-6 text-xs text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span>In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span>Overdue</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-slate-600" />
            <span>Pending</span>
          </div>
        </motion.div>
      </div>
    );
  };

  // Phase Details Component (shows individual milestones)
  const PhaseDetails = ({ phase }: { phase: number }) => {
    const phaseData = groupedMilestones[phase];
    
    return (
      <motion.div 
        className="bg-slate-900/50 rounded-xl border border-slate-700/50 p-4 mt-2"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-amber-400">
            Phase {phase} - {phaseData.phaseName} Tasks
          </h4>
          {isAdmin && (
            <Dialog open={addingToPhase === phase} onOpenChange={(open) => !open && setAddingToPhase(null)}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => setAddingToPhase(phase)}
                >
                  <Plus className="h-3 w-3" /> Add Task
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Milestone to Phase {phase}</DialogTitle>
                </DialogHeader>
                <AddMilestoneForm phase={phase} phaseName={phaseData.phaseName} />
              </DialogContent>
            </Dialog>
          )}
        </div>
        
        {phaseData.milestones.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-4">No tasks in this phase</p>
        ) : (
          <div className="space-y-2">
            {phaseData.milestones.map((milestone, idx) => (
              <motion.div
                key={milestone.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border transition-all",
                  milestone.status === 'completed' 
                    ? "bg-green-900/20 border-green-700/30" 
                    : isBefore(parseISO(milestone.date), startOfDay(new Date()))
                    ? "bg-red-900/20 border-red-700/30"
                    : "bg-slate-800/50 border-slate-700/30"
                )}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <motion.div 
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0",
                      milestone.status === 'completed' ? "bg-green-500" : "bg-slate-700"
                    )}
                    whileHover={{ scale: 1.1 }}
                  >
                    {milestone.status === 'completed' ? (
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    ) : (
                      <Clock className="w-3 h-3 text-slate-400" />
                    )}
                  </motion.div>
                  <div className="min-w-0">
                    <p className={cn(
                      "text-sm truncate",
                      milestone.status === 'completed' && "line-through text-muted-foreground"
                    )}>
                      {milestone.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(milestone.date)}{milestone.time ? ` at ${milestone.time}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={milestone.status}
                    onValueChange={(value) => updateMilestoneMutation.mutate({ id: milestone.id, data: { status: value as any } })}
                  >
                    <SelectTrigger 
                      className={cn(
                        "w-[110px] h-8 text-xs",
                        milestone.status === 'completed' 
                          ? "bg-green-900/30 border-green-700 text-green-400" 
                          : "bg-slate-800 border-slate-600"
                      )}
                      data-testid={`select-status-${milestone.id}`}
                    >
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
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
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
        <MilestoneFlowDiagram />
      )}
    </div>
  );
}

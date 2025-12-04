import { useState } from "react";
import { format, addDays, subDays } from "date-fns";
import type { Meeting } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Clock, Plus, User, Pencil, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";

export default function TeamCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'superadmin';

  const currentDateStr = format(currentDate, 'yyyy-MM-dd');

  const { data: meetings = [] } = useQuery<Meeting[]>({
    queryKey: ['/api/meetings', currentDateStr],
    queryFn: async () => {
      const res = await fetch(`/api/meetings?date=${currentDateStr}`);
      if (!res.ok) throw new Error('Failed to fetch meetings');
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Meeting>) => {
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create meeting');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meetings'] });
      setIsDialogOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Meeting> }) => {
      const res = await fetch(`/api/meetings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update meeting');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meetings'] });
      setEditingMeeting(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/meetings/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete meeting');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meetings'] });
    },
  });

  const handleDelete = (id: string, title: string) => {
    if (confirm(`Are you sure you want to delete "${title}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  const nextDay = () => setCurrentDate(addDays(currentDate, 1));
  const prevDay = () => setCurrentDate(subDays(currentDate, 1));

  const AddMeetingForm = () => {
    const { register, handleSubmit } = useForm<Partial<Meeting>>();
    
    const onSubmit = (data: any) => {
      createMutation.mutate({
        ...data,
        date: currentDateStr,
      });
    };

    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Meeting Title</Label>
          <Input id="title" {...register("title")} required />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="time">Time</Label>
            <Input id="time" type="time" {...register("time")} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="attendees">Attendees</Label>
            <Input id="attendees" {...register("attendees")} placeholder="e.g. John, Sarah" />
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={createMutation.isPending}>
          {createMutation.isPending ? 'Scheduling...' : 'Schedule Meeting'}
        </Button>
      </form>
    );
  };

  const EditMeetingForm = ({ meeting, onClose }: { meeting: Meeting; onClose: () => void }) => {
    const { register, handleSubmit } = useForm<Partial<Meeting>>({
      defaultValues: {
        title: meeting.title,
        time: meeting.time,
        attendees: meeting.attendees,
      }
    });
    
    const onSubmit = (data: any) => {
      updateMutation.mutate({ id: meeting.id, data });
    };

    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="edit-title">Meeting Title</Label>
          <Input id="edit-title" {...register("title")} required />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="edit-time">Time</Label>
            <Input id="edit-time" type="time" {...register("time")} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-attendees">Attendees</Label>
            <Input id="edit-attendees" {...register("attendees")} placeholder="e.g. John, Sarah" />
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
          {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </form>
    );
  };

  const todaysMeetings = meetings.sort((a, b) => a.time.localeCompare(b.time));
  const hours = Array.from({ length: 13 }, (_, i) => i + 8);

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold font-serif text-primary">Team Calendar</h1>
          <p className="text-sm text-muted-foreground">Manage daily schedules and meetings</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
           <div className="flex items-center gap-2 bg-card border rounded-md p-1 justify-center">
            <Button variant="ghost" size="icon" onClick={prevDay} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs sm:text-sm font-medium min-w-[100px] sm:min-w-[120px] text-center">
              {format(currentDate, "EEE, MMM d")}
            </span>
            <Button variant="ghost" size="icon" onClick={nextDay} className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 w-full sm:w-auto" data-testid="button-add-meeting">
                <Plus className="h-4 w-4" /> Add Meeting
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Schedule Meeting</DialogTitle>
              </DialogHeader>
              <AddMeetingForm />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="lg:col-span-2 order-2 lg:order-1">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="font-serif text-lg">Daily Timeline</CardTitle>
          </CardHeader>
          <CardContent className="relative min-h-[400px] sm:min-h-[600px] p-4 sm:p-6 pt-0 sm:pt-0">
             <div className="absolute left-12 sm:left-16 top-0 bottom-0 w-px bg-border" />
             {hours.map(hour => (
               <div key={hour} className="flex items-start h-14 sm:h-20 border-b border-dashed last:border-0">
                 <div className="w-12 sm:w-16 text-[10px] sm:text-xs text-muted-foreground text-right pr-2 sm:pr-4 pt-1">
                   {hour}:00
                 </div>
                 <div className="flex-1 relative pt-1 pl-2 sm:pl-4">
                   {todaysMeetings.filter(m => parseInt(m.time.split(':')[0]) === hour).map(m => (
                     <div key={m.id} className="absolute left-1 sm:left-2 right-1 sm:right-2 bg-secondary border-l-4 border-primary p-1.5 sm:p-2 rounded text-xs shadow-sm group">
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-[11px] sm:text-xs truncate">{m.title}</div>
                            <div className="flex items-center gap-1 sm:gap-2 text-muted-foreground mt-0.5 sm:mt-1 text-[10px] sm:text-xs">
                              <Clock className="h-3 w-3 flex-shrink-0" /> {m.time}
                              {m.attendees && <span className="hidden sm:inline"><User className="h-3 w-3 ml-2" /> {m.attendees}</span>}
                            </div>
                          </div>
                          {isSuperAdmin && (
                            <div className="flex gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-5 w-5 sm:h-6 sm:w-6"
                                onClick={() => setEditingMeeting(m)}
                                data-testid={`button-edit-meeting-${m.id}`}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-5 w-5 sm:h-6 sm:w-6 text-destructive hover:text-destructive"
                                onClick={() => handleDelete(m.id, m.title)}
                                data-testid={`button-delete-meeting-${m.id}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                     </div>
                   ))}
                 </div>
               </div>
             ))}
          </CardContent>
        </Card>

        <Card className="order-1 lg:order-2">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="font-serif text-lg">Agenda</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            {todaysMeetings.length === 0 ? (
              <div className="text-center py-6 sm:py-8 text-muted-foreground text-sm">
                No meetings scheduled for today.
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {todaysMeetings.map(m => (
                  <div key={m.id} className="flex gap-3 sm:gap-4 p-3 sm:p-4 bg-muted/20 rounded-lg border group">
                    <div className="flex flex-col items-center justify-center min-w-[50px] sm:min-w-[60px] bg-card rounded border p-1.5 sm:p-2">
                      <span className="text-sm sm:text-lg font-bold text-primary">{m.time}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-sm truncate">{m.title}</h3>
                      {m.attendees && (
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1 truncate">{m.attendees}</p>
                      )}
                    </div>
                    {isSuperAdmin && (
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => setEditingMeeting(m)}
                          data-testid={`button-edit-agenda-${m.id}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(m.id, m.title)}
                          data-testid={`button-delete-agenda-${m.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!editingMeeting} onOpenChange={(open) => !open && setEditingMeeting(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Meeting</DialogTitle>
          </DialogHeader>
          {editingMeeting && (
            <EditMeetingForm meeting={editingMeeting} onClose={() => setEditingMeeting(null)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

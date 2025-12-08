import { useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import type { Meeting } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Clock, Plus, User, Pencil, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";

export default function TeamCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const queryClient = useQueryClient();

  const { data: meetings = [] } = useQuery<Meeting[]>({
    queryKey: ['/api/meetings/all'],
    queryFn: async () => {
      const res = await fetch('/api/meetings/all');
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
      queryClient.invalidateQueries({ queryKey: ['/api/meetings/all'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/meetings/all'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/meetings/all'] });
    },
  });

  const handleDelete = (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete "${title}"?`)) {
      deleteMutation.mutate(id);
    }
  };

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

  const getDayBackgroundStyle = (meetingCount: number, isCurrentMonth: boolean): React.CSSProperties => {
    if (!isCurrentMonth) return {};
    if (meetingCount >= 3) return { backgroundColor: '#D4E8F2' };
    if (meetingCount === 2) return { backgroundColor: '#E8F4EA' };
    return {};
  };

  const getDayBackgroundColor = (meetingCount: number, isCurrentMonth: boolean) => {
    if (!isCurrentMonth) return "bg-muted/20";
    return "";
  };

  const AddMeetingForm = ({ preselectedDate }: { preselectedDate?: string }) => {
    const { register, handleSubmit } = useForm<Partial<Meeting>>({
      defaultValues: {
        date: preselectedDate || format(new Date(), 'yyyy-MM-dd'),
      }
    });
    
    const onSubmit = (data: any) => {
      createMutation.mutate(data);
    };

    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Meeting Title</Label>
          <Input id="title" {...register("title")} required data-testid="input-meeting-title" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" {...register("date")} required data-testid="input-meeting-date" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="time">Time</Label>
            <Input id="time" type="time" {...register("time")} required data-testid="input-meeting-time" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="attendees">Attendees</Label>
          <Input id="attendees" {...register("attendees")} placeholder="e.g. John, Sarah" data-testid="input-meeting-attendees" />
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
        date: meeting.date,
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
            <Label htmlFor="edit-date">Date</Label>
            <Input id="edit-date" type="date" {...register("date")} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-time">Time</Label>
            <Input id="edit-time" type="time" {...register("time")} required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-attendees">Attendees</Label>
          <Input id="edit-attendees" {...register("attendees")} placeholder="e.g. John, Sarah" />
        </div>
        <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
          {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </form>
    );
  };

  const selectedDayMeetings = selectedDay 
    ? meetings.filter((m) => isSameDay(new Date(m.date), selectedDay)).sort((a, b) => a.time.localeCompare(b.time))
    : [];

  return (
    <div className="space-y-4 sm:space-y-6 h-full flex flex-col px-2 sm:px-0">
      <motion.div 
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <h1 className="text-xl sm:text-3xl font-bold font-serif text-primary">Team Calendar</h1>
          <div className="flex items-center gap-2 bg-card border rounded-md p-1 w-fit">
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </motion.div>
            <AnimatePresence mode="wait">
              <motion.span 
                key={format(currentDate, "MMMM yyyy")}
                className="text-xs sm:text-sm font-medium min-w-[100px] sm:min-w-[120px] text-center"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {format(currentDate, "MMMM yyyy")}
              </motion.span>
            </AnimatePresence>
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </motion.div>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button className="gap-2 w-full sm:w-auto" data-testid="button-add-meeting">
                <Plus className="h-4 w-4" /> Add Meeting
              </Button>
            </motion.div>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Schedule Meeting</DialogTitle>
            </DialogHeader>
            <AddMeetingForm />
          </DialogContent>
        </Dialog>
      </motion.div>

      <motion.div 
        className="flex items-center gap-2 text-xs flex-wrap"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
      >
        <span className="text-muted-foreground">Legend:</span>
        <motion.span 
          className="px-2 py-1 rounded bg-blue-100 border border-blue-200 text-blue-800"
          whileHover={{ scale: 1.05 }}
        >
          Meeting
        </motion.span>
        <motion.span 
          className="px-2 py-1 rounded border border-green-300" 
          style={{ backgroundColor: '#E8F4EA' }}
          whileHover={{ scale: 1.05 }}
        >
          2 Meetings
        </motion.span>
        <motion.span 
          className="px-2 py-1 rounded border border-blue-300" 
          style={{ backgroundColor: '#D4E8F2' }}
          whileHover={{ scale: 1.05 }}
        >
          3+ Meetings
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
              const dayMeetings = meetings.filter((m) => isSameDay(new Date(m.date), day));
              const meetingCount = dayMeetings.length;
              const isCurrentMonth = isSameMonth(day, currentDate);
              
              return (
                <div
                  key={day.toString()}
                  onClick={() => setSelectedDay(day)}
                  style={getDayBackgroundStyle(meetingCount, isCurrentMonth)}
                  className={cn(
                    "min-h-[60px] sm:min-h-[100px] border-b border-r p-1 sm:p-2 transition-colors cursor-pointer hover:bg-accent/50",
                    getDayBackgroundColor(meetingCount, isCurrentMonth),
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
                    {meetingCount > 0 && (
                      <span className="text-[10px] sm:text-xs bg-blue-500/20 text-blue-700 px-1 rounded font-medium">
                        {meetingCount}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 space-y-0.5 hidden sm:block">
                    {dayMeetings.slice(0, 2).map((meeting) => (
                      <div
                        key={meeting.id}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200 truncate group flex items-center justify-between"
                      >
                        <span className="truncate font-medium flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {meeting.time} - {meeting.title}
                        </span>
                        <button
                          onClick={(e) => handleDelete(e, meeting.id, meeting.title)}
                          className="opacity-0 group-hover:opacity-100 hover:text-red-600 transition-opacity ml-1 flex-shrink-0"
                          data-testid={`button-delete-calendar-meeting-${meeting.id}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    {meetingCount > 2 && (
                      <div className="text-[10px] text-muted-foreground">+{meetingCount - 2} more</div>
                    )}
                  </div>
                  <div className="mt-1 sm:hidden">
                    {meetingCount > 0 && (
                      <div className="w-2 h-2 rounded-full bg-blue-500 mx-auto"></div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </motion.div>

      <Dialog open={!!selectedDay && !editingMeeting} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{selectedDay && format(selectedDay, "EEEE, MMMM d, yyyy")}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {selectedDayMeetings.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-muted-foreground mb-4">No meetings scheduled</p>
                <Button 
                  onClick={() => {
                    setSelectedDay(null);
                    setIsDialogOpen(true);
                  }}
                  variant="outline"
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" /> Schedule a Meeting
                </Button>
              </div>
            ) : (
              <>
                {selectedDayMeetings.map((meeting) => (
                  <div
                    key={meeting.id}
                    className="p-3 rounded-lg bg-blue-50 border border-blue-200 space-y-1"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-semibold text-blue-900">{meeting.title}</h4>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-blue-600 hover:text-blue-800 hover:bg-blue-100"
                          onClick={() => setEditingMeeting(meeting)}
                          data-testid={`button-edit-meeting-${meeting.id}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={(e) => handleDelete(e, meeting.id, meeting.title)}
                          data-testid={`button-delete-meeting-${meeting.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-sm text-blue-800 space-y-0.5">
                      <p className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="font-medium">{meeting.time}</span>
                      </p>
                      {meeting.attendees && (
                        <p className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5" />
                          <span>{meeting.attendees}</span>
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                <Button 
                  onClick={() => {
                    setSelectedDay(null);
                    setIsDialogOpen(true);
                  }}
                  variant="outline"
                  className="w-full gap-2 mt-2"
                >
                  <Plus className="h-4 w-4" /> Add Another Meeting
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

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

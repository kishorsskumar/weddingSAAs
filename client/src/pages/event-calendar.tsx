import { useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import type { Event } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function EventCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ['/api/events'],
    queryFn: async () => {
      const res = await fetch('/api/events');
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

  const AddEventForm = () => {
    const { register, handleSubmit } = useForm<Partial<Event>>();
    
    const onSubmit = (data: any) => {
      createMutation.mutate({
        ...data,
        title: data.customer + ' - ' + data.type,
        salesValue: '0',
        paymentReceived: '0',
        cost: '0',
      });
    };

    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="customer">Customer Name</Label>
          <Input id="customer" {...register("customer")} required placeholder="e.g. Rahul Sharma" data-testid="input-customer" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="date">Event Date</Label>
            <Input id="date" type="date" {...register("date")} required data-testid="input-date" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">Type of Event</Label>
            <Input id="type" {...register("type")} required placeholder="e.g. Wedding, Corporate" data-testid="input-type" />
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

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold font-serif text-primary">Event Calendar</h1>
          <div className="flex items-center gap-2 bg-card border rounded-md p-1">
            <Button variant="ghost" size="icon" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[120px] text-center">
              {format(currentDate, "MMMM yyyy")}
            </span>
            <Button variant="ghost" size="icon" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-add-event">
              <Plus className="h-4 w-4" /> New Event
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Event</DialogTitle>
            </DialogHeader>
            <AddEventForm />
          </DialogContent>
        </Dialog>
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col shadow-md border-border/50">
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="p-4 text-center text-sm font-medium text-muted-foreground">
              {day}
            </div>
          ))}
        </div>
        <div className="flex-1 grid grid-cols-7 grid-rows-5 lg:grid-rows-6 overflow-y-auto">
          {calendarDays.map((day) => {
            const dayEvents = events.filter((e) => isSameDay(new Date(e.date), day));
            return (
              <div
                key={day.toString()}
                className={cn(
                  "min-h-[120px] border-b border-r p-2 transition-colors hover:bg-muted/10",
                  !isSameMonth(day, currentDate) && "bg-muted/10 text-muted-foreground/50",
                  isSameDay(day, new Date()) && "bg-primary/5"
                )}
              >
                <div className="flex justify-between items-start">
                  <span
                    className={cn(
                      "text-sm font-medium h-7 w-7 flex items-center justify-center rounded-full",
                      isSameDay(day, new Date())
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                </div>
                <div className="mt-2 space-y-1">
                  {dayEvents.map((event) => (
                    <div
                      key={event.id}
                      className={cn(
                        "text-xs px-2 py-1 rounded truncate cursor-pointer border-l-2",
                        event.type === "wedding" && "bg-rose-100 text-rose-800 border-rose-500",
                        event.type === "corporate" && "bg-blue-100 text-blue-800 border-blue-500",
                        event.type === "birthday" && "bg-amber-100 text-amber-800 border-amber-500",
                        event.type === "other" && "bg-gray-100 text-gray-800 border-gray-500"
                      )}
                    >
                      {event.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

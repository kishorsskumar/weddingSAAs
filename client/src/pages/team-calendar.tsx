import { useState } from "react";
import { format, addDays, subDays, isSameDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Clock, Plus, User } from "lucide-react";
import { useForm } from "react-hook-form";

interface Meeting {
  id: string;
  title: string;
  time: string;
  attendees: string;
  date: string;
}

const MOCK_MEETINGS: Meeting[] = [
  {
    id: "m1",
    title: "Team Sync",
    time: "09:00",
    attendees: "All Staff",
    date: new Date().toISOString().split('T')[0]
  },
  {
    id: "m2",
    title: "Client Call - Sharma",
    time: "14:30",
    attendees: "Sarah, Mike",
    date: new Date().toISOString().split('T')[0]
  }
];

export default function TeamCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [meetings, setMeetings] = useState<Meeting[]>(MOCK_MEETINGS);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const nextDay = () => setCurrentDate(addDays(currentDate, 1));
  const prevDay = () => setCurrentDate(subDays(currentDate, 1));

  const AddMeetingForm = () => {
    const { register, handleSubmit } = useForm<Partial<Meeting>>();
    
    const onSubmit = (data: any) => {
      const newMeeting: Meeting = {
        id: Math.random().toString(36).substr(2, 9),
        title: data.title,
        time: data.time,
        attendees: data.attendees,
        date: format(currentDate, 'yyyy-MM-dd')
      };
      setMeetings([...meetings, newMeeting]);
      setIsDialogOpen(false);
    };

    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Meeting Title</Label>
          <Input id="title" {...register("title")} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="time">Time</Label>
            <Input id="time" type="time" {...register("time")} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="attendees">Attendees</Label>
            <Input id="attendees" {...register("attendees")} placeholder="e.g. John, Sarah" />
          </div>
        </div>
        <Button type="submit" className="w-full">Schedule Meeting</Button>
      </form>
    );
  };

  const todaysMeetings = meetings.filter(m => m.date === format(currentDate, 'yyyy-MM-dd'))
    .sort((a, b) => a.time.localeCompare(b.time));

  const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 8 AM to 8 PM

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-serif text-primary">Team Calendar</h1>
          <p className="text-muted-foreground">Manage daily schedules and meetings</p>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 bg-card border rounded-md p-1">
            <Button variant="ghost" size="icon" onClick={prevDay}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[120px] text-center">
              {format(currentDate, "EEEE, MMM d")}
            </span>
            <Button variant="ghost" size="icon" onClick={nextDay}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Add Meeting
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Schedule Meeting</DialogTitle>
              </DialogHeader>
              <AddMeetingForm />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timeline View */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-serif">Daily Timeline</CardTitle>
          </CardHeader>
          <CardContent className="relative min-h-[600px]">
             <div className="absolute left-16 top-0 bottom-0 w-px bg-border" />
             {hours.map(hour => (
               <div key={hour} className="flex items-start h-20 border-b border-dashed last:border-0">
                 <div className="w-16 text-xs text-muted-foreground text-right pr-4 pt-1">
                   {hour}:00
                 </div>
                 <div className="flex-1 relative pt-1 pl-4">
                   {/* Render meetings for this hour */}
                   {todaysMeetings.filter(m => parseInt(m.time.split(':')[0]) === hour).map(m => (
                     <div key={m.id} className="absolute left-2 right-2 bg-secondary border-l-4 border-primary p-2 rounded text-xs shadow-sm">
                        <div className="font-semibold text-primary-foreground/90">{m.title}</div>
                        <div className="flex items-center gap-2 text-muted-foreground mt-1">
                          <Clock className="h-3 w-3" /> {m.time}
                          <User className="h-3 w-3 ml-2" /> {m.attendees}
                        </div>
                     </div>
                   ))}
                 </div>
               </div>
             ))}
          </CardContent>
        </Card>

        {/* List View */}
        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Agenda</CardTitle>
          </CardHeader>
          <CardContent>
            {todaysMeetings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No meetings scheduled for today.
              </div>
            ) : (
              <div className="space-y-4">
                {todaysMeetings.map(m => (
                  <div key={m.id} className="flex gap-4 p-4 bg-muted/20 rounded-lg border">
                    <div className="flex flex-col items-center justify-center min-w-[60px] bg-card rounded border p-2">
                      <span className="text-lg font-bold text-primary">{m.time}</span>
                    </div>
                    <div>
                      <h3 className="font-medium">{m.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {m.attendees}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

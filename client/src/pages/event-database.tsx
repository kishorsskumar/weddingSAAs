import { useState } from "react";
import { MOCK_EVENTS, Event } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Filter, Download, Upload, FileSpreadsheet } from "lucide-react";
import { useForm } from "react-hook-form";
import { cn } from "@/lib/utils";

export default function EventDatabase() {
  const [events, setEvents] = useState<Event[]>(MOCK_EVENTS);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPlanner, setSelectedPlanner] = useState<string>("all");
  
  // Calculations for the selected Event
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          event.customer.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPlanner = selectedPlanner === "all" || event.planner === selectedPlanner;
    return matchesSearch && matchesPlanner;
  });

  const EditEventForm = ({ event, onClose }: { event: Event; onClose: () => void }) => {
    const { register, handleSubmit, watch } = useForm<Event>({ defaultValues: event });
    
    // Watch for live profit calculation
    const salesValue = watch("salesValue");
    const cost = watch("cost");
    const profit = (Number(salesValue) || 0) - (Number(cost) || 0);
    const profitPercent = salesValue ? ((profit / salesValue) * 100).toFixed(2) : "0";

    const onSubmit = (data: Event) => {
      const updatedEvents = events.map(e => e.id === event.id ? { ...e, ...data } : e);
      setEvents(updatedEvents);
      onClose();
    };

    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
           <div className="space-y-2">
            <Label>Sales Value (₹)</Label>
            <Input type="number" {...register("salesValue")} />
          </div>
          <div className="space-y-2">
            <Label>Cost (₹)</Label>
            <Input type="number" {...register("cost")} />
          </div>
          <div className="space-y-2">
            <Label>Payment Received (₹)</Label>
            <Input type="number" {...register("paymentReceived")} />
          </div>
          <div className="space-y-2">
            <Label>Balance (₹)</Label>
            <Input disabled value={(Number(salesValue) - Number(watch("paymentReceived"))).toString()} />
          </div>
        </div>
        
        <div className="bg-muted p-4 rounded-lg flex justify-between items-center">
            <div>
                <span className="text-sm text-muted-foreground">Estimated Profit</span>
                <div className="text-xl font-bold text-primary">₹{profit}</div>
            </div>
             <div className="text-right">
                <span className="text-sm text-muted-foreground">Margin</span>
                <div className="text-xl font-bold text-primary">{profitPercent}%</div>
            </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
            <Label>Wedding Planner</Label>
            <Input {...register("planner")} />
          </div>
           <div className="space-y-2">
            <Label>Venue</Label>
            <Input {...register("venue")} />
          </div>
        </div>

        <Button type="submit" className="w-full">Save Changes</Button>
      </form>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-serif text-primary">Event Database</h1>
          <p className="text-muted-foreground">Track financials and details for all events</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Upload className="h-4 w-4" /> Import Excel
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between">
            <CardTitle className="text-lg font-serif">All Events</CardTitle>
            <div className="flex gap-2">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search events or customers..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={selectedPlanner} onValueChange={setSelectedPlanner}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by Planner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Planners</SelectItem>
                  <SelectItem value="Sarah Jenkins">Sarah Jenkins</SelectItem>
                  <SelectItem value="Mike Ross">Mike Ross</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event Name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Planner</TableHead>
                  <TableHead className="text-right">Sales Value</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.map((event) => {
                    const profit = event.salesValue - event.cost;
                    const isProfitable = profit > 0;
                    const balance = event.salesValue - event.paymentReceived;
                    
                    return (
                    <TableRow key={event.id}>
                        <TableCell className="font-medium">
                            <div>{event.title}</div>
                            <div className="text-xs text-muted-foreground">{event.customer}</div>
                        </TableCell>
                        <TableCell>{new Date(event.date).toLocaleDateString()}</TableCell>
                        <TableCell>{event.planner}</TableCell>
                        <TableCell className="text-right">₹{event.salesValue.toLocaleString()}</TableCell>
                        <TableCell className={cn("text-right font-medium", isProfitable ? "text-green-600" : "text-red-600")}>
                            ₹{profit.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                             <span className={cn(
                                "px-2 py-1 rounded-full text-xs",
                                balance <= 0 ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                             )}>
                                {balance <= 0 ? "Paid" : "Pending"}
                             </span>
                        </TableCell>
                        <TableCell>
                            <Dialog open={editingEvent?.id === event.id} onOpenChange={(open) => !open && setEditingEvent(null)}>
                                <DialogTrigger asChild>
                                    <Button variant="ghost" size="sm" onClick={() => setEditingEvent(event)}>Edit</Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-lg">
                                    <DialogHeader>
                                        <DialogTitle>Edit Event Financials</DialogTitle>
                                    </DialogHeader>
                                    <EditEventForm event={event} onClose={() => setEditingEvent(null)} />
                                </DialogContent>
                            </Dialog>
                        </TableCell>
                    </TableRow>
                    );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

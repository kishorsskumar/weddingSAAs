import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Plus, Pencil, Trash2, Users, Check, ChevronsUpDown, Upload, Send, UserCheck, UserX, HelpCircle, UtensilsCrossed, Hotel, Car, MessageSquare, Download, Search, RefreshCw, Calendar, Phone, Mail, AlertCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { format, parseISO } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";

interface EventGuest {
  id: string;
  eventId: string;
  name: string;
  phone: string;
  email?: string;
  relationship?: string;
  guestGroup?: string;
  invitedBy?: string;
  maxAttendees: number;
  inviteSentAt?: string;
  reminderSentAt?: string;
  reminderCount: number;
  notes?: string;
  createdAt: string;
}

interface RsvpResponse {
  id: string;
  guestId: string;
  eventId: string;
  attendanceStatus: string;
  numberOfAttendees: number;
  attendeeNames?: string;
  mealPreference?: string;
  dietaryRestrictions?: string;
  needsAccommodation: boolean;
  accommodationNights?: number;
  accommodationCheckIn?: string;
  accommodationCheckOut?: string;
  needsTransportation: boolean;
  transportationDetails?: string;
  specialNotes?: string;
  responseSource: string;
  needsHumanFollowUp: boolean;
  escalationReason?: string;
  humanNotes?: string;
  respondedAt?: string;
  updatedAt: string;
  createdAt: string;
}

interface RsvpStats {
  total: number;
  confirmed: number;
  declined: number;
  maybe: number;
  pending: number;
  totalAttendees: number;
  needsAccommodation: number;
  needsTransportation: number;
  vegetarian: number;
  nonVegetarian: number;
  needsFollowUp: number;
}

interface Event {
  id: string;
  title: string;
  customer?: string;
  date: string;
  venue?: string;
  status?: string;
}

export default function OakRSVP() {
  const [mainTab, setMainTab] = useState("dashboard");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventComboOpen, setEventComboOpen] = useState(false);
  const [isGuestDialogOpen, setIsGuestDialogOpen] = useState(false);
  const [isResponseDialogOpen, setIsResponseDialogOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState<EventGuest | null>(null);
  const [editingResponse, setEditingResponse] = useState<RsvpResponse | null>(null);
  const [guestToDelete, setGuestToDelete] = useState<EventGuest | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const isSuperAdmin = user?.role === 'superadmin';

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ['/api/events'],
  });

  const selectedEvent = events.find(e => e.id === selectedEventId);

  const { data: guests = [], isLoading: guestsLoading } = useQuery<EventGuest[]>({
    queryKey: ['/api/event-guests', selectedEventId],
    queryFn: async () => {
      const url = selectedEventId 
        ? `/api/event-guests?eventId=${selectedEventId}`
        : '/api/event-guests';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch guests');
      return res.json();
    },
    enabled: true,
  });

  const { data: responses = [], isLoading: responsesLoading } = useQuery<RsvpResponse[]>({
    queryKey: ['/api/rsvp-responses', selectedEventId],
    queryFn: async () => {
      const url = selectedEventId 
        ? `/api/rsvp-responses?eventId=${selectedEventId}`
        : '/api/rsvp-responses';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch responses');
      return res.json();
    },
    enabled: true,
  });

  const { data: stats } = useQuery<RsvpStats>({
    queryKey: ['/api/rsvp-stats', selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return null;
      const res = await fetch(`/api/rsvp-stats/${selectedEventId}`);
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
    enabled: !!selectedEventId,
  });

  const createGuestMutation = useMutation({
    mutationFn: async (data: Partial<EventGuest>) => {
      const res = await fetch('/api/event-guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create guest');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/event-guests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rsvp-stats'] });
      setIsGuestDialogOpen(false);
      setEditingGuest(null);
      toast({ title: "Guest added successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateGuestMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EventGuest> }) => {
      const res = await fetch(`/api/event-guests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update guest');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/event-guests'] });
      setIsGuestDialogOpen(false);
      setEditingGuest(null);
      toast({ title: "Guest updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteGuestMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/event-guests/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete guest');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/event-guests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rsvp-stats'] });
      setGuestToDelete(null);
      toast({ title: "Guest removed" });
    },
  });

  const updateResponseMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<RsvpResponse> }) => {
      const res = await fetch(`/api/rsvp-responses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update response');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rsvp-responses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rsvp-stats'] });
      setIsResponseDialogOpen(false);
      setEditingResponse(null);
      toast({ title: "Response updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const guestsWithResponses = useMemo(() => {
    return guests.map(guest => {
      const response = responses.find(r => r.guestId === guest.id);
      return { guest, response };
    });
  }, [guests, responses]);

  const filteredGuestsWithResponses = useMemo(() => {
    return guestsWithResponses.filter(({ guest, response }) => {
      const matchesSearch = !searchTerm || 
        guest.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        guest.phone.includes(searchTerm) ||
        (guest.email && guest.email.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const status = response?.attendanceStatus || 'pending';
      const matchesStatus = statusFilter === 'all' || status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [guestsWithResponses, searchTerm, statusFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'yes':
        return <Badge className="bg-green-100 text-green-800">Confirmed</Badge>;
      case 'no':
        return <Badge className="bg-red-100 text-red-800">Declined</Badge>;
      case 'maybe':
        return <Badge className="bg-yellow-100 text-yellow-800">Maybe</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">Pending</Badge>;
    }
  };

  const getMealBadge = (preference: string | undefined) => {
    switch (preference) {
      case 'vegetarian':
        return <Badge variant="outline" className="text-green-600 border-green-600">Veg</Badge>;
      case 'non_vegetarian':
        return <Badge variant="outline" className="text-red-600 border-red-600">Non-Veg</Badge>;
      case 'both':
        return <Badge variant="outline" className="text-orange-600 border-orange-600">Both</Badge>;
      default:
        return null;
    }
  };

  const handleGuestSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      eventId: selectedEventId,
      name: formData.get('name') as string,
      phone: formData.get('phone') as string,
      email: formData.get('email') as string || undefined,
      relationship: formData.get('relationship') as string || undefined,
      guestGroup: formData.get('guestGroup') as string || undefined,
      invitedBy: formData.get('invitedBy') as string || undefined,
      maxAttendees: parseInt(formData.get('maxAttendees') as string) || 1,
      notes: formData.get('notes') as string || undefined,
    };

    if (editingGuest) {
      updateGuestMutation.mutate({ id: editingGuest.id, data });
    } else {
      createGuestMutation.mutate(data);
    }
  };

  const handleResponseSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingResponse) return;
    
    const formData = new FormData(e.currentTarget);
    const data = {
      attendanceStatus: formData.get('attendanceStatus') as string,
      numberOfAttendees: parseInt(formData.get('numberOfAttendees') as string) || 1,
      attendeeNames: formData.get('attendeeNames') as string || undefined,
      mealPreference: formData.get('mealPreference') as string || undefined,
      dietaryRestrictions: formData.get('dietaryRestrictions') as string || undefined,
      needsAccommodation: formData.get('needsAccommodation') === 'on',
      accommodationNights: parseInt(formData.get('accommodationNights') as string) || undefined,
      needsTransportation: formData.get('needsTransportation') === 'on',
      transportationDetails: formData.get('transportationDetails') as string || undefined,
      specialNotes: formData.get('specialNotes') as string || undefined,
      humanNotes: formData.get('humanNotes') as string || undefined,
      needsHumanFollowUp: false,
    };

    updateResponseMutation.mutate({ id: editingResponse.id, data });
  };

  return (
    <div className="min-h-screen bg-[#faf8f5]">
      <div className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-[#3d3024]">Oak RSVP</h1>
            <p className="text-[#8b7355] mt-1">Manage event guest lists and track RSVP responses</p>
          </div>
          <div className="flex items-center gap-3">
            <Popover open={eventComboOpen} onOpenChange={setEventComboOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={eventComboOpen}
                  className="w-[280px] justify-between"
                  data-testid="event-selector"
                >
                  {selectedEvent ? (selectedEvent.customer || selectedEvent.title) : "Select an event..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0">
                <Command>
                  <CommandInput placeholder="Search events..." />
                  <CommandList>
                    <CommandEmpty>No events found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="all"
                        onSelect={() => {
                          setSelectedEventId(null);
                          setEventComboOpen(false);
                        }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", !selectedEventId ? "opacity-100" : "opacity-0")} />
                        All Events
                      </CommandItem>
                      {events.map((event) => (
                        <CommandItem
                          key={event.id}
                          value={event.customer || event.title}
                          onSelect={() => {
                            setSelectedEventId(event.id);
                            setEventComboOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", selectedEventId === event.id ? "opacity-100" : "opacity-0")} />
                          {event.customer || event.title}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <Tabs value={mainTab} onValueChange={setMainTab} className="space-y-4">
          <TabsList className="bg-white border">
            <TabsTrigger value="dashboard" data-testid="tab-dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="guests" data-testid="tab-guests">Guest List</TabsTrigger>
            <TabsTrigger value="responses" data-testid="tab-responses">Responses</TabsTrigger>
            <TabsTrigger value="follow-ups" data-testid="tab-followups">Follow-ups</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4">
            {selectedEventId && stats ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <Card className="bg-white">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-[#8b7355]">Total Invited</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-[#6b8e6b]" />
                        <span className="text-2xl font-bold text-[#3d3024]">{stats.total}</span>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-white">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-[#8b7355]">Confirmed</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-5 w-5 text-green-600" />
                        <span className="text-2xl font-bold text-green-600">{stats.confirmed}</span>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-white">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-[#8b7355]">Declined</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <UserX className="h-5 w-5 text-red-600" />
                        <span className="text-2xl font-bold text-red-600">{stats.declined}</span>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-white">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-[#8b7355]">Maybe</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <HelpCircle className="h-5 w-5 text-yellow-600" />
                        <span className="text-2xl font-bold text-yellow-600">{stats.maybe}</span>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-white">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-[#8b7355]">Pending</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <HelpCircle className="h-5 w-5 text-gray-400" />
                        <span className="text-2xl font-bold text-gray-600">{stats.pending}</span>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-white">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-[#8b7355]">Total Attendees</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-[#6b8e6b]" />
                        <span className="text-2xl font-bold text-[#3d3024]">{stats.totalAttendees}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <Card className="bg-white">
                    <CardHeader>
                      <CardTitle className="text-lg text-[#3d3024]">Response Progress</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm text-[#8b7355]">Response Rate</span>
                          <span className="text-sm font-medium text-[#3d3024]">
                            {stats.total > 0 ? Math.round(((stats.confirmed + stats.declined + stats.maybe) / stats.total) * 100) : 0}%
                          </span>
                        </div>
                        <Progress 
                          value={stats.total > 0 ? ((stats.confirmed + stats.declined + stats.maybe) / stats.total) * 100 : 0} 
                          className="h-3"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-4 pt-2">
                        <div className="text-center p-3 bg-green-50 rounded-lg">
                          <div className="text-lg font-bold text-green-600">{stats.confirmed}</div>
                          <div className="text-xs text-green-700">Confirmed</div>
                        </div>
                        <div className="text-center p-3 bg-red-50 rounded-lg">
                          <div className="text-lg font-bold text-red-600">{stats.declined}</div>
                          <div className="text-xs text-red-700">Declined</div>
                        </div>
                        <div className="text-center p-3 bg-yellow-50 rounded-lg">
                          <div className="text-lg font-bold text-yellow-600">{stats.maybe}</div>
                          <div className="text-xs text-yellow-700">Maybe</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white">
                    <CardHeader>
                      <CardTitle className="text-lg text-[#3d3024]">Logistics Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-[#faf8f5] rounded-lg">
                          <div className="flex items-center gap-2">
                            <Hotel className="h-4 w-4 text-[#8b7355]" />
                            <span className="text-sm text-[#3d3024]">Need Accommodation</span>
                          </div>
                          <Badge variant="secondary">{stats.needsAccommodation}</Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-[#faf8f5] rounded-lg">
                          <div className="flex items-center gap-2">
                            <Car className="h-4 w-4 text-[#8b7355]" />
                            <span className="text-sm text-[#3d3024]">Need Transportation</span>
                          </div>
                          <Badge variant="secondary">{stats.needsTransportation}</Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-[#faf8f5] rounded-lg">
                          <div className="flex items-center gap-2">
                            <UtensilsCrossed className="h-4 w-4 text-green-600" />
                            <span className="text-sm text-[#3d3024]">Vegetarian</span>
                          </div>
                          <Badge variant="secondary">{stats.vegetarian}</Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-[#faf8f5] rounded-lg">
                          <div className="flex items-center gap-2">
                            <UtensilsCrossed className="h-4 w-4 text-red-600" />
                            <span className="text-sm text-[#3d3024]">Non-Vegetarian</span>
                          </div>
                          <Badge variant="secondary">{stats.nonVegetarian}</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {stats.needsFollowUp > 0 && (
                  <Card className="bg-amber-50 border-amber-200">
                    <CardContent className="py-4">
                      <div className="flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 text-amber-600" />
                        <span className="text-amber-800">
                          <strong>{stats.needsFollowUp}</strong> guest(s) need human follow-up. Check the Follow-ups tab.
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card className="bg-white">
                <CardContent className="py-12 text-center">
                  <Calendar className="h-12 w-12 mx-auto text-[#8b7355] mb-4" />
                  <p className="text-lg text-[#3d3024] mb-2">Select an event to view RSVP dashboard</p>
                  <p className="text-sm text-[#8b7355]">Use the dropdown above to choose an event</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="guests" className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4 justify-between">
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8b7355]" />
                  <Input
                    placeholder="Search guests..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-[250px]"
                    data-testid="search-guests"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]" data-testid="status-filter">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="yes">Confirmed</SelectItem>
                    <SelectItem value="no">Declined</SelectItem>
                    <SelectItem value="maybe">Maybe</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={() => {
                    if (!selectedEventId) {
                      toast({ title: "Please select an event first", variant: "destructive" });
                      return;
                    }
                    setEditingGuest(null);
                    setIsGuestDialogOpen(true);
                  }}
                  className="bg-[#6b8e6b] hover:bg-[#5a7a5a]"
                  data-testid="add-guest-btn"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Guest
                </Button>
              </div>
            </div>

            <Card className="bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Relationship</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead>Max Guests</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Attendees</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {guestsLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto text-[#8b7355]" />
                      </TableCell>
                    </TableRow>
                  ) : filteredGuestsWithResponses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-[#8b7355]">
                        {selectedEventId ? "No guests found" : "Select an event to view guests"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredGuestsWithResponses.map(({ guest, response }) => (
                      <TableRow key={guest.id} data-testid={`guest-row-${guest.id}`}>
                        <TableCell className="font-medium">{guest.name}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-sm">
                              <Phone className="h-3 w-3" />
                              {guest.phone}
                            </div>
                            {guest.email && (
                              <div className="flex items-center gap-1 text-xs text-[#8b7355]">
                                <Mail className="h-3 w-3" />
                                {guest.email}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{guest.relationship || '-'}</TableCell>
                        <TableCell>{guest.guestGroup || '-'}</TableCell>
                        <TableCell>{guest.maxAttendees}</TableCell>
                        <TableCell>
                          {getStatusBadge(response?.attendanceStatus || 'pending')}
                        </TableCell>
                        <TableCell>
                          {response?.attendanceStatus === 'yes' ? response.numberOfAttendees : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingGuest(guest);
                                setIsGuestDialogOpen(true);
                              }}
                              data-testid={`edit-guest-${guest.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setGuestToDelete(guest)}
                              data-testid={`delete-guest-${guest.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="responses" className="space-y-4">
            <Card className="bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Guest</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Attendees</TableHead>
                    <TableHead>Meal</TableHead>
                    <TableHead>Accommodation</TableHead>
                    <TableHead>Transport</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Responded</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {responsesLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto text-[#8b7355]" />
                      </TableCell>
                    </TableRow>
                  ) : responses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-[#8b7355]">
                        No responses yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    responses.map((response) => {
                      const guest = guests.find(g => g.id === response.guestId);
                      return (
                        <TableRow key={response.id} data-testid={`response-row-${response.id}`}>
                          <TableCell className="font-medium">{guest?.name || 'Unknown'}</TableCell>
                          <TableCell>{getStatusBadge(response.attendanceStatus)}</TableCell>
                          <TableCell>
                            {response.attendanceStatus === 'yes' ? (
                              <div>
                                <div>{response.numberOfAttendees}</div>
                                {response.attendeeNames && (
                                  <div className="text-xs text-[#8b7355]">{response.attendeeNames}</div>
                                )}
                              </div>
                            ) : '-'}
                          </TableCell>
                          <TableCell>{getMealBadge(response.mealPreference)}</TableCell>
                          <TableCell>
                            {response.needsAccommodation ? (
                              <Badge variant="outline">
                                <Hotel className="h-3 w-3 mr-1" />
                                {response.accommodationNights || '?'} nights
                              </Badge>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            {response.needsTransportation ? (
                              <Badge variant="outline">
                                <Car className="h-3 w-3 mr-1" />
                                Yes
                              </Badge>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {response.responseSource}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-[#8b7355]">
                            {response.respondedAt ? format(parseISO(response.respondedAt), 'MMM d, yyyy') : '-'}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingResponse(response);
                                setIsResponseDialogOpen(true);
                              }}
                              data-testid={`edit-response-${response.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="follow-ups" className="space-y-4">
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="text-lg text-[#3d3024]">Guests Needing Follow-up</CardTitle>
              </CardHeader>
              <CardContent>
                {responses.filter(r => r.needsHumanFollowUp).length === 0 ? (
                  <div className="text-center py-8 text-[#8b7355]">
                    <Check className="h-12 w-12 mx-auto text-green-500 mb-2" />
                    <p>No follow-ups needed!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {responses.filter(r => r.needsHumanFollowUp).map(response => {
                      const guest = guests.find(g => g.id === response.guestId);
                      return (
                        <div key={response.id} className="p-4 border rounded-lg bg-amber-50">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium">{guest?.name || 'Unknown'}</div>
                              <div className="text-sm text-[#8b7355]">{guest?.phone}</div>
                              {response.escalationReason && (
                                <div className="mt-2 text-sm text-amber-800">
                                  <strong>Reason:</strong> {response.escalationReason}
                                </div>
                              )}
                            </div>
                            <Button
                              size="sm"
                              onClick={() => {
                                setEditingResponse(response);
                                setIsResponseDialogOpen(true);
                              }}
                            >
                              <MessageSquare className="h-4 w-4 mr-2" />
                              Handle
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isGuestDialogOpen} onOpenChange={setIsGuestDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingGuest ? 'Edit Guest' : 'Add Guest'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleGuestSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                name="name"
                defaultValue={editingGuest?.name || ''}
                required
                data-testid="input-guest-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                name="phone"
                defaultValue={editingGuest?.phone || ''}
                required
                placeholder="+91 9876543210"
                data-testid="input-guest-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={editingGuest?.email || ''}
                data-testid="input-guest-email"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="relationship">Relationship</Label>
                <Select name="relationship" defaultValue={editingGuest?.relationship || ''}>
                  <SelectTrigger data-testid="select-relationship">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bride_family">Bride's Family</SelectItem>
                    <SelectItem value="groom_family">Groom's Family</SelectItem>
                    <SelectItem value="friends">Friends</SelectItem>
                    <SelectItem value="colleagues">Colleagues</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="guestGroup">Group</Label>
                <Input
                  id="guestGroup"
                  name="guestGroup"
                  defaultValue={editingGuest?.guestGroup || ''}
                  placeholder="e.g., VIP"
                  data-testid="input-guest-group"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invitedBy">Invited By</Label>
                <Input
                  id="invitedBy"
                  name="invitedBy"
                  defaultValue={editingGuest?.invitedBy || ''}
                  placeholder="Bride, Groom, etc."
                  data-testid="input-invited-by"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxAttendees">Max Attendees</Label>
                <Input
                  id="maxAttendees"
                  name="maxAttendees"
                  type="number"
                  min="1"
                  defaultValue={editingGuest?.maxAttendees || 1}
                  data-testid="input-max-attendees"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                defaultValue={editingGuest?.notes || ''}
                placeholder="Internal notes about the guest..."
                data-testid="input-guest-notes"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsGuestDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-[#6b8e6b] hover:bg-[#5a7a5a]" data-testid="save-guest-btn">
                {editingGuest ? 'Update' : 'Add Guest'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isResponseDialogOpen} onOpenChange={setIsResponseDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit RSVP Response</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleResponseSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="attendanceStatus">Attendance</Label>
                <Select name="attendanceStatus" defaultValue={editingResponse?.attendanceStatus || 'pending'}>
                  <SelectTrigger data-testid="select-attendance">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Confirmed</SelectItem>
                    <SelectItem value="no">Declined</SelectItem>
                    <SelectItem value="maybe">Maybe</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="numberOfAttendees">Number of Attendees</Label>
                <Input
                  id="numberOfAttendees"
                  name="numberOfAttendees"
                  type="number"
                  min="1"
                  defaultValue={editingResponse?.numberOfAttendees || 1}
                  data-testid="input-num-attendees"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="attendeeNames">Attendee Names</Label>
              <Input
                id="attendeeNames"
                name="attendeeNames"
                defaultValue={editingResponse?.attendeeNames || ''}
                placeholder="Comma-separated names"
                data-testid="input-attendee-names"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mealPreference">Meal Preference</Label>
                <Select name="mealPreference" defaultValue={editingResponse?.mealPreference || ''}>
                  <SelectTrigger data-testid="select-meal">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vegetarian">Vegetarian</SelectItem>
                    <SelectItem value="non_vegetarian">Non-Vegetarian</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                    <SelectItem value="no_preference">No Preference</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dietaryRestrictions">Dietary Restrictions</Label>
                <Input
                  id="dietaryRestrictions"
                  name="dietaryRestrictions"
                  defaultValue={editingResponse?.dietaryRestrictions || ''}
                  placeholder="Allergies, etc."
                  data-testid="input-dietary"
                />
              </div>
            </div>
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="needsAccommodation"
                  name="needsAccommodation"
                  defaultChecked={editingResponse?.needsAccommodation}
                  data-testid="check-accommodation"
                />
                <Label htmlFor="needsAccommodation">Needs Accommodation</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="needsTransportation"
                  name="needsTransportation"
                  defaultChecked={editingResponse?.needsTransportation}
                  data-testid="check-transportation"
                />
                <Label htmlFor="needsTransportation">Needs Transportation</Label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="accommodationNights">Nights Needed</Label>
                <Input
                  id="accommodationNights"
                  name="accommodationNights"
                  type="number"
                  min="1"
                  defaultValue={editingResponse?.accommodationNights || ''}
                  data-testid="input-accommodation-nights"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="transportationDetails">Transport Details</Label>
                <Input
                  id="transportationDetails"
                  name="transportationDetails"
                  defaultValue={editingResponse?.transportationDetails || ''}
                  placeholder="Pickup location, etc."
                  data-testid="input-transport-details"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="specialNotes">Guest Notes</Label>
              <Textarea
                id="specialNotes"
                name="specialNotes"
                defaultValue={editingResponse?.specialNotes || ''}
                placeholder="Special requests from the guest..."
                data-testid="input-special-notes"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="humanNotes">Coordinator Notes</Label>
              <Textarea
                id="humanNotes"
                name="humanNotes"
                defaultValue={editingResponse?.humanNotes || ''}
                placeholder="Notes from human follow-up..."
                data-testid="input-human-notes"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsResponseDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-[#6b8e6b] hover:bg-[#5a7a5a]" data-testid="save-response-btn">
                Update Response
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!guestToDelete} onOpenChange={() => setGuestToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Guest</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {guestToDelete?.name} from the guest list? This will also delete their RSVP response.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => guestToDelete && deleteGuestMutation.mutate(guestToDelete.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

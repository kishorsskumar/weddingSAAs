import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Download, Users, CheckCircle2, XCircle, HelpCircle, Trash2, Filter, ArrowUpDown } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface RsvpSubmission {
  id: string;
  eventId: string;
  templateId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  attending: string;
  guestCount: number;
  dietaryPreferences?: string | null;
  message?: string | null;
  responses?: Record<string, unknown> | null;
  submittedAt: string;
}

interface Event {
  id: string;
  name: string;
  date: string;
}

interface RsvpStats {
  total: number;
  attending: number;
  notAttending: number;
  maybe: number;
  pending: number;
}

export default function KnotViteSubmissions() {
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [attendingFilter, setAttendingFilter] = useState<string>("all");
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ['/api/events'],
    queryFn: async () => {
      const res = await fetch('/api/events');
      if (!res.ok) throw new Error('Failed to fetch events');
      return res.json();
    },
  });

  const { data: submissions = [] } = useQuery<RsvpSubmission[]>({
    queryKey: ['/api/rsvp/events', selectedEventId, 'submissions'],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const res = await fetch(`/api/rsvp/events/${selectedEventId}/submissions`);
      if (!res.ok) throw new Error('Failed to fetch submissions');
      return res.json();
    },
    enabled: !!selectedEventId,
  });

  const { data: stats } = useQuery<RsvpStats>({
    queryKey: ['/api/rsvp/events', selectedEventId, 'stats'],
    queryFn: async () => {
      if (!selectedEventId) return { total: 0, attending: 0, notAttending: 0, maybe: 0, pending: 0 };
      const res = await fetch(`/api/rsvp/events/${selectedEventId}/stats`);
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
    enabled: !!selectedEventId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/rsvp/submissions/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rsvp/events', selectedEventId, 'submissions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rsvp/events', selectedEventId, 'stats'] });
      toast({ title: "Deleted", description: "Submission removed" });
    },
  });

  const filteredSubmissions = useMemo(() => {
    return submissions.filter(s => {
      const matchesSearch = !searchTerm || 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.phone?.includes(searchTerm);
      const matchesFilter = attendingFilter === 'all' || s.attending === attendingFilter;
      return matchesSearch && matchesFilter;
    });
  }, [submissions, searchTerm, attendingFilter]);

  const totalGuests = useMemo(() => {
    return submissions
      .filter(s => s.attending === 'yes')
      .reduce((sum, s) => sum + (s.guestCount || 1), 0);
  }, [submissions]);

  const exportToCsv = () => {
    if (!filteredSubmissions.length) return;
    
    const headers = ['Name', 'Email', 'Phone', 'Attending', 'Guests', 'Dietary', 'Message', 'Submitted'];
    const rows = filteredSubmissions.map(s => [
      s.name,
      s.email || '',
      s.phone || '',
      s.attending,
      String(s.guestCount || 1),
      s.dietaryPreferences || '',
      s.message || '',
      format(new Date(s.submittedAt), 'yyyy-MM-dd HH:mm'),
    ]);
    
    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rsvp-submissions-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: "CSV downloaded successfully" });
  };

  const getAttendingBadge = (attending: string) => {
    switch (attending) {
      case 'yes':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100"><CheckCircle2 className="h-3 w-3 mr-1" />Yes</Badge>;
      case 'no':
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100"><XCircle className="h-3 w-3 mr-1" />No</Badge>;
      case 'maybe':
        return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100"><HelpCircle className="h-3 w-3 mr-1" />Maybe</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="submissions-title">RSVP Submissions</h1>
          <p className="text-muted-foreground text-sm">View and manage guest responses</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedEventId} onValueChange={setSelectedEventId}>
            <SelectTrigger className="w-[250px]" data-testid="event-filter-select">
              <SelectValue placeholder="Select an event" />
            </SelectTrigger>
            <SelectContent>
              {events.map(event => (
                <SelectItem key={event.id} value={event.id}>
                  {event.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!selectedEventId ? (
        <Card className="flex-1">
          <CardContent className="flex flex-col items-center justify-center h-64 text-center">
            <Users className="h-16 w-16 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-medium mb-2" data-testid="no-event-selected">Select an Event</h3>
            <p className="text-muted-foreground text-sm">Choose an event to view its RSVP submissions</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <Card data-testid="stat-total">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{stats?.total || 0}</div>
                <p className="text-xs text-muted-foreground">Total Responses</p>
              </CardContent>
            </Card>
            <Card data-testid="stat-attending">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-green-600">{stats?.attending || 0}</div>
                <p className="text-xs text-muted-foreground">Attending ({totalGuests} guests)</p>
              </CardContent>
            </Card>
            <Card data-testid="stat-not-attending">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-red-600">{stats?.notAttending || 0}</div>
                <p className="text-xs text-muted-foreground">Not Attending</p>
              </CardContent>
            </Card>
            <Card data-testid="stat-maybe">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-yellow-600">{stats?.maybe || 0}</div>
                <p className="text-xs text-muted-foreground">Maybe</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="search-submissions-input"
              />
            </div>
            <Select value={attendingFilter} onValueChange={setAttendingFilter}>
              <SelectTrigger className="w-[150px]" data-testid="attending-filter-select">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Responses</SelectItem>
                <SelectItem value="yes">Attending</SelectItem>
                <SelectItem value="no">Not Attending</SelectItem>
                <SelectItem value="maybe">Maybe</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportToCsv} disabled={!filteredSubmissions.length} data-testid="export-csv-btn">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

          {filteredSubmissions.length === 0 ? (
            <Card className="flex-1">
              <CardContent className="flex flex-col items-center justify-center h-48 text-center">
                <Users className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <p className="text-muted-foreground" data-testid="no-submissions">
                  {submissions.length === 0 ? "No responses yet" : "No matching submissions"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table data-testid="submissions-table">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="hidden sm:table-cell">Contact</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden md:table-cell">Guests</TableHead>
                        <TableHead className="hidden lg:table-cell">Message</TableHead>
                        <TableHead className="hidden md:table-cell">Submitted</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSubmissions.map((sub, index) => (
                        <TableRow key={sub.id} data-testid={`submission-row-${index}`}>
                          <TableCell>
                            <div className="font-medium">{sub.name}</div>
                            {sub.dietaryPreferences && (
                              <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                                🍽 {sub.dietaryPreferences}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <div className="text-sm">{sub.email || '-'}</div>
                            <div className="text-xs text-muted-foreground">{sub.phone || ''}</div>
                          </TableCell>
                          <TableCell>{getAttendingBadge(sub.attending)}</TableCell>
                          <TableCell className="hidden md:table-cell">{sub.guestCount || 1}</TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <span className="truncate max-w-[200px] block text-sm text-muted-foreground">
                              {sub.message || '-'}
                            </span>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                            {format(new Date(sub.submittedAt), 'MMM d, h:mm a')}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm('Delete this submission?')) {
                                  deleteMutation.mutate(sub.id);
                                }
                              }}
                              data-testid={`delete-submission-${index}`}
                            >
                              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

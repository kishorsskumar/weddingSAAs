import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { 
  Users, 
  Search, 
  Filter, 
  Calendar, 
  Phone, 
  Mail, 
  MapPin, 
  Eye,
  ExternalLink,
  RefreshCw,
  ChevronRight,
  Clock
} from "lucide-react";
import { format } from "date-fns";
import type { PortalLead } from "@shared/schema";

const PHASES = [
  { value: "submitted", label: "Submitted", color: "bg-blue-100 text-blue-800" },
  { value: "contacted", label: "Contacted", color: "bg-yellow-100 text-yellow-800" },
  { value: "meeting_scheduled", label: "Meeting Scheduled", color: "bg-green-100 text-green-800" },
  { value: "proposal_sent", label: "Proposal Sent", color: "bg-indigo-100 text-indigo-800" },
  { value: "negotiation", label: "Negotiation", color: "bg-orange-100 text-orange-800" },
  { value: "converted", label: "Converted", color: "bg-green-100 text-green-800" },
  { value: "lost", label: "Lost", color: "bg-red-100 text-red-800" },
];

export default function PortalAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [phaseFilter, setPhaseFilter] = useState<string>("all");
  const [selectedLead, setSelectedLead] = useState<PortalLead | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { data: leads = [], isLoading, refetch } = useQuery<PortalLead[]>({
    queryKey: ['/api/portal-leads'],
    queryFn: async () => {
      const res = await fetch('/api/portal-leads');
      if (!res.ok) throw new Error('Failed to fetch portal leads');
      return res.json();
    },
  });

  const updatePhaseMutation = useMutation({
    mutationFn: async ({ id, phase }: { id: string; phase: string }) => {
      const res = await fetch(`/api/portal-leads/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase }),
      });
      if (!res.ok) throw new Error('Failed to update phase');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portal-leads'] });
      toast({ title: "Phase updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update phase", variant: "destructive" });
    },
  });

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = 
      lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPhase = phaseFilter === "all" || lead.phase === phaseFilter;
    return matchesSearch && matchesPhase;
  });

  const getPhaseInfo = (phase: string) => {
    return PHASES.find(p => p.value === phase) || PHASES[0];
  };

  const handleViewDetails = (lead: PortalLead) => {
    setSelectedLead(lead);
    setDetailsOpen(true);
  };

  const generatePortalLink = (lead: PortalLead) => {
    if (lead.portalToken) {
      return `${window.location.origin}/my-portal/${lead.portalToken}`;
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Client Portal Dashboard</h1>
            <p className="text-gray-600 mt-1">Manage leads from the client enquiry portal</p>
          </div>
          <Button onClick={() => refetch()} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {PHASES.slice(0, 4).map(phase => {
            const count = leads.filter(l => l.phase === phase.value).length;
            return (
              <Card key={phase.value} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setPhaseFilter(phase.value)}>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-sm text-gray-600">{phase.label}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name, email, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={phaseFilter} onValueChange={setPhaseFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by phase" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Phases</SelectItem>
                  {PHASES.map(phase => (
                    <SelectItem key={phase.value} value={phase.value}>{phase.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="text-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
            <p className="mt-2 text-gray-600">Loading leads...</p>
          </div>
        ) : filteredLeads.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No leads found</h3>
              <p className="text-gray-600 mt-1">
                {searchTerm || phaseFilter !== "all" 
                  ? "Try adjusting your search or filters" 
                  : "Leads from the client portal will appear here"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredLeads.map(lead => {
              const phaseInfo = getPhaseInfo(lead.phase);
              return (
                <Card key={lead.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg">{lead.name}</h3>
                          <Badge className={phaseInfo.color}>{phaseInfo.label}</Badge>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Mail className="h-4 w-4" />
                            {lead.email}
                          </div>
                          <div className="flex items-center gap-1">
                            <Phone className="h-4 w-4" />
                            {lead.phone}
                          </div>
                          {lead.eventDate && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {format(new Date(lead.eventDate), "dd MMM yyyy")}
                            </div>
                          )}
                        </div>
                        {lead.venue && (
                          <div className="flex items-center gap-1 mt-2 text-sm text-gray-600">
                            <MapPin className="h-4 w-4" />
                            {lead.venue}{lead.venueCity ? `, ${lead.venueCity}` : ''}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Select 
                          value={lead.phase} 
                          onValueChange={(value) => updatePhaseMutation.mutate({ id: lead.id, phase: value })}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PHASES.map(phase => (
                              <SelectItem key={phase.value} value={phase.value}>{phase.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="outline" size="sm" onClick={() => handleViewDetails(lead)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lead Details</DialogTitle>
            <DialogDescription>Full information about this portal lead</DialogDescription>
          </DialogHeader>
          {selectedLead && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-gray-500">Name</Label>
                  <p className="font-medium">{selectedLead.name}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Email</Label>
                  <p className="font-medium">{selectedLead.email}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Phone</Label>
                  <p className="font-medium">{selectedLead.phone}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">WhatsApp</Label>
                  <p className="font-medium">{selectedLead.whatsappNumber}</p>
                </div>
              </div>

              {selectedLead.eventDate && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-gray-500">Event Date</Label>
                    <p className="font-medium">{format(new Date(selectedLead.eventDate), "dd MMMM yyyy")}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Event Type</Label>
                    <p className="font-medium">{selectedLead.eventType || "-"}</p>
                  </div>
                </div>
              )}

              {selectedLead.venue && (
                <div>
                  <Label className="text-xs text-gray-500">Venue</Label>
                  <p className="font-medium">{selectedLead.venue}{selectedLead.venueCity ? `, ${selectedLead.venueCity}` : ''}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-gray-500">Guest Count</Label>
                  <p className="font-medium">{selectedLead.guestCount || "-"}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Budget Range</Label>
                  <p className="font-medium">{selectedLead.budgetRange || "-"}</p>
                </div>
              </div>

              {selectedLead.servicesRequired && Array.isArray(selectedLead.servicesRequired) && selectedLead.servicesRequired.length > 0 && (
                <div>
                  <Label className="text-xs text-gray-500">Services Required</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {selectedLead.servicesRequired.map((service: string, idx: number) => (
                      <Badge key={idx} variant="secondary">{service}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedLead.additionalNotes && (
                <div>
                  <Label className="text-xs text-gray-500">Additional Notes</Label>
                  <p className="text-sm mt-1">{selectedLead.additionalNotes}</p>
                </div>
              )}

              {selectedLead.portalToken && (
                <div className="pt-4 border-t">
                  <Label className="text-xs text-gray-500">Client Portal Link</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input value={generatePortalLink(selectedLead) || ""} readOnly className="text-sm" />
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        const link = generatePortalLink(selectedLead);
                        if (link) {
                          navigator.clipboard.writeText(link);
                          toast({ title: "Link copied to clipboard" });
                        }
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Submitted: {selectedLead.createdAt ? format(new Date(selectedLead.createdAt), "dd MMM yyyy, hh:mm a") : "-"}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

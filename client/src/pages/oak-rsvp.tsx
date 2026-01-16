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

interface RsvpMessageTemplate {
  id: string;
  eventId: string;
  templateType: string;
  templateName: string;
  messageContent: string;
  isActive: boolean;
  createdAt: string;
}

interface RsvpMessageLog {
  id: string;
  eventId: string;
  guestId: string;
  messageType: string;
  messageContent: string;
  recipientPhone: string;
  deliveryStatus: string;
  sentAt?: string;
  createdAt: string;
}

interface OutreachStats {
  totalSent: number;
  delivered: number;
  read: number;
  failed: number;
  pending: number;
  greetingsSent: number;
  remindersSent: number;
}

function OutreachTab({ eventId, guests, responses }: { 
  eventId: string | null; 
  guests: EventGuest[];
  responses: RsvpResponse[];
}) {
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<RsvpMessageTemplate | null>(null);
  const [selectedGuestIds, setSelectedGuestIds] = useState<string[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [isSending, setIsSending] = useState(false);
  const [outreachSubTab, setOutreachSubTab] = useState<"send" | "templates" | "history">("send");
  const [guestStatusFilter, setGuestStatusFilter] = useState<"all" | "pending" | "yes" | "no" | "maybe">("pending");
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const canSendMessages = user?.role === 'superadmin' || user?.role === 'wedding_planner';

  const { data: templates = [] } = useQuery<RsvpMessageTemplate[]>({
    queryKey: ['/api/rsvp-message-templates', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const res = await fetch(`/api/rsvp-message-templates?eventId=${eventId}`);
      if (!res.ok) throw new Error('Failed to fetch templates');
      return res.json();
    },
    enabled: !!eventId,
  });

  const { data: messageLogs = [] } = useQuery<RsvpMessageLog[]>({
    queryKey: ['/api/rsvp-message-logs', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const res = await fetch(`/api/rsvp-message-logs?eventId=${eventId}`);
      if (!res.ok) throw new Error('Failed to fetch message logs');
      return res.json();
    },
    enabled: !!eventId,
  });

  const { data: outreachStats } = useQuery<OutreachStats>({
    queryKey: ['/api/rsvp-outreach-stats', eventId],
    queryFn: async () => {
      if (!eventId) return null;
      const res = await fetch(`/api/rsvp-outreach-stats/${eventId}`);
      if (!res.ok) throw new Error('Failed to fetch outreach stats');
      return res.json();
    },
    enabled: !!eventId,
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: Partial<RsvpMessageTemplate>) => {
      const res = await fetch('/api/rsvp-message-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create template');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rsvp-message-templates'] });
      setIsTemplateDialogOpen(false);
      setEditingTemplate(null);
      toast({ title: "Template created successfully" });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<RsvpMessageTemplate> }) => {
      const res = await fetch(`/api/rsvp-message-templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update template');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rsvp-message-templates'] });
      setIsTemplateDialogOpen(false);
      setEditingTemplate(null);
      toast({ title: "Template updated successfully" });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/rsvp-message-templates/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete template');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rsvp-message-templates'] });
      toast({ title: "Template deleted" });
    },
  });

  const handleSendMessages = async () => {
    if (!eventId || !selectedTemplateId || selectedGuestIds.length === 0) {
      toast({ title: "Please select a template and at least one guest", variant: "destructive" });
      return;
    }

    setIsSending(true);
    try {
      const res = await fetch('/api/rsvp-send-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          templateId: selectedTemplateId,
          guestIds: selectedGuestIds,
          messageType: templates.find(t => t.id === selectedTemplateId)?.templateType || 'greeting',
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to send messages');

      toast({ 
        title: "Messages sent", 
        description: `Sent: ${result.sent}, Failed: ${result.failed}` 
      });
      setSelectedGuestIds([]);
      queryClient.invalidateQueries({ queryKey: ['/api/rsvp-message-logs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rsvp-outreach-stats'] });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const handleTemplateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      eventId: eventId!,
      templateType: formData.get('templateType') as string,
      templateName: formData.get('templateName') as string,
      messageContent: formData.get('messageContent') as string,
      isActive: true,
    };

    if (editingTemplate) {
      updateTemplateMutation.mutate({ id: editingTemplate.id, data });
    } else {
      createTemplateMutation.mutate(data);
    }
  };

  const getGuestStatus = (guestId: string) => {
    const response = responses.find(r => r.guestId === guestId);
    return response?.attendanceStatus || 'pending';
  };

  const filteredGuests = guests.filter(g => {
    if (guestStatusFilter === "all") return true;
    return getGuestStatus(g.id) === guestStatusFilter;
  });

  const toggleGuestSelection = (guestId: string) => {
    setSelectedGuestIds(prev => 
      prev.includes(guestId) 
        ? prev.filter(id => id !== guestId)
        : [...prev, guestId]
    );
  };

  const selectAllFiltered = () => {
    setSelectedGuestIds(filteredGuests.map(g => g.id));
  };

  const clearSelection = () => {
    setSelectedGuestIds([]);
  };

  const statusCounts = {
    all: guests.length,
    pending: guests.filter(g => getGuestStatus(g.id) === 'pending').length,
    yes: guests.filter(g => getGuestStatus(g.id) === 'yes').length,
    no: guests.filter(g => getGuestStatus(g.id) === 'no').length,
    maybe: guests.filter(g => getGuestStatus(g.id) === 'maybe').length,
  };

  if (!eventId) {
    return (
      <Card className="bg-white">
        <CardContent className="py-12 text-center text-[#8b7355]">
          <Send className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Select an event to manage outreach messages</p>
        </CardContent>
      </Card>
    );
  }

  if (!canSendMessages) {
    return (
      <Card className="bg-white">
        <CardContent className="py-12 text-center text-[#8b7355]">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-amber-500" />
          <p>Only Superadmin and Wedding Planners can send RSVP messages</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {outreachStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <Card className="bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[#8b7355]">Total Sent</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-[#3d3024]">{outreachStats.totalSent}</span>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[#8b7355]">Delivered</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-green-600">{outreachStats.delivered}</span>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[#8b7355]">Read</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-blue-600">{outreachStats.read}</span>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[#8b7355]">Failed</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-red-600">{outreachStats.failed}</span>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[#8b7355]">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-yellow-600">{outreachStats.pending}</span>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[#8b7355]">Greetings</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-[#6b8e6b]">{outreachStats.greetingsSent}</span>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[#8b7355]">Reminders</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-[#8b7355]">{outreachStats.remindersSent}</span>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex gap-2 border-b pb-2">
        <Button 
          variant={outreachSubTab === "send" ? "default" : "ghost"}
          onClick={() => setOutreachSubTab("send")}
          className={outreachSubTab === "send" ? "bg-[#6b8e6b]" : ""}
        >
          <Send className="h-4 w-4 mr-2" />
          Send Messages
        </Button>
        <Button 
          variant={outreachSubTab === "templates" ? "default" : "ghost"}
          onClick={() => setOutreachSubTab("templates")}
          className={outreachSubTab === "templates" ? "bg-[#6b8e6b]" : ""}
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          Templates
        </Button>
        <Button 
          variant={outreachSubTab === "history" ? "default" : "ghost"}
          onClick={() => setOutreachSubTab("history")}
          className={outreachSubTab === "history" ? "bg-[#6b8e6b]" : ""}
        >
          <Calendar className="h-4 w-4 mr-2" />
          Message History
        </Button>
      </div>

      {outreachSubTab === "send" && (
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-lg text-[#3d3024]">Send WhatsApp Messages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Select Message Template</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger data-testid="select-template">
                  <SelectValue placeholder="Choose a template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.templateName} ({t.templateType})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {templates.length === 0 && (
                <p className="text-sm text-amber-600">No templates yet. Create one in the Templates tab.</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Select Guests ({selectedGuestIds.length} selected)</Label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAllFiltered}>
                    Select All ({filteredGuests.length})
                  </Button>
                  <Button variant="outline" size="sm" onClick={clearSelection}>
                    Clear
                  </Button>
                </div>
              </div>
              
              <div className="flex gap-2 flex-wrap">
                <Button 
                  variant={guestStatusFilter === "all" ? "default" : "outline"} 
                  size="sm"
                  onClick={() => setGuestStatusFilter("all")}
                  className={guestStatusFilter === "all" ? "bg-[#6b8e6b]" : ""}
                >
                  All ({statusCounts.all})
                </Button>
                <Button 
                  variant={guestStatusFilter === "pending" ? "default" : "outline"} 
                  size="sm"
                  onClick={() => setGuestStatusFilter("pending")}
                  className={guestStatusFilter === "pending" ? "bg-yellow-600" : ""}
                >
                  Pending ({statusCounts.pending})
                </Button>
                <Button 
                  variant={guestStatusFilter === "yes" ? "default" : "outline"} 
                  size="sm"
                  onClick={() => setGuestStatusFilter("yes")}
                  className={guestStatusFilter === "yes" ? "bg-green-600" : ""}
                >
                  Confirmed ({statusCounts.yes})
                </Button>
                <Button 
                  variant={guestStatusFilter === "maybe" ? "default" : "outline"} 
                  size="sm"
                  onClick={() => setGuestStatusFilter("maybe")}
                  className={guestStatusFilter === "maybe" ? "bg-amber-500" : ""}
                >
                  Maybe ({statusCounts.maybe})
                </Button>
                <Button 
                  variant={guestStatusFilter === "no" ? "default" : "outline"} 
                  size="sm"
                  onClick={() => setGuestStatusFilter("no")}
                  className={guestStatusFilter === "no" ? "bg-red-600" : ""}
                >
                  Declined ({statusCounts.no})
                </Button>
              </div>

              <div className="max-h-60 overflow-y-auto border rounded-md p-2 space-y-1">
                {filteredGuests.length === 0 ? (
                  <div className="text-center py-4 text-[#8b7355]">
                    No guests with this status
                  </div>
                ) : (
                  filteredGuests.map(guest => {
                    const status = getGuestStatus(guest.id);
                    return (
                      <div 
                        key={guest.id} 
                        className={cn(
                          "flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer",
                          selectedGuestIds.includes(guest.id) && "bg-[#6b8e6b]/10"
                        )}
                        onClick={() => toggleGuestSelection(guest.id)}
                      >
                        <Checkbox 
                          checked={selectedGuestIds.includes(guest.id)}
                          onClick={(e) => e.stopPropagation()}
                          onCheckedChange={() => toggleGuestSelection(guest.id)}
                        />
                        <div className="flex-1">
                          <span className="font-medium">{guest.name}</span>
                          <span className="text-sm text-[#8b7355] ml-2">{guest.phone}</span>
                        </div>
                        <Badge variant={status === 'yes' ? 'default' : status === 'no' ? 'destructive' : 'secondary'}>
                          {status}
                        </Badge>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <Button 
              className="w-full bg-[#6b8e6b] hover:bg-[#5a7a5a]"
              onClick={handleSendMessages}
              disabled={isSending || !selectedTemplateId || selectedGuestIds.length === 0}
              data-testid="send-messages-btn"
            >
              {isSending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send to {selectedGuestIds.length} Guest{selectedGuestIds.length !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {outreachSubTab === "templates" && (
        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg text-[#3d3024]">Message Templates</CardTitle>
            <Button 
              onClick={() => {
                setEditingTemplate(null);
                setIsTemplateDialogOpen(true);
              }}
              className="bg-[#6b8e6b] hover:bg-[#5a7a5a]"
              data-testid="add-template-btn"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </Button>
          </CardHeader>
          <CardContent>
            {templates.length === 0 ? (
              <div className="text-center py-8 text-[#8b7355]">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No templates yet. Create your first greeting template!</p>
                <p className="text-sm mt-2">Use variables: {"{{guestName}}"}, {"{{eventName}}"}, {"{{eventDate}}"}, {"{{venue}}"}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {templates.map(template => (
                  <div key={template.id} className="p-4 border rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-[#3d3024]">{template.templateName}</div>
                        <Badge className="mt-1">{template.templateType}</Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => {
                            setEditingTemplate(template);
                            setIsTemplateDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => deleteTemplateMutation.mutate(template.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-[#8b7355] whitespace-pre-wrap bg-gray-50 p-2 rounded">
                      {template.messageContent}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {outreachSubTab === "history" && (
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-lg text-[#3d3024]">Message History</CardTitle>
          </CardHeader>
          <CardContent>
            {messageLogs.length === 0 ? (
              <div className="text-center py-8 text-[#8b7355]">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No messages sent yet</p>
              </div>
            ) : (
              <>
                <div className="md:hidden divide-y">
                  {messageLogs.map(log => {
                    const guest = guests.find(g => g.id === log.guestId);
                    return (
                      <div key={log.id} className="p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{guest?.name || 'Unknown'}</div>
                            <div className="text-xs text-[#8b7355]">{log.recipientPhone}</div>
                          </div>
                          <Badge 
                            variant={
                              log.deliveryStatus === 'delivered' || log.deliveryStatus === 'read' 
                                ? 'default' 
                                : log.deliveryStatus === 'failed' 
                                  ? 'destructive' 
                                  : 'secondary'
                            }
                            className="shrink-0"
                          >
                            {log.deliveryStatus}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <Badge variant="outline">{log.messageType}</Badge>
                          <span className="text-[#8b7355]">{log.sentAt ? format(parseISO(log.sentAt), 'MMM d, h:mm a') : '-'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Table className="hidden md:table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Guest</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {messageLogs.map(log => {
                      const guest = guests.find(g => g.id === log.guestId);
                      return (
                        <TableRow key={log.id}>
                          <TableCell>
                            <div>{guest?.name || 'Unknown'}</div>
                            <div className="text-sm text-[#8b7355]">{log.recipientPhone}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.messageType}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                log.deliveryStatus === 'delivered' || log.deliveryStatus === 'read' 
                                  ? 'default' 
                                  : log.deliveryStatus === 'failed' 
                                    ? 'destructive' 
                                    : 'secondary'
                              }
                            >
                              {log.deliveryStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-[#8b7355]">
                            {log.sentAt ? format(parseISO(log.sentAt), 'MMM d, h:mm a') : '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create Template'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTemplateSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="templateName">Template Name</Label>
              <Input
                id="templateName"
                name="templateName"
                defaultValue={editingTemplate?.templateName || ''}
                required
                placeholder="e.g., Welcome Greeting"
                data-testid="input-template-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="templateType">Type</Label>
              <Select name="templateType" defaultValue={editingTemplate?.templateType || 'greeting'}>
                <SelectTrigger data-testid="select-template-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="greeting">Greeting (Initial Introduction)</SelectItem>
                  <SelectItem value="reminder_1">First Reminder</SelectItem>
                  <SelectItem value="reminder_2">Second Reminder</SelectItem>
                  <SelectItem value="reminder_final">Final Reminder</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="messageContent">Message Content</Label>
              <Textarea
                id="messageContent"
                name="messageContent"
                defaultValue={editingTemplate?.messageContent || `Namaste {{guestName}},

Welcome to the celebration! We are Oakstreet Events, and we're delighted to assist with your RSVP for {{eventName}} on {{eventDate}} at {{venue}}.

Please let us know if you'll be joining us. We look forward to seeing you!

Warm regards,
Oakstreet Events Team`}
                required
                rows={8}
                placeholder="Use {{guestName}}, {{eventName}}, {{eventDate}}, {{venue}} for personalization"
                data-testid="input-template-content"
              />
              <p className="text-xs text-[#8b7355]">
                Available variables: {"{{guestName}}"}, {"{{eventName}}"}, {"{{eventDate}}"}, {"{{venue}}"}
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsTemplateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-[#6b8e6b] hover:bg-[#5a7a5a]" data-testid="save-template-btn">
                {editingTemplate ? 'Update' : 'Create'} Template
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
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
  const [individualMsgGuest, setIndividualMsgGuest] = useState<EventGuest | null>(null);
  const [individualMessage, setIndividualMessage] = useState("");
  const [isSendingIndividual, setIsSendingIndividual] = useState(false);
  
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
              <PopoverContent className="w-[350px] p-0">
                <Command>
                  <CommandInput placeholder="Search by name, customer, or venue..." />
                  <CommandList className="max-h-[300px] overflow-y-auto">
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
                          value={`${event.customer || ''} ${event.title} ${event.venue || ''}`}
                          onSelect={() => {
                            setSelectedEventId(event.id);
                            setEventComboOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", selectedEventId === event.id ? "opacity-100" : "opacity-0")} />
                          <div className="flex flex-col">
                            <span className="font-medium">{event.customer || event.title}</span>
                            {event.venue && <span className="text-xs text-[#8b7355]">{event.venue}</span>}
                          </div>
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
            <TabsTrigger value="outreach" data-testid="tab-outreach">Outreach</TabsTrigger>
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 gap-3">
              <div className="flex flex-col sm:flex-row gap-2 flex-1">
                <div className="relative flex-1 sm:flex-none">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8b7355]" />
                  <Input
                    placeholder="Search guests..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-full sm:w-48 lg:w-64"
                    data-testid="search-guests"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[130px]" data-testid="status-filter">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all"><span className="hidden sm:inline">All Statuses</span><span className="sm:hidden">All</span></SelectItem>
                    <SelectItem value="yes"><span className="hidden sm:inline">Confirmed</span><span className="sm:hidden">Yes</span></SelectItem>
                    <SelectItem value="no"><span className="hidden sm:inline">Declined</span><span className="sm:hidden">No</span></SelectItem>
                    <SelectItem value="maybe">Maybe</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button 
                onClick={() => {
                  if (!selectedEventId) {
                    toast({ title: "Please select an event first", variant: "destructive" });
                    return;
                  }
                  setEditingGuest(null);
                  setIsGuestDialogOpen(true);
                }}
                className="bg-[#6b8e6b] hover:bg-[#5a7a5a] w-full sm:w-auto"
                data-testid="add-guest-btn"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Guest
              </Button>
            </div>

            <Card className="bg-white">
              {guestsLoading ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto text-[#8b7355]" />
                </div>
              ) : filteredGuestsWithResponses.length === 0 ? (
                <div className="text-center py-8 text-[#8b7355]">
                  {selectedEventId ? "No guests found" : "Select an event to view guests"}
                </div>
              ) : (
                <>
                  <div className="md:hidden divide-y">
                    {filteredGuestsWithResponses.map(({ guest, response }) => (
                      <div key={guest.id} className="p-3 space-y-2" data-testid={`guest-card-${guest.id}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{guest.name}</div>
                            <div className="flex items-center gap-1 text-xs text-[#8b7355]">
                              <Phone className="h-3 w-3 shrink-0" />
                              <span className="truncate">{guest.phone}</span>
                            </div>
                          </div>
                          <div className="shrink-0">
                            {getStatusBadge(response?.attendanceStatus || 'pending')}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-[#8b7355]">
                          {guest.relationship && <span>{guest.relationship}</span>}
                          {guest.guestGroup && <span>• {guest.guestGroup}</span>}
                          <span>• Max: {guest.maxAttendees}</span>
                          {response?.attendanceStatus === 'yes' && <span>• {response.numberOfAttendees} attending</span>}
                        </div>
                        <div className="flex justify-end gap-1 pt-1">
                          {(user?.role === 'superadmin' || user?.role === 'wedding_planner') && guest.phone && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                const event = selectedEvent;
                                const defaultMsg = event 
                                  ? `Hello ${guest.name}! We're looking forward to seeing you at ${event.customer || event.title}. Please confirm your attendance.`
                                  : `Hello ${guest.name}! Please confirm your attendance.`;
                                setIndividualMessage(defaultMsg);
                                setIndividualMsgGuest(guest);
                              }}
                            >
                              <MessageSquare className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setEditingGuest(guest);
                              setIsGuestDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setGuestToDelete(guest)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Table className="hidden md:table">
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
                      {filteredGuestsWithResponses.map(({ guest, response }) => (
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
                              {(user?.role === 'superadmin' || user?.role === 'wedding_planner') && guest.phone && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    const event = selectedEvent;
                                    const defaultMsg = event 
                                      ? `Hello ${guest.name}! We're looking forward to seeing you at ${event.customer || event.title}. Please confirm your attendance.`
                                      : `Hello ${guest.name}! Please confirm your attendance.`;
                                    setIndividualMessage(defaultMsg);
                                    setIndividualMsgGuest(guest);
                                  }}
                                  title="Send WhatsApp message"
                                  data-testid={`whatsapp-guest-${guest.id}`}
                                >
                                  <MessageSquare className="h-4 w-4 text-green-600" />
                                </Button>
                              )}
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
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="responses" className="space-y-4">
            <Card className="bg-white">
              {responsesLoading ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto text-[#8b7355]" />
                </div>
              ) : responses.length === 0 ? (
                <div className="text-center py-8 text-[#8b7355]">
                  No responses yet
                </div>
              ) : (
                <>
                  <div className="md:hidden divide-y">
                    {responses.map((response) => {
                      const guest = guests.find(g => g.id === response.guestId);
                      return (
                        <div key={response.id} className="p-3 space-y-2" data-testid={`response-card-${response.id}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">{guest?.name || 'Unknown'}</div>
                              {response.respondedAt && (
                                <div className="text-xs text-[#8b7355]">{format(parseISO(response.respondedAt), 'MMM d, yyyy')}</div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {getStatusBadge(response.attendanceStatus)}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => {
                                  setEditingResponse(response);
                                  setIsResponseDialogOpen(true);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          {response.attendanceStatus === 'yes' && (
                            <div className="flex flex-wrap gap-2 text-xs">
                              <span className="text-[#8b7355]">{response.numberOfAttendees} attending</span>
                              {response.mealPreference && <span>• {getMealBadge(response.mealPreference)}</span>}
                              {response.needsAccommodation && (
                                <Badge variant="outline" className="text-xs">
                                  <Hotel className="h-3 w-3 mr-1" />
                                  {response.accommodationNights || '?'} nights
                                </Badge>
                              )}
                              {response.needsTransportation && (
                                <Badge variant="outline" className="text-xs">
                                  <Car className="h-3 w-3 mr-1" />
                                  Transport
                                </Badge>
                              )}
                            </div>
                          )}
                          <Badge variant="secondary" className="text-xs">{response.responseSource}</Badge>
                        </div>
                      );
                    })}
                  </div>
                  <Table className="hidden md:table">
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
                      {responses.map((response) => {
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
                      })}
                    </TableBody>
                  </Table>
                </>
              )}
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

          <TabsContent value="outreach" className="space-y-4">
            <OutreachTab 
              eventId={selectedEventId} 
              guests={guests}
              responses={responses}
            />
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

      <Dialog open={!!individualMsgGuest} onOpenChange={(open) => !open && setIndividualMsgGuest(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-green-600" />
              Send WhatsApp Message
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-[#f5f2ed] rounded-lg">
              <div className="font-medium text-[#3d3024]">{individualMsgGuest?.name}</div>
              <div className="text-sm text-[#8b7355]">{individualMsgGuest?.phone}</div>
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                value={individualMessage}
                onChange={(e) => setIndividualMessage(e.target.value)}
                rows={5}
                placeholder="Type your message..."
                data-testid="individual-message-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIndividualMsgGuest(null)}>
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={async () => {
                if (!individualMsgGuest || !individualMessage.trim()) return;
                setIsSendingIndividual(true);
                try {
                  const res = await fetch('/api/rsvp-send-messages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      eventId: selectedEventId,
                      guestIds: [individualMsgGuest.id],
                      messageContent: individualMessage,
                      messageType: 'individual'
                    })
                  });
                  if (!res.ok) throw new Error('Failed to send');
                  toast({ title: "Message sent!", description: `Message sent to ${individualMsgGuest.name}` });
                  setIndividualMsgGuest(null);
                  setIndividualMessage("");
                } catch (error) {
                  toast({ title: "Failed to send message", variant: "destructive" });
                } finally {
                  setIsSendingIndividual(false);
                }
              }}
              disabled={isSendingIndividual || !individualMessage.trim()}
              data-testid="send-individual-msg-btn"
            >
              {isSendingIndividual ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Message
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
